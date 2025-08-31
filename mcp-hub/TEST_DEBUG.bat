@echo off
:: Quick test script to verify START_HERE.bat fixes

echo ========================================================
echo Testing START_HERE.bat Debug Mode
echo ========================================================
echo.

echo Test 1: Help message
echo ----------------------------------------
call START_HERE.bat --help
echo.

echo Test 2: Debug mode flag
echo ----------------------------------------
echo Running: START_HERE.bat --debug
echo.
echo This will show all commands and detailed output.
echo Press Ctrl+C to cancel, or
pause

call START_HERE.bat --debug