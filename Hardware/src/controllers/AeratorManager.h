#pragma once
#include "actuators/RelayController.h"
#include "models/SensorReadings.h"

class AeratorManager {
public:
    explicit AeratorManager(RelayController& outputs) : relays(outputs) {}
    const char* setManual(bool on);
    const char* setAutomatic();
    void update(const SensorReadings& readings, uint32_t nowMs);
private:
    RelayController& relays;
    bool automatic = false;
};
