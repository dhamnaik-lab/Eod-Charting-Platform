@echo off
cd /d "E:\TA Projects\EOD Charting Platform"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\run-release-preview.ps1"
pause