# Build, upload and verify

## Integrated water-monitor

Follow [backend/device setup](backend-control.md) first. The example API address
and empty device key are placeholders. Logical actuator GPIO roles are configured
in source, but the physical relay input-to-K3/K4 wiring and active-LOW behavior
remain unverified. The relay output gate defaults off and pump target/max runtimes
and cooldown default to zero, so pump operation remains disabled. Do not enable
the gate or supply runtime values before supervised electrical checks and measured
flow/runtime limits.

## Local actuator commissioning settings

The gate is deliberate and local. Only after the user's approval for supervised
testing and physical OFF/polarity/channel checks, edit the ignored
`Hardware/include/config/device_config.local.h` (created from the example) with:

```cpp
#define AQUASENSE_RELAY_OUTPUTS_ENABLED 1
#define AQUASENSE_FILL_TARGET_RUNTIME_MS <measured-fill-ms>
#define AQUASENSE_FILL_MAX_RUNTIME_MS <measured-fill-limit-ms>
#define AQUASENSE_DRAIN_TARGET_RUNTIME_MS <measured-drain-ms>
#define AQUASENSE_DRAIN_MAX_RUNTIME_MS <measured-drain-limit-ms>
#define AQUASENSE_WATER_EXCHANGE_SETTLING_MS <measured-settle-ms>
#define AQUASENSE_PUMP_COOLDOWN_MS <measured-cooldown-ms>
```

Replace each placeholder with a positive measured integer; each target must be
strictly below its corresponding maximum, each maximum is at most 300,000 ms,
and settlement/cooldown must be positive for water exchange. The backend/UI
manual request cap is 60,000 ms. Keep `WATER_POLICY_CONFIGURED` false until its
separate policy requirements are commissioned. This repository change did not
create that local file or enable the gate.

From the repository root in a PlatformIO terminal:

```powershell
pio run -d Hardware
pio device list
pio run -d Hardware -e water-monitor -t upload --upload-port COM5
pio device monitor -d Hardware -e water-monitor --port COM5 --baud 115200
```

Replace COM5 with the verified port. Close an existing serial monitor before
upload. Confirm the board matches classic esp32dev with 4 MB flash. Keep relay
loads unpowered until polarity and reset/OFF state are measured and safe,
supervised timing limits are commissioned for the tank and pump flow.
The integrated servo signal is GPIO18; firmware does not attach or move it at
boot. A valid feed request attaches it and starts the configured cycle. Power the
MG996R from a suitable external supply and connect that supply ground to ESP32
ground; GPIO18 is signal only. Verify the servo signal and travel with the
mechanism unloaded before attaching food or moving parts.

Private credentials belong in include/secrets/Secrets.h, which replaces the whole
example header. Keep firmware binaries private too: credentials are compiled in.
Production HTTP control needs HTTPS, a trusted root CA and valid system time.
Match the actual server port/interface and MQTT broker/topic.

Follow [physical acceptance](../test/README.md). Startup creates Backend hardware
tables and adds nullable ORP through its existing schema workflow; this work did
not restart the running Backend or apply changes to its live database.

## Preserved targets

The environments feeder, water-quality and water-quality-legacy remain isolated.
Select the target matching actual wiring. Their private settings remain under
their own src directories as device_config.local.h.

```powershell
pio run -d Hardware -e water-quality-legacy -t upload --upload-port COM5
```

Standalone feeder also uses GPIO13, with blocking behavior, RAM-only scheduling and its
original command handling. It is a separate firmware target from the integrated feeder. Never run both
with the same backend device ID. Four-sensor DO and integrated ORP installations
have different analog pins and telemetry semantics: see [wiring](wiring-and-protocols.md).

## Repeatable builds and rollout

Pinned dependencies are installed by PlatformIO. Generated images are under
Hardware/.pio/build/<environment>/ and ignored. On this machine, the optional
workspace tool cache can be selected before building:

```powershell
$env:PLATFORMIO_CORE_DIR = (Resolve-Path Hardware/.pio-core).Path
```

Otherwise PlatformIO uses its normal user cache. If pio is not on PATH, use the
PlatformIO terminal or its executable under the user profile.

Build all four targets after shared configuration/library changes. Record commit,
environment, device ID, module, calibration and acceptance results per deployment.
Retain the prior known firmware/configuration for a controlled rollback; command
and schedule records persist in NVS, so rollback must account for cached state.
No OTA or automatic fleet rollout is introduced.

All four targets built successfully on 2026-09-12. See [test results](../test/README.md).
No upload or live physical integration test has been performed in this work.
