#include "sensors/SensorConversions.h"
#include "config/CalibrationConfig.h"
#include "config/ActuatorConfig.h"
#include "config/Pins.h"
#include "config/DeviceConfig.h"
#include "config/ActuatorConfig.h"
#include <stdint.h>
#include "controllers/ControlSafety.h"
#include "models/Command.h"
#include "sensors/SensorManager.h"

static_assert(!ControlSafety::relayConfiguration(25, 26, 27, -1), "Unknown polarity disables relay initialization");
static_assert(!ControlSafety::relayConfiguration(-1, 26, 27, 0), "Unknown channel disables relay initialization");
static_assert(!ControlSafety::relayConfiguration(25, 25, 27, 0), "Loads must not share a relay signal");
static_assert(ControlSafety::relayConfiguration(25, 26, 27, 0) && ControlSafety::relayConfiguration(27, 25, 26, 1), "Support both tested polarities");
static_assert(ControlSafety::relayPin(25) && ControlSafety::relayPin(26) && ControlSafety::relayPin(27) && ControlSafety::relayPin(33),
              "Accept the four GPIO relay signal candidates without assigning physical loads");
static_assert(Pins::SERVO == 18 && Pins::BUZZER == 19 &&
              Pins::FILL_RELAY_GPIO == 26 && Pins::DRAIN_RELAY_GPIO == 27 &&
              Pins::AERATOR_RELAY_GPIO == 25 &&
              ControlSafety::relayConfiguration(Pins::FILL_RELAY_GPIO, Pins::DRAIN_RELAY_GPIO,
                                                 Pins::AERATOR_RELAY_GPIO, ActuatorConfig::RELAY_ACTIVE_LEVEL),
              "Use the specified logical actuator GPIOs with configured active-LOW polarity");
static_assert(Pins::SERVO != Pins::BUZZER && Pins::SERVO != Pins::FILL_RELAY_GPIO &&
              Pins::BUZZER != Pins::DRAIN_RELAY_GPIO && ActuatorConfig::BUZZER_MANUAL_TEST_MAX_MS <= 5000,
              "Actuator GPIOs must not conflict and manual buzzer tests stay bounded");
static_assert(ControlSafety::relayOutputLevel(true, 0) == 0 && ControlSafety::relayOutputLevel(false, 0) == 1,
              "Active-LOW relay ON is LOW and OFF is HIGH");
static_assert(ControlSafety::relayOutputsReady(true, ActuatorConfig::RELAY_OUTPUTS_ENABLED) == ActuatorConfig::RELAY_OUTPUTS_ENABLED &&
              !ControlSafety::relayOutputsReady(false, true),
              "Relay outputs require valid configuration and explicit commissioning gate");
static_assert(!ControlSafety::commissioningAllowsActuation(false, false) &&
              ControlSafety::commissioningAllowsActuation(false, true) &&
              ControlSafety::commissioningAllowsActuation(true, false),
              "Actuator commissioning blocks starts while preserving safe stop commands");
#if defined(AQUASENSE_PUBLIC_MQTT_DEV)
static_assert(!DeviceConfig::MQTT_TLS_ENABLED && DeviceConfig::MQTT_DEVICE_SCOPED_TOPICS &&
              DeviceConfig::contains(DeviceConfig::MQTT_HOST, "broker.hivemq.com") && DeviceConfig::MQTT_PORT == 1883 &&
              DeviceConfig::contains(DeviceConfig::MQTT_TOPIC_NAMESPACE, "aquasense-dev") &&
              !DeviceConfig::MQTT_ACTUATOR_COMMANDS_ENABLED,
              "Public development profile uses isolated HiveMQ topics and rejects MQTT commands");
static_assert(!ActuatorConfig::ACTUATOR_COMMISSIONING_ENABLED && !ActuatorConfig::RELAY_OUTPUTS_ENABLED &&
              !ActuatorConfig::AERATOR_OUTPUTS_ENABLED && !ActuatorConfig::FEEDER_ENABLED &&
              !ControlSafety::commissioningAllowsActuation(ActuatorConfig::ACTUATOR_COMMISSIONING_ENABLED, false),
              "Public development profile must reject pump, aerator, buzzer, and feeder actuation");
#endif
static_assert(!ActuatorConfig::AERATOR_OUTPUTS_ENABLED,
              "Keep the unconnected aerator output disabled");
