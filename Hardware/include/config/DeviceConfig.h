#pragma once
#include <stdint.h>

namespace DeviceConfig {
constexpr uint32_t SERIAL_BAUD = 115200;
constexpr uint32_t MAIN_LOOP_IDLE_TICKS = 1; // Let RTOS idle/housekeeping tasks run.
constexpr uint32_t SENSOR_READ_INTERVAL_MS = 5000; // Pause after a complete acquisition.
constexpr uint32_t ADC_SAMPLE_INTERVAL_MS = 10;
constexpr uint8_t ADC_SAMPLE_COUNT = 10;
constexpr uint8_t TEMPERATURE_RESOLUTION_BITS = 12;
constexpr uint32_t TEMPERATURE_CONVERSION_MS = 750;
constexpr uint32_t WIFI_RECONNECT_INTERVAL_MS = 10000;
constexpr uint32_t MQTT_RECONNECT_INTERVAL_MS = 2000;
constexpr uint32_t MQTT_PUBLISH_INTERVAL_MS = 5000;
constexpr uint32_t MQTT_TASK_POLL_MS = 20;
constexpr uint32_t MQTT_TASK_STACK_BYTES = 6144;
constexpr uint16_t MQTT_SOCKET_TIMEOUT_SECONDS = 2;
constexpr uint32_t TELEMETRY_MAX_AGE_MS = 15000;
constexpr uint32_t LCD_REFRESH_INTERVAL_MS = 500;
constexpr uint32_t LCD_WELCOME_DURATION_MS = 3000;
constexpr uint8_t LCD_ADDRESS = 0x27;
constexpr uint8_t LCD_COLUMNS = 16;
constexpr uint8_t LCD_ROWS = 2;
constexpr uint32_t RTC_READ_INTERVAL_MS = 1000;
constexpr uint16_t I2C_TIMEOUT_MS = 20;
constexpr const char* DEVICE_ID = "esp32-feeder-1"; // Must be registered to the backend owner.
constexpr const char* BACKEND_API_BASE_URL = "http://192.168.1.100:5000/api/v1";
constexpr const char* BACKEND_ROOT_CA = ""; // PEM root CA required for HTTPS; never bypass certificate validation.
constexpr uint32_t BACKEND_SYNC_INTERVAL_MS = 5000;
constexpr uint32_t BACKEND_HTTP_TIMEOUT_MS = 2000;
constexpr uint32_t BACKEND_TASK_STACK_BYTES = 8192;
constexpr uint32_t COMMAND_MAX_TTL_MS = 120000;
constexpr uint32_t MIN_VALID_EPOCH = 1704067200; // 2024-01-01, reject unset system time.
constexpr int32_t LOCAL_OFFSET_SECONDS = 8 * 3600;
constexpr const char* NTP_PRIMARY = "pool.ntp.org";
constexpr const char* NTP_SECONDARY = "time.nist.gov";
constexpr const char* TOPIC_READINGS = "water/esp32/readings";

constexpr const char* MQTT_HOST = "broker.hivemq.com";
constexpr uint16_t MQTT_PORT = 1883;
constexpr const char* MQTT_CLIENT_ID = "ESP32_AquaSense";
// Telemetry only; actuator commands use authenticated BackendDeviceClient HTTP(S).
}
