#include "SensorManager.h"
#include <Arduino.h>
#include <math.h>
#include "SensorConversions.h"
#include "config/DeviceConfig.h"
#include "config/Pins.h"
#include "config/Thresholds.h"

namespace {
bool updateConnection(bool valid, bool& connected, uint8_t& connectCount,
                      uint8_t& disconnectCount, const char* label) {
    if (valid) {
        disconnectCount = 0;
        if (!connected && ++connectCount >= CalibrationConfig::CONNECT_CONFIRM_COUNT) {
            connected = true;
            connectCount = 0;
            Serial.printf("[%s] SENSOR CONNECTED\n", label);
        }
    } else {
        connectCount = 0;
        if (connected && ++disconnectCount >= CalibrationConfig::DISCONNECT_CONFIRM_COUNT) {
            connected = false;
            disconnectCount = 0;
            Serial.printf("[%s] SENSOR DISCONNECTED\n", label);
        }
    }
    return connected;
}
}

SensorManager::SensorManager() : oneWire(Pins::TEMPERATURE), temperatureSensor(&oneWire) {}

void SensorManager::begin() {
    analogReadResolution(12);
    analogSetPinAttenuation(Pins::PH, ADC_11db);
    analogSetPinAttenuation(Pins::TURBIDITY, ADC_11db);
    analogSetPinAttenuation(Pins::ORP, ADC_11db);
    const auto source = esp_adc_cal_characterize(ADC_UNIT_1, ADC_ATTEN_DB_12, ADC_WIDTH_BIT_12, 1100, &adcCharacteristics);
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
    Serial.printf("Turbidity: %.2f NTU [%s]\n", readings.turbidityRaw, readings.turbidityValid ? "valid" : "invalid");
    Serial.printf("pH: %.2f [%s]\n", readings.ph, readings.phValid ? "valid" : "invalid");
    Serial.printf("ORP: %.2f mV [%s]\n", readings.orpMv, readings.orpValid ? "valid" : "invalid");
    Serial.printf("ADC pH raw=%.1f range=%u..%u V=%.3f; turbidity raw=%.1f range=%u..%u; ORP raw=%.1f range=%u..%u\n",
        readings.phDiagnostics.rawAdc, readings.phDiagnostics.minimum, readings.phDiagnostics.maximum,
        readings.phDiagnostics.voltage, readings.turbidityDiagnostics.rawAdc,
        readings.turbidityDiagnostics.minimum, readings.turbidityDiagnostics.maximum,
        readings.orpDiagnostics.rawAdc, readings.orpDiagnostics.minimum, readings.orpDiagnostics.maximum);
}

void SensorManager::startSampling(Phase next, uint32_t nowMs) {
    // The supplied sketch gives the ESP32 ADC mux 2 ms to settle before
    // switching from pH to turbidity and from turbidity to ORP.
    if (next == Phase::Turbidity || next == Phase::Orp) delay(2);
    phase = next;
    adcSum = 0;
    adcSamples = 0;
    voltageSumMv = 0;
    burst = AnalogDiagnostics{};
    burst.efuseCharacterized = efuseCharacterized;
    lastAdcSampleUs = micros();
    (void)nowMs;
}

void SensorManager::startVoltageSampling(Phase next) {
    phase = next;
    voltageSumMv = 0;
    voltageSamples = 0;
    lastAdcSampleUs = micros();
}

