#pragma once

// Integrated water-monitor pin map from the supplied hardware details and project config.
namespace Pins {
constexpr int PH = 35;
constexpr int TURBIDITY = 34;
constexpr int ORP = 32;
constexpr int TEMPERATURE = 4;
constexpr int I2C_SDA = 21;
constexpr int I2C_SCL = 22;

// Diagram signal order follows relay IN1..IN4: pump 1, pump 2, aerator, spare.
// Relay writes remain inhibited until RELAY_ACTIVE_LEVEL is commissioned.
constexpr int FILL_RELAY_GPIO = 25;
constexpr int DRAIN_RELAY_GPIO = 26;
constexpr int AERATOR_RELAY_GPIO = 27;

// Confirmed diagram signals; polarity is configured separately in ActuatorConfig.h.
namespace Diagram {
constexpr int SERVO = 13;  // MG996R signal confirmed by the supplied wiring reference.
constexpr int BUZZER = 18;
constexpr int RELAY_SIGNALS[] = {25, 26, 27, 33};
// GPIO33 is the fourth relay signal; its channel is unused in this installation.
// This project uses no float switches.
}
}
