// Check if we're running in an environment where Electron is available
let electron;
let app;
let BrowserWindow;
let ipcMain;

try {
  electron = await import('electron');
  app = electron.app;
  BrowserWindow = electron.BrowserWindow;
  ipcMain = electron.ipcMain;
  
  // Enable WebGPU, ignore GPU blocklist, and ensure hardware acceleration
  app.commandLine.appendSwitch('enable-unsafe-webgpu');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
  app.commandLine.appendSwitch('enable-webgpu-developer-features');
} catch (error) {
  console.log('Electron not available in this environment. Running in server-only mode.');
  // Create mock objects for server environment
  app = {
    whenReady: () => Promise.resolve(),
    on: (event, callback) => {},
    quit: () => {}
  };
  BrowserWindow = {
    getAllWindows: () => []
  };
  ipcMain = {
    on: (channel, listener) => {}
  };
}

import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import backend starter
import backendStarter from './backendStarter.js';

let mainWindow = null;

// Enable debug logging
const DEBUG = process.env.NODE_ENV === 'development';
function debug(...args) {
    if (DEBUG) {
        console.log('[Main Process]', ...args);
    }
}

// Handle IPC messages
ipcMain.on('quit-game', () => {
    debug('Quit game request received');
    if (mainWindow) {
        mainWindow.close();
    }
    app.quit();
});

// Function to create window - only if Electron is available
function createWindow() {
    if (!electron) {
        debug('Skipping window creation - Electron not available');
        return;
    }
    
    try {
        debug('Creating main window...');
        
        // Create the browser window.
        mainWindow = new BrowserWindow({
            width: 1280,
            height: 720,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableRemoteModule: true,
                devTools: true,
                webSecurity: true
            },
            frame: false,
            resizable: false,
            fullscreen: true,
            icon: path.join(__dirname, 'textures/icons/icon.png')
        });

        // Load the game HTML file
        const indexPath = path.join(__dirname, 'index.html');
        debug('Loading index.html from:', indexPath);
        mainWindow.loadFile(indexPath);

        // Handle window close
        mainWindow.on('closed', () => {
            debug('Main window closed');
            mainWindow = null;
        });

        // Setup debugging in development mode
        if (DEBUG) {
            // Open DevTools
            mainWindow.webContents.openDevTools();
            
            // Log renderer process errors
            mainWindow.webContents.on('crashed', (event) => {
                console.error('Renderer process crashed:', event);
            });

            mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
                const levels = ['debug', 'log', 'info', 'warn', 'error'];
                console[levels[level] || 'log'](`[Renderer] ${message}`);
                if (sourceId) {
                    debug(`Source: ${sourceId}:${line}`);
                }
            });
        }

        debug('Main window created successfully');
    } catch (error) {
        console.error('Error creating window:', error);
    }
}

// Wait for app to be ready
app.whenReady().then(async () => {
    try {
        debug('Application ready, starting backend and creating window...');
        
        // Initialize backend server
        try {
            const backendReady = await backendStarter.init();
            if (backendReady) {
                debug('Bug reporter backend server started successfully');
            } else {
                console.warn('Bug reporter backend server failed to start. Bug reporting may not work.');
            }
        } catch (backendError) {
            console.error('Error starting backend server:', backendError);
            // Continue anyway, the game should work without bug reporting
        }
        
        // Create main window if Electron is available
        if (electron) {
            createWindow();
        } else {
            console.log('Running in server-only mode (no Electron UI)');
        }
    } catch (error) {
        console.error('Error in app.whenReady:', error);
    }
});

// Handle window activation
app.on('activate', () => {
    try {
        if (electron && BrowserWindow.getAllWindows().length === 0) {
            debug('No windows found, creating new window...');
            createWindow();
        }
    } catch (error) {
        console.error('Error in activate handler:', error);
    }
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
    try {
        debug('All windows closed');
        if (electron && process.platform !== 'darwin') {
            app.quit();
        }
    } catch (error) {
        console.error('Error in window-all-closed handler:', error);
    }
});

// Clean up backend when app is quitting
app.on('quit', () => {
    try {
        debug('Application quitting, performing cleanup...');
        // No need to explicitly stop the backend as we're using a detached process
        // The backend will continue running so bug reports can be submitted even after game exit
    } catch (error) {
        console.error('Error in quit handler:', error);
    }
}); 