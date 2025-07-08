// Backend auto-starter for ShooterX Bug Reporter
// This module automatically starts the backend server when the game loads

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';

class BackendStarter {
    constructor() {
        this.backendProcess = null;
        this.backendUrl = 'http://localhost:3000';
        this.healthEndpoint = '/api/health';
        this.isStarting = false;
        this.maxRetries = 3;
        this.retryCount = 0;
        this.checkIntervalMs = 2000;
        
        // Get the backend path relative to the current file
        // Handle ES modules __dirname equivalent
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        this.backendPath = path.join(__dirname, '..', 'backend');
    }

    /**
     * Initialize the backend - check if it's running and start if needed
     * @returns {Promise} Resolves when backend is ready
     */
    async init() {
        console.log('[BackendStarter] Initializing backend check...');
        
        try {
            // First check if backend is already running
            const isRunning = await this.checkIfBackendIsRunning();
            
            if (isRunning) {
                console.log('[BackendStarter] Backend is already running');
                return true;
            } else {
                console.log('[BackendStarter] Backend is not running, starting it...');
                return this.startBackend();
            }
        } catch (error) {
            console.error('[BackendStarter] Error during initialization:', error);
            return false;
        }
    }

    /**
     * Check if the backend server is already running
     * @returns {Promise<boolean>} True if running
     */
    checkIfBackendIsRunning() {
        return new Promise((resolve) => {
            // Try to connect to the health endpoint
            http.get(`${this.backendUrl}${this.healthEndpoint}`, (res) => {
                if (res.statusCode === 200) {
                    // Backend is running!
                    resolve(true);
                } else {
                    resolve(false);
                }
            }).on('error', () => {
                // Connection failed, backend is not running
                resolve(false);
            });
        });
    }

    /**
     * Start the backend server
     * @returns {Promise<boolean>} True if started successfully
     */
    startBackend() {
        return new Promise((resolve) => {
            if (this.isStarting) {
                console.log('[BackendStarter] Backend is already starting...');
                this.waitForBackend().then(resolve);
                return;
            }
            
            this.isStarting = true;
            
            // Make sure the backend directory exists
            if (!fs.existsSync(this.backendPath)) {
                console.error(`[BackendStarter] Backend directory not found at ${this.backendPath}`);
                this.isStarting = false;
                resolve(false);
                return;
            }
            
            // Check if package.json exists
            if (!fs.existsSync(path.join(this.backendPath, 'package.json'))) {
                console.error(`[BackendStarter] package.json not found in ${this.backendPath}`);
                this.isStarting = false;
                resolve(false);
                return;
            }
            
            console.log(`[BackendStarter] Starting backend from ${this.backendPath}`);
            
            try {
                // Start the backend as a detached process
                this.backendProcess = spawn('npm', ['start'], {
                    cwd: this.backendPath,
                    detached: true,
                    stdio: 'ignore', // Uncomment the next line if you want to see backend logs
                    // stdio: 'inherit',
                    shell: true
                });
                
                // Detach the process so it continues running if the game closes
                this.backendProcess.unref();
                
                console.log('[BackendStarter] Backend process started, waiting for server to be ready...');
                
                // Wait for the backend to be ready
                this.waitForBackend().then(resolve);
                
            } catch (error) {
                console.error('[BackendStarter] Failed to start backend:', error);
                this.isStarting = false;
                resolve(false);
            }
        });
    }

    /**
     * Wait for the backend to become available
     * @returns {Promise<boolean>} True when backend is available
     */
    waitForBackend() {
        return new Promise((resolve) => {
            const checkServer = () => {
                this.checkIfBackendIsRunning().then(isRunning => {
                    if (isRunning) {
                        console.log('[BackendStarter] Backend is now running!');
                        this.isStarting = false;
                        this.retryCount = 0;
                        resolve(true);
                    } else {
                        this.retryCount++;
                        if (this.retryCount > this.maxRetries) {
                            console.error(`[BackendStarter] Backend failed to start after ${this.maxRetries} attempts`);
                            this.isStarting = false;
                            resolve(false);
                            return;
                        }
                        
                        console.log(`[BackendStarter] Waiting for backend... (attempt ${this.retryCount}/${this.maxRetries})`);
                        setTimeout(checkServer, this.checkIntervalMs);
                    }
                });
            };
            
            // Start checking
            setTimeout(checkServer, 1000); // Give it a second to start
        });
    }

    /**
     * Stop the backend server
     * Only use this when the game is shutting down completely
     */
    stopBackend() {
        if (this.backendProcess && !this.backendProcess.killed) {
            console.log('[BackendStarter] Stopping backend server...');
            this.backendProcess.kill();
        }
    }
}

// Create a singleton instance
const backendStarter = new BackendStarter();

export default backendStarter; 