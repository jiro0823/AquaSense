#pragma once
#include <LiquidCrystal_I2C.h>
#include "models/SensorReadings.h"
#include "models/SystemState.h"

class LcdManager {
public:
    LcdManager();
    void begin();
    void update(const SensorReadings& readings, const SystemState& state, uint32_t nowMs);
private:
    void writeRow(uint8_t row, const char* text);
    void drawProgress(uint8_t row, uint32_t elapsedMs, uint32_t timeoutMs);
    void showReadings(const SensorReadings& readings, uint32_t nowMs);
    LiquidCrystal_I2C lcd;
    bool available = false;
    bool startupComplete = false;
    bool successScreenActive = false;
    bool wifiSuccessScreenActive = false;
    bool wasWifiConnected = false;
    bool wasMqttConnected = false;
    uint32_t lastRefreshMs = 0;
    uint32_t wifiStageStartedMs = 0;
    uint32_t mqttStageStartedMs = 0;
    uint32_t successStartedMs = 0;
    uint32_t wifiSuccessStartedMs = 0;
};
