/**
 * Settings UI module for ShooterX game
 * Provides UI for configuring game settings
 */

import { ENEMY_TYPES } from './enemyTypes.js';

// Debug logging utility
function debug(...args) {
    if (process.env.NODE_ENV === 'development') {
        console.log('[Settings]', ...args);
    } else {
        console.log(...args);
    }
}

class Settings {
    constructor(game, ui) {
        this.game = game;
        this.ui = ui;
        this.initialized = false;
        this.fpsCounter = null;
        this.fpsMonitoringActive = false;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        
        // Default settings
        this.settings = {
            mouseSensitivity: 0.002, // Default sensitivity
            hideTextures: false,     // Show textures by default
            fpsLock: 0,              // 0 = unlimited, other values = fps cap (always unlimited now)
            showFpsCounter: true     // FPS counter display toggle - enabled by default
        };
        
        // Try to load saved settings
        this.loadSettings();
        
        // Create settings UI
        this.createSettingsUI();
        
        // Initialize FPS counter if enabled
        if (this.settings.showFpsCounter) {
            this.createFpsCounter();
        }
    }
    
    createSettingsUI() {
        debug('Creating settings UI');
        
        // Create settings screen if it doesn't exist
        if (!document.getElementById('settingsScreen')) {
            // Create container
            this.settingsScreen = document.createElement('div');
            this.settingsScreen.id = 'settingsScreen';
            this.settingsScreen.className = 'menu';
            this.settingsScreen.style.display = 'none';
            
            // Create content
            this.settingsScreen.innerHTML = `
                <div class="menu-content">
                    <h1>Settings</h1>
                    
                    <div class="settings-group">
                        <label for="mouseSensitivity">Mouse Sensitivity</label>
                        <div class="setting-control">
                            <input type="range" id="mouseSensitivity" min="0.0005" max="0.005" step="0.0001" value="${this.settings.mouseSensitivity}">
                            <span id="mouseSensitivityValue">${(this.settings.mouseSensitivity * 1000).toFixed(1)}</span>
                        </div>
                    </div>
                    
                    <div class="settings-group">
                        <label for="hideTextures">Hide Textures</label>
                        <div class="setting-control">
                            <label class="toggle">
                                <input type="checkbox" id="hideTextures" ${this.settings.hideTextures ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="settings-group">
                        <label for="showFpsCounter">Show FPS Counter</label>
                        <div class="setting-control">
                            <label class="toggle">
                                <input type="checkbox" id="showFpsCounter" ${this.settings.showFpsCounter ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <button id="settingsBackButton" class="menu-button">Back</button>
                </div>
            `;
            
            // Add CSS styles for settings UI
            const style = document.createElement('style');
            style.textContent = `
                #settingsScreen {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    color: white;
                    font-family: 'Rajdhani', 'Orbitron', sans-serif;
                    z-index: 1001;
                    display: none;
                    pointer-events: auto;
                    background: rgba(0, 0, 0, 0.8);
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 0 30px rgba(0, 255, 255, 0.3);
                    border: 1px solid rgba(0, 255, 255, 0.2);
                    transition: all 0.3s ease-in-out;
                    backdrop-filter: blur(10px);
                    min-width: 400px;
                }
                
                #settingsScreen h1 {
                    font-size: 36px;
                    margin-bottom: 30px;
                    text-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
                    letter-spacing: 3px;
                    text-transform: uppercase;
                }
                
                #settingsScreen.visible {
                    display: flex;
                    animation: menuAppear 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                }
                
                .settings-group {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin: 20px 0;
                    padding: 10px;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 8px;
                }
                
                .settings-group label {
                    font-size: 18px;
                    margin-right: 20px;
                    color: #ffffff;
                    font-weight: 500;
                    text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
                }
                
                .setting-control {
                    display: flex;
                    align-items: center;
                }
                
                /* Value display for slider */
                #mouseSensitivityValue {
                    color: #ffffff;
                    font-weight: bold;
                    min-width: 30px;
                    text-align: center;
                }
                
                /* Slider styles */
                input[type="range"] {
                    -webkit-appearance: none;
                    width: 200px;
                    height: 6px; /* Reduced height */
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 3px;
                    outline: none;
                    margin-right: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.7);
                    box-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
                    position: relative;
                    vertical-align: middle;
                }
                
                /* Add track styles for better visibility */
                input[type="range"]::-webkit-slider-runnable-track {
                    height: 6px; /* Match height */
                    background: linear-gradient(to right, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.2));
                    border-radius: 3px;
                    border: none;
                    margin: 0;
                    padding: 0;
                }
                
                input[type="range"]::-moz-range-track {
                    height: 6px; /* Match height */
                    background: linear-gradient(to right, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.2));
                    border-radius: 3px;
                    border: none;
                }
                
                input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #ffffff;
                    cursor: pointer;
                    border: 2px solid white;
                    box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
                    margin-top: -7px; /* Further adjusted to center on track */
                    position: relative;
                    z-index: 2;
                }
                
                input[type="range"]::-moz-range-thumb {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #ffffff;
                    cursor: pointer;
                    border: 2px solid white;
                    box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
                }
                
                /* Toggle switch styles */
                .toggle {
                    position: relative;
                    display: inline-block;
                    width: 60px;
                    height: 30px;
                }
                
                .toggle input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                
                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.4);
                    transition: .4s;
                    border-radius: 34px;
                    border: 1px solid rgba(255, 255, 255, 0.7);
                    box-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
                }
                
                .slider:before {
                    position: absolute;
                    content: "";
                    height: 22px;
                    width: 22px;
                    left: 4px;
                    bottom: 4px;
                    background-color: white;
                    transition: .4s;
                    border-radius: 50%;
                }
                
                input:checked + .slider {
                    background-color: #ffffff;
                    box-shadow: 0 0 10px rgba(255, 255, 255, 0.7);
                }
                
                input:checked + .slider:before {
                    transform: translateX(30px);
                    background-color: #2196F3;
                }
                
                /* Select styles */
                select {
                    background: rgba(0, 0, 0, 0.4);
                    color: white;
                    border: 1px solid rgba(33, 150, 243, 0.5);
                    padding: 8px 12px;
                    border-radius: 5px;
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 16px;
                    outline: none;
                    cursor: pointer;
                }
                
                select:focus {
                    border-color: #2196F3;
                    box-shadow: 0 0 5px rgba(33, 150, 243, 0.5);
                }
                
                #settingsBackButton {
                    margin-top: 30px;
                    background: linear-gradient(135deg, #2196F3, #0D47A1);
                    color: white;
                    padding: 12px 30px;
                    border: none;
                    border-radius: 5px;
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 18px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                #settingsBackButton:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(33, 150, 243, 0.4);
                }
            `;
            document.head.appendChild(style);
            
            // Add to game UI
            const gameUI = document.getElementById('game-ui');
            if (!gameUI) {
                console.error('game-ui container not found, creating it');
                const newGameUI = document.createElement('div');
                newGameUI.id = 'game-ui';
                document.body.appendChild(newGameUI);
                newGameUI.appendChild(this.settingsScreen);
            } else {
                gameUI.appendChild(this.settingsScreen);
            }
            
            this.initialized = true;
        } else {
            this.settingsScreen = document.getElementById('settingsScreen');
        }
        
        // Add event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        debug('Setting up settings event listeners');
        
        // Back button
        const backButton = document.getElementById('settingsBackButton');
        if (backButton) {
            backButton.onclick = () => {
                // Save settings when exiting
                this.saveSettings();
                
                this.hide();
                if (this.ui) {
                    this.ui.hideSettingsScreen();
                }
            };
        }
        
        // Mouse sensitivity slider
        const sensitivitySlider = document.getElementById('mouseSensitivity');
        const sensitivityValue = document.getElementById('mouseSensitivityValue');
        if (sensitivitySlider && sensitivityValue) {
            sensitivitySlider.oninput = () => {
                const value = parseFloat(sensitivitySlider.value);
                this.settings.mouseSensitivity = value;
                sensitivityValue.textContent = (value * 1000).toFixed(1);
                
                // Apply mouse sensitivity immediately
                this.applyMouseSensitivity(value);
            };
        }
        
        // Hide textures toggle
        const hideTexturesToggle = document.getElementById('hideTextures');
        if (hideTexturesToggle) {
            hideTexturesToggle.onchange = () => {
                this.settings.hideTextures = hideTexturesToggle.checked;
                
                // Apply texture visibility setting immediately
                this.applyTextureVisibility(hideTexturesToggle.checked);
            };
        }
        
        // FPS counter toggle
        const fpsCounterToggle = document.getElementById('showFpsCounter');
        if (fpsCounterToggle) {
            fpsCounterToggle.onchange = () => {
                this.settings.showFpsCounter = fpsCounterToggle.checked;
                
                // Apply FPS counter visibility immediately
                this.applyFpsCounterVisibility(fpsCounterToggle.checked);
            };
        }
    }
    
