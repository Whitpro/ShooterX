@echo off
echo Building Shooter X v1.2.8 Packages...

REM Create build directory if it doesn't exist
if not exist "dist" mkdir dist

REM Clean up old files if they exist
if exist "dist\ShooterX-v1.2.8.zip" del "dist\ShooterX-v1.2.8.zip"
if exist "dist\ShooterX-Setup-1.2.8.exe" del "dist\ShooterX-Setup-1.2.8.exe"

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

REM Check if 7-Zip is available (much faster than PowerShell's Compress-Archive)
set "SEVENZIP_PATH=C:\Program Files\7-Zip\7z.exe"
if exist "%SEVENZIP_PATH%" (
    echo Using 7-Zip for faster compression...
    
    REM Use 7-Zip with multi-threading and optimal compression settings
    "%SEVENZIP_PATH%" a -tzip "dist\ShooterX-v1.2.8.zip" "dist\shooter-x-win32-x64\*" -mx=5 -mmt=on
    
    if errorlevel 1 (
        echo Failed to create ZIP file with 7-Zip!
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
REM Fallback to PowerShell but with optimized parameters
echo Using PowerShell for compression...
powershell -Command "& {$ProgressPreference = 'SilentlyContinue'; Compress-Archive -Path dist\shooter-x-win32-x64\* -DestinationPath dist\ShooterX-v1.2.8.zip -Force}"

if errorlevel 1 (
    echo Failed to create ZIP file!
    pause
    exit /b 1
) else (
    echo ZIP file created successfully with PowerShell!
)

:zip_success
echo ZIP file created successfully at: %CD%\dist\ShooterX-v1.2.8.zip

REM Build installer if NSIS is available
echo Building installer...
if exist "%PROGRAMFILES(X86)%\NSIS\makensis.exe" (
    "%PROGRAMFILES(X86)%\NSIS\makensis.exe" installer.nsi
    if errorlevel 1 (
        echo Failed to build installer!
    ) else (
        echo Installer built successfully at: %CD%\dist\ShooterX-Setup-1.2.8.exe
    )
) else (
    echo NSIS not found. Skipping installer creation.
)

echo Build process completed!
echo ZIP package: %CD%\dist\ShooterX-v1.2.8.zip
echo Installer: %CD%\dist\ShooterX-Setup-1.2.8.exe

pause 