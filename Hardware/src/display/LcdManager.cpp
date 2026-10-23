#include "LcdManager.h"
#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <new>
#include <stdio.h>
#include <string.h>
#include "config/DeviceConfig.h"
#include "config/CalibrationConfig.h"
#if __has_include("secrets/Secrets.h")
#include "secrets/Secrets.h"
#else
#include "secrets/Secrets.example.h"
#endif

LcdManager::LcdManager() = default;

uint8_t LcdManager::detectLcdAddress() {
    const auto responds = [](uint8_t address) {
        Wire.beginTransmission(address);
        return Wire.endTransmission() == 0;
    };
    if (responds(DeviceConfig::LCD_ADDRESS)) return DeviceConfig::LCD_ADDRESS;
    for (uint8_t address = 0x20; address <= 0x27; ++address)
        if (responds(address)) return address;
    for (uint8_t address = 0x38; address <= 0x3F; ++address)
        if (responds(address)) return address;
    return 0;
}

bool LcdManager::initializeLcd() {
    if (lcd && lcdObjectAddress != lcdAddress) {
        delete lcd;
        lcd = nullptr;
    }
    if (!lcd) {
        lcd = new (std::nothrow) LiquidCrystal_I2C(lcdAddress, DeviceConfig::LCD_COLUMNS, DeviceConfig::LCD_ROWS);
        if (lcd) lcdObjectAddress = lcdAddress;
    }
    if (!lcd) return false;
    lcd->init();
    lcd->backlight();
    uint8_t fullBlock[8] = {0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111};
    uint8_t lightBlock[8] = {0b10101, 0b01010, 0b10101, 0b01010, 0b10101, 0b01010, 0b10101, 0b01010};
    lcd->createChar(0, fullBlock);
    lcd->createChar(1, lightBlock);
    invalidateRowCache();
    return true;
}

void LcdManager::invalidateRowCache() {
    memset(rowCacheValid, 0, sizeof(rowCacheValid));
}

void LcdManager::begin() {
    lcdAddress = detectLcdAddress();
    if (lcdAddress == 0 || !initializeLcd()) {
        Serial.println("LCD not found on I2C addresses 0x20-0x27 or 0x38-0x3F; monitoring continues.");
        available = false;
        return;
    }
    available = true;
    lcdMissCount = 0;
    lcdRecoveryAckCount = 0;
    Serial.printf("LCD found at I2C address 0x%02X\n", unsigned(lcdAddress));
    writeRow(0, "     AQUASENSE");
    writeRow(1, " Water Quality Mon. ");
    writeRow(2, "                    ");
    drawProgress(3, 0, 100);
    for (uint32_t percent = 1; percent <= 100; percent += 5) {
        drawProgress(3, percent, 100);
        delay(80);
    }
    for (uint8_t blink = 0; blink < 2; ++blink) {
        delay(250);
        lcd->noDisplay();
        delay(150);
        lcd->display();
    }
    delay(300);
    lcd->clear();
    invalidateRowCache();
    wifiStageStartedMs = millis();
}

void LcdManager::writeRow(uint8_t row, const char* text) {
    if (row >= DeviceConfig::LCD_ROWS || !lcd) return;
    char padded[DeviceConfig::LCD_COLUMNS + 1];
    memset(padded, ' ', DeviceConfig::LCD_COLUMNS);
    const size_t length = strnlen(text, DeviceConfig::LCD_COLUMNS);
    memcpy(padded, text, length);
    padded[DeviceConfig::LCD_COLUMNS] = '\0';
    if (rowCacheValid[row] && strcmp(lastRows[row], padded) == 0) return;
    lcd->setCursor(0, row);
    lcd->print(padded); // Overwrite the whole row without clear()/visible flicker.
    memcpy(lastRows[row], padded, sizeof(padded));
    rowCacheValid[row] = true;
}

void LcdManager::drawProgress(uint8_t row, uint32_t elapsedMs, uint32_t timeoutMs) {
    const uint32_t boundedElapsed = timeoutMs && elapsedMs < timeoutMs ? elapsedMs : timeoutMs;
    const uint8_t filled = timeoutMs
        ? uint8_t((uint64_t(boundedElapsed) * DeviceConfig::LCD_COLUMNS + timeoutMs / 2) / timeoutMs)
        : 0;
    if (!lcd) return;
    lcd->setCursor(0, row);
    for (uint8_t i = 0; i < DeviceConfig::LCD_COLUMNS; ++i) lcd->write(byte(i < filled ? 0 : 1));
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
    if (fresh && readings.turbidityValid)
        snprintf(row, sizeof(row), "Turb: %.1f NTU%s", double(readings.turbidityRaw),
            CalibrationConfig::TURBIDITY_CALIBRATION_VERIFIED ? "" : " EST");
    else if (fresh && (readings.turbidityDiagnostics.minimum <= 8 || readings.turbidityDiagnostics.maximum >= 4087))
        snprintf(row, sizeof(row), "Turb: SENSOR ERROR");
    else if (fresh && !readings.turbidityConnected)
        snprintf(row, sizeof(row), "Turb: OUT OF RANGE");
    else if (!fresh) snprintf(row, sizeof(row), "Turb: STALE");
    else snprintf(row, sizeof(row), "Turb: INVALID");
    writeRow(2, row);
    if (fresh && readings.orpValid) snprintf(row, sizeof(row), "ORP: %.1f mV", double(readings.orpMv));
    else snprintf(row, sizeof(row), "ORP: DISCONNECTED");
    writeRow(3, row);
}

