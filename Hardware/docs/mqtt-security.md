# MQTT security and staged device isolation

## Active `water-monitor` contract

The compatibility defaults remain the existing protocol until a coordinated
broker migration is approved: public plaintext MQTT on port 1883, retained
scalar telemetry under `aquasense/<parameter>`, and a signed, non-retained
command on `aquasense/<deviceId>/command`. Signed acknowledgments remain on
`aquasense/<deviceId>/state`. The default is suitable only for local development
and is not private or authenticated.

The opt-in secure contract uses TLS with certificate verification and unique
broker credentials per ESP32. Telemetry remains scalar and keeps the same values
and units, but topics become:

```text
aquasense/<deviceId>/telemetry/<parameter>
aquasense/<deviceId>/telemetry/<parameter>/status
aquasense/<deviceId>/command
aquasense/<deviceId>/state
```

The topic ID, not the payload's `deviceId`, attributes scoped sensor messages.
Backend ingestion also requires that ID to have a configured device key and an
active device registration. Backend mode subscribes only to scoped telemetry
and signed state topics, so it does not ingest both old and new topics during
migration. Assemblies are independent per ID and capped; disconnect clears
partial assemblies. Retained telemetry replays are ignored by the backend.

## Configure a device

1. Copy `include/config/device_config.local.example.h` to the ignored
   `include/config/device_config.local.h`.
2. Set its MQTT host, TLS port, trusted PEM root CA, registered device ID, and
   `AQUASENSE_MQTT_TLS=1`, `AQUASENSE_MQTT_DEVICE_SCOPED_TOPICS=1`.
3. Set that device's unique MQTT username/password in ignored
   `include/secrets/Secrets.h`. Keep the backend HTTP `DEVICE_KEY` separate.
4. Build with `pio run -d Hardware -e water-monitor-secure`. The release target
   refuses plaintext or non-scoped topic configuration and fails compilation
   when TLS trust or broker credentials are missing. This command only builds;
   it does not upload firmware.

The ordinary `water-monitor` target retains the previous development contract
when the local migration settings are absent. Do not switch a deployed device
until its broker account and ACL are ready and the backend has been configured
for scoped mode.

## Configure the backend

Set these values in the deployment environment (do not commit them):

```text
MQTT_BROKER_URL=mqtts://<private-broker-host>:8883
MQTT_USERNAME=<backend-service-identity>
MQTT_PASSWORD=<backend-service-secret>
MQTT_CA_CERT=<optional-PEM-CA-for-private-certificate>
MQTT_DEVICE_SCOPED_TOPICS=true
```

If the broker certificate chains to a CA trusted by Node, `MQTT_CA_CERT` may be
omitted. Production configuration rejects plaintext MQTT, missing backend
credentials, URL-embedded credentials, or disabled device-scoped topics.
Credentials are never included in broker URLs or logged.

## Broker ACL policy

Provision a separate broker principal for every device and a distinct principal
for the backend. Apply these least-privilege rules; the broker provider is not
selected in this repository, so no provider-specific ACL files are included.

| Principal | Publish | Subscribe |
| --- | --- | --- |
| Device A | `aquasense/<A>/telemetry/#`, `aquasense/<A>/state` | `aquasense/<A>/command` |
| Device B | `aquasense/<B>/telemetry/#`, `aquasense/<B>/state` | `aquasense/<B>/command` |
| Backend | backend status topic and `aquasense/+/command` | `aquasense/+/telemetry/+`, `aquasense/+/state` |

Do not grant a device wildcard access to another device's namespace. Where the
broker supports it, disallow retained publishes on command topics. Backend
commands are QoS 1 and explicitly non-retained; firmware verifies HMAC, device
ID, expiry, and a persistent command-ID deduplication ring before dispatch.
Never weaken those checks. Firmware uses PubSubClient, whose callback does not
expose the MQTT retained bit; broker policy and signed expiry/deduplication are
therefore both required.

## Staged migration and verification

1. Select a broker provider and provision TLS, unique credentials, and the ACLs
   above. Test that invalid credentials fail and the certificate is verified.
2. Prepare the scoped firmware configuration for every deployed device and set
   backend TLS/auth with `MQTT_DEVICE_SCOPED_TOPICS=true`. In this mode the
   backend intentionally stops subscribing to legacy flat topics. Schedule a
   coordinated cutover or maintenance window; do not switch only the backend or
   only a subset of devices if uninterrupted ingestion is required.
3. Test two devices with interleaved telemetry, cross-device publish/subscribe
   denial, retained packet replay, reconnect subscription restoration, and a
   signed command/ack round-trip in an isolated broker.
4. During the cutover, start the backend in scoped mode and move all devices to
   their prepared secure settings. Verify broker logs show each principal only
   its own publish/subscribe filters and the backend receives both devices.
5. Keep the old source defaults for rollback until acceptance. Do not run both
   legacy and scoped telemetry ingestion in production: legacy flat topics have
   no authenticated topic identity and cannot provide multi-device isolation.
   Remove the legacy broker ACL only after rollback is no longer needed.

Mocks and builds verify application behavior only. They do not prove broker TLS,
authentication, ACL enforcement, or physical device communication.
