@echo off
setlocal EnableExtensions
chcp 65001 >nul

pushd "%~dp0" || (
    echo Failed to enter the No EXIF folder.
    pause
    exit /b 1
)

set "PYTHON_CMD="%~dp0.venv\Scripts\python.exe""
if exist "%~dp0.venv\Scripts\python.exe" goto :python_ready

where py >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=py -3"
    goto :python_ready
)

where python >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=python"
    goto :python_ready
)

echo Python was not found.
pause
exit /b 1

:python_ready
%PYTHON_CMD% -c "import PyQt6, PIL" >nul 2>&1
if errorlevel 1 (
    echo Installing required Python packages...
    %PYTHON_CMD% -m pip install -r requirements.txt
    if errorlevel 1 (
        echo Package install failed.
        pause
        exit /b 1
    )
)

%PYTHON_CMD% main.py
if errorlevel 1 (
    echo Legacy PyQt app exited with an error.
    pause
    exit /b 1
)

popd
endlocal
exit /b 0
