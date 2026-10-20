#include <Arduino.h>
#include <Wire.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
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
#if !defined(AQUASENSE_OFFLINE_CALIBRATION_MODE)
enum class AppState { Boot, WifiConnecting, MqttConnecting, Running };
#endif
SensorManager sensors;
#if !defined(AQUASENSE_OFFLINE_CALIBRATION_MODE)
RelayController relays;
BuzzerManager buzzer;
WifiManager wifi;
MqttManager mqtt;
BackendDeviceClient backend;
LcdManager lcd;
TimeManager timeManager;
WaterManager water(relays);
AeratorManager aerator(relays);
FeedingManager feeder(timeManager);
SystemController control(relays, water, aerator, feeder, buzzer);
SystemState state;
AppState appState = AppState::Boot;
uint32_t connectionSuccessStartedMs = 0;
bool connectionSuccessHoldActive = false;
#endif
uint32_t lastLoggedSequence = 0;

#if !defined(AQUASENSE_OFFLINE_CALIBRATION_MODE)
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
#endif
}
void setup() {
    Serial.begin(DeviceConfig::SERIAL_BAUD);
#if defined(AQUASENSE_OFFLINE_CALIBRATION_MODE)
    Serial.println("OFFLINE CALIBRATION MODE: network, commands, schedules, and actuators disabled.");
    Wire.begin(Pins::I2C_SDA, Pins::I2C_SCL);
    Wire.setTimeOut(DeviceConfig::I2C_TIMEOUT_MS);
    sensors.begin();
#else
    relays.begin();
    feeder.begin();
    buzzer.begin();
    control.begin();
    Wire.begin(Pins::I2C_SDA, Pins::I2C_SCL);
    Wire.setTimeOut(DeviceConfig::I2C_TIMEOUT_MS);
    lcd.begin(); timeManager.begin(); sensors.begin();
    wifi.begin(); mqtt.begin(); backend.begin();
#endif
}
void loop() {
#if defined(AQUASENSE_OFFLINE_CALIBRATION_MODE)
    const uint32_t nowMs = millis();
    sensors.update(nowMs);
    const SensorReadings& readings = sensors.getReadings();
    if (readings.sequence != lastLoggedSequence) {
        lastLoggedSequence = readings.sequence;
        sensors.printReadings();
    }
    vTaskDelay(DeviceConfig::MAIN_LOOP_IDLE_TICKS);
#else
    const uint32_t nowMs = millis();
    MqttActuatorCommand mqttCommand{};
    CommandReceipt mqttReceipt{};
    FeedingSchedules schedules;
    if (backend.takeSchedules(schedules)) feeder.setSchedules(schedules);
    wifi.update(nowMs);
    timeManager.update(nowMs, wifi.isConnected());
    updateAppState(nowMs);
    const bool hasMqttCommand = appState == AppState::Running && mqtt.takeCommand(mqttCommand);
    if (hasMqttCommand) mqttReceipt = control.handle(mqttCommand.command, nowMs);
    if (appState == AppState::Running) sensors.update(nowMs);
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
    vTaskDelay(DeviceConfig::MAIN_LOOP_IDLE_TICKS);
#endif
}
