# MQTT Setup Guide - Complete Step-by-Step

## Architecture Overview
```
┌──────────┐         ┌─────────────┐         ┌──────────┐         ┌───────────┐
│   ESP32  │────────▶│   MQTT      │────────▶│ Node.js  │────────▶│ Dashboard │
│ (Sensor) │ Publish │   Broker    │ Listen  │(Backend) │ WebSocket│(React)    │
└──────────┘         └─────────────┘         └──────────┘         └───────────┘
  Reads sensors   Mosquitto Server         Processes data      Display real-time
  Every 5 sec     Port 1883                 Updates DB          charts & alerts
```

---

## Complete Step-by-Step Setup

### STEP 1: Install MQTT Broker (Mosquitto)

#### Option A: Windows Standalone
1. Download from: https://mosquitto.org/download/
2. Run installer
3. Default installation path: `C:\Program Files\mosquitto`
4. Start Mosquitto:
   ```bash
   cd "C:\Program Files\mosquitto"
   mosquitto.exe -c mosquitto.conf
   ```
5. Should show: `1683115200: mosquitto version 2.x.x starting`

#### Option B: Windows with Docker (Recommended)
```bash
# Install Docker Desktop first: https://www.docker.com/products/docker-desktop

# Run Mosquitto in Docker
docker run -d --name mosquitto -p 1883:1883 -p 9001:9001 eclipse-mosquitto

# Check if running
docker ps | findstr mosquitto
```

#### Option C: WSL2 (Windows Subsystem for Linux)
```bash
wsl
sudo apt update
sudo apt install mosquitto mosquitto-clients
sudo systemctl start mosquitto
sudo systemctl status mosquitto
```

### STEP 2: Test MQTT Broker

Open PowerShell and verify broker is listening:
```powershell
netstat -ano | Select-String ":1883"
# Should show: TCP [::1]:1883 [::]:0 LISTENING
```

Or use MQTT client:
```bash
# Install MQTT Explorer from: http://mqtt-explorer.com/
# Connect to: localhost:1883
# Should connect successfully
```

---

### STEP 3: Update ESP32 Arduino Code

1. **Open Arduino IDE**
   - File → New Sketch
   - Copy content from `ESP32_Water_Quality_MQTT.ino`

2. **Install Required Libraries**
   ```
   Sketch → Include Library → Manage Libraries
   
   Search and install:
   - "PubSubClient" by Nick O'Leary
   - "ArduinoJson" by Benoit Blanchon
   - "Dallas Temperature" by Miles Burton
   ```

3. **Update Configuration**
   ```cpp
   // Line 14-15: WiFi
   const char* WIFI_SSID = "YOUR_WIFI_SSID";          // ← Change this
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";  // ← Change this
   
   // Line 19: MQTT Broker IP (Your PC IP Address)
   const char* MQTT_BROKER = "YOUR_PC_IP";  // ← Change this (e.g., 192.168.1.100)
   ```

4. **Find Your PC IP Address**
   ```powershell
   # Windows PowerShell
   ipconfig
   # Look for "IPv4 Address" under your network adapter (e.g., 192.168.1.100)
   ```

5. **Sensor Pin Configuration** (Update if using different pins)
   ```cpp
   #define TEMPERATURE_PIN 4        // GPIO4
   #define PH_SENSOR_PIN 34        // GPIO34
   #define DO_SENSOR_PIN 35        // GPIO35
   #define TURBIDITY_SENSOR_PIN 36 // GPIO36
   ```

6. **Upload to ESP32**
   - Tools → Board → ESP32 Dev Module
   - Tools → Port → Select COM port
   - Upload (Ctrl+U)

---

### STEP 4: Start Your Dashboard System

#### Terminal 1: MQTT Broker
```bash
# Windows (standalone)
cd "C:\Program Files\mosquitto"
mosquitto.exe -c mosquitto.conf

# Or Docker
docker start mosquitto
```

#### Terminal 2: Backend Server
```bash
cd d:\xampp\htdocs\CAPSTONE_PROJECT\Backend
npm run dev
# Should show: ✓ MQTT Service initialized
```

#### Terminal 3: Frontend Server
```bash
cd d:\xampp\htdocs\CAPSTONE_PROJECT\Frontend
npm run dev
# Should show: ➜ Local: http://localhost:3001
```

---

### STEP 5: Monitor MQTT Data Flow

#### Option A: Use MQTT Explorer
1. Download: http://mqtt-explorer.com/
2. Settings → Add Connection
   - Host: localhost (or your PC IP)
   - Port: 1883
3. Browse `water/esp32` topics to see live data

#### Option B: Use Command Line
```bash
# Subscribe to all ESP32 topics (PowerShell)
mosquitto_sub -h localhost -t "water/esp32/#"

# Watch for messages like:
# Topic: water/esp32/readings
# {"temperature":24.5,"ph":7.4,"do":8.2,"turbidity":25,...}
```

#### Option C: Terminal - Watch Backend Logs
```bash
# Backend terminal should show:
# [INFO] [ESP32] Sensor reading received: Temp=24.5°C, pH=7.4, DO=8.2, Turbidity=25
```

---

### STEP 6: View on Dashboard

