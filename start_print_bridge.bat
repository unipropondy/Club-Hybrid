@echo off
title UniPro Print Bridge (POS Thermal Printer Service)
cd /d "%~dp0\print-bridge"
echo ===================================================
echo   UniPro Print Bridge - Local Printer Service
echo ===================================================
echo   Connecting to Local Backend (http://localhost:5000)
echo   Listening for Thermal Printer Jobs on Port 3050...
echo ===================================================
npm start
pause
