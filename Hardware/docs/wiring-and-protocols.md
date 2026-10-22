# Wiring and existing contracts

## Modular water-monitor target

The integrated target uses pH GPIO35, turbidity GPIO34, ORP GPIO32, DS18B20
GPIO4 and shared I2C SDA/SCL GPIO21/22. The current monitor source is configured
for a 20x4 LCD at address 0x27, as in the attached code. The earlier wiring
diagram labels a 16x2 LCD; verify the physical panel before deployment. Both use
the same I2C wiring, but only four-row hardware can show the full sensor page.
The integrated logical actuator GPIO assignments are refill GPIO26, drain GPIO27,
aerator GPIO25, servo GPIO18, and passive buzzer GPIO19. These are GPIO signal
assignments only: the source does not establish which physical relay IN terminal
controls K3 or K4. The user-reported physical load assignments are K3 refill and
K4 drain. No standalone wiring diagram file is present in this repository to
verify the module's IN-to-K channel wiring. Before commissioning, trace which
input is wired to GPIO26 and GPIO27, then identify which inputs switch K3 and K4
with loads isolated. The intended physical paths are GPIO26 to the input that
switches K3/refill and GPIO27 to the input that switches K4/drain. If those do
not match, correct the physical signal leads; keep the firmware's logical GPIO
roles unchanged. GPIO25 is reserved for the disconnected aerator; GPIO33 is not
assigned by this firmware.

Firmware relay polarity is active-LOW; the output commissioning gate defaults
off and pump timing defaults zero. Optional per-install macros in the ignored
`config/device_config.local.h` can set the gate and measured pump durations;
do not set them until supervised electrical checks and runtime measurements are
complete. The relay module has a separate 5 V supply and shares ground with the
ESP32. Verify input bias holds relays OFF while GPIOs are high-impedance during
reset; firmware cannot drive outputs during reset. There are no float switches.

Sensors publish retained values/status under `aquasense/`; actuator commands
use signed, non-retained, device-scoped MQTT messages after authenticated API
authorization. Device state/ack messages are signed and correlated by command
ID. Authenticated HTTP sync remains for schedules and state heartbeat. See
[backend/control setup](backend-control.md) for the contract and commissioning.

## Preserved earlier targets

All pin numbers below are GPIO numbers. They preserve the original code's values.
Check the actual circuit and board pin labels before flashing.

| Signal | Feeder | Four-sensor water | Three-sensor legacy |
| --- | --- | --- | --- |
| Servo signal | 13 | — | — |
| DS18B20 data | — | 4 | 4 |
| pH analog input | — | 34 | 35 |
| Dissolved oxygen analog input | — | 35 | Not installed |
| Turbidity analog input | — | 36 | 34 |

Use an appropriate servo supply with common ground. Keep sensor analog outputs
within the board's permitted input voltage; a 5 V powered sensor module may need
signal conditioning. Check the DS18B20 module's pull-up requirements. Confirm
sensor-specific wiring against its manufacturer's documentation.

## Feeder

- Local configuration: WiFi, `API_BASE_URL`, `DEVICE_ID`, `DEVICE_KEY`.
- POST `<API_BASE_URL>/feeding/device/sync` with `{ "deviceId": "..." }`.
- POST `<API_BASE_URL>/feeding/device/ack` with `deviceId`, `commandId`, `result`.
- Both requests carry `x-device-key`; match the existing backend device setup.
- Response uses `data.schedules` and `data.pendingCommand`; actions are `TRIGGER`,
  `ON`, and `OFF`.
- Sync interval is 30 seconds; schedules use Philippines UTC+8 time from NTP.
- The original cycle is 25 degrees / 800 ms, 140 degrees / 1000 ms, then
  25 degrees / 800 ms. Startup sets the servo to the off position.

## Preserved water-quality JSON target

Default broker is `broker.hivemq.com:1883`. Configuration retains:

- Readings: `capstone2026/water/esp32/readings`.
- Status: `capstone2026/water/esp32/status`.
- JSON includes `temperature`, `ph`, `turbidity`, `turbidityUnit`, device/frame
  identity and sensor diagnostics. It does not publish a DO measurement.

This target is isolated from the modular water-monitor. It subscribes to no
command topics. It reports pH as null and includes raw pH ADC only as a
diagnostic; turbidity is explicitly `raw_adc`. Temperature reports null when
the DS18B20 is disconnected. The current sketch does not acquire DO or apply a
calibration conversion to pH or turbidity.

The backend's default JSON subscription is `water/esp32/readings`; configure
`MQTT_TOPIC_READINGS` to match this target's actual topic and use the same broker.
The modular water-monitor instead publishes per-sensor values under
`aquasense/`, uses a device-ID-derived MQTT client ID, and receives authenticated
actuator commands through MQTT. Its registered `DEVICE_ID` must be unique per board.

## Three-sensor MQTT

Default broker is `broker.hivemq.com:1883`; topics are configurable in the local
header and default to `aquasense/temperature`, `aquasense/ph`, and
`aquasense/turbidity`. Each payload is a numeric string. The existing backend has
an `aquasense/+` ingestion path. Broker settings still must match.

Temperature is smoothed, pH uses the original voltage estimate, and turbidity is
a smoothed **raw ADC value**, not calibrated NTU. No dissolved-oxygen value is
published by this firmware. Keep these semantics in mind when selecting it.

Assign a unique MQTT client ID to every simultaneous board connection. Keep topic
names aligned with the existing backend subscriptions; adding multiple tanks also
requires a deliberate backend routing/data-model design beyond this migration.
