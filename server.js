// Simple server for Render.com deployment
// This file starts the backend server only, without the Electron UI

import backendStarter from './src/backendStarter.js';

console.log('Starting ShooterX backend in server-only mode...');

// Initialize backend server
try {
  const backendReady = await backendStarter.init();
  if (backendReady) {
    console.log('Bug reporter backend server started successfully');
  } else {
    console.error('Bug reporter backend server failed to start');
    process.exit(1);
  }
} catch (error) {
  console.error('Error starting backend server:', error);
  process.exit(1);
}

// Keep the process alive
console.log('Server is running. Press Ctrl+C to stop.'); 