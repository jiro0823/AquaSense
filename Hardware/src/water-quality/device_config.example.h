#pragma once

// ========== WiFi Configuration ==========
constexpr const char* WIFI_SSID = "YOUR_WIFI_SSID";          // Change this
constexpr const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";  // Change this

// ========== MQTT Configuration ==========
constexpr const char* MQTT_BROKER = "broker.hivemq.com";            // Change to your PC IP (e.g., 192.168.1.100)
const int MQTT_PORT = 1883;
constexpr const char* MQTT_USERNAME = "";                    // Leave empty if no auth
constexpr const char* MQTT_PASSWORD = "";                    // Leave empty if no auth
constexpr const char* MQTT_TOPIC_READINGS = "capstone2026/water/esp32/readings";
constexpr const char* MQTT_TOPIC_STATUS = "capstone2026/water/esp32/status";
constexpr const char* MQTT_CLIENT_ID = "ESP32-WaterQuality-Sensor";