static_assert(!ControlSafety::pumpCombination(true, true), "Fill and drain may never run together");
static_assert(isReadOnlyAction(CommandAction::StatusRequest) && !isReadOnlyAction(CommandAction::AllOff),
              "Only the explicit status diagnostic is classified as read-only");
static_assert(ControlSafety::pumpCombination(false, false) && ControlSafety::pumpCombination(true, false) && ControlSafety::pumpCombination(false, true), "Stop and individual pump states are allowed");
static_assert(!ControlSafety::durationAllowed(1000, 0) && !ControlSafety::durationAllowed(0, 5000), "Unset timing inhibits pumping");
static_assert(ControlSafety::durationAllowed(4999, 5000) && !ControlSafety::durationAllowed(5000, 5000), "Command duration must remain strictly below the hard timeout");
static_assert(!ControlSafety::durationAllowed(1000, 300001), "Hard limits cannot exceed five minutes");
static_assert((ActuatorConfig::DRAIN_TARGET_RUNTIME_MS == 0 && ActuatorConfig::DRAIN_MAX_RUNTIME_MS == 0) ||
              ControlSafety::durationAllowed(ActuatorConfig::DRAIN_TARGET_RUNTIME_MS, ActuatorConfig::DRAIN_MAX_RUNTIME_MS),
              "Configured drain target must be nonzero and below its hard maximum");
static_assert((ActuatorConfig::FILL_TARGET_RUNTIME_MS == 0 && ActuatorConfig::FILL_MAX_RUNTIME_MS == 0) ||
              ControlSafety::durationAllowed(ActuatorConfig::FILL_TARGET_RUNTIME_MS, ActuatorConfig::FILL_MAX_RUNTIME_MS),
              "Configured fill target must be nonzero and below its hard maximum");
static_assert(!ActuatorConfig::WATER_POLICY_CONFIGURED,
              "Water automation remains disabled pending independently commissioned thresholds");
static_assert(ControlSafety::elapsed(15, 0xfffffff0, 31) && !ControlSafety::elapsed(15, 0xfffffff0, 32), "Controller deadlines survive millis rollover");

constexpr bool near(float value, float expected, float tolerance = 0.01f) {
    return value > expected - tolerance && value < expected + tolerance;
}
static_assert(near(SensorConversions::filter(0.0f, 25.0f, false), 25.0f), "First valid sample seeds filter directly");
static_assert(near(SensorConversions::filter(7.5f, 25.0f, false), 25.0f), "Recovery discards stale filter state");
static_assert(near(SensorConversions::smooth(25.0f, 25.0f), 25.0f), "Stable signal must stay stable");
static_assert(near(SensorConversions::phFromVoltage(2.34f), 8.002f), "pH supplied calibration regression");
static_assert(near(SensorConversions::provisionalPhFromVoltage(-1.0f), 14.0f),
              "Development pH preview clamps to sketch range");
static_assert(near(SensorConversions::orpFromVoltage(2.0f), 666.66f), "ORP supplied calibration regression");
static_assert(near(SensorConversions::turbidityFromAdc(3000), 0.0f), "Clear water reference is zero NTU");
static_assert(near(SensorConversions::turbidityFromAdc(500), 1000.0f), "Dirty water reference is 1000 NTU");
static_assert(near(SensorConversions::provisionalTurbidityFromAdc(0), 1000.0f),
              "Development turbidity preview clamps to sketch range");
static_assert(near(SensorConversions::provisionalTurbidityFromAdc(4095), 0.0f),
              "Development turbidity preview clamps negative values to zero");
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
static_assert(!SensorSampleValidity::analog(false, false, true, true) &&
              SensorSampleValidity::analog(true, false, true, true) &&
              SensorSampleValidity::analog(false, true, true, true) &&
              !SensorSampleValidity::analog(true, false, false, true) &&
              !SensorSampleValidity::analog(true, false, true, false),
              "Unverified analog estimates are valid only in offline calibration mode and only for good acquisitions");
static_assert(!SensorConversions::temperaturePlausible(-127.0f), "Disconnected DS18B20 is invalid");
static_assert(!SensorConversions::phPlausible(14.1f), "Reject impossible pH");
static_assert(uint32_t(uint32_t(15) - uint32_t(0xfffffff0)) == 31, "Elapsed timing must survive millis rollover");
static_assert(Pins::PH == 35 && Pins::TURBIDITY == 34 && Pins::ORP == 32 && Pins::TEMPERATURE == 4,
              "Supplied water-monitor wiring regression");