    // Create FPS counter element
    createFpsCounter() {
        // First check if an FPS counter already exists in the DOM
        const existingCounter = document.getElementById('fps-counter');
        if (existingCounter) {
            debug('FPS counter already exists, reusing existing element');
            this.fpsCounter = existingCounter;
            this.fpsMonitoringActive = true;
            return;
        }
        
        if (!this.fpsCounter) {
            debug('Creating new FPS counter');
            this.fpsCounter = document.createElement('div');
            this.fpsCounter.id = 'fps-counter';
            this.fpsCounter.style.position = 'fixed';
            this.fpsCounter.style.top = '10px';
            this.fpsCounter.style.right = '10px';
            this.fpsCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            this.fpsCounter.style.color = '#00ff00';
            this.fpsCounter.style.padding = '5px 10px';
            this.fpsCounter.style.borderRadius = '5px';
            this.fpsCounter.style.fontFamily = 'Rajdhani, monospace';
            this.fpsCounter.style.fontSize = '16px';
            this.fpsCounter.style.zIndex = '1000';
            this.fpsCounter.style.display = 'block';
            this.fpsCounter.textContent = 'FPS: --';
            
            document.body.appendChild(this.fpsCounter);
            
            // Initialize FPS monitoring variables
            this.frameCount = 0;
            this.lastFrameTime = performance.now();
            this.fpsMonitoringActive = true;
            
            // Hook into the game's render loop by monkey patching the render method
            if (this.game && this.game.render) {
                // Store the original render method if we haven't already
                if (!this.originalRender) {
                    this.originalRender = this.game.render.bind(this.game);
                }
                
                // Replace with our version that counts frames
                this.game.render = async () => {
                    // Call the original render method
                    const result = await this.originalRender();
                    
                    // Update FPS counter
                    this.updateFpsCounter();
                    
                    return result;
                };
            }
        }
    }
    
