@echo off
echo ========================================
echo RWA.LAT Dev - Start All Services
echo ========================================

echo.
echo [1/4] Starting PostgreSQL (WSL)...
wsl -- sudo service postgresql start 2>&1

echo.
echo [2/4] Starting Core API (port 4000)...
cd D:\360MoveData\Users\Administrator\Desktop\rwa.lat\rwa-lat\apps\api
start "CoreAPI" /min node dist/main.js

echo.
echo [3/4] Starting Admin API (port 4100)...
cd D:\360MoveData\Users\Administrator\Desktop\rwa.lat\rwa-lat\apps\admin
start "AdminAPI" /min node dist/main.js

echo.
echo [4/4] Starting H5 Frontend (port 3030)...
cd D:\360MoveData\Users\Administrator\Desktop\rwa.lat\rwa-lat
start "H5" /min node node_modules/next/dist/bin/next start -p 3030

echo.
echo Starting Admin Frontend (port 3100)...
cd D:\360MoveData\Users\Administrator\Desktop\rwa.lat\rwa-lat\apps\admin-frontend
start "AdminFE" /min node node_modules/next/dist/bin/next start -p 3100

echo.
echo ========================================
echo All services starting. Check health:
echo   Core API:    http://localhost:4000/v1/health
echo   Admin API:   http://localhost:4100/v1/admin/health
echo   H5:          http://localhost:3030
echo   Admin FE:    http://localhost:3100
echo ========================================
pause