1. Open browser: `http://localhost:3001`
2. Login with your account
3. Navigate to Dashboard
4. Should see:
   - ✅ "Connected" status (green)
   - 📊 Live charts updating with sensor data
   - 🌡️ Temperature, pH, DO, Turbidity gauges
   - ⚠️ Alerts if values exceed thresholds

---

## MQTT Topics & Messages

### Sensor Data Topic
**Topic:** `water/esp32/readings`
```json
{
  "temperature": 24.5,
  "ph": 7.4,
  "do": 8.2,
  "turbidity": 25,
  "location": "Tank A",
  "timestamp": 1683115200000
}
```

### Status Topic
**Topic:** `water/esp32/status`
```json
{
  "status": "online",
  "timestamp": 1683115200000,
  "rssi": -65
}
```

### Command Topics
**Topic:** `water/commands/restart`
- Payload: `{}`
- Effect: Restarts ESP32

**Topic:** `water/commands/threshold-update`
```json
{
  "temperature": {"min": 15, "max": 35, "warning": 30},
  "ph": {"min": 6.5, "max": 8.5},
  "do": {"min": 5, "critical": 3},
  "turbidity": {"max": 100, "warning": 50}
}
```

---

## Troubleshooting

### ESP32 not connecting to WiFi
- ❌ Check WIFI_SSID and WIFI_PASSWORD
- ❌ Check if WiFi is 2.4GHz (ESP32 doesn't support 5GHz)
- ✅ Solution: Update credentials and re-upload

### ESP32 not connecting to MQTT
- ❌ Check MQTT_BROKER IP is correct
- ❌ Check Mosquitto broker is running (`netstat -ano | Select-String ":1883"`)
- ❌ Check firewall isn't blocking port 1883
- ✅ Solution: Run `mosquitto` from Windows firewall exceptions

### Backend not receiving MQTT data
- ❌ Check backend MQTT logs (should show "MQTT Service initialized")
- ❌ Check MQTT topic is exactly `water/esp32/readings`
- ✅ Solution: Check backend console for MQTT connection status

### Dashboard not updating
- ❌ Check WebSocket connection (browser console)
- ❌ Check backend and frontend are both running
- ✅ Solution: Refresh browser (F5) and check console logs

### Test MQTT Connection Manually
```powershell
# Publish test data to your MQTT topic
# (using MQTT CLI or Python)

# Python test (if installed):
python -c "
import paho.mqtt.client as mqtt
client = mqtt.Client()
client.connect('localhost', 1883, 60)
client.publish('water/esp32/readings', '{\"temperature\":24.5,\"ph\":7.4,\"do\":8.2,\"turbidity\":25}')
client.disconnect()
print('✓ Test message published')
"
```

---

## Sensor Calibration

### pH Sensor Calibration
1. Get pH 4.0 and pH 7.0 buffer solutions
2. Read raw ADC values in each solution
3. Update formula in code:
   ```cpp
   // Adjust this formula based on readings
   float ph = 3.5 * voltage - 2.0;
   ```

### DO (Dissolved Oxygen) Calibration
1. Calibrate at known oxygen levels
2. Adjust DO_SCALE and DO_OFFSET values

### Turbidity Calibration
1. Use distilled water (0 NTU) baseline
2. Use known turbidity standards (50, 100 NTU)
3. Adjust TURBIDITY_SCALE and TURBIDITY_OFFSET

---

## Production Tips

1. **Add Battery Backup:**
   - Add UPS to MQTT broker
   - Add battery to ESP32 for WiFi outages

2. **Add Data Persistence:**
   - Enable Mosquitto persistence: `persistence true`
   - Backend already saves to PostgreSQL database

3. **Enable SSL/TLS:**
   - Mosquitto: Set `listener 8883` with certificate
   - Update ESP32: Use `MQTT_SECURE` mode

4. **Add Redundancy:**
   - Run multiple backend instances
   - Use MQTT broker clustering (HiveMQ)

5. **Monitor System Health:**
   - Backend: `GET http://localhost:5000/health`
   - MQTT: Check broker uptime in logs
   - ESP32: Check WiFi signal strength

---

## Quick Reference Commands

```bash
# Test MQTT broker running
netstat -ano | Select-String ":1883"

# Subscribe to all water topics
mosquitto_sub -h localhost -t "water/#"

# Publish test data
mosquitto_pub -h localhost -t "water/esp32/readings" -m "{\"temperature\":25}"

# Stop Mosquitto (if running standalone)
taskkill /F /IM mosquitto.exe

# Restart backend
Ctrl+C (in backend terminal)
npm run dev

# Clear terminal
clear
```

---

## What's Next?

✅ ESP32 sends sensor data via MQTT
✅ Backend receives and processes data
✅ Frontend displays real-time data
✅ Database stores historical data

🎯 Next features to add:
- Mobile app for remote monitoring
- Email/SMS alerts for critical values
- Data export (CSV, PDF reports)
- Multiple tank support
- Advanced analytics & predictions
- Cloud syncing (optional)

---

## Support

**Common Issues:**
- Dashboard blank? Check browser console (F12)
- Backend error? Check backend terminal logs
- MQTT messages not flowing? Use MQTT Explorer
- ESP32 not connecting? Check WiFi credentials

**Useful Links:**
- MQTT Documentation: https://mqtt.org/
- Mosquitto: https://mosquitto.org/
- PubSubClient: https://github.com/knolleary/pubsubclient
- ArduinoJson: https://arduinojson.org/