    // Destroy FPS counter element
    destroyFpsCounter() {
        if (this.fpsCounter) {
            // First check if the element still exists in the DOM
            const existingCounter = document.getElementById('fps-counter');
            if (existingCounter) {
                existingCounter.remove();
            }
            
            this.fpsCounter = null;
            this.fpsMonitoringActive = false;
            
            // Restore original render method if we modified it
            if (this.game && this.originalRender) {
                this.game.render = this.originalRender;
            }
        }
    }
    
    // Update FPS counter with current frame rate
    updateFpsCounter() {
        if (!this.fpsMonitoringActive || !this.fpsCounter) return;
        
        // Increment frame count
        this.frameCount++;
        
        // Calculate FPS every 500ms
        const now = performance.now();
        const elapsed = now - this.lastFrameTime;
        
        if (elapsed >= 500) { // Update twice per second
            // Calculate FPS
            const fps = Math.round((this.frameCount / elapsed) * 1000);
            
            // Update counter text
            this.fpsCounter.textContent = `FPS: ${fps}`;
            
            // Color-code based on performance
            if (fps >= 60) {
                this.fpsCounter.style.color = '#00ff00'; // Green for good FPS
            } else if (fps >= 30) {
                this.fpsCounter.style.color = '#ffff00'; // Yellow for ok FPS
            } else {
                this.fpsCounter.style.color = '#ff0000'; // Red for poor FPS
            }
            
            // Reset counters
            this.frameCount = 0;
            this.lastFrameTime = now;
        }
    }
    
