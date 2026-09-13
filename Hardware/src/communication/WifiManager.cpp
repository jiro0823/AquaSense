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
    Serial.println("WiFi connection started; local monitoring remains active.");
}

bool WifiManager::isConnected() const { return WiFi.status() == WL_CONNECTED; }

void WifiManager::update(uint32_t nowMs) {
    const bool connected = isConnected();
    if (connected != wasConnected) {
        Serial.println(connected ? "WiFi connected" : "WiFi disconnected");
        wasConnected = connected;
    }
    if (!connected && uint32_t(nowMs - lastReconnectMs) >= DeviceConfig::WIFI_RECONNECT_INTERVAL_MS) {
        lastReconnectMs = nowMs;
        WiFi.reconnect(); // Start a connection attempt; never wait in a retry loop.
    }
}
