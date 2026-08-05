#include <WiFi.h>
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// WIFI
const char* ssid = "PLDTHOMEFIBRgSChC";
const char* password = "PLDTWIFIGkUeS";

// MQTT
const char* mqtt_server = "broker.hivemq.com";

// PIN SETUP (based on your board)
#define PH_PIN 35       // P34
#define TURB_PIN 34    // SVP (GPIO 36)
#define ONE_WIRE_BUS 4   // P4

// TEMP SENSOR
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// MQTT
WiFiClient espClient;
PubSubClient client(espClient);

// VARIABLES
float phValue = 0;
float turbidity = 0;
float temperature = 0;

// SMOOTHING
float smooth(float prev, float current) {
  return (prev * 0.7) + (current * 0.3);
}

// WIFI CONNECT
void setup_wifi() {
  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected!");
}

// MQTT RECONNECT
void reconnect() {
  while (!client.connected()) {
    Serial.print("Connecting to MQTT...");
    if (client.connect("ESP32_AquaSense")) {
      Serial.println("Connected!");
    } else {
      Serial.print("Failed, rc=");
      Serial.print(client.state());
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);

  analogSetAttenuation(ADC_11db); // full range

  setup_wifi();
  client.setServer(mqtt_server, 1883);

  sensors.begin();
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // 🌡️ TEMPERATURE
  sensors.requestTemperatures();
  float tempReading = sensors.getTempCByIndex(0);
  temperature = smooth(temperature, tempReading);

  // 🌊 TURBIDITY (average)
  int turbRaw = 0;
  for (int i = 0; i < 10; i++) {
    turbRaw += analogRead(TURB_PIN);
    delay(10);
  }
  turbRaw /= 10;
  turbidity = smooth(turbidity, turbRaw);

  // 🧪 PH SENSOR (average)
  int phRaw = 0;
  for (int i = 0; i < 10; i++) {
    phRaw += analogRead(PH_PIN);
    delay(10);
  }
  phRaw /= 10;

  float voltage = phRaw * (3.3 / 4095.0);

  // ⚠️ Calibration needed (this is default estimate)
  phValue = 7 + ((2.5 - voltage) / 0.18);

  // 📡 MQTT PUBLISH
  client.publish("aquasense/temperature", String(temperature).c_str());
  client.publish("aquasense/turbidity", String(turbidity).c_str());
  client.publish("aquasense/ph", String(phValue).c_str());

  // DEBUG
  Serial.println("===== SENSOR DATA =====");
  Serial.print("Temp: "); Serial.println(temperature);
  Serial.print("Turbidity: "); Serial.println(turbidity);
  Serial.print("pH: "); Serial.println(phValue);

  delay(5000);
}