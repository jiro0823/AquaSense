# Backend connection and commissioning

Integrated water-monitor uses MQTT for sensor snapshots and HTTP(S) for
authenticated commands, feeding schedules and reported state. It accepts no
public MQTT actuator commands.

## Connect

1. Register the device to the intended farmer/admin through existing
   POST /api/v1/devices (deviceId, name). Confirm it is active. Match
   DeviceConfig::DEVICE_ID. Only one board may consume that ID.
2. Configure Backend's private environment variable:
   DEVICE_KEYS=esp32-feeder-1:YOUR_RANDOM_DEVICE_KEY.
   Multiple entries are comma-separated deviceId:key pairs; keys cannot contain
   commas or colons. Match ignored Secrets::DEVICE_KEY.
3. Set BACKEND_API_BASE_URL to the server's reachable HTTPS host and actual port,
   ending /api/v1. The committed URL is an invalid placeholder and intentionally
   cannot connect. ESP32 localhost is not the backend computer. Confirm LAN
   binding, firewall access, and that the configured certificate covers this host.
4. HTTPS with certificate verification is the default and requires the trusted
   PEM root certificate in DeviceConfig::BACKEND_ROOT_CA as a C++ raw string.
   Certificate verification is mandatory and needs valid system time. Plain HTTP
   is disabled by default. For isolated local development only, HTTP requires a
   non-release build explicitly compiled with both
   `AQUASENSE_DEVELOPMENT_BUILD` and `AQUASENSE_ALLOW_INSECURE_HTTP`; it is also
   disabled when `NDEBUG` or `AQUASENSE_PRODUCTION_BUILD` is defined. Defining
   the production and insecure-HTTP flags together is a compile error. Do not
   enable this development opt-in for deployment: HTTP exposes the device key.
   If the URL, CA, or transport policy is invalid, backend control remains
   disconnected.
5. Match broker credentials/topic with Backend MQTT_TOPIC_READINGS. Integrated
   default is water/esp32/readings. The retained public plaintext broker is for
   development; deployment needs private authenticated transport and a separate
   telemetry-security review.
6. Rebuild/restart Backend using its existing workflow. Startup adds nullable
   sensor_readings.orp and creates hardware_commands/hardware_device_states via
   existing model initialization and non-destructive sync. No live database
   migration or server restart was performed in this task.
7. Build/upload following [deployment](deployment.md). Verify telemetry/state with
   relay loads disconnected from power before commissioning.

Frontend is unchanged. Existing feeding endpoints are reused; water-change UI
controls still simulate operation and need a later API hookup. Use this API for
hardware commissioning.

## Contract

All paths start /api/v1. User endpoints require existing JWT/session authentication,
farmer/admin role and ownership of an active device. Cookie-authenticated POSTs
also need the existing CSRF cookie/header pair.

| Method/path | Purpose |
| --- | --- |
| POST /hardware/commands | Queue {deviceId, action, durationMs?} |
| GET /hardware/state?deviceId=... | Last report, freshness, last 20 commands |
| POST /hardware/device/sync | ESP32 {deviceId, state, receipt?}, x-device-key header |

Device sync requires a configured matching key even in development. Response:
{success:true,data:{command,schedules,timezone,serverTimeIso}}.
Command is null or {id,source,action,durationMs,ttlMs}; source hardware or feeding.
Receipt is {id,source,result}. State has booleans fillPump, drainPump, aerator,
feederBusy, buzzer, automation, relaysReady, timeValid, wifiConnected, mqttConnected,
plus waterPhase, fault and uptimeMs.

Firmware waits five seconds between sync attempts; lost-response receipts retry.
Commands expire two minutes after queuing, including feeding commands through
this new endpoint. Firmware verifies TTL and persists the last handled ID before
starting work. Reset after recording but before execution may skip an action
rather than replay it. Preserved standalone feeder semantics are unchanged.

