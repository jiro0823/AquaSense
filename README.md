# AquaSense Capstone Project

AquaSense is a full-stack water quality monitoring system with:
- Frontend: React + TypeScript + Vite + Tailwind
- Backend: Node.js + Express + TypeScript + Sequelize
- Database: PostgreSQL
- IoT transport: MQTT (ESP32 -> broker -> backend)

## Repository Contents

- `Frontend/`: Web dashboard and authentication UI
- `Backend/`: API, MQTT ingestion, WebSocket broadcasting, database models
- `ESP32_Water_Quality_MQTT.ino`: ESP32 firmware sketch for sensor publishing
- Setup guides in root markdown files

## Prerequisites

Install these before running the project:

1. Node.js 18+ (LTS recommended)
2. npm 9+
3. PostgreSQL 14+ (or compatible)
4. Git

Optional but recommended for IoT flow:
1. MQTT broker (Mosquitto)
2. Arduino IDE (for ESP32 firmware upload)
3. Docker Desktop (alternative way to run Mosquitto)

## Required Environment Files

This repo intentionally tracks `.env` files per your request.

- `Backend/.env`
- `Frontend/.env`

Current expected values include:

Backend (`Backend/.env`):
- `PORT=5000`
- `DB_HOST=localhost`
- `DB_PORT=5432`
- `DB_NAME=AquaSense`
- `DB_USER=postgres`
- `DB_PASSWORD=...`
- `DB_DIALECT=postgres`
- `JWT_SECRET=...`
- `CORS_ORIGIN=http://localhost:3000`

Frontend (`Frontend/.env`):
- `VITE_API_URL=http://localhost:5000/api/v1`

## Install Dependencies

From project root:

```bash
cd Backend
npm install

cd ../Frontend
npm install
```

## Run in Development

Open two terminals.

Terminal 1 (Backend):

```bash
cd Backend
npm run dev
```

Terminal 2 (Frontend):

```bash
cd Frontend
npm run dev
```

Default local URLs:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## Build Commands

Backend:

```bash
cd Backend
npm run build
npm start
```

Frontend:

```bash
cd Frontend
npm run build
npm run preview
```

## MQTT Setup (Optional for Live Sensor Flow)

Run Mosquitto quickly with Docker:

```bash
docker run -d --name mosquitto -p 1883:1883 -p 9001:9001 eclipse-mosquitto
```

Then configure ESP32 sketch Wi-Fi and broker IP in:
- `ESP32_Water_Quality_MQTT.ino`

## Git Workflow Used

Standard push flow applied:
1. Initialize repository
2. Add remote origin
3. Stage all files
4. Commit with clear message
5. Push to `main`

## Security Note

This repository currently includes `.env` values by request. If this project becomes public, rotate secrets (database password, JWT secret, API keys) and move sensitive values out of version control.
