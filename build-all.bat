@echo off
echo Building Shooter X v1.2.7 Packages...

REM Create build directory if it doesn't exist
if not exist "dist" mkdir dist

REM Clean up old files if they exist
if exist "dist\ShooterX-v1.2.7.zip" del "dist\ShooterX-v1.2.7.zip"
if exist "dist\ShooterX-Setup-1.2.7.exe" del "dist\ShooterX-Setup-1.2.7.exe"

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
powershell -Command "& {Compress-Archive -Path dist\shooter-x-win32-x64\* -DestinationPath dist\ShooterX-v1.2.7.zip -Force}"

if errorlevel 1 (
    echo Failed to create ZIP file!
    pause
    exit /b 1
) else (
    echo ZIP file created successfully at: %CD%\dist\ShooterX-v1.2.7.zip
)

REM Build installer if NSIS is available
echo Building installer...
if exist "%PROGRAMFILES(X86)%\NSIS\makensis.exe" (
    "%PROGRAMFILES(X86)%\NSIS\makensis.exe" installer.nsi
    if errorlevel 1 (
        echo Failed to build installer!
    ) else (
        echo Installer built successfully at: %CD%\dist\ShooterX-Setup-1.2.7.exe
    )
) else (
    echo NSIS not found. Skipping installer creation.
)

echo Build process completed!
echo ZIP package: %CD%\dist\ShooterX-v1.2.7.zip
echo Installer: %CD%\dist\ShooterX-Setup-1.2.7.exe

pause 