@echo off
chcp 65001 >nul
title GITHUB PUSH - ek click
cd /d "%~dp0"

echo.
echo ============================================
echo   PSS Lead CRM - GitHub Push (1 click)
echo ============================================
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo GIT NAHI MILA - pehle Git install karo, PC restart, phir dubara ye file chalao.
  pause
  exit /b 1
)

git config --global user.name "gauravkumar1994"
git config --global user.email "gauravkumar1994@users.noreply.github.com"

if not exist .git git init

git add .
echo.
echo Commit ban rahi hai...
git commit -m "PSS Lead CRM - first commit"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/gauravkumar1994/pss-lead-crm.git

echo.
echo ============================================
echo   AB PUSH - login popup aayega
echo   Username: gauravkumar1994
echo   Password: TOKEN (website password NAHI)
echo   Token: https://github.com/settings/tokens
echo ============================================
echo.
git push -u origin main

if errorlevel 1 (
  echo.
  echo PUSH FAIL - token sahi daala? Repo GitHub par hai?
) else (
  echo.
  echo SUCCESS! https://github.com/gauravkumar1994/pss-lead-crm
)
echo.
pause
