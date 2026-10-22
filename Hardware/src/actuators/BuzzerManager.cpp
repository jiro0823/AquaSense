#include "BuzzerManager.h"
#include <Arduino.h>
#include "config/Pins.h"
#include "config/ActuatorConfig.h"
#include "config/DeviceConfig.h"

void BuzzerManager::begin() {
    if (!DeviceConfig::ACTUATOR_CONTROL_ENABLED) {
        manualRequested = false;
        sounding = false;
        return;
    }
    pinMode(Pins::BUZZER, OUTPUT);
    digitalWrite(Pins::BUZZER, LOW);
    ledcSetup(ActuatorConfig::BUZZER_CHANNEL, ActuatorConfig::BUZZER_FREQUENCY_HZ, 8);
    ledcAttachPin(Pins::BUZZER, ActuatorConfig::BUZZER_CHANNEL);
    ledcWrite(ActuatorConfig::BUZZER_CHANNEL, 0);
    manualRequested = false;
    sounding = false;
}
void BuzzerManager::update(bool criticalSensorReading, uint32_t nowMs) {
    if (!DeviceConfig::ACTUATOR_CONTROL_ENABLED) return;
    if (manualRequested && uint32_t(nowMs - manualStartedMs) >= ActuatorConfig::BUZZER_MANUAL_TEST_MAX_MS)
        manualRequested = false;
    // Safety alarms take priority; manual requests use the same bounded pattern.
    if (!criticalSensorReading && !manualRequested) {
        sounding = false;
        ledcWrite(ActuatorConfig::BUZZER_CHANNEL, 0);
        changedMs = nowMs;
        return;
    }
    const uint32_t interval = sounding ? ActuatorConfig::BUZZER_ON_MS : ActuatorConfig::BUZZER_OFF_MS;
    if (uint32_t(nowMs - changedMs) >= interval) {
        sounding = !sounding; changedMs = nowMs;
        ledcWrite(ActuatorConfig::BUZZER_CHANNEL, sounding ? 128 : 0);
    }
}
