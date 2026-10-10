#include "WaterManager.h"
#include "ControlSafety.h"
#include "config/ActuatorConfig.h"
#include "config/DeviceConfig.h"
#include "config/Thresholds.h"
#include <cstring>

bool WaterManager::policyReady() const {
    return ActuatorConfig::WATER_POLICY_CONFIGURED && relays.isReady() &&
        ControlSafety::durationAllowed(ActuatorConfig::AUTO_DRAIN_MS, ActuatorConfig::MAX_DRAIN_RUNTIME_MS) &&
        ControlSafety::durationAllowed(ActuatorConfig::AUTO_FILL_MS, ActuatorConfig::MAX_REFILL_RUNTIME_MS) &&
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
const char* WaterManager::request(CommandAction action, uint32_t durationMs, uint32_t nowMs, uint32_t exchangeFillDurationMs) {
    if (action == CommandAction::WaterStop) { automatic = false; stop(); return "accepted"; }
    if (phase == Phase::Fault) return "fault_latched";
    if (!relays.isReady()) return "relays_not_configured";
    if (action != CommandAction::Fill && action != CommandAction::Drain && action != CommandAction::WaterExchange) return "invalid_action";
    const bool needsFill = action == CommandAction::Fill || action == CommandAction::WaterExchange;
    const bool needsDrain = action == CommandAction::Drain || action == CommandAction::WaterExchange;
    const uint32_t drainDuration = durationMs;
    const uint32_t fillDuration = action == CommandAction::WaterExchange && exchangeFillDurationMs > 0
        ? exchangeFillDurationMs : durationMs;
    if ((needsDrain && !ControlSafety::durationAllowed(drainDuration, ActuatorConfig::MAX_DRAIN_RUNTIME_MS)) ||
        (needsFill && !ControlSafety::durationAllowed(fillDuration, ActuatorConfig::MAX_REFILL_RUNTIME_MS))) return "unsafe_duration";
    if (automatic) stop(); // A valid manual command overrides automatic operation.
    if (phase == Phase::Draining || phase == Phase::Refilling) return "water_busy";
    automatic = false;
    exchange = action == CommandAction::WaterExchange;
    const bool filling = action == CommandAction::Fill;
    if (!filling && action != CommandAction::Drain && !exchange) return "invalid_action";
    if (!relays.setPumps(filling, !filling)) return "relay_interlock";
    phase = filling ? Phase::Refilling : Phase::Draining;
    startedMs = nowMs; runMs = filling ? fillDuration : drainDuration; fillMs = fillDuration;
    return "accepted";
}
void WaterManager::update(const SensorReadings& readings, uint32_t nowMs) {
    if (phase == Phase::Transition) {
        // A full update/loop boundary with both pump outputs off is the transition dead time.
        if (!relays.setPumps(false, false) || !relays.setPumps(true, false)) { fail("refill_start_failed"); return; }
        phase = Phase::Refilling; startedMs = nowMs; runMs = fillMs;
        return;
    }
    if (phase == Phase::Draining || phase == Phase::Refilling) {
        if (!relays.isReady() || !ControlSafety::pumpCombination(relays.fillOn(), relays.drainOn())) { fail("relay_interlock"); return; }
        const uint32_t hardLimit = phase == Phase::Draining ? ActuatorConfig::MAX_DRAIN_RUNTIME_MS : ActuatorConfig::MAX_REFILL_RUNTIME_MS;
        if (hardLimit == 0 || hardLimit > 300000) { fail("pump_timeout"); return; }
        if (ControlSafety::elapsed(nowMs, startedMs, runMs)) {
            relays.setPumps(false, false);
            if (phase == Phase::Draining && exchange) {
                phase = Phase::Transition; exchange = false;
            } else { phase = Phase::Complete; lastCycleMs = nowMs; completedCycle = true; }
        } else if (ControlSafety::elapsed(nowMs, startedMs, hardLimit)) {
            fail("pump_timeout");
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
        const char* result = request(CommandAction::WaterExchange, ActuatorConfig::AUTO_DRAIN_MS,
                                     nowMs, ActuatorConfig::AUTO_FILL_MS);
        if (!strcmp(result, "accepted")) automatic = true;
    }
}
const char* WaterManager::phaseName() const {
    switch (phase) {
        case Phase::Draining: return "DRAINING";
        case Phase::Transition: return "TRANSITION";
        case Phase::Refilling: return "REFILLING";
        case Phase::Complete: return "COMPLETE";
        case Phase::Fault: return "FAULT";
        default: return "IDLE";
    }
}
