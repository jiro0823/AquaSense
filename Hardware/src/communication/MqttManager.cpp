#include "MqttManager.h"
#include <ArduinoJson.h>
#include <Arduino.h>
#include <mbedtls/md.h>
#include <time.h>
#include <stdio.h>
#include <math.h>
#include <string.h>
#include "config/DeviceConfig.h"
#include "config/CalibrationConfig.h"
#include "../sensors/SensorConversions.h"
#if __has_include("secrets/Secrets.h")
#include "secrets/Secrets.h"
#else
#include "secrets/Secrets.example.h"
#endif

#if defined(AQUASENSE_PRODUCTION_BUILD)
static_assert(DeviceConfig::mqttTlsConfigured(DeviceConfig::MQTT_TLS_ENABLED, DeviceConfig::MQTT_ROOT_CA,
    Secrets::MQTT_USERNAME, Secrets::MQTT_PASSWORD),
    "Production MQTT requires a trusted CA and unique broker credentials in local configuration.");
static_assert(DeviceConfig::validMqttDeviceId(DeviceConfig::DEVICE_ID),
    "Production MQTT requires a topic-safe device ID.");
static_assert(DeviceConfig::mqttHostConfigured(DeviceConfig::MQTT_HOST),
    "Production MQTT requires a real reachable broker host.");
#endif

