#pragma once

#if __has_include("device_config.local.h")
#include "device_config.local.h"
#else
#include "device_config.example.h"
#endif

// ========== Sensor Pin Configuration ==========
constexpr int TEMPERATURE_PIN = 4;        // GPIO4 (DS18B20 OneWire)
constexpr int PH_SENSOR_PIN = 34;        // GPIO34 (ADC1_CH6) - Analog
constexpr int DO_SENSOR_PIN = 35;        // GPIO35 (ADC1_CH7) - Analog
constexpr int TURBIDITY_SENSOR_PIN = 36; // GPIO36 (ADC1_CH0) - Analog

// ========== Sensor Calibration Values ==========
const float PH_OFFSET = 0.0;           // Calibrate based on your sensor
const float PH_SCALE = 1.0;            // Calibrate based on your sensor
const float DO_OFFSET = 0.0;           // Calibrate based on your sensor
const float DO_SCALE = 1.0;            // Calibrate based on your sensor
const float TURBIDITY_OFFSET = 0.0;    // Calibrate based on your sensor
const float TURBIDITY_SCALE = 1.0;     // Calibrate based on your sensor

// ========== ADC Calibration ==========
const int ADC_MAX = 4095;              // ESP32 12-bit ADC
const float VOLTAGE_REF = 3.3;         // ESP32 reference voltage

// Sampling and MQTT retry intervals
const unsigned long SENSOR_READ_INTERVAL = 5000;   // Read every 5 seconds
const unsigned long MQTT_CHECK_INTERVAL = 2000;    // Check connection every 2 seconds
