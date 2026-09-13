#include "TimeManager.h"
#include <Arduino.h>
#include <time.h>
#include <sys/time.h>
#include <esp_sntp.h>
#include "config/DeviceConfig.h"

void TimeManager::begin() {
    available = rtc.begin();
    const bool metadataReady = metadata.begin("aq-clock", false);
    // Only a RTC previously synchronized by this firmware is trusted as UTC.
    if (available && metadataReady && metadata.getBool("utc", false) && !rtc.lostPower()) {
        const DateTime saved = rtc.now();
        if (saved.isValid() && saved.unixtime() >= DeviceConfig::MIN_VALID_EPOCH) {
            timeval value{static_cast<time_t>(saved.unixtime()), 0};
            settimeofday(&value, nullptr);
        }
    }
}
void TimeManager::update(uint32_t nowMs, bool wifiConnected) {
    if (wifiConnected && !ntpStarted) {
        configTime(0, 0, DeviceConfig::NTP_PRIMARY, DeviceConfig::NTP_SECONDARY);
        ntpStarted = true; // ESP32 SNTP keeps resynchronizing in the background.
    }
    if (uint32_t(nowMs - lastReadMs) < DeviceConfig::RTC_READ_INTERVAL_MS) return;
    lastReadMs = nowMs;
    const time_t utc = time(nullptr);
    if (ntpStarted && sntp_get_sync_status() == SNTP_SYNC_STATUS_COMPLETED) rtcSyncPending = true;
    timeValid = utc >= DeviceConfig::MIN_VALID_EPOCH;
    if (!timeValid) return;
    currentTime = DateTime(uint32_t(utc + DeviceConfig::LOCAL_OFFSET_SECONDS));
    if (available && rtcSyncPending) {
        rtc.adjust(DateTime(uint32_t(utc)));
        // Mark UTC convention only after a successful RTC round trip.
        const DateTime check = rtc.now();
        const int64_t difference = int64_t(check.unixtime()) - int64_t(utc);
        if (check.isValid() && !rtc.lostPower() && difference > -3 && difference < 3) {
            if (metadata.getBool("utc", false) || metadata.putBool("utc", true) > 0) rtcSyncPending = false;
        }
    }
}
bool TimeManager::isAvailable() const { return available; }
bool TimeManager::isTimeValid() const { return timeValid; }
int64_t TimeManager::localMinute() const {
    return timeValid ? (int64_t(time(nullptr)) + DeviceConfig::LOCAL_OFFSET_SECONDS) / 60 : -1;
}
void TimeManager::localDateAndTime(char* date, char* clock) const {
    date[0] = clock[0] = '\0';
    if (!timeValid) return;
    const time_t local = time(nullptr) + DeviceConfig::LOCAL_OFFSET_SECONDS;
    tm parts{}; gmtime_r(&local, &parts);
    strftime(date, 11, "%Y-%m-%d", &parts);
    strftime(clock, 6, "%H:%M", &parts);
}
void TimeManager::printCurrentTime() const {
    if (!timeValid) { Serial.println("Time unavailable: scheduled feeding inhibited."); return; }
    char date[11], clock[6]; localDateAndTime(date, clock);
    Serial.printf("Time: %s %s (UTC+8)\n", date, clock);
}