namespace {
constexpr size_t COMMAND_BUFFER_BYTES = 1024;
constexpr size_t STATE_BUFFER_BYTES = 2048;
// These buffers are shared by the MQTT worker's synchronous callbacks and
// publishing paths. Keeping them out of the task stack avoids several KB of
// transient stack use when serializing telemetry and command state.
StaticJsonDocument<STATE_BUFFER_BYTES> mqttJsonDocument;
char mqttPayloadBuffer[STATE_BUFFER_BYTES];
char mqttCommandBuffer[COMMAND_BUFFER_BYTES];
uint64_t epochMillis();

bool publishTelemetryFrame(PubSubClient& client, const SensorReadings& reading) {
    char topic[160], messageId[48];
    mqttJsonDocument.clear();
    snprintf(topic, sizeof(topic), "%s/%s/telemetry/frame", DeviceConfig::MQTT_TOPIC_NAMESPACE, DeviceConfig::DEVICE_ID);
    snprintf(messageId, sizeof(messageId), "%s-%lu", reading.bootId,
        static_cast<unsigned long>(reading.sequence));

    JsonDocument& doc = mqttJsonDocument;
    doc["v"] = 1;
    doc["deviceId"] = DeviceConfig::DEVICE_ID;
    doc["bootId"] = reading.bootId;
    doc["sequence"] = reading.sequence;
    doc["messageId"] = messageId;
    const uint32_t sampleAgeMs = uint32_t(millis() - reading.sampledAtMs);
    doc["sampleAgeMs"] = sampleAgeMs;
    const uint64_t now = epochMillis();
    if (now >= sampleAgeMs && now != 0) doc["timestamp"] = now - sampleAgeMs;
    if (reading.temperatureValid) doc["temperature"] = reading.temperatureC;
    else doc["temperature"] = nullptr;
    if (reading.phValid) doc["ph"] = reading.ph;
    else doc["ph"] = nullptr;
    if (reading.turbidityValid) doc["turbidity"] = reading.turbidityRaw;
    else doc["turbidity"] = nullptr;
    doc["turbidityUnit"] = reading.turbidityValid ? "NTU" : "unknown";
    if (reading.orpValid) doc["orp"] = reading.orpMv;
    else doc["orp"] = nullptr;
    doc["do"] = nullptr;
    JsonObject sensors = doc.createNestedObject("sensors");
    JsonObject temperature = sensors.createNestedObject("temperature");
    temperature["connected"] = reading.temperatureConnected;
    temperature["sampleAgeMs"] = uint32_t(millis() - reading.temperatureSampledAtMs);
    const auto addAnalogDiagnostics = [](JsonObject target, const AnalogDiagnostics& diagnostics, bool connected,
                                         const char* sensorName, int connectMin, int connectMax) {
        target["connected"] = connected;
        target["sampleAgeMs"] = uint32_t(millis() - diagnostics.sampledAtMs);
        target["rawAdc"] = diagnostics.rawAdc;
        target["voltage"] = diagnostics.voltage;
        target["adcMinimum"] = diagnostics.minimum;
        target["adcMaximum"] = diagnostics.maximum;
        target["adcLast"] = diagnostics.last;
        target["clippedSamples"] = diagnostics.clipped;
#if defined(AQUASENSE_PUBLIC_MQTT_DEV)
        const bool usable = SensorConversions::provisionalAcquisitionUsable(
            diagnostics.rawAdc, diagnostics.minimum, diagnostics.maximum,
            diagnostics.clipped, diagnostics.voltage, connectMin, connectMax);
        float value = NAN;
        const char* unit = nullptr;
        if (usable && strcmp(sensorName, "ph") == 0) {
            value = SensorConversions::provisionalPhFromVoltage(diagnostics.voltage);
            unit = "pH";
        } else if (usable && strcmp(sensorName, "turbidity") == 0) {
            value = SensorConversions::provisionalTurbidityFromAdc(diagnostics.rawAdc);
            unit = "NTU";
        } else if (usable && strcmp(sensorName, "orp") == 0) {
            value = SensorConversions::orpFromVoltage(diagnostics.voltage);
            unit = "mV";
        }
        if (unit && isfinite(value)) {
            JsonObject provisional = target.createNestedObject("provisional");
            provisional["value"] = value;
            provisional["unit"] = unit;
            provisional["status"] = "UNVERIFIED";
        } else {
            target["provisional"] = nullptr;
        }
#else
        (void)sensorName;
#endif
    };
    addAnalogDiagnostics(sensors.createNestedObject("ph"), reading.phDiagnostics, reading.phConnected, "ph",
        CalibrationConfig::PH_CONNECT_MIN, CalibrationConfig::PH_CONNECT_MAX);
    addAnalogDiagnostics(sensors.createNestedObject("turbidity"), reading.turbidityDiagnostics, reading.turbidityConnected, "turbidity",
        CalibrationConfig::TURBIDITY_CONNECT_MIN, CalibrationConfig::TURBIDITY_CONNECT_MAX);
    addAnalogDiagnostics(sensors.createNestedObject("orp"), reading.orpDiagnostics, reading.orpConnected, "orp",
        CalibrationConfig::ORP_CONNECT_MIN, CalibrationConfig::ORP_CONNECT_MAX);

    if (serializeJson(doc, mqttPayloadBuffer, sizeof(mqttPayloadBuffer)) == 0) return false;
    const bool success = client.publish(topic, mqttPayloadBuffer, false);
    if (success && DeviceConfig::SERIAL_DEBUG_MODE)
        Serial.printf("MQTT debug: telemetry published device=%s messageId=%s\n", DeviceConfig::DEVICE_ID, messageId);
    else if (!success) Serial.printf("MQTT telemetry publish failed: device=%s messageId=%s\n", DeviceConfig::DEVICE_ID, messageId);
    return success;
}

bool hmacHex(const char* message, char* output, size_t outputSize) {
    if (!Secrets::DEVICE_KEY[0] || outputSize < 65) return false;
    uint8_t digest[32];
    const mbedtls_md_info_t* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    if (!info || mbedtls_md_hmac(info, reinterpret_cast<const unsigned char*>(Secrets::DEVICE_KEY),
            strlen(Secrets::DEVICE_KEY), reinterpret_cast<const unsigned char*>(message),
            strlen(message), digest) != 0) return false;
    for (size_t i = 0; i < sizeof(digest); ++i) snprintf(output + i * 2, 3, "%02x", digest[i]);
    output[64] = '\0';
    return true;
}

bool signatureMatches(const char* message, const char* signature) {
    if (!signature || strlen(signature) != 64) return false;
    char expected[65];
    if (!hmacHex(message, expected, sizeof(expected))) return false;
    uint8_t difference = 0;
    for (size_t i = 0; i < 64; ++i) difference |= uint8_t(expected[i] ^ signature[i]);
    return difference == 0;
}

bool validId(const char* id) {
    if (!id || strlen(id) != 36) return false;
    for (size_t i = 0; i < 36; ++i) {
        const char c = id[i];
        if (i == 8 || i == 13 || i == 18 || i == 23) { if (c != '-') return false; }
        else if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'))) return false;
    }
    return true;
}

CommandAction actionFor(const char* action, bool feeding) {
    if (feeding) {
        if (!strcmp(action, "TRIGGER")) return CommandAction::FeedTrigger;
        if (!strcmp(action, "ON")) return CommandAction::FeedOn;
        if (!strcmp(action, "OFF")) return CommandAction::FeedOff;
        return CommandAction::Invalid;
    }
    if (!strcmp(action, "STATUS_REQUEST")) return CommandAction::StatusRequest;
    const char* names[] = {"FILL", "DRAIN", "WATER_EXCHANGE", "WATER_STOP", "AERATOR_ON", "AERATOR_OFF", "AERATOR_AUTO",
        "AUTOMATION_ON", "AUTOMATION_OFF", "BUZZER_ON", "BUZZER_OFF", "ALL_OFF", "CLEAR_FAULT"};
    for (uint8_t i = 0; i < sizeof(names) / sizeof(names[0]); ++i)
        if (!strcmp(action, names[i])) return static_cast<CommandAction>(i);
    return CommandAction::Invalid;
}

const char* actionName(CommandAction action) {
    switch (action) {
        case CommandAction::Fill: return "FILL"; case CommandAction::Drain: return "DRAIN";
        case CommandAction::WaterExchange: return "WATER_EXCHANGE"; case CommandAction::WaterStop: return "WATER_STOP";
        case CommandAction::AeratorOn: return "AERATOR_ON"; case CommandAction::AeratorOff: return "AERATOR_OFF";
        case CommandAction::AeratorAuto: return "AERATOR_AUTO"; case CommandAction::AutomationOn: return "AUTOMATION_ON";
        case CommandAction::AutomationOff: return "AUTOMATION_OFF"; case CommandAction::BuzzerOn: return "BUZZER_ON";
        case CommandAction::BuzzerOff: return "BUZZER_OFF"; case CommandAction::AllOff: return "ALL_OFF";
        case CommandAction::ClearFault: return "CLEAR_FAULT"; case CommandAction::FeedTrigger: return "TRIGGER";
        case CommandAction::FeedOn: return "ON"; case CommandAction::FeedOff: return "OFF";
        case CommandAction::StatusRequest: return "STATUS_REQUEST"; default: return "INVALID";
    }
}

uint64_t epochMillis() {
    const time_t seconds = time(nullptr);
    if (seconds < time_t(DeviceConfig::MIN_VALID_EPOCH)) return 0;
    return uint64_t(seconds) * 1000ULL;
}
}

