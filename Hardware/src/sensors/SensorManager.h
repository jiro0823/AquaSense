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
    enum class Phase { Idle, Temperature, Turbidity, Ph, Orp };
    void startSampling(Phase phase, uint32_t nowMs);
    void finishSample(uint32_t nowMs);

    OneWire oneWire;
    DallasTemperature temperatureSensor;
    SensorReadings readings;
    SensorReadings pending;
    Phase phase = Phase::Idle;
    bool hasSample = false;
    uint32_t lastCompletedMs = 0;
    uint32_t phaseStartedMs = 0;
    uint32_t lastAdcSampleMs = 0;
    int adcSum = 0;
    uint8_t adcSamples = 0;
    uint32_t voltageSumMv = 0;
    AnalogDiagnostics burst;
    esp_adc_cal_characteristics_t adcCharacteristics = {};
    bool efuseCharacterized = false;
    bool temperatureInitialized = false;
    bool turbidityInitialized = false;
    bool orpInitialized = false;
    DeviceAddress temperatureAddress = {};
    bool temperatureAddressValid = false;
};