PENDING means queued. ACKED means handled: inspect result for accepted,
relays_not_configured, unsafe_duration, water_busy, fault_latched, expired,
duplicate_suppressed or another rejection. Accepted is **not completion**.
Check subsequent waterPhase and state. These are software output states, not
flow/electrical feedback. online becomes false after 20 seconds without a report.

## Actions

| Action | Behavior |
| --- | --- |
| FILL, DRAIN | Timed single-pump run; durationMs required and bounded by that pump's configured target and hard maximum |
| WATER_EXCHANGE | Uses configured drain target, settling interval, then configured fill target; API durationMs remains required for contract compatibility but does not set either phase |
| WATER_STOP | Stop water, disable its automation, cancel pending hardware work |
| AERATOR_ON, AERATOR_OFF | Manual relay operation; exits aerator automatic mode |
| AERATOR_AUTO | Enable commissioned temperature hysteresis |
| AUTOMATION_ON, AUTOMATION_OFF | Enable/disable commissioned water exchange policy |
| BUZZER_ON, BUZZER_OFF | Manual pattern; latched water-fault alarm has priority |
| ALL_OFF | Cancel waiting hardware/feeding work and stop active outputs on receipt |
| CLEAR_FAULT | Clear stopped water fault; does not re-enable automation |

API pump durations are positive integers up to 300,000 ms. FILL and DRAIN also
require a configured per-pump target and hard maximum; a requested duration may
shorten the target but cannot exceed it. WATER_EXCHANGE requires durationMs at
the API boundary for compatibility, while firmware uses independently
configured drain and fill targets. Other actions reject durationMs. Stop commands bypass a full hardware queue. Remote stop depends on
connectivity/poll latency and is not a physical emergency-stop circuit.
ALL_OFF leaves a fault and its alarm latched; future scheduled feeds resume in
later minutes unless backend schedules are disabled.

Example body after commissioning (1000 ms is illustrative, not calibrated):
```json
{"deviceId":"esp32-feeder-1","action":"FILL","durationMs":1000}
```

## Relay and pump commissioning

Assign each Pins::*_RELAY_GPIO to a distinct verified GPIO25/26/27. Set
ActuatorConfig::RELAY_ACTIVE_LEVEL to measured active level 0 or1. Until then no
relay pin is configured as output. High-impedance pins do not establish a known
OFF voltage for an unknown module: keep loads unpowered and verify input bias,
reset behavior and OFF state physically. Fourth channel is spare; separate
5 V module supply shares ESP32 ground.

There are no float switches: this is **timed water exchange**, not measured or
precise automatic water-level control. Configure these values only after flow
testing on the installed pumps, tubing, head height and source conditions:

- `DRAIN_TARGET_RUNTIME_MS` and `DRAIN_MAX_RUNTIME_MS`
- `FILL_TARGET_RUNTIME_MS` and `FILL_MAX_RUNTIME_MS`
- `WATER_EXCHANGE_SETTLING_MS` and `PUMP_COOLDOWN_MS`

All are milliseconds. Target must be positive and strictly less than its pump's
hard maximum; maximum is limited to five minutes. Defaults are zero, so pump
requests fail closed until commissioning. Fill and drain cannot run together.
Each pump has a local nonblocking hard timeout; timeout turns it off and latches
a fault. Duplicate starts do not restart a running timer. A manual stop cancels
the sequence immediately and starts cooldown. During exchange the reported
phases are `DRAINING`, `SETTLING_AFTER_DRAIN`, `REFILLING`, then `COOLDOWN`.
Local timers continue during network loss; no cloud connection is needed to
enforce pump limits. Fault recovery requires an explicit clear command.

### Fill and drain flow calibration

Calibrate the fill and drain pumps separately using the actual installation;
do not copy pump nameplate flow or use one pump's result for the other.

1. Keep relay loads safely isolated while verifying wiring, then test each pump
   with its installed hose length, vertical head, fittings, and actual water
   source/reservoir conditions.
2. Prepare a measured collection volume for the fill test and a measured source
   volume for the drain test. Confirm the destination can safely accept the
   transferred water.
