#pragma once

namespace CalibrationConfig {
// Retain the supplied sketch's formulas and zero-seeded smoothing.
constexpr int ADC_MAX = 4095;
constexpr float ADC_REFERENCE_VOLTS = 3.3f;
constexpr float SMOOTH_PREVIOUS_WEIGHT = 0.7f;
constexpr float SMOOTH_CURRENT_WEIGHT = 0.3f;
constexpr float PH_REFERENCE_VALUE = 7.0f;
constexpr float PH_REFERENCE_VOLTS = 2.5f;
constexpr float PH_VOLTS_PER_UNIT = 0.18f;
constexpr float ORP_SYSTEM_MV = 3300.0f;
constexpr float ORP_OFFSET_MV = 0.0f;
constexpr float TEMPERATURE_OFFSET_C = 0.0f;
// Turbidity is raw averaged/smoothed ADC counts, NOT calibrated NTU.
// TODO: Validate pH/ORP coefficients against reference solutions and the actual
// analog front end. The pH formula retains the original treatment of the divider.
}
