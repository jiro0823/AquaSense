#include "FeedingManager.h"
#include <Arduino.h>
#include <string.h>
#include "config/ActuatorConfig.h"
#include "config/Pins.h"
#include "controllers/ControlSafety.h"

void FeedingManager::begin() {
    storageReady = storage.begin("aq-feeding", false);
    if (storageReady) {
        if (storage.getBytesLength("schedules") == sizeof(schedules)) storage.getBytes("schedules", &schedules, sizeof(schedules));
        if (schedules.count > MAX_FEEDING_SCHEDULES) schedules = FeedingSchedules{};
        if (storage.getBytesLength("fired") == sizeof(fired)) storage.getBytes("fired", fired, sizeof(fired));
    }
    if (!ActuatorConfig::FEEDER_ENABLED) return;
    servo.attach(Pins::Diagram::SERVO);
    ready = servo.attached();
    stop();
}
void FeedingManager::stop() {
    if (ready) servo.write(ActuatorConfig::FEEDER_CLOSED_DEGREES);
    phase = Phase::Idle;
    manualMinute = timeManager.localMinute();
}
void FeedingManager::start(uint32_t nowMs) {
    servo.write(ActuatorConfig::FEEDER_CLOSED_DEGREES);
    phase = Phase::Closing; phaseStartedMs = nowMs;
}
const char* FeedingManager::request(CommandAction action, uint32_t nowMs) {
    manualMinute = timeManager.localMinute();
    if (!ready) return "feeder_disabled";
    if (action == CommandAction::FeedOff) { stop(); return "accepted"; }
    if (isBusy()) return "feeder_busy";
    if (action == CommandAction::FeedTrigger) { start(nowMs); return "accepted"; }
    if (action == CommandAction::FeedOn) {
        servo.write(ActuatorConfig::FEEDER_OPEN_DEGREES);
        phase = Phase::Hold; phaseStartedMs = nowMs; return "accepted";
    }
    return "invalid_action";
}
void FeedingManager::setSchedules(const FeedingSchedules& next) {
    if (!storageReady || next.count > MAX_FEEDING_SCHEDULES) return;
    bool same = next.count == schedules.count;
    for (uint8_t i = 0; same && i < next.count; ++i) {
        same = strcmp(next.items[i].id, schedules.items[i].id) == 0 &&
               strcmp(next.items[i].date, schedules.items[i].date) == 0 && strcmp(next.items[i].time, schedules.items[i].time) == 0;
    }
    if (same) return;
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
    if (!ready) return;
    if (phase == Phase::Closing && ControlSafety::elapsed(nowMs, phaseStartedMs, ActuatorConfig::FEEDER_CLOSE_MS)) {
        servo.write(ActuatorConfig::FEEDER_OPEN_DEGREES); phase = Phase::Opening; phaseStartedMs = nowMs;
    } else if (phase == Phase::Opening && ControlSafety::elapsed(nowMs, phaseStartedMs, ActuatorConfig::FEEDER_OPEN_MS)) {
        servo.write(ActuatorConfig::FEEDER_CLOSED_DEGREES); phase = Phase::Finishing; phaseStartedMs = nowMs;
    } else if (phase == Phase::Finishing && ControlSafety::elapsed(nowMs, phaseStartedMs, ActuatorConfig::FEEDER_FINISH_MS)) {
        phase = Phase::Idle;
    } else if (phase == Phase::Hold && ControlSafety::elapsed(nowMs, phaseStartedMs, ActuatorConfig::FEEDER_MANUAL_HOLD_MAX_MS)) stop();
    const int64_t minute = timeManager.localMinute();
    if (isBusy() || minute < 0 || minute == manualMinute) return;
    char date[11], clock[6]; timeManager.localDateAndTime(date, clock);
    for (uint8_t i = 0; i < schedules.count; ++i) {
        const auto& schedule = schedules.items[i];
        if (strcmp(schedule.time, clock) == 0 && (!schedule.date[0] || strcmp(schedule.date, date) == 0) &&
            markSchedule(schedule.id, minute)) { start(nowMs); break; }
    }
}
