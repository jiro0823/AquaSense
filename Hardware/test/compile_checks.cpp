#include "sensors/SensorConversions.h"
#include "config/Pins.h"
#include "config/DeviceConfig.h"
#include "config/ActuatorConfig.h"
#include <stdint.h>
#include "controllers/ControlSafety.h"

static_assert(!ControlSafety::relayConfiguration(25, 26, 27, -1), "Unknown polarity disables relay initialization");
static_assert(!ControlSafety::relayConfiguration(-1, 26, 27, 0), "Unknown channel disables relay initialization");
static_assert(!ControlSafety::relayConfiguration(25, 25, 27, 0), "Loads must not share a relay signal");
static_assert(ControlSafety::relayConfiguration(25, 26, 27, 0) && ControlSafety::relayConfiguration(27, 25, 26, 1), "Support both tested polarities");
static_assert(ControlSafety::relayPin(25) && ControlSafety::relayPin(26) && ControlSafety::relayPin(27) && ControlSafety::relayPin(33),
              "Accept the four GPIO relay signal candidates without assigning physical loads");
static_assert(Pins::Diagram::SERVO == 13 && Pins::Diagram::BUZZER == 18 &&
              Pins::Diagram::RELAY_SIGNALS[0] == 25 && Pins::Diagram::RELAY_SIGNALS[1] == 26 &&
              Pins::Diagram::RELAY_SIGNALS[2] == 27 && Pins::Diagram::RELAY_SIGNALS[3] == 33,
              "Preserve explicitly supplied actuator GPIO group");
static_assert(Pins::FILL_RELAY_GPIO == 25 && Pins::DRAIN_RELAY_GPIO == 26 &&
              Pins::AERATOR_RELAY_GPIO == 27 &&
              !ControlSafety::relayConfiguration(Pins::FILL_RELAY_GPIO, Pins::DRAIN_RELAY_GPIO,
                                                 Pins::AERATOR_RELAY_GPIO, ActuatorConfig::RELAY_ACTIVE_LEVEL),
              "Map diagram load channels while keeping unknown relay polarity disabled");
static_assert(!ControlSafety::pumpCombination(true, true), "Fill and drain may never run together");
static_assert(ControlSafety::pumpCombination(false, false) && ControlSafety::pumpCombination(true, false) && ControlSafety::pumpCombination(false, true), "Stop and individual pump states are allowed");
static_assert(!ControlSafety::durationAllowed(1000, 0) && !ControlSafety::durationAllowed(0, 5000), "Unset timing inhibits pumping");
static_assert(ControlSafety::durationAllowed(4999, 5000) && ControlSafety::durationAllowed(5000, 5000), "The configured hard limit is a valid maximum command duration");
static_assert(!ControlSafety::durationAllowed(1000, 300001), "Hard limits cannot exceed five minutes");
static_assert(ActuatorConfig::MAX_DRAIN_RUNTIME_MS == 60000 && ActuatorConfig::MAX_REFILL_RUNTIME_MS == 60000,
              "Initial pump hard caps are 60 seconds per direction");
static_assert(ControlSafety::durationAllowed(60000, ActuatorConfig::MAX_DRAIN_RUNTIME_MS) &&
              ControlSafety::durationAllowed(60000, ActuatorConfig::MAX_REFILL_RUNTIME_MS) &&
              !ControlSafety::durationAllowed(60001, ActuatorConfig::MAX_DRAIN_RUNTIME_MS) &&
              !ControlSafety::durationAllowed(60001, ActuatorConfig::MAX_REFILL_RUNTIME_MS),
              "Pump phases cannot exceed their configured limits");
static_assert(ControlSafety::elapsed(15, 0xfffffff0, 31) && !ControlSafety::elapsed(15, 0xfffffff0, 32), "Controller deadlines survive millis rollover");

constexpr bool near(float value, float expected, float tolerance = 0.01f) {
    return value > expected - tolerance && value < expected + tolerance;
}
static_assert(near(SensorConversions::filter(0.0f, 25.0f, false), 25.0f), "First valid sample seeds filter directly");
static_assert(near(SensorConversions::filter(7.5f, 25.0f, false), 25.0f), "Recovery discards stale filter state");
static_assert(near(SensorConversions::smooth(25.0f, 25.0f), 25.0f), "Stable signal must stay stable");
static_assert(near(SensorConversions::phFromVoltage(2.34f), 8.002f), "pH supplied calibration regression");
static_assert(near(SensorConversions::orpFromVoltage(2.0f), 666.66f), "ORP supplied calibration regression");
static_assert(near(SensorConversions::turbidityFromAdc(3000), 0.0f), "Clear water reference is zero NTU");
static_assert(near(SensorConversions::turbidityFromAdc(500), 1000.0f), "Dirty water reference is 1000 NTU");
static_assert(!SensorConversions::adcUsable(0) && !SensorConversions::adcUsable(4095), "ADC rails must be invalid");
static_assert(!SensorConversions::temperaturePlausible(-127.0f), "Disconnected DS18B20 is invalid");
static_assert(!SensorConversions::phPlausible(14.1f), "Reject impossible pH");
static_assert(uint32_t(uint32_t(15) - uint32_t(0xfffffff0)) == 31, "Elapsed timing must survive millis rollover");
static_assert(Pins::PH == 35 && Pins::TURBIDITY == 34 && Pins::ORP == 32 && Pins::TEMPERATURE == 4,
              "Supplied water-monitor wiring regression");
static_assert(DeviceConfig::ADC_SAMPLE_COUNT == 12, "Match supplied sensor sample window");
static_assert(DeviceConfig::MQTT_CLIENT_ID == DeviceConfig::DEVICE_ID,
              "Integrated MQTT client ID must uniquely follow the registered device ID");
static_assert(CalibrationConfig::CONNECT_CONFIRM_COUNT == 1 && CalibrationConfig::DISCONNECT_CONFIRM_COUNT == 4,
              "Preserve per-sensor connection debounce counts");
