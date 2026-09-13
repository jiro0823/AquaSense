#pragma once
#include <ESP32Servo.h>
#include <Preferences.h>
#include "models/FeedingSchedule.h"
#include "models/Command.h"
#include "services/TimeManager.h"

class FeedingManager {
public:
    explicit FeedingManager(TimeManager& clock) : timeManager(clock) {}
    void begin();
    const char* request(CommandAction action, uint32_t nowMs);
    void update(uint32_t nowMs);
    void setSchedules(const FeedingSchedules& next);
    bool isBusy() const { return phase != Phase::Idle; }
    void stop();
private:
    enum class Phase { Idle, Closing, Opening, Finishing, Hold };
    struct Fired { char id[37] = {}; int64_t minute = -1; };
    bool markSchedule(const char* id, int64_t minute);
    void start(uint32_t nowMs);
    Servo servo;
    Preferences storage;
    TimeManager& timeManager;
    FeedingSchedules schedules;
    Fired fired[MAX_FEEDING_SCHEDULES] = {};
    bool ready = false, storageReady = false;
    Phase phase = Phase::Idle;
    uint32_t phaseStartedMs = 0;
    int64_t manualMinute = -1;
};
