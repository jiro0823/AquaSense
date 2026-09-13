#pragma once
#include "actuators/RelayController.h"
#include "models/SensorReadings.h"
#include "models/Command.h"

class WaterManager {
public:
    explicit WaterManager(RelayController& outputs) : relays(outputs) {}
    const char* request(CommandAction action, uint32_t durationMs, uint32_t nowMs);
    void update(const SensorReadings& readings, uint32_t nowMs);
    void stop();
    const char* setAutomatic(bool enabled);
    const char* clearFault();
    bool isAutomatic() const { return automatic; }
    const char* phaseName() const;
    const char* fault() const { return faultText; }
private:
    enum class Phase { Idle, Draining, Refilling, Complete, Fault };
    void fail(const char* reason);
    bool policyReady() const;
    RelayController& relays;
    Phase phase = Phase::Idle;
    bool automatic = false, exchange = false;
    uint32_t startedMs = 0, runMs = 0, fillMs = 0, lastCycleMs = 0;
    bool completedCycle = false;
    const char* faultText = "";
};
