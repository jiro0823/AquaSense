#include "LcdManager.h"
#include <Arduino.h>
#include <Wire.h>
#include <stdio.h>
#include <string.h>
#include "config/DeviceConfig.h"

LcdManager::LcdManager() : lcd(DeviceConfig::LCD_ADDRESS, DeviceConfig::LCD_COLUMNS, DeviceConfig::LCD_ROWS) {}

void LcdManager::begin() {
    Wire.beginTransmission(DeviceConfig::LCD_ADDRESS);
    available = Wire.endTransmission() == 0;
    if (!available) {
        Serial.println("LCD not found; monitoring continues.");
        return;
    }
    lcd.init();
    lcd.backlight();
    uint8_t fullBlock[8] = {0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111};
    uint8_t lightBlock[8] = {0b10101, 0b01010, 0b10101, 0b01010, 0b10101, 0b01010, 0b10101, 0b01010};
    lcd.createChar(0, fullBlock);
    lcd.createChar(1, lightBlock);
    writeRow(0, "      AQUASENSE");
    writeRow(1, " Water Quality Mon. ");
    writeRow(2, "Starting sensors...");
    writeRow(3, "                    ");
    welcomeStartedMs = millis();
    showingWelcome = true;
    wifiStageStartedMs = welcomeStartedMs;
}

void LcdManager::writeRow(uint8_t row, const char* text) {
    char padded[DeviceConfig::LCD_COLUMNS + 1];
    memset(padded, ' ', DeviceConfig::LCD_COLUMNS);
    const size_t length = strnlen(text, DeviceConfig::LCD_COLUMNS);
    memcpy(padded, text, length);
    padded[DeviceConfig::LCD_COLUMNS] = '\0';
    lcd.setCursor(0, row);
    lcd.print(padded); // Overwrite the whole row without clear()/visible flicker.
}

void LcdManager::drawProgress(uint8_t row, uint32_t elapsedMs, uint32_t timeoutMs) {
    char progress[DeviceConfig::LCD_COLUMNS + 1];
    const uint32_t cycle = timeoutMs ? elapsedMs % timeoutMs : 0;
    const uint8_t filled = timeoutMs
        ? uint8_t((uint64_t(cycle) * DeviceConfig::LCD_COLUMNS) / timeoutMs)
        : 0;
    lcd.setCursor(0, row);
    for (uint8_t i = 0; i < DeviceConfig::LCD_COLUMNS; ++i) lcd.write(byte(i < filled ? 0 : 1));
}

void LcdManager::showReadings(const SensorReadings& readings, uint32_t nowMs) {
    const bool fresh = readings.sequence != 0 &&
        uint32_t(nowMs - readings.sampledAtMs) <= DeviceConfig::TELEMETRY_MAX_AGE_MS;
    char row[32];
    if (fresh && readings.phValid) snprintf(row, sizeof(row), "pH: %.2f", double(readings.ph));
    else snprintf(row, sizeof(row), "pH: DISCONNECTED");
    writeRow(0, row);
    if (fresh && readings.temperatureValid) snprintf(row, sizeof(row), "Temp: %.2f C", double(readings.temperatureC));
    else snprintf(row, sizeof(row), "Temp: DISCONNECTED");
    writeRow(1, row);
    if (fresh && readings.turbidityValid) snprintf(row, sizeof(row), "Turb: %.1f NTU", double(readings.turbidityRaw));
    else snprintf(row, sizeof(row), "Turb: DISCONNECTED");
    writeRow(2, row);
    if (fresh && readings.orpValid) snprintf(row, sizeof(row), "ORP: %.1f mV", double(readings.orpMv));
    else snprintf(row, sizeof(row), "ORP: DISCONNECTED");
    writeRow(3, row);
}

void LcdManager::update(const SensorReadings& reading, const SystemState& state, uint32_t nowMs) {
    if (!available || uint32_t(nowMs - lastRefreshMs) < DeviceConfig::LCD_REFRESH_INTERVAL_MS) return;
    lastRefreshMs = nowMs;
    if (!state.wifiConnected) {
        if (wasWifiConnected || wifiStageStartedMs == 0) wifiStageStartedMs = nowMs;
        mqttStageStartedMs = 0;
        startupComplete = false;
        successScreenActive = false;
        if (showingWelcome && uint32_t(nowMs - welcomeStartedMs) < DeviceConfig::LCD_WELCOME_DURATION_MS) {
            drawProgress(3, uint32_t(nowMs - welcomeStartedMs), DeviceConfig::LCD_WELCOME_DURATION_MS);
            wasWifiConnected = false;
            wasMqttConnected = state.mqttConnected;
            return;
        }
        showingWelcome = false;
        writeRow(0, "AQUASENSE");
        writeRow(1, "Connecting WiFi...");
        writeRow(2, "Monitoring continues");
        drawProgress(3, uint32_t(nowMs - wifiStageStartedMs), DeviceConfig::WIFI_CONNECT_TIMEOUT_MS);
        wasWifiConnected = false;
        wasMqttConnected = state.mqttConnected;
        return;
    }

    if (!state.mqttConnected) {
        if (wasWifiConnected == false || wasMqttConnected || mqttStageStartedMs == 0) mqttStageStartedMs = nowMs;
        startupComplete = false;
        successScreenActive = false;
        showingWelcome = false;
        writeRow(0, "AQUASENSE");
        writeRow(1, "WiFi connected");
        writeRow(2, "Connecting MQTT...");
        drawProgress(3, uint32_t(nowMs - mqttStageStartedMs), DeviceConfig::MQTT_CONNECT_TIMEOUT_MS);
        wasWifiConnected = true;
        wasMqttConnected = false;
        return;
    }

    if (!startupComplete) {
        if (!successScreenActive) {
            writeRow(0, "WiFi connected");
            writeRow(1, "MQTT connected");
            writeRow(2, "Ready for readings");
            writeRow(3, "                    ");
            successStartedMs = nowMs;
            successScreenActive = true;
            wasWifiConnected = true;
            wasMqttConnected = true;
            return;
        }
        if (uint32_t(nowMs - successStartedMs) < DeviceConfig::LCD_SUCCESS_HOLD_MS) return;
        startupComplete = true;
        successScreenActive = false;
    }

    showingWelcome = false;
    showReadings(reading, nowMs);
    wasWifiConnected = true;
    wasMqttConnected = true;
}
