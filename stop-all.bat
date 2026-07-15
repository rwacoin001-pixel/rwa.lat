@echo off
echo Stopping all RWA.LAT services...

echo Killing Node.js processes on ports 3030, 3100, 4000, 4100...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3030" ^| findstr "LISTENING"') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3100" ^| findstr "LISTENING"') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000" ^| findstr "LISTENING"') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4100" ^| findstr "LISTENING"') do taskkill /f /pid %%a 2>nul

echo All services stopped.
pause