MqttManager* MqttManager::callbackOwner = nullptr;
MqttManager::MqttManager() : client(transport) {}

bool MqttManager::begin() {
    if (task != nullptr) return true;
    if (!DeviceConfig::mqttCredentialsPaired(Secrets::MQTT_USERNAME, Secrets::MQTT_PASSWORD)) {
        Serial.println("MQTT disabled: configure both broker username and password."); return false;
    }
    if (DeviceConfig::MQTT_TLS_ENABLED) {
        if (!DeviceConfig::mqttHostConfigured(DeviceConfig::MQTT_HOST) || !DeviceConfig::MQTT_PORT ||
            !DeviceConfig::mqttTlsConfigured(true, DeviceConfig::MQTT_ROOT_CA, Secrets::MQTT_USERNAME, Secrets::MQTT_PASSWORD)) {
            Serial.println("MQTT disabled: TLS CA and unique broker credentials are required."); return false;
        }
        tlsTransport.setCACert(DeviceConfig::MQTT_ROOT_CA);
        client.setClient(tlsTransport);
    }
    if (!DeviceConfig::deviceIdIsConfigured(DeviceConfig::DEVICE_ID) || !DeviceConfig::validMqttDeviceId(DeviceConfig::DEVICE_ID)) {
        Serial.println("MQTT disabled: configure a unique device ID."); return false;
    }
    if (!Secrets::DEVICE_KEY[0]) Serial.println("MQTT actuator commands disabled: DEVICE_KEY is empty; telemetry remains enabled.");
    client.setServer(DeviceConfig::MQTT_HOST, DeviceConfig::MQTT_PORT);
    client.setSocketTimeout(DeviceConfig::MQTT_SOCKET_TIMEOUT_SECONDS);
    client.setCallback(messageCallback);
    if (!client.setBufferSize(3072)) return false;
    snapshots = xQueueCreateStatic(1, sizeof(SensorReadings), queueBytes, &queueStorage);
    commands = xQueueCreate(4, sizeof(MqttActuatorCommand));
    states = xQueueCreate(1, sizeof(SystemState));
    acknowledgements = xQueueCreate(4, sizeof(MqttPendingAcknowledgement));
    if (!snapshots || !commands || !states || !acknowledgements) return false;
    callbackOwner = this;
    if (xTaskCreate(runTask, "aquasense-mqtt", DeviceConfig::MQTT_TASK_STACK_BYTES,
                    this, 1, &task) != pdPASS) {
        task = nullptr;
        Serial.println("MQTT worker unavailable; local monitoring continues.");
        return false;
    }
    return true;
}

