@echo off
title Unipro POS - Clone Cloud Database to Local
color 0A
echo =================================================================
echo  UNIPRO HYBRID POS - CLOUD TO LOCAL DATABASE SYNC UTILITY
echo =================================================================
echo  This tool will copy all data from Central Cloud (myerpcloud)
echo  to your Local SQL Server (localhost\UCSCLUB).
echo.
echo  Ensure SQL Server is running locally and Internet is connected.
echo =================================================================
echo.
cd /d "%~dp0backend"
node scripts/clone_cloud_to_local.js
echo.
echo =================================================================
echo  Script finished. Press any key to exit this window.
echo =================================================================
pause
