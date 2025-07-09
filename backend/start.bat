@echo off
echo Starting ShooterX Bug Reporter Backend...

REM Check if discord_token.txt exists and load it
if exist "discord_token.txt" (
    echo Found Discord token file, loading token...
    set /p DISCORD_TOKEN=<discord_token.txt
    echo Discord token loaded from file
) else (
    echo No Discord token file found, using environment variable if set
)

REM Start the server
npm start 