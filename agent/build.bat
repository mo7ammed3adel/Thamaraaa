@echo off
REM Builds a single-file thamaraa-agent.exe for Windows.
REM Run on a Windows machine with Python 3.9+ installed.
python -m pip install --upgrade pip
python -m pip install -r requirements.txt pyinstaller
REM --windowed: no console window. Setup is a real dialog and the running agent
REM shows nothing, so a black cmd window would just be noise.
REM --icon: the Viral logo is embedded, so the exe carries no ThamaraaAgent name.
pyinstaller --onefile --windowed --icon viral.ico --name thamaraa-agent thamaraa_agent.py
echo.
echo Built dist\thamaraa-agent.exe
