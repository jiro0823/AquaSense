#include <cassert>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <limits>
#include <unordered_map>
#include "Arduino.h"
#include "DallasTemperature.h"
#include "config/DeviceConfig.h"
#include "config/CalibrationConfig.h"
#include "config/Pins.h"
#include "sensors/SensorHealth.h"
#include "sensors/SensorManager.h"

HostSerial Serial;

namespace {
struct FakeHardware {
    std::unordered_map<int, int> adc;
    std::unordered_map<int, uint32_t> millivolts;
    float temperature = 25.0f;
    unsigned int temperatureDevices = 1;
    uint32_t randomValue = 1;
} fake;

void setAnalog(int pin, int adc, uint32_t millivolts) {
    fake.adc[pin] = adc;
    fake.millivolts[pin] = millivolts;
}

void setHealthyInputs() {
    // Chosen only to exercise firmware conversion paths; these are not calibration references.
    setAnalog(Pins::PH, 3000, 2300);
    setAnalog(Pins::TURBIDITY, 2000, 1600);
    setAnalog(Pins::ORP, 2000, 1500);
    fake.temperature = 25.0f;
    fake.temperatureDevices = 1;
}

SensorReadings acquire(SensorManager& manager, uint32_t startMs) {
    manager.update(startMs);       // Idle -> pH ADC
    manager.update(startMs + 1);   // pH ADC -> pH voltage
    manager.update(startMs + 2);   // pH voltage -> turbidity ADC
    manager.update(startMs + 3);   // turbidity ADC -> ORP ADC
    manager.update(startMs + 4);   // ORP ADC -> ORP voltage
    manager.update(startMs + 5);   // ORP voltage -> temperature conversion request
    manager.update(startMs + 755); // Complete asynchronous temperature conversion
    return manager.getReadings();
}

void require(bool condition, const char* message) {
    if (!condition) {
        std::fprintf(stderr, "FAIL: %s\n", message);
        std::abort();
    }
}

void testValidSamplesAndFreshness() {
    setHealthyInputs();
    SensorManager manager;
    manager.begin();
    const auto r = acquire(manager, 1000);
    require(r.sequence == 1, "first complete acquisition is published atomically");
    require(!CalibrationConfig::ANALOG_CONVERSION_VERIFIED, "analog conversion stays unverified by default");
    const bool analogValuesValid = DeviceConfig::OFFLINE_CALIBRATION_MODE || CalibrationConfig::ANALOG_CONVERSION_VERIFIED;
    require(r.phValid == analogValuesValid && std::isfinite(r.ph) == analogValuesValid,
            "pH estimate validity follows analog verification and offline calibration policy");
    require(r.turbidityValid == analogValuesValid && std::isfinite(r.turbidityRaw) == analogValuesValid,
            "turbidity estimate validity follows analog verification and offline calibration policy");
    require(r.orpValid == analogValuesValid && std::isfinite(r.orpMv) == analogValuesValid,
            "ORP estimate validity follows analog verification and offline calibration policy");
    require(!r.calibrated, "unverified analog readings are marked uncalibrated");
    require(r.phDiagnostics.rawAdc == 3000.0f && r.phDiagnostics.voltage == 2.3f,
            "pH raw ADC and pin voltage remain available for calibration");
    require(r.turbidityDiagnostics.rawAdc == 2000.0f && r.orpDiagnostics.rawAdc == 2000.0f &&
            r.orpDiagnostics.voltage == 1.5f,
            "turbidity and ORP raw acquisition diagnostics remain available");
    require(r.temperatureValid && std::isfinite(r.temperatureC), "valid temperature sample");
    require(r.phConnected && r.turbidityConnected && r.orpConnected && r.temperatureConnected,
            "valid acquisitions report connected sensors");

    const uint32_t sampleTimes[] = {
        r.phDiagnostics.sampledAtMs,
        r.turbidityDiagnostics.sampledAtMs,
        r.orpDiagnostics.sampledAtMs,
        r.temperatureSampledAtMs
    };
    for (uint32_t sampledAt : sampleTimes) {
        SensorHealth::Diagnostic d;
        d.health = SensorHealth::State::VALID;
        d.valid = d.ready = true;
        d.sampledAtMs = sampledAt;
        require(SensorHealth::fresh(d, sampledAt + DeviceConfig::TELEMETRY_MAX_AGE_MS).valid,
                "each sensor diagnostic is accepted at the maximum age boundary");
        require(!SensorHealth::fresh(d, sampledAt + DeviceConfig::TELEMETRY_MAX_AGE_MS + 1).valid,
                "each sensor diagnostic freshness consumer rejects stale data");
    }
}

void testImmediateInvalidityAndRecovery() {
    setHealthyInputs();
    SensorManager manager;
    manager.begin();
    auto r = acquire(manager, 1000);
    const bool analogValuesValid = DeviceConfig::OFFLINE_CALIBRATION_MODE || CalibrationConfig::ANALOG_CONVERSION_VERIFIED;
    require(r.phValid == analogValuesValid && r.turbidityValid == analogValuesValid &&
            r.orpValid == analogValuesValid && r.temperatureValid,
            "analog validity follows profile policy while temperature retains normal validity");

    setAnalog(Pins::PH, 10, 2300); // ADC rail / unusable acquisition.
    fake.temperature = 126.0f;     // Outside the firmware's accepted temperature range.
    r = acquire(manager, 2000);
    require(!r.phValid && std::isnan(r.ph), "invalid pH acquisition is not valid telemetry");
    require(!r.temperatureValid && std::isnan(r.temperatureC), "out-of-range temperature is invalid");
    require(r.turbidityValid == analogValuesValid && r.orpValid == analogValuesValid,
            "unaffected analog acquisitions follow profile validity policy");
    require(r.phConnected && r.temperatureConnected,
            "connection indicator remains during configured disconnect debounce");

    setAnalog(Pins::PH, 3000, 0); // Connected ADC acquisition converts to implausible pH.
    fake.temperature = 25.0f;
    r = acquire(manager, 3000);
    require(!r.phValid && std::isnan(r.ph), "implausible converted pH is invalid");
    require(r.phConnected, "connected ADC input can remain connected while converted pH is invalid");

    setHealthyInputs();
    r = acquire(manager, 4000);
    require(r.phValid == analogValuesValid && r.temperatureValid, "pH policy and temperature acquisitions recover");
}

void testDisconnectedSensorsRecover() {
    setHealthyInputs();
    SensorManager manager;
    manager.begin();
    auto r = acquire(manager, 1000);
    require(r.phConnected && r.turbidityConnected && r.orpConnected && r.temperatureConnected,
            "all sensors connected before disconnection test");

    setAnalog(Pins::PH, 10, 2300);
    setAnalog(Pins::TURBIDITY, 10, 2300);
    setAnalog(Pins::ORP, 10, 2300);
    fake.temperatureDevices = 0;
    for (uint32_t i = 0; i < 4; ++i) r = acquire(manager, 2000 + i * 1000);
    require(!r.phValid && !r.turbidityValid && !r.orpValid && !r.temperatureValid,
            "disconnected sensors cannot supply valid current samples");
    require(!r.phConnected && !r.turbidityConnected && !r.orpConnected && !r.temperatureConnected,
            "connection state disconnects after configured confirmation samples");

    setHealthyInputs();
    r = acquire(manager, 7000);
    require(r.phValid == analogValuesValid && r.turbidityValid == analogValuesValid &&
            r.orpValid == analogValuesValid && r.temperatureValid,
            "all finite acquisitions recover under the profile validity policy");
    require(r.phConnected && r.turbidityConnected && r.orpConnected && r.temperatureConnected,
            "connection state recovers");
}

void testStaleSnapshotConsumerGate() {
    setHealthyInputs();
    SensorManager manager;
    manager.begin();
    const auto r = acquire(manager, 1000);
    const bool analogValuesValid = DeviceConfig::OFFLINE_CALIBRATION_MODE || CalibrationConfig::ANALOG_CONVERSION_VERIFIED;
    require(r.sequence == 1 && r.temperatureValid && r.phValid == analogValuesValid &&
            r.turbidityValid == analogValuesValid && r.orpValid == analogValuesValid && !r.calibrated,
            "snapshot analog validity follows profile policy while calibration remains unverified");
    const auto usableAt = [r](uint32_t now) {
        return uint32_t(now - r.sampledAtMs) <= DeviceConfig::TELEMETRY_MAX_AGE_MS &&
               r.phValid && r.temperatureValid && r.turbidityValid && r.orpValid;
    };
    require(usableAt(r.sampledAtMs + DeviceConfig::TELEMETRY_MAX_AGE_MS) == analogValuesValid,
            "snapshot analog availability at the age boundary follows profile policy");
    require(!usableAt(r.sampledAtMs + DeviceConfig::TELEMETRY_MAX_AGE_MS + 1),
            "snapshot is rejected by same age comparison used by water control");
}
} // namespace

void analogReadResolution(int) {}
void analogSetPinAttenuation(int, int) {}
int analogRead(int pin) { return fake.adc.at(pin); }
uint32_t analogReadMilliVolts(int pin) { return fake.millivolts.at(pin); }
void delay(uint32_t) {}
void delayMicroseconds(uint32_t) {}
uint32_t esp_random() { return fake.randomValue++; }
int esp_adc_cal_characterize(int, int, int, uint32_t, esp_adc_cal_characteristics_t*) {
    return ESP_ADC_CAL_VAL_DEFAULT_VREF + 1;
}
void DallasTemperature::begin() {}
void DallasTemperature::setResolution(uint8_t) {}
void DallasTemperature::setWaitForConversion(bool) {}
unsigned int DallasTemperature::getDeviceCount() { return fake.temperatureDevices; }
float DallasTemperature::getTempCByIndex(unsigned int) { return fake.temperature; }
void DallasTemperature::requestTemperatures() {}

int main() {
    testValidSamplesAndFreshness();
    testImmediateInvalidityAndRecovery();
    testDisconnectedSensorsRecover();
    testStaleSnapshotConsumerGate();
    std::puts("PASS: SensorManager host fake-hardware runtime checks");
}
