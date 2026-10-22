#pragma once

// Copy to device_config.local.h (git-ignored) and replace these values locally.
// Use a unique ID that is registered and active in the backend.
#define AQUASENSE_DEVICE_ID "replace-with-registered-device-id"

// Use the HTTPS address reachable from the ESP32's network, ending in /api/v1.
// Do not use localhost or 127.0.0.1; add :<port> when TLS uses a non-default port.
#define AQUASENSE_BACKEND_API_BASE_URL "https://replace-with-reachable-backend-host/api/v1"

// Paste the trusted PEM root CA as a C string with escaped newlines (\n).
// Keep empty until the actual CA is available; HTTPS will remain disabled.
#define AQUASENSE_BACKEND_ROOT_CA ""

// Secure MQTT migration settings. Replace these only after broker TLS,
// per-device credentials, and ACLs are provisioned. Missing CA/credentials
// make the TLS connection fail closed.
#define AQUASENSE_MQTT_HOST "replace-with-private-mqtt-host"
#define AQUASENSE_MQTT_PORT 8883
#define AQUASENSE_MQTT_TLS 1
#define AQUASENSE_MQTT_ROOT_CA ""
#define AQUASENSE_MQTT_DEVICE_SCOPED_TOPICS 1

// Actuator commissioning values: keep commented/defaulted until the user has
// approved supervised testing and measured safe pump timings at the installed head.
// The output gate defaults to OFF. Both targets must be less than their maxima;
// maxima are capped at five minutes by firmware and API pump requests at one minute.
// #define AQUASENSE_RELAY_OUTPUTS_ENABLED 1
// #define AQUASENSE_FILL_TARGET_RUNTIME_MS 0
// #define AQUASENSE_FILL_MAX_RUNTIME_MS 0
// #define AQUASENSE_DRAIN_TARGET_RUNTIME_MS 0
// #define AQUASENSE_DRAIN_MAX_RUNTIME_MS 0
// #define AQUASENSE_WATER_EXCHANGE_SETTLING_MS 0
// #define AQUASENSE_PUMP_COOLDOWN_MS 0