3. Run one pump for a measured interval, then measure the actual volume moved.
   Repeat each pump test 3–5 times under the same installation conditions.
4. For every trial calculate `flow rate = transferred volume / elapsed time`.
   Use consistent units and select a representative rate only after reviewing
   trial variation; investigate unstable results before commissioning.
5. For the intended exchange volume calculate each pump independently:
   `target runtime = intended volume / that pump's measured flow rate`.
   Use the measured installed fill rate for fill and drain rate for drain.
6. Determine the maximum safe run time from physical hazard limits (such as
   source depletion, overflow, or loss of required water), then set each hard
   maximum above its target but below that hazard duration. The firmware also
   rejects maximum values over 300,000 ms. Never use the maximum as the normal
   target.
7. Record the installation, tested pump, hose/head/source conditions, units,
   each trial's volume and elapsed time, calculated rates, chosen intended
   volume, per-pump target and hard maximum, settling interval, cooldown, date,
   and responsible operator.
8. Enter the separately reviewed values in `DRAIN_TARGET_RUNTIME_MS`,
   `DRAIN_MAX_RUNTIME_MS`, `FILL_TARGET_RUNTIME_MS`, and
   `FILL_MAX_RUNTIME_MS`. Set settling and cooldown only after defining the
   operating procedure. Keep all values at zero until physical calibration and
   safety review are complete.

These timers estimate transferred volume; they do not sense water level or
guarantee an exact final volume. Recalibrate after changing pumps, tubing,
vertical height, fittings, water source, or installation conditions. No
production runtime values are supplied here.

Automatic timed water exchange also requires the commissioned per-pump target
and hard-maximum runtimes, settling and cooldown, meaningful
pH/raw-turbidity/ORP thresholds and
WATER_POLICY_CONFIGURED=true, followed by AUTOMATION_ON. It waits for ten samples
and fresh valid pH/turbidity/ORP, then exchanges on out-of-range data. A valid
manual run interrupts automatic operation and leaves it disabled.

Aerator automation is optional temperature control, not oxygen inference. Set
ON above OFF thresholds and AERATOR_POLICY_CONFIGURED=true before AERATOR_AUTO.
Once enabled it turns on for invalid/stale/unsettled temperature. Manual operation
does not need that policy, but does require confirmed relay configuration.

## Feeding and time

Existing feeding API commands TRIGGER, ON, OFF arrive through combined sync.
GPIO19 servo starts closed at25 degrees, opens to140, and preserves the original
800/1000/800 ms cycle. ON closes after ten seconds. OFF/ALL_OFF suppress scheduled
feeding for the current minute.

Schedules remain the existing **user-wide** list, up to20 enabled entries; they
are not device-scoped. Multiple feeders for one user require a later scheduling
extension. Schedules and last-fired minutes persist in NVS; cached schedules
continue through backend outages. Disable schedules while online and confirm
sync before intentionally suspending offline feeding.

NTP/system time and DS3231 use UTC; dates and HH:mm use Asia/Manila UTC+8.
RTC lost power or unmarked legacy clock contents inhibit schedules until NTP
succeeds. Missed minutes are skipped; stored last-fired records prevent repeats
after resets/backward clock shifts.

## Telemetry scope

JSON fields: deviceId, temperature, ph, turbidity, nullable orp,
turbidityUnit:"raw_adc", uptimeMs, sequence. MQTT publishes are non-retained.
Missing DO uses Backend's existing placeholder storage with doMeasured=false.
ORP is nullable in PostgreSQL, API readings/statistics and realtime data.
Legacy aquasense/orp numeric ingestion has a15-second freshness window, but
scalar topics cannot correlate device/acquisition as the integrated JSON does.

Existing turbidity display/alert rules do not consume turbidityUnit or convert
ADC to NTU. Existing global water dashboards are not per-device telemetry views.
This change does not add fleet routing, NTU calibration, ORP UI widgets, OTA or
physical flow/level feedback.
