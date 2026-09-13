#include "MqttManager.h"
#include <stdio.h>
#include <ArduinoJson.h>
#include "config/DeviceConfig.h"
#if __has_include("secrets/Secrets.h")
#include "secrets/Secrets.h"
#else
#include "secrets/Secrets.example.h"
#endif

MqttManager::MqttManager() : client(transport) {}

bool MqttManager::begin() {
    if (task != nullptr) return true;
    client.setServer(DeviceConfig::MQTT_HOST, DeviceConfig::MQTT_PORT);
    client.setSocketTimeout(DeviceConfig::MQTT_SOCKET_TIMEOUT_SECONDS);
    if (!client.setBufferSize(768)) return false;
    snapshots = xQueueCreateStatic(1, sizeof(SensorReadings), queueBytes, &queueStorage);
    if (snapshots == nullptr) return false;
    // PubSubClient/TCP/DNS can block. Keep them off the sensor/display loop.
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
    xQueueOverwrite(snapshots, &readings); // Copy: never share mutable sensor storage.
    lastQueuedSequence = readings.sequence;
}

bool MqttManager::isConnected() const { return connected.load(); }
bool MqttManager::isRunning() const { return task != nullptr; }
void MqttManager::runTask(void* context) { static_cast<MqttManager*>(context)->run(); }

bool MqttManager::publishReadings(const SensorReadings& reading) {
    // One acquisition + device identity prevents cross-cycle ORP association.
    // Older standalone firmware keeps its numeric-topic protocol.
    if (!reading.temperatureValid || !reading.phValid || !reading.turbidityValid) return true;
    StaticJsonDocument<512> payload;
    payload["deviceId"] = DeviceConfig::DEVICE_ID;
    payload["temperature"] = reading.temperatureC; payload["ph"] = reading.ph;
    payload["turbidity"] = reading.turbidityRaw;
    if (reading.orpValid) payload["orp"] = reading.orpMv; else payload["orp"] = nullptr;
    payload["turbidityUnit"] = "raw_adc";
    payload["uptimeMs"] = reading.sampledAtMs; payload["sequence"] = reading.sequence;
    char body[512]; const size_t size = serializeJson(payload, body, sizeof(body));
    return size < sizeof(body) && client.publish(DeviceConfig::TOPIC_READINGS, body, false);
}

void MqttManager::run() {
    SensorReadings latest;
    bool hasSnapshot = false;
    bool attemptedConnection = false;
    bool attemptedPublish = false;
    uint32_t lastReconnectMs = 0;
    uint32_t lastPublishMs = 0;
    uint32_t publishedSequence = 0;

    for (;;) { // Dedicated worker; always yields, even when WiFi/MQTT are unavailable.
        if (xQueueReceive(snapshots, &latest, 0) == pdTRUE) hasSnapshot = true;
        const uint32_t nowMs = millis();
        if (WiFi.status() != WL_CONNECTED) {
            transport.stop();
            connected.store(false);
        } else {
            if (!client.connected() && (!attemptedConnection ||
                uint32_t(nowMs - lastReconnectMs) >= DeviceConfig::MQTT_RECONNECT_INTERVAL_MS)) {
                attemptedConnection = true;
                connected.store(false);
                const bool ok = Secrets::MQTT_USERNAME[0] == '\0'
                    ? client.connect(DeviceConfig::MQTT_CLIENT_ID)
                    : client.connect(DeviceConfig::MQTT_CLIENT_ID, Secrets::MQTT_USERNAME, Secrets::MQTT_PASSWORD);
                lastReconnectMs = millis(); // Retry interval starts after the attempt finishes.
                Serial.printf("MQTT %s (state=%d)\n", ok ? "connected" : "connect failed", client.state());
            }
            client.loop();
            connected.store(client.connected());
            // Refresh after any slow connection attempt and reject stale telemetry.
            if (xQueueReceive(snapshots, &latest, 0) == pdTRUE) hasSnapshot = true;
            const uint32_t publishMs = millis();
            if (client.connected() && hasSnapshot && latest.sequence != publishedSequence &&
                uint32_t(publishMs - latest.sampledAtMs) <= DeviceConfig::TELEMETRY_MAX_AGE_MS &&
                (!attemptedPublish || uint32_t(publishMs - lastPublishMs) >= DeviceConfig::MQTT_PUBLISH_INTERVAL_MS)) {
                attemptedPublish = true;
                lastPublishMs = publishMs;
                if (publishReadings(latest)) publishedSequence = latest.sequence;
            }
        }
        vTaskDelay(pdMS_TO_TICKS(DeviceConfig::MQTT_TASK_POLL_MS));
    }
}
