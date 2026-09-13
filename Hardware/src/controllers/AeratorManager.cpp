#include "AeratorManager.h"
#include "config/ActuatorConfig.h"
#include "config/DeviceConfig.h"
#include "config/Thresholds.h"

const char* AeratorManager::setManual(bool on) {
    automatic = false;
    return relays.setAerator(on) ? "accepted" : "relays_not_configured";
}
const char* AeratorManager::setAutomatic() {
    if (!relays.isReady() || !ActuatorConfig::AERATOR_POLICY_CONFIGURED ||
        Thresholds::AERATOR_TEMPERATURE_OFF_C >= Thresholds::AERATOR_TEMPERATURE_ON_C) return "aerator_policy_not_configured";
    automatic = true; return "accepted";
}
void AeratorManager::update(const SensorReadings& readings, uint32_t nowMs) {
    if (!automatic) return;
    // Fail-safe aeration on invalid/stale temperature; ORP is never used as DO.
    if (!readings.temperatureValid || readings.sequence < ActuatorConfig::SENSOR_SETTLE_SAMPLES ||
        uint32_t(nowMs - readings.sampledAtMs) > DeviceConfig::TELEMETRY_MAX_AGE_MS) { relays.setAerator(true); return; }
    if (readings.temperatureC >= Thresholds::AERATOR_TEMPERATURE_ON_C) relays.setAerator(true);
    else if (readings.temperatureC <= Thresholds::AERATOR_TEMPERATURE_OFF_C) relays.setAerator(false);
}
