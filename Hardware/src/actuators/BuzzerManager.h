#pragma once
#include <stdint.h>
#include "config/DeviceConfig.h"

class BuzzerManager {
public:
    void begin();
    void setManual(bool on) { if (DeviceConfig::ACTUATOR_CONTROL_ENABLED) manualRequested = on; }
    void update(bool criticalSensorReading, uint32_t nowMs);
    bool isActive() const { return sounding; }
private:
    bool manualRequested = false;
    bool sounding = false;
    uint32_t changedMs = 0;
};
