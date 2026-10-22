#pragma once
#include <stdint.h>

#if __has_include("config/device_config.local.h")
#include "config/device_config.local.h"
#endif

// Keep every actuator path closed until installation-specific supervised checks are approved.
#ifndef AQUASENSE_ACTUATOR_COMMISSIONING_ENABLED
#define AQUASENSE_ACTUATOR_COMMISSIONING_ENABLED 0
#endif
#ifndef AQUASENSE_AERATOR_OUTPUTS_ENABLED
#define AQUASENSE_AERATOR_OUTPUTS_ENABLED 0
#endif
#ifndef AQUASENSE_FEEDER_ENABLED
#define AQUASENSE_FEEDER_ENABLED 1
#endif

// Public MQTT development builds can exchange telemetry and read-only status
// acknowledgments only, even if a local commissioning override is present.
#if defined(AQUASENSE_PUBLIC_MQTT_DEV)
#undef AQUASENSE_ACTUATOR_COMMISSIONING_ENABLED
#define AQUASENSE_ACTUATOR_COMMISSIONING_ENABLED 0
#undef AQUASENSE_RELAY_OUTPUTS_ENABLED
#define AQUASENSE_RELAY_OUTPUTS_ENABLED 0
#undef AQUASENSE_AERATOR_OUTPUTS_ENABLED
#define AQUASENSE_AERATOR_OUTPUTS_ENABLED 0
#undef AQUASENSE_FEEDER_ENABLED
#define AQUASENSE_FEEDER_ENABLED 0
#endif

// Optional values may be set in the ignored config/device_config.local.h.
// Defaults deliberately keep relay outputs and timed pump commands disabled.
#ifndef AQUASENSE_RELAY_OUTPUTS_ENABLED
#define AQUASENSE_RELAY_OUTPUTS_ENABLED 0
#endif
#ifndef AQUASENSE_FILL_TARGET_RUNTIME_MS
#define AQUASENSE_FILL_TARGET_RUNTIME_MS 0
#endif
#ifndef AQUASENSE_FILL_MAX_RUNTIME_MS
#define AQUASENSE_FILL_MAX_RUNTIME_MS 0
#endif
#ifndef AQUASENSE_DRAIN_TARGET_RUNTIME_MS
#define AQUASENSE_DRAIN_TARGET_RUNTIME_MS 0
#endif
#ifndef AQUASENSE_DRAIN_MAX_RUNTIME_MS
#define AQUASENSE_DRAIN_MAX_RUNTIME_MS 0
#endif
#ifndef AQUASENSE_WATER_EXCHANGE_SETTLING_MS
#define AQUASENSE_WATER_EXCHANGE_SETTLING_MS 0
#endif
#ifndef AQUASENSE_PUMP_COOLDOWN_MS
#define AQUASENSE_PUMP_COOLDOWN_MS 0
#endif

namespace ActuatorConfig {
constexpr bool ACTUATOR_COMMISSIONING_ENABLED = AQUASENSE_ACTUATOR_COMMISSIONING_ENABLED != 0;
constexpr bool AERATOR_OUTPUTS_ENABLED = AQUASENSE_AERATOR_OUTPUTS_ENABLED != 0;
// Active-LOW relay configuration. Keep outputs inhibited until electrical
// trigger and startup behavior have been verified on the installed module.
constexpr int RELAY_ACTIVE_LEVEL = 0;
constexpr bool RELAY_OUTPUTS_ENABLED = AQUASENSE_RELAY_OUTPUTS_ENABLED != 0;
// Supply these only after supervised measurements; zero continues to fail closed.
constexpr uint32_t DRAIN_TARGET_RUNTIME_MS = AQUASENSE_DRAIN_TARGET_RUNTIME_MS;
constexpr uint32_t DRAIN_MAX_RUNTIME_MS = AQUASENSE_DRAIN_MAX_RUNTIME_MS;
constexpr uint32_t FILL_TARGET_RUNTIME_MS = AQUASENSE_FILL_TARGET_RUNTIME_MS;
constexpr uint32_t FILL_MAX_RUNTIME_MS = AQUASENSE_FILL_MAX_RUNTIME_MS;
constexpr uint32_t WATER_EXCHANGE_SETTLING_MS = AQUASENSE_WATER_EXCHANGE_SETTLING_MS;
constexpr uint32_t PUMP_COOLDOWN_MS = AQUASENSE_PUMP_COOLDOWN_MS;
constexpr bool WATER_POLICY_CONFIGURED = false;
constexpr bool AERATOR_POLICY_CONFIGURED = false;
constexpr uint32_t SENSOR_SETTLE_SAMPLES = 10;

constexpr bool FEEDER_ENABLED = AQUASENSE_FEEDER_ENABLED != 0;
constexpr int FEEDER_CLOSED_DEGREES = 25;
constexpr int FEEDER_OPEN_DEGREES = 140;
constexpr uint32_t FEEDER_CLOSE_MS = 800;
constexpr uint32_t FEEDER_OPEN_MS = 1000;
constexpr uint32_t FEEDER_FINISH_MS = 800;
constexpr uint32_t FEEDER_MANUAL_HOLD_MAX_MS = 10000; // Bound formerly indefinite ON.
constexpr int BUZZER_CHANNEL = 15; // Reserved; the single servo uses another channel.
constexpr uint32_t BUZZER_FREQUENCY_HZ = 2000;
constexpr uint32_t BUZZER_ON_MS = 250;
constexpr uint32_t BUZZER_OFF_MS = 750;
constexpr uint32_t BUZZER_MANUAL_TEST_MAX_MS = 3000;
}
