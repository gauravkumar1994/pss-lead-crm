@echo off
title PSS CRM - Setup Check
cd /d "%~dp0"

set LOG=%~dp0setup-report.txt
echo PSS CRM Setup Report > "%LOG%"
echo Generated: %date% %time% >> "%LOG%"
echo. >> "%LOG%"

echo ============================================
echo   PSS CRM - SETUP CHECK (report bhi banegi)
echo ============================================
echo.
echo Report file: setup-report.txt
echo.

call :check "Node.js" where node
if exist node_modules (
  echo [OK] node_modules folder EXISTS
  echo [OK] node_modules exists >> "%LOG%"
) else (
  echo [FAIL] node_modules NAHI - npm install abhi tak nahi hua
  echo [FAIL] node_modules missing >> "%LOG%"
)

echo. >> "%LOG%"
echo --- Versions --- >> "%LOG%"
node -v 2>> "%LOG%" || echo Node FAIL >> "%LOG%"
npm -v 2>> "%LOG%" || echo npm FAIL >> "%LOG%"
docker -v 2>> "%LOG%" || echo Docker FAIL >> "%LOG%"

echo.
echo --- Docker containers ---
docker compose ps 2>> "%LOG%"

echo.
echo --- Ports (3000 and 4000) ---
netstat -ano | findstr ":3000 " >> "%LOG%" 2>nul
netstat -ano | findstr ":4000 " >> "%LOG%" 2>nul
netstat -ano | findstr ":3000 "
netstat -ano | findstr ":4000 "

echo.
echo ============================================
echo   MATLAB (simple):
echo ============================================
where node >nul 2>&1
if errorlevel 1 (
  echo  1. Node.js install karo: https://nodejs.org
  echo  2. PC restart
  echo  3. Dubara CHECK-SETUP.bat
) else if not exist node_modules (
  echo  Node OK hai. Ab START-APP.bat chalao.
  echo  Docker optional - virtualization error = ignore, SQLite use hoga.
  echo  5-10 min wait. Do windows khulengi - band mat karna.
) else (
  echo  Sab files OK lag rahe hain.
  echo  START-APP.bat chalao - Docker ki zaroorat NAHI.
  echo  Jab WEB window mein "Ready" dikhe tab browser kholo.
)
if exist apps\api\prisma\dev.db (
  echo [OK] Database file: apps\api\prisma\dev.db
) else (
  echo [INFO] Database file abhi nahi - START-APP.bat ya FIX-DATABASE.bat chalao
)
echo.
echo Poori report: setup-report.txt
echo.
pause
exit /b 0

:check
where %~2 >nul 2>&1
if errorlevel 1 (
  echo [FAIL] %~1 - NOT FOUND
  echo [FAIL] %~1 >> "%LOG%"
) else (
  echo [OK] %~1
  echo [OK] %~1 >> "%LOG%"
  %~2 -v 2>nul
)
goto :eof
