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
3. Set BACKEND_API_BASE_URL to the server's reachable LAN address and actual port,
   ending /api/v1. The committed URL is a placeholder. ESP32 localhost is not the
   backend computer. Confirm LAN binding and firewall access.
4. Production Backend requires HTTPS. Use an https:// URL and put its trusted
   PEM root certificate in DeviceConfig::BACKEND_ROOT_CA as a C++ raw string.
   Certificate verification is mandatory and needs valid system time. Plain HTTP
   supports LAN development but does not encrypt the device key.
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
| FILL, DRAIN | Timed single-pump run; durationMs required |
| WATER_EXCHANGE | Drain then refill, each using requested durationMs |
| WATER_STOP | Stop water, disable its automation, cancel pending hardware work |
| AERATOR_ON, AERATOR_OFF | Manual relay operation; exits aerator automatic mode |
| AERATOR_AUTO | Enable commissioned temperature hysteresis |
| AUTOMATION_ON, AUTOMATION_OFF | Enable/disable commissioned water exchange policy |
| BUZZER_ON, BUZZER_OFF | Manual pattern; latched water-fault alarm has priority |
| ALL_OFF | Cancel waiting hardware/feeding work and stop active outputs on receipt |
| CLEAR_FAULT | Clear stopped water fault; does not re-enable automation |

API pump durations are positive integers up to 300,000 ms. Firmware additionally
requires them strictly below its commissioned hard limit. Other actions reject
durationMs. Stop commands bypass a full hardware queue. Remote stop depends on
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

There are no float switches. Set PUMP_MAX_RUN_MS from measured flow, tank capacity
and safe operating time. Keep requested durations below it. Fill/drain cannot run
together. Hard timeout stops both and latches a fault. Local timers continue
during network loss; accepted timed exchanges complete locally. Fault recovery
requires an explicit clear command.

Automatic water exchange also requires calibrated AUTO_DRAIN_MS, AUTO_FILL_MS,
AUTO_COOLDOWN_MS, meaningful pH/raw-turbidity/ORP thresholds and
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
