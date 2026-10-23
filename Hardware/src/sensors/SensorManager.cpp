#include "SensorManager.h"
#include <Arduino.h>
#include <math.h>
#include "SensorConversions.h"
#include "config/DeviceConfig.h"
#include "config/Pins.h"

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
    temperatureSensor.setResolution(DeviceConfig::TEMPERATURE_RESOLUTION_BITS);
    temperatureSensor.setWaitForConversion(false);
}

const SensorReadings& SensorManager::getReadings() const { return readings; }

void SensorManager::printReadings() const {
    const int phDeviation = int(readings.phDiagnostics.maximum) - int(readings.phDiagnostics.minimum);
    Serial.printf("[pH] RAW=%.0f DEV=%d", double(readings.phDiagnostics.rawAdc), phDeviation);
    if (!readings.phConnected) Serial.println(" -> DISCONNECTED");
    else if (!readings.phValid) Serial.println(" -> INVALID");
    else Serial.printf(" V=%.3f pH=%.2f\n", double(readings.phDiagnostics.voltage), double(readings.ph));

    const int turbidityDeviation = int(readings.turbidityDiagnostics.maximum) - int(readings.turbidityDiagnostics.minimum);
    Serial.printf("[TURB] RAW=%.0f DEV=%d MIN=%u MAX=%u",
        double(readings.turbidityDiagnostics.rawAdc), turbidityDeviation,
        unsigned(readings.turbidityDiagnostics.minimum), unsigned(readings.turbidityDiagnostics.maximum));
    if (!readings.turbidityConnected) Serial.println(" -> DISCONNECTED / OUT OF RANGE");
    else if (!readings.turbidityValid && readings.turbidityDiagnostics.minimum <= 8)
        Serial.println(" -> ADC AT MIN; CHECK SENSOR OUTPUT/GND");
    else if (!readings.turbidityValid && readings.turbidityDiagnostics.maximum >= 4087)
        Serial.println(" -> ADC AT MAX; CHECK INPUT VOLTAGE");
    else if (!readings.turbidityValid) Serial.println(" -> INVALID");
    else if (readings.turbidityDiagnostics.rawAdc < CalibrationConfig::TURBIDITY_DIRTY_ADC)
        Serial.printf(" NTU-EST=%.1f (SATURATED; below provisional ADC span; calibration required)\n", double(readings.turbidityRaw));
    else if (readings.turbidityDiagnostics.rawAdc > CalibrationConfig::TURBIDITY_CLEAR_ADC)
        Serial.printf(" NTU-EST=%.1f (SATURATED; above provisional ADC span; calibration required)\n", double(readings.turbidityRaw));
    else Serial.printf(" NTU-EST=%.1f%s Vpin=%.3f V\n", double(readings.turbidityRaw),
        CalibrationConfig::TURBIDITY_CALIBRATION_VERIFIED ? "" : " (uncalibrated estimate)",
        double(readings.turbidityDiagnostics.voltage));

    const int orpDeviation = int(readings.orpDiagnostics.maximum) - int(readings.orpDiagnostics.minimum);
    Serial.printf("[ORP] RAW=%.0f DEV=%d", double(readings.orpDiagnostics.rawAdc), orpDeviation);
    if (!readings.orpConnected) Serial.println(" -> DISCONNECTED");
    else if (!readings.orpValid) Serial.println(" -> INVALID");
    else Serial.printf(" V=%.3f ORP=%.1f mV\n", double(readings.orpDiagnostics.voltage), double(readings.orpMv));

    if (readings.temperatureConnected && readings.temperatureValid)
        Serial.printf("[TEMP] %.2f C\n", double(readings.temperatureC));
    else Serial.println("[TEMP] DISCONNECTED");
}

void SensorManager::startSampling(Phase next, uint32_t nowMs) {
    // The supplied sketch gives the ESP32 ADC mux 2 ms to settle before
    // switching from pH to turbidity and from turbidity to ORP.
    if (next == Phase::Turbidity || next == Phase::Orp) delay(2);
    phase = next;
    adcSum = 0;
    voltageSumMv = 0;
    burst = AnalogDiagnostics{};
    burst.efuseCharacterized = efuseCharacterized;
    (void)nowMs;
}

