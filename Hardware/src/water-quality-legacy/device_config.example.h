#pragma once

// WIFI
constexpr const char* ssid = "YOUR_WIFI_SSID";
constexpr const char* password = "YOUR_WIFI_PASSWORD";

// MQTT
constexpr const char* mqtt_server = "broker.hivemq.com";

constexpr const char* MQTT_CLIENT_ID = "ESP32_AquaSense";
const int MQTT_PORT = 1883;
constexpr const char* MQTT_TOPIC_TEMPERATURE = "aquasense/temperature";
constexpr const char* MQTT_TOPIC_TURBIDITY = "aquasense/turbidity";
constexpr const char* MQTT_TOPIC_PH = "aquasense/ph";
