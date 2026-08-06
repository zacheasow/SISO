@echo off
title Kumon SISO - Student Check-In & Pickup System
cd /d "%~dp0"

echo ===================================================
echo   Kumon SISO - Starting Application Services...
echo ===================================================

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/ and try again.
    pause
    exit /b 1
)

:: Auto-install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo [INFO] First-time setup detected. Installing packages...
    call npm install
)

:: Auto-build packages if dist is missing
if not exist "packages\shared\dist\" (
    echo [INFO] Building application packages...
    call npm run build
)

:: Start local server in background window (bind to IPv4 explicitly)
echo [INFO] Starting Kumon SISO Local Server on 127.0.0.1:3000...
start "Kumon SISO Server" /min cmd /c "set HOST=127.0.0.1 && npm run start:server"

:: Wait for server to become ready before opening browser
echo [INFO] Waiting for server to start...
set RETRIES=0
:wait_loop
if %RETRIES% GEQ 15 (
    echo [WARN] Server did not respond in time. Opening browser anyway...
    goto open_browser
)
curl -s -o nul http://127.0.0.1:3000/api/health >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Server is ready!
    goto open_browser
)
set /a RETRIES+=1
timeout /t 1 /nobreak >nul
goto wait_loop

:open_browser
echo [INFO] Opening Desktop Admin Console...
start "" "http://127.0.0.1:5174"
start "" "http://127.0.0.1:5173"

echo.
echo ===================================================
echo   Kumon SISO is now running!
echo   Desktop Admin: http://127.0.0.1:5174
echo   Check-In PWA:  http://127.0.0.1:5173
echo ===================================================
echo.