void SensorManager::startVoltageSampling(Phase next) {
    phase = next;
    voltageSumMv = 0;
}

void SensorManager::update(uint32_t nowMs) {
    if (phase == Phase::Idle) {
        if (hasSample && uint32_t(nowMs - lastSampleStartedMs) < DeviceConfig::SENSOR_READ_INTERVAL_MS) return;
        lastSampleStartedMs = nowMs;
        pending = readings;
        // Keep the reference acquisition order on the shared ADC: pH,
        // turbidity, ORP, then temperature. Temperature conversion is
        // requested after analog sampling to avoid a long blocking wait.
        startSampling(Phase::Ph, nowMs);
        return;
    }
    if (phase == Phase::Temperature) {
        if (uint32_t(nowMs - phaseStartedMs) < DeviceConfig::TEMPERATURE_CONVERSION_MS) return;
        const bool devicePresent = temperatureSensor.getDeviceCount() > 0;
        const float raw = devicePresent ? temperatureSensor.getTempCByIndex(0) : DEVICE_DISCONNECTED_C;
        const float corrected = raw + CalibrationConfig::TEMPERATURE_OFFSET_C;
        const bool sampleValid = devicePresent && raw != DEVICE_DISCONNECTED_C && isfinite(corrected) &&
            corrected > -55.0f && corrected < 125.0f;
        pending.temperatureConnected = updateConnection(sampleValid, pending.temperatureConnected,
            temperatureConnectCount, temperatureDisconnectCount, "TEMP");
        if (pending.temperatureConnected && sampleValid && isfinite(corrected)) {
            pending.temperatureC = corrected;
            pending.temperatureValid = true;
            pending.temperatureSampledAtMs = nowMs;
        } else if (!pending.temperatureConnected) {
            pending.temperatureC = NAN;
            pending.temperatureValid = false;
            pending.temperatureSampledAtMs = nowMs;
        }
        finishSample(nowMs);
        return;
    }
    const bool samplingVoltage = phase == Phase::PhVoltage || phase == Phase::OrpVoltage;
    const int pin = phase == Phase::Turbidity ? Pins::TURBIDITY :
                    phase == Phase::Ph || phase == Phase::PhVoltage ? Pins::PH : Pins::ORP;
    if (samplingVoltage) {
        voltageSumMv = 0;
        for (uint8_t i = 0; i < DeviceConfig::VOLTAGE_SAMPLE_COUNT; ++i) {
            voltageSumMv += analogReadMilliVolts(pin);
            delayMicroseconds(DeviceConfig::ADC_SAMPLE_INTERVAL_US);
        }
        burst.voltage = float(voltageSumMv) / DeviceConfig::VOLTAGE_SAMPLE_COUNT / 1000.0f;
        burst.sampledAtMs = nowMs;
        if (phase == Phase::PhVoltage) {
            const float ph = SensorConversions::phFromVoltage(burst.voltage);
            if (SensorSampleValidity::current(pending.phConnected, true, isfinite(ph))) {
                pending.ph = constrain(ph, 0.0f, 14.0f);
                pending.phValid = true;
            } else {
                pending.ph = NAN;
                pending.phValid = false;
            }
            pending.phDiagnostics = burst;
            delayMicroseconds(200);
            startSampling(Phase::Turbidity, nowMs);
        } else {
            const float orp = SensorConversions::orpFromVoltage(burst.voltage);
            if (SensorSampleValidity::current(pending.orpConnected, true, isfinite(orp))) {
                pending.orpMv = orp;
                pending.orpValid = true;
            } else {
                pending.orpMv = NAN;
                pending.orpValid = false;
            }
            pending.orpDiagnostics = burst;
            delayMicroseconds(200);
            temperatureSensor.requestTemperatures();
            phaseStartedMs = nowMs;
            phase = Phase::Temperature;
        }
        return;
    }
    adcSum = 0;
    for (uint8_t i = 0; i < DeviceConfig::ADC_SAMPLE_COUNT; ++i) {
        const uint16_t count = analogRead(pin);
        adcSum += count;
        burst.minimum = count < burst.minimum ? count : burst.minimum;
        burst.maximum = count > burst.maximum ? count : burst.maximum;
        burst.last = count;
        if (!SensorConversions::adcUsable(count)) ++burst.clipped;
        delayMicroseconds(DeviceConfig::ADC_SAMPLE_INTERVAL_US);
    }

    // Integer division matches the supplied Arduino sketch's ADC averaging.
    const int raw = adcSum / DeviceConfig::ADC_SAMPLE_COUNT;
    burst.rawAdc = float(adcSum) / DeviceConfig::ADC_SAMPLE_COUNT;
    burst.sampledAtMs = nowMs;
    bool connected = false;
    if (phase == Phase::Turbidity) {
        pending.turbidityDiagnostics = burst;
        const int deviation = int(burst.maximum) - int(burst.minimum);
        connected = SensorConversions::adcLooksConnected(raw, deviation, CalibrationConfig::TURBIDITY_CONNECT_MIN,
            CalibrationConfig::TURBIDITY_CONNECT_MAX);
        pending.turbidityRaw = NAN;
        pending.turbidityValid = false;
        pending.turbidityConnected = updateConnection(connected, pending.turbidityConnected,
            turbidityConnectCount, turbidityDisconnectCount, "TURB");
        // Preserve the supplied sketch's provisional linear ADC-to-NTU
        // mapping. Voltage is diagnostic only; it is not interchangeable with NTU.
        voltageSumMv = 0;
        for (uint8_t i = 0; i < DeviceConfig::VOLTAGE_SAMPLE_COUNT; ++i) {
            voltageSumMv += analogReadMilliVolts(Pins::TURBIDITY);
            delayMicroseconds(DeviceConfig::ADC_SAMPLE_INTERVAL_US);
        }
        pending.turbidityDiagnostics.voltage =
            float(voltageSumMv) / DeviceConfig::VOLTAGE_SAMPLE_COUNT / 1000.0f;
        const float turbidity = pending.turbidityConnected && CalibrationConfig::TURBIDITY_ESTIMATE_ENABLED
            ? SensorConversions::turbidityFromAdc(raw) : NAN;
        if (SensorSampleValidity::current(pending.turbidityConnected,
                                          CalibrationConfig::TURBIDITY_ESTIMATE_ENABLED,
                                          isfinite(turbidity))) {
            pending.turbidityRaw = turbidity;
            pending.turbidityValid = true;
        }
        delayMicroseconds(200);
        startSampling(Phase::Orp, nowMs);
    } else if (phase == Phase::Ph) {
        pending.phDiagnostics = burst;
        const int deviation = int(burst.maximum) - int(burst.minimum);
        connected = SensorConversions::adcLooksConnected(raw, deviation, CalibrationConfig::PH_CONNECT_MIN,
            CalibrationConfig::PH_CONNECT_MAX);
        pending.ph = NAN;
        pending.phValid = false;
        pending.phConnected = updateConnection(connected, pending.phConnected,
            phConnectCount, phDisconnectCount, "pH");
        if (pending.phConnected) {
            startVoltageSampling(Phase::PhVoltage);
        } else {
            startSampling(Phase::Turbidity, nowMs);
        }
    } else {
        pending.orpDiagnostics = burst;
        const int deviation = int(burst.maximum) - int(burst.minimum);
        connected = SensorConversions::adcLooksConnected(raw, deviation, CalibrationConfig::ORP_CONNECT_MIN,
            CalibrationConfig::ORP_CONNECT_MAX);
        pending.orpMv = NAN;
        pending.orpValid = false;
        pending.orpConnected = updateConnection(connected, pending.orpConnected,
            orpConnectCount, orpDisconnectCount, "ORP");
        if (pending.orpConnected) {
            startVoltageSampling(Phase::OrpVoltage);
        } else {
            temperatureSensor.requestTemperatures();
            phaseStartedMs = nowMs;
            phase = Phase::Temperature;
        }
    }
}

void SensorManager::finishSample(uint32_t nowMs) {
    pending.sampledAtMs = nowMs;
    pending.sequence = readings.sequence + 1;
    readings = pending; // Only expose a complete acquisition to consumers.
    hasSample = true;
    phase = Phase::Idle;
}
