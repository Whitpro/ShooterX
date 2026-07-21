@echo off
echo Building Shooter X Installer...

REM Check if NSIS is installed
if not exist "%PROGRAMFILES(X86)%\NSIS\makensis.exe" (
    echo NSIS is not installed! Please install NSIS from https://nsis.sourceforge.io/Download
    pause
    exit /b 1
)

REM Build the installer
"%PROGRAMFILES(X86)%\NSIS\makensis.exe" installer.nsi

if errorlevel 1 (
    echo Failed to build installer!
    pause
    exit /b 1
) else (
    echo Installer built successfully!
    echo The installer is located at: %CD%\ShooterX-Setup.exe
)

pause 