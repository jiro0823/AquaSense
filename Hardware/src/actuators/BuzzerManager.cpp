#include "BuzzerManager.h"
#include <Arduino.h>
#include "config/Pins.h"
#include "config/ActuatorConfig.h"

void BuzzerManager::begin() {
    ledcSetup(ActuatorConfig::BUZZER_CHANNEL, ActuatorConfig::BUZZER_FREQUENCY_HZ, 8);
    ledcAttachPin(Pins::Diagram::BUZZER, ActuatorConfig::BUZZER_CHANNEL);
    ledcWrite(ActuatorConfig::BUZZER_CHANNEL, 0);
}
void BuzzerManager::update(bool fault, uint32_t nowMs) {
    if (!manual && !fault) { sounding = false; ledcWrite(ActuatorConfig::BUZZER_CHANNEL, 0); changedMs = nowMs; return; }
    const uint32_t interval = sounding ? ActuatorConfig::BUZZER_ON_MS : ActuatorConfig::BUZZER_OFF_MS;
    if (uint32_t(nowMs - changedMs) >= interval) {
        sounding = !sounding; changedMs = nowMs;
        ledcWrite(ActuatorConfig::BUZZER_CHANNEL, sounding ? 128 : 0);
    }
}
