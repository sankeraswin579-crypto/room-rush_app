@echo off
cd /d "%~dp0"
echo Installing dependencies...
call npm install
if errorlevel 1 pause & exit /b 1
echo Building Windows installer...
call npm run build:win
if errorlevel 1 pause & exit /b 1
echo.
echo Check the release folder for the Room Rush installer.
pause
