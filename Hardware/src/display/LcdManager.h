#pragma once
#include <stdint.h>
#include <LiquidCrystal_I2C.h>
#include "config/DeviceConfig.h"
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
    uint8_t detectLcdAddress();
    bool initializeLcd();
    void invalidateRowCache();
    LiquidCrystal_I2C* lcd = nullptr;
    char lastRows[DeviceConfig::LCD_ROWS][DeviceConfig::LCD_COLUMNS + 1] = {};
    bool rowCacheValid[DeviceConfig::LCD_ROWS] = {};
    uint8_t lcdAddress = 0;
    uint8_t lcdObjectAddress = 0;
    uint8_t lcdMissCount = 0;
    uint8_t lcdRecoveryAckCount = 0;
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
