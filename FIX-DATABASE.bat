@echo off
title PSS CRM - Reset local database
cd /d "%~dp0"

echo Creating SQLite database (no Docker)...
cd apps\api
call npx prisma generate
call npx prisma db push
call npm run db:seed
cd ..\..

echo.
echo Done. Restart PSS-API window, then login admin / admin123
pause
