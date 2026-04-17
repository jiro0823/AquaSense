# Quick Start Guide for AquaSense

## ⚡ Fastest Setup (5 minutes)

### Step 1: Install PostgreSQL (if not already installed)
- Download from: https://www.postgresql.org/download/windows/
- **Important**: Remember the password you set for the `postgres` user
- Default port: 5432
- Default username: postgres

### Step 2: Create the AquaSense Database

**Option A: Using Windows Batch Script (Recommended)**
```bash
cd Backend
setup-database.bat
# Then enter your postgres password when prompted
```

**Option B: Using Command Line Manually**
```bash
# Find PostgreSQL bin directory and run psql
# Common location: C:\Program Files\PostgreSQL\15\bin\psql.exe

psql -U postgres -h localhost -p 5432

# In the psql prompt, type:
CREATE DATABASE "AquaSense";
\q
# Exit psql
```

**Option C: Using pgAdmin (GUI)**
1. Open pgAdmin
2. Right-click "Databases"
3. Select "Create" > "Database"
4. Name: `AquaSense`
5. Click "Save"

### Step 3: Update PostgreSQL Password (if needed)

If the password is wrong, reset it:

```bash
# Open pgAdmin or psql as admin
# Then execute:
ALTER USER postgres WITH PASSWORD 'your_new_password';
```

Then update `Backend\.env`:
```env
DB_PASSWORD=your_new_password
```

### Step 4: Start the Backend Server

```bash
cd Backend
npm run dev
```

Expected output:
```
✓ Database connected: AquaSense on localhost:5432
✓ Database models synchronized
✓ Server is running on http://localhost:5000
```

### Step 5: Start the Frontend Server

```bash
cd Frontend
npm run dev
```

Expected output:
```
http://localhost:3000 ready in XX ms
```

## 🌐 Access the Application

1. **Frontend**: http://localhost:3000
2. **Backend API**: http://localhost:5000
3. **Backend Integration Guide**: http://localhost:5000/integration-guide

## 📋 .env Configuration

**Backend/.env** currently has:
```env
# Server Configuration
NODE_ENV=development
PORT=5000
HOST=localhost

# API Configuration
API_VERSION=v1

# Logging
LOG_LEVEL=debug

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=AquaSense
DB_USER=postgres
DB_PASSWORD=postgres  # Change this to your actual PostgreSQL password
DB_DIALECT=postgres

# JWT Configuration
JWT_SECRET=replace-with-at-least-32-random-characters
JWT_EXPIRY=24h
```

## 🔧 Troubleshooting

### "password authentication failed for user postgres"
- **Root cause**: Wrong password in .env or PostgreSQL doesn't have this password
- **Solution**: 
  - Verify PostgreSQL is running
  - Check .env DB_PASSWORD matches your postgres password
  - Reset password if needed (see Step 3 above)

### "could not connect to server"
- **Root cause**: PostgreSQL service not running
- **Windows Server check**:
  - Open Services (services.msc)
  - Find "postgresql-x64-XX" service
  - Click "Start" if stopped

### "database does not exist"
- **Solution**: Create the database using one of the methods in Step 2

### Frontend won't connect to backend
- **Check**: Backend is running on port 5000
- **Check**: Frontend .env has correct API URL (usually http://localhost:5000)
- **Check**: CORS is configured correctly in Backend/.env

## 📊 Database Structure

**tables automatically created:**

### `users` table
Stores user accounts with hashed passwords:
- `id` (UUID, primary key)
- `fullName` (varchar)
- `email` (varchar, unique)
- `passwordHash` (varchar)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `sensor_readings` table
Stores water quality measurements:
- `id` (UUID, primary key)
- `temperature` (float)
- `ph` (float) - pH value 0-14
- `do` (float) - Dissolved Oxygen in mg/L
- `turbidity` (float) - Turbidity in NTU
- `location` (varchar)
- `timestamp` (timestamp)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

## 🚀 What's Working

✅ Frontend with React Router & Tailwind CSS
✅ Backend with Express & TypeScript
✅ PostgreSQL database integration (Sequelize ORM)
✅ User authentication (signup/login with JWT)
✅ Password hashing (bcryptjs - 10 rounds)
✅ Real-time charts (Recharts with WebSocket)
✅ Water quality sensor data storage
✅ API health checks
✅ CORS enabled for frontend

## 🔗 Key Features

### Authentication System
- Signup: POST `/api/v1/auth/signup`
- Login: POST `/api/v1/auth/login`
- Verify Token: GET `/api/v1/auth/verify`
- Protected routes with JWT middleware

### Sensor Data
- Add reading: POST `/api/v1/water/readings`
- Get latest: GET `/api/v1/water/readings/latest`
- Get by time: GET `/api/v1/water/readings?minutes=60`
- Statistics: GET `/api/v1/water/statistics?minutes=60`
- Dashboard: GET `/api/v1/water/dashboard`

### WebSocket Events
Real-time updates via Socket.IO:
- `water:latest` - Latest sensor reading
- `water:stats` - Statistics updated
- `water:alert` - New alert triggered
- `water:new-reading` - New reading received

## 📝 Next Steps

1. Create database (follow Step 2 above)
2. Start backend: `npm run dev` (Backend folder)
3. Start frontend: `npm run dev` (Frontend folder)
4. Test signup/login at http://localhost:3000
5. Monitor sensor data in Dashboard

## ⚠️ Important Notes

- **Change JWT_SECRET** in production
- **Change DB_PASSWORD** to your actual PostgreSQL password
- **Keep .env file private** - don't commit to git
- Database credentials should never be hardcoded in code
- Always use HTTPS in production
