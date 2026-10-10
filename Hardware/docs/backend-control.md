# Backend connection and commissioning

The integrated `water-monitor` publishes its sensor telemetry on MQTT. Actuator
commands are sent only after authenticated API authorization, then delivered by
signed, device-scoped MQTT. The device publishes a signed acknowledgement and
logical output state. Authenticated HTTPS device sync is used for schedule
delivery and state heartbeat; it does not deliver or acknowledge actuator
commands.

## Connect

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

## Telemetry scope

The integrated device reports pH, temperature, turbidity and signed ORP under
existing `aquasense/` topics. Turbidity uses the distinct `turbidity-ntu` suffix;
legacy raw ADC remains separate. Invalid/disconnected sensor values are not
fabricated. Existing missing-DO compatibility storage remains explicitly
unmeasured. No physical flow/level feedback, live device upload, database
migration or hardware-in-the-loop test was performed.
