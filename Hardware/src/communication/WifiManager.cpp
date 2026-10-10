#include "WifiManager.h"
#include <WiFi.h>
#include "config/DeviceConfig.h"
#if __has_include("secrets/Secrets.h")
#include "secrets/Secrets.h"
#else
#include "secrets/Secrets.example.h"
#endif

void WifiManager::begin() {
    WiFi.persistent(false);
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin(Secrets::WIFI_SSID, Secrets::WIFI_PASSWORD);
    lastReconnectMs = millis();
    lastCheckMs = lastReconnectMs;
    Serial.println("WiFi connection started.");
}

bool WifiManager::isConnected() const { return wasConnected; }

void WifiManager::update(uint32_t nowMs) {
    // During connection attempts the reference checks the live status on each
    // pass. Once connected, defer link polling to its five-second cadence.
    if (!wasConnected || uint32_t(nowMs - lastCheckMs) >= DeviceConfig::WIFI_CHECK_INTERVAL_MS) {
        lastCheckMs = nowMs;
        const bool connected = WiFi.status() == WL_CONNECTED;
        if (connected != wasConnected) {
            Serial.println(connected ? "WiFi connected" : "WiFi disconnected");
            wasConnected = connected;
        }
        if (wasConnected) lastReconnectMs = nowMs;
    }
    if (!wasConnected && uint32_t(nowMs - lastReconnectMs) >= DeviceConfig::WIFI_RECONNECT_INTERVAL_MS) {
        lastReconnectMs = nowMs;
        WiFi.disconnect();
        WiFi.begin(Secrets::WIFI_SSID, Secrets::WIFI_PASSWORD); // Nonblocking retry from the reference flow.
    }
}
