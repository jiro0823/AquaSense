#include <Arduino.h>
#include "config.h"

/*
 * ESP32 Water Quality Sensor with MQTT
 * Publishes only measurements supported by installed sensors.
 *
 * Sensors:
 * - Temperature (DS18B20)
 * - pH (Analog sensor)
 * - Turbidity (raw ADC diagnostic; no validated NTU conversion)
 *
 * MQTT: Publishes to configured MQTT_TOPIC_READINGS
 * Backend: Subscribes and displays on dashboard
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <math.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ========== OneWire Setup for Temperature ==========
OneWire oneWire(TEMPERATURE_PIN);
DallasTemperature tempSensor(&oneWire);

// ========== WiFi and MQTT Clients ==========
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// ========== Global Variables ==========
unsigned long lastReadTime = 0;
unsigned long lastMQTTCheck = 0;
uint32_t readingSequence = 0;
String bootId;
String deviceId;

// ========== Function Prototypes ==========
void PublishStatus(const char* status);
void setupWiFi();
void setupMQTT();
void reconnectWiFi();
void reconnectMQTT();

void publishSensorData();
float readTemperature();
float readTurbidity();

// The legacy analog equations are estimates only. Keep them unavailable until
// the installed probes have been calibrated against reference solutions.
constexpr bool ANALOG_CALIBRATION_VERIFIED = false;

void setup() {
  Serial.begin(115200);
  delay(2000);
  const uint64_t mac = ESP.getEfuseMac();
  deviceId = String((uint32_t)(mac >> 32), HEX) + String((uint32_t)mac, HEX);
  bootId = deviceId + String(esp_random(), HEX);

  Serial.println("\n\n");
  Serial.println("╔════════════════════════════════════════╗");
  Serial.println("║  ESP32 Water Quality MQTT Sensor       ║");
  Serial.println("║  Connecting to Dashboard...            ║");
  Serial.println("╚════════════════════════════════════════╝");

  // Initialize OneWire for temperature
  tempSensor.begin();

  // Configure MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setBufferSize(512); // Allow the full JSON payload plus MQTT topic/header.

  // Connect to WiFi
  setupWiFi();

  // Connect to MQTT
  setupMQTT();

  Serial.println("✓ Setup complete - starting sensor readings");
}

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastWiFiReconnect >= 10000) reconnectWiFi();
  }

  // Check MQTT connection periodically
  if (millis() - lastMQTTCheck >= MQTT_CHECK_INTERVAL) {
    if (!mqttClient.connected()) {
      reconnectMQTT();
    }
    lastMQTTCheck = millis();
  }

  // Keep MQTT connection alive
  mqttClient.loop();

  // Read sensors at interval
  if (millis() - lastReadTime >= SENSOR_READ_INTERVAL) {

    publishSensorData();
    lastReadTime = millis();
  }
}

// ========== WiFi Setup ==========
void setupWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi Connected!");
    Serial.print("  IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n✗ WiFi connection failed!");
    Serial.println("  Check SSID and Password");
  }
}

// ========== MQTT Setup ==========
void setupMQTT() {
  Serial.print("Connecting to MQTT Broker: ");
  Serial.print(MQTT_BROKER);
  Serial.print(":");
  Serial.println(MQTT_PORT);

  if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD)) {
    Serial.println("✓ MQTT Connected!");
    Serial.print("  Topic: ");
    Serial.println(MQTT_TOPIC_READINGS);

  } else {
    Serial.print("✗ MQTT Connection failed! State: ");
    Serial.println(mqttClient.state());
  }
}

// ========== WiFi Reconnect ==========
void reconnectWiFi() {
  lastWiFiReconnect = millis();
  Serial.println("WiFi disconnected - starting reconnect attempt...");
  WiFi.reconnect();
}

// ========== MQTT Reconnect ==========
void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;

  if (!mqttClient.connected()) {
    Serial.print("Attempting MQTT connection...");

    if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD)) {
      Serial.println(" ✓ Connected");

      // Publish status
      PublishStatus("online");
    } else {
      Serial.print(" ✗ Failed, state: ");
      Serial.println(mqttClient.state());
    }
  }
}

// ========== Sensor Reading ==========
void readSensors() {
  Serial.println("\n─── Sensor Reading ───");

  float temp = readTemperature();
  float turbidity = readTurbidity();

  Serial.printf("  Temperature: %.2f°C\n", temp);
  Serial.printf("  Turbidity raw ADC: %.0f\n", turbidity);
}

// ========== Publish Sensor Data ==========
void publishSensorData() {
  if (!mqttClient.connected()) {
    Serial.println("✗ MQTT not connected - skipping publish");
    return;
  }

  // Read sensors
  float temp = readTemperature();
  int phRaw = analogRead(PH_SENSOR_PIN);
  float turbidity = readTurbidity();

  // Create JSON payload
  StaticJsonDocument<384> doc;
  if (isfinite(temp)) doc["temperature"] = temp; else doc["temperature"] = nullptr;
  doc["ph"] = nullptr;
  doc["sensors"]["ph"]["rawAdc"] = phRaw;
  doc["sensors"]["ph"]["conversion"] = "UNVERIFIED";
  doc["turbidity"] = turbidity;
  doc["turbidityUnit"] = "raw_adc";
  doc["sensors"]["turbidity"]["rawAdc"] = (int)turbidity;
  doc["bootId"] = bootId;
  doc["deviceId"] = deviceId;
  doc["sequence"] = readingSequence++;
  doc["sampleAgeMs"] = 0;
  doc["location"] = "Tank A";

  // Serialize to string
  String payload;
  serializeJson(doc, payload);

  // Publish
  if (mqttClient.publish(MQTT_TOPIC_READINGS, payload.c_str())) {
    Serial.println("✓ Published to MQTT");
  } else {
    Serial.println("✗ Failed to publish to MQTT");
  }
}

// ========== Sensor Reading Functions ==========

float readTemperature() {
  tempSensor.requestTemperatures();
  float temp = tempSensor.getTempCByIndex(0);

  if (!isfinite(temp) || temp == DEVICE_DISCONNECTED_C || temp < -55 || temp > 125) {
    Serial.println("  ! Temperature sensor disconnected");
    return NAN;
  }

  return temp;
}

float readTurbidity() {
  const int samples = 15;
  int sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(TURBIDITY_SENSOR_PIN);
    delay(30);
  }
  return (float)(sum / samples);
}

// ========== Publish Status ==========
void PublishStatus(const char* status) {
  StaticJsonDocument<128> doc;
  doc["status"] = status;
  doc["timestamp"] = millis(); // Existing status protocol reports device uptime.
  doc["rssi"] = WiFi.RSSI();

  String payload;
  serializeJson(doc, payload);

  mqttClient.publish(MQTT_TOPIC_STATUS, payload.c_str());
}
