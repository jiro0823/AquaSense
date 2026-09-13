# AquaSense hardware

ESP32 Arduino firmware built with PlatformIO in VS Code. The integrated
`water-monitor` handles sensors, LCD, DS3231, servo feeder, buzzer and three
relay-controlled loads. Relay polarity and load mapping remain unconfirmed:
relay GPIOs are uninitialized by default.

## Layout

```text
Hardware/
  platformio.ini              Isolated targets and pinned libraries
  include/
    config/                   Pins, network settings, calibration, thresholds,
                              actuator timing and commissioning gates
    models/                   SensorReadings, SystemState, Command, FeedingSchedule
    secrets/                  Secrets.example.h and ignored Secrets.h
  src/
    main.cpp                  Composition and cooperative update loop
    sensors/                  SensorManager, SensorConversions
    actuators/                RelayController, FeedingManager, BuzzerManager
    controllers/              WaterManager, AeratorManager, SystemController
    communication/            WifiManager, MqttManager, BackendDeviceClient
    display/                  LcdManager
    services/                 TimeManager (NTP + DS3231)
    feeder/                   Preserved standalone feeder
    water-quality/            Preserved DO firmware
    water-quality-legacy/     Preserved three-sensor firmware
  lib/                        Future independently reusable project libraries
  test/                       Compile-time checks and acceptance guide
  reference/                  Sanitized original Arduino sketch
  docs/                       Wiring, migration, backend contract and deployment
```

`BackendDeviceClient` combines hardware and existing feeding sync in one worker.
Hardware owns local interlocks/deadlines; Backend owns authenticated command
queuing and reported state. Bounded queues pass snapshots between workers and main.

## Targets and build

| Environment | Purpose | Configuration |
| --- | --- | --- |
| `water-monitor` | Integrated ORP monitoring and hardware control | `include/config/`, `include/secrets/` |
| `feeder` | Original HTTP/NTP servo feeder | `src/feeder/` |
| `water-quality` | Original temperature/pH/DO/turbidity JSON | `src/water-quality/` |
| `water-quality-legacy` | Original temperature/pH/raw turbidity | `src/water-quality-legacy/` |

Open/add Hardware in PlatformIO IDE for VS Code. Run from the repository root:

```powershell
pio run -d Hardware -e water-monitor
pio run -d Hardware
pio device list
```

Upload one target per board. Do not run standalone and integrated feeders with
the same backend device ID. Integrated servo uses GPIO19; standalone retains13.
Board baseline is classic `esp32dev` with 4 MB flash; confirm the actual module.

Existing credentials remain in ignored `include/secrets/Secrets.h`. Fresh clone:

```powershell
if (-not (Test-Path Hardware/include/secrets/Secrets.h)) {
    Copy-Item Hardware/include/secrets/Secrets.example.h Hardware/include/secrets/Secrets.h
}
```

- Secrets.h: WiFi/MQTT credentials and backend DEVICE_KEY.
- DeviceConfig.h: device ID, API URL, HTTPS root CA, unique MQTT client ID, broker/topic and timing.
- Pins.h: GPIOs; relay load assignments remain -1.
- ActuatorConfig.h: tested polarity, measured pump limits, servo/buzzer behavior and automation gates.
- CalibrationConfig.h: pH/ORP conversions and smoothing.
- Thresholds.h: plausibility limits and inactive automation placeholders.

Empty device keys disable backend control. Placeholder builds compile but are not
ready for operating hardware. Follow [backend commissioning](docs/backend-control.md).

## Behavior

Sensors retain the Arduino equations and zero-seeded 0.7/0.3 smoothing. Turbidity
is **raw ADC**, ORP is signed **mV**, and ORP does not replace dissolved oxygen.
MQTT sends one JSON acquisition on `water/esp32/readings`; Backend now includes
nullable ORP in storage, readings, statistics and WebSocket data.

Pump runs are timed, mutually exclusive and bounded by a local hard deadline.
There are **no float switches or inferred level measurements**. Automatic water
exchange and temperature-based aeration require policy setup and runtime enable
commands; both start disabled after reboot.

Feeding supports existing manual commands and up to 20 enabled user schedules.
The servo closes at startup, manual ON is limited to ten seconds, and NVS stores
schedules and duplicate-prevention records. Scheduling requires valid NTP or a
previously synchronized battery-backed RTC. Missed minutes are not caught up.
LCD welcomes the user with "Welcome! / AquaSense" for three seconds at startup,
then shows readings, alternating active output state, and latched water faults;
the buzzer also indicates latched water faults.

Frontend was not changed. Its existing simulated water-change controls do not
automatically call the new hardware API. Use the documented API for commissioning.

## Dependencies

Espressif32 **6.10.0** supplies Arduino ESP32 **2.0.17**, WiFi, HTTPClient,
WiFiClientSecure, Wire, Preferences, SNTP and FreeRTOS.

| Library | Version | Purpose |
| --- | --- | --- |
| PubSubClient | 2.8 | MQTT |
| OneWire | 2.3.8 | DS18B20 bus |
| DallasTemperature | 3.11.0 | Temperature |
| LiquidCrystal_I2C (marcoschwartz) | 1.1.4 | LCD |
| Adafruit RTClib | 2.1.4 | DS3231 |
| Adafruit BusIO | 1.16.1 | RTClib dependency |
| ArduinoJson | 6.21.5 | JSON protocols |
| ESP32Servo | 1.1.2 | Servo; official tagged archive |

Generated files/libraries are ignored. Optionally reuse this machine's cache:

```powershell
$env:PLATFORMIO_CORE_DIR = (Resolve-Path Hardware/.pio-core).Path
```

If pio is unavailable, use PlatformIO's terminal or
`& "$env:USERPROFILE/.platformio/penv/Scripts/platformio.exe"`.

If VS Code shows include-path errors when AquaSense is open as the workspace,
run `Hardware/scripts/configure_intellisense.py` using PlatformIO's Python.
See [ESP32 IntelliSense setup](docs/vscode-intellisense.md) for the exact command
and how to refresh after dependency changes.

Read [migration](docs/water-monitor-migration.md),
[wiring](docs/wiring-and-protocols.md), [deployment](docs/deployment.md) and
[tests](test/README.md).
