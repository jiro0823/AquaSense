#pragma once

class RelayController {
public:
    void begin();
    bool setPumps(bool fill, bool drain);
    bool setAerator(bool on);
    void allOff();
    bool isReady() const { return ready; }
    bool fillOn() const { return fill; }
    bool drainOn() const { return drain; }
    bool aeratorOn() const { return air; }
private:
    void writeRelay(int pin, bool on);
    bool ready = false;
    bool fill = false, drain = false, air = false;
};
