#pragma once
#include <stdint.h>

class BuzzerManager {
public:
    void begin();
    void setManual(bool on) { manualRequested = on; }
    void update(bool criticalSensorReading, uint32_t nowMs);
    bool isActive() const { return sounding; }
private:
    bool manualRequested = false;
    bool sounding = false;
    uint32_t changedMs = 0;
};
