#include <Arduino.h>
#include "config.h"

/*
 * ESP32 Water Quality Sensor with MQTT
 * Reads 4 sensors and publishes data to MQTT broker
 *
 * Sensors:
 * - Temperature (DS18B20)
 * - pH (Analog sensor)
 * - Dissolved Oxygen (DO) (Analog sensor)
 * - Turbidity (Analog sensor)
 *
 * MQTT: Publishes to configured MQTT_TOPIC_READINGS
 * Backend: Subscribes and displays on dashboard
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
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

// ========== Function Prototypes ==========
void PublishStatus(const char* status);
void setupWiFi();
void setupMQTT();
void reconnectWiFi();
void reconnectMQTT();
void readSensors();
void publishSensorData();
void onMQTTMessage(char* topic, byte* payload, unsigned int length);
float readTemperature();
float readpH();
float readDO();
float readTurbidity();

void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("\n\n");
  Serial.println("╔════════════════════════════════════════╗");
  Serial.println("║  ESP32 Water Quality MQTT Sensor       ║");
  Serial.println("║  Connecting to Dashboard...            ║");
  Serial.println("╚════════════════════════════════════════╝");

  // Initialize OneWire for temperature
  tempSensor.begin();

  // Configure MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMQTTMessage);
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
    reconnectWiFi();
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
    readSensors();
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

    // Subscribe to command topics
    mqttClient.subscribe("capstone2026/water/commands/restart");
    mqttClient.subscribe("capstone2026/water/commands/threshold-update");
  } else {
    Serial.print("✗ MQTT Connection failed! State: ");
    Serial.println(mqttClient.state());
  }
}

// ========== WiFi Reconnect ==========
void reconnectWiFi() {
  if (millis() % 2000 == 0) {  // Log every 2 seconds
    Serial.println("WiFi disconnected - reconnecting...");
  }
  WiFi.reconnect();
}

// ========== MQTT Reconnect ==========
void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;

  if (!mqttClient.connected()) {
    Serial.print("Attempting MQTT connection...");

    if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD)) {
      Serial.println(" ✓ Connected");

      // Resubscribe to topics
      mqttClient.subscribe("capstone2026/water/commands/restart");
      mqttClient.subscribe("capstone2026/water/commands/threshold-update");

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
  float ph = readpH();
  float doLevel = readDO();
  float turbidity = readTurbidity();

  Serial.printf("  Temperature: %.2f°C\n", temp);
  Serial.printf("  pH:          %.2f\n", ph);
  Serial.printf("  DO:          %.2f mg/L\n", doLevel);
  Serial.printf("  Turbidity:   %.2f NTU\n", turbidity);
}

// ========== Publish Sensor Data ==========
void publishSensorData() {
  if (!mqttClient.connected()) {
    Serial.println("✗ MQTT not connected - skipping publish");
    return;
  }

  // Read sensors
  float temp = readTemperature();
  float ph = readpH();
  float doLevel = readDO();
  float turbidity = readTurbidity();

  // Create JSON payload
  StaticJsonDocument<256> doc;
  doc["temperature"] = temp;
  doc["ph"] = ph;
  doc["do"] = doLevel;
  doc["turbidity"] = turbidity;
  doc["location"] = "Tank A";
  doc["uptimeMs"] = millis(); // Uptime is not a Unix timestamp; backend stamps receipt time.

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

  if (temp == DEVICE_DISCONNECTED_C) {
    Serial.println("  ! Temperature sensor disconnected");
    return 0.0;
  }

  return temp;
}

float readpH() {
  // Read analog value
  int raw = analogRead(PH_SENSOR_PIN);

  // Detect disconnected probe (pin floating to GND or pulled to VCC)
  if (raw <= 10 || raw >= 4090) {
    Serial.println("  ! pH sensor disconnected or out of range");
    return -1.0; // Error code
  }

  // Convert to voltage
  float voltage = (raw / (float)ADC_MAX) * VOLTAGE_REF;

  // Standard calibration for many analog pH sensors (e.g. DF-Robot)
  // Voltage at pH 7 is usually 2.5V (if 5V powered) or ~1.65V (if 3.3V powered)
  // Adjust these based on actual buffer solutions!
  float ph = 3.5 * voltage - 2.0;  // Example calibration

  // Apply offset and scale
  ph = (ph * PH_SCALE) + PH_OFFSET;

  // Clamp to valid range
  if (ph < 0) ph = 0;
  if (ph > 14) ph = 14;

  return ph;
}

float readDO() {
  // Read analog value
  int raw = analogRead(DO_SENSOR_PIN);

  if (raw <= 10 || raw >= 4090) {
     return -1.0; // Error code for disconnected
  }

  // Convert to voltage
  float voltage = (raw / (float)ADC_MAX) * VOLTAGE_REF;

  // Convert voltage to DO (mg/L)
  float doLevel = (voltage / VOLTAGE_REF) * 15.0;

  // Apply offset and scale
  doLevel = (doLevel * DO_SCALE) + DO_OFFSET;

  // Clamp to valid range
  if (doLevel < 0) doLevel = 0;
  if (doLevel > 20) doLevel = 20;

  return doLevel;
}

float readTurbidity() {
  // Read multiple samples
  int samples = 15;
  int sum = 0;

  for (int i = 0; i < samples; i++) {
    sum += analogRead(TURBIDITY_SENSOR_PIN);
    delay(30);
  }

  int raw = sum / samples;

  if (raw <= 10) {
    Serial.println("  ! Turbidity sensor disconnected (0V)");
    return -1.0;
  }

  // Convert to voltage
  float voltage = (raw / (float)ADC_MAX) * VOLTAGE_REF;

  // Convert voltage to NTU ('\' Turbidity Units)
  float turbidity = 0.0;
  if (voltage > 2.5) {
    turbidity = 0.0; // Clean water
  } else {
    // Map 2.5V -> 0 NTU, 0V -> 150 NTU
    turbidity = (2.5 - voltage) * (150.0 / 2.5);
  }

  // Apply offset and scale
  turbidity = (turbidity * TURBIDITY_SCALE) + TURBIDITY_OFFSET;

  // Clamp to valid range
  if (turbidity < 0) turbidity = 0;
  if (turbidity > 150) turbidity = 150;

  return turbidity;
}

// ========== MQTT Message Handler ==========
void onMQTTMessage(char* topic, byte* payload, unsigned int length) {
  Serial.print("✓ MQTT Message received on topic: ");
  Serial.println(topic);

  // Convert payload to string
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.print("  Payload: ");
  Serial.println(message);

  // Handle commands
  if (strcmp(topic, "capstone2026/water/commands/restart") == 0) {
    Serial.println("  ! Restart command received - restarting in 2 seconds...");
    delay(2000);
    ESP.restart();
  }
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
