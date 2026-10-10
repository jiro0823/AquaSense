#pragma once
#include <stdint.h>

namespace ActuatorConfig {
// Commissioning gate: do not infer relay polarity from the module's 5 V supply.
constexpr int RELAY_ACTIVE_LEVEL = -1; // Set to 0 (LOW) or 1 (HIGH) after testing.
// Commission each pump independently using measured flow at the installed head.
// Zero values intentionally keep all water-pump operations disabled.
constexpr uint32_t DRAIN_TARGET_RUNTIME_MS = 0;
constexpr uint32_t DRAIN_MAX_RUNTIME_MS = 0;
constexpr uint32_t FILL_TARGET_RUNTIME_MS = 0;
constexpr uint32_t FILL_MAX_RUNTIME_MS = 0;
constexpr uint32_t WATER_EXCHANGE_SETTLING_MS = 0;
constexpr uint32_t PUMP_COOLDOWN_MS = 0;
constexpr bool WATER_POLICY_CONFIGURED = false;
constexpr bool AERATOR_POLICY_CONFIGURED = false;
constexpr uint32_t SENSOR_SETTLE_SAMPLES = 10;

constexpr bool FEEDER_ENABLED = true;
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
}
