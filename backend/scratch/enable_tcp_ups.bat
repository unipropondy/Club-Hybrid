@echo off
echo Enabling TCP/IP for MSSQL15.UPS instance...
reg add "HKLM\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL15.UPS\MSSQLServer\SuperSocketNetLib\Tcp" /v Enabled /t REG_DWORD /d 1 /f
reg add "HKLM\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL15.UPS\MSSQLServer\SuperSocketNetLib\Tcp\IPAll" /v TcpPort /t REG_SZ /d 1433 /f
reg add "HKLM\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL15.UPS\MSSQLServer\SuperSocketNetLib\Tcp\IPAll" /v TcpDynamicPorts /t REG_SZ /d "" /f

echo Restarting SQL Server (UPS) service...
net stop "MSSQL$UPS"
net start "MSSQL$UPS"

echo Restarting SQL Server Browser service...
net stop "SQLBrowser"
net start "SQLBrowser"

echo Done! TCP/IP is now fully enabled for SQL Server (UPS).
