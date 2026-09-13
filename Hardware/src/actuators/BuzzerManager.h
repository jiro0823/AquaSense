#pragma once
#include <stdint.h>

class BuzzerManager {
public:
    void begin();
    void setManual(bool on) { manual = on; }
    void update(bool fault, uint32_t nowMs);
    bool isActive() const { return sounding; }
private:
    bool manual = false, sounding = false;
    uint32_t changedMs = 0;
};
