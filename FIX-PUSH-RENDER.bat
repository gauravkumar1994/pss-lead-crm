@echo off

chcp 65001 >nul

title Fix + Push (Render API ke liye)

cd /d "%~dp0"



echo.

echo ============================================

echo   Step 1/2 - Fix code GitHub par bhejna

echo ============================================

echo.



where git >nul 2>&1

if errorlevel 1 (

  echo Git install nahi. Pehle Git install karo.

  pause

  exit /b 1

)



git config --global user.name "gauravkumar1994"

git config --global user.email "gauravkumar1994@users.noreply.github.com"



if not exist .git git init



echo Render deploy fix - %date% %time% > DEPLOY-VERSION.txt



git add -A

git commit -m "Fix Render API deploy"

if errorlevel 1 goto :step2



echo Naya commit bana - ab push...

git branch -M main

git remote remove origin 2>nul

git remote add origin https://github.com/gauravkumar1994/pss-lead-crm.git

git push -u origin main

if errorlevel 1 (

  echo PUSH FAIL - token use karo password ki jagah

  pause

  exit /b 1

)

echo PUSH OK!



:step2

echo.

echo ============================================

echo   Step 2/2 - RENDER par ye karo (browser)

echo ============================================

echo.

echo 1) Kholo: https://dashboard.render.com

echo 2) PSS SOLUTION - Resources

echo 3) pss-crm-api par CLICK (Failed likha hoga)

echo 4) Upar right: Manual Deploy - Deploy latest commit

echo 5) 10-15 minute wait - Live green hona chahiye

echo.

echo Manual Sync mat dabana - kaam nahi karega!

echo.

echo API Live ke baad env (ek baar):

echo   pss-crm-api: CORS_ORIGIN = https://pss-crm-web.onrender.com

echo   pss-crm-api: PUBLIC_API_URL = https://pss-crm-api.onrender.com

echo   pss-crm-web: NEXT_PUBLIC_API_URL = https://pss-crm-api.onrender.com

echo   Phir dono par Redeploy

echo.

echo Test: https://pss-crm-api.onrender.com/health

echo       https://pss-crm-web.onrender.com/login  admin / admin123

echo.

start https://dashboard.render.com

pause

