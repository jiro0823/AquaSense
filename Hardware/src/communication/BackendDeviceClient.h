#pragma once
#include <ArduinoJson.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>
#include "models/SystemState.h"
#include "models/Command.h"
#include "models/FeedingSchedule.h"

// One authenticated control transport for hardware commands and existing feeding.
// Network I/O stays off the controller task; only POD snapshots cross queues.
class BackendDeviceClient {
public:
    bool begin();
    void update(const SystemState& state);
    bool takeCommand(Command& command);
    bool takeSchedules(FeedingSchedules& schedules);
    void acknowledge(const CommandReceipt& receipt);
private:
    static void taskEntry(void* context);
    void run();
    bool sync(const SystemState& state, const CommandReceipt* receipt);
    void decode(uint32_t elapsedMs);
    static CommandAction parseAction(const char* action, bool feeding);
    QueueHandle_t states = nullptr, commands = nullptr, receipts = nullptr, schedulesQueue = nullptr;
    TaskHandle_t task = nullptr;
    StaticJsonDocument<8192> document;
    char deliveredId[37] = {};
};
