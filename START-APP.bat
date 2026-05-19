@echo off
title PSS SOLUTION - Start App
cd /d "%~dp0"
set LOG=%~dp0start-log.txt

echo PSS SOLUTION start log - %date% %time% > "%LOG%"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js install nahi hai.
  echo Download: https://nodejs.org  ^(LTS^)
  echo PC restart ke baad dubara ye file chalao.
  echo [ERROR] Node.js missing >> "%LOG%"
  start https://nodejs.org
  pause
  exit /b 1
)

echo ============================================
echo   PSS SOLUTION - Local Start
echo   Local DB: Docker PostgreSQL (docker compose)
echo ============================================
echo.
echo Log file: start-log.txt
echo.

echo [1/4] npm install - pehli baar 5-10 minute lag sakta hai...
call npm install >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [FAIL] npm install fail - start-log.txt dekho
  pause
  exit /b 1
)
if not exist node_modules (
  echo [FAIL] node_modules nahi bana - internet check karo
  pause
  exit /b 1
)
echo [OK] npm install

echo.
echo [2/4] Database setup...
if not exist apps\api\.env copy apps\api\.env.example apps\api\.env
docker compose up -d >> "%LOG%" 2>&1
timeout /t 5 /nobreak >nul
cd apps\api
call npx prisma generate >> "%LOG%" 2>&1
call npx prisma db push >> "%LOG%" 2>&1
call npm run db:seed >> "%LOG%" 2>&1
cd ..\..
echo [OK] database

echo.
echo [3/4] Free ports 3000 + 4000 (purana server band)...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000 " ^| findstr LISTENING') do taskkill /F /PID %%P >nul 2>&1
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":4000 " ^| findstr LISTENING') do taskkill /F /PID %%P >nul 2>&1
echo [OK] ports cleared

echo.
echo [4/4] Starting API + Web in 2 windows...
echo DO NOT CLOSE those windows!
echo.
start "PSS-API" cmd /k "cd /d %~dp0 && title PSS-API && npm run dev:api"
echo Waiting 10 sec for API...
timeout /t 10 /nobreak >nul
start "PSS-WEB" cmd /k "cd /d %~dp0 && title PSS-WEB && npm run dev:web"

echo.
echo ============================================
echo   AB YE KARO:
echo ============================================
echo   1) PSS-WEB window mein "Ready" ka wait karo (1-2 min)
echo   2) Browser: http://localhost:3000/login
echo   3) API test:  http://localhost:4000/health
echo   4) Login: admin / admin123
echo.
echo   Agar window mein RED error dikhe - screenshot bhejo
echo   Ya start-log.txt kholo
echo ============================================
pause
