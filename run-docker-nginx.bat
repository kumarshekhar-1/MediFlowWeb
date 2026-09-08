@echo off
cd /d "%~dp0"

echo ========================================================
echo 1. Building Angular + Nginx Production Image...
echo ========================================================
docker build -t mediflow-web .
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Docker build failed. Make sure Docker Desktop is running!
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo 2. Running Container on Port 80 (Nginx)...
echo ========================================================
docker stop mediflow-app 2>nul
docker rm mediflow-app 2>nul
docker run -d -p 80:80 --name mediflow-app mediflow-web

echo.
echo ========================================================
echo SUCCESS! Your Angular app is running on Nginx + Docker!
echo Opening http://localhost in your browser...
echo ========================================================
timeout /t 2 >nul
start http://localhost
pause