    // Apply FPS counter visibility setting
    applyFpsCounterVisibility(show) {
        debug('Applying FPS counter visibility:', show ? 'visible' : 'hidden');
        
        // First check if an FPS counter already exists in the DOM
        const existingCounter = document.getElementById('fps-counter');
        
        if (show) {
            // If we're showing the counter but there's already one in the DOM,
            // make sure our reference points to it
            if (existingCounter && !this.fpsCounter) {
                debug('Found existing FPS counter in DOM, updating reference');
                this.fpsCounter = existingCounter;
                this.fpsMonitoringActive = true;
            } 
            // Create counter if it doesn't exist
            else if (!existingCounter) {
                debug('No FPS counter exists, creating new one');
                this.createFpsCounter();
            } 
            // If we have a reference but it's not in the DOM, recreate it
            else if (this.fpsCounter && !document.body.contains(this.fpsCounter)) {
                debug('FPS counter reference exists but not in DOM, recreating');
                this.fpsCounter = null;
                this.createFpsCounter();
            }
            // Otherwise, just make sure it's visible
            else if (this.fpsCounter) {
                this.fpsCounter.style.display = 'block';
                this.fpsMonitoringActive = true;
            }
        } else {
            // If we're hiding and there's a counter in the DOM, remove it
            if (existingCounter) {
                debug('Removing existing FPS counter from DOM');
                existingCounter.remove();
            }
            
            // Clean up our reference
            if (this.fpsCounter) {
                this.destroyFpsCounter();
            }
        }
    }
    
    // Apply mouse sensitivity setting to the game
    applyMouseSensitivity(sensitivity) {
        debug('Applying mouse sensitivity:', sensitivity);
        
        if (this.game && this.game.player) {
            // Only update the mouseSensitivity property, don't modify other player properties
            this.game.player.mouseSensitivity = sensitivity;
            debug('Mouse sensitivity updated to:', sensitivity);
        }
    }
    
