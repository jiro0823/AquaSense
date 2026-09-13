#include "BackendDeviceClient.h"
#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <string.h>
#include "config/DeviceConfig.h"
#if __has_include("secrets/Secrets.h")
#include "secrets/Secrets.h"
#else
#include "secrets/Secrets.example.h"
#endif

bool BackendDeviceClient::begin() {
    if (task) return true;
    if (!Secrets::DEVICE_KEY[0]) { Serial.println("Backend control disabled: configure private DEVICE_KEY and API address."); return false; }
    if (!strncmp(DeviceConfig::BACKEND_API_BASE_URL, "https://", 8) && !DeviceConfig::BACKEND_ROOT_CA[0]) {
        Serial.println("Backend HTTPS disabled: configure the server's trusted root CA."); return false;
    }
    states = xQueueCreate(1, sizeof(SystemState)); commands = xQueueCreate(1, sizeof(Command));
    receipts = xQueueCreate(1, sizeof(CommandReceipt)); schedulesQueue = xQueueCreate(1, sizeof(FeedingSchedules));
    if (states && commands && receipts && schedulesQueue && xTaskCreate(taskEntry, "aq-backend",
        DeviceConfig::BACKEND_TASK_STACK_BYTES, this, 1, &task) == pdPASS) return true;
    for (auto queue : {states, commands, receipts, schedulesQueue}) if (queue) vQueueDelete(queue);
    states = commands = receipts = schedulesQueue = nullptr; task = nullptr;
    Serial.println("Backend worker unavailable; local safety remains active."); return false;
}
void BackendDeviceClient::update(const SystemState& state) { if (states) xQueueOverwrite(states, &state); }
bool BackendDeviceClient::takeCommand(Command& command) { return commands && xQueueReceive(commands, &command, 0) == pdTRUE; }
bool BackendDeviceClient::takeSchedules(FeedingSchedules& next) { return schedulesQueue && xQueueReceive(schedulesQueue, &next, 0) == pdTRUE; }
void BackendDeviceClient::acknowledge(const CommandReceipt& receipt) { if (receipts) xQueueOverwrite(receipts, &receipt); }
void BackendDeviceClient::taskEntry(void* context) { static_cast<BackendDeviceClient*>(context)->run(); }
void BackendDeviceClient::run() {
    SystemState state{}; CommandReceipt receipt{}; bool hasReceipt = false;
    for (;;) {
        xQueueReceive(states, &state, 0);
        if (xQueueReceive(receipts, &receipt, 0) == pdTRUE) hasReceipt = true;
        if (WiFi.status() == WL_CONNECTED && sync(state, hasReceipt ? &receipt : nullptr)) hasReceipt = false;
        vTaskDelay(pdMS_TO_TICKS(DeviceConfig::BACKEND_SYNC_INTERVAL_MS));
    }
}
bool BackendDeviceClient::sync(const SystemState& state, const CommandReceipt* receipt) {
    document.clear();
    document["deviceId"] = DeviceConfig::DEVICE_ID;
    JsonObject report = document.createNestedObject("state");
    report["fillPump"] = state.fillPump; report["drainPump"] = state.drainPump; report["aerator"] = state.aerator;
    report["feederBusy"] = state.feederBusy; report["buzzer"] = state.buzzer; report["automation"] = state.automation;
    report["waterPhase"] = state.waterPhase; report["fault"] = state.fault; report["relaysReady"] = state.relaysReady;
    report["timeValid"] = state.rtcTimeValid; report["wifiConnected"] = state.wifiConnected;
    report["mqttConnected"] = state.mqttConnected; report["uptimeMs"] = state.uptimeMs;
    if (receipt) {
        JsonObject ack = document.createNestedObject("receipt");
        ack["id"] = receipt->id; ack["source"] = receipt->feedingSource ? "feeding" : "hardware"; ack["result"] = receipt->result;
    }
    String body; body.reserve(1024); serializeJson(document, body);
    WiFiClient plainTransport; WiFiClientSecure secureTransport; HTTPClient http;
    const bool secure = !strncmp(DeviceConfig::BACKEND_API_BASE_URL, "https://", 8);
    if (secure) secureTransport.setCACert(DeviceConfig::BACKEND_ROOT_CA);
    WiFiClient& transport = secure ? static_cast<WiFiClient&>(secureTransport) : plainTransport;
    http.useHTTP10(true); // Stream JSON without HTTP chunk framing.
    http.setConnectTimeout(DeviceConfig::BACKEND_HTTP_TIMEOUT_MS);
    http.setTimeout(DeviceConfig::BACKEND_HTTP_TIMEOUT_MS);
    const String url = String(DeviceConfig::BACKEND_API_BASE_URL) + "/hardware/device/sync";
    if (!http.begin(transport, url)) return false;
    http.addHeader("Content-Type", "application/json"); http.addHeader("x-device-key", Secrets::DEVICE_KEY);
    const uint32_t startedMs = millis();
    const int code = http.POST(body);
    if (code != 200 || http.getSize() > 8192) { Serial.printf("Backend sync HTTP %d\n", code); http.end(); return false; }
    document.clear();
    const auto error = deserializeJson(document, http.getStream());
    http.end();
    if (error || !document["success"].as<bool>() || !document["data"].is<JsonObject>()) return false;
    decode(uint32_t(millis() - startedMs)); return true;
}
CommandAction BackendDeviceClient::parseAction(const char* action, bool feeding) {
    if (feeding) {
        if (!strcmp(action, "TRIGGER")) return CommandAction::FeedTrigger;
        if (!strcmp(action, "ON")) return CommandAction::FeedOn;
        if (!strcmp(action, "OFF")) return CommandAction::FeedOff;
        return CommandAction::Invalid;
    }
    const char* names[] = {"FILL", "DRAIN", "WATER_EXCHANGE", "WATER_STOP", "AERATOR_ON", "AERATOR_OFF", "AERATOR_AUTO",
        "AUTOMATION_ON", "AUTOMATION_OFF", "BUZZER_ON", "BUZZER_OFF", "ALL_OFF", "CLEAR_FAULT"};
    for (uint8_t i = 0; i < sizeof(names) / sizeof(names[0]); ++i) if (!strcmp(action, names[i])) return static_cast<CommandAction>(i);
    return CommandAction::Invalid;
}
void BackendDeviceClient::decode(uint32_t elapsedMs) {
    const JsonObject data = document["data"];
    const JsonObject item = data["command"];
    if (!item.isNull()) {
        const char* id = item["id"] | ""; const char* source = item["source"] | "";
        if (strlen(id) == 36 && strcmp(id, deliveredId) && (!strcmp(source, "hardware") || !strcmp(source, "feeding"))) {
            Command command{}; strlcpy(command.id, id, sizeof(command.id)); command.feedingSource = !strcmp(source, "feeding");
            command.action = parseAction(item["action"] | "", command.feedingSource);
            command.durationMs = item["durationMs"] | 0u; command.receivedAtMs = millis();
            const uint32_t ttl = item["ttlMs"] | 0u;
            command.ttlMs = ttl <= DeviceConfig::COMMAND_MAX_TTL_MS && ttl > elapsedMs ? ttl - elapsedMs : 0;
            if (xQueueSend(commands, &command, 0) == pdTRUE) strlcpy(deliveredId, id, sizeof(deliveredId));
        }
    }
    if (!data["schedules"].is<JsonArray>()) return;
    FeedingSchedules next{};
    for (JsonObject schedule : data["schedules"].as<JsonArray>()) {
        if (next.count >= MAX_FEEDING_SCHEDULES) break;
        const char* id = schedule["id"] | ""; const char* date = schedule["date"] | ""; const char* time = schedule["time"] | "";
        if (strlen(id) != 36 || (strlen(date) != 0 && strlen(date) != 10) || strlen(time) != 5) continue;
        auto& out = next.items[next.count++];
        strlcpy(out.id, id, sizeof(out.id)); strlcpy(out.date, date, sizeof(out.date)); strlcpy(out.time, time, sizeof(out.time));
    }
    xQueueOverwrite(schedulesQueue, &next);
}
