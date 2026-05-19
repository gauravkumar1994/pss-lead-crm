@echo off
title Push to GitHub - gauravkumar1994
cd /d "%~dp0"

echo.
echo === PSS Lead CRM - GitHub Push ===
echo Repo: https://github.com/gauravkumar1994/pss-lead-crm
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git install nahi hai. INSTALL-GIT.bat chalao.
  pause
  exit /b 1
)

REM Pehli baar commit ke liye name/email zaroori hai
git config user.email | findstr /r "." >nul 2>&1
if errorlevel 1 (
  echo Git user set kar rahe hain ^(pehli baar^)...
  git config --global user.email "gauravkumar1994@users.noreply.github.com"
  git config --global user.name "gauravkumar1994"
)

if not exist .git (
  echo [1/5] git init...
  git init
) else (
  echo [1/5] git already initialized
)

echo [2/5] git add all files...
git add .
if errorlevel 1 (
  echo [FAIL] git add failed
  pause
  exit /b 1
)

echo [3/5] git commit...
git commit -m "PSS Lead CRM - first commit"
if errorlevel 1 (
  echo.
  echo Commit issue - checking status...
  git status
  echo.
  echo Agar "nothing to commit" dikhe to pehle se commit ho chuki hai - OK.
  git rev-parse HEAD >nul 2>&1
  if errorlevel 1 (
    echo [FAIL] Koi commit nahi bani. Upar wala error fix karo.
    pause
    exit /b 1
  )
)

echo [4/5] branch main...
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/gauravkumar1994/pss-lead-crm.git

echo [5/5] git push...
echo.
echo GitHub login:
echo   Username = gauravkumar1994
echo   Password = Personal Access Token ^(GitHub password NAHI^)
echo   Token: GitHub - Settings - Developer settings - Personal access tokens
echo.
git push -u origin main

if errorlevel 1 (
  echo.
  echo ========================================
  echo PUSH FAIL - common fixes:
  echo 1) Token use karo password ki jagah
  echo 2) Repo name: pss-lead-crm public/private dono OK
  echo 3) GIT-PUSH-FIX.txt padho
  echo ========================================
) else (
  echo.
  echo ========================================
  echo SUCCESS! Code GitHub par upload ho gaya.
  echo https://github.com/gauravkumar1994/pss-lead-crm
  echo Ab DEPLOY-ABHI-KARO.txt - Render par live URL
  echo ========================================
)
echo.
pause
