#include <Arduino.h>
#include <Wire.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include "config/DeviceConfig.h"
#include "config/ActuatorConfig.h"
#include "config/CalibrationConfig.h"
#include "config/Pins.h"
#include "sensors/SensorManager.h"
#include "sensors/SensorConversions.h"
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
bool reachedRunningState = false;
uint32_t connectionSuccessStartedMs = 0;
bool connectionSuccessHoldActive = false;
#endif
uint32_t lastLoggedSequence = 0;
uint32_t lastStatusSummaryMs = 0;
bool hasPrintedStatusSummary = false;

void printRuntimeSummary(const SensorReadings& readings, bool wifiConnected, bool mqttConnected) {
    const bool phValid = readings.phValid && CalibrationConfig::ANALOG_CONVERSION_VERIFIED;
    const bool turbidityValid = readings.turbidityValid && CalibrationConfig::ANALOG_CONVERSION_VERIFIED;
    const bool orpValid = readings.orpValid && CalibrationConfig::ANALOG_CONVERSION_VERIFIED;
    const char* ph = !readings.phConnected ? "DISCONNECTED" :
        !CalibrationConfig::ANALOG_CONVERSION_VERIFIED ? "UNVERIFIED" : "UNAVAILABLE";
    const char* temperature = readings.temperatureConnected ? "UNAVAILABLE" : "DISCONNECTED";
    const char* turbidity = !readings.turbidityConnected ? "DISCONNECTED" :
        !CalibrationConfig::ANALOG_CONVERSION_VERIFIED ? "UNVERIFIED" : "UNAVAILABLE";
    const char* orp = !readings.orpConnected ? "DISCONNECTED" :
        !CalibrationConfig::ANALOG_CONVERSION_VERIFIED ? "UNVERIFIED" : "UNAVAILABLE";
    const uint8_t validSensors = uint8_t(phValid) + uint8_t(readings.temperatureValid) +
        uint8_t(turbidityValid) + uint8_t(orpValid);
    const auto previewUsable = [](const AnalogDiagnostics& diagnostics, int connectMin, int connectMax) {
        return DeviceConfig::PUBLIC_MQTT_DEV && SensorConversions::provisionalAcquisitionUsable(
            diagnostics.rawAdc, diagnostics.minimum, diagnostics.maximum,
            diagnostics.clipped, diagnostics.voltage, connectMin, connectMax);
    };

    Serial.println("\n========== AquaSense ==========");
    Serial.printf("Network     WiFi %-12s MQTT %s\n", wifiConnected ? "CONNECTED" : "DISCONNECTED",
        mqttConnected ? "CONNECTED" : "DISCONNECTED");
    if (DeviceConfig::PUBLIC_MQTT_DEV && previewUsable(readings.phDiagnostics,
            CalibrationConfig::PH_CONNECT_MIN, CalibrationConfig::PH_CONNECT_MAX)) {
        const float estimate = SensorConversions::provisionalPhFromVoltage(readings.phDiagnostics.voltage);
        if (isfinite(estimate)) Serial.printf("pH          %7.2f [UNVERIFIED]\n", estimate);
        else Serial.println("pH          UNAVAILABLE");
    } else if (phValid) Serial.printf("pH          %7.2f\n", readings.ph);
    else if (DeviceConfig::PUBLIC_MQTT_DEV) Serial.println("pH          UNAVAILABLE");
    else Serial.printf("pH          %s\n", ph);
    if (readings.temperatureValid) Serial.printf("Temperature %7.2f C\n", readings.temperatureC);
    else Serial.printf("Temperature %s\n", temperature);
    if (DeviceConfig::PUBLIC_MQTT_DEV && previewUsable(readings.turbidityDiagnostics,
            CalibrationConfig::TURBIDITY_CONNECT_MIN, CalibrationConfig::TURBIDITY_CONNECT_MAX)) {
        const float estimate = SensorConversions::provisionalTurbidityFromAdc(readings.turbidityDiagnostics.rawAdc);
        if (isfinite(estimate)) Serial.printf("Turbidity   %7.1f NTU [UNVERIFIED]\n", estimate);
        else Serial.println("Turbidity   UNAVAILABLE");
    } else if (turbidityValid) Serial.printf("Turbidity   %7.1f NTU\n", readings.turbidityRaw);
    else if (DeviceConfig::PUBLIC_MQTT_DEV) Serial.println("Turbidity   UNAVAILABLE");
    else Serial.printf("Turbidity   %s\n", turbidity);
    if (DeviceConfig::PUBLIC_MQTT_DEV && previewUsable(readings.orpDiagnostics,
            CalibrationConfig::ORP_CONNECT_MIN, CalibrationConfig::ORP_CONNECT_MAX)) {
        const float estimate = SensorConversions::orpFromVoltage(readings.orpDiagnostics.voltage);
        if (isfinite(estimate)) Serial.printf("ORP         %7.1f mV [UNVERIFIED]\n", estimate);
        else Serial.println("ORP         UNAVAILABLE");
    } else if (orpValid) Serial.printf("ORP         %7.1f mV\n", readings.orpMv);
    else if (DeviceConfig::PUBLIC_MQTT_DEV) Serial.println("ORP         UNAVAILABLE");
    else Serial.printf("ORP         %s\n", orp);
    Serial.printf("Analog calibration: %s\n",
        CalibrationConfig::ANALOG_CONVERSION_VERIFIED ? "VERIFIED" : "UNVERIFIED (* = provisional)");
    Serial.printf("Actuators: commissioning=%s relay=%s aerator=%s feeder=%s\n",
        ActuatorConfig::ACTUATOR_COMMISSIONING_ENABLED ? "ON" : "OFF",
        ActuatorConfig::RELAY_OUTPUTS_ENABLED ? "ON" : "OFF",
        ActuatorConfig::AERATOR_OUTPUTS_ENABLED ? "ON" : "OFF",
        ActuatorConfig::FEEDER_ENABLED ? "ON" : "OFF");
    Serial.printf("Sensors     %u/4 valid\n", static_cast<unsigned>(validSensors));

    if (DeviceConfig::SERIAL_DEBUG_MODE) {
        Serial.printf("Debug       device=%s boot=%s sequence=%lu uptime=%lu ms\n",
            DeviceConfig::DEVICE_ID, readings.bootId, static_cast<unsigned long>(readings.sequence),
            static_cast<unsigned long>(millis()));
        Serial.printf("Runtime     stack_hwm=%u B free_heap=%u B relays=%s aerator=%s feeder=%s\n",
            static_cast<unsigned>(uxTaskGetStackHighWaterMark(nullptr)),
            static_cast<unsigned>(ESP.getFreeHeap()),
            ActuatorConfig::RELAY_OUTPUTS_ENABLED ? "enabled" : "disabled",
            ActuatorConfig::AERATOR_OUTPUTS_ENABLED ? "enabled" : "disabled",
            ActuatorConfig::FEEDER_ENABLED ? "enabled" : "disabled");
    }
}

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
            reachedRunningState = true;
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
        if (!hasPrintedStatusSummary || uint32_t(nowMs - lastStatusSummaryMs) >= DeviceConfig::MQTT_PUBLISH_INTERVAL_MS) {
            hasPrintedStatusSummary = true;
            lastStatusSummaryMs = nowMs;
            printRuntimeSummary(readings, false, false);
            sensors.printReadings();
        }
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
    // Continue acquiring readings during reconnects after first startup so the
    // LCD can show fresh local sensor status while MQTT is unavailable.
    if (appState == AppState::Running || reachedRunningState) sensors.update(nowMs);
    const SensorReadings& readings = sensors.getReadings();
    mqtt.update(readings);
    if (appState == AppState::Running) control.update(readings, nowMs);
    else {
        control.stopRelayActuators(nowMs);
        control.updateFeederSafety(nowMs);
    }
    state.wifiConnected = wifi.isConnected(); state.mqttConnected = mqtt.isConnected();
    state.mqttWorkerRunning = mqtt.isRunning(); state.rtcAvailable = timeManager.isAvailable();
    state.rtcTimeValid = timeManager.isTimeValid(); state.uptimeMs = nowMs;
    control.report(state);
    mqtt.updateState(state);
    if (hasMqttCommand) mqtt.acknowledge(mqttCommand, mqttReceipt);
    backend.update(state); lcd.update(readings, state, nowMs);
    if (readings.sequence != lastLoggedSequence) {
        lastLoggedSequence = readings.sequence;
        if (!hasPrintedStatusSummary || uint32_t(nowMs - lastStatusSummaryMs) >= DeviceConfig::MQTT_PUBLISH_INTERVAL_MS) {
            hasPrintedStatusSummary = true;
            lastStatusSummaryMs = nowMs;
            timeManager.printCurrentTime();
            printRuntimeSummary(readings, wifi.isConnected(), mqtt.isConnected());
            sensors.printReadings();
        }
    }
    vTaskDelay(DeviceConfig::MAIN_LOOP_IDLE_TICKS);
#endif
}
