#pragma once
#include <DallasTemperature.h>
#include <OneWire.h>
#include <esp_adc_cal.h>
#include "models/SensorReadings.h"

class SensorManager {
public:
    SensorManager();
    void begin();
    void update(uint32_t nowMs);
    const SensorReadings& getReadings() const;
    void printReadings() const;

private:
    enum class Phase { Idle, Temperature, Turbidity, Ph, PhVoltage, Orp, OrpVoltage };
    void startSampling(Phase phase, uint32_t nowMs);
    void startVoltageSampling(Phase phase);
    void finishSample(uint32_t nowMs);

    OneWire oneWire;
    DallasTemperature temperatureSensor;
    SensorReadings readings;
    SensorReadings pending;
    Phase phase = Phase::Idle;
    bool hasSample = false;
    uint32_t lastSampleStartedMs = 0;
    uint32_t phaseStartedMs = 0;
    int adcSum = 0;
    uint32_t voltageSumMv = 0;
    AnalogDiagnostics burst;
    esp_adc_cal_characteristics_t adcCharacteristics = {};
    bool efuseCharacterized = false;
    uint8_t temperatureConnectCount = 0, temperatureDisconnectCount = 0;
    uint8_t phConnectCount = 0, phDisconnectCount = 0;
    uint8_t turbidityConnectCount = 0, turbidityDisconnectCount = 0;
    uint8_t orpConnectCount = 0, orpDisconnectCount = 0;
};
