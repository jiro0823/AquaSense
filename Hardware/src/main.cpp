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
}
void setup() {
    Serial.begin(DeviceConfig::SERIAL_BAUD);
    relays.begin();
    feeder.begin();
    buzzer.begin();
    control.begin();
    Wire.begin(Pins::I2C_SDA, Pins::I2C_SCL);
    Wire.setTimeOut(DeviceConfig::I2C_TIMEOUT_MS);
    lcd.begin(); timeManager.begin(); sensors.begin();
    wifi.begin(); mqtt.begin(); backend.begin();
}
void loop() {
    const uint32_t nowMs = millis();
    sensors.update(nowMs);
    Command command;
    if (backend.takeCommand(command)) backend.acknowledge(control.handle(command, nowMs));
    FeedingSchedules schedules;
    if (backend.takeSchedules(schedules)) feeder.setSchedules(schedules);
    const SensorReadings& readings = sensors.getReadings();
    control.update(readings, nowMs);
    wifi.update(nowMs);
    timeManager.update(nowMs, wifi.isConnected());
    mqtt.update(readings);
    state.wifiConnected = wifi.isConnected(); state.mqttConnected = mqtt.isConnected();
    state.mqttWorkerRunning = mqtt.isRunning(); state.rtcAvailable = timeManager.isAvailable();
    state.rtcTimeValid = timeManager.isTimeValid(); state.uptimeMs = nowMs;
    control.report(state); backend.update(state); lcd.update(readings, state, nowMs);
    if (readings.sequence != lastLoggedSequence) {
        lastLoggedSequence = readings.sequence; timeManager.printCurrentTime(); sensors.printReadings();
    }
    vTaskDelay(DeviceConfig::MAIN_LOOP_IDLE_TICKS);
}
