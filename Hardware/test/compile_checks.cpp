#include "sensors/SensorConversions.h"
#include "config/Pins.h"
#include "config/DeviceConfig.h"
#include <stdint.h>
#include "controllers/ControlSafety.h"

static_assert(!ControlSafety::relayConfiguration(25, 26, 27, -1), "Unknown polarity disables relay initialization");
static_assert(!ControlSafety::relayConfiguration(-1, 26, 27, 0), "Unknown channel disables relay initialization");
static_assert(!ControlSafety::relayConfiguration(25, 25, 27, 0), "Loads must not share a relay signal");
static_assert(ControlSafety::relayConfiguration(25, 26, 27, 0) && ControlSafety::relayConfiguration(27, 25, 26, 1), "Support both tested polarities");
static_assert(!ControlSafety::pumpCombination(true, true), "Fill and drain may never run together");
static_assert(ControlSafety::pumpCombination(false, false) && ControlSafety::pumpCombination(true, false) && ControlSafety::pumpCombination(false, true), "Stop and individual pump states are allowed");
static_assert(!ControlSafety::durationAllowed(1000, 0) && !ControlSafety::durationAllowed(0, 5000), "Unset timing inhibits pumping");
static_assert(ControlSafety::durationAllowed(4999, 5000) && !ControlSafety::durationAllowed(5000, 5000), "Normal completion precedes hard deadline");
static_assert(!ControlSafety::durationAllowed(1000, 300001), "Hard limits cannot exceed five minutes");
static_assert(ControlSafety::elapsed(15, 0xfffffff0, 31) && !ControlSafety::elapsed(15, 0xfffffff0, 32), "Controller deadlines survive millis rollover");

constexpr bool near(float value, float expected, float tolerance = 0.01f) {
    return value > expected - tolerance && value < expected + tolerance;
}
static_assert(near(SensorConversions::smooth(0.0f, 25.0f), 7.5f), "Preserve zero-seeded smoothing");
static_assert(near(SensorConversions::smooth(25.0f, 25.0f), 25.0f), "Stable signal must stay stable");
static_assert(near(SensorConversions::phFromAdc(3102), 7.0016f), "pH reference voltage regression");
static_assert(near(SensorConversions::orpFromAdc(2048), -330.4029f), "ORP midpoint sign/units regression");
static_assert(near(SensorConversions::orpFromAdc(0), 1320.0f), "ORP intercept regression");
static_assert(!SensorConversions::adcUsable(0) && !SensorConversions::adcUsable(4095), "ADC rails must be invalid");
static_assert(!SensorConversions::temperaturePlausible(-127.0f), "Disconnected DS18B20 is invalid");
static_assert(!SensorConversions::phPlausible(14.1f), "Reject impossible pH");
static_assert(uint32_t(uint32_t(15) - uint32_t(0xfffffff0)) == 31, "Elapsed timing must survive millis rollover");
static_assert(Pins::PH == 35 && Pins::TURBIDITY == 34 && Pins::ORP == 32 && Pins::TEMPERATURE == 4,
              "Supplied water-monitor wiring regression");
static_assert(DeviceConfig::ADC_SAMPLE_COUNT == 10, "Preserve averaging sample count");
