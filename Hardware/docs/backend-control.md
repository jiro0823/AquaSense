# Backend connection and commissioning

The integrated `water-monitor` publishes its sensor telemetry on MQTT. Actuator
commands are sent only after authenticated API authorization, then delivered by
signed, device-scoped MQTT. The device publishes a signed acknowledgement and
logical output state. Authenticated HTTPS device sync is used for schedule
delivery and state heartbeat; it does not deliver or acknowledge actuator
commands.

## Connect

<<<<<<< HEAD
1. Register and activate the device through the existing device API. Match its
   ID to `DeviceConfig::DEVICE_ID`; use a unique ID per board.
2. Configure Backend's private `DEVICE_KEYS` entry and the same key in the
   ignored firmware `include/secrets/Secrets.h`. Do not commit either secret.
3. Configure a reachable `BACKEND_API_BASE_URL` ending in `/api/v1`. Production
   requires HTTPS with a trusted root certificate in `DeviceConfig.h`; LAN
   development may use HTTP, which does not encrypt the device key.
4. Point firmware and Backend at the same broker. Sensor topics are retained
   under `aquasense/`; actuator commands are non-retained. The current public
   plaintext broker is for development only. HMAC authenticates protocol data,
   but does not provide confidentiality or protect sensor telemetry in transit.
5. Rebuild/restart Backend with the existing workflow. No live database
   migration or device upload was performed in this task.
6. Commission with relay loads disconnected from power. The diagram-backed pin
   assignments are present, but the firmware keeps relay control disabled until
   active polarity, reset bias, OFF state and safe pump runtime limits are
   physically established. See `wiring-and-protocols.md`.
=======
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
>>>>>>> origin/feature/major-improvements

## API and MQTT contract

User routes use the existing JWT/session authentication, farmer/admin role and
device ownership checks. Cookie-authenticated POST requests also require the
existing CSRF cookie/header pair.

| Method/topic | Direction | Purpose |
| --- | --- | --- |
| `POST /api/v1/hardware/commands` | Frontend → Backend | Validate and queue water/aerator/buzzer actions |
| `POST /api/v1/feeding/commands` | Frontend → Backend | Validate and queue manual feeder actions |
| `GET /api/v1/hardware/state?deviceId=...` | Frontend → Backend | Read latest device state and command history |
| `POST /api/v1/hardware/device/sync` | Device → Backend HTTPS | Schedule delivery and state heartbeat only |
| `aquasense/{deviceId}/command` | Backend → ESP32 MQTT | Signed command, QoS 1, always non-retained |
| `aquasense/{deviceId}/state` | ESP32 → Backend MQTT | Signed acknowledgement plus resulting logical state, QoS 1, non-retained |
| Existing `aquasense/...` sensor topics | ESP32 → Backend MQTT | Retained readings and sensor connection state |

Command JSON fields are `v`, `deviceId`, `id` (UUID), `source` (`hardware` or
`feeding`), `action`, `durationMs`, `expiresAt` (UTC epoch milliseconds), and
`signature`. HMAC-SHA256 signs the canonical UTF-8 string:
`v1|deviceId|id|source|action|durationMs|expiresAt`.

State/ack JSON fields are `v`, `deviceId`, `id`, `source`, `action`, `result`,
`reportedAt`, `state`, and `signature`. State contains `fillPump`, `drainPump`,
`aerator`, `feederBusy`, `buzzer`, `automation`, `waterPhase`, `fault`,
`relaysReady`, `timeValid`, `wifiConnected`, `mqttConnected`, and `uptimeMs`.
Backend verifies the signature, registered device, command ID/action/source and
topic device ID before marking a command acknowledged and updating state.

The API returns HTTP 202 with `PENDING` after successful queue/publish. That is
command acceptance, not actuation confirmation. The UI can distinguish pending,
device acknowledgement/rejection and stale/offline state. An `accepted` device
result means accepted by firmware logic; it does not prove electrical relay
operation or water flow. State is the firmware's logical output state.

