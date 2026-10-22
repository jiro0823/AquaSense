#pragma once
#include <stdint.h>

namespace ControlSafety {
constexpr bool relayPin(int pin) { return pin == 25 || pin == 26 || pin == 27 || pin == 33; }
constexpr bool relayConfiguration(int fill, int drain, int air, int active) {
    return (active == 0 || active == 1) && relayPin(fill) && relayPin(drain) && relayPin(air) &&
           fill != drain && fill != air && drain != air;
}
constexpr int relayOutputLevel(bool on, int active) {
    return on ? active : 1 - active;
}
constexpr bool relayOutputsReady(bool configurationValid, bool outputsEnabled) {
    return configurationValid && outputsEnabled;
}
constexpr bool commissioningAllowsActuation(bool commissioningEnabled, bool safeStop) {
    return commissioningEnabled || safeStop;
}
constexpr bool pumpCombination(bool fill, bool drain) { return !(fill && drain); }
constexpr bool durationAllowed(uint32_t requested, uint32_t limit) {
    return limit > 0 && requested > 0 && requested < limit && limit <= 300000;
}
constexpr bool elapsed(uint32_t now, uint32_t start, uint32_t duration) {
    return uint32_t(now - start) >= duration;
}
}
