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
    writeRow(0, "    Welcome!");
    writeRow(1, "   AquaSense");
    welcomeStartedMs = millis();
    showingWelcome = true;
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

void LcdManager::update(const SensorReadings& reading, const SystemState& state, uint32_t nowMs) {
    if (!available || uint32_t(nowMs - lastRefreshMs) < DeviceConfig::LCD_REFRESH_INTERVAL_MS) return;
    lastRefreshMs = nowMs;
    if (state.fault[0]) {
        showingWelcome = false; // Faults take priority over the startup greeting.
        writeRow(0, "WATER FAULT"); writeRow(1, state.fault); return;
    }
    if (showingWelcome) {
        // Hold only the display; sensors, network and controllers keep updating.
        if (uint32_t(nowMs - welcomeStartedMs) < DeviceConfig::LCD_WELCOME_DURATION_MS) return;
        showingWelcome = false;
    }
    if ((nowMs / 4000) % 2 && (state.fillPump || state.drainPump || state.aerator || state.feederBusy)) {
        char status[24];
        writeRow(0, state.waterPhase);
        snprintf(status, sizeof(status), "F%d D%d A%d Feed%d", state.fillPump, state.drainPump, state.aerator, state.feederBusy);
        writeRow(1, status); return;
    }
    const bool fresh = reading.sequence != 0 &&
        uint32_t(nowMs - reading.sampledAtMs) <= DeviceConfig::TELEMETRY_MAX_AGE_MS;
    char temperature[8] = "--", ph[8] = "--", turbidity[8] = "--", orp[8] = "--";
    if (fresh && reading.temperatureValid) snprintf(temperature, sizeof(temperature), "%.1f", double(reading.temperatureC));
    if (fresh && reading.phValid) snprintf(ph, sizeof(ph), "%.1f", double(reading.ph));
    if (fresh && reading.turbidityValid) snprintf(turbidity, sizeof(turbidity), "%.0f", double(reading.turbidityRaw));
    if (fresh && reading.orpValid) snprintf(orp, sizeof(orp), "%.0f", double(reading.orpMv));
    char row[32];
    snprintf(row, sizeof(row), "T:%s%c pH:%s", temperature, char(223), ph);
    writeRow(0, row);
    snprintf(row, sizeof(row), "Tb:%s O:%s", turbidity, orp);
    writeRow(1, row);
    lcd.setCursor(DeviceConfig::LCD_COLUMNS - 1, 1);
    lcd.print(state.wifiConnected && state.mqttConnected ? ' ' : '!');
}
