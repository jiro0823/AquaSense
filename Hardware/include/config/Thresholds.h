#pragma once

namespace Thresholds {
// Sensor plausibility limits, NOT crayfish husbandry or automation thresholds.
constexpr float TEMPERATURE_MIN_C = -55.0f;
constexpr float TEMPERATURE_MAX_C = 125.0f;
constexpr float PH_MIN = 0.0f;
constexpr float PH_MAX = 14.0f;
// TODO: Commission these policy values before enabling their config gates.
// They are deliberately inactive placeholders, not claimed safe farming limits.
constexpr float WATER_PH_LOW = 0.0f;
constexpr float WATER_PH_HIGH = 0.0f;
constexpr float WATER_TURBIDITY_RAW_HIGH = 0.0f;
constexpr float WATER_ORP_LOW_MV = 0.0f;
constexpr float WATER_ORP_HIGH_MV = 0.0f;
constexpr float AERATOR_TEMPERATURE_ON_C = 0.0f;
constexpr float AERATOR_TEMPERATURE_OFF_C = 0.0f;

// Configure all sensor alarm bounds and set this true only after calibration.
// The buzzer remains silent while this commissioning gate is false.
constexpr bool SENSOR_ALARM_CONFIGURED = false;
constexpr float SENSOR_ALARM_PH_LOW = 0.0f;
constexpr float SENSOR_ALARM_PH_HIGH = 0.0f;
constexpr float SENSOR_ALARM_TEMPERATURE_LOW_C = 0.0f;
constexpr float SENSOR_ALARM_TEMPERATURE_HIGH_C = 0.0f;
constexpr float SENSOR_ALARM_TURBIDITY_HIGH_NTU = 0.0f;
constexpr float SENSOR_ALARM_ORP_LOW_MV = 0.0f;
constexpr float SENSOR_ALARM_ORP_HIGH_MV = 0.0f;
}
