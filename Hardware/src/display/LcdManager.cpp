#include "LcdManager.h"
#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <stdio.h>
#include <string.h>
#include <math.h>
#include "config/DeviceConfig.h"
#include "config/CalibrationConfig.h"
#include "config/Thresholds.h"
#include "../sensors/SensorConversions.h"
#if __has_include("secrets/Secrets.h")
#include "secrets/Secrets.h"
#else
#include "secrets/Secrets.example.h"
#endif

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
        lcd.noDisplay();
        delay(150);
        lcd.display();
    }
    delay(300);
    lcd.clear();
    wifiStageStartedMs = millis();
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
    const uint32_t boundedElapsed = timeoutMs && elapsedMs < timeoutMs ? elapsedMs : timeoutMs;
    const uint8_t filled = timeoutMs
        ? uint8_t((uint64_t(boundedElapsed) * DeviceConfig::LCD_COLUMNS + timeoutMs / 2) / timeoutMs)
        : 0;
    lcd.setCursor(0, row);
    for (uint8_t i = 0; i < DeviceConfig::LCD_COLUMNS; ++i) lcd.write(byte(i < filled ? 0 : 1));
}

void LcdManager::showReadings(const SensorReadings& readings, uint32_t nowMs) {
    const bool fresh = readings.sequence != 0 &&
        uint32_t(nowMs - readings.sampledAtMs) <= DeviceConfig::TELEMETRY_MAX_AGE_MS;
    char row[32];
#if AQUASENSE_LCD_ANALOG_DIAGNOSTIC_MODE
    const bool hasSample = readings.sequence != 0;
    const auto freshAt = [nowMs](uint32_t sampledAtMs) {
        return sampledAtMs != 0 && uint32_t(nowMs - sampledAtMs) <= DeviceConfig::TELEMETRY_MAX_AGE_MS;
    };
    const auto usableAdc = [](const AnalogDiagnostics& diagnostics, int minimum, int maximum) {
        const int raw = int(diagnostics.rawAdc);
        const int spread = int(diagnostics.maximum) - int(diagnostics.minimum);
        return raw >= minimum && raw <= maximum && spread <= CalibrationConfig::STABILITY_MAX_DEV &&
            diagnostics.clipped == 0 && SensorConversions::adcUsable(raw);
    };
    if (!hasSample) {
        writeRow(0, "pH: NO DATA");
    } else if (!freshAt(readings.phDiagnostics.sampledAtMs)) {
        writeRow(0, "pH: STALE");
    } else if (!usableAdc(readings.phDiagnostics, CalibrationConfig::PH_CONNECT_MIN,
                          CalibrationConfig::PH_CONNECT_MAX)) {
        snprintf(row, sizeof(row), "pH ADC %.0f FAIL", double(readings.phDiagnostics.rawAdc));
        writeRow(0, row);
    } else if (!CalibrationConfig::ANALOG_CONVERSION_VERIFIED && !readings.calibrated) {
        const float phEstimate = SensorConversions::phFromVoltage(readings.phDiagnostics.voltage);
        if (isfinite(phEstimate) && SensorConversions::phPlausible(phEstimate))
            snprintf(row, sizeof(row), "PH: %.2f", double(phEstimate));
        else
            snprintf(row, sizeof(row), "pH: INVALID");
        writeRow(0, row);
    } else if (fresh && readings.phValid) {
        snprintf(row, sizeof(row), "pH: %.2f", double(readings.ph));
        writeRow(0, row);
    } else {
        writeRow(0, readings.phConnected ? "pH: INVALID" : "pH: DISCONNECTED");
    }
    if (readings.sequence == 0) {
        writeRow(1, "Temp: NO DATA");
    } else if (!freshAt(readings.temperatureSampledAtMs)) {
        writeRow(1, "Temp: STALE");
    } else if (!readings.temperatureConnected) {
        writeRow(1, "Temp: DISCONNECTED");
    } else if (!readings.temperatureValid) {
        writeRow(1, "Temp: INVALID");
    } else {
        snprintf(row, sizeof(row), "Temp: %.2f C", double(readings.temperatureC));
        writeRow(1, row);
    }
    if (!hasSample) {
        writeRow(2, "Turb: NO DATA");
    } else if (!freshAt(readings.turbidityDiagnostics.sampledAtMs)) {
        writeRow(2, "Turb: STALE");
    } else if (!usableAdc(readings.turbidityDiagnostics, CalibrationConfig::TURBIDITY_CONNECT_MIN,
                          CalibrationConfig::TURBIDITY_CONNECT_MAX)) {
        snprintf(row, sizeof(row), "Turb ADC %.0f FAIL", double(readings.turbidityDiagnostics.rawAdc));
        writeRow(2, row);
    } else {
        const float turbidityEstimate = SensorConversions::turbidityFromAdc(
            int(readings.turbidityDiagnostics.rawAdc));
        if (isfinite(turbidityEstimate))
            snprintf(row, sizeof(row), "Turbidity: %.1f", double(turbidityEstimate));
        else
            snprintf(row, sizeof(row), "Turb: INVALID");
        writeRow(2, row);
    }
    if (!hasSample) {
        writeRow(3, "ORP: NO DATA");
    } else if (!freshAt(readings.orpDiagnostics.sampledAtMs)) {
        writeRow(3, "ORP: STALE");
    } else if (!usableAdc(readings.orpDiagnostics, CalibrationConfig::ORP_CONNECT_MIN,
                          CalibrationConfig::ORP_CONNECT_MAX)) {
        snprintf(row, sizeof(row), "ORP ADC %.0f FAIL", double(readings.orpDiagnostics.rawAdc));
        writeRow(3, row);
    } else {
        const float orpEstimate = SensorConversions::orpFromVoltage(readings.orpDiagnostics.voltage);
        if (isfinite(orpEstimate))
            snprintf(row, sizeof(row), "ORP: %.1f mV", double(orpEstimate));
        else
            snprintf(row, sizeof(row), "ORP: INVALID");
        writeRow(3, row);
    }
#else
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
#endif
}

void LcdManager::update(const SensorReadings& reading, const SystemState& state, uint32_t nowMs) {
    if (uint32_t(nowMs - lastRefreshMs) < DeviceConfig::LCD_REFRESH_INTERVAL_MS) return;
    lastRefreshMs = nowMs;
    Wire.beginTransmission(DeviceConfig::LCD_ADDRESS);
    if (Wire.endTransmission() != 0) {
        available = false;
        return;
    }
    if (!available) {
        lcd.init();
        lcd.backlight();
        uint8_t fullBlock[8] = {0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111};
        uint8_t lightBlock[8] = {0b10101, 0b01010, 0b10101, 0b01010, 0b10101, 0b01010, 0b10101, 0b01010};
        lcd.createChar(0, fullBlock);
        lcd.createChar(1, lightBlock);
        available = true;
        startupComplete = false;
        wasWifiConnected = false;
        wasMqttConnected = false;
        wifiStageStartedMs = nowMs;
        mqttStageStartedMs = 0;
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
