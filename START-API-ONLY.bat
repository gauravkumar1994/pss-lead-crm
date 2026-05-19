@echo off
cd /d "%~dp0"
call npm install
cd apps\api
call npx prisma generate
call npx prisma db push
call npm run dev
