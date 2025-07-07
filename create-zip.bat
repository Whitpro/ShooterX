@echo off
echo Creating Shooter X ZIP Package v1.1.5...

REM Create build directory if it doesn't exist
if not exist "dist" mkdir dist

REM Clean up old zip file if it exists
if exist "dist\ShooterX-v1.1.5.zip" del "dist\ShooterX-v1.1.5.zip"

REM Build the electron app first
echo Building Electron app...
call npm run package-win
if errorlevel 1 (
    echo Failed to build Electron app!
    pause
    exit /b 1
)

REM Package the app into a ZIP file using PowerShell
echo Creating ZIP file...
powershell -Command "& {Compress-Archive -Path dist\shooter-x-win32-x64\* -DestinationPath dist\ShooterX-v1.1.5.zip -Force}"

if errorlevel 1 (
    echo Failed to create ZIP file!
    pause
    exit /b 1
) else (
    echo ZIP file created successfully!
    echo The ZIP file is located at: %CD%\dist\ShooterX-v1.1.5.zip
)

pause 