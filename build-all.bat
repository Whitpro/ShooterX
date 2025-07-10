@echo off
echo Building Shooter X v1.2.6 Packages...

REM Create build directory if it doesn't exist
if not exist "dist" mkdir dist

REM Step 1: Build the electron app
echo ===== Building Electron app =====
call npm run package-win
if errorlevel 1 (
    echo Failed to build Electron app!
    pause
    exit /b 1
)

REM Step 2: Create ZIP file
echo ===== Creating ZIP package =====
powershell -Command "& {Compress-Archive -Path dist\shooter-x-win32-x64\* -DestinationPath dist\ShooterX-v1.2.6.zip -Force}"

if errorlevel 1 (
    echo Failed to create ZIP file!
    pause
    exit /b 1
) else (
    echo ZIP file created successfully at: %CD%\dist\ShooterX-v1.2.6.zip
)

REM Step 3: Build the installer
echo ===== Building installer =====
REM Check if NSIS is installed
if not exist "%PROGRAMFILES(X86)%\NSIS\makensis.exe" (
    echo WARNING: NSIS is not installed! Skipping installer creation.
    echo Please install NSIS from https://nsis.sourceforge.io/Download to create the installer.
) else (
    "%PROGRAMFILES(X86)%\NSIS\makensis.exe" installer.nsi

    if errorlevel 1 (
        echo Failed to build installer!
        pause
        exit /b 1
    ) else (
        echo Installer built successfully at: %CD%\dist\ShooterX-Setup-1.2.6.exe
    )
)

echo ===== All packages built successfully! =====
echo ZIP package: %CD%\dist\ShooterX-v1.2.6.zip
echo Installer: %CD%\dist\ShooterX-Setup-1.2.6.exe
pause 