@echo off
REM Quick Git Sync - Simple batch wrapper
REM Usage: git-sync.bat [commit message]

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "git-sync.ps1" %*
