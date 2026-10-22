#include "SensorManager.h"
#include <Arduino.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
#include "SensorConversions.h"
#include "config/DeviceConfig.h"
#include "config/Pins.h"

namespace {
constexpr uint32_t TEMPERATURE_DISCOVERY_RETRY_MS = 5000;

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

const char* analogDiagnosticReason(const AnalogDiagnostics& diagnostics, int connectMin,
                                   int connectMax, bool connected) {
    if (DeviceConfig::PUBLIC_MQTT_DEV && SensorConversions::provisionalAcquisitionUsable(
            diagnostics.rawAdc, diagnostics.minimum, diagnostics.maximum,
            diagnostics.clipped, diagnostics.voltage, connectMin, connectMax)) return "provisional_preview_usable";
    if (diagnostics.clipped) return "adc_samples_clipped";
    if (diagnostics.rawAdc < connectMin) return "below_presence_threshold";
    if (diagnostics.rawAdc > connectMax) return "above_presence_threshold";
    if (int(diagnostics.maximum) - int(diagnostics.minimum) > CalibrationConfig::STABILITY_MAX_DEV)
        return "unstable_sample_spread";
    if (!connected) return "connection_not_confirmed";
    if (!CalibrationConfig::ANALOG_CONVERSION_VERIFIED && !DeviceConfig::OFFLINE_CALIBRATION_MODE)
        return "conversion_unverified";
    return "ok";
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
    lastTemperatureDiscoveryMs = millis();
    Serial.printf("DS18B20 discovery at boot: %u device(s) on GPIO%d\n",
        static_cast<unsigned>(temperatureSensor.getDeviceCount()), Pins::TEMPERATURE);
}

const SensorReadings& SensorManager::getReadings() const { return readings; }

void SensorManager::printReadings() {
    if (!DeviceConfig::SERIAL_DEBUG_MODE) return;
    const uint8_t temperatureDevices = temperatureSensor.getDeviceCount();
    if (temperatureDevices == 0) {
        Serial.printf("DS18B20: detected=NO GPIO=%d reason=no_1wire_device_found retry_ms=%lu\n",
            Pins::TEMPERATURE, static_cast<unsigned long>(TEMPERATURE_DISCOVERY_RETRY_MS));
    } else {
        const char* reason = "ok";
        if (!lastTemperatureRawAvailable || lastTemperatureRawC == DEVICE_DISCONNECTED_C)
            reason = "disconnected_read";
        else if (!isfinite(lastTemperatureRawC)) reason = "non_finite_read";
        else if (lastTemperatureRawC <= -55.0f || lastTemperatureRawC >= 125.0f) reason = "outside_sensor_range";
        else if (!readings.temperatureValid) reason = "reading_not_validated";
        Serial.printf("DS18B20: detected=YES count=%u raw_c=%.2f value=",
            static_cast<unsigned>(temperatureDevices), lastTemperatureRawC);
        if (readings.temperatureValid) Serial.printf("%.2f C", readings.temperatureC);
        else Serial.print("UNAVAILABLE");
        Serial.printf(" valid=%s profile_offset=%.2f C reason=%s\n",
            readings.temperatureValid ? "YES" : "NO", CalibrationConfig::TEMPERATURE_OFFSET_C, reason);
    }

    const auto printAnalog = [](const char* name, const AnalogDiagnostics& diagnostics,
                                int pin, int connectMin, int connectMax, bool connected,
                                bool valid, float value, const char* unit) {
        const char* reason = analogDiagnosticReason(diagnostics, connectMin, connectMax, connected);
        const bool convertedValueValid = valid && CalibrationConfig::ANALOG_CONVERSION_VERIFIED;
        const bool acquisitionUsable = SensorConversions::provisionalAcquisitionUsable(
            diagnostics.rawAdc, diagnostics.minimum, diagnostics.maximum,
            diagnostics.clipped, diagnostics.voltage, connectMin, connectMax);
        const bool adcVoltageDisagree = diagnostics.rawAdc <= 8.0f && diagnostics.voltage >= 0.05f;
        Serial.printf("%-9s GPIO%d: connected=%s acquisition_usable=%s converted_valid=%s\n",
            name, pin, connected ? "YES" : "NO", acquisitionUsable ? "YES" : "NO",
            convertedValueValid ? "YES" : "NO");
        Serial.printf("  reason=%s raw_avg=%.1f range=%u..%u clipped=%u pin_voltage=%.0f mV",
            reason, diagnostics.rawAdc, diagnostics.minimum, diagnostics.maximum,
            diagnostics.clipped, diagnostics.voltage * 1000.0f);
        if (adcVoltageDisagree) Serial.print(" ADC_MV_DISAGREE");
        if (convertedValueValid) Serial.printf(" value=%.2f %s", value, unit);
        else if (!CalibrationConfig::ANALOG_CONVERSION_VERIFIED && connected && valid)
            Serial.print(" value=UNVERIFIED");
        else Serial.print(" value=UNAVAILABLE");
        Serial.println();
    };
    printAnalog("pH", readings.phDiagnostics, Pins::PH, CalibrationConfig::PH_CONNECT_MIN,
        CalibrationConfig::PH_CONNECT_MAX, readings.phConnected, readings.phValid, readings.ph, "pH");
    printAnalog("Turbidity", readings.turbidityDiagnostics, Pins::TURBIDITY,
        CalibrationConfig::TURBIDITY_CONNECT_MIN, CalibrationConfig::TURBIDITY_CONNECT_MAX,
        readings.turbidityConnected, readings.turbidityValid, readings.turbidityRaw, "NTU");
    printAnalog("ORP", readings.orpDiagnostics, Pins::ORP, CalibrationConfig::ORP_CONNECT_MIN,
        CalibrationConfig::ORP_CONNECT_MAX, readings.orpConnected, readings.orpValid, readings.orpMv, "mV");
    Serial.printf("Analog conversions: %s; raw and millivolt diagnostics are separate acquisitions.\n",
        CalibrationConfig::ANALOG_CONVERSION_VERIFIED ? "VERIFIED" : "UNVERIFIED");
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

void SensorManager::requestTemperatureConversion() {
    const uint32_t requestStartedMs = millis();
    if (temperatureSensor.getDeviceCount() == 0 &&
        uint32_t(requestStartedMs - lastTemperatureDiscoveryMs) >= TEMPERATURE_DISCOVERY_RETRY_MS) {
        lastTemperatureDiscoveryMs = requestStartedMs;
        temperatureSensor.begin();
        if (temperatureSensor.getDeviceCount() > 0) {
            temperatureSensor.setResolution(DeviceConfig::TEMPERATURE_RESOLUTION_BITS);
            temperatureSensor.setWaitForConversion(false);
            Serial.printf("DS18B20 discovered after startup: %u device(s) on GPIO%d\n",
                static_cast<unsigned>(temperatureSensor.getDeviceCount()), Pins::TEMPERATURE);
        }
    }
    temperatureSensor.requestTemperatures();
    // Start the 12-bit conversion wait from the actual bus request, not from
    // the loop timestamp captured before the analog acquisition burst.
    phaseStartedMs = millis();
    phase = Phase::Temperature;
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
        lastTemperatureRawAvailable = devicePresent;
        lastTemperatureRawC = raw;
        const float corrected = raw + CalibrationConfig::TEMPERATURE_OFFSET_C;
        const bool sampleValid = devicePresent && raw != DEVICE_DISCONNECTED_C &&
            raw > -55.0f && raw < 125.0f && isfinite(corrected);
        pending.temperatureC = NAN;
        pending.temperatureValid = false;
        pending.temperatureConnected = updateConnection(sampleValid, pending.temperatureConnected,
            temperatureConnectCount, temperatureDisconnectCount, "TEMP");
        if (SensorSampleValidity::current(pending.temperatureConnected, sampleValid, isfinite(corrected))) {
            pending.temperatureC = corrected;
            pending.temperatureValid = true;
        }
        pending.temperatureSampledAtMs = nowMs;
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
            if (SensorSampleValidity::analog(DeviceConfig::OFFLINE_CALIBRATION_MODE,
                    CalibrationConfig::ANALOG_CONVERSION_VERIFIED, true,
                    isfinite(ph) && SensorConversions::phPlausible(ph))) {
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
            if (SensorSampleValidity::analog(DeviceConfig::OFFLINE_CALIBRATION_MODE,
                    CalibrationConfig::ANALOG_CONVERSION_VERIFIED, true, isfinite(orp))) {
                pending.orpMv = orp;
                pending.orpValid = true;
            } else {
                pending.orpMv = NAN;
                pending.orpValid = false;
            }
            pending.orpDiagnostics = burst;
            delayMicroseconds(200);
            requestTemperatureConversion();
        }
        return;
    }
    adcSum = 0;
    voltageSumMv = 0;
    for (uint8_t i = 0; i < DeviceConfig::ADC_SAMPLE_COUNT; ++i) {
        const uint16_t count = analogRead(pin);
        adcSum += count;
        voltageSumMv += analogReadMilliVolts(pin);
        burst.minimum = count < burst.minimum ? count : burst.minimum;
        burst.maximum = count > burst.maximum ? count : burst.maximum;
        burst.last = count;
        if (!SensorConversions::adcUsable(count)) ++burst.clipped;
        delayMicroseconds(DeviceConfig::ADC_SAMPLE_INTERVAL_US);
    }

    // Integer division matches the supplied Arduino sketch's ADC averaging.
    const int raw = adcSum / DeviceConfig::ADC_SAMPLE_COUNT;
    burst.rawAdc = float(adcSum) / DeviceConfig::ADC_SAMPLE_COUNT;
    // Keep raw and calibrated voltage diagnostics separate but average both
    // paths over the same number of acquisitions, including below threshold.
    // pH/ORP accepted by their presence threshold use their existing 20-sample
    // calibrated-voltage conversion burst below.
    burst.voltage = float(voltageSumMv) / DeviceConfig::ADC_SAMPLE_COUNT / 1000.0f;
    burst.sampledAtMs = nowMs;
    const int deviation = int(burst.maximum) - int(burst.minimum);
    bool connected = false;
    if (phase == Phase::Turbidity) {
        pending.turbidityDiagnostics = burst;
        connected = burst.clipped == 0 && SensorConversions::adcUsable(uint16_t(raw)) &&
                    raw >= CalibrationConfig::TURBIDITY_CONNECT_MIN && raw <= CalibrationConfig::TURBIDITY_CONNECT_MAX &&
                    deviation <= CalibrationConfig::STABILITY_MAX_DEV;
        pending.turbidityRaw = NAN;
        pending.turbidityValid = false;
        pending.turbidityConnected = updateConnection(connected, pending.turbidityConnected,
            turbidityConnectCount, turbidityDisconnectCount, "TURB");
        const float turbidity = connected ? SensorConversions::turbidityFromAdc(raw) : NAN;
        if (SensorSampleValidity::analog(DeviceConfig::OFFLINE_CALIBRATION_MODE,
                CalibrationConfig::ANALOG_CONVERSION_VERIFIED, connected, isfinite(turbidity))) {
            pending.turbidityRaw = turbidity;
            pending.turbidityValid = true;
        } else {
            pending.turbidityRaw = NAN;
            pending.turbidityValid = false;
        }
        delayMicroseconds(200);
        startSampling(Phase::Orp, nowMs);
    } else if (phase == Phase::Ph) {
        pending.phDiagnostics = burst;
        connected = burst.clipped == 0 && SensorConversions::adcUsable(uint16_t(raw)) &&
                    raw >= CalibrationConfig::PH_CONNECT_MIN && raw <= CalibrationConfig::PH_CONNECT_MAX &&
                    deviation <= CalibrationConfig::STABILITY_MAX_DEV;
        pending.ph = NAN;
        pending.phValid = false;
        pending.phConnected = updateConnection(connected, pending.phConnected,
            phConnectCount, phDisconnectCount, "pH");
        const bool previewUsable = DeviceConfig::PUBLIC_MQTT_DEV &&
            SensorConversions::provisionalAcquisitionUsable(burst.rawAdc, burst.minimum,
                burst.maximum, burst.clipped, burst.voltage,
                CalibrationConfig::PH_CONNECT_MIN, CalibrationConfig::PH_CONNECT_MAX);
        if (connected || previewUsable) {
            startVoltageSampling(Phase::PhVoltage);
        } else {
            startSampling(Phase::Turbidity, nowMs);
        }
    } else {
        pending.orpDiagnostics = burst;
        connected = burst.clipped == 0 && SensorConversions::adcUsable(uint16_t(raw)) &&
                    raw >= CalibrationConfig::ORP_CONNECT_MIN && raw <= CalibrationConfig::ORP_CONNECT_MAX &&
                    deviation <= CalibrationConfig::STABILITY_MAX_DEV;
        pending.orpMv = NAN;
        pending.orpValid = false;
        pending.orpConnected = updateConnection(connected, pending.orpConnected,
            orpConnectCount, orpDisconnectCount, "ORP");
        const bool previewUsable = DeviceConfig::PUBLIC_MQTT_DEV &&
            SensorConversions::provisionalAcquisitionUsable(burst.rawAdc, burst.minimum,
                burst.maximum, burst.clipped, burst.voltage,
                CalibrationConfig::ORP_CONNECT_MIN, CalibrationConfig::ORP_CONNECT_MAX);
        if (connected || previewUsable) {
            startVoltageSampling(Phase::OrpVoltage);
        } else {
            requestTemperatureConversion();
        }
    }
}

void SensorManager::finishSample(uint32_t nowMs) {
    pending.calibrated = CalibrationConfig::ANALOG_CONVERSION_VERIFIED && !DeviceConfig::OFFLINE_CALIBRATION_MODE;
    pending.sampledAtMs = nowMs;
    pending.sequence = readings.sequence + 1;
    readings = pending; // Only expose a complete acquisition to consumers.
    hasSample = true;
    phase = Phase::Idle;
}
