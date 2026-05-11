@echo off
echo Installing Python dependencies...
cd /d %~dp0backend
py -m pip install -r requirements.txt --quiet
echo.
echo Installing frontend dependencies...
cd /d %~dp0frontend
cmd /c npm install
echo.
echo Done! Run start.bat to launch.
pause
