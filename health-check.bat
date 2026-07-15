@echo off
echo ==================================
echo   RWA.LAT Service Health Check
echo ==================================
echo.

set OK=0
set TOTAL=4

echo [1/4] Core API  (:4000)...
curl -s http://localhost:4000/v1/health >nul 2>&1 && (
    echo   ^> OK  {Status: running}
    set /a OK+=1
) || (
    echo   ^> DOWN  {Status: unreachable}
)

echo [2/4] Admin API (:4100)...
curl -s http://localhost:4100/v1/admin/health >nul 2>&1 && (
    echo   ^> OK  {Status: running}
    set /a OK+=1
) || (
    echo   ^> DOWN  {Status: unreachable}
)

echo [3/4] H5        (:3030)...
curl -s http://localhost:3030 >nul 2>&1 && (
    echo   ^> OK  {Status: serving}
    set /a OK+=1
) || (
    echo   ^> DOWN  {Status: unreachable}
)

echo [4/4] Admin FE  (:3100)...
curl -s http://localhost:3100 >nul 2>&1 && (
    echo   ^> OK  {Status: serving}
    set /a OK+=1
) || (
    echo   ^> DOWN  {Status: unreachable}
)

echo.
echo ──────────────────────────────
echo   %OK% / %TOTAL% services running
echo ──────────────────────────────

if %OK%==4 (
    echo   STATUS: ALL SYSTEMS GO
) else if %OK%==3 (
    echo   STATUS: 3/4 - need Core API
    echo.
    echo   Run: start-core-api.bat
) else (
    echo   STATUS: Some services are down
)

echo.
pause