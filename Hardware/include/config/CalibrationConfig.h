#pragma once
#include <stdint.h>
#include <stdint.h>

namespace CalibrationConfig {
// User-supplied hardware calibration profile. Validate against reference
// solutions and the installed analog front ends during commissioning.
constexpr bool ANALOG_CONVERSION_VERIFIED = true;
constexpr const char* PROFILE_ID = "aquasense-user-calibration-v1";
constexpr int ADC_MAX = 4095;
constexpr float ADC_REFERENCE_VOLTS = 3.3f;
constexpr float SMOOTH_PREVIOUS_WEIGHT = 0.7f;
constexpr float SMOOTH_CURRENT_WEIGHT = 0.3f;
constexpr float PH_SLOPE = -5.70f;
constexpr float PH_OFFSET = 21.34f;
constexpr float ORP_SLOPE = 1333.33f;
constexpr float ORP_OFFSET = -2000.0f;
constexpr float TURBIDITY_CLEAR_ADC = 3000.0f;
constexpr float TURBIDITY_DIRTY_ADC = 500.0f;
constexpr float TURBIDITY_DIRTY_NTU = 1000.0f;
constexpr int PH_CONNECT_MIN = 200;
constexpr int PH_CONNECT_MAX = 3900;
constexpr int TURBIDITY_CONNECT_MIN = 50;
constexpr int TURBIDITY_CONNECT_MAX = 4050;
constexpr int ORP_CONNECT_MIN = 50;
constexpr int ORP_CONNECT_MAX = 4050;
constexpr int STABILITY_MAX_DEV = 400;
constexpr uint8_t CONNECT_CONFIRM_COUNT = 1;
constexpr uint8_t DISCONNECT_CONFIRM_COUNT = 4;
constexpr float TEMPERATURE_OFFSET_C = 0.0f;
// pH and ORP are calibrated from ADC-pin voltage. Turbidity uses averaged ADC.
}
