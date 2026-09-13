# Wiring and existing contracts

## Modular water-monitor target

The newly supplied ORP/LCD/DS3231 program uses GPIO35 pH, GPIO34 turbidity,
GPIO32 ORP, GPIO4 DS18B20 and GPIO21/22 shared I2C. LCD is 0x27, 16x2.
It publishes a single JSON snapshot on `water/esp32/readings` with device ID,
temperature, pH, raw ADC turbidity and nullable signed ORP in mV.
See [its complete source/wiring map](water-monitor-migration.md), including
the diagram's GPIO19 servo versus the standalone feeder's GPIO13.
Servo uses GPIO19 and buzzer GPIO18. Relay input signals are GPIO25/26/27;
load mapping and active polarity remain unconfirmed, so relay initialization
is disabled. Loads connect to relay output terminals, powered by their appropriate
supplies; the relay module uses separate 5 V and shares ground with ESP32.
Channel four is unused. There are no float switches.
See [backend/control setup](backend-control.md) for authenticated commands,
timed pump limits, feeding and RTC/NTP behavior.

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

## Four-sensor MQTT

Default broker is `broker.hivemq.com:1883`. Configuration retains:

- Readings: `capstone2026/water/esp32/readings`.
- Status: `capstone2026/water/esp32/status`.
- JSON reading fields: `temperature`, `ph`, `do`, `turbidity`, `location`, `uptimeMs`.
- Restart subscription: `capstone2026/water/commands/restart`.
- Existing threshold-update subscription is retained but has no handler.

The backend's code default for JSON readings is `water/esp32/readings`; an existing
environment variable can override it. Set the firmware's `MQTT_TOPIC_READINGS` to
the backend's **actual** configured topic and point it to the same broker. This
migration does not change backend configuration. The original restart callback
and subscriptions remain in `main.cpp`; review them when changing topic namespaces.

The analog formulas are the original calibration estimates. Configure the scale
and offset values in `config.h` using reference measurements; compilation does
not establish measurement accuracy. The original four-sensor code reports some
disconnected sensors as 0 or -1; verify backend handling during board checks.

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
