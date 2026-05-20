@echo off
chcp 65001 >nul
title FINAL FIX - GitHub + Render
cd /d "%~dp0"

echo.
echo ============================================
echo   FINAL FIX - ioredis build error
echo ============================================
echo.

git config --global user.name "gauravkumar1994"
git config --global user.email "gauravkumar1994@users.noreply.github.com"

echo Build fix marker %date% %time%>> DEPLOY-VERSION.txt

git add -A
git commit -m "Fix ioredis TypeScript build for Render"
if errorlevel 1 (
  echo Commit skip - files shayad pehle commit ho chuke
) else (
  echo Commit OK
)

git branch -M main 2>nul
git remote remove origin 2>nul
git remote add origin https://github.com/gauravkumar1994/pss-lead-crm.git

echo.
echo Pushing to GitHub...
git push -u origin main
if errorlevel 1 (
  echo PUSH FAIL - token use karo
  pause
  exit /b 1
)

echo.
echo ============================================
echo   PUSH OK! Ab Render par:
echo   pss-crm-api - Manual Deploy - latest commit
echo   Wait 10-15 min - Build successful hona chahiye
echo ============================================
echo.
start https://dashboard.render.com
pause
