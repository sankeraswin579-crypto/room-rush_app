@echo off
cd /d "%~dp0"
echo Installing Room Rush dependencies...
call npm install
if errorlevel 1 pause & exit /b 1
echo Starting Room Rush server...
call npm start
pause
