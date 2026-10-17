#include "RelayController.h"
#include <Arduino.h>
#include "config/ActuatorConfig.h"
#include "config/Pins.h"
#include "controllers/ControlSafety.h"

void RelayController::writeRelay(int pin, bool on) {
    digitalWrite(pin, ControlSafety::relayOutputLevel(on, ActuatorConfig::RELAY_ACTIVE_LEVEL));
}
void RelayController::begin() {
    const bool configurationValid = ControlSafety::relayConfiguration(Pins::FILL_RELAY_GPIO,
        Pins::DRAIN_RELAY_GPIO, Pins::AERATOR_RELAY_GPIO, ActuatorConfig::RELAY_ACTIVE_LEVEL);
    ready = ControlSafety::relayOutputsReady(configurationValid, ActuatorConfig::RELAY_OUTPUTS_ENABLED);
    if (!ready) { Serial.println("Relays disabled: commissioning gate is closed or configuration is invalid."); return; }
    for (int pin : {Pins::FILL_RELAY_GPIO, Pins::DRAIN_RELAY_GPIO, Pins::AERATOR_RELAY_GPIO}) {
        writeRelay(pin, false); // Set output latch to OFF before switching direction.
        pinMode(pin, OUTPUT);
    }
    allOff();
}
bool RelayController::setPumps(bool nextFill, bool nextDrain) {
    if (!ready || !ControlSafety::pumpCombination(nextFill, nextDrain)) return false;
    // Always break the previous circuit before energizing another pump.
    writeRelay(Pins::FILL_RELAY_GPIO, false);
    writeRelay(Pins::DRAIN_RELAY_GPIO, false);
    if (nextFill) writeRelay(Pins::FILL_RELAY_GPIO, true);
    if (nextDrain) writeRelay(Pins::DRAIN_RELAY_GPIO, true);
    fill = nextFill; drain = nextDrain;
    return true;
}
bool RelayController::setAerator(bool on) {
    if (!ready) return false;
    writeRelay(Pins::AERATOR_RELAY_GPIO, on); air = on; return true;
}
bool RelayController::allOff() {
    const bool pumpsStopped = setPumps(false, false);
    const bool aeratorStopped = setAerator(false);
    return pumpsStopped && aeratorStopped;
}
