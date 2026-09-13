# Integrated Arduino migration

The sanitized supplied sketch remains in reference/arduino-water-monitor/ outside
source filters. Earlier standalone targets retain their original behavior.
The integrated target follows the requested layout with a system coordinator
and a combined backend client instead of separate hardware/feeding HTTP workers.

## Ownership

| Responsibility | Owner |
| --- | --- |
| GPIO assignments | include/config/Pins.h |
| Conversion and smoothing | CalibrationConfig.h, SensorConversions.h |
| Polarity, run limits, policy gates | ActuatorConfig.h |
| Plausibility and automation limits | Thresholds.h |
| Network identity, timing, API URL and CA | DeviceConfig.h |
| Credentials | Ignored include/secrets/Secrets.h |
| Completed acquisition and validity | SensorReadings.h, SensorManager |
| Reported output/clock/connectivity state | SystemState.h |
| Typed commands and schedules | Command.h, FeedingSchedule.h |
| Relay writes and fill/drain interlock | RelayController |
| Timed drain/refill, cooldown and fault latch | WaterManager |
| Manual and optional temperature-based aeration | AeratorManager |
| Servo motion and durable schedules | FeedingManager |
| Passive buzzer pattern | BuzzerManager |
| Command expiry, deduplication and dispatch | SystemController |
| WiFi retry | WifiManager |
| JSON telemetry worker | MqttManager |
| Authenticated hardware/feeding sync worker | BackendDeviceClient |
| Display only | LcdManager |
| NTP, DS3231 UTC storage and UTC+8 presentation | TimeManager |
| Composition/update scheduling | src/main.cpp |

## Wiring

| Signal | GPIO/address |
| --- | --- |
| pH analog | 35 |
| Turbidity analog | 34 |
| ORP analog | 32 |
| DS18B20 data | 4 |
| I2C SDA / SCL | 21 / 22 |
| LCD | 0x27, 16x2 |
| RTC | DS3231 |
| Servo | 19; standalone feeder remains 13 |
| Buzzer | 18 |
| Three relay input signals | 25, 26, 27 |

Loads connect to relay output terminals; ESP32 signals control module inputs only.
The module has a separate 5 V supply and common ground. Channel four is spare.
Load mapping and active LOW/HIGH cannot be established from supply voltage.
Both remain unconfigured. The user removed float switches; no float logic exists.

## Behavior changes

- Sensor, servo and control updates use elapsed time. Synchronous MQTT and HTTP(S)
  execute in separate workers. Bounded queues pass copies; main owns outputs/I2C.
- Ten-sample ADC averaging, acquisition order, five-second post-acquisition pause,
  conversions and zero-seeded 0.7/0.3 smoothing are retained.
- MQTT now publishes one coherent JSON snapshot with device identity and ORP.
  Invalid required temperature/pH/turbidity suppresses the whole publish;
  invalid ORP alone is null. Earlier scalar-topic targets remain unchanged.
- Backend persists signed nullable ORP and returns it in readings/statistics and
  realtime data. Missing/historical ORP never becomes a fabricated zero.
- NTP writes verified UTC to DS3231. Only RTC contents marked with this convention
  and without lost-power status can seed time after reboot. No build-date clock.
- Servo retains 25/140 degrees and 800/1000/800 ms cycling. Indefinite ON is capped
  at ten seconds. NVS records commands/scheduled feeds before actuator movement.
- LCD alternates active outputs with sensor values; a water fault takes priority.
  Manual buzzer OFF does not silence a latched water fault.

Turbidity is raw ADC, not NTU. The existing backend/dashboard turbidity alert
thresholds and labels do not convert these units. Confirm calibration and alert
interpretation before unattended use. ORP is not a dissolved-oxygen measurement.

## Runtime limits

Network stalls do not wait inside pump/servo updates. Library calls and NVS still
take finite time; this cooperative design is not a hard-real-time safety system.
Timers cannot detect overflow, dry running, stuck relays, actual flow or a stalled
processor. Reported state reflects commanded outputs, not electrical feedback.

See [backend commissioning](backend-control.md) and [verification](../test/README.md).
Compilation and mocked tests do not establish physical operation. No board was
uploaded or live database migrated during this work.
