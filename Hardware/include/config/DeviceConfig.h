#pragma once
#include <stdint.h>

// Optional per-install settings are local and git-ignored. Keep safe defaults
// below so a fresh checkout still builds but cannot silently reach a placeholder.
#if __has_include("config/device_config.local.h")
#include "config/device_config.local.h"
#endif

#ifndef AQUASENSE_DEVICE_ID
#define AQUASENSE_DEVICE_ID "esp32-feeder-1"
#endif
#ifndef AQUASENSE_BACKEND_API_BASE_URL
#define AQUASENSE_BACKEND_API_BASE_URL "https://backend.example.invalid/api/v1"
#endif
#ifndef AQUASENSE_BACKEND_ROOT_CA
#define AQUASENSE_BACKEND_ROOT_CA ""
#endif
#ifndef AQUASENSE_MQTT_HOST
#define AQUASENSE_MQTT_HOST "broker.hivemq.com"
#endif
#ifndef AQUASENSE_MQTT_PORT
#define AQUASENSE_MQTT_PORT 1883
#endif
#ifndef AQUASENSE_MQTT_TLS
#define AQUASENSE_MQTT_TLS 0
#endif
#ifndef AQUASENSE_MQTT_ROOT_CA
#define AQUASENSE_MQTT_ROOT_CA ""
#endif
#ifndef AQUASENSE_MQTT_DEVICE_SCOPED_TOPICS
#define AQUASENSE_MQTT_DEVICE_SCOPED_TOPICS 0
#endif
#ifndef AQUASENSE_LCD_ANALOG_DIAGNOSTIC_MODE
#define AQUASENSE_LCD_ANALOG_DIAGNOSTIC_MODE 0
#endif

