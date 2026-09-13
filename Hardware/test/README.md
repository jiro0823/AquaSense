# Hardware and backend verification

## Automated checks

From the repository root:

```powershell
pio run -d Hardware
```

water-monitor includes compile_checks.cpp: pH/ORP reference conversions,
smoothing, invalid readings, wiring, unknown/duplicate relay configuration,
mutual pump exclusion, duration bounds and millis rollover.

From Backend:

```powershell
node node_modules/typescript/bin/tsc --noEmit
node --test -r ts-node/register src/services/hardware.test.ts src/services/sms.service.test.ts src/services/sms.delivery.test.ts
```

Backend tests use mocked database/services and a local ephemeral HTTP server.
They check command validation, stop priority, ownership, mandatory device keys,
inactive-device rejection, scoped/idempotent receipts, command expiry, schedule
limits, ORP sign/null semantics and MQTT persistence/realtime propagation.
Existing SMS regressions run with mocked providers; no real SMS is sent.

On 2026-09-12, all four PlatformIO targets compiled/linked and all 42 backend tests
passed. Integrated static RAM was 57,872 bytes (17.7%) and flash 839,125 bytes
(64.0%) with current configuration. Worker stacks/queues and TLS heap allocate at
runtime; measure headroom on a commissioned board. OneWire 2.3.8 emits existing
preprocessor warnings. Library code was not modified or warnings hidden.

Compile-time checks do not execute the actuator state machines on hardware.
No board upload, physical calibration or live database/backend integration was
performed. Follow the supervised checks below before operational deployment.

## Physical acceptance

1. Verify module/flash, signal voltages, grounding, LCD address and GPIOs against
   the diagram. With loads unpowered, establish relay input polarity, channel
   mapping, reset behavior and hardware OFF bias. The fourth channel is unused.
   Do not add float switches; this installation has none.
2. Compare stable known sensor inputs against the original sketch and reference
   solutions. Allow filters to settle. Confirm raw turbidity is not labeled or
   interpreted as calibrated NTU in operational alert decisions.
3. Subscribe to water/esp32/readings. Verify same-acquisition JSON, device ID,
   negative/zero ORP, null invalid ORP and Backend persistence/realtime values.
   Invalid required temperature/pH/turbidity suppresses the full publish.
4. Register and provision the backend device. Verify missing/wrong keys fail,
   state reports relaysReady=false before configuration, and pump requests are
   acknowledged with rejection instead of operation.
5. After confirmed pin/polarity/timing setup, test short fill and drain runs
   separately, stop, drain-to-refill transition, simultaneous-run rejection,
   busy rejection, maximum duration and latched fault/clear behavior. Measure
   actual flow and safe durations; there is no level/dry-run/overflow feedback.
6. Test aerator manual ON/OFF, buzzer ON/OFF and fault-alarm priority. Optional
   automatic policies remain disabled until calibrated limits are deliberately
   set; test hysteresis, stale sensors, settling, cooldown and manual overrides.
7. Test servo travel unloaded, one manual cycle, ten-second ON timeout, OFF and
   ALL_OFF. Verify exactly one scheduled cycle for a given occurrence after reboot
   and receipt loss. Confirm cached schedules operate during backend outage,
   and disabling schedules online reaches the device.
8. Test NTP failure, RTC absence/battery loss and valid UTC RTC reboot without
   WiFi. Invalid time must inhibit schedules. Missed minutes must not catch up.
9. During bounded supervised runs, interrupt WiFi/backend/broker separately.
   Confirm local pump/servo deadlines still act, stale pending commands expire,
   receipts retry without repeating physical work, and state eventually reports
   offline. A remote stop cannot substitute for local power isolation.
10. Soak-test sensor cadence, GPIO reset behavior, heap, worker stack headroom
    and network recovery. Record device ID, commit, board, calibration and measured
    results without credentials.
