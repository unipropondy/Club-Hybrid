@echo off
title Unipro POS - Open Port 5000 in Windows Firewall
color 0B
echo =================================================================
echo  UNIPRO HYBRID POS - FIREWALL CONFIGURATION FOR WAITER TABLETS
echo =================================================================
echo  This script opens inbound port 5000 in Windows Firewall so
echo  Android waiter tablets can connect to this Counter PC over Wi-Fi.
echo =================================================================
echo.
netsh advfirewall firewall add rule name="Unipro POS Server (Port 5000)" dir=in action=allow protocol=TCP localport=5000
echo.
echo =================================================================
echo  Firewall rule added successfully!
echo  Android tablets on the same Wi-Fi can now connect.
echo =================================================================
pause
