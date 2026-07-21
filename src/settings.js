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
            mouseSensitivity: 0.002,
            fieldOfView: 75,
            autoReload: false,
            hideTextures: false,
            fpsLock: 0,
            showFpsCounter: true,
            dayNightEnabled: true,
            lockedTimeOfDay: 14
        };
        
        this.loadSettings();
        this.createSettingsUI();
        
        if (this.settings.showFpsCounter) {
            this.createFpsCounter();
        }
    }
    
    createSettingsUI() {
        debug('Creating settings UI');
        
        if (!document.getElementById('settingsScreen')) {
            this.settingsScreen = document.createElement('div');
            this.settingsScreen.id = 'settingsScreen';
            this.settingsScreen.style.display = 'none';

            const style = document.createElement('style');
            style.textContent = `
                #settingsScreen {
                    position: fixed; inset: 0;
                    display: flex; align-items: center; justify-content: center;
                    background: rgba(20, 20, 30, 0.75);
                    z-index: 1001;
                    backdrop-filter: blur(12px);
                }
                #settingsScreen .settings-panel {
                    background: rgba(10, 10, 18, 0.95);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 14px;
                    width: 520px; max-width: 92vw;
                    max-height: 88vh;
                    display: flex; flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                }
                #settingsScreen .settings-header {
                    display: flex; align-items: center; justify-content: center;
                    padding: 28px 32px 0;
                }
                #settingsScreen .settings-header h1 {
                    font-size: 32px; font-weight: 700; color: #e8e8f0;
                    letter-spacing: 5px; margin: 0;
                }
                #settingsScreen .settings-tabs {
                    display: flex; justify-content: center; gap: 4px;
                    padding: 22px 32px 0;
                }
                #settingsScreen .settings-tab {
                    padding: 10px 28px; font-size: 13px; font-weight: 600;
                    letter-spacing: 1.5px; text-transform: uppercase;
                    background: rgba(255,255,255,0.06);
                    border: 1px solid rgba(255,255,255,0.08);
                    color: rgba(255,255,255,0.5); cursor: pointer;
                    border-radius: 8px;
                    transition: all 0.2s;
                }
                #settingsScreen .settings-tab:hover {
                    background: rgba(255,255,255,0.1);
                    color: rgba(255,255,255,0.8);
                }
                #settingsScreen .settings-tab.active {
                    background: rgba(90, 106, 255, 0.2);
                    border-color: rgba(90, 106, 255, 0.4);
                    color: #fff;
                }
                #settingsScreen .settings-divider {
                    width: 100%; height: 1px; margin: 18px 0 0;
                    background: rgba(255,255,255,0.08);
                }
                #settingsScreen .settings-body {
                    flex: 1; overflow-y: auto; padding: 22px 32px 28px;
                }
                #settingsScreen .settings-body::-webkit-scrollbar { width: 6px; }
                #settingsScreen .settings-body::-webkit-scrollbar-track { background: transparent; }
                #settingsScreen .settings-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
                #settingsScreen .tab-content { display: none; }
                #settingsScreen .tab-content.active { display: block; }

                #settingsScreen .setting-row {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 14px 16px; margin-bottom: 8px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 10px;
                    transition: all 0.15s;
                }
                #settingsScreen .setting-row:hover {
                    background: rgba(255,255,255,0.07);
                }
                #settingsScreen .setting-label {
                    font-size: 14px; color: rgba(255,255,255,0.8); font-weight: 500;
                }
                #settingsScreen .setting-desc {
                    font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px;
                }
                #settingsScreen .setting-control {
                    display: flex; align-items: center; gap: 8px; flex-shrink: 0;
                }
                #settingsScreen .setting-value {
                    font-size: 13px; color: rgba(255,255,255,0.5); min-width: 32px; text-align: right;
                }

                #settingsScreen input[type="range"] {
                    -webkit-appearance: none; width: 140px; height: 6px;
                    background: rgba(255,255,255,0.12); border-radius: 3px; outline: none;
                }
                #settingsScreen input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none; width: 16px; height: 16px;
                    border-radius: 50%; background: #fff; cursor: pointer;
                    border: 2px solid #5a6aff; box-shadow: 0 0 6px rgba(90,106,255,0.4);
                }
                #settingsScreen input[type="range"]::-moz-range-thumb {
                    width: 16px; height: 16px; border-radius: 50%;
                    background: #fff; cursor: pointer; border: 2px solid #5a6aff;
                }

                #settingsScreen .toggle {
                    position: relative; display: inline-block; width: 48px; height: 26px;
                }
                #settingsScreen .toggle input { opacity: 0; width: 0; height: 0; }
                #settingsScreen .toggle .slider {
                    position: absolute; cursor: pointer; inset: 0;
                    background: rgba(255,255,255,0.1); transition: 0.25s;
                    border-radius: 26px; border: 1px solid rgba(255,255,255,0.15);
                }
                #settingsScreen .toggle .slider:before {
                    position: absolute; content: "";
                    height: 18px; width: 18px; left: 3px; bottom: 3px;
                    background: rgba(255,255,255,0.6); transition: 0.25s; border-radius: 50%;
                }
                #settingsScreen .toggle input:checked + .slider {
                    background: rgba(90, 106, 255, 0.4);
                    border-color: rgba(90, 106, 255, 0.6);
                }
                #settingsScreen .toggle input:checked + .slider:before {
                    transform: translateX(22px); background: #fff;
                }

                #settingsScreen select {
                    padding: 8px 12px; border-radius: 6px;
                    background: rgba(255,255,255,0.08);
                    border: 1px solid rgba(255,255,255,0.12);
                    color: rgba(255,255,255,0.8); font-size: 13px;
                    font-family: inherit; cursor: pointer; outline: none;
                    min-width: 120px;
                }
                #settingsScreen select:hover { border-color: rgba(255,255,255,0.2); }
                #settingsScreen select:focus { border-color: rgba(90,106,255,0.5); }
                #settingsScreen select option { background: #1a1a2e; color: #fff; }

                #settingsScreen .settings-footer {
                    padding: 0 32px 24px; display: flex; justify-content: center;
                }
                #settingsScreen .settings-back-btn {
                    padding: 12px 48px;
                    background: linear-gradient(135deg, #c62828, #8e0000);
                    color: #fff; border: none; border-radius: 8px;
                    font-size: 15px; font-weight: 600; cursor: pointer;
                    letter-spacing: 2px; transition: all 0.2s;
                }
                #settingsScreen .settings-back-btn:hover {
                    background: linear-gradient(135deg, #e53935, #b71c1c);
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(0,0,0,0.4);
                }
                #settingsScreen .settings-back-btn:active { transform: translateY(1px); }
            `;
            document.head.appendChild(style);

            this.settingsScreen.innerHTML = `
                <div class="settings-panel">
                    <div class="settings-header"><h1>SETTINGS</h1></div>
                    <div class="settings-tabs">
                        <button class="settings-tab active" data-tab="player">Player</button>
                        <button class="settings-tab" data-tab="weapon">Weapon</button>
                        <button class="settings-tab" data-tab="game">Game</button>
                    </div>
                    <div class="settings-divider"></div>
                    <div class="settings-body">
                        <div class="tab-content active" id="tabPlayer">
                            <div class="setting-row">
                                <div>
                                    <div class="setting-label">Mouse Sensitivity</div>
                                    <div class="setting-desc">Adjust camera look speed</div>
                                </div>
                                <div class="setting-control">
                                    <input type="range" id="mouseSensitivity" min="0.5" max="5" step="0.1" value="${(this.settings.mouseSensitivity * 1000).toFixed(1)}">
                                    <span class="setting-value" id="mouseSensitivityValue">${(this.settings.mouseSensitivity * 1000).toFixed(1)}</span>
                                </div>
                            </div>
                            <div class="setting-row">
                                <div>
                                    <div class="setting-label">Field of View</div>
                                    <div class="setting-desc">Camera field of view (not yet implemented)</div>
                                </div>
                                <div class="setting-control">
                                    <input type="range" id="fieldOfView" min="50" max="120" step="1" value="${this.settings.fieldOfView}" disabled style="opacity:0.4">
                                    <span class="setting-value" id="fieldOfViewValue">${this.settings.fieldOfView}</span>
                                </div>
                            </div>
                        </div>
                        <div class="tab-content" id="tabWeapon">
                            <div class="setting-row">
                                <div>
                                    <div class="setting-label">Auto Reload</div>
                                    <div class="setting-desc">Automatically reload when empty (not yet implemented)</div>
                                </div>
                                <div class="setting-control">
                                    <label class="toggle">
                                        <input type="checkbox" id="autoReload" ${this.settings.autoReload ? 'checked' : ''} disabled style="opacity:0.4">
                                        <span class="slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="tab-content" id="tabGame">
                            <div class="setting-row">
                                <div>
                                    <div class="setting-label">Hide Textures</div>
                                    <div class="setting-desc">Show flat colors instead of textures</div>
                                </div>
                                <div class="setting-control">
                                    <label class="toggle">
                                        <input type="checkbox" id="hideTextures" ${this.settings.hideTextures ? 'checked' : ''}>
                                        <span class="slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div class="setting-row">
                                <div>
                                    <div class="setting-label">Day/Night Cycle</div>
                                    <div class="setting-desc">Enable dynamic lighting cycle</div>
                                </div>
                                <div class="setting-control">
                                    <label class="toggle">
                                        <input type="checkbox" id="dayNightToggle" ${this.settings.dayNightEnabled ? 'checked' : ''}>
                                        <span class="slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div class="setting-row" id="timeOfDayRow" style="${this.settings.dayNightEnabled ? 'display:none' : ''}">
                                <div>
                                    <div class="setting-label">Time of Day</div>
                                    <div class="setting-desc">Set a fixed time when cycle is off</div>
                                </div>
                                <div class="setting-control">
                                    <select id="timeOfDaySelect">
                                        <option value="0" ${this.settings.lockedTimeOfDay === 0 ? 'selected' : ''}>Midnight</option>
                                        <option value="5" ${this.settings.lockedTimeOfDay === 5 ? 'selected' : ''}>Dawn</option>
                                        <option value="7" ${this.settings.lockedTimeOfDay === 7 ? 'selected' : ''}>Sunrise</option>
                                        <option value="12" ${this.settings.lockedTimeOfDay === 12 ? 'selected' : ''}>Noon</option>
                                        <option value="15" ${this.settings.lockedTimeOfDay === 15 ? 'selected' : ''}>Afternoon</option>
                                        <option value="19" ${this.settings.lockedTimeOfDay === 19 ? 'selected' : ''}>Sunset</option>
                                        <option value="22" ${this.settings.lockedTimeOfDay === 22 ? 'selected' : ''}>Dusk</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="settings-footer">
                        <button class="settings-back-btn" id="settingsBackButton">BACK</button>
                    </div>
                </div>
            `;
            document.body.appendChild(this.settingsScreen);

            // Tab switching
            this.settingsScreen.querySelectorAll('.settings-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    this.settingsScreen.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
                    this.settingsScreen.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    tab.classList.add('active');
                    const map = { player: 'tabPlayer', weapon: 'tabWeapon', game: 'tabGame' };
                    document.getElementById(map[tab.dataset.tab]).classList.add('active');
                });
            });

            this.initialized = true;
        } else {
            this.settingsScreen = document.getElementById('settingsScreen');
        }
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        debug('Setting up settings event listeners');
        
        const backButton = document.getElementById('settingsBackButton');
        if (backButton) {
            backButton.onclick = () => {
                this.saveSettings();
                this.hide();
                if (this.ui) {
                    this.ui.hideSettingsScreen();
                }
            };
        }
        
        const sensitivitySlider = document.getElementById('mouseSensitivity');
        const sensitivityValue = document.getElementById('mouseSensitivityValue');
        if (sensitivitySlider && sensitivityValue) {
            sensitivitySlider.oninput = () => {
                const value = parseFloat(sensitivitySlider.value);
                this.settings.mouseSensitivity = value / 1000;
                sensitivityValue.textContent = value.toFixed(1);
                this.applyMouseSensitivity(this.settings.mouseSensitivity);
            };
        }
        
        const hideTexturesToggle = document.getElementById('hideTextures');
        if (hideTexturesToggle) {
            hideTexturesToggle.onchange = () => {
                this.settings.hideTextures = hideTexturesToggle.checked;
                this.applyTextureVisibility(hideTexturesToggle.checked);
            };
        }
        
        const fpsCounterToggle = document.getElementById('showFpsCounter');
        if (fpsCounterToggle) {
            fpsCounterToggle.onchange = () => {
                this.settings.showFpsCounter = fpsCounterToggle.checked;
                this.applyFpsCounterVisibility(fpsCounterToggle.checked);
            };
        }

        const dayNightToggle = document.getElementById('dayNightToggle');
        const timeOfDayRow = document.getElementById('timeOfDayRow');
        if (dayNightToggle) {
            dayNightToggle.onchange = () => {
                this.settings.dayNightEnabled = dayNightToggle.checked;
                if (timeOfDayRow) {
                    timeOfDayRow.style.display = dayNightToggle.checked ? 'none' : '';
                }
                this.applyDayNightCycle();
            };
        }

        const timeOfDaySelect = document.getElementById('timeOfDaySelect');
        if (timeOfDaySelect) {
            timeOfDaySelect.onchange = () => {
                this.settings.lockedTimeOfDay = parseInt(timeOfDaySelect.value);
                if (!this.settings.dayNightEnabled) {
                    this.applyDayNightCycle();
                }
            };
        }
    }
    
    createFpsCounter() {
        const existingCounter = document.getElementById('fps-counter');
        if (existingCounter) {
            this.fpsCounter = existingCounter;
            this.fpsMonitoringActive = true;
            return;
        }
        
        if (!this.fpsCounter) {
            this.fpsCounter = document.createElement('div');
            this.fpsCounter.id = 'fps-counter';
            this.fpsCounter.style.cssText = 'position:fixed;top:10px;right:10px;background:rgba(0,0,0,0.5);color:#0f0;padding:5px 10px;border-radius:5px;font-family:monospace;font-size:14px;z-index:1000';
            this.fpsCounter.textContent = 'FPS: --';
            document.body.appendChild(this.fpsCounter);
            
            this.frameCount = 0;
            this.lastFrameTime = performance.now();
            this.fpsMonitoringActive = true;
            
            if (this.game && this.game.render) {
                if (!this.originalRender) {
                    this.originalRender = this.game.render.bind(this.game);
                }
                this.game.render = async () => {
                    const result = await this.originalRender();
                    this.updateFpsCounter();
                    return result;
                };
            }
        }
    }
    
    destroyFpsCounter() {
        if (this.fpsCounter) {
            const existingCounter = document.getElementById('fps-counter');
            if (existingCounter) existingCounter.remove();
            this.fpsCounter = null;
            this.fpsMonitoringActive = false;
            if (this.game && this.originalRender) {
                this.game.render = this.originalRender;
            }
        }
    }
    
    updateFpsCounter() {
        if (!this.fpsMonitoringActive || !this.fpsCounter) return;
        this.frameCount++;
        const now = performance.now();
        const elapsed = now - this.lastFrameTime;
        if (elapsed >= 500) {
            const fps = Math.round((this.frameCount / elapsed) * 1000);
            this.fpsCounter.textContent = `FPS: ${fps}`;
            this.fpsCounter.style.color = fps >= 60 ? '#0f0' : fps >= 30 ? '#ff0' : '#f00';
            this.frameCount = 0;
            this.lastFrameTime = now;
        }
    }
    
    applyFpsCounterVisibility(show) {
        if (show) {
            if (!this.fpsCounter) this.createFpsCounter();
            else this.fpsCounter.style.display = 'block';
        } else {
            this.destroyFpsCounter();
        }
    }
    
    applyMouseSensitivity(sensitivity) {
        if (this.game && this.game.player) {
            this.game.player.mouseSensitivity = sensitivity;
        }
    }
    
    applyTextureVisibility(hideTextures) {
        if (this.game && this.game.environment) {
            this.game.environment.useTextures = !hideTextures;
            if (this.game.scene) {
                this.game.scene.traverse((object) => {
                    if (object.isMesh && object.material) {
                        const mats = Array.isArray(object.material) ? object.material : [object.material];
                        mats.forEach(mat => {
                            if (hideTextures) {
                                if (mat.map) { mat._originalMap = mat.map; mat.map = null; }
                            } else {
                                if (mat._originalMap) { mat.map = mat._originalMap; }
                            }
                            mat.needsUpdate = true;
                        });
                    }
                });
            }
        }
    }
    
    applyFPSLock(fpsLimit) {
        if (this.game) {
            if (fpsLimit > 0) {
                this.game.fpsLimit = fpsLimit;
                this.game.useFrameRateLimit = true;
                this.game.frameTimeLimit = 1000 / fpsLimit;
            } else {
                this.game.useFrameRateLimit = false;
                this.game.fpsLimit = 0;
                this.game.frameTimeLimit = 0;
            }
        }
    }
    
    applyAllSettings() {
        this.applyMouseSensitivity(this.settings.mouseSensitivity);
        this.applyTextureVisibility(this.settings.hideTextures);
        this.applyFPSLock(0);
        this.applyFpsCounterVisibility(this.settings.showFpsCounter);
        this.applyDayNightCycle();
    }

    applyDayNightCycle() {
        const cycle = this.game?.environment?.dayNightCycle;
        if (!cycle) return;
        if (this.settings.dayNightEnabled) {
            cycle.setFrozen(false);
        } else {
            cycle.setFrozen(true, this.settings.lockedTimeOfDay);
        }
    }
    
    show() {
        debug('Showing settings screen');
        if (this.settingsScreen) {
            this.updateUI();
            window.isInSettingsMenu = true;
            this.settingsScreen.style.display = 'flex';
        }
    }
    
    hide() {
        debug('Hiding settings screen');
        if (this.settingsScreen) {
            window.isInSettingsMenu = false;
            this.settingsScreen.style.display = 'none';
        }
    }
    
    updateUI() {
        const sensitivitySlider = document.getElementById('mouseSensitivity');
        const sensitivityValue = document.getElementById('mouseSensitivityValue');
        const hideTexturesToggle = document.getElementById('hideTextures');
        const dayNightToggle = document.getElementById('dayNightToggle');
        const timeOfDayRow = document.getElementById('timeOfDayRow');
        const timeOfDaySelect = document.getElementById('timeOfDaySelect');
        
        if (sensitivitySlider) sensitivitySlider.value = (this.settings.mouseSensitivity * 1000).toFixed(1);
        if (sensitivityValue) sensitivityValue.textContent = (this.settings.mouseSensitivity * 1000).toFixed(1);
        if (hideTexturesToggle) hideTexturesToggle.checked = this.settings.hideTextures;
        if (dayNightToggle) dayNightToggle.checked = this.settings.dayNightEnabled;
        if (timeOfDayRow) timeOfDayRow.style.display = this.settings.dayNightEnabled ? 'none' : '';
        if (timeOfDaySelect) timeOfDaySelect.value = this.settings.lockedTimeOfDay;
    }
    
    saveSettings() {
        try {
            localStorage.setItem('shooterx-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }
    
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('shooterx-settings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                if (parsed.mouseSensitivity !== undefined) {
                    this.settings.mouseSensitivity = Math.max(0.0005, Math.min(0.005, parsed.mouseSensitivity));
                }
                if (parsed.fieldOfView !== undefined) this.settings.fieldOfView = parsed.fieldOfView;
                if (parsed.autoReload !== undefined) this.settings.autoReload = parsed.autoReload;
                if (parsed.hideTextures !== undefined) this.settings.hideTextures = parsed.hideTextures;
                if (parsed.showFpsCounter !== undefined) this.settings.showFpsCounter = parsed.showFpsCounter;
                if (parsed.dayNightEnabled !== undefined) this.settings.dayNightEnabled = parsed.dayNightEnabled;
                if (parsed.lockedTimeOfDay !== undefined) this.settings.lockedTimeOfDay = parsed.lockedTimeOfDay;
            }
            if (this.game) this.applyAllSettings();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
}

export default Settings;
