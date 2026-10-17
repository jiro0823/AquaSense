# SensorManager host runtime harness

This standalone executable compiles the production `src/sensors/SensorManager.cpp`
against local Arduino, ADC, OneWire, and DallasTemperature shims. It does not
include or call telemetry clients, controllers, relays, pumps, feeders, or servos.

From the repository root, run with a host C++17 compiler:

```sh
g++ -std=c++17 -Wall -Wextra -Werror \
  -I Hardware/test/sensor_manager_host/shims \
  -I Hardware/include -I Hardware/src \
  Hardware/src/sensors/SensorManager.cpp \
  Hardware/test/sensor_manager_host/main.cpp \
  -o sensor_manager_host_test
./sensor_manager_host_test
```

The fake analog values exercise the actual acquisition phases and conversion
calls but are software test inputs, not calibration references. The harness
covers complete valid samples, analog acquisition and converted-value
invalidity, temperature invalidity, debounced disconnection, recovery, and
atomic publication. Per-sensor diagnostic stale checks call the production
`SensorHealth::fresh` helper. The whole-snapshot stale predicate mirrors the
age comparison in `WaterManager`; it does not execute that production
controller, and controller and MQTT implementations are intentionally not
linked into this isolated executable. Timing is advanced by supplying explicit
monotonic millisecond values to `SensorManager::update`.
