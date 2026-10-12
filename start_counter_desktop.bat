@echo off
title UniPro POS Counter (Cashier Terminal + Customer Display + Print Bridge)
cd /d "%~dp0\print-bridge"
echo =====================================================================
echo   UniPro Hybrid POS - Counter Desktop Terminal
echo =====================================================================
echo   Monitor 1: Cashier POS Terminal (Maximized)
echo   Monitor 2: Customer Facing Screen (Auto-detected)
echo   Local Print Bridge: Port 3050 (ESC/POS Thermal Printing)
echo   Target Backend: Local Database Server (http://localhost:5000)
echo =====================================================================
npm start
pause