void LcdManager::update(const SensorReadings& reading, const SystemState& state, uint32_t nowMs) {
    if (uint32_t(nowMs - lastRefreshMs) < DeviceConfig::LCD_REFRESH_INTERVAL_MS) return;
    lastRefreshMs = nowMs;
    if (lcdAddress == 0) lcdAddress = detectLcdAddress();
    if (lcdAddress == 0) {
        if (++lcdMissCount >= 3) {
            available = false;
            lcdRecoveryAckCount = 0;
        }
        return;
    }
    Wire.beginTransmission(lcdAddress);
    if (Wire.endTransmission() != 0) {
        lcdRecoveryAckCount = 0;
        if (++lcdMissCount >= 3) {
            available = false;
            lcdAddress = 0;
        }
        return;
    }
    lcdMissCount = 0;
    if (!available) {
        // Ignore a single transient ACK after a bus disturbance. Reinitialize
        // only after the backpack has responded consistently on two polls.
        if (++lcdRecoveryAckCount < 2) return;
        if (!initializeLcd()) return;
        available = true;
        lcdRecoveryAckCount = 0;
        Serial.printf("LCD reconnected at I2C address 0x%02X\n", unsigned(lcdAddress));
        startupComplete = false;
        wasWifiConnected = false;
        wasMqttConnected = false;
        wifiStageStartedMs = nowMs;
        mqttStageStartedMs = 0;
    }
    const bool readingFresh = reading.sequence != 0 &&
        uint32_t(nowMs - reading.sampledAtMs) <= DeviceConfig::TELEMETRY_MAX_AGE_MS;
    if (readingFresh) {
        // Keep local measurements visible during network outages. Connectivity
        // state and retry diagnostics continue on Serial Monitor.
        showReadings(reading, nowMs);
        wasWifiConnected = state.wifiConnected;
        wasMqttConnected = state.mqttConnected;
        return;
    }
    if (!state.wifiConnected) {
        if (wasWifiConnected || wifiStageStartedMs == 0) wifiStageStartedMs = nowMs;
        mqttStageStartedMs = 0;
        startupComplete = false;
        successScreenActive = false;
        wifiSuccessScreenActive = false;
        char ssidRow[DeviceConfig::LCD_COLUMNS + 1];
        snprintf(ssidRow, sizeof(ssidRow), "   %.17s", Secrets::WIFI_SSID);
        writeRow(0, "Connecting WiFi");
        writeRow(1, ssidRow);
        const uint32_t wifiElapsed = uint32_t(nowMs - wifiStageStartedMs);
        drawProgress(3, wifiElapsed, DeviceConfig::WIFI_CONNECT_TIMEOUT_MS);
        if (wifiElapsed > DeviceConfig::WIFI_CONNECT_TIMEOUT_MS) wifiStageStartedMs = nowMs;
        wasWifiConnected = false;
        wasMqttConnected = state.mqttConnected;
        return;
    }

    // Preserve the reference flow's WiFi success screen before displaying
    // MQTT progress. The shared state exposes connection booleans only, so
    // this transition is inferred from the WiFi rising edge.
    if (!wasWifiConnected && !wifiSuccessScreenActive) {
        const String ip = WiFi.localIP().toString();
        writeRow(0, "WiFi OK");
        writeRow(1, ip.c_str());
        writeRow(2, "Starting MQTT...");
        drawProgress(3, 100, 100);
        wifiSuccessStartedMs = nowMs;
        wifiSuccessScreenActive = true;
        mqttStageStartedMs = nowMs;
        wasWifiConnected = true;
        wasMqttConnected = false;
        return;
    }
    if (wifiSuccessScreenActive) {
        if (uint32_t(nowMs - wifiSuccessStartedMs) < DeviceConfig::LCD_SUCCESS_HOLD_MS) return;
        wifiSuccessScreenActive = false;
    }

    if (!state.mqttConnected) {
        if (wasMqttConnected || mqttStageStartedMs == 0) mqttStageStartedMs = nowMs;
        startupComplete = false;
        successScreenActive = false;
        writeRow(0, "Connecting MQTT...");
        writeRow(1, DeviceConfig::MQTT_HOST);
        const uint32_t mqttElapsed = uint32_t(nowMs - mqttStageStartedMs);
        drawProgress(3, mqttElapsed, DeviceConfig::MQTT_CONNECT_TIMEOUT_MS);
        if (mqttElapsed > DeviceConfig::MQTT_CONNECT_TIMEOUT_MS) mqttStageStartedMs = nowMs;
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

    showReadings(reading, nowMs);
    wasWifiConnected = true;
    wasMqttConnected = true;
}
