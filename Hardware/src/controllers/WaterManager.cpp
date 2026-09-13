#include "WaterManager.h"
#include "ControlSafety.h"
#include "config/ActuatorConfig.h"
#include "config/DeviceConfig.h"
#include "config/Thresholds.h"

bool WaterManager::policyReady() const {
    return ActuatorConfig::WATER_POLICY_CONFIGURED && relays.isReady() &&
        ControlSafety::durationAllowed(ActuatorConfig::AUTO_DRAIN_MS, ActuatorConfig::PUMP_MAX_RUN_MS) &&
        ControlSafety::durationAllowed(ActuatorConfig::AUTO_FILL_MS, ActuatorConfig::PUMP_MAX_RUN_MS) &&
        ActuatorConfig::AUTO_COOLDOWN_MS > 0 && Thresholds::WATER_PH_LOW < Thresholds::WATER_PH_HIGH &&
        Thresholds::WATER_ORP_LOW_MV < Thresholds::WATER_ORP_HIGH_MV && Thresholds::WATER_TURBIDITY_RAW_HIGH > 0;
}
const char* WaterManager::setAutomatic(bool enabled) {
    if (enabled && !policyReady()) return "automation_not_configured";
    stop(); automatic = enabled; return "accepted";
}
void WaterManager::stop() {
    relays.setPumps(false, false); exchange = false;
    if (phase != Phase::Fault) phase = Phase::Idle;
}
void WaterManager::fail(const char* reason) {
    stop(); automatic = false; phase = Phase::Fault; faultText = reason;
}
const char* WaterManager::clearFault() {
    if (relays.fillOn() || relays.drainOn()) return "pumps_not_stopped";
    phase = Phase::Idle; faultText = ""; return "accepted";
}
const char* WaterManager::request(CommandAction action, uint32_t durationMs, uint32_t nowMs) {
    if (action == CommandAction::WaterStop) { automatic = false; stop(); return "accepted"; }
    if (phase == Phase::Fault) return "fault_latched";
    if (!relays.isReady()) return "relays_not_configured";
    if (!ControlSafety::durationAllowed(durationMs, ActuatorConfig::PUMP_MAX_RUN_MS)) return "unsafe_duration";
    if (action != CommandAction::Fill && action != CommandAction::Drain && action != CommandAction::WaterExchange) return "invalid_action";
    if (automatic) stop(); // A valid manual command overrides automatic operation.
    if (phase == Phase::Draining || phase == Phase::Refilling) return "water_busy";
    automatic = false;
    exchange = action == CommandAction::WaterExchange;
    const bool filling = action == CommandAction::Fill;
    if (!filling && action != CommandAction::Drain && !exchange) return "invalid_action";
    if (!relays.setPumps(filling, !filling)) return "relay_interlock";
    phase = filling ? Phase::Refilling : Phase::Draining;
    startedMs = nowMs; runMs = durationMs; fillMs = durationMs;
    return "accepted";
}
void WaterManager::update(const SensorReadings& readings, uint32_t nowMs) {
    if (phase == Phase::Draining || phase == Phase::Refilling) {
        if (!relays.isReady() || !ControlSafety::pumpCombination(relays.fillOn(), relays.drainOn())) { fail("relay_interlock"); return; }
        if (ControlSafety::elapsed(nowMs, startedMs, ActuatorConfig::PUMP_MAX_RUN_MS)) { fail("pump_timeout"); return; }
        if (ControlSafety::elapsed(nowMs, startedMs, runMs)) {
            relays.setPumps(false, false);
            if (phase == Phase::Draining && exchange) {
                phase = Phase::Refilling; exchange = false; startedMs = nowMs; runMs = fillMs;
                relays.setPumps(true, false);
            } else { phase = Phase::Complete; lastCycleMs = nowMs; completedCycle = true; }
        }
        return;
    }
    if (!automatic || phase == Phase::Fault || !policyReady()) return;
    if (completedCycle && !ControlSafety::elapsed(nowMs, lastCycleMs, ActuatorConfig::AUTO_COOLDOWN_MS)) return;
    if (readings.sequence < ActuatorConfig::SENSOR_SETTLE_SAMPLES ||
        uint32_t(nowMs - readings.sampledAtMs) > DeviceConfig::TELEMETRY_MAX_AGE_MS ||
        !readings.phValid || !readings.turbidityValid || !readings.orpValid) return;
    const bool critical = readings.ph < Thresholds::WATER_PH_LOW || readings.ph > Thresholds::WATER_PH_HIGH ||
        readings.turbidityRaw > Thresholds::WATER_TURBIDITY_RAW_HIGH ||
        readings.orpMv < Thresholds::WATER_ORP_LOW_MV || readings.orpMv > Thresholds::WATER_ORP_HIGH_MV;
    if (critical) {
        request(CommandAction::WaterExchange, ActuatorConfig::AUTO_DRAIN_MS, nowMs);
        fillMs = ActuatorConfig::AUTO_FILL_MS; automatic = true;
    }
}
const char* WaterManager::phaseName() const {
    switch (phase) {
        case Phase::Draining: return "DRAINING";
        case Phase::Refilling: return "REFILLING";
        case Phase::Complete: return "COMPLETE";
        case Phase::Fault: return "FAULT";
        default: return "IDLE";
    }
}
