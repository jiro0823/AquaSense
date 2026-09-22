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
    const auto source = esp_adc_cal_characterize(ADC_UNIT_1, ADC_ATTEN_DB_11, ADC_WIDTH_BIT_12, 1100, &adcCharacteristics);
    efuseCharacterized = source != ESP_ADC_CAL_VAL_DEFAULT_VREF;
    snprintf(readings.bootId, sizeof(readings.bootId), "%08lx%08lx", (unsigned long)esp_random(), (unsigned long)esp_random());
    temperatureSensor.begin();
    // Refuse ambiguous bus enumeration instead of silently switching probes.
    temperatureAddressValid = temperatureSensor.getDeviceCount() == 1 && temperatureSensor.getAddress(temperatureAddress, 0);
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
    voltageSumMv = 0;
    burst = AnalogDiagnostics{};
    burst.efuseCharacterized = efuseCharacterized;
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
        const float raw = temperatureAddressValid ? temperatureSensor.getTempC(temperatureAddress) : DEVICE_DISCONNECTED_C;
        const float corrected = raw + CalibrationConfig::TEMPERATURE_OFFSET_C;
        pending.temperatureValid = raw != DEVICE_DISCONNECTED_C &&
            isfinite(corrected) && SensorConversions::temperaturePlausible(corrected);
        if (pending.temperatureValid) {
            pending.temperatureC = SensorConversions::filter(readings.temperatureC, corrected, temperatureInitialized);
        }
        temperatureInitialized = pending.temperatureValid;
        pending.temperatureSampledAtMs = nowMs;
        startSampling(Phase::Turbidity, nowMs);
        return;
    }
    if (uint32_t(nowMs - lastAdcSampleMs) < DeviceConfig::ADC_SAMPLE_INTERVAL_MS) return;
    lastAdcSampleMs = nowMs;
    const int pin = phase == Phase::Turbidity ? Pins::TURBIDITY :
                    phase == Phase::Ph ? Pins::PH : Pins::ORP;
    const uint16_t count = analogRead(pin);
    adcSum += count;
    voltageSumMv += esp_adc_cal_raw_to_voltage(count, &adcCharacteristics);
    burst.minimum = count < burst.minimum ? count : burst.minimum;
    burst.maximum = count > burst.maximum ? count : burst.maximum;
    burst.last = count;
    if (!SensorConversions::adcUsable(count)) ++burst.clipped;
    if (++adcSamples < DeviceConfig::ADC_SAMPLE_COUNT) return;

    // Integer division matches the supplied Arduino sketch's ADC averaging.
    const int raw = adcSum / DeviceConfig::ADC_SAMPLE_COUNT;
    burst.rawAdc = float(adcSum) / DeviceConfig::ADC_SAMPLE_COUNT;
    burst.voltage = float(voltageSumMv) / DeviceConfig::ADC_SAMPLE_COUNT / 1000.0f;
    burst.sampledAtMs = nowMs;
    const bool usable = burst.clipped == 0 && SensorConversions::adcUsable(raw);
    if (phase == Phase::Turbidity) {
        pending.turbidityDiagnostics = burst;
        pending.turbidityValid = usable;
        if (pending.turbidityValid) pending.turbidityRaw = SensorConversions::filter(readings.turbidityRaw, burst.rawAdc, turbidityInitialized);
        turbidityInitialized = pending.turbidityValid;
        startSampling(Phase::Ph, nowMs);
    } else if (phase == Phase::Ph) {
        const float ph = SensorConversions::phFromAdc(raw);
        pending.phDiagnostics = burst;
        pending.phValid = CalibrationConfig::ANALOG_CONVERSION_VERIFIED && usable && isfinite(ph) && SensorConversions::phPlausible(ph);
        if (pending.phValid) pending.ph = ph;
        startSampling(Phase::Orp, nowMs);
    } else {
        const float orp = SensorConversions::orpFromAdc(raw);
        pending.orpDiagnostics = burst;
        pending.orpValid = CalibrationConfig::ANALOG_CONVERSION_VERIFIED && usable && isfinite(orp);
        if (pending.orpValid) pending.orpMv = SensorConversions::filter(readings.orpMv, orp, orpInitialized);
        orpInitialized = pending.orpValid;
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
