#include "FeedingManager.h"
#include <Arduino.h>
#include <string.h>
#include "config/ActuatorConfig.h"
#include "config/DeviceConfig.h"
#include "config/Pins.h"
#include "controllers/ControlSafety.h"

void FeedingManager::begin() {
    if (!DeviceConfig::ACTUATOR_CONTROL_ENABLED || !DeviceConfig::SCHEDULE_PERSISTENCE_ENABLED) {
        ready = false;
        storageReady = false;
        schedules = FeedingSchedules{};
        return;
    }
    storageReady = storage.begin("aq-feeding", false);
    if (storageReady) {
        if (storage.getBytesLength("schedules") == sizeof(schedules)) storage.getBytes("schedules", &schedules, sizeof(schedules));
        if (schedules.count > MAX_FEEDING_SCHEDULES) schedules = FeedingSchedules{};
        if (storage.getBytesLength("fired") == sizeof(fired)) storage.getBytes("fired", fired, sizeof(fired));
        if (storage.getBytesLength("schedule-result") == sizeof(lastScheduleResult))
            storage.getBytes("schedule-result", &lastScheduleResult, sizeof(lastScheduleResult));
        if (!memchr(lastScheduleResult.id, '\0', sizeof(lastScheduleResult.id)) ||
            uint8_t(lastScheduleResult.outcome) > uint8_t(ScheduleOutcome::ServoUnavailable))
            lastScheduleResult = ScheduleResult{};
        if (storage.getBytesLength("schedule-pending") == sizeof(pendingSchedules)) {
            storage.getBytes("schedule-pending", pendingSchedules, sizeof(pendingSchedules));
            while (pendingCount < MAX_FEEDING_SCHEDULES && pendingSchedules[pendingCount].id[0]) ++pendingCount;
            for (uint8_t i = 0; i < pendingCount; ++i) {
                if (pendingSchedules[i].minute < 0) {
                    pendingCount = 0;
                    memset(pendingSchedules, 0, sizeof(pendingSchedules));
                    break;
                }
            }
        }
    }
    // Do not attach or move the servo at boot. Attach lazily only for a valid
    // manual/scheduled request so reboot cannot move the feeding mechanism.
    ready = ActuatorConfig::FEEDER_ENABLED;
}
void FeedingManager::stop() {
    if (!DeviceConfig::ACTUATOR_CONTROL_ENABLED) return;
    if (scheduledFeedActive) {
        recordScheduleResult(activeScheduleId, activeScheduleMinute, ScheduleOutcome::Cancelled);
        scheduledFeedActive = false;
    }
    if (ready && servo.attached()) servo.write(ActuatorConfig::FEEDER_CLOSED_DEGREES);
    phase = Phase::Idle;
    manualMinute = timeManager.localMinute();
}
bool FeedingManager::attachServo() {
    if (!ready) return false;
    if (!servo.attached()) servo.attach(Pins::SERVO);
    return servo.attached();
}
bool FeedingManager::start(uint32_t nowMs) {
    if (!attachServo()) return false;
    servo.write(ActuatorConfig::FEEDER_CLOSED_DEGREES);
    phase = Phase::Closing; phaseStartedMs = nowMs;
    return true;
}
void FeedingManager::recordScheduleResult(const char* id, int64_t minute, ScheduleOutcome outcome) {
    strlcpy(lastScheduleResult.id, id, sizeof(lastScheduleResult.id));
    lastScheduleResult.minute = minute;
    lastScheduleResult.outcome = outcome;
    if (storageReady && storage.putBytes("schedule-result", &lastScheduleResult, sizeof(lastScheduleResult)) != sizeof(lastScheduleResult))
        Serial.println("Schedule outcome persistence failed.");
}
const char* FeedingManager::scheduleResult() const {
    switch (lastScheduleResult.outcome) {
        case ScheduleOutcome::Deferred: return "deferred";
        case ScheduleOutcome::Started: return "started";
        case ScheduleOutcome::Completed: return "completed";
        case ScheduleOutcome::Cancelled: return "cancelled";
        case ScheduleOutcome::SkippedExpired: return "skipped_expired";
        case ScheduleOutcome::SkippedQueueFull: return "skipped_queue_full";
        case ScheduleOutcome::ServoUnavailable: return "servo_unavailable";
        default: return "none";
    }
}
bool FeedingManager::enqueuePendingSchedule(const char* id, int64_t minute) {
    if (!storageReady || pendingCount >= MAX_FEEDING_SCHEDULES) return false;
    auto& pending = pendingSchedules[pendingCount];
    strlcpy(pending.id, id, sizeof(pending.id));
    pending.minute = minute;
    if (storage.putBytes("schedule-pending", pendingSchedules, sizeof(pendingSchedules)) != sizeof(pendingSchedules)) {
        pending = PendingSchedule{};
        return false;
    }
    ++pendingCount;
    return true;
}
bool FeedingManager::removePendingSchedule(uint8_t index) {
    if (index >= pendingCount) return false;
    PendingSchedule next[MAX_FEEDING_SCHEDULES];
    memcpy(next, pendingSchedules, sizeof(next));
    for (uint8_t i = index; i + 1 < pendingCount; ++i) next[i] = next[i + 1];
    next[pendingCount - 1] = PendingSchedule{};
    if (!storageReady || storage.putBytes("schedule-pending", next, sizeof(next)) != sizeof(next)) {
        Serial.println("Pending schedule removal persistence failed.");
        return false;
    }
    memcpy(pendingSchedules, next, sizeof(next));
    --pendingCount;
    return true;
}
const char* FeedingManager::request(CommandAction action, uint32_t nowMs) {
    if (!DeviceConfig::ACTUATOR_CONTROL_ENABLED) return "offline_calibration_mode";
    manualMinute = timeManager.localMinute();
    if (!ready) return "feeder_disabled";
    if (action == CommandAction::FeedOff) { stop(); return "accepted"; }
    if (isBusy()) return "feeder_busy";
    if (action == CommandAction::FeedTrigger) return start(nowMs) ? "accepted" : "servo_unavailable";
    if (action == CommandAction::FeedOn) {
        if (!attachServo()) return "servo_unavailable";
        servo.write(ActuatorConfig::FEEDER_OPEN_DEGREES);
        phase = Phase::Hold; phaseStartedMs = nowMs; return "accepted";
    }
    return "invalid_action";
}
void FeedingManager::setSchedules(const FeedingSchedules& next) {
    if (!DeviceConfig::SCHEDULE_PERSISTENCE_ENABLED) return;
    if (!storageReady || next.count > MAX_FEEDING_SCHEDULES) return;
    bool same = next.count == schedules.count;
    for (uint8_t i = 0; same && i < next.count; ++i) {
        same = strcmp(next.items[i].id, schedules.items[i].id) == 0 &&
               strcmp(next.items[i].date, schedules.items[i].date) == 0 && strcmp(next.items[i].time, schedules.items[i].time) == 0;
    }
    if (same) return;
    if (pendingCount) {
        PendingSchedule cancelled[MAX_FEEDING_SCHEDULES];
        memcpy(cancelled, pendingSchedules, sizeof(cancelled));
        PendingSchedule empty[MAX_FEEDING_SCHEDULES]{};
        if (storage.putBytes("schedule-pending", empty, sizeof(empty)) != sizeof(empty)) {
            Serial.println("Schedule update deferred: pending occurrences could not be cleared safely.");
            return;
        }
        memcpy(pendingSchedules, empty, sizeof(pendingSchedules));
        pendingCount = 0;
        for (uint8_t i = 0; i < MAX_FEEDING_SCHEDULES; ++i) {
            if (cancelled[i].id[0])
                recordScheduleResult(cancelled[i].id, cancelled[i].minute, ScheduleOutcome::Cancelled);
        }
    }
    if (storage.putBytes("schedules", &next, sizeof(next)) == sizeof(next)) schedules = next;
}
bool FeedingManager::markSchedule(const char* id, int64_t minute) {
    if (!storageReady) return false;
    int slot = -1;
    for (int i = 0; i < MAX_FEEDING_SCHEDULES; ++i) {
        if (strcmp(fired[i].id, id) == 0) {
            if (fired[i].minute >= minute) return false;
            slot = i; break;
        }
    }
    if (slot < 0) {
        slot = 0;
        for (int i = 1; i < MAX_FEEDING_SCHEDULES; ++i) if (fired[i].minute < fired[slot].minute) slot = i;
    }
    strlcpy(fired[slot].id, id, sizeof(fired[slot].id)); fired[slot].minute = minute;
    // Persist before movement: a reset can skip a feed, but must not replay it.
    return storage.putBytes("fired", fired, sizeof(fired)) == sizeof(fired);
}
void FeedingManager::update(uint32_t nowMs) {
    if (!DeviceConfig::ACTUATOR_CONTROL_ENABLED || !DeviceConfig::SCHEDULE_PERSISTENCE_ENABLED) return;
    if (!ready) return;
    if (phase == Phase::Closing && ControlSafety::elapsed(nowMs, phaseStartedMs, ActuatorConfig::FEEDER_CLOSE_MS)) {
        servo.write(ActuatorConfig::FEEDER_OPEN_DEGREES); phase = Phase::Opening; phaseStartedMs = nowMs;
    } else if (phase == Phase::Opening && ControlSafety::elapsed(nowMs, phaseStartedMs, ActuatorConfig::FEEDER_OPEN_MS)) {
        servo.write(ActuatorConfig::FEEDER_CLOSED_DEGREES); phase = Phase::Finishing; phaseStartedMs = nowMs;
    } else if (phase == Phase::Finishing && ControlSafety::elapsed(nowMs, phaseStartedMs, ActuatorConfig::FEEDER_FINISH_MS)) {
        phase = Phase::Idle;
        if (scheduledFeedActive) {
            recordScheduleResult(activeScheduleId, activeScheduleMinute, ScheduleOutcome::Completed);
            scheduledFeedActive = false;
        }
    } else if (phase == Phase::Hold && ControlSafety::elapsed(nowMs, phaseStartedMs, ActuatorConfig::FEEDER_MANUAL_HOLD_MAX_MS)) stop();
    const int64_t minute = timeManager.localMinute();
    if (minute < 0) return;
    if (pendingCount) {
        const auto pending = pendingSchedules[0];
        if (minute > pending.minute + 1) {
            recordScheduleResult(pending.id, pending.minute, ScheduleOutcome::SkippedExpired);
            Serial.printf("Schedule %s skipped: busy window expired.\n", pending.id);
            if (!removePendingSchedule(0)) return;
        } else if (minute >= pending.minute && !isBusy() && minute != manualMinute) {
            if (!removePendingSchedule(0)) return;
            markSchedule(pending.id, pending.minute);
            strlcpy(activeScheduleId, pending.id, sizeof(activeScheduleId));
            activeScheduleMinute = pending.minute;
            if (start(nowMs)) {
                recordScheduleResult(pending.id, pending.minute, ScheduleOutcome::Started);
                scheduledFeedActive = true;
            } else {
                recordScheduleResult(pending.id, pending.minute, ScheduleOutcome::ServoUnavailable);
            }
            return;
        } else if (isBusy()) {
            return;
        }
    }
    char date[11], clock[6]; timeManager.localDateAndTime(date, clock);
    for (uint8_t i = 0; i < schedules.count; ++i) {
        const auto& schedule = schedules.items[i];
        if (strcmp(schedule.time, clock) != 0 || (schedule.date[0] && strcmp(schedule.date, date) != 0)) continue;

        // Persist a bounded pending item before marking it fired so a busy
        // occurrence can be retried once after the operation completes.
        if (isBusy() || minute == manualMinute) {
            const bool queued = pendingCount < MAX_FEEDING_SCHEDULES && enqueuePendingSchedule(schedule.id, minute);
            if (queued && markSchedule(schedule.id, minute)) {
                recordScheduleResult(schedule.id, minute, ScheduleOutcome::Deferred);
            } else if (!queued) {
                markSchedule(schedule.id, minute);
                recordScheduleResult(schedule.id, minute, ScheduleOutcome::SkippedQueueFull);
                Serial.printf("Schedule %s skipped: pending queue full or persistence failed.\n", schedule.id);
            } else {
                removePendingSchedule(uint8_t(pendingCount - 1));
            }
            continue;
        }
        if (!markSchedule(schedule.id, minute)) continue;
        strlcpy(activeScheduleId, schedule.id, sizeof(activeScheduleId));
        activeScheduleMinute = minute;
        if (start(nowMs)) {
            recordScheduleResult(schedule.id, minute, ScheduleOutcome::Started);
            scheduledFeedActive = true;
        } else {
            recordScheduleResult(schedule.id, minute, ScheduleOutcome::ServoUnavailable);
        }
        break;
    }
}