void MqttManager::update(const SensorReadings& readings) {
    if (task == nullptr || readings.sequence == lastQueuedSequence) return;
    xQueueOverwrite(snapshots, &readings);
    lastQueuedSequence = readings.sequence;
}
void MqttManager::updateState(const SystemState& state) { if (states) xQueueOverwrite(states, &state); }
bool MqttManager::takeCommand(MqttActuatorCommand& command) { return commands && xQueueReceive(commands, &command, 0) == pdTRUE; }
void MqttManager::acknowledge(const MqttActuatorCommand& command, const CommandReceipt& receipt) {
    if (!acknowledgements) return;
    MqttPendingAcknowledgement pending{};
    pending.command = command;
    pending.receipt = receipt;
    if (xQueueSend(acknowledgements, &pending, 0) != pdTRUE)
        Serial.printf("MQTT acknowledgement queue full; command %s result %s was not queued.\n",
                      command.command.id, receipt.result);
}
bool MqttManager::isConnected() const { return connected.load(); }
bool MqttManager::isRunning() const { return task != nullptr; }
void MqttManager::runTask(void* context) { static_cast<MqttManager*>(context)->run(); }
void MqttManager::messageCallback(char* topic, uint8_t* payload, unsigned int length) {
    if (callbackOwner) callbackOwner->onMessage(topic, payload, length);
}

void MqttManager::onMessage(const char* topic, const uint8_t* payload, unsigned int length) {
#if defined(AQUASENSE_PUBLIC_MQTT_DEV)
    // Never accept MQTT commands from the anonymous public development broker.
    (void)topic;
    (void)payload;
    (void)length;
    return;
#else
    if (!DeviceConfig::MQTT_ACTUATOR_COMMANDS_ENABLED) return;
    char expectedTopic[96];
    snprintf(expectedTopic, sizeof(expectedTopic), "%s/%s/command", DeviceConfig::MQTT_TOPIC_NAMESPACE, DeviceConfig::DEVICE_ID);
    if (!topic || strcmp(topic, expectedTopic) || !payload || length == 0 || length >= COMMAND_BUFFER_BYTES) return;
    // PubSubClient exposes the retain bit through its packet state only in some versions;
    // its callback does not provide it. Commands therefore also carry a short expiry and ID.
    // The MQTT layer additionally subscribes with no replay-safe persistent-session setup.
    memcpy(mqttCommandBuffer, payload, length); mqttCommandBuffer[length] = '\0';
    mqttJsonDocument.clear();
    if (deserializeJson(mqttJsonDocument, mqttCommandBuffer) || !mqttJsonDocument.is<JsonObject>()) return;
    JsonDocument& doc = mqttJsonDocument;
    const char* id = doc["id"] | ""; const char* deviceId = doc["deviceId"] | "";
    const char* source = doc["source"] | ""; const char* action = doc["action"] | "";
    const char* signature = doc["signature"] | "";
    const uint8_t version = doc["v"] | 0;
    const uint32_t duration = doc["durationMs"] | 0u;
    const uint64_t expiresAt = doc["expiresAt"] | uint64_t(0);
    if (version != 1 || strcmp(deviceId, DeviceConfig::DEVICE_ID) || !validId(id) ||
        (strcmp(source, "hardware") && strcmp(source, "feeding")) || !action[0] || strlen(action) >= 24) return;
    const bool feeding = !strcmp(source, "feeding");
    const CommandAction parsedAction = actionFor(action, feeding);
    if (parsedAction == CommandAction::Invalid) return;
    char canonical[320];
    snprintf(canonical, sizeof(canonical), "v1|%s|%s|%s|%s|%lu|%llu", deviceId, id, source, action,
             static_cast<unsigned long>(duration), static_cast<unsigned long long>(expiresAt));
    if (!signatureMatches(canonical, signature)) return;
    const uint64_t now = epochMillis();
    if (!now || expiresAt <= now || expiresAt - now > uint64_t(DeviceConfig::COMMAND_MAX_TTL_MS)) return;
    MqttActuatorCommand queued{};
    strlcpy(queued.command.id, id, sizeof(queued.command.id));
    queued.command.feedingSource = feeding; queued.command.action = parsedAction;
    queued.command.durationMs = duration; queued.command.receivedAtMs = millis();
    queued.command.ttlMs = uint32_t(expiresAt - now);
    strlcpy(queued.source, source, sizeof(queued.source)); strlcpy(queued.action, action, sizeof(queued.action));
    if (xQueueSend(commands, &queued, 0) != pdTRUE) {
        // Reject explicitly instead of silently losing a valid command. This callback
        // runs from the MQTT worker's client.loop(); only queue work here, and let the
        // worker publish the signed acknowledgement on its next iteration.
        CommandReceipt receipt{};
        strlcpy(receipt.id, id, sizeof(receipt.id));
        receipt.feedingSource = feeding;
        strlcpy(receipt.result, "queue_full", sizeof(receipt.result));
        acknowledge(queued, receipt);
        Serial.printf("MQTT command queue full; rejected command %s.\n", id);
    }
#endif
}

