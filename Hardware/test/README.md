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

1. Verify the board/flash, signal voltages, grounding, LCD address and sensor GPIOs.
   With relay loads isolated, visually trace which module IN terminal receives
   GPIO26 and GPIO27; do not infer it from K numbering. Then, with explicit
   supervised-test approval, identify which input switches K3 and K4. The required
   physical paths are GPIO26 -> input switching K3/refill and GPIO27 -> input
   switching K4/drain. Correct the signal wiring if they do not match; keep the
   named firmware GPIO roles. GPIO25 is reserved for the disconnected aerator;
   GPIO33 is unassigned. This installation has no float switches.
2. Compare the supplied pH/ORP/turbidity conversions against reference solutions
   and confirm the actual analog front ends/dividers. Allow connection windows
   to settle and verify that turbidity and Backend both use NTU.
3. Subscribe to `aquasense/#`. Verify retained sensor values, `/status` topics,
   negative/zero signed ORP and Backend persistence/realtime values. Confirm
   `aquasense/turbidity-ntu` is stored as NTU, while legacy
   `aquasense/turbidity` remains raw ADC.
4. Register and provision the backend device. Verify missing/wrong keys fail,
   state reports relaysReady=false while the local commissioning gate is closed,
   and pump requests are rejected rather than activated.
5. After explicit approval plus verified pin/polarity/OFF behavior and measured
   timing values, enable the local gate and test short fill and drain runs
   separately, stop, drain-to-refill transition, simultaneous-run rejection,
   busy rejection, maximum duration and latched fault/clear behavior. Measure
   actual flow and safe durations; there is no level/dry-run/overflow feedback.
6. Do not operate the aerator until its hardware is connected and checked. Test
   buzzer ON/OFF and fault-alarm priority; manual buzzer tests stop after three
   seconds. Automatic sensor alarms remain configuration-gated. Do not alter
   calibration or water-quality thresholds as part of actuator acceptance.
7. Confirm the servo remains unattached and stationary at boot. Power the MG996R
   from a suitable external supply with common ground to the ESP32; never power
   it from a GPIO. Test signal/travel unloaded, a manual cycle,
   ten-second ON timeout, OFF and ALL_OFF. Verify one-time/daily schedules, the
   bounded busy retry window and reported schedule outcomes. Confirm cached
   schedules operate during backend outage and disabling schedules online reaches
   the device.
8. Test NTP failure, RTC absence/battery loss and valid UTC RTC reboot without
   WiFi. Invalid time must inhibit schedules. Missed minutes must not catch up.
9. During bounded supervised runs, interrupt WiFi/backend/broker separately.
   Confirm pumps and aerator go OFF on Wi-Fi/MQTT loss, local pump/servo deadlines still act, stale pending commands expire,
   receipts retry without repeating physical work, and state eventually reports
   offline. A remote stop cannot substitute for local power isolation.
10. Soak-test sensor cadence, GPIO reset behavior, heap, worker stack headroom
    and network recovery. Record device ID, commit, board, calibration and measured
    results without credentials.
