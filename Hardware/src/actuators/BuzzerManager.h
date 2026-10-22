#pragma once
#include <stdint.h>
#include "config/DeviceConfig.h"
#include "config/ActuatorConfig.h"

class BuzzerManager {
public:
    void begin();
    void setManual(bool on, uint32_t nowMs) {
        if (!DeviceConfig::ACTUATOR_CONTROL_ENABLED) return;
        manualRequested = on;
        manualStartedMs = nowMs;
    }
    void update(bool criticalSensorReading, uint32_t nowMs);
    bool isActive() const { return sounding; }
private:
    bool manualRequested = false;
    bool sounding = false;
    uint32_t changedMs = 0;
    uint32_t manualStartedMs = 0;
};