bool MqttManager::publishReadings(const SensorReadings& reading) {
    const auto publishSensor = [&](const char* name, bool sensorConnected, bool valid, float value, uint8_t decimals) {
        char topic[160], statusTopic[176], valueText[24];
        if (DeviceConfig::MQTT_DEVICE_SCOPED_TOPICS) {
            snprintf(topic, sizeof(topic), "%s/%s/telemetry/%s", DeviceConfig::MQTT_TOPIC_NAMESPACE, DeviceConfig::DEVICE_ID, name);
            snprintf(statusTopic, sizeof(statusTopic), "%s/%s/telemetry/%s/status", DeviceConfig::MQTT_TOPIC_NAMESPACE, DeviceConfig::DEVICE_ID, name);
        } else {
            snprintf(topic, sizeof(topic), "%s/%s", DeviceConfig::MQTT_TOPIC_NAMESPACE, name);
            snprintf(statusTopic, sizeof(statusTopic), "%s/%s/status", DeviceConfig::MQTT_TOPIC_NAMESPACE, name);
        }
        if (sensorConnected && valid) snprintf(valueText, sizeof(valueText), decimals == 1 ? "%.1f" : "%.2f", double(value));
        else snprintf(valueText, sizeof(valueText), sensorConnected ? "UNVERIFIED" : "DISCONNECTED");
        // The local Mosquitto listener has retain_available=false; telemetry must be live-only.
        const bool valuePublished = client.publish(topic, valueText, false);
        const bool statusPublished = client.publish(statusTopic, sensorConnected ? "CONNECTED" : "DISCONNECTED", false);
        return valuePublished && statusPublished;
    };
    bool success = publishTelemetryFrame(client, reading);
    if (!DeviceConfig::MQTT_DEVICE_SCOPED_TOPICS) {
        char topic[96];
        snprintf(topic, sizeof(topic), "%s/device-id", DeviceConfig::MQTT_TOPIC_NAMESPACE);
        success = client.publish(topic, DeviceConfig::DEVICE_ID, false);
    }
    success = publishSensor("orp", reading.orpConnected, reading.orpValid, reading.orpMv, 1) && success;
    success = publishSensor("temperature", reading.temperatureConnected, reading.temperatureValid, reading.temperatureC, 2) && success;
    success = publishSensor("ph", reading.phConnected, reading.phValid, reading.ph, 2) && success;
    // Preserve the existing topic contract: the backend interprets
    // `turbidity` as raw ADC and `turbidity-ntu` as calibrated NTU.
    success = publishSensor("turbidity-ntu", reading.turbidityConnected, reading.turbidityValid, reading.turbidityRaw, 1) && success;
    char valueText[24];
    if (reading.turbidityConnected)
        snprintf(valueText, sizeof(valueText), "%.0f", double(reading.turbidityDiagnostics.rawAdc));
    else
        snprintf(valueText, sizeof(valueText), "DISCONNECTED");
    char rawTopic[160], rawStatusTopic[176];
    if (DeviceConfig::MQTT_DEVICE_SCOPED_TOPICS) {
        snprintf(rawTopic, sizeof(rawTopic), "%s/%s/telemetry/turbidity", DeviceConfig::MQTT_TOPIC_NAMESPACE, DeviceConfig::DEVICE_ID);
        snprintf(rawStatusTopic, sizeof(rawStatusTopic), "%s/%s/telemetry/turbidity/status", DeviceConfig::MQTT_TOPIC_NAMESPACE, DeviceConfig::DEVICE_ID);
    } else {
        snprintf(rawTopic, sizeof(rawTopic), "%s/turbidity", DeviceConfig::MQTT_TOPIC_NAMESPACE);
        snprintf(rawStatusTopic, sizeof(rawStatusTopic), "%s/turbidity/status", DeviceConfig::MQTT_TOPIC_NAMESPACE);
    }
    const bool rawValuePublished = client.publish(rawTopic, valueText, false);
    const bool rawStatusPublished = client.publish(rawStatusTopic,
        reading.turbidityConnected ? "CONNECTED" : "DISCONNECTED", false);
    success = rawValuePublished && rawStatusPublished && success;
    return success;
}

