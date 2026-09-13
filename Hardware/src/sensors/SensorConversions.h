#pragma once
#include "config/CalibrationConfig.h"
#include "config/Thresholds.h"

// Pure constexpr functions make the original formulas independently checkable
// at compile time. SensorManager owns acquisition and filtering state.
namespace SensorConversions {
constexpr float smooth(float previous, float current) {
    return previous * CalibrationConfig::SMOOTH_PREVIOUS_WEIGHT +
           current * CalibrationConfig::SMOOTH_CURRENT_WEIGHT;
}
constexpr float phFromAdc(int raw) {
    return CalibrationConfig::PH_REFERENCE_VALUE +
           (CalibrationConfig::PH_REFERENCE_VOLTS -
            raw * (CalibrationConfig::ADC_REFERENCE_VOLTS / CalibrationConfig::ADC_MAX)) /
               CalibrationConfig::PH_VOLTS_PER_UNIT;
}
constexpr float orpFromAdc(int raw) {
    return ((30.0f * CalibrationConfig::ORP_SYSTEM_MV) -
            (75.0f * raw * (CalibrationConfig::ORP_SYSTEM_MV / CalibrationConfig::ADC_MAX))) /
               75.0f + CalibrationConfig::ORP_OFFSET_MV;
}
constexpr bool adcUsable(int raw) {
    return raw > 0 && raw < CalibrationConfig::ADC_MAX;
}
constexpr bool phPlausible(float ph) {
    return ph >= Thresholds::PH_MIN && ph <= Thresholds::PH_MAX;
}
constexpr bool temperaturePlausible(float temperature) {
    return temperature >= Thresholds::TEMPERATURE_MIN_C &&
           temperature <= Thresholds::TEMPERATURE_MAX_C;
}
}
