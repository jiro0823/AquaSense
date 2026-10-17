#pragma once
class OneWire {
public:
    explicit OneWire(int pin) : pin_(pin) {}
    int pin() const { return pin_; }
private:
    int pin_;
};
