# AquaSense hardware

ESP32 Arduino firmware built with PlatformIO in VS Code. The integrated
`water-monitor` handles sensors, LCD, DS3231, servo feeder, buzzer and relay
control. The supplied wiring diagram maps relay IN1/IN2/IN3 to GPIO25/26/27 for
fill, drain and aerator; GPIO33 connects to unused IN4. Relay control remains
disabled by a closed commissioning gate. Firmware polarity is configured
active-LOW from the reported module intent, but physical trigger behavior,
channel mapping and safe OFF behavior remain unverified.

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
    water-quality/            Preserved JSON sketch; pH is diagnostic-only,
                              turbidity is raw ADC, and DO is not acquired
    water-quality-legacy/     Preserved three-sensor firmware
  lib/                        Future independently reusable project libraries
  test/                       Compile-time checks and acceptance guide
  reference/                  Sanitized original Arduino sketch
  docs/                       Wiring, migration, backend contract and deployment
```

`BackendDeviceClient` provides authenticated schedule sync and state heartbeat.
Backend authorizes commands and publishes signed, non-retained MQTT messages;
`MqttManager` validates them and publishes correlated state acknowledgements.
Hardware owns local interlocks/deadlines. Bounded queues pass snapshots between
workers and main.

## Targets and build

| Environment | Purpose | Configuration |
| --- | --- | --- |
| `water-monitor` | Integrated ORP monitoring and hardware control | `include/config/`, `include/secrets/` |
| `feeder` | Original HTTP/NTP servo feeder | `src/feeder/` |
| `water-quality` | JSON telemetry: temperature, raw turbidity and raw pH diagnostic; no DO | `src/water-quality/` |
| `water-quality-legacy` | Original temperature/pH/raw turbidity | `src/water-quality-legacy/` |

Open/add Hardware in PlatformIO IDE for VS Code. Run from the repository root:

```powershell
pio run -d Hardware -e water-monitor
pio run -d Hardware
pio device list
```

Upload one target per board. Do not run standalone and integrated feeders with
the same backend device ID. Integrated and standalone servo signal use GPIO13.
Board baseline is classic `esp32dev` with 4 MB flash; confirm the actual module.

Existing credentials remain in ignored `include/secrets/Secrets.h`. Fresh clone:

```powershell
if (-not (Test-Path Hardware/include/secrets/Secrets.h)) {
    Copy-Item Hardware/include/secrets/Secrets.example.h Hardware/include/secrets/Secrets.h
}
```

Per-install backend URL, device identity, and trusted CA belong in the ignored
`include/config/device_config.local.h`. Copy
`include/config/device_config.local.example.h` as a starting point. Placeholder
or loopback backend URLs, an empty CA, and placeholder device IDs keep backend
control disabled. The actual host, TLS port, CA, device key, and active backend
registration must be supplied for the ESP32's network; this repository does not
guess or provision them.

MQTT TLS/authentication and device-scoped topic migration are documented in
[`docs/mqtt-security.md`](docs/mqtt-security.md). The secure build target is
opt-in and requires local broker trust and credentials.

- Secrets.h: WiFi/MQTT credentials and backend DEVICE_KEY.
- DeviceConfig.h: safe defaults and network behavior; local endpoint/ID/CA overrides are in `device_config.local.h`.
- Pins.h: diagram-backed relay signal assignments and sensor GPIOs.
- ActuatorConfig.h: tested polarity, measured pump limits, servo/buzzer behavior and automation gates.
- CalibrationConfig.h: pH/ORP conversions and smoothing.
- Thresholds.h: plausibility limits and inactive automation placeholders.

Empty device keys disable backend control. Placeholder builds compile but are not
ready for operating hardware. Follow [backend commissioning](docs/backend-control.md).

## Behavior

The integrated water-monitor uses configured per-sensor ADC connection windows
and conversion settings. It reports pH, temperature, a configured turbidity
estimate labelled **NTU**, and signed **ORP mV**; ORP does not replace dissolved
oxygen. The analog conversions have not been physically verified. It sends
retained per-sensor MQTT values and connection states under `aquasense/`, with
turbidity on `aquasense/turbidity-ntu` so the backend keeps NTU separate from
legacy raw ADC. Validate the supplied coefficients against reference solutions
and the actual analog front ends before relying on readings.

Its LCD flow shows a block-progress welcome screen, Wi-Fi and MQTT connection
progress, then continuously displays four sensor readings on a 20x4 module at
0x27. It does not rotate to an actuator/network status page. An earlier wiring
diagram labels a 16x2 module, so verify the installed display dimensions.

Pump timing, mutual-exclusion and local deadline logic exists, but pump runs are
currently inhibited: relay outputs are gated off and configured run limits are
zero. The software active-LOW setting is not electrical verification. Physical
reset/OFF bias and the reported K3 refill/K4 drain assignment must be checked
against the board before changing GPIO roles. There is no
JSN-SR04T, float-switch, or inferred level measurement; water exchange is timed,
not level-confirmed. Automatic water exchange and temperature-based aeration
remain disabled until their policies and hardware are commissioned.

Before calibration or relay commissioning, physically isolate the feeder
mechanism and disconnect the pump and aerator loads from the relay contacts;
software inhibition does not isolate attached hardware. With loads isolated,
measure the relay output/contact state at power-on and after reset, including
boot and restart transitions, and verify that each load output remains OFF.
Do not reconnect a load until its channel mapping, inactive level, and reset
behavior have been measured and recorded. The offline calibration firmware
drives relay signal GPIOs to their configured inactive level but does not
replace this physical OFF/reset verification.

Feeding supports existing manual commands and up to 20 enabled user schedules.
The servo closes at startup, manual ON is limited to ten seconds, and NVS stores
schedules and duplicate-prevention records. Scheduling requires valid NTP or a
previously synchronized battery-backed RTC. Missed minutes are not caught up.
LCD shows a block-progress welcome screen, connection progress, then sensor
readings only. The buzzer is held OFF at startup and only alarms on fresh,
valid readings outside configured sensor alarm bounds. Its alarm thresholds
are uncommissioned and disabled by default.

Existing water-change, aerator and feeding controls use authenticated Backend
APIs and display backend/device state. A queued command remains pending until a
device acknowledgement arrives; logical state is not electrical or flow feedback.

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
