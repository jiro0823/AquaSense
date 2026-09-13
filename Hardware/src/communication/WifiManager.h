#pragma once
#include <stdint.h>

class WifiManager {
public:
    void begin();
    void update(uint32_t nowMs);
    bool isConnected() const;
private:
    uint32_t lastReconnectMs = 0;
    bool wasConnected = false;
};
