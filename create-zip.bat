@echo off
setlocal enabledelayedexpansion

REM Auto-detect version from package.json
for /f "tokens=2 delims=:," %%a in ('powershell -Command "& {(Get-Content package.json | ConvertFrom-Json).version}"') do set "VERSION=%%~a"
set "VERSION=%VERSION: =%"
if "%VERSION%"=="" set "VERSION=2.1.0"
set "ZIP_FILE=dist\ShooterX-v%VERSION%.zip"

echo Creating Shooter X ZIP Package v%VERSION%...

if not exist "dist" mkdir dist

if exist "%ZIP_FILE%" del "%ZIP_FILE%"

echo Building Electron app (electron-builder)...
call npm run package-win
if errorlevel 1 (
    echo electron-builder failed, trying electron-packager...
    call npm run package-win-legacy
    if errorlevel 1 (
        echo Failed to build Electron app!
        pause
        exit /b 1
    )
    set "BUILD_DIR=dist\shooter-x-win32-x64"
) else (
    set "BUILD_DIR=dist\win-unpacked"
)

if not exist "!BUILD_DIR!" (
    echo Build directory !BUILD_DIR! not found!
    pause
    exit /b 1
)

echo Creating ZIP file...

set "SEVENZIP_PATH=C:\Program Files\7-Zip\7z.exe"
if exist "%SEVENZIP_PATH%" (
    echo Using 7-Zip for faster compression...
    "%SEVENZIP_PATH%" a -tzip "%ZIP_FILE%" "!BUILD_DIR!\*" -mx=5 -mmt=on
    if errorlevel 1 (
        echo 7-Zip failed, falling back to PowerShell...
        goto use_powershell
    ) else (
        echo ZIP file created successfully with 7-Zip!
        goto zip_success
    )
) else (
    echo 7-Zip not found, using PowerShell...
    goto use_powershell
)

:use_powershell
powershell -Command "& {$ProgressPreference = 'SilentlyContinue'; Compress-Archive -Path !BUILD_DIR!\* -DestinationPath '%ZIP_FILE%' -Force}"
if errorlevel 1 (
    echo Failed to create ZIP file!
    pause
    exit /b 1
) else (
    echo ZIP file created successfully with PowerShell!
)

:zip_success
echo The ZIP file is located at: %CD%\%ZIP_FILE%
pause
