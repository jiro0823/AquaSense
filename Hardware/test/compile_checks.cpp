#include "sensors/SensorConversions.h"
#include "config/ActuatorConfig.h"
#include "config/Pins.h"
#include "config/DeviceConfig.h"
#include "config/ActuatorConfig.h"
#include <stdint.h>
#include "controllers/ControlSafety.h"
#include "sensors/SensorManager.h"

static_assert(!ControlSafety::relayConfiguration(25, 26, 27, -1), "Unknown polarity disables relay initialization");
static_assert(!ControlSafety::relayConfiguration(-1, 26, 27, 0), "Unknown channel disables relay initialization");
static_assert(!ControlSafety::relayConfiguration(25, 25, 27, 0), "Loads must not share a relay signal");
static_assert(ControlSafety::relayConfiguration(25, 26, 27, 0) && ControlSafety::relayConfiguration(27, 25, 26, 1), "Support both tested polarities");
static_assert(ControlSafety::relayPin(25) && ControlSafety::relayPin(26) && ControlSafety::relayPin(27) && ControlSafety::relayPin(33),
              "Accept the four GPIO relay signal candidates without assigning physical loads");
static_assert(Pins::Diagram::SERVO == 18 && Pins::Diagram::BUZZER == 19 &&
              Pins::Diagram::RELAY_SIGNALS[0] == 25 && Pins::Diagram::RELAY_SIGNALS[1] == 26 &&
              Pins::Diagram::RELAY_SIGNALS[2] == 27 && Pins::Diagram::RELAY_SIGNALS[3] == 33,
              "Preserve explicitly supplied actuator GPIO group");
static_assert(Pins::FILL_RELAY_GPIO == 26 && Pins::DRAIN_RELAY_GPIO == 27 &&
              Pins::AERATOR_RELAY_GPIO == 25 &&
              ControlSafety::relayConfiguration(Pins::FILL_RELAY_GPIO, Pins::DRAIN_RELAY_GPIO,
                                                 Pins::AERATOR_RELAY_GPIO, ActuatorConfig::RELAY_ACTIVE_LEVEL),
              "Preserve diagram load channels with configured active-LOW polarity");
static_assert(ControlSafety::relayOutputLevel(true, 0) == 0 && ControlSafety::relayOutputLevel(false, 0) == 1,
              "Active-LOW relay ON is LOW and OFF is HIGH");
static_assert(!ActuatorConfig::RELAY_OUTPUTS_ENABLED &&
              !ControlSafety::relayOutputsReady(true, ActuatorConfig::RELAY_OUTPUTS_ENABLED) &&
              !ControlSafety::relayOutputsReady(false, true),
              "Relay outputs stay inhibited unless configuration and commissioning gate are both valid");
static_assert(!ControlSafety::pumpCombination(true, true), "Fill and drain may never run together");
static_assert(ControlSafety::pumpCombination(false, false) && ControlSafety::pumpCombination(true, false) && ControlSafety::pumpCombination(false, true), "Stop and individual pump states are allowed");
static_assert(!ControlSafety::durationAllowed(1000, 0) && !ControlSafety::durationAllowed(0, 5000), "Unset timing inhibits pumping");
static_assert(ControlSafety::durationAllowed(4999, 5000) && !ControlSafety::durationAllowed(5000, 5000), "Command duration must remain strictly below the hard timeout");
static_assert(!ControlSafety::durationAllowed(1000, 300001), "Hard limits cannot exceed five minutes");
static_assert(ActuatorConfig::DRAIN_TARGET_RUNTIME_MS == 0 && ActuatorConfig::DRAIN_MAX_RUNTIME_MS == 0 &&
              ActuatorConfig::FILL_TARGET_RUNTIME_MS == 0 && ActuatorConfig::FILL_MAX_RUNTIME_MS == 0 &&
              ActuatorConfig::WATER_EXCHANGE_SETTLING_MS == 0 && ActuatorConfig::PUMP_COOLDOWN_MS == 0 &&
              !ActuatorConfig::WATER_POLICY_CONFIGURED,
              "Uncommissioned pump timings and water policy must remain disabled");
static_assert(!ControlSafety::durationAllowed(ActuatorConfig::DRAIN_TARGET_RUNTIME_MS, ActuatorConfig::DRAIN_MAX_RUNTIME_MS) &&
              !ControlSafety::durationAllowed(ActuatorConfig::FILL_TARGET_RUNTIME_MS, ActuatorConfig::FILL_MAX_RUNTIME_MS),
              "Zero pump target/max configuration must inhibit both pumps");
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
static_assert(SensorConversions::adcLooksConnected(147, 157, CalibrationConfig::TURBIDITY_CONNECT_MIN,
                                                    CalibrationConfig::TURBIDITY_CONNECT_MAX),
              "Supplied turbidity electrical window accepts the reported ADC burst");
