#pragma once
#include <WiFi.h>
#include <PubSubClient.h>
#include <atomic>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>
#include "models/SensorReadings.h"
#include "models/Command.h"
#include "models/SystemState.h"

struct MqttActuatorCommand {
    Command command{};
    char source[9]{};
    char action[24]{};
};
struct MqttPendingAcknowledgement {
    MqttActuatorCommand command{};
    CommandReceipt receipt{};
};

class MqttManager
{
public:
    MqttManager();
    bool begin();
    void update(const SensorReadings &readings);
    bool isConnected() const;
    bool isRunning() const;

private:
    static void runTask(void *context);
    void run();
    bool publishReadings(const SensorReadings &readings);

    // Only the worker touches network objects. PubSubClient callback only validates and queues.
    WiFiClient transport;
    PubSubClient client;
    TaskHandle_t task = nullptr;
    StaticQueue_t queueStorage;
    uint8_t queueBytes[sizeof(SensorReadings)];
    QueueHandle_t snapshots = nullptr;
    QueueHandle_t commands = nullptr;
    QueueHandle_t states = nullptr;
    QueueHandle_t acknowledgements = nullptr;
    std::atomic<bool> connected{false};
    uint32_t lastQueuedSequence = 0;
    static MqttManager* callbackOwner;
};
