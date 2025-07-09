#!/bin/bash
echo "Starting ShooterX Bug Reporter Backend..."

# Check if discord_token.txt exists and load it
if [ -f "discord_token.txt" ]; then
    echo "Found Discord token file, loading token..."
    export DISCORD_TOKEN=$(cat discord_token.txt)
    echo "Discord token loaded from file"
else
    echo "No Discord token file found, using environment variable if set"
fi

# Start the server
npm start 