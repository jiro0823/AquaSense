# Build, upload and verify

## Integrated water-monitor

Follow [backend/device setup](backend-control.md) first. The configuration still
contains an example API address, empty device key, diagram-backed relay load
assignments and unknown relay polarity. The initial per-pump hard caps are 60
seconds, but their suitability still needs supervised flow-rate calibration.
Unknown polarity keeps relay control disabled.

From the repository root in a PlatformIO terminal:

```powershell
pio run -d Hardware
pio device list
pio run -d Hardware -e water-monitor -t upload --upload-port COM5
pio device monitor -d Hardware -e water-monitor --port COM5 --baud 115200
```

Replace COM5 with the verified port. Close an existing serial monitor before
upload. Confirm the board matches classic esp32dev with 4 MB flash. Keep relay
loads unpowered until polarity and reset/OFF state are measured and the initial
60-second cap is confirmed suitable for the tank and pump flow.
The integrated servo initializes to its configured HOME position on GPIO13.

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
