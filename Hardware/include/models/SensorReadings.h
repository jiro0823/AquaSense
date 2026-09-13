#pragma once
#include <stdint.h>

struct SensorReadings {
    float temperatureC = 0.0f;
    float ph = 0.0f;
    float turbidityRaw = 0.0f;
    float orpMv = 0.0f;
    bool temperatureValid = false;
    bool phValid = false;
    bool turbidityValid = false;
    bool orpValid = false;
    uint32_t sampledAtMs = 0; // Monotonic uptime, not a Unix timestamp.
    uint32_t sequence = 0;
};
