#include "WaterManager.h"
#include "ControlSafety.h"
#include "config/ActuatorConfig.h"
#include "config/DeviceConfig.h"
#include "config/Thresholds.h"

bool WaterManager::pumpTimingReady(bool filling) const {
    const uint32_t target = filling ? ActuatorConfig::FILL_TARGET_RUNTIME_MS : ActuatorConfig::DRAIN_TARGET_RUNTIME_MS;
    const uint32_t maximum = filling ? ActuatorConfig::FILL_MAX_RUNTIME_MS : ActuatorConfig::DRAIN_MAX_RUNTIME_MS;
    return ControlSafety::durationAllowed(target, maximum);
}

bool WaterManager::policyReady() const {
    return ActuatorConfig::WATER_POLICY_CONFIGURED && relays.isReady() &&
        pumpTimingReady(false) && pumpTimingReady(true) &&
        ActuatorConfig::PUMP_COOLDOWN_MS > 0 && ActuatorConfig::WATER_EXCHANGE_SETTLING_MS > 0 &&
        Thresholds::WATER_PH_LOW < Thresholds::WATER_PH_HIGH &&
        Thresholds::WATER_ORP_LOW_MV < Thresholds::WATER_ORP_HIGH_MV && Thresholds::WATER_TURBIDITY_RAW_HIGH > 0;
}

const char* WaterManager::setAutomatic(bool enabled, uint32_t nowMs) {
    if (enabled && !policyReady()) return "automation_not_configured";
    if (!enabled) stop(nowMs);
    automatic = enabled;
    return "accepted";
}

void WaterManager::enterCooldown(uint32_t nowMs) {
    phase = Phase::Cooldown;
    phaseMs = nowMs;
    lastPumpStopMs = nowMs;
    cooldownStarted = true;
    exchange = false;
    relays.setPumps(false, false);
}

void WaterManager::stop(uint32_t nowMs) {
    const bool wasActive = relays.fillOn() || relays.drainOn() || phase == Phase::Draining ||
        phase == Phase::SettlingAfterDrain || phase == Phase::Refilling;
    relays.setPumps(false, false);
    exchange = false;
    if (phase != Phase::Fault) {
        if (wasActive) enterCooldown(nowMs);
        else if (phase != Phase::Cooldown) phase = Phase::Idle;
    }
}

void WaterManager::fail(const char* reason, uint32_t nowMs) {
    relays.setPumps(false, false);
    exchange = false;
    automatic = false;
    phase = Phase::Fault;
    lastPumpStopMs = nowMs;
    cooldownStarted = true;
    faultText = reason;
}

const char* WaterManager::clearFault() {
    if (relays.fillOn() || relays.drainOn()) return "pumps_not_stopped";
    phase = Phase::Idle;
    faultText = "";
    return "accepted";
}

const char* WaterManager::request(CommandAction action, uint32_t durationMs, uint32_t nowMs) {
    if (action == CommandAction::WaterStop) { automatic = false; stop(nowMs); return "accepted"; }
    if (phase == Phase::Fault) return "fault_latched";
    if (action != CommandAction::Fill && action != CommandAction::Drain && action != CommandAction::WaterExchange)
        return "invalid_action";
    if (!relays.isReady()) return "relays_not_configured";
    if (phase == Phase::Draining || phase == Phase::SettlingAfterDrain || phase == Phase::Refilling)
        return "water_busy";
    if (phase == Phase::Cooldown || (cooldownStarted &&
        !ControlSafety::elapsed(nowMs, lastPumpStopMs, ActuatorConfig::PUMP_COOLDOWN_MS))) return "pump_cooldown";

    if (action == CommandAction::WaterExchange) {
        if (!pumpTimingReady(false) || !pumpTimingReady(true) ||
            ActuatorConfig::WATER_EXCHANGE_SETTLING_MS == 0 || ActuatorConfig::PUMP_COOLDOWN_MS == 0)
            return "water_timing_not_configured";
    } else {
        const bool filling = action == CommandAction::Fill;
        const uint32_t maxRun = filling ? ActuatorConfig::FILL_MAX_RUNTIME_MS : ActuatorConfig::DRAIN_MAX_RUNTIME_MS;
        const uint32_t target = filling ? ActuatorConfig::FILL_TARGET_RUNTIME_MS : ActuatorConfig::DRAIN_TARGET_RUNTIME_MS;
        if (!pumpTimingReady(filling) || ActuatorConfig::PUMP_COOLDOWN_MS == 0) return "water_timing_not_configured";
        // A manual request may shorten its configured target, never lengthen it.
        if (durationMs == 0 || durationMs > target || !ControlSafety::durationAllowed(durationMs, maxRun))
            return "unsafe_duration";
    }

    automatic = false;
    exchange = action == CommandAction::WaterExchange;
    const bool filling = action == CommandAction::Fill;
    runMs = exchange ? ActuatorConfig::DRAIN_TARGET_RUNTIME_MS : durationMs;
    maxRunMs = ActuatorConfig::DRAIN_MAX_RUNTIME_MS;
    if (filling) {
        runMs = durationMs;
        maxRunMs = ActuatorConfig::FILL_MAX_RUNTIME_MS;
    }
    if (!relays.setPumps(filling, !filling)) return "relay_interlock";
    phase = filling ? Phase::Refilling : Phase::Draining;
    startedMs = nowMs;
    return "accepted";
}

