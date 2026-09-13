# SMS Alert Evaluation

Generated: 2026-05-28

## Verification Result

The SMS alert system is implemented and now supports automatic SMS alerts from both ingestion paths:

- HTTP ESP32 ingestion: `POST /api/v1/sensors/data`
- MQTT ESP32 ingestion: `water/esp32/readings` and `aquasense/+`

I did not send a live SMS during verification to avoid unexpectedly messaging the farmer or consuming UniSMS quota. Code-level verification and unit tests passed.

## When SMS Sends Automatically

Rule-based SMS alerts are sent when water parameters produce:

- `CRITICAL`
- `EMERGENCY`

Examples:

- Dissolved oxygen below critical thresholds.
- pH critically low or high.
- Temperature critically high.
- Turbidity critically high.

Predictive SMS alerts are sent when the predictive model returns:

- `HIGH`
- `CRITICAL`

Both rule-based and predictive alerts use cooldown protection so the farmer is not spammed repeatedly for the same device/category.

## Required Configuration

Automatic SMS requires:

- `UNISMS_API_SECRET_KEY`
- `UNISMS_SENDER_ID`
- `FARMER_PHONE` in E.164 format, for example `+639171234567`
- `SMS_MAX_MESSAGE_LENGTH=160`
- Backend must be running with database models initialized.

If `FARMER_PHONE` is missing, alerts are still created but SMS is skipped and a warning is logged.

## Improvements Made

- Shortened SMS templates to fit the configured 160-character SMS limit.
- Added predictive SMS logging to `sms_logs`.
- Centralized alert/SMS automation in `waterAlertNotification.service.ts`.
- Reused the same SMS automation for HTTP and MQTT sensor ingestion.
- Added tests that verify normal and predictive SMS templates fit the 160-character limit.

## Verification Commands

Passed:

```powershell
npm.cmd run test:sms
npm.cmd run type-check
node scripts\security-check.mjs
```

SMS tests passed: 7/7.

## Production Notes

For a real live-send test, use the protected `POST /api/v1/sms/test` endpoint or send a controlled critical sensor payload from a registered device. Confirm the recipient first because the system will send to the configured farmer phone number.
