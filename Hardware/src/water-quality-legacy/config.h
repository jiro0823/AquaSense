#pragma once

#if __has_include("device_config.local.h")
#include "device_config.local.h"
#else
#include "device_config.example.h"
#endif

// Existing three-sensor wiring (GPIO numbers)
constexpr int PH_PIN = 35;       // GPIO35
constexpr int TURB_PIN = 34;    // GPIO34
constexpr int ONE_WIRE_BUS = 4;   // P4
