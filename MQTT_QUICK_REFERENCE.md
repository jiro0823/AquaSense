# MQTT Setup - Quick Reference Card

## 📋 System Components

| Component | Status | Port | Command |
|-----------|--------|------|---------|
| **Mosquitto MQTT Broker** | ⏸️ Not Started | 1883 | See Step 1 |
| **Node.js Backend** | ✅ Running | 5000 | `npm run dev` |
| **React Frontend** | ✅ Running | 3001 | `npm run dev` |
| **PostgreSQL Database** | ✅ Running | 5432 | (auto) |

## 🚀 5-Minute Setup

### 1️⃣ Install Mosquitto (Choose ONE)
```bash
# Option A: Docker (Easiest)
docker run -d --name mosquitto -p 1883:1883 eclipse-mosquitto

# Option B: Download from https://mosquitto.org/download/
# Run installer, then start from: C:\Program Files\mosquitto\mosquitto.exe
```

### 2️⃣ Update ESP32 Code
```cpp
// In ESP32_Water_Quality_MQTT.ino:

Line 14: const char* WIFI_SSID = "YOUR_WIFI_NAME";
Line 15: const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
Line 19: const char* MQTT_BROKER = "192.168.1.100";  // Your PC IP

// Find PC IP:
ipconfig  // Look for IPv4 Address
```

### 3️⃣ Upload to ESP32
- Open Arduino IDE
- Install: PubSubClient, ArduinoJson, Dallas Temperature
- Select Board: ESP32 Dev Module
- Upload code

### 4️⃣ Start All Services
```bash
# Terminal 1: MQTT Broker
mosquitto  # or: docker start mosquitto

# Terminal 2: Backend
cd Backend && npm run dev

# Terminal 3: Frontend
cd Frontend && npm run dev
```

### 5️⃣ Monitor Data
- MQTT Explorer: http://mqtt-explorer.com/ → Connect to localhost:1883
- Dashboard: http://localhost:3001 → Login → Dashboard
- Backend logs should show: `[ESP32] Sensor reading received...`

---

## 🔍 Verify Setup is Working

```bash
# Check Mosquitto running
netstat -ano | Select-String ":1883"
# Expected: TCP [::1]:1883 [::]:0 LISTENING

# Check Backend running
netstat -ano | Select-String ":5000"
# Expected: TCP [::1]:5000 [::]:0 LISTENING

# Check Frontend running
netstat -ano | Select-String ":3001"
# Expected: TCP [::1]:3001 [::]:0 LISTENING
```

---

## 📊 Expected Data Flow

```
ESP32 Publishes Every 5 Seconds
    ↓
Topic: water/esp32/readings
    ↓
JSON: {temperature: 24.5, ph: 7.4, do: 8.2, turbidity: 25}
    ↓
Backend Subscribes → Adds to Database
    ↓
WebSocket Broadcasts to Frontend
    ↓
Dashboard Updates Charts in Real-Time
```

---

## ✅ Success Criteria

- [ ] Mosquitto broker running on port 1883
- [ ] ESP32 connects to WiFi (check serial output)
- [ ] ESP32 connects to MQTT (check serial output)
- [ ] Backend shows: `✓ MQTT Service initialized`
- [ ] MQTT Explorer shows `water/esp32/readings` topic
- [ ] Backend logs show: `[ESP32] Sensor reading received`
- [ ] Dashboard shows "Connected" status (green)
- [ ] Dashboard charts update with new data

---

## ❌ Common Issues

| Issue | Solution |
|-------|----------|
| **ESP32 can't connect to WiFi** | Check SSID/Password, 2.4GHz only |
| **ESP32 can't connect to MQTT** | Check MQTT_BROKER IP is correct, check firewall |
| **No data in MQTT topics** | Check ESP32 WiFi connection, check serial output |
| **Backend not receiving MQTT** | Check Mosquitto running, check topic name (`water/esp32/readings`) |
| **Dashboard doesn't update** | Refresh browser, check WebSocket connection in browser console |

---

## 🎯 Files Created

| File | Purpose |
|------|---------|
| `ESP32_Water_Quality_MQTT.ino` | ESP32 sensor code (upload to Arduino IDE) |
| `MQTT_SETUP_GUIDE.md` | Complete setup documentation |
| `Backend/src/services/mqttService.ts` | MQTT client service |
| **This file** | Quick reference |

---

## 📞 Support

**Check these if setup fails:**

1. **Mosquitto not running?**
   ```bash
   netstat -ano | Select-String ":1883"
   ```

2. **Can't find PC IP?**
   ```bash
   ipconfig  # Look for IPv4 Address (e.g., 192.168.1.100)
   ```

3. **Backend errors?**
   - Check Backend terminal for MQTT connection logs
   - MQTT connection failures are NON-CRITICAL (REST API still works)

4. **ESP32 not uploading?**
   - Install CH340 driver: https://github.com/espressif/esptool
   - Select correct COM port in Arduino IDE
   - Check baud rate: 115200

---

## 🎓 Learning Path

1. **Start Here:** Read this quick reference
2. **Then:** Follow MQTT_SETUP_GUIDE.md step-by-step
3. **Reference:** check Backend logs and MQTT topics
4. **Verify:** Use MQTT Explorer to monitor real-time data
5. **Deploy:** Once working, move ESP32 and sensors to production location

---

## 📌 Key Concepts

- **MQTT:** Lightweight publish/subscribe messaging protocol
- **Mosquitto:** Open-source MQTT broker (message server)
- **Topic:** A "channel" where messages are published/subscribed
- **Payload:** The actual data being sent (JSON in our case)
- **QoS:** Quality of Service (0=at most once, 1=at least once)

---

**Status:** ✅ System Ready for ESP32 Integration  
**Last Updated:** 2026-04-12  
**Version:** 1.0