bool MqttManager::publishAcknowledgement(const MqttActuatorCommand& command, const CommandReceipt& receipt,
                                         const SystemState& state) {
    const uint64_t reportedAt = epochMillis();
    if (!reportedAt) return false;
    char signature[65];
    const char* source = command.source;
    // The publish occurs only while the MQTT connection is active.
    char fullCanonical[880];
    const bool hasScheduleResult = state.scheduleResultId[0] && strcmp(state.scheduleResult, "none") != 0 && state.scheduleResultMinute >= 0;
    snprintf(fullCanonical, sizeof(fullCanonical),
        hasScheduleResult
            ? "v1|%s|%s|%s|%s|%s|%llu|%d|%d|%d|%d|%d|%d|%s|%s|%d|%d|%d|%d|%lu|%d|%s|%s|%lld"
            : "v1|%s|%s|%s|%s|%s|%llu|%d|%d|%d|%d|%d|%d|%s|%s|%d|%d|%d|%d|%lu|%d",
        DeviceConfig::DEVICE_ID, command.command.id, source, command.action, receipt.result,
        static_cast<unsigned long long>(reportedAt), state.fillPump, state.drainPump, state.aerator,
        state.feederBusy, state.buzzer, state.automation, state.waterPhase, state.fault,
        state.relaysReady, state.rtcTimeValid, state.wifiConnected, 1,
        static_cast<unsigned long>(state.uptimeMs), state.actuatorCommissioningEnabled,
        state.scheduleResultId, state.scheduleResult,
        static_cast<long long>(state.scheduleResultMinute));
    if (!hmacHex(fullCanonical, signature, sizeof(signature))) return false;
    mqttJsonDocument.clear();
    JsonDocument& doc = mqttJsonDocument;
    doc["v"] = 1; doc["deviceId"] = DeviceConfig::DEVICE_ID; doc["id"] = command.command.id;
    doc["source"] = source; doc["action"] = command.action; doc["result"] = receipt.result; doc["reportedAt"] = reportedAt;
    JsonObject reported = doc.createNestedObject("state");
    reported["fillPump"] = state.fillPump; reported["drainPump"] = state.drainPump; reported["aerator"] = state.aerator;
    reported["feederBusy"] = state.feederBusy; reported["buzzer"] = state.buzzer; reported["automation"] = state.automation;
    reported["waterPhase"] = state.waterPhase; reported["fault"] = state.fault; reported["relaysReady"] = state.relaysReady;
    reported["timeValid"] = state.rtcTimeValid; reported["wifiConnected"] = state.wifiConnected;
    reported["mqttConnected"] = true; reported["uptimeMs"] = state.uptimeMs; doc["signature"] = signature;
    reported["actuatorCommissioningEnabled"] = state.actuatorCommissioningEnabled;
    if (hasScheduleResult) {
        JsonObject scheduleResult = reported.createNestedObject("scheduleResult");
        scheduleResult["id"] = state.scheduleResultId;
        scheduleResult["outcome"] = state.scheduleResult;
        scheduleResult["localMinute"] = state.scheduleResultMinute;
    }
    char topic[96];
    snprintf(topic, sizeof(topic), "%s/%s/state", DeviceConfig::MQTT_TOPIC_NAMESPACE, DeviceConfig::DEVICE_ID);
    const size_t size = serializeJson(doc, mqttPayloadBuffer, sizeof(mqttPayloadBuffer));
    return size > 0 && client.publish(topic, reinterpret_cast<const uint8_t*>(mqttPayloadBuffer), size, false);
}

