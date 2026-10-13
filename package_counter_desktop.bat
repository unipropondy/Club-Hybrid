@echo off
setlocal enabledelayedexpansion
title UniPro POS Counter - Windows Desktop Packager (.exe Installer)
echo =====================================================================
echo       UniPro Hybrid POS - Windows Desktop Application Packager
echo =====================================================================
echo  This script packages the Counter PC application into a standalone 
echo  Windows (.exe) installer bundling:
echo    1. Cashier Counter POS UI (Primary Monitor)
echo    2. Dual-Monitor Customer Facing Display (Secondary Monitor)
echo    3. Thermal Print Bridge & LAN Hub (Port 3050)
echo    4. Embedded Node.js Backend Server (Port 5000 with Auto-Launch)
echo =====================================================================
echo.

set "ROOT_DIR=%~dp0"
set "FRONTEND_DIR=%ROOT_DIR%frontend"
set "BRIDGE_DIR=%ROOT_DIR%print-bridge"
set "OUTPUT_DIR=%BRIDGE_DIR%\dist-installer"

echo [Step 1/3] Building Production Web Bundle from Frontend...
cd /d "%FRONTEND_DIR%"
call npx expo export --platform web --output-dir "%BRIDGE_DIR%\customer-display-web"
if %ERRORLEVEL% neq 0 (
  echo [ERROR] Frontend Web export failed!
  pause
  exit /b %ERRORLEVEL%
)
echo [Step 1/3] Frontend Web export completed successfully.
echo.

echo [Step 2/3] Compiling Print-Bridge & Desktop Host TypeScript...
cd /d "%BRIDGE_DIR%"
call npm run build
if %ERRORLEVEL% neq 0 (
  echo [ERROR] Print Bridge TypeScript compilation failed!
  pause
  exit /b %ERRORLEVEL%
)
echo [Step 2/3] Compilation completed successfully.
echo.

echo [Step 3/3] Packaging Windows (.exe) Installer with Electron Builder...
cd /d "%BRIDGE_DIR%"
call npx electron-builder --win --x64
if %ERRORLEVEL% neq 0 (
  echo [ERROR] Electron packaging failed!
  pause
  exit /b %ERRORLEVEL%
)
echo.
echo =====================================================================
echo  [SUCCESS] UniPro POS Counter Windows Installer Created Successfully!
echo =====================================================================
echo  Installer location:
echo    %OUTPUT_DIR%
echo =====================================================================
echo.
pause
