@echo off
setlocal
cd /d "%~dp0"

py -3.12 --version >nul 2>&1
if errorlevel 1 (
    echo Install Python 3.12 with the Windows Python launcher, then try again.
    pause
    exit /b 1
)

set "APP_DATA=%LOCALAPPDATA%\IELTS Dictation Lab"
set "RUNTIME=%APP_DATA%\runtime"
set "PYTHON=%RUNTIME%\Scripts\python.exe"
set "IELTS_MODEL_CACHE=%APP_DATA%\models"

if not exist "%PYTHON%" (
    py -3.12 -m venv "%RUNTIME%"
    if errorlevel 1 goto failed
)

"%PYTHON%" -m pip install --disable-pip-version-check -r requirements.txt
if errorlevel 1 goto failed

echo Open http://127.0.0.1:8765/ in your browser.
echo Keep this window open while practising. Press Ctrl+C to stop.
"%PYTHON%" guided_server.py
if errorlevel 1 goto failed
exit /b 0

:failed
echo The app could not start. Check the error above.
pause
exit /b 1
