#include <Arduino.h>
#include <Wire.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <WiFi.h>
#include <esp_system.h>
#include "config/DeviceConfig.h"
#include "config/Pins.h"
#include "sensors/SensorManager.h"
#include "communication/WifiManager.h"
#include "communication/MqttManager.h"
#include "communication/BackendDeviceClient.h"
#include "display/LcdManager.h"
#include "services/TimeManager.h"
#include "controllers/SystemController.h"

namespace {
enum class AppState { Boot, WifiConnecting, MqttConnecting, Running };
SensorManager sensors;
WifiManager wifi;
MqttManager mqtt;
BackendDeviceClient backend;
LcdManager lcd;
TimeManager timeManager;
RelayController relays;
WaterManager water(relays);
AeratorManager aerator(relays);
FeedingManager feeder(timeManager);
BuzzerManager buzzer;
SystemController control(relays, water, aerator, feeder, buzzer);
SystemState state;
uint32_t lastLoggedSequence = 0;
uint32_t lastRuntimeDiagnosticMs = 0;
AppState appState = AppState::Boot;
uint32_t connectionSuccessStartedMs = 0;
bool connectionSuccessHoldActive = false;

const char* resetReasonName(esp_reset_reason_t reason) {
    switch (reason) {
        case ESP_RST_POWERON: return "poweron";
        case ESP_RST_EXT: return "external";
        case ESP_RST_SW: return "software";
        case ESP_RST_PANIC: return "panic";
        case ESP_RST_INT_WDT: return "interrupt-watchdog";
        case ESP_RST_TASK_WDT: return "task-watchdog";
        case ESP_RST_WDT: return "watchdog";
        case ESP_RST_DEEPSLEEP: return "deep-sleep";
        case ESP_RST_BROWNOUT: return "brownout";
        case ESP_RST_SDIO: return "sdio";
        default: return "unknown";
    }
}

void logRuntimeDiagnostics(uint32_t nowMs) {
    if (lastRuntimeDiagnosticMs != 0 && uint32_t(nowMs - lastRuntimeDiagnosticMs) < 60000) return;
    lastRuntimeDiagnosticMs = nowMs;
    const bool wifiConnected = wifi.isConnected();
    Serial.printf("[HEALTH] uptimeMs=%lu freeHeap=%u minFreeHeap=%u mainStackHighWaterWords=%u wifiStatus=%d rssi=%d wifiRetries=%lu mqttConnected=%d mqttWorker=%d sensorSequence=%lu\n",
        static_cast<unsigned long>(nowMs), unsigned(ESP.getFreeHeap()), unsigned(ESP.getMinFreeHeap()),
        unsigned(uxTaskGetStackHighWaterMark(nullptr)), int(WiFi.status()), wifiConnected ? WiFi.RSSI() : 0,
        static_cast<unsigned long>(wifi.reconnectAttempts()), mqtt.isConnected(), mqtt.isRunning(),
        static_cast<unsigned long>(sensors.getReadings().sequence));
}

void updateAppState(uint32_t nowMs) {
    const bool wifiConnected = wifi.isConnected();
    const bool mqttConnected = mqtt.isConnected();
    if (appState == AppState::Boot) {
        appState = AppState::WifiConnecting;
        connectionSuccessHoldActive = false;
        Serial.println("Connection state: WiFi connecting");
    }
    if (appState == AppState::WifiConnecting) {
        if (!wifiConnected) { connectionSuccessHoldActive = false; return; }
        if (!connectionSuccessHoldActive) {
            connectionSuccessHoldActive = true;
            connectionSuccessStartedMs = nowMs;
            return;
        }
        if (uint32_t(nowMs - connectionSuccessStartedMs) >= DeviceConfig::LCD_SUCCESS_HOLD_MS) {
            appState = AppState::MqttConnecting;
            connectionSuccessHoldActive = false;
            Serial.println("Connection state: MQTT connecting");
        }
        return;
    }
    if (appState == AppState::MqttConnecting) {
        if (!wifiConnected) {
            appState = AppState::WifiConnecting;
            connectionSuccessHoldActive = false;
            Serial.println("Connection state: WiFi reconnecting");
            return;
        }
        if (!mqttConnected) { connectionSuccessHoldActive = false; return; }
        if (!connectionSuccessHoldActive) {
            connectionSuccessHoldActive = true;
            connectionSuccessStartedMs = nowMs;
            return;
        }
        if (uint32_t(nowMs - connectionSuccessStartedMs) >= DeviceConfig::LCD_SUCCESS_HOLD_MS) {
            appState = AppState::Running;
            connectionSuccessHoldActive = false;
            Serial.println("AquaSense RUNNING.");
        }
        return;
    }
    if (appState == AppState::Running) {
        if (!wifiConnected) {
            appState = AppState::WifiConnecting;
            connectionSuccessHoldActive = false;
            Serial.println("WiFi lost; returning to connection flow.");
        } else if (!mqttConnected) {
            appState = AppState::MqttConnecting;
            connectionSuccessHoldActive = false;
            Serial.println("MQTT lost; returning to connection flow.");
        }
    }
}
}
void setup() {
    Serial.begin(DeviceConfig::SERIAL_BAUD);
    const esp_reset_reason_t resetReason = esp_reset_reason();
    Serial.printf("[BOOT] resetReason=%s code=%u freeHeap=%u minFreeHeap=%u\n",
        resetReasonName(resetReason), unsigned(resetReason), unsigned(ESP.getFreeHeap()), unsigned(ESP.getMinFreeHeap()));
    relays.begin();
    feeder.begin();
    buzzer.begin();
    control.begin();
    Wire.begin(Pins::I2C_SDA, Pins::I2C_SCL);
    Wire.setClock(100000); // Conservative bus speed for a cabled LCD/RTC bus.
    Wire.setTimeOut(DeviceConfig::I2C_TIMEOUT_MS);
    lcd.begin(); timeManager.begin(); sensors.begin();
    Serial.printf("[BOOT] device=%s bootId=%s\n", DeviceConfig::DEVICE_ID, sensors.getReadings().bootId);
    wifi.begin(); mqtt.begin(); backend.begin();
}
void loop() {
    const uint32_t nowMs = millis();
    MqttActuatorCommand mqttCommand{};
    CommandReceipt mqttReceipt{};
    FeedingSchedules schedules;
    if (backend.takeSchedules(schedules)) feeder.setSchedules(schedules);
    wifi.update(nowMs);
    timeManager.update(nowMs, wifi.isConnected());
    updateAppState(nowMs);
    const bool hasMqttCommand = DeviceConfig::MQTT_ACTUATOR_COMMANDS_ENABLED &&
        appState == AppState::Running && mqtt.takeCommand(mqttCommand);
    if (hasMqttCommand) {
        mqttReceipt = control.handle(mqttCommand.command, nowMs);
        Serial.printf("[FEEDER] command id=%s action=%s result=%s\n",
                      mqttCommand.command.id, mqttCommand.action, mqttReceipt.result);
    }
    // Acquisition is local and continuous. Network readiness controls transport,
    // not whether the physical sensors are sampled.
    sensors.update(nowMs);
    const SensorReadings& readings = sensors.getReadings();
    mqtt.update(readings);
    if (!wifi.isConnected() || !mqtt.isConnected()) control.stopRelayActuators(millis());
    control.update(readings, nowMs);
    state.wifiConnected = wifi.isConnected(); state.mqttConnected = mqtt.isConnected();
    state.mqttWorkerRunning = mqtt.isRunning(); state.rtcAvailable = timeManager.isAvailable();
    state.rtcTimeValid = timeManager.isTimeValid(); state.uptimeMs = nowMs;
    control.report(state);
    mqtt.updateState(state);
    if (hasMqttCommand) mqtt.acknowledge(mqttCommand, mqttReceipt);
    backend.update(state); lcd.update(readings, state, nowMs);
    if (readings.sequence != lastLoggedSequence) {
        lastLoggedSequence = readings.sequence; timeManager.printCurrentTime(); sensors.printReadings();
    }
    logRuntimeDiagnostics(nowMs);
    vTaskDelay(DeviceConfig::MAIN_LOOP_IDLE_TICKS);
}
