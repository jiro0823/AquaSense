#pragma once

#if __has_include("device_config.local.h")
#include "device_config.local.h"
#else
#include "device_config.example.h"
#endif

// Servo wiring
const int SERVO_PIN = 13;

// ===== NTP =====
const long GMT_OFFSET_SEC = 8 * 3600;   // Philippines UTC+8
const int DAYLIGHT_OFFSET_SEC = 0;
constexpr const char* NTP_SERVER_1 = "pool.ntp.org";
constexpr const char* NTP_SERVER_2 = "time.nist.gov";
constexpr const char* NTP_SERVER_3 = "asia.pool.ntp.org";

const unsigned long SYNC_INTERVAL_MS = 30000;