namespace {
void logMqttTaskMemory(const char* stage) {
    if (DeviceConfig::SERIAL_DEBUG_MODE)
        Serial.printf("MQTT debug memory %s: stack_high_water=%u bytes free_heap=%u min_free_heap=%u\n",
            stage, static_cast<unsigned>(uxTaskGetStackHighWaterMark(nullptr)),
            static_cast<unsigned>(ESP.getFreeHeap()), static_cast<unsigned>(ESP.getMinFreeHeap()));
}
}

void MqttManager::run() {
    SensorReadings latest{}; SystemState latestState{};
    bool hasSnapshot = false, attemptedConnection = false, attemptedPublish = false, staleStatusPublished = false;
    bool loggedTimeWait = false;
    bool tcpDiagnosticAttempted = false;
    logMqttTaskMemory("worker-start");
    uint32_t lastReconnectMs = 0, lastPublishMs = 0, publishedSequence = 0;
    for (;;) {
        if (xQueueReceive(snapshots, &latest, 0) == pdTRUE) { hasSnapshot = true; staleStatusPublished = false; }
        xQueueReceive(states, &latestState, 0);
        const uint32_t nowMs = millis();
        if (WiFi.status() != WL_CONNECTED) {
            if (DeviceConfig::MQTT_TLS_ENABLED) tlsTransport.stop(); else transport.stop();
            connected.store(false);
            loggedTimeWait = false;
        }
        else {
            if (!tcpDiagnosticAttempted) {
                tcpDiagnosticAttempted = true;
                WiFiClient tcpProbe;
                const int tcpConnected = tcpProbe.connect(DeviceConfig::MQTT_HOST, DeviceConfig::MQTT_PORT, 2000);
                const String localIp = WiFi.localIP().toString();
                const String gateway = WiFi.gatewayIP().toString();
                const String subnet = WiFi.subnetMask().toString();
                if (DeviceConfig::SERIAL_DEBUG_MODE || !tcpConnected)
                    Serial.printf("MQTT TCP diagnostic: %s (destination=%s:%u, local_ip=%s, gateway=%s, subnet=%s)\n",
                        tcpConnected ? "reachable" : "failed", DeviceConfig::MQTT_HOST,
                        static_cast<unsigned>(DeviceConfig::MQTT_PORT), localIp.c_str(), gateway.c_str(), subnet.c_str());
                tcpProbe.stop();
            }
            const time_t currentEpoch = time(nullptr);
            const bool tlsTimeReady = !DeviceConfig::MQTT_TLS_ENABLED ||
                currentEpoch >= static_cast<time_t>(DeviceConfig::MIN_VALID_EPOCH);
            if (!tlsTimeReady && !loggedTimeWait) {
                Serial.printf("MQTT TLS waiting for valid system time (epoch=%lld).\n", static_cast<long long>(currentEpoch));
                loggedTimeWait = true;
            }
            if (tlsTimeReady) loggedTimeWait = false;
            if (tlsTimeReady && !client.connected() && (!attemptedConnection || uint32_t(nowMs - lastReconnectMs) >= DeviceConfig::MQTT_RECONNECT_INTERVAL_MS)) {
                attemptedConnection = true; connected.store(false);
#if defined(AQUASENSE_PUBLIC_MQTT_DEV)
                const bool ok = client.connect(DeviceConfig::MQTT_CLIENT_ID);
#else
                const bool ok = Secrets::MQTT_USERNAME[0]
                    ? client.connect(DeviceConfig::MQTT_CLIENT_ID, Secrets::MQTT_USERNAME, Secrets::MQTT_PASSWORD)
                    : client.connect(DeviceConfig::MQTT_CLIENT_ID);
#endif
                lastReconnectMs = millis();
                if (ok) {
                    if (DeviceConfig::MQTT_ACTUATOR_COMMANDS_ENABLED) {
                        char topic[128];
                        snprintf(topic, sizeof(topic), "%s/%s/command", DeviceConfig::MQTT_TOPIC_NAMESPACE, DeviceConfig::DEVICE_ID);
                        client.subscribe(topic, 1); // Commands are always published non-retained by the backend.
                    }
                    Serial.printf("MQTT connected (state=%d)\n", client.state());
                } else if (DeviceConfig::MQTT_TLS_ENABLED) {
                    char tlsError[192]{};
                    const int tlsErrorCode = tlsTransport.lastError(tlsError, sizeof(tlsError));
                    const String localIp = WiFi.localIP().toString();
                    const String gateway = WiFi.gatewayIP().toString();
                    Serial.printf("MQTT connect failed (state=%d, tls_error=%d, detail=%s, epoch=%lld, local_ip=%s, gateway=%s, free_heap=%u)\n",
                        client.state(), tlsErrorCode, tlsError[0] ? tlsError : "unavailable",
                        static_cast<long long>(currentEpoch), localIp.c_str(), gateway.c_str(), ESP.getFreeHeap());
                } else {
                    Serial.printf("MQTT connect failed (state=%d)\n", client.state());
                }
            }
            client.loop(); connected.store(client.connected());
            if (xQueueReceive(snapshots, &latest, 0) == pdTRUE) { hasSnapshot = true; staleStatusPublished = false; }
            xQueueReceive(states, &latestState, 0);
            MqttPendingAcknowledgement pending{};
            if (client.connected() && xQueueReceive(acknowledgements, &pending, 0) == pdTRUE)
                publishAcknowledgement(pending.command, pending.receipt, latestState);
            const uint32_t publishMs = millis();
            const bool stale = hasSnapshot && uint32_t(publishMs - latest.sampledAtMs) > DeviceConfig::TELEMETRY_MAX_AGE_MS;
            if (client.connected() && stale && !staleStatusPublished &&
                (!attemptedPublish || uint32_t(publishMs - lastPublishMs) >= DeviceConfig::MQTT_PUBLISH_INTERVAL_MS)) {
                SensorReadings disconnected = latest;
                disconnected.phValid = disconnected.temperatureValid = disconnected.turbidityValid = disconnected.orpValid = false;
                disconnected.phConnected = disconnected.temperatureConnected = disconnected.turbidityConnected = disconnected.orpConnected = false;
                attemptedPublish = true; lastPublishMs = publishMs; staleStatusPublished = publishReadings(disconnected);
            }
            if (client.connected() && hasSnapshot && latest.sequence != publishedSequence && !stale &&
                (!attemptedPublish || uint32_t(publishMs - lastPublishMs) >= DeviceConfig::MQTT_PUBLISH_INTERVAL_MS)) {
                attemptedPublish = true; lastPublishMs = publishMs;
                logMqttTaskMemory("before-telemetry");
                const bool publishOk = publishReadings(latest);
                if (publishOk) publishedSequence = latest.sequence;
                if (DeviceConfig::SERIAL_DEBUG_MODE || !publishOk)
                    Serial.printf("MQTT telemetry frame sequence=%lu publish=%s\n",
                        static_cast<unsigned long>(latest.sequence), publishOk ? "OK" : "FAILED");
                logMqttTaskMemory("after-telemetry");
            }
        }
        vTaskDelay(pdMS_TO_TICKS(DeviceConfig::MQTT_TASK_POLL_MS));
    }
}
