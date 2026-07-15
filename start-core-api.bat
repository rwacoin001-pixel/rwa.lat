@echo off
echo ===================================
echo RWA.LAT — Start Core API
echo ===================================
echo.

echo [1] Restarting PostgreSQL (WSL)...
wsl -- sudo pg_ctlcluster 16 main restart
wsl -- pg_isready -h 127.0.0.1 -p 5432
if errorlevel 1 (
    echo ERROR: PostgreSQL failed to start
    pause
    exit /b 1
)
echo PostgreSQL accepting connections

echo.
echo [2] Starting Core API (:4000)...
cd /d D:\360MoveData\Users\Administrator\Desktop\rwa.lat\rwa-lat\apps\api
start /min "CoreAPI" node dist/main.js

echo.
echo [3] Waiting for server to be ready...
set retries=0
:loop
timeout /t 2 /nobreak >nul
curl -s http://localhost:4000/v1/health >nul 2>&1
if not errorlevel 1 goto ready
set /a retries+=1
if %retries% geq 10 goto timeout
echo    Waiting... (%retries%/10)
goto loop

:ready
echo.
echo ===================================
echo   Core API is running!
echo   Health: OK
echo   URL:   http://localhost:4000
echo ===================================
echo.
echo Services now running:
echo   H5 (user)    http://localhost:3030
echo   Admin FE     http://localhost:3100
echo   Core API     http://localhost:4000/v1/health
echo   Admin API    http://localhost:4100/v1/admin/health
echo.
goto end

:timeout
echo.
echo WARNING: Core API could not be reached within 20 seconds.
echo Check logs in the "CoreAPI" window.
echo.

:end
pause