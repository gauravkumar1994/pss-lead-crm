@echo off
title PSS - Free ports 3000 and 4000
cd /d "%~dp0"

echo Stopping anything on port 3000 (Web) and 4000 (API)...
echo.

call :killPort 3000
call :killPort 4000

echo.
echo Done. Ab START-APP.bat ya npm run dev:web chalao.
pause
exit /b 0

:killPort
set PORT=%1
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
  echo Port %PORT% - killing PID %%P
  taskkill /F /PID %%P >nul 2>&1
)
exit /b 0
