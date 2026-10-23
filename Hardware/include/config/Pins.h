#pragma once

// Integrated water-monitor pin map from the supplied hardware details and project config.
namespace Pins {
constexpr int PH = 35;
constexpr int TURBIDITY = 34;
constexpr int ORP = 32;
constexpr int TEMPERATURE = 4;
constexpr int I2C_SDA = 21;
constexpr int I2C_SCL = 22;

// User-confirmed module wiring: K3 refill, K4 drain, K2 aerator.
// Relay writes remain inhibited until the output commissioning gate is enabled.
constexpr int FILL_RELAY_GPIO = 26;
constexpr int DRAIN_RELAY_GPIO = 27;
constexpr int AERATOR_RELAY_GPIO = 25;

// Confirmed diagram signals; polarity is configured separately in ActuatorConfig.h.
namespace Diagram {
constexpr int SERVO = 18;  // User-confirmed installed feeder signal.
constexpr int BUZZER = 19; // User-confirmed installed passive buzzer signal.
constexpr int RELAY_SIGNALS[] = {25, 26, 27, 33};
// GPIO33 is the unused fourth relay signal; K2/K3/K4 are 25/26/27.
// This project uses no float switches.
}
}
