#include <Arduino.h>
#include "config.h"

#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>
#include <time.h>

// ===== Servo =====
Servo feederServo;
bool motorOnState = false;

// ===== Scheduler State =====
struct FeedingSchedule {
  String id;
  String date; // optional YYYY-MM-DD, empty means daily
  String time; // HH:mm
  String label;
};

FeedingSchedule schedules[20];
int scheduleCount = 0;
String firedKeys[20]; // per schedule anti-repeat cache (id + date + time + minute)

unsigned long lastSyncMs = 0;

void connectWiFi() {
  Serial.print("Connecting WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

void syncNtpTime() {
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2, NTP_SERVER_3);
  struct tm timeinfo;
  int tries = 0;
  while (!getLocalTime(&timeinfo) && tries < 20) {
    delay(500);
    Serial.print("#");
    tries++;
  }
  Serial.println();
  if (tries >= 20) {
    Serial.println("NTP sync failed");
  } else {
    Serial.println("NTP sync success");
  }
}

String currentDate() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "";
  char buf[11];
  strftime(buf, sizeof(buf), "%Y-%m-%d", &timeinfo);
  return String(buf);
}

String currentTimeHHMM() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "";
  char buf[6];
  strftime(buf, sizeof(buf), "%H:%M", &timeinfo);
  return String(buf);
}

String currentMinuteKey() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "";
  char buf[17];
  strftime(buf, sizeof(buf), "%Y%m%d%H%M", &timeinfo);
  return String(buf);
}

void runFeedCycle() {
  Serial.println("Feeding cycle start");
  feederServo.write(25);
  delay(800);
  feederServo.write(140);
  delay(1000);
  feederServo.write(25);
  delay(800);
  Serial.println("Feeding cycle done");
}

void setMotorOn() {
  motorOnState = true;
  feederServo.write(140);
  Serial.println("Motor ON");
}

void setMotorOff() {
  motorOnState = false;
  feederServo.write(25);
  Serial.println("Motor OFF");
}

bool isAlreadyFired(const String& key) {
  for (int i = 0; i < 20; i++) {
    if (firedKeys[i] == key) return true;
  }
  return false;
}

void markFired(const String& key) {
  // replace first empty slot, otherwise rotate index 0
  for (int i = 0; i < 20; i++) {
    if (firedKeys[i].length() == 0) {
      firedKeys[i] = key;
      return;
    }
  }
  for (int i = 1; i < 20; i++) {
    firedKeys[i - 1] = firedKeys[i];
  }
  firedKeys[19] = key;
}

void postAckCommand(const String& commandId, const String& resultText) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(API_BASE_URL) + "/feeding/device/ack";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  StaticJsonDocument<256> body;
  body["deviceId"] = DEVICE_ID;
  body["commandId"] = commandId;
  body["result"] = resultText;

  String bodyText;
  serializeJson(body, bodyText);
  int code = http.POST(bodyText);
  Serial.printf("ACK status: %d\n", code);
  http.end();
}

void executePendingCommand(JsonObject command) {
  String commandId = command["id"] | "";
  String action = command["action"] | "";
  action.toUpperCase();

  if (action == "TRIGGER") {
    runFeedCycle();
    postAckCommand(commandId, "triggered");
  } else if (action == "ON") {
    setMotorOn();
    postAckCommand(commandId, "motor_on");
  } else if (action == "OFF") {
    setMotorOff();
    postAckCommand(commandId, "motor_off");
  }
}

void syncFromServer() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(API_BASE_URL) + "/feeding/device/sync";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  StaticJsonDocument<128> req;
  req["deviceId"] = DEVICE_ID;
  String body;
  serializeJson(req, body);

  int code = http.POST(body);
  if (code < 200 || code >= 300) {
    Serial.printf("Sync failed: HTTP %d\n", code);
    http.end();
    return;
  }

  String response = http.getString();
  http.end();

  DynamicJsonDocument doc(8192);
  DeserializationError err = deserializeJson(doc, response);
  if (err) {
    Serial.println("JSON parse error in sync response");
    return;
  }

  JsonArray arr = doc["data"]["schedules"].as<JsonArray>();
  scheduleCount = 0;
  for (JsonObject item : arr) {
    if (scheduleCount >= 20) break;
    schedules[scheduleCount].id = String((const char*)item["id"]);
    schedules[scheduleCount].date = String((const char*)item["date"]);
    if (schedules[scheduleCount].date == "null") schedules[scheduleCount].date = "";
    schedules[scheduleCount].time = String((const char*)item["time"]);
    schedules[scheduleCount].label = String((const char*)item["label"]);
    scheduleCount++;
  }

  JsonObject pending = doc["data"]["pendingCommand"];
  if (!pending.isNull()) {
    executePendingCommand(pending);
  }

  Serial.printf("Sync success. schedules=%d\n", scheduleCount);
}

void checkScheduledFeeding() {
  String nowDate = currentDate();
  String nowTime = currentTimeHHMM();
  String minuteKey = currentMinuteKey();
  if (nowTime.length() == 0 || minuteKey.length() == 0) return;

  for (int i = 0; i < scheduleCount; i++) {
    const FeedingSchedule& s = schedules[i];
    if (s.time != nowTime) continue;
    if (s.date.length() > 0 && s.date != nowDate) continue;

    String fireKey = s.id + "|" + nowDate + "|" + nowTime + "|" + minuteKey;
    if (isAlreadyFired(fireKey)) continue;

    runFeedCycle();
    markFired(fireKey);
    Serial.printf("Scheduled feeding done: %s %s\n", nowDate.c_str(), nowTime.c_str());
  }
}

void setup() {
  Serial.begin(115200);
  feederServo.attach(SERVO_PIN);
  setMotorOff();

  connectWiFi();
  syncNtpTime();
  syncFromServer();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    syncNtpTime();
  }

  unsigned long now = millis();
  if (now - lastSyncMs > SYNC_INTERVAL_MS) {
    lastSyncMs = now;
    syncFromServer();
  }

  checkScheduledFeeding();
  delay(500);
}
