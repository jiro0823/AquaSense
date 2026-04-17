# 🚀 How to Run AquaSense Frontend & Backend

## 📁 Folder Structure

```
CAPSTONE_PROJECT/
├── Backend/          ← Backend Express server (PORT 5000)
│   ├── src/
│   ├── package.json
│   ├── .env          ← Database credentials
│   └── npm scripts available
├── Frontend/         ← React Vite app (PORT 3000)
│   ├── src/
│   ├── package.json
│   └── npm scripts available
└── START_ALL.bat     ← One-click start both servers
```

## Quick Start (Easiest)

**Option 1: Double-click the batch file**
```
Double-click: START_ALL.bat
```
This will:
✓ Open Backend server in a new window on port 5000
✓ Open Frontend server in a new window on port 3000
✓ Both servers run simultaneously

---

## Manual Commands (Step by Step)

### Terminal 1: Start Backend Server

**Step 1**: Open PowerShell or Command Prompt

**Step 2**: Navigate to Backend folder
```bash
cd Backend
```

**Step 3**: Start backend with npm
```bash
npm run dev
```

**Expected Output:**
```
✓ Database connected: AquaSense on localhost:5432
✓ Database models synchronized
✓ Server is running on http://localhost:5000
```

---

### Terminal 2: Start Frontend Server

**Step 1**: Open a NEW PowerShell or Command Prompt (don't close the first one!)

**Step 2**: Navigate to Frontend folder
```bash
cd Frontend
```

**Step 3**: Start frontend with npm
```bash
npm run dev
```

**Expected Output:**
```
  ➜  Local:   http://localhost:3000/
```

---

## 🌐 Access the Application

Once both servers are running:

1. **Open your browser** and go to:
   ```
   http://localhost:3000
   ```

2. **You should see:**
   - AquaSense Landing Page with ocean theme
   - "Get Started" or "Sign In" buttons
   - Features section

3. **Test the system:**
   - Click "Get Started" → Signup page
   - Create an account (Name, Email, Password 8+ characters)
   - After signup, redirects to Login
   - Login with your credentials
   - Access the Dashboard with real-time charts
   - See Temperature, pH, DO, and Turbidity graphs

---

## Frontend Commands Available

### Build Frontend
```bash
cd Frontend
npm run build
```
Creates optimized production build in `dist/` folder

### Start Development Server
```bash
cd Frontend
npm run dev
```
Runs on `http://localhost:3000` with hot reload

### Preview Production Build
```bash
cd Frontend
npm run preview
```
Test the production build locally

---

## Backend Commands Available

### Build Backend
```bash
cd Backend
npm run build
```
Compiles TypeScript to JavaScript in `dist/` folder

### Start Development Server (with auto-reload)
```bash
cd Backend
npm run dev
```
Runs on `http://localhost:5000` with TypeScript watching

### Apply All Linting Fixes
```bash
cd Backend
npm run lint:fix
```

---

## 🔧 Configuration

### Backend Configuration (.env file)

**File location:** `Backend/.env`

```env
# Server
NODE_ENV=development
PORT=5000
HOST=localhost

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=AquaSense
DB_USER=postgres
DB_PASSWORD=          # (blank for peer authentication)
DB_DIALECT=postgres

# API
API_VERSION=v1
LOG_LEVEL=debug

# CORS (Frontend URL)
CORS_ORIGIN=http://localhost:3000

# JWT Authentication
JWT_SECRET=your_jwt_secret_key_change_in_production_12345
JWT_EXPIRY=24h
```

### Frontend Configuration

**Development Server:**
- Configured in `vite.config.ts`
- Proxy to backend: `http://localhost:5000`
- Runs on `http://localhost:3000`

---

## Verification Checklist

### Backend Started Successfully ✓
- [ ] You see "✓ Database connected: AquaSense"
- [ ] You see "✓ Server is running on http://localhost:5000"
- [ ] Port 5000 is active

### Frontend Started Successfully ✓
- [ ] You see "Local: http://localhost:3000"
- [ ] No TypeScript compile errors
- [ ] Port 3000 is active

### System is Ready ✓
- [ ] Both servers running simultaneously
- [ ] No port conflicts
- [ ] Database connected
- [ ] CORS enabled

---

## ❌ Troubleshooting

### "Port 5000 already in use"

**Problem:** Another process is using port 5000

**Solution - Windows:**
```bash
# Kill all node processes
Get-Process -Name "node" | Stop-Process -Force

# Then try npm run dev again
```

### "Cannot connect to database"

**Problem:** PostgreSQL not running or wrong credentials

**Solution:**
1. Verify PostgreSQL is running
2. Check Backend/.env has correct credentials
3. Verify AquaSense database exists

### "Frontend won't load"

**Problem:** Can't access http://localhost:3000

**Solution:**
1. Check frontend is running (`npm run dev` in Frontend folder)
2. Check port 3000 is free
3. Open browser console (F12) and check for errors

### "404 on API calls"

**Problem:** Frontend can't reach backend

**Solution:**
1. Verify backend is running on port 5000
2. Check CORS_ORIGIN in Backend/.env includes http://localhost:3000
3. Check Frontend is calling correct API URL

---

## 🎯 What Each Server Does

### Backend (Express + TypeScript)
- API endpoints for authentication (signup/login)
- Sensor data management and storage
- PostgreSQL database integration
- WebSocket for real-time updates
- Runs on **PORT 5000**

### Frontend (React + Vite)
- User interface with React Router
- Responsive design with Tailwind CSS
- Real-time charts with Recharts
- WebSocket client for live data
- Runs on **PORT 3000**

### PostgreSQL Database
- Stores user accounts
- Stores sensor measurements
- Automatically created tables on first run
- Database name: **AquaSense**

---

## 📊 API Endpoints (Backend Only)

### Authentication
- `POST /api/v1/auth/signup` - Register new user
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/verify` - Verify JWT token

### Water Quality Data
- `POST /api/v1/water/readings` - Add sensor reading
- `GET /api/v1/water/readings/latest` - Get latest reading
- `GET /api/v1/water/readings?minutes=60` - Get historical data
- `GET /api/v1/water/statistics?minutes=60` - Get statistics

### System
- `GET /health` - Backend health check
- `GET /stats` - WebSocket connected clients
- `GET /integration-guide` - ESP32 setup guide

---

## 🏃 Quick Reference

| Action | Command | Location | Port |
|--------|---------|----------|------|
| **Start Backend** | `npm run dev` | `/Backend` | 5000 |
| **Start Frontend** | `npm run dev` | `/Frontend` | 3000 |
| **Build Backend** | `npm run build` | `/Backend` | - |
| **Build Frontend** | `npm run build` | `/Frontend` | - |
| **Test Backend** | `npm test` | `/Backend` | - |
| **Lint Backend** | `npm run lint` | `/Backend` | - |
| **Access App** | Browser | `http://localhost:3000` | 3000 |
| **Access API** | Browser/Postman | `http://localhost:5000` | 5000 |
| **Database** | psql/pgAdmin | `localhost:5432` | 5432 |

---

## ✅ Success!

When you see both servers running:

**Backend Output:**
```
✓ Server is running on http://localhost:5000
✓ Database connected: AquaSense on localhost:5432
✓ Backend is connected to PostgreSQL database
```

**Frontend Output:**
```
  ➜  Local:   http://localhost:3000/
```

**Then open:** http://localhost:3000

You're all set! 🚀
