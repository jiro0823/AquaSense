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
    LiquidCrystal_I2C lcd;
    bool available = false;
    bool showingWelcome = false;
    uint32_t welcomeStartedMs = 0;
    uint32_t lastRefreshMs = 0;
};
