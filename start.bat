@echo off
REM Double-click this to run Northstar Delivery.
REM Bypasses PowerShell's script-execution policy for just this one run,
REM rather than changing any system-wide setting.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
pause
