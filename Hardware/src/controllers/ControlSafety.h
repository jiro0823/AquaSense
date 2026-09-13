#pragma once
#include <stdint.h>

namespace ControlSafety {
constexpr bool relayPin(int pin) { return pin == 25 || pin == 26 || pin == 27; }
constexpr bool relayConfiguration(int fill, int drain, int air, int active) {
    return (active == 0 || active == 1) && relayPin(fill) && relayPin(drain) && relayPin(air) &&
           fill != drain && fill != air && drain != air;
}
constexpr bool pumpCombination(bool fill, bool drain) { return !(fill && drain); }
constexpr bool durationAllowed(uint32_t requested, uint32_t limit) {
    return limit > 0 && requested > 0 && requested < limit && limit <= 300000;
}
constexpr bool elapsed(uint32_t now, uint32_t start, uint32_t duration) {
    return uint32_t(now - start) >= duration;
}
}
