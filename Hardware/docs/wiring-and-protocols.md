# Wiring and existing contracts

## Modular water-monitor target

The integrated target uses pH GPIO35, turbidity GPIO34, ORP GPIO32, DS18B20
GPIO4 and shared I2C SDA/SCL GPIO21/22. The current monitor source is configured
for a 20x4 LCD at address 0x27, as in the attached code. The earlier wiring
diagram labels a 16x2 LCD; verify the physical panel before deployment. Both use
the same I2C wiring, but only four-row hardware can show the full sensor page.
The supplied wiring reference sets
the integrated servo to GPIO13 (older integrated code used GPIO19) and passive
buzzer to GPIO18.

The diagram routes GPIO25, GPIO26, GPIO27 and GPIO33 to relay IN1..IN4 in order.
IN1 drives pump 1 (fill), IN2 drives pump 2 (drain), IN3 drives the aerator, and
IN4 is unused. The code maps the first three signals accordingly. Relay polarity
is not marked in the diagram, so `RELAY_ACTIVE_LEVEL` remains unknown and relay
initialization stays disabled until the actual board's trigger level and OFF
behavior are measured. The relay module has a separate 5 V supply and shares
ground with ESP32. Verify the module's input bias holds the relay OFF while ESP32
GPIOs are high-impedance during reset; firmware cannot drive outputs during reset.
There are no float switches.

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

## Preserved four-sensor JSON target

Default broker is `broker.hivemq.com:1883`. Configuration retains:

- Readings: `capstone2026/water/esp32/readings`.
- Status: `capstone2026/water/esp32/status`.
- JSON fields: `temperature`, `ph`, `do`, `turbidity`, `location`, `uptimeMs`.

This target is isolated from the modular water-monitor. It subscribes to no
command topics. Its analog pH, DO and turbidity output remains null until its
calibration gate is enabled in source; its temperature channel reports null when
the DS18B20 is disconnected.

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
