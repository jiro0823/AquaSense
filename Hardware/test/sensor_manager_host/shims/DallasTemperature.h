#pragma once
#include <cstdint>
#include "OneWire.h"

constexpr float DEVICE_DISCONNECTED_C = -127.0f;
class DallasTemperature {
public:
    explicit DallasTemperature(OneWire*) {}
    void begin();
    void setResolution(uint8_t bits);
    void setWaitForConversion(bool wait);
    unsigned int getDeviceCount();
    float getTempCByIndex(unsigned int index);
    void requestTemperatures();
};
