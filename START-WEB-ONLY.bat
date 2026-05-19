@echo off
cd /d "%~dp0"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000 " ^| findstr LISTENING') do taskkill /F /PID %%P >nul 2>&1
call npm install
call npm run dev:web
