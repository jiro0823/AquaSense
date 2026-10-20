#include "SystemController.h"
#include <Arduino.h>
#include <string.h>
#include "config/DeviceConfig.h"
#include "config/Thresholds.h"

namespace {
bool alarmThresholdsReady() {
    return Thresholds::SENSOR_ALARM_CONFIGURED &&
        Thresholds::SENSOR_ALARM_PH_LOW < Thresholds::SENSOR_ALARM_PH_HIGH &&
        Thresholds::SENSOR_ALARM_TEMPERATURE_LOW_C < Thresholds::SENSOR_ALARM_TEMPERATURE_HIGH_C &&
        Thresholds::SENSOR_ALARM_TURBIDITY_HIGH_NTU > 0.0f &&
        Thresholds::SENSOR_ALARM_ORP_LOW_MV < Thresholds::SENSOR_ALARM_ORP_HIGH_MV;
}

bool hasCriticalSensorReading(const SensorReadings& readings, uint32_t nowMs) {
    if (!alarmThresholdsReady() || readings.sequence == 0 ||
        uint32_t(nowMs - readings.sampledAtMs) > DeviceConfig::TELEMETRY_MAX_AGE_MS) return false;

    return (readings.phValid && (readings.ph < Thresholds::SENSOR_ALARM_PH_LOW ||
                                 readings.ph > Thresholds::SENSOR_ALARM_PH_HIGH)) ||
        (readings.temperatureValid && (readings.temperatureC < Thresholds::SENSOR_ALARM_TEMPERATURE_LOW_C ||
                                       readings.temperatureC > Thresholds::SENSOR_ALARM_TEMPERATURE_HIGH_C)) ||
        (readings.turbidityValid && readings.turbidityRaw > Thresholds::SENSOR_ALARM_TURBIDITY_HIGH_NTU) ||
        (readings.orpValid && (readings.orpMv < Thresholds::SENSOR_ALARM_ORP_LOW_MV ||
                               readings.orpMv > Thresholds::SENSOR_ALARM_ORP_HIGH_MV));
}
}

void SystemController::begin() {
    if (!DeviceConfig::COMMAND_CONTROL_ENABLED) {
        storageReady = false;
        return;
    }
    storageReady = storage.begin("aq-commands", false);
    if (!storageReady) return;
    // Keep the prior single-ID key in the duplicate check across firmware upgrades.
    storage.getString("last-id", legacyLastId, sizeof(legacyLastId));
    nextHandledSlot = storage.getUChar("ring-next", 0) % HANDLED_COMMAND_RING_SIZE;
    for (uint8_t i = 0; i < HANDLED_COMMAND_RING_SIZE; ++i) {
        char key[8]; snprintf(key, sizeof(key), "id%u", unsigned(i));
        storage.getString(key, handledIds[i], sizeof(handledIds[i]));
    }
}

bool SystemController::hasHandled(const char* id) const {
    if (!id || !id[0]) return false;
    if (!strcmp(legacyLastId, id)) return true;
    for (uint8_t i = 0; i < HANDLED_COMMAND_RING_SIZE; ++i)
        if (handledIds[i][0] && !strcmp(handledIds[i], id)) return true;
    return false;
}

bool SystemController::rememberHandled(const char* id) {
    const uint8_t slot = nextHandledSlot;
    strlcpy(handledIds[slot], id, sizeof(handledIds[slot]));
    nextHandledSlot = uint8_t((slot + 1) % HANDLED_COMMAND_RING_SIZE);
    if (!storageReady) return false;
    char key[8]; snprintf(key, sizeof(key), "id%u", unsigned(slot));
    const size_t written = storage.putString(key, id);
    if (written != strlen(id)) return false;
    return storage.putUChar("ring-next", nextHandledSlot) > 0;
}

