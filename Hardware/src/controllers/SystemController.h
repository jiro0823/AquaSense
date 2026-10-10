#pragma once
#include <Preferences.h>
#include "WaterManager.h"
#include "AeratorManager.h"
#include "actuators/FeedingManager.h"
#include "actuators/BuzzerManager.h"
#include "models/SystemState.h"

namespace {
constexpr uint8_t HANDLED_COMMAND_RING_SIZE = 32;
}

class SystemController {
public:
    SystemController(RelayController& r, WaterManager& w, AeratorManager& a, FeedingManager& f, BuzzerManager& b)
        : relays(r), water(w), aerator(a), feeder(f), buzzer(b) {}
    void begin();
    CommandReceipt handle(const Command& command, uint32_t nowMs);
    void update(const SensorReadings& readings, uint32_t nowMs);
    void stopRelayActuators();
    void report(SystemState& state) const;
private:
    const char* dispatch(const Command& command, uint32_t nowMs);
    bool hasHandled(const char* id) const;
    bool rememberHandled(const char* id);
    RelayController& relays;
    WaterManager& water;
    AeratorManager& aerator;
    FeedingManager& feeder;
    BuzzerManager& buzzer;
    Preferences storage;
    bool storageReady = false;
    char legacyLastId[37] = {};
    char handledIds[HANDLED_COMMAND_RING_SIZE][37] = {};
    uint8_t nextHandledSlot = 0;
};
