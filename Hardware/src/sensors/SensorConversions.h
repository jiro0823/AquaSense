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
constexpr float filter(float previous, float current, bool initialized) {
    return initialized ? smooth(previous, current) : current;
}
constexpr float phFromVoltage(float volts) {
    return volts * CalibrationConfig::PH_SLOPE + CalibrationConfig::PH_OFFSET;
}
constexpr float orpFromVoltage(float volts) {
    return volts * CalibrationConfig::ORP_SLOPE + CalibrationConfig::ORP_OFFSET;
}
constexpr float turbidityFromAdc(int raw) {
    return ((CalibrationConfig::TURBIDITY_CLEAR_ADC - raw) /
        (CalibrationConfig::TURBIDITY_CLEAR_ADC - CalibrationConfig::TURBIDITY_DIRTY_ADC)) *
        CalibrationConfig::TURBIDITY_DIRTY_NTU < 0.0f ? 0.0f :
        ((CalibrationConfig::TURBIDITY_CLEAR_ADC - raw) /
         (CalibrationConfig::TURBIDITY_CLEAR_ADC - CalibrationConfig::TURBIDITY_DIRTY_ADC)) *
        CalibrationConfig::TURBIDITY_DIRTY_NTU > CalibrationConfig::TURBIDITY_DIRTY_NTU ?
        CalibrationConfig::TURBIDITY_DIRTY_NTU :
        ((CalibrationConfig::TURBIDITY_CLEAR_ADC - raw) /
         (CalibrationConfig::TURBIDITY_CLEAR_ADC - CalibrationConfig::TURBIDITY_DIRTY_ADC)) *
        CalibrationConfig::TURBIDITY_DIRTY_NTU;
}
constexpr bool adcUsable(int raw) {
    return raw > 8 && raw < CalibrationConfig::ADC_MAX - 8;
}
constexpr bool phPlausible(float ph) {
    return ph >= Thresholds::PH_MIN && ph <= Thresholds::PH_MAX;
}
constexpr bool temperaturePlausible(float temperature) {
    return temperature >= Thresholds::TEMPERATURE_MIN_C &&
           temperature <= Thresholds::TEMPERATURE_MAX_C;
}
}