void WaterManager::update(const SensorReadings& readings, uint32_t nowMs) {
    if (phase == Phase::Cooldown) {
        if (ControlSafety::elapsed(nowMs, phaseMs, ActuatorConfig::PUMP_COOLDOWN_MS)) phase = Phase::Idle;
        else return;
    }

    if (phase == Phase::Draining || phase == Phase::Refilling) {
        if (!relays.isReady() || !ControlSafety::pumpCombination(relays.fillOn(), relays.drainOn())) {
            fail("relay_interlock", nowMs); return;
        }
        if (ControlSafety::elapsed(nowMs, startedMs, maxRunMs)) { fail("pump_timeout", nowMs); return; }
        if (ControlSafety::elapsed(nowMs, startedMs, runMs)) {
            relays.setPumps(false, false);
            if (phase == Phase::Draining && exchange) {
                phase = Phase::SettlingAfterDrain;
                phaseMs = nowMs;
            } else {
                enterCooldown(nowMs);
            }
        }
        return;
    }

    if (phase == Phase::SettlingAfterDrain) {
        if (relays.fillOn() || relays.drainOn()) { fail("relay_interlock", nowMs); return; }
        if (!ControlSafety::elapsed(nowMs, phaseMs, ActuatorConfig::WATER_EXCHANGE_SETTLING_MS)) return;
        if (!pumpTimingReady(true) || !relays.setPumps(true, false)) { fail("relay_interlock", nowMs); return; }
        phase = Phase::Refilling;
        startedMs = nowMs;
        runMs = ActuatorConfig::FILL_TARGET_RUNTIME_MS;
        maxRunMs = ActuatorConfig::FILL_MAX_RUNTIME_MS;
        exchange = true;
        return;
    }

    if (!automatic || phase == Phase::Fault || !policyReady()) return;
    if (cooldownStarted && !ControlSafety::elapsed(nowMs, lastPumpStopMs, ActuatorConfig::PUMP_COOLDOWN_MS)) return;
    if (readings.sequence < ActuatorConfig::SENSOR_SETTLE_SAMPLES ||
        uint32_t(nowMs - readings.sampledAtMs) > DeviceConfig::TELEMETRY_MAX_AGE_MS ||
        !readings.phValid || !readings.turbidityValid || !readings.orpValid) return;
    const bool critical = readings.ph < Thresholds::WATER_PH_LOW || readings.ph > Thresholds::WATER_PH_HIGH ||
        readings.turbidityRaw > Thresholds::WATER_TURBIDITY_RAW_HIGH ||
        readings.orpMv < Thresholds::WATER_ORP_LOW_MV || readings.orpMv > Thresholds::WATER_ORP_HIGH_MV;
    if (critical) {
        // A zero duration is intentional here: the exchange uses its independently
        // commissioned drain and fill targets, not a shared command duration.
        request(CommandAction::WaterExchange, 0, nowMs);
        automatic = true;
    }
}

const char* WaterManager::phaseName() const {
    switch (phase) {
        case Phase::Draining: return "DRAINING";
        case Phase::SettlingAfterDrain: return "SETTLING_AFTER_DRAIN";
        case Phase::Refilling: return "REFILLING";
        case Phase::Cooldown: return "COOLDOWN";
        case Phase::Fault: return "FAULT";
        default: return "IDLE";
    }
}
