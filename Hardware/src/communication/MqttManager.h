#pragma once
#include <WiFi.h>
#include <PubSubClient.h>
#include <atomic>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>
#include "models/SensorReadings.h"

class MqttManager {
public:
    MqttManager();
    bool begin();
    void update(const SensorReadings& readings);
    bool isConnected() const;
    bool isRunning() const;

private:
    static void runTask(void* context);
    void run();
    bool publishReadings(const SensorReadings& readings);

    // Only the worker touches these network objects after begin().
    WiFiClient transport;
    PubSubClient client;
    TaskHandle_t task = nullptr;
    StaticQueue_t queueStorage;
    uint8_t queueBytes[sizeof(SensorReadings)];
    QueueHandle_t snapshots = nullptr; // One latest value, not an unbounded backlog.
    std::atomic<bool> connected{false};
    uint32_t lastQueuedSequence = 0;
};