static_assert(!CalibrationConfig::ANALOG_CONVERSION_VERIFIED,
              "Analog conversions must remain unverified until hardware calibration evidence exists");
#if defined(AQUASENSE_OFFLINE_CALIBRATION_MODE)
static_assert(DeviceConfig::OFFLINE_CALIBRATION_MODE, "Calibration firmware target must opt in explicitly");
static_assert(!DeviceConfig::NETWORK_SERVICES_ENABLED, "Calibration firmware must keep network services disabled");
static_assert(!DeviceConfig::ACTUATOR_CONTROL_ENABLED, "Calibration firmware must inhibit actuator APIs");
static_assert(!DeviceConfig::COMMAND_CONTROL_ENABLED, "Calibration firmware must reject command control");
static_assert(!DeviceConfig::SCHEDULE_PERSISTENCE_ENABLED, "Calibration firmware must not access persisted schedules");
#else
static_assert(!DeviceConfig::OFFLINE_CALIBRATION_MODE, "Networked firmware targets remain outside calibration mode");
static_assert(DeviceConfig::NETWORK_SERVICES_ENABLED && DeviceConfig::ACTUATOR_CONTROL_ENABLED &&
              DeviceConfig::COMMAND_CONTROL_ENABLED && DeviceConfig::SCHEDULE_PERSISTENCE_ENABLED,
              "Normal firmware policy gates preserve existing service and actuator paths");
#endif
static_assert(DeviceConfig::ADC_SAMPLE_COUNT == 12, "Match reference ADC averaging sample count");
static_assert(DeviceConfig::SENSOR_READ_INTERVAL_MS == 1000 && DeviceConfig::MQTT_PUBLISH_INTERVAL_MS == 5000,
              "Match reference sensor and MQTT intervals");
static_assert(DeviceConfig::WIFI_RECONNECT_INTERVAL_MS == 3000 && DeviceConfig::WIFI_CHECK_INTERVAL_MS == 5000 &&
              DeviceConfig::MQTT_RECONNECT_INTERVAL_MS == 3000,
              "Match reference nonblocking connection retry/check intervals");
static_assert(DeviceConfig::backendTransportConfigured("https://aquasense-backend.internal/api/v1", "trusted-ca", false),
              "HTTPS requires a configured trusted CA");
static_assert(!DeviceConfig::backendTransportConfigured("https://aquasense-backend.internal/api/v1", "", true),
              "A development HTTP opt-in cannot bypass the HTTPS CA requirement");
static_assert(!DeviceConfig::backendTransportConfigured("http://aquasense-backend.internal/api/v1", "", false),
              "HTTP is disabled without the explicit development opt-in");
static_assert(DeviceConfig::backendTransportConfigured("http://aquasense-backend.internal/api/v1", "", true),
              "HTTP is permitted only when the caller supplies the development-only gate");
static_assert(!DeviceConfig::backendTransportConfigured("https:///api/v1", "trusted-ca", false),
              "HTTPS configuration requires an authority");
static_assert(!DeviceConfig::backendTransportConfigured("https://replace-with-backend/api/v1", "trusted-ca", false),
              "Placeholder backend addresses must fail closed even when a CA is present");
static_assert(!DeviceConfig::backendTransportConfigured("https://localhost:5001/api/v1", "trusted-ca", false),
              "An ESP32 cannot reach a host-local loopback address");
static_assert(!DeviceConfig::deviceIdIsConfigured("replace-with-registered-device-id"),
              "Placeholder device IDs must not start backend control");
static_assert(DeviceConfig::validMqttDeviceId("esp32-feeder-1") && !DeviceConfig::validMqttDeviceId("tank/one"),
              "MQTT device IDs must be safe single topic segments");
static_assert(DeviceConfig::mqttCredentialsPaired("", "") && !DeviceConfig::mqttCredentialsPaired("user", ""),
              "MQTT credentials must be absent or configured as a pair");
static_assert(DeviceConfig::mqttTlsConfigured(true, "trusted-ca", "user", "password") &&
              !DeviceConfig::mqttTlsConfigured(true, "", "user", "password"),
              "MQTT TLS requires a trusted CA and broker credentials");
static_assert(DeviceConfig::mqttHostConfigured("mqtt.aquasense.internal") &&
              !DeviceConfig::mqttHostConfigured("replace-with-private-mqtt-host"),
              "Secure MQTT mode requires a configured broker host");
