# SensorManager host runtime harness

This standalone executable compiles the production `src/sensors/SensorManager.cpp`
against local Arduino, ADC, OneWire, and DallasTemperature shims. It does not
include or call telemetry clients, controllers, relays, pumps, feeders, or servos.

From the repository root, run both profile variants with a host C++17 compiler:

```sh
g++ -std=c++17 -Wall -Wextra -Werror \
  -I Hardware/test/sensor_manager_host/shims \
  -I Hardware/include -I Hardware/src \
  Hardware/src/sensors/SensorManager.cpp \
  Hardware/test/sensor_manager_host/main.cpp \
  -o sensor_manager_host_normal
./sensor_manager_host_normal
g++ -std=c++17 -Wall -Wextra -Werror -DAQUASENSE_OFFLINE_CALIBRATION_MODE \
  -I Hardware/test/sensor_manager_host/shims \
  -I Hardware/include -I Hardware/src \
  Hardware/src/sensors/SensorManager.cpp \
  Hardware/test/sensor_manager_host/main.cpp \
  -o sensor_manager_host_calibration
./sensor_manager_host_calibration
```

The fake analog values exercise the actual acquisition phases and conversion
calls but are software test inputs, not calibration references. The normal
profile blocks pH, ORP, and turbidity validity while analog conversion remains
unverified. The offline calibration profile permits finite estimates for
display and preserves raw ADC and pin voltage diagnostics; that profile also
disables network and control services by configuration. The harness covers temperature invalidity,
debounced disconnection, recovery, and atomic publication. Per-sensor diagnostic stale checks call the production
`SensorHealth::fresh` helper. The whole-snapshot stale predicate mirrors the
age comparison in `WaterManager`; it does not execute that production
controller, and controller and MQTT implementations are intentionally not
linked into this isolated executable. Timing is advanced by supplying explicit
monotonic millisecond values to `SensorManager::update`.

The opt-in integrated, network-free firmware image is built with
`pio run -d Hardware -e water-monitor-calibration`. It samples sensors and
prints explicitly unverified analog estimates alongside raw ADC and voltage;
the main loop excludes WiFi, MQTT, backend control, commands, schedules, and
actuator initialization. It is not a production target and does not establish
physical calibration.