namespace DeviceConfig {
#if defined(AQUASENSE_OFFLINE_CALIBRATION_MODE) && defined(AQUASENSE_PRODUCTION_BUILD)
#error "Offline calibration mode cannot be enabled for a production build."
#endif
#if defined(AQUASENSE_OFFLINE_CALIBRATION_MODE)
constexpr bool OFFLINE_CALIBRATION_MODE = true;
#else
constexpr bool OFFLINE_CALIBRATION_MODE = false;
#endif
constexpr bool NETWORK_SERVICES_ENABLED = !OFFLINE_CALIBRATION_MODE;
constexpr bool ACTUATOR_CONTROL_ENABLED = !OFFLINE_CALIBRATION_MODE;
constexpr bool COMMAND_CONTROL_ENABLED = !OFFLINE_CALIBRATION_MODE;
constexpr bool SCHEDULE_PERSISTENCE_ENABLED = !OFFLINE_CALIBRATION_MODE;
constexpr uint32_t SERIAL_BAUD = 115200;
constexpr uint32_t MAIN_LOOP_IDLE_TICKS = 1; // Let RTOS idle/housekeeping tasks run.
constexpr uint32_t SENSOR_READ_INTERVAL_MS = 1000;
constexpr uint32_t ADC_SAMPLE_INTERVAL_US = 500;
constexpr uint8_t ADC_SAMPLE_COUNT = 12;
constexpr uint8_t VOLTAGE_SAMPLE_COUNT = 20;
constexpr uint8_t TEMPERATURE_RESOLUTION_BITS = 12;
constexpr uint32_t TEMPERATURE_CONVERSION_MS = 750;
constexpr uint32_t WIFI_RECONNECT_INTERVAL_MS = 3000;
constexpr uint32_t WIFI_CONNECT_TIMEOUT_MS = 20000;
constexpr uint32_t WIFI_CHECK_INTERVAL_MS = 5000;
constexpr uint32_t MQTT_RECONNECT_INTERVAL_MS = 3000;
constexpr uint32_t MQTT_CONNECT_TIMEOUT_MS = 20000;
constexpr uint32_t MQTT_PUBLISH_INTERVAL_MS = 5000;
constexpr uint32_t MQTT_TASK_POLL_MS = 20;
constexpr uint32_t MQTT_TASK_STACK_BYTES = 6144;
constexpr uint16_t MQTT_SOCKET_TIMEOUT_SECONDS = 2;
constexpr uint32_t TELEMETRY_MAX_AGE_MS = 15000;
constexpr uint32_t LCD_REFRESH_INTERVAL_MS = 500;
constexpr uint32_t LCD_SUCCESS_HOLD_MS = 1000;
constexpr uint8_t LCD_ADDRESS = 0x27;
constexpr uint8_t LCD_COLUMNS = 20;
constexpr uint8_t LCD_ROWS = 4;
constexpr uint32_t RTC_READ_INTERVAL_MS = 1000;
constexpr uint16_t I2C_TIMEOUT_MS = 50;
constexpr const char* DEVICE_ID = AQUASENSE_DEVICE_ID; // Must be unique and registered to the backend owner.
constexpr const char* BACKEND_API_BASE_URL = AQUASENSE_BACKEND_API_BASE_URL;
constexpr const char* BACKEND_ROOT_CA = AQUASENSE_BACKEND_ROOT_CA; // PEM root CA required for HTTPS; never bypass certificate validation.
#if defined(AQUASENSE_PRODUCTION_BUILD) && defined(AQUASENSE_ALLOW_INSECURE_HTTP)
#error "Insecure backend HTTP cannot be enabled in a production build."
#endif
#if defined(AQUASENSE_DEVELOPMENT_BUILD) && defined(AQUASENSE_ALLOW_INSECURE_HTTP) && !defined(NDEBUG) && !defined(AQUASENSE_PRODUCTION_BUILD)
constexpr bool ALLOW_INSECURE_BACKEND_HTTP = true;
#else
constexpr bool ALLOW_INSECURE_BACKEND_HTTP = false;
#endif
constexpr bool hasPrefix(const char* value, const char* prefix) {
    return *prefix == '\0' || (*value != '\0' && *value == *prefix && hasPrefix(value + 1, prefix + 1));
}
constexpr bool contains(const char* value, const char* text) {
    return *text == '\0' || (*value != '\0' && (hasPrefix(value, text) || contains(value + 1, text)));
}
constexpr bool backendUrlIsPlaceholder(const char* url) {
    return contains(url, ".invalid") || contains(url, "example.") || contains(url, "replace-with") ||
        contains(url, "localhost") || contains(url, "127.0.0.1") || contains(url, "0.0.0.0");
}
constexpr bool deviceIdIsConfigured(const char* deviceId) {
    return deviceId[0] != '\0' && !contains(deviceId, "replace-with") && !contains(deviceId, "YOUR_");
}
constexpr bool validMqttIdChars(const char* value) {
    return *value == '\0' || (((*value >= 'a' && *value <= 'z') || (*value >= 'A' && *value <= 'Z') ||
        (*value >= '0' && *value <= '9') || *value == '-' || *value == '_') && validMqttIdChars(value + 1));
}
constexpr uint8_t mqttIdLength(const char* value) { return *value == '\0' ? 0 : uint8_t(1 + mqttIdLength(value + 1)); }
constexpr bool validMqttDeviceId(const char* value) {
    return mqttIdLength(value) > 0 && mqttIdLength(value) <= 64 && validMqttIdChars(value);
}
constexpr bool mqttCredentialsPaired(const char* username, const char* password) {
    return (username[0] == '\0') == (password[0] == '\0');
}
constexpr bool mqttHostConfigured(const char* host) {
    return host[0] != '\0' && !contains(host, "replace-with") && !contains(host, ".invalid") &&
        !contains(host, "example.") && !contains(host, "localhost") && !contains(host, "127.0.0.1") &&
        !contains(host, "0.0.0.0");
}
constexpr bool mqttTlsConfigured(bool tls, const char* rootCa, const char* username, const char* password) {
    return !tls || (rootCa[0] != '\0' && username[0] != '\0' && password[0] != '\0');
}
constexpr bool validAuthorityChars(const char* value) {
    return *value == '\0' || *value == '/' || *value == '?' || *value == '#' ||
        (*value != ' ' && *value != '\t' && *value != '@' && validAuthorityChars(value + 1));
}
constexpr bool hasAuthority(const char* value) {
    return *value != '\0' && *value != '/' && *value != '?' && *value != '#' && validAuthorityChars(value);
}
constexpr bool backendTransportConfigured(const char* url, const char* rootCa, bool allowInsecureHttp) {
    return !backendUrlIsPlaceholder(url) &&
        ((hasPrefix(url, "https://") && hasAuthority(url + 8) && rootCa[0] != '\0') ||
        (allowInsecureHttp && hasPrefix(url, "http://") && hasAuthority(url + 7)));
}
constexpr uint32_t BACKEND_SYNC_INTERVAL_MS = 5000;
constexpr uint32_t BACKEND_HTTP_TIMEOUT_MS = 2000;
constexpr uint32_t BACKEND_TASK_STACK_BYTES = 8192;
constexpr uint32_t COMMAND_MAX_TTL_MS = 120000;
constexpr uint32_t MIN_VALID_EPOCH = 1704067200; // 2024-01-01, reject unset system time.
constexpr int32_t LOCAL_OFFSET_SECONDS = 8 * 3600;
constexpr const char* NTP_PRIMARY = "pool.ntp.org";
constexpr const char* NTP_SECONDARY = "time.nist.gov";

constexpr const char* MQTT_HOST = AQUASENSE_MQTT_HOST;
constexpr uint16_t MQTT_PORT = AQUASENSE_MQTT_PORT;
constexpr const char* MQTT_ROOT_CA = AQUASENSE_MQTT_ROOT_CA;
constexpr bool MQTT_TLS_ENABLED = AQUASENSE_MQTT_TLS != 0;
constexpr bool MQTT_DEVICE_SCOPED_TOPICS = AQUASENSE_MQTT_DEVICE_SCOPED_TOPICS != 0;
constexpr bool LCD_ANALOG_DIAGNOSTIC_MODE = AQUASENSE_LCD_ANALOG_DIAGNOSTIC_MODE != 0;
#if defined(AQUASENSE_PRODUCTION_BUILD) && (!AQUASENSE_MQTT_TLS || !AQUASENSE_MQTT_DEVICE_SCOPED_TOPICS)
#error "Production MQTT requires TLS and device-scoped topics."
#endif
// DEVICE_ID is registered uniquely per board and is also the broker client ID.
constexpr const char* MQTT_CLIENT_ID = DEVICE_ID;
// Telemetry and device-scoped actuator topics use MQTT; schedules/config use the authenticated backend client.
}
