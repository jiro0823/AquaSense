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

## Quick Start (Clone and Run)

### 1) Clone the Entire Project

```bash
git clone https://github.com/jiro0823/AquaSense.git
cd AquaSense
```

### 2) Install Project Dependencies

```bash
cd Backend
npm install

cd ../Frontend
npm install
```

### 3) Configure Database and Environment

1. Make sure PostgreSQL is running.
2. Create a database named `AquaSense`.
3. Review and update:
	- `Backend/.env`
	- `Frontend/.env`

### 4) Start Backend and Frontend

Terminal 1:

```bash
cd Backend
npm run dev
```

Terminal 2:

```bash
cd Frontend
npm run dev
```

Open the app at `http://localhost:3000`.

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

## How to Update README and Push to GitHub

Use this standard workflow whenever you change documentation:

### 1) Confirm Current Branch and Remote

```bash
git branch --show-current
git remote -v
```

### 2) Pull Latest Changes First

```bash
git pull origin main
```

### 3) Edit README

Update `README.md` in your editor and save.

### 4) Stage and Commit

```bash
git add README.md
git commit -m "docs: refine README setup and git workflow"
```

If you changed more files and want to include all of them:

```bash
git add .
git commit -m "docs: update project documentation"
```

### 5) Push to GitHub

```bash
git push origin main
```

### 6) Verify on GitHub

Open your repository and refresh the page:

`https://github.com/jiro0823/AquaSense`

You should see the updated README.

## First-Time Push (New Repository Only)

If starting from a local project that is not yet a git repo:

```bash
git init
git branch -M main
git remote add origin https://github.com/jiro0823/AquaSense.git
git add .
git commit -m "chore: initial project import"
git push -u origin main
```

## Security Note

This repository currently includes `.env` values by request. If this project becomes public, rotate secrets (database password, JWT secret, API keys) and move sensitive values out of version control.
