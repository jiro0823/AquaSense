#include "MqttManager.h"
#include <stdio.h>
#include <ArduinoJson.h>
#include "config/DeviceConfig.h"
#include "config/CalibrationConfig.h"
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
    if (!client.setBufferSize(3072)) return false;
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
    // Fault frames are observations too. Never suppress the healthy channels.
    DynamicJsonDocument payload(3072);
    const uint32_t nowMs = millis();
    payload["schemaVersion"] = 2;
    payload["deviceId"] = DeviceConfig::DEVICE_ID;
    payload["bootId"] = reading.bootId;
    payload["firmwareVersion"] = "water-monitor-precal-1";
    payload["calibrationProfileId"] = CalibrationConfig::PROFILE_ID;
    payload["sampleAgeMs"] = uint32_t(nowMs - reading.sampledAtMs);
    if (reading.temperatureValid) payload["temperature"] = reading.temperatureC; else payload["temperature"] = nullptr;
    if (reading.phValid) payload["ph"] = reading.ph; else payload["ph"] = nullptr;
    if (reading.turbidityValid) payload["turbidity"] = reading.turbidityRaw; else payload["turbidity"] = nullptr;
    if (reading.orpValid) payload["orp"] = reading.orpMv; else payload["orp"] = nullptr;
    payload["doMeasured"] = false;
    payload["do"] = nullptr;
    payload["turbidityUnit"] = "raw_adc";
    payload["uptimeMs"] = reading.sampledAtMs; payload["sequence"] = reading.sequence;
    JsonObject sensors = payload.createNestedObject("sensors");
    JsonObject temperature = sensors.createNestedObject("temperature");
    temperature["sampleAgeMs"] = uint32_t(nowMs - reading.temperatureSampledAtMs);
    temperature["health"] = reading.temperatureValid ? "VALID" : "SENSOR_ERROR";
    const auto addAnalog = [&](const char* name, const AnalogDiagnostics& diagnostic) {
        JsonObject sensor = sensors.createNestedObject(name);
        sensor["rawAdc"] = diagnostic.rawAdc;
        sensor["voltage"] = diagnostic.voltage;
        sensor["voltageSource"] = diagnostic.efuseCharacterized ? "EFUSE" : "NOMINAL_FALLBACK";
        sensor["voltageNode"] = "ESP32_ADC_PIN";
        sensor["conversion"] = "UNVERIFIED";
        sensor["calibration"] = "REQUIRED";
        sensor["adcMinimum"] = diagnostic.minimum;
        sensor["adcMaximum"] = diagnostic.maximum;
        sensor["adcLast"] = diagnostic.last;
        sensor["clippedSamples"] = diagnostic.clipped;
        sensor["sampleAgeMs"] = uint32_t(nowMs - diagnostic.sampledAtMs);
        sensor["health"] = diagnostic.clipped ? "SATURATED" : "VALID";
    };
    addAnalog("ph", reading.phDiagnostics);
    addAnalog("turbidity", reading.turbidityDiagnostics);
    addAnalog("orp", reading.orpDiagnostics);
    char body[2560];
    if (payload.overflowed() || measureJson(payload) >= sizeof(body)) return false;
    serializeJson(payload, body, sizeof(body));
    return client.publish(DeviceConfig::TOPIC_READINGS, body, false);
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
