/*
 * ESP32 Water Quality Sensor with MQTT
 * Reads 4 sensors and publishes data to MQTT broker
 * 
 * Sensors:
 * - Temperature (DS18B20 or LM35)
 * - pH (Analog sensor)
 * - Dissolved Oxygen (DO) (Analog sensor)
 * - Turbidity (Analog sensor)
 * 
 * MQTT: Publishes to 'water/esp32/readings'
 * Backend: Subscribes and displays on dashboard
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ========== WiFi Configuration ==========
const char* WIFI_SSID = "YOUR_WIFI_SSID";          // Change this
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";  // Change this

// ========== MQTT Configuration ==========
const char* MQTT_BROKER = "broker.hivemq.com";            // Change to your PC IP (e.g., 192.168.1.100)
const int MQTT_PORT = 1883;
const char* MQTT_USERNAME = "";                    // Leave empty if no auth
const char* MQTT_PASSWORD = "";                    // Leave empty if no auth
const char* MQTT_TOPIC_READINGS = "capstone2026/water/esp32/readings";
const char* MQTT_TOPIC_STATUS = "capstone2026/water/esp32/status";
const char* MQTT_CLIENT_ID = "ESP32-WaterQuality-Sensor";

// ========== Sensor Pin Configuration ==========
#define TEMPERATURE_PIN 4        // GPIO4 (DS18B20 OneWire)
#define PH_SENSOR_PIN 34        // GPIO34 (ADC1_CH6) - Analog
#define DO_SENSOR_PIN 35        // GPIO35 (ADC1_CH7) - Analog
#define TURBIDITY_SENSOR_PIN 36 // GPIO36 (ADC1_CH0) - Analog

// ========== OneWire Setup for Temperature ==========
OneWire oneWire(TEMPERATURE_PIN);
DallasTemperature tempSensor(&oneWire);

// ========== WiFi and MQTT Clients ==========
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// ========== Global Variables ==========
unsigned long lastReadTime = 0;
unsigned long lastMQTTCheck = 0;
const unsigned long SENSOR_READ_INTERVAL = 5000;   // Read every 5 seconds
const unsigned long MQTT_CHECK_INTERVAL = 2000;    // Check connection every 2 seconds

// ========== Sensor Calibration Values ==========
const float PH_OFFSET = 0.0;           // Calibrate based on your sensor
const float PH_SCALE = 1.0;            // Calibrate based on your sensor
const float DO_OFFSET = 0.0;           // Calibrate based on your sensor
const float DO_SCALE = 1.0;            // Calibrate based on your sensor
const float TURBIDITY_OFFSET = 0.0;    // Calibrate based on your sensor
const float TURBIDITY_SCALE = 1.0;     // Calibrate based on your sensor

// ========== ADC Calibration ==========
const int ADC_MAX = 4095;              // ESP32 12-bit ADC
const float VOLTAGE_REF = 3.3;         // ESP32 reference voltage

// ========== Function Prototypes ==========
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
  doc["timestamp"] = millis();
  
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
  
  // Convert to voltage
  float voltage = (raw / (float)ADC_MAX) * VOLTAGE_REF;
  
  // Convert voltage to pH (adjust calibration as needed)
  // Typical: pH 4.0 = 2.5V, pH 7.0 = 2.8V, pH 10.0 = 3.2V
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
  
  // Convert to voltage
  float voltage = (raw / (float)ADC_MAX) * VOLTAGE_REF;
  
  // Convert voltage to DO (mg/L)
  // Typical: 0V = 0 mg/L, 3.3V = 15 mg/L
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
  
  // Convert to voltage
  float voltage = (raw / (float)ADC_MAX) * VOLTAGE_REF;
  
  // Convert voltage to NTU (Nephelometric Turbidity Units)
  // Simple linear approximation: Assume 2.5V is 0 NTU (clean) and 0V is 150 NTU (turbid).
  // Note: if using a 5V sensor straight into 3.3V ESP32 ADC, the voltage will cap at 3.3V.
  float turbidity = 0.0;
  if (voltage > 2.5) {
    turbidity = 0.0;
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
  doc["timestamp"] = millis();
  doc["rssi"] = WiFi.RSSI();
  
  String payload;
  serializeJson(doc, payload);
  
  mqttClient.publish(MQTT_TOPIC_STATUS, payload.c_str());
}

// ========== Flash LED ==========
void blinkLED(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(100);
    digitalWrite(LED_BUILTIN, LOW);
    delay(100);
  }
}
