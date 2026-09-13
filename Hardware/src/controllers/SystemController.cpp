#include "SystemController.h"
#include <Arduino.h>
#include <string.h>
#include "config/DeviceConfig.h"

void SystemController::begin() {
    storageReady = storage.begin("aq-commands", false);
    if (storageReady) storage.getString("last-id", lastId, sizeof(lastId));
}
CommandReceipt SystemController::handle(const Command& command, uint32_t nowMs) {
    CommandReceipt receipt{}; strlcpy(receipt.id, command.id, sizeof(receipt.id)); receipt.feedingSource = command.feedingSource;
    const char* result;
    const bool stopping = command.action == CommandAction::AllOff || command.action == CommandAction::WaterStop ||
        command.action == CommandAction::FeedOff || command.action == CommandAction::AeratorOff || command.action == CommandAction::BuzzerOff;
    if (command.ttlMs == 0 || command.ttlMs > DeviceConfig::COMMAND_MAX_TTL_MS || uint32_t(nowMs - command.receivedAtMs) >= command.ttlMs) result = "expired";
    else if (!strcmp(lastId, command.id)) result = "duplicate_suppressed";
    else if (!stopping && (!storageReady || storage.putString("last-id", command.id) == 0)) result = "persistence_unavailable";
    else {
        strlcpy(lastId, command.id, sizeof(lastId));
        if (stopping && storageReady) storage.putString("last-id", command.id);
        result = dispatch(command, nowMs);
    }
    strlcpy(receipt.result, result, sizeof(receipt.result)); return receipt;
}
const char* SystemController::dispatch(const Command& command, uint32_t nowMs) {
    switch (command.action) {
        case CommandAction::Fill: case CommandAction::Drain: case CommandAction::WaterExchange: case CommandAction::WaterStop:
            return water.request(command.action, command.durationMs, nowMs);
        case CommandAction::AeratorOn: return aerator.setManual(true);
        case CommandAction::AeratorOff: return aerator.setManual(false);
        case CommandAction::AeratorAuto: return aerator.setAutomatic();
        case CommandAction::AutomationOn: return water.setAutomatic(true);
        case CommandAction::AutomationOff: return water.setAutomatic(false);
        case CommandAction::BuzzerOn: buzzer.setManual(true); return "accepted";
        case CommandAction::BuzzerOff: buzzer.setManual(false); return "accepted";
        case CommandAction::ClearFault: return water.clearFault();
        case CommandAction::AllOff:
            water.setAutomatic(false); aerator.setManual(false); feeder.stop(); buzzer.setManual(false); relays.allOff(); return "accepted";
        case CommandAction::FeedTrigger: case CommandAction::FeedOn: case CommandAction::FeedOff: return feeder.request(command.action, nowMs);
        default: return "invalid_action";
    }
}
void SystemController::update(const SensorReadings& readings, uint32_t nowMs) {
    water.update(readings, nowMs);
    aerator.update(readings, nowMs);
    feeder.update(nowMs);
    buzzer.update(water.fault()[0] != '\0', nowMs);
}
void SystemController::report(SystemState& state) const {
    state.fillPump = relays.fillOn(); state.drainPump = relays.drainOn(); state.aerator = relays.aeratorOn();
    state.feederBusy = feeder.isBusy(); state.buzzer = buzzer.isActive(); state.automation = water.isAutomatic();
    state.relaysReady = relays.isReady();
    strlcpy(state.waterPhase, water.phaseName(), sizeof(state.waterPhase)); strlcpy(state.fault, water.fault(), sizeof(state.fault));
}
