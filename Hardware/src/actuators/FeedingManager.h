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
    const char* scheduleResult() const;
    const char* scheduleResultId() const { return lastScheduleResult.id; }
    int64_t scheduleResultMinute() const { return lastScheduleResult.minute; }
    void stop();
private:
    enum class Phase { Idle, Closing, Opening, Finishing, Hold };
    enum class ScheduleOutcome : uint8_t { None, Deferred, Started, Completed, Cancelled, SkippedExpired, SkippedQueueFull, ServoUnavailable };
    struct Fired { char id[37] = {}; int64_t minute = -1; };
    struct ScheduleResult { char id[37] = {}; int64_t minute = -1; ScheduleOutcome outcome = ScheduleOutcome::None; };
    struct PendingSchedule { char id[37] = {}; int64_t minute = -1; };
    bool markSchedule(const char* id, int64_t minute);
    void recordScheduleResult(const char* id, int64_t minute, ScheduleOutcome outcome);
    bool enqueuePendingSchedule(const char* id, int64_t minute);
    bool removePendingSchedule(uint8_t index);
    bool attachServo();
    bool start(uint32_t nowMs);
    Servo servo;
    Preferences storage;
    TimeManager& timeManager;
    FeedingSchedules schedules;
    Fired fired[MAX_FEEDING_SCHEDULES] = {};
    ScheduleResult lastScheduleResult{};
    PendingSchedule pendingSchedules[MAX_FEEDING_SCHEDULES] = {};
    uint8_t pendingCount = 0;
    char activeScheduleId[37] = {};
    int64_t activeScheduleMinute = -1;
    bool ready = false, storageReady = false;
    Phase phase = Phase::Idle;
    uint32_t phaseStartedMs = 0;
    int64_t manualMinute = -1;
    bool scheduledFeedActive = false;
};
