#pragma once

// Integrated water-monitor pin map from the supplied hardware details and project config.
namespace Pins
{
    constexpr int PH = 35;
    constexpr int TURBIDITY = 34;
    constexpr int ORP = 32;
    constexpr int TEMPERATURE = 4;
    constexpr int I2C_SDA = 21;
    constexpr int I2C_SCL = 22;

    // Logical relay control GPIOs. These do not identify physical IN/K channel numbers.
    constexpr int FILL_RELAY_GPIO = 26;
    constexpr int DRAIN_RELAY_GPIO = 27;
    constexpr int AERATOR_RELAY_GPIO = 25;
    constexpr int SERVO = 18;
    constexpr int BUZZER = 19;
}
