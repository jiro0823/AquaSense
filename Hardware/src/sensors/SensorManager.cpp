#include "SensorManager.h"
#include <Arduino.h>
#include <math.h>
#include "SensorConversions.h"
#include "config/DeviceConfig.h"
#include "config/Pins.h"

SensorManager::SensorManager() : oneWire(Pins::TEMPERATURE), temperatureSensor(&oneWire) {}

void SensorManager::begin() {
    analogReadResolution(12);
    analogSetAttenuation(ADC_11db);
    temperatureSensor.begin();
    temperatureSensor.setResolution(DeviceConfig::TEMPERATURE_RESOLUTION_BITS);
    temperatureSensor.setWaitForConversion(false);
}

const SensorReadings& SensorManager::getReadings() const { return readings; }

void SensorManager::printReadings() const {
    Serial.println("===== SENSOR DATA =====");
    Serial.printf("Temp: %.2f C [%s]\n", readings.temperatureC, readings.temperatureValid ? "valid" : "invalid");
    Serial.printf("Turbidity: %.2f raw ADC [%s]\n", readings.turbidityRaw, readings.turbidityValid ? "valid" : "invalid");
    Serial.printf("pH: %.2f [%s]\n", readings.ph, readings.phValid ? "valid" : "invalid");
    Serial.printf("ORP: %.2f mV [%s]\n", readings.orpMv, readings.orpValid ? "valid" : "invalid");
}

void SensorManager::startSampling(Phase next, uint32_t nowMs) {
    phase = next;
    adcSum = 0;
    adcSamples = 0;
    lastAdcSampleMs = nowMs;
}

void SensorManager::update(uint32_t nowMs) {
    if (phase == Phase::Idle) {
        if (hasSample && uint32_t(nowMs - lastCompletedMs) < DeviceConfig::SENSOR_READ_INTERVAL_MS) return;
        pending = readings;
        temperatureSensor.requestTemperatures();
        phaseStartedMs = nowMs;
        phase = Phase::Temperature;
        return;
    }
    if (phase == Phase::Temperature) {
        if (uint32_t(nowMs - phaseStartedMs) < DeviceConfig::TEMPERATURE_CONVERSION_MS) return;
        const float raw = temperatureSensor.getTempCByIndex(0);
        const float corrected = raw + CalibrationConfig::TEMPERATURE_OFFSET_C;
        pending.temperatureValid = raw != DEVICE_DISCONNECTED_C &&
            isfinite(corrected) && SensorConversions::temperaturePlausible(corrected);
        if (pending.temperatureValid) {
            pending.temperatureC = SensorConversions::smooth(readings.temperatureC, corrected);
        }
        startSampling(Phase::Turbidity, nowMs);
        return;
    }
    if (uint32_t(nowMs - lastAdcSampleMs) < DeviceConfig::ADC_SAMPLE_INTERVAL_MS) return;
    lastAdcSampleMs = nowMs;
    const int pin = phase == Phase::Turbidity ? Pins::TURBIDITY :
                    phase == Phase::Ph ? Pins::PH : Pins::ORP;
    adcSum += analogRead(pin);
    if (++adcSamples < DeviceConfig::ADC_SAMPLE_COUNT) return;

    // Integer division matches the supplied Arduino sketch's ADC averaging.
    const int raw = adcSum / DeviceConfig::ADC_SAMPLE_COUNT;
    if (phase == Phase::Turbidity) {
        pending.turbidityValid = SensorConversions::adcUsable(raw);
        if (pending.turbidityValid) pending.turbidityRaw = SensorConversions::smooth(readings.turbidityRaw, raw);
        startSampling(Phase::Ph, nowMs);
    } else if (phase == Phase::Ph) {
        const float ph = SensorConversions::phFromAdc(raw);
        pending.phValid = SensorConversions::adcUsable(raw) && isfinite(ph) && SensorConversions::phPlausible(ph);
        if (pending.phValid) pending.ph = ph;
        startSampling(Phase::Orp, nowMs);
    } else {
        const float orp = SensorConversions::orpFromAdc(raw);
        pending.orpValid = SensorConversions::adcUsable(raw) && isfinite(orp);
        if (pending.orpValid) pending.orpMv = SensorConversions::smooth(readings.orpMv, orp);
        finishSample(nowMs);
    }
}

void SensorManager::finishSample(uint32_t nowMs) {
    pending.sampledAtMs = nowMs;
    pending.sequence = readings.sequence + 1;
    readings = pending; // Only expose a complete acquisition to consumers.
    hasSample = true;
    lastCompletedMs = nowMs;
    phase = Phase::Idle;
}
