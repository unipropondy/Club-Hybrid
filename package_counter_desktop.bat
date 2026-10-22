@echo off
setlocal enabledelayedexpansion
title Smart-Club POS UniPro - Windows Desktop Packager (.exe Installer)
echo =====================================================================
echo       Smart-Club POS UniPro - Windows Desktop Application Packager
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
echo [Step 0/3] Cleaning Stale Build Artifacts ^& Temp Folders...
if exist "%BRIDGE_DIR%\dist" rmdir /s /q "%BRIDGE_DIR%\dist" >nul 2>&1
if exist "%BRIDGE_DIR%\customer-display-web" rmdir /s /q "%BRIDGE_DIR%\customer-display-web" >nul 2>&1
if exist "C:\unipro_build_output" rmdir /s /q "C:\unipro_build_output" >nul 2>&1
echo [Step 0/3] Workspace cleaned successfully.
echo.

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
echo [Step 1b/3] Inlining Vector Icons ^& Typography into Web Bundle...
cd /d "%BRIDGE_DIR%"
call node inline_fonts.js
echo [Step 1b/3] Font injection completed successfully.
echo.

echo [Step 2/3] Compiling Print-Bridge ^& Desktop Host TypeScript...
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

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"
copy /Y "C:\unipro_build_output\*.exe" "%OUTPUT_DIR%\" >nul 2>&1

echo.
echo =====================================================================
echo  [SUCCESS] Smart-Club POS UniPro Windows Installer Created Successfully!
echo =====================================================================
echo  Installer location:
echo    %OUTPUT_DIR%\Smart-Club POS UniPro Setup 1.0.0.exe
echo    or C:\unipro_build_output\
echo =====================================================================
echo.
pause
