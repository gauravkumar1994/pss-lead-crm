@echo off
title PSS SOLUTION - API + Web (ek hi window)
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js install karo: https://nodejs.org
  pause
  exit /b 1
)

echo npm install + database setup...
call npm install
cd apps\api
call npx prisma generate
call npx prisma db push
call npm run db:seed
cd ..\..

echo.
echo Starting both servers HERE - is window ko BAND MAT KARNA
echo Browser: http://localhost:3000/login
echo.
call npm run dev
