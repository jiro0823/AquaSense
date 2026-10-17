#pragma once

#if __has_include("device_config.local.h")
#include "device_config.local.h"
#else
#include "device_config.example.h"
#endif

// ========== Sensor Pin Configuration ==========
constexpr int TEMPERATURE_PIN = 4;        // GPIO4 (DS18B20 OneWire)
constexpr int PH_SENSOR_PIN = 34;        // GPIO34 (ADC1_CH6) - Analog
constexpr int TURBIDITY_SENSOR_PIN = 36; // GPIO36 (ADC1_CH0) - Analog

// Sampling and MQTT retry intervals
const unsigned long SENSOR_READ_INTERVAL = 5000;   // Read every 5 seconds
const unsigned long MQTT_CHECK_INTERVAL = 2000;    // Check connection every 2 seconds