    // Apply texture visibility setting to the game
    applyTextureVisibility(hideTextures) {
        debug('Applying texture visibility:', hideTextures ? 'hidden' : 'visible');
        
        if (this.game && this.game.environment) {
            // Toggle texture visibility in environment
            this.game.environment.useTextures = !hideTextures;
            
            // Apply to existing materials
            if (this.game.scene) {
                this.game.scene.traverse((object) => {
                    if (object.isMesh && object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(mat => {
                                if (hideTextures) {
                                    // Store original map if it exists
                                    if (mat.map) {
                                        mat._originalMap = mat.map;
                                        mat.map = null;
                                    }
                                } else {
                                    // Restore original map if it exists
                                    if (mat._originalMap) {
                                        mat.map = mat._originalMap;
                                    }
                                }
                                mat.needsUpdate = true;
                            });
                        } else {
                            if (hideTextures) {
                                // Store original map if it exists
                                if (object.material.map) {
                                    object.material._originalMap = object.material.map;
                                    object.material.map = null;
                                }
                            } else {
                                // Restore original map if it exists
                                if (object.material._originalMap) {
                                    object.material.map = object.material._originalMap;
                                }
                            }
                            object.material.needsUpdate = true;
                        }
                    }
                });
            }
            
            debug('Texture visibility updated to:', hideTextures ? 'hidden' : 'visible');
        }
    }
    
    // Apply FPS lock setting to the game
    applyFPSLock(fpsLimit) {
        debug('Applying FPS lock:', fpsLimit);
        
        if (this.game) {
            // Store previous state to check if we're changing FPS settings
            const previousLimit = this.game.fpsLimit;
            const isChangingFPS = previousLimit !== fpsLimit;
            
            // Check if we're in the pause menu during gameplay
            const isInPauseMenu = this.game.isRunning && this.game.isPaused;
            
            // Show warning if changing FPS during gameplay from pause menu
            if (isChangingFPS && isInPauseMenu) {
                // Create warning message
                this.showFPSWarning();
            }
            
            if (fpsLimit > 0) {
                // Set FPS limit
                this.game.fpsLimit = fpsLimit;
                this.game.useFrameRateLimit = true;
                
                // Calculate frame time in milliseconds
                const frameTime = 1000 / fpsLimit;
                this.game.frameTimeLimit = frameTime;
                
                debug('FPS limited to:', fpsLimit, 'Frame time:', frameTime, 'ms');
                
                // For high FPS settings, ensure we don't use fixed delta time
                // as that can cause slow motion effects
                if (fpsLimit >= 120) {
                    // Don't use fixed delta time for high FPS, just limit the frames
                    this.game.useFixedDeltaTime = false;
                }
            } else {
                // Remove FPS limit
                this.game.useFrameRateLimit = false;
                this.game.fpsLimit = 0;
                this.game.frameTimeLimit = 0;
                this.game.useFixedDeltaTime = false;
                
                debug('FPS limit removed');
            }
            
            // If changing FPS settings during gameplay, we need to reset the timing system
            // to prevent physics issues that could cause enemies to disappear
            if (isChangingFPS) {
                debug('FPS changed, resetting timing system');
                
                // Reset frame timing to prevent large delta time jumps
                this.game.lastTime = performance.now() * 0.001; // Convert to seconds
                this.game.lastFrameTime = performance.now();
                
                // Use a variable delta time based on actual frame times
                // This prevents slow motion effects
                this.game.deltaTime = 0.016; // Use a safe default (60 FPS)
                
                // Reset any accumulated time
                if (this.game.accumulatedTime) {
                    this.game.accumulatedTime = 0;
                }
            }
        }
    }
    
    // Show warning about changing FPS during gameplay
    showFPSWarning() {
        // Create warning message element if it doesn't exist
        let warningEl = document.getElementById('fps-warning');
        if (!warningEl) {
            warningEl = document.createElement('div');
            warningEl.id = 'fps-warning';
            warningEl.style.position = 'fixed';
            warningEl.style.top = '20%';
            warningEl.style.left = '50%';
            warningEl.style.transform = 'translateX(-50%)';
            warningEl.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            warningEl.style.color = '#ff5722';
            warningEl.style.padding = '20px';
            warningEl.style.borderRadius = '10px';
            warningEl.style.boxShadow = '0 0 20px rgba(255, 87, 34, 0.5)';
            warningEl.style.zIndex = '10000';
            warningEl.style.fontFamily = 'Rajdhani, sans-serif';
            warningEl.style.textAlign = 'center';
            warningEl.style.border = '2px solid #ff5722';
            warningEl.style.maxWidth = '400px';
            warningEl.style.fontSize = '18px';
            
            document.body.appendChild(warningEl);
        }
        
        // Set warning message
        warningEl.innerHTML = `
            <h3 style="color: #ff5722; margin-top: 0;">⚠️ FPS Setting Warning ⚠️</h3>
            <p>Changing FPS during gameplay may cause enemies to disappear.</p>
            <p>For best results, please change FPS settings from the main menu.</p>
            <button id="fps-warning-ok" style="
                background: linear-gradient(135deg, #ff5722, #f44336);
                border: none;
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                margin-top: 10px;
                cursor: pointer;
                font-family: inherit;
                font-weight: bold;
            ">OK, Got it</button>
        `;
        
        // Show the warning
        warningEl.style.display = 'block';
        
        // Add click handler to close button
        document.getElementById('fps-warning-ok').onclick = () => {
            warningEl.style.display = 'none';
        };
        
        // Auto-hide after 8 seconds
        setTimeout(() => {
            if (warningEl) {
                warningEl.style.display = 'none';
            }
        }, 8000);
    }
    
    // Apply all settings at once
    applyAllSettings() {
        debug('Applying all settings');
        
        // Apply mouse sensitivity
        this.applyMouseSensitivity(this.settings.mouseSensitivity);
        
        // Apply texture visibility
        this.applyTextureVisibility(this.settings.hideTextures);
        
        // Apply FPS lock (always unlimited now)
        this.applyFPSLock(0);
        
        // Apply FPS counter visibility
        this.applyFpsCounterVisibility(this.settings.showFpsCounter);
    }
    
    show() {
        debug('Showing settings screen');
        if (this.settingsScreen) {
            // Update UI to reflect current settings
            this.updateUI();
            
            // Set a global flag to ignore pointer lock while in settings
            window.isInSettingsMenu = true;
            
            this.settingsScreen.style.display = 'flex';
            
            // Add visible class after a short delay to ensure the display property has been applied
            setTimeout(() => {
                this.settingsScreen.classList.add('visible');
            }, 10);
        }
    }
    
    hide() {
        debug('Hiding settings screen');
        if (this.settingsScreen) {
            this.settingsScreen.classList.remove('visible');
            
            // Reset the global flag when exiting settings
            window.isInSettingsMenu = false;
            
            // Hide after animation completes
            setTimeout(() => {
                this.settingsScreen.style.display = 'none';
            }, 400);
        }
    }
    
    // Update UI controls to reflect current settings
    updateUI() {
        const sensitivitySlider = document.getElementById('mouseSensitivity');
        const sensitivityValue = document.getElementById('mouseSensitivityValue');
        const hideTexturesToggle = document.getElementById('hideTextures');
        const showFpsCounterToggle = document.getElementById('showFpsCounter');
        
        if (sensitivitySlider) {
            sensitivitySlider.value = this.settings.mouseSensitivity;
        }
        
        if (sensitivityValue) {
            sensitivityValue.textContent = (this.settings.mouseSensitivity * 1000).toFixed(1);
        }
        
        if (hideTexturesToggle) {
            hideTexturesToggle.checked = this.settings.hideTextures;
        }
        
        if (showFpsCounterToggle) {
            showFpsCounterToggle.checked = this.settings.showFpsCounter;
        }
    }
    
    // Save settings to localStorage
    saveSettings() {
        debug('Saving settings:', this.settings);
        try {
            localStorage.setItem('shooterx-settings', JSON.stringify(this.settings));
            debug('Settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }
    
    // Load settings from localStorage
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('shooterx-settings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                
                // Apply saved settings, but ensure some values are within valid ranges
                if (parsed.mouseSensitivity !== undefined) {
                    // Ensure mouse sensitivity is within valid range
                    this.settings.mouseSensitivity = Math.max(0.0005, Math.min(0.005, parsed.mouseSensitivity));
                }
                
                if (parsed.hideTextures !== undefined) {
                    this.settings.hideTextures = parsed.hideTextures;
                }
                
                // Always set FPS lock to unlimited (0) regardless of saved setting
                this.settings.fpsLock = 0;
                
                // Load FPS counter setting if available
                if (parsed.showFpsCounter !== undefined) {
                    this.settings.showFpsCounter = parsed.showFpsCounter;
                }
                
                debug('Settings loaded from localStorage');
            } else {
                debug('No saved settings found, using defaults');
            }
            
            // Apply settings immediately if game is available
            if (this.game) {
                this.applyAllSettings();
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            // Use default settings if there was an error
        }
    }
}

export default Settings; 