CommandReceipt SystemController::handle(const Command& command, uint32_t nowMs) {
    CommandReceipt receipt{}; strlcpy(receipt.id, command.id, sizeof(receipt.id)); receipt.feedingSource = command.feedingSource;
    if (!DeviceConfig::COMMAND_CONTROL_ENABLED || !DeviceConfig::ACTUATOR_CONTROL_ENABLED) {
        strlcpy(receipt.result, "offline_calibration_mode", sizeof(receipt.result));
        return receipt;
    }
    const char* result;
    const bool knownAction = [&]() {
        switch (command.action) {
            case CommandAction::Fill: case CommandAction::Drain: case CommandAction::WaterExchange:
            case CommandAction::WaterStop: case CommandAction::AeratorOn: case CommandAction::AeratorOff:
            case CommandAction::AeratorAuto: case CommandAction::AutomationOn: case CommandAction::AutomationOff:
            case CommandAction::BuzzerOn: case CommandAction::BuzzerOff: case CommandAction::AllOff:
            case CommandAction::ClearFault: case CommandAction::FeedTrigger: case CommandAction::FeedOn:
            case CommandAction::FeedOff: return true;
            default: return false;
        }
    }();
    const bool stopping = command.action == CommandAction::AllOff || command.action == CommandAction::WaterStop ||
        command.action == CommandAction::FeedOff || command.action == CommandAction::AeratorOff || command.action == CommandAction::BuzzerOff;
    if (!knownAction) result = "invalid_action";
    else if (stopping) {
        // Stop commands are safety actions: TTL expiry and duplicate suppression
        // must never prevent them from reaching the local actuator controllers.
        result = dispatch(command, nowMs);
        strlcpy(legacyLastId, command.id, sizeof(legacyLastId));
        if (storageReady) storage.putString("last-id", command.id);
    }
    else if (command.ttlMs == 0 || command.ttlMs > DeviceConfig::COMMAND_MAX_TTL_MS || uint32_t(nowMs - command.receivedAtMs) >= command.ttlMs) result = "expired";
    else if (hasHandled(command.id)) result = "duplicate_suppressed";
    else if (!storageReady || !rememberHandled(command.id)) result = "persistence_unavailable";
    else result = dispatch(command, nowMs);
    strlcpy(receipt.result, result, sizeof(receipt.result));
    // A rejected command must never leave a prior relay action running. Replayed
    // commands are ignored without disturbing the original accepted operation.
    if (strcmp(result, "accepted") && strcmp(result, "duplicate_suppressed")) stopRelayActuators(nowMs);
    return receipt;
}
const char* SystemController::dispatch(const Command& command, uint32_t nowMs) {
    switch (command.action) {
        case CommandAction::Fill: case CommandAction::Drain: case CommandAction::WaterExchange: case CommandAction::WaterStop:
            return water.request(command.action, command.durationMs, nowMs);
        case CommandAction::AeratorOn: return aerator.setManual(true);
        case CommandAction::AeratorOff: return aerator.setManual(false);
        case CommandAction::AeratorAuto: return aerator.setAutomatic();
        case CommandAction::AutomationOn: return water.setAutomatic(true, nowMs);
        case CommandAction::AutomationOff: return water.setAutomatic(false, nowMs);
        case CommandAction::BuzzerOn: buzzer.setManual(true); return "accepted";
        case CommandAction::BuzzerOff: buzzer.setManual(false); return "accepted";
        case CommandAction::ClearFault: return water.clearFault();
        case CommandAction::AllOff:
            water.request(CommandAction::WaterStop, 0, nowMs);
            aerator.setManual(false);
            feeder.stop();
            buzzer.setManual(false);
            return relays.allOff() ? "accepted" : "outputs_not_configured";
        case CommandAction::FeedTrigger: case CommandAction::FeedOn: case CommandAction::FeedOff: return feeder.request(command.action, nowMs);
        default: return "invalid_action";
    }
}
void SystemController::update(const SensorReadings& readings, uint32_t nowMs) {
    if (!DeviceConfig::ACTUATOR_CONTROL_ENABLED) return;
    water.update(readings, nowMs);
    aerator.update(readings, nowMs);
    feeder.update(nowMs);
    buzzer.update(hasCriticalSensorReading(readings, nowMs), nowMs);
}
void SystemController::stopRelayActuators(uint32_t nowMs) {
    if (!DeviceConfig::ACTUATOR_CONTROL_ENABLED) return;
    water.setAutomatic(false, nowMs);
    aerator.setManual(false);
    relays.allOff();
}
void SystemController::report(SystemState& state) const {
    state.fillPump = relays.fillOn(); state.drainPump = relays.drainOn(); state.aerator = relays.aeratorOn();
    state.feederBusy = feeder.isBusy(); state.buzzer = buzzer.isActive(); state.automation = water.isAutomatic();
    state.relaysReady = relays.isReady();
    strlcpy(state.waterPhase, water.phaseName(), sizeof(state.waterPhase)); strlcpy(state.fault, water.fault(), sizeof(state.fault));
}
