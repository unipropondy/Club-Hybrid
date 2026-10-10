@echo off
echo ==========================================================
echo Enabling Mixed Mode Authentication and TCP/IP for Local SQL Server...
echo ==========================================================

:: Enable Mixed Mode Authentication (allows user 'sa' login)
reg add "HKLM\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQLServer" /v LoginMode /t REG_DWORD /d 2 /f
reg add "HKLM\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL15.UPS\MSSQLServer" /v LoginMode /t REG_DWORD /d 2 /f

:: Enable TCP/IP on SQL Server
reg add "HKLM\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQLServer\SuperSocketNetLib\Tcp" /v Enabled /t REG_DWORD /d 1 /f
reg add "HKLM\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL15.UPS\MSSQLServer\SuperSocketNetLib\Tcp" /v Enabled /t REG_DWORD /d 1 /f

:: Restart SQL Server service to apply changes
net stop "MSSQL$SQLEXPRESS"
net start "MSSQL$SQLEXPRESS"

echo ==========================================================
echo SUCCESS! Mixed Mode Authentication and TCP/IP are now ENABLED.
echo User 'sa' with password 'Unipro@2026' can now connect locally.
echo ==========================================================
pause
