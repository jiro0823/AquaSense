#pragma once
#include "actuators/RelayController.h"
#include "models/SensorReadings.h"
#include "models/Command.h"

class WaterManager {
public:
    explicit WaterManager(RelayController& outputs) : relays(outputs) {}
    const char* request(CommandAction action, uint32_t durationMs, uint32_t nowMs, uint32_t exchangeFillDurationMs = 0);
    void update(const SensorReadings& readings, uint32_t nowMs);
    void stop(uint32_t nowMs);
    const char* setAutomatic(bool enabled, uint32_t nowMs);
    const char* clearFault();
    bool isAutomatic() const { return automatic; }
    const char* phaseName() const;
    const char* fault() const { return faultText; }
private:
<<<<<<< HEAD
    enum class Phase { Idle, Draining, Transition, Refilling, Complete, Fault };
    void fail(const char* reason);
=======
    enum class Phase { Idle, Draining, SettlingAfterDrain, Refilling, Cooldown, Fault };
    void fail(const char* reason, uint32_t nowMs);
>>>>>>> origin/feature/major-improvements
    bool policyReady() const;
    bool pumpTimingReady(bool filling) const;
    void enterCooldown(uint32_t nowMs);
    RelayController& relays;
    Phase phase = Phase::Idle;
    bool automatic = false, exchange = false;
    uint32_t startedMs = 0, runMs = 0, maxRunMs = 0, phaseMs = 0, lastPumpStopMs = 0;
    bool cooldownStarted = false;
    const char* faultText = "";
};