Backend republishes pending command records every five seconds until an ACK or
expiry. Commands expire after two minutes. Firmware validates HMAC, device ID,
UUID, source/action, expiry and configured RTC/system time; malformed, expired,
unauthenticated or unsupported commands are not actuated. It deduplicates IDs
in non-volatile storage before dispatch. Feeding commands and other one-shot
actions are not retained. The firmware MQTT library callback does not expose the
MQTT RETAIN flag, so non-retained publication, clean-session reconnect behavior,
expiry and durable ID deduplication are the protection layers; a broker-side
retained-command misconfiguration should still be prevented.

## Actions and precedence

| Action | Behavior |
| --- | --- |
<<<<<<< HEAD
| `FILL`, `DRAIN` | Timed single-pump operation; positive `durationMs` required |
| `WATER_EXCHANGE` | Drain, explicit all-off transition, then refill; each stage is bounded |
| `WATER_STOP` | Stop exchange, disable its automation, cancel pending water starts |
| `AERATOR_ON`, `AERATOR_OFF` | Manual aerator command; disables aerator automatic mode |
| `AERATOR_AUTO` | Enable configured temperature hysteresis policy |
| `AUTOMATION_ON`, `AUTOMATION_OFF` | Enable/disable the single firmware water automation controller |
| `BUZZER_ON`, `BUZZER_OFF` | Manual buzzer control is disabled; buzzer is reserved for configured sensor alarms |
| `TRIGGER`, `ON`, `OFF` | Existing manual feeder actions through the correlated MQTT command path |
| `ALL_OFF` | Stop outputs and cancel queued commands on device receipt |
| `CLEAR_FAULT` | Clear a stopped water fault; does not re-enable automation |

Valid manual water command interrupts and disables water automation. A running
manual exchange cannot be displaced by another start command; send STOP first.
The firmware enforces mutual exclusion and an OFF update boundary before
switching pumps. STOP is processed through the same authenticated MQTT path and
depends on network/broker delivery; it is not a physical emergency stop. A
local maximum-runtime timeout is independent of network availability.
=======
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
>>>>>>> origin/feature/major-improvements

Pump `durationMs` is a positive integer up to 60,000 ms per phase. The API,
dashboard and firmware enforce the same initial 60-second cap. The firmware
stops each pump at its requested duration and has an independent local hard
deadline; reaching the 60-second maximum turns that pump off. Change the named
limits in `ActuatorConfig.h`, the API cap and dashboard validation together only
after supervised flow-rate calibration. These are initial limits, not proof that
60 seconds is safe for every tank. Relay operation remains disabled while its
trigger polarity is unknown. Loss of Wi-Fi or MQTT stops relay-controlled loads;
rejected commands also force those outputs off. The MCU cannot control relay
inputs while held in reset, so verify the module's hardware OFF bias before
connecting pump power.

Automatic water exchange is disabled until `AUTO_DRAIN_MS`, `AUTO_FILL_MS`,
`AUTO_COOLDOWN_MS`, thresholds and `WATER_POLICY_CONFIGURED` are set. It requires
fresh, valid settled pH, turbidity and ORP sensor data. ORP is not dissolved
oxygen. Aerator automation is separately configured; it uses temperature only
and must not be interpreted as oxygen measurement.

## Feeding and RTC

<<<<<<< HEAD
The existing user-wide feeding schedule API is preserved. Schedules and
last-fired minute records are persisted in NVS, and a previously synchronized
DS3231 can schedule feeds while Internet/MQTT are unavailable. RTC is not reset
to build time. `lostPower`, validity metadata or invalid time inhibit scheduled
feeding until valid network time synchronizes the RTC. Missed minutes are
skipped; one schedule occurrence can trigger only once, including across reset
or a backward clock adjustment. Manual feeding is correlated through MQTT and
is never replayed from a retained command.

Schedules are currently user-wide, not device-scoped. Multiple feeders for one
user therefore share them; per-device schedule ownership would require a
separate data model change.
=======
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
>>>>>>> origin/feature/major-improvements

## Telemetry scope

The integrated device reports pH, temperature, turbidity and signed ORP under
existing `aquasense/` topics. Turbidity uses the distinct `turbidity-ntu` suffix;
legacy raw ADC remains separate. Invalid/disconnected sensor values are not
fabricated. Existing missing-DO compatibility storage remains explicitly
unmeasured. No physical flow/level feedback, live device upload, database
migration or hardware-in-the-loop test was performed.