static_assert(!SensorConversions::adcLooksConnected(138, 197, CalibrationConfig::PH_CONNECT_MIN,
                                                     CalibrationConfig::PH_CONNECT_MAX),
              "Supplied pH electrical window rejects values below its configured minimum");
static_assert(!SensorConversions::adcLooksConnected(147, 401, CalibrationConfig::TURBIDITY_CONNECT_MIN,
                                                     CalibrationConfig::TURBIDITY_CONNECT_MAX),
              "Supplied stability rule rejects excessive burst variation");
static_assert(!SensorConversions::adcUsable(0) && !SensorConversions::adcUsable(4095), "ADC rails must be invalid");
static_assert(!SensorSampleValidity::current(true, false, true) &&
              SensorSampleValidity::current(true, true, true),
              "pH invalid sample clears validity while debounced connected; next good sample recovers");
static_assert(!SensorSampleValidity::current(true, false, true) &&
              SensorSampleValidity::current(true, true, true),
              "Temperature invalid sample clears validity while debounced connected; next good sample recovers");
static_assert(!SensorSampleValidity::current(true, false, true) &&
              SensorSampleValidity::current(true, true, true),
              "Turbidity invalid sample clears validity while debounced connected; next good sample recovers");
static_assert(!SensorSampleValidity::current(true, false, true) &&
              SensorSampleValidity::current(true, true, true),
              "ORP invalid sample clears validity while debounced connected; next good sample recovers");
static_assert(!SensorConversions::temperaturePlausible(-127.0f), "Disconnected DS18B20 is invalid");
static_assert(!SensorConversions::phPlausible(14.1f), "Reject impossible pH");
static_assert(uint32_t(uint32_t(15) - uint32_t(0xfffffff0)) == 31, "Elapsed timing must survive millis rollover");
static_assert(Pins::PH == 35 && Pins::TURBIDITY == 34 && Pins::ORP == 32 && Pins::TEMPERATURE == 4,
              "Supplied water-monitor wiring regression");
static_assert(DeviceConfig::ADC_SAMPLE_COUNT == 12, "Match reference ADC averaging sample count");
static_assert(DeviceConfig::SENSOR_READ_INTERVAL_MS == 1000 && DeviceConfig::MQTT_PUBLISH_INTERVAL_MS == 5000,
              "Match reference sensor and MQTT intervals");
static_assert(DeviceConfig::MQTT_ACTUATOR_COMMANDS_ENABLED && DeviceConfig::MQTT_CONTROL_PUBLIC_ENABLED,
              "Public-dev feeder control is explicitly enabled and HMAC protected");
static_assert(DeviceConfig::MQTT_PORT == 1883 && DeviceConfig::hasPrefix(DeviceConfig::MQTT_HOST, "broker.hivemq.com") &&
              DeviceConfig::hasPrefix(DeviceConfig::MQTT_CONTROL_TOPIC_NAMESPACE, "aquasense-control-dev") &&
              !DeviceConfig::hasPrefix(DeviceConfig::MQTT_CONTROL_TOPIC_NAMESPACE, DeviceConfig::MQTT_TOPIC_NAMESPACE),
              "Control uses the distinct public-dev namespace");
static_assert(DeviceConfig::WIFI_RECONNECT_INTERVAL_MS == 3000 && DeviceConfig::WIFI_CHECK_INTERVAL_MS == 5000 &&
              DeviceConfig::MQTT_RECONNECT_INTERVAL_MS == 3000,
              "Match reference nonblocking connection retry/check intervals");
static_assert(DeviceConfig::backendTransportConfigured("https://backend.example/api/v1", "trusted-ca", false),
              "HTTPS requires a configured trusted CA");
static_assert(!DeviceConfig::backendTransportConfigured("https://backend.example/api/v1", "", true),
              "A development HTTP opt-in cannot bypass the HTTPS CA requirement");
static_assert(!DeviceConfig::backendTransportConfigured("http://backend.example/api/v1", "", false),
              "HTTP is disabled without the explicit development opt-in");
static_assert(DeviceConfig::backendTransportConfigured("http://backend.example/api/v1", "", true),
              "HTTP is permitted only when the caller supplies the development-only gate");
static_assert(!DeviceConfig::backendTransportConfigured("https:///api/v1", "trusted-ca", false),
              "HTTPS configuration requires an authority");
