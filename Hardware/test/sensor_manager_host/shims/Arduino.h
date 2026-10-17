#pragma once
#include <cstdint>

constexpr int ADC_11db = 0;
struct HostSerial {
    template <typename... Args> void printf(const char*, Args...) const {}
    void println(const char*) const {}
};
extern HostSerial Serial;

void analogReadResolution(int bits);
void analogSetPinAttenuation(int pin, int attenuation);
int analogRead(int pin);
uint32_t analogReadMilliVolts(int pin);
void delay(uint32_t ms);
void delayMicroseconds(uint32_t us);
uint32_t esp_random();

template <typename T, typename U, typename V>
constexpr T constrain(T value, U low, V high) {
    return value < low ? T(low) : value > high ? T(high) : value;
}
