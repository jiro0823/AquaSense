#pragma once

// water-monitor only: confirmed by the supplied Arduino sketch and diagram.
namespace Pins {
constexpr int PH = 35;
constexpr int TURBIDITY = 34;
constexpr int ORP = 32;
constexpr int TEMPERATURE = 4;
constexpr int I2C_SDA = 21;
constexpr int I2C_SCL = 22;

// Assign each load to one verified GPIO25/26/27; -1 keeps outputs unconfigured.
constexpr int FILL_RELAY_GPIO = -1;
constexpr int DRAIN_RELAY_GPIO = -1;
constexpr int AERATOR_RELAY_GPIO = -1;

// Confirmed diagram signals; polarity is configured separately in ActuatorConfig.h.
namespace Diagram {
constexpr int SERVO = 19;  // Existing standalone feeder still uses its original GPIO13.
constexpr int BUZZER = 18;
constexpr int RELAY_SIGNALS[] = {25, 26, 27};
// The fourth relay channel is unused. This project uses no float switches.
}
}
