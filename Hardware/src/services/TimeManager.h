#pragma once
#include <RTClib.h>
#include <stdint.h>
#include <Preferences.h>

// DS3231 ownership for this migration. Standalone feeder NTP is unchanged.
class TimeManager {
public:
    void begin();
    void update(uint32_t nowMs, bool wifiConnected);
    bool isAvailable() const;
    bool isTimeValid() const;
    void printCurrentTime() const;
    int64_t localMinute() const;
    void localDateAndTime(char* date, char* time) const;
private:
    RTC_DS3231 rtc;
    DateTime currentTime;
    bool available = false;
    bool timeValid = false;
    uint32_t lastReadMs = 0;
    bool ntpStarted = false;
    bool rtcSyncPending = false;
    Preferences metadata;
};
