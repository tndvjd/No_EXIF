@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "NOEXIF_E2E="
set "NOEXIF_E2E_EXIF_PARENT_DIR="
set "NOEXIF_E2E_GRID_OUTPUT_PATH="
set "NOEXIF_E2E_METADATA_JSON_PATH="
set "NOEXIF_E2E_TEMPLATE_SAVE_PATH="
set "NOEXIF_E2E_TEMPLATE_LOAD_PATH="
set "NOEXIF_E2E_PROMPT_CARD_OUTPUT_PATH="

pushd "%~dp0" || (
    echo Failed to enter the No EXIF folder.
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo Node.js was not found. Install Node.js 20 or newer to run No EXIF Pro.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo npm was not found. Reinstall Node.js with npm enabled.
    pause
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    where py >nul 2>&1
    if errorlevel 1 (
        echo Python was not found. Install Python 3.10 or newer to process images.
        pause
        exit /b 1
    )
    echo Creating Python workspace for image processing...
    py -3 -m venv .venv
    if errorlevel 1 (
        echo Python virtual environment creation failed.
        pause
        exit /b 1
    )
)

".venv\Scripts\python.exe" -c "import PIL" >nul 2>&1
if errorlevel 1 (
    echo Installing Python image-processing dependencies...
    call ".venv\Scripts\python.exe" -m pip install -r requirements-pro.txt
    if errorlevel 1 (
        echo Python dependency install failed.
        pause
        exit /b 1
    )
)

if not exist "node_modules" (
    echo Installing No EXIF Pro desktop dependencies...
    call npm install
    if errorlevel 1 (
        echo npm install failed.
        pause
        exit /b 1
    )
)

echo Building No EXIF Pro interface...
call npm run build
if errorlevel 1 (
    echo Interface build failed.
    pause
    exit /b 1
)

echo Starting No EXIF Pro...
call npm run electron
if errorlevel 1 (
    echo No EXIF Pro exited with an error.
    pause
    exit /b 1
)

popd
endlocal
exit /b 0