void SensorManager::update(uint32_t nowMs) {
    if (phase == Phase::Idle) {
        if (hasSample && uint32_t(nowMs - lastCompletedMs) < DeviceConfig::SENSOR_READ_INTERVAL_MS) return;
        if (!temperatureAddressValid) {
            temperatureAddressValid = temperatureSensor.getDeviceCount() == 1 &&
                temperatureSensor.getAddress(temperatureAddress, 0);
        }
        pending = readings;
        temperatureSensor.requestTemperatures();
        phaseStartedMs = nowMs;
        phase = Phase::Temperature;
        return;
    }
    if (phase == Phase::Temperature) {
        if (uint32_t(nowMs - phaseStartedMs) < DeviceConfig::TEMPERATURE_CONVERSION_MS) return;
        const float raw = temperatureAddressValid ? temperatureSensor.getTempC(temperatureAddress) : DEVICE_DISCONNECTED_C;
        if (raw == DEVICE_DISCONNECTED_C) temperatureAddressValid = false;
        const float corrected = raw + CalibrationConfig::TEMPERATURE_OFFSET_C;
        const bool sampleValid = raw != DEVICE_DISCONNECTED_C && isfinite(corrected) &&
            corrected > Thresholds::TEMPERATURE_MIN_C && corrected < Thresholds::TEMPERATURE_MAX_C;
        pending.temperatureConnected = updateConnection(sampleValid, pending.temperatureConnected,
            temperatureConnectCount, temperatureDisconnectCount, "TEMP");
        if (pending.temperatureConnected && sampleValid) {
            pending.temperatureC = SensorConversions::filter(readings.temperatureC, corrected, temperatureInitialized);
            pending.temperatureValid = true;
        } else if (!pending.temperatureConnected) {
            pending.temperatureValid = false;
        }
        temperatureInitialized = pending.temperatureConnected && pending.temperatureValid;
        pending.temperatureSampledAtMs = nowMs;
        // Match the supplied sketch's analog read order. pH is sampled first
        // because an unplugged pH input can disturb the shared ADC mux.
        startSampling(Phase::Ph, nowMs);
        return;
    }
    const bool samplingVoltage = phase == Phase::PhVoltage || phase == Phase::OrpVoltage;
    const uint32_t nowUs = micros();
    if (uint32_t(nowUs - lastAdcSampleUs) < DeviceConfig::ADC_SAMPLE_INTERVAL_US) return;
    lastAdcSampleUs = nowUs;
    const int pin = phase == Phase::Turbidity ? Pins::TURBIDITY :
                    phase == Phase::Ph || phase == Phase::PhVoltage ? Pins::PH : Pins::ORP;
    if (samplingVoltage) {
        voltageSumMv += analogReadMilliVolts(pin);
        if (++voltageSamples < DeviceConfig::VOLTAGE_SAMPLE_COUNT) return;
        burst.voltage = float(voltageSumMv) / DeviceConfig::VOLTAGE_SAMPLE_COUNT / 1000.0f;
        burst.sampledAtMs = nowMs;
        if (phase == Phase::PhVoltage) {
            const float ph = SensorConversions::phFromVoltage(burst.voltage);
            if (CalibrationConfig::ANALOG_CONVERSION_VERIFIED && isfinite(ph)) {
                pending.ph = constrain(ph, 0.0f, 14.0f);
                pending.phValid = true;
            }
            pending.phDiagnostics = burst;
            startSampling(Phase::Turbidity, nowMs);
        } else {
            const float orp = SensorConversions::orpFromVoltage(burst.voltage);
            if (CalibrationConfig::ANALOG_CONVERSION_VERIFIED && isfinite(orp)) {
                pending.orpMv = orp;
                pending.orpValid = true;
            }
            pending.orpDiagnostics = burst;
            finishSample(nowMs);
        }
        return;
    }
    const uint16_t count = analogRead(pin);
    adcSum += count;
    burst.minimum = count < burst.minimum ? count : burst.minimum;
    burst.maximum = count > burst.maximum ? count : burst.maximum;
    burst.last = count;
    if (!SensorConversions::adcUsable(count)) ++burst.clipped;
    if (++adcSamples < DeviceConfig::ADC_SAMPLE_COUNT) return;

    // Integer division matches the supplied Arduino sketch's ADC averaging.
    const int raw = adcSum / DeviceConfig::ADC_SAMPLE_COUNT;
    burst.rawAdc = float(adcSum) / DeviceConfig::ADC_SAMPLE_COUNT;
    burst.sampledAtMs = nowMs;
    const int deviation = int(burst.maximum) - int(burst.minimum);
    bool connected = false;
    if (phase == Phase::Turbidity) {
        pending.turbidityDiagnostics = burst;
        connected = raw >= CalibrationConfig::TURBIDITY_CONNECT_MIN && raw <= CalibrationConfig::TURBIDITY_CONNECT_MAX &&
                    deviation <= CalibrationConfig::STABILITY_MAX_DEV;
        pending.turbidityConnected = updateConnection(connected, pending.turbidityConnected,
            turbidityConnectCount, turbidityDisconnectCount, "TURB");
        if (pending.turbidityConnected && connected) {
            pending.turbidityRaw = SensorConversions::turbidityFromAdc(raw);
            pending.turbidityValid = isfinite(pending.turbidityRaw);
        } else if (!pending.turbidityConnected) pending.turbidityValid = false;
        startSampling(Phase::Orp, nowMs);
    } else if (phase == Phase::Ph) {
        pending.phDiagnostics = burst;
        connected = raw >= CalibrationConfig::PH_CONNECT_MIN && raw <= CalibrationConfig::PH_CONNECT_MAX &&
                    deviation <= CalibrationConfig::STABILITY_MAX_DEV;
        pending.phConnected = updateConnection(connected, pending.phConnected,
            phConnectCount, phDisconnectCount, "pH");
        if (pending.phConnected && connected && CalibrationConfig::ANALOG_CONVERSION_VERIFIED) {
            startVoltageSampling(Phase::PhVoltage);
        } else {
            if (!pending.phConnected) pending.phValid = false;
            startSampling(Phase::Turbidity, nowMs);
        }
    } else {
        pending.orpDiagnostics = burst;
        connected = raw >= CalibrationConfig::ORP_CONNECT_MIN && raw <= CalibrationConfig::ORP_CONNECT_MAX &&
                    deviation <= CalibrationConfig::STABILITY_MAX_DEV;
        pending.orpConnected = updateConnection(connected, pending.orpConnected,
            orpConnectCount, orpDisconnectCount, "ORP");
        if (pending.orpConnected && connected && CalibrationConfig::ANALOG_CONVERSION_VERIFIED) {
            startVoltageSampling(Phase::OrpVoltage);
        } else {
            if (!pending.orpConnected) pending.orpValid = false;
            finishSample(nowMs);
        }
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
