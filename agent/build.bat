@echo off
REM Builds a single-file thamaraa-agent.exe for Windows.
REM Run on a Windows machine with Python 3.9+ installed.
python -m pip install --upgrade pip
python -m pip install -r requirements.txt pyinstaller
REM A console is kept so first-run setup (consent + token) can prompt.
pyinstaller --onefile --name thamaraa-agent thamaraa_agent.py
echo.
echo Built dist\thamaraa-agent.exe
