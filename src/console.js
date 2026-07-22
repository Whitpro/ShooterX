// Import BugReport module
import BugReport from './bugReport.js';
import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';
import { ENEMY_TYPES } from './enemyTypes.js';

// Admin login config — edit users/passwords here
const ADMIN_CONFIG = {
    users: {
        'Eliam': 'live',
        'Marco': 'moeders2461!'
    }
};

class Console {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this._adminLoggedIn = false;
        this.commandHistory = [];
        this.historyIndex = -1;
        this.bugReporter = new BugReport(game);
        this.commands = {
            'help': () => this.showHelp(),
            'clear': () => this.clearConsole(),
            'version': () => this.showVersion(),
            'fps': () => this.showFPS(),
            'rgb': () => this.toggleRGBMode(),
            'report': () => this.reportBug(),
            'adminp': () => this.adminPanel()
        };
        this.rgbMode = true;
        this._rgbHue = 0;
        
        // Auto-search properties
        this.suggestionsVisible = false;
        this.selectedSuggestionIndex = -1;
        this.filteredSuggestions = [];

        this.createConsoleUI();
        this.setupEventListeners();
        this.executeCommand = this.executeCommand.bind(this);
    }

    setGame(game) {
        this.game = game;
    }

    createConsoleUI() {
        // Inject RGB border style if not already present
        if (!document.getElementById('console-rgb-style')) {
            const style = document.createElement('style');
            style.id = 'console-rgb-style';
            style.textContent = `
                #game-console {
                    border: 3px solid transparent !important;
                    border-radius: 10px;
                    position: relative;
                    overflow: visible;
                }
                #game-console::before {
                    content: '';
                    position: absolute;
                    z-index: 1001;
                    top: -3px; left: -3px; right: -3px; bottom: -3px;
                    border-radius: 12px;
                    pointer-events: none;
                    background: conic-gradient(
                        red, orange, yellow, lime, cyan, blue, magenta, red
                    );
                    animation: rgb-border-spin 3s linear infinite;
                    mask: 
                        linear-gradient(#fff 0 0) content-box, 
                        linear-gradient(#fff 0 0);
                    -webkit-mask: 
                        linear-gradient(#fff 0 0) content-box, 
                        linear-gradient(#fff 0 0);
                    mask-composite: exclude;
                    -webkit-mask-composite: xor;
                }
                @keyframes rgb-border-spin {
                    0% { filter: hue-rotate(0deg);}
                    100% { filter: hue-rotate(360deg);}
                }
                
                #console-suggestions {
                    position: absolute;
                    bottom: 100%;
                    left: 0;
                    right: 0;
                    background: rgba(0, 0, 0, 0.9);
                    border: 1px solid #00ff00;
                    border-bottom: none;
                    border-radius: 5px 5px 0 0;
                    max-height: 150px;
                    overflow-y: auto;
                    display: none;
                    z-index: 1000;
                }
                
                .console-suggestion {
                    padding: 5px 10px;
                    cursor: pointer;
                    color: #00ff00;
                    font-family: monospace;
                }
                
                .console-suggestion.selected {
                    background: rgba(0, 255, 0, 0.3);
                }
                
                .console-suggestion:hover {
                    background: rgba(0, 255, 0, 0.2);
                }
            `;
            document.head.appendChild(style);
        }
        // Create console container
        this.consoleElement = document.createElement('div');
        this.consoleElement.id = 'game-console';
        this.consoleElement.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(0, 0, 0, 0.8);
            color: #00ff00;
            font-family: monospace;
            padding: 10px;
            display: none;
            z-index: 1000;
            border-top: 1px solid #00ff00;
        `;

        // Create input field
        this.inputElement = document.createElement('input');
        this.inputElement.type = 'text';
        this.inputElement.id = 'console-input';
        this.inputElement.style.cssText = `
            width: 100%;
            background: transparent;
            border: none;
            color: #00ff00;
            font-family: monospace;
            font-size: 14px;
            outline: none;
            padding: 5px;
        `;
        this.inputElement.placeholder = 'Type a command...';

        // Create output area
        this.outputElement = document.createElement('div');
        this.outputElement.id = 'console-output';
        this.outputElement.style.cssText = `
            max-height: 200px;
            overflow-y: auto;
            margin-bottom: 10px;
            font-size: 12px;
        `;
        
        // Create suggestions container
        this.suggestionsElement = document.createElement('div');
        this.suggestionsElement.id = 'console-suggestions';

        // Add elements to console
        this.consoleElement.appendChild(this.outputElement);
        this.consoleElement.appendChild(this.inputElement);
        this.consoleElement.appendChild(this.suggestionsElement);
        document.body.appendChild(this.consoleElement);
    }

    setupEventListeners() {
        // Toggle console with / key
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && !this.isVisible) {
                e.preventDefault();
                this.show();
            } else if (e.key === '.' && this.isVisible) {
                this.hide();
            }
        });

        // Handle command input
        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.executeCommand(this.inputElement.value);
                this.inputElement.value = '';
                this.hideSuggestions();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.suggestionsVisible) {
                    this.navigateSuggestions('up');
                } else {
                    this.navigateHistory('up');
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.suggestionsVisible) {
                    this.navigateSuggestions('down');
                } else {
                    this.navigateHistory('down');
                }
            } else if (e.key === 'Tab') {
                e.preventDefault();
                if (this.suggestionsVisible && this.selectedSuggestionIndex >= 0) {
                    this.selectSuggestion(this.selectedSuggestionIndex);
                }
            } else if (e.key === 'Escape') {
                if (this.suggestionsVisible) {
                    this.hideSuggestions();
                } else {
                    this.hide();
                }
            }
        });
        
        // Handle input changes for auto-search
        this.inputElement.addEventListener('input', () => {
            this.updateSuggestions();
        });
        
        // Handle clicks on suggestions
        this.suggestionsElement.addEventListener('click', (e) => {
            const suggestionElement = e.target.closest('.console-suggestion');
            if (suggestionElement) {
                const index = parseInt(suggestionElement.dataset.index, 10);
                if (!isNaN(index)) {
                    this.selectSuggestion(index);
                }
            }
        });
    }
    
    // Filter commands based on input
    updateSuggestions() {
        const input = this.inputElement.value.toLowerCase().trim();
        
        if (!input) {
            this.hideSuggestions();
            return;
        }
        
        // Filter commands that match the input
        this.filteredSuggestions = Object.keys(this.commands)
            .filter(cmd => cmd.toLowerCase().includes(input))
            .sort((a, b) => {
                // Sort by relevance - exact matches first, then by starting with, then alphabetically
                const aStartsWith = a.toLowerCase().startsWith(input);
                const bStartsWith = b.toLowerCase().startsWith(input);
                
                if (aStartsWith && !bStartsWith) return -1;
                if (!aStartsWith && bStartsWith) return 1;
                return a.localeCompare(b);
            });
        
        if (this.filteredSuggestions.length > 0) {
            this.showSuggestions();
        } else {
            this.hideSuggestions();
        }
    }
    
    // Display the suggestions
    showSuggestions() {
        this.suggestionsElement.innerHTML = '';
        this.filteredSuggestions.forEach((suggestion, index) => {
            const element = document.createElement('div');
            element.className = 'console-suggestion';
            element.textContent = suggestion;
            element.dataset.index = index;
            this.suggestionsElement.appendChild(element);
        });
        
        this.suggestionsElement.style.display = 'block';
        this.suggestionsVisible = true;
        this.selectedSuggestionIndex = -1;
    }
    
    // Hide the suggestions
    hideSuggestions() {
        this.suggestionsElement.style.display = 'none';
        this.suggestionsVisible = false;
        this.selectedSuggestionIndex = -1;
    }
    
    // Navigate through suggestions with arrow keys
    navigateSuggestions(direction) {
        if (!this.suggestionsVisible || this.filteredSuggestions.length === 0) return;
        
        // Remove selection from current suggestion
        if (this.selectedSuggestionIndex >= 0) {
            const currentElement = this.suggestionsElement.children[this.selectedSuggestionIndex];
            if (currentElement) {
                currentElement.classList.remove('selected');
            }
        }
        
        // Update selection index
        if (direction === 'up') {
            if (this.selectedSuggestionIndex <= 0) {
                this.selectedSuggestionIndex = this.filteredSuggestions.length - 1;
            } else {
                this.selectedSuggestionIndex--;
            }
        } else {
            if (this.selectedSuggestionIndex >= this.filteredSuggestions.length - 1) {
                this.selectedSuggestionIndex = 0;
            } else {
                this.selectedSuggestionIndex++;
            }
        }
        
        // Apply selection to new element
        const newElement = this.suggestionsElement.children[this.selectedSuggestionIndex];
        if (newElement) {
            newElement.classList.add('selected');
            newElement.scrollIntoView({ block: 'nearest' });
        }
    }
    
    // Select a suggestion and apply it to input
    selectSuggestion(index) {
        if (index >= 0 && index < this.filteredSuggestions.length) {
            this.inputElement.value = this.filteredSuggestions[index];
            this.inputElement.focus();
            this.hideSuggestions();
        }
    }
    
    // Navigate command history
    navigateHistory(direction) {
        if (this.commandHistory.length === 0) return;
        
        if (direction === 'up') {
            if (this.historyIndex < this.commandHistory.length - 1) {
                this.historyIndex++;
                this.inputElement.value = this.commandHistory[this.historyIndex];
            }
        } else {
            if (this.historyIndex > 0) {
                this.historyIndex--;
                this.inputElement.value = this.commandHistory[this.historyIndex];
            } else if (this.historyIndex === 0) {
                this.historyIndex = -1;
                this.inputElement.value = '';
            }
        }
        
        // Move cursor to end of input
        setTimeout(() => {
            this.inputElement.selectionStart = this.inputElement.value.length;
            this.inputElement.selectionEnd = this.inputElement.value.length;
        }, 0);
    }

    show() {
        this.isVisible = true;
        this.consoleElement.style.display = 'block';
        this.inputElement.focus();
        // Set global flag to prevent pointer lock events from pausing the game
        window.isConsoleOpen = true;
        // Display the report bug message when opening the console
        this.log("type report to report a bug");
        // Pause the game if possible
        if (this.game && typeof this.game.pauseGame === 'function' && this.game.isRunning && !this.game.isPaused) {
            this.game.pauseGame();
            this._pausedForConsole = true;
        }
        // Clear suggestions
        this.hideSuggestions();
    }

    hide() {
        this.isVisible = false;
        this.consoleElement.style.display = 'none';
        // Clear global flag
        window.isConsoleOpen = false;
        // Hide suggestions
        this.hideSuggestions();
        // Resume the game if we paused it for the console
        if (this.game && typeof this.game.resumeGame === 'function' && this._pausedForConsole) {
            this.game.resumeGame();
            this._pausedForConsole = false;
        }
    }

    showDisabledToast() {
        const toast = document.createElement('div');
        toast.textContent = 'Console disabled in this build';
        toast.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#ff5252;padding:10px 24px;border-radius:8px;font-family:Rajdhani,sans-serif;font-size:18px;z-index:9999;border:1px solid #ff5252;transition:opacity 0.3s;';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 2500);
    }

    executeCommand(input) {
        if (!input.trim()) return;

        // Add to history
        this.commandHistory.unshift(input);
        this.historyIndex = -1;
        if (this.commandHistory.length > 50) {
            this.commandHistory.pop();
        }

        // Log command
        this.log(`> ${input}`);

        // Parse and execute command
        const [command, ...args] = input.toLowerCase().split(' ');

        if (this.commands[command]) {
            try {
                this.commands[command](...args);
            } catch (error) {
                this.log(`Error: ${error.message}`, 'error');
            }
        } else {
            this.log(`Unknown command: ${command}`, 'error');
        }
        
        // Clear suggestions
        this.hideSuggestions();
    }

    log(message, type = 'info') {
        const line = document.createElement('div');
        line.textContent = message;
        if (this.rgbMode && type !== 'error') {
            // Cycle through hues for each message
            this._rgbHue = (this._rgbHue + 37) % 360;
            line.style.color = `hsl(${this._rgbHue}, 100%, 50%)`;
        } else {
            line.style.color = type === 'error' ? '#ff0000' : '#00ff00';
        }
        this.outputElement.appendChild(line);
        this.outputElement.scrollTop = this.outputElement.scrollHeight;
    }

    showHelp() {
        this.log('Available commands:');
        this.log('- help: Show this help message');
        this.log('- clear: Clear console output');
        this.log('- version: Show game version');
        this.log('- fps: Show current FPS');
        this.log('- rgb: Toggle RGB mode in console');
        this.log('- report: Report a bug');
        this.log('- adminp: Open admin panel');
    }

    clearConsole() {
        this.outputElement.innerHTML = '';
    }

    showVersion() {
        this.log('ShooterX v2.0.0');
    }

    showFPS() {
        this.log('FPS: 60');
    }

    toggleGodMode() {
        if (this.game && this.game.player && typeof this.game.player.toggleGodMode === 'function') {
            const enabled = this.game.player.toggleGodMode();
            this.log(`God mode ${enabled ? 'enabled' : 'disabled'}!`);
        } else {
            this.log('God mode not available.', 'error');
        }
    }

    killAllEnemies() {
        if (!this.game || !this.game.enemyManager || !this.game.enemyManager.enemies) {
            this.log('Error: Game instance not available', 'error');
            return;
        }
        const enemies = this.game.enemyManager.enemies.slice();
        const count = enemies.length;
        enemies.forEach(enemy => {
            if (enemy.health > 0 && enemy.die) {
                enemy.health = 0;
                enemy.die();
                if (this.game.waveSystem && typeof this.game.waveSystem.onEnemyKill === 'function') {
                    this.game.waveSystem.onEnemyKill(enemy.type);
                }
            }
        });
        if (this.game.ui && typeof this.game.ui.updateScore === 'function' && this.game.waveSystem) {
            this.game.ui.updateScore(this.game.waveSystem.getCurrentState());
        }
        this.log(`Killed ${count} enemies`);
    }

    spawnEnemy(enemyType) {
        if (!enemyType) {
            this.log('Usage: spawn [enemyType]', 'error');
            return;
        }
        if (!this.game || !this.game.enemyManager || typeof this.game.enemyManager.spawnEnemy !== 'function') {
            this.log('Error: Game instance not available', 'error');
            return;
        }
        const enemy = this.game.enemyManager.spawnEnemy(enemyType.toUpperCase());
        if (enemy) {
            this.log(`Spawned ${enemyType}`);
        } else {
            this.log(`Failed to spawn enemy: ${enemyType}`, 'error');
        }
    }

    giveAmmo() {
        if (this.game && this.game.weapon) {
            this.game.weapon.ammo = this.game.weapon.maxAmmo;
            if (this.game.ui && typeof this.game.ui.updateAmmoCounter === 'function') {
                this.game.ui.updateAmmoCounter(this.game.weapon.ammo, this.game.weapon.maxAmmo);
            }
            this.log('Ammo refilled');
        } else {
            this.log('Ammo refill failed: weapon not found', 'error');
        }
    }

    giveHealth() {
        if (this.game && this.game.player) {
            this.game.player.health = this.game.player.maxHealth;
            if (this.game.ui && typeof this.game.ui.updateHealthBar === 'function') {
                this.game.ui.updateHealthBar(this.game.player.health, this.game.player.maxHealth);
            }
            this.log('Health restored');
        } else {
            this.log('Health restore failed: player not found', 'error');
        }
    }

    toggleFreecam() {
        if (this.game && typeof this.game.toggleFreecam === 'function') {
            this.game.toggleFreecam();
            this.log('Freecam mode toggled');
        } else {
            this.log('Freecam not available in this game mode', 'error');
        }
    }

    setMaxWave() {
        if (this.game && this.game.waveSystem && typeof this.game.waveSystem.setMaxWave === 'function') {
            this.game.waveSystem.setMaxWave();
            this.log('Wave set to maximum!');
        } else {
            this.log('Wave system not available or setMaxWave not implemented.', 'error');
        }
    }

    toggleRGBMode() {
        this.rgbMode = !this.rgbMode;
        this.log(this.rgbMode ? 'RGB mode enabled! 🌈' : 'RGB mode disabled.');
    }

    toggleInfiniteJump() {
        if (!this.game || !this.game.player) {
            this.log('Player not found.', 'error');
            return;
        }
        this.game.player.infiniteJump = !this.game.player.infiniteJump;
        this.log(this.game.player.infiniteJump ? 'Infinite jump enabled!' : 'Infinite jump disabled.');
    }

    setPlayerSpeed(value) {
        if (!this.game || !this.game.player) {
            this.log('Player not found.', 'error');
            return;
        }
        const speed = parseFloat(value);
        if (isNaN(speed) || speed <= 0) {
            this.log('Usage: speed [positive number]', 'error');
            return;
        }
        this.game.player.speed = speed;
        this.log(`Player speed set to ${speed}`);
    }

    spawnPowerUp(type) {
        if (!this.game || !this.game.environment) {
            this.log('Error: Game environment not available', 'error');
            return;
        }
        if (type && ['health', 'ammo', 'rapidfire'].includes(type.toLowerCase())) {
            this.game.environment.spawnPowerUp(type.toLowerCase());
            this.log(`Spawned power-up: ${type}`);
        } else {
            this.game.environment.spawnRandomPowerUp();
            this.log('Spawned random power-up');
        }
    }
    
    reportBug() {
        if (this.bugReporter) {
            this.log('Opening bug report form...', 'info');
            // Hide console before showing bug report modal
            this.hide();
            this.bugReporter.show();
        } else {
            this.log('Bug reporting module not initialized properly', 'error');
        }
    }
    
    toggleRapidFire(value) {
        if (!this.game || !this.game.weapon) {
            this.log('Error: Weapon not available', 'error');
            return;
        }
        
        // Store original fire rate if not already stored
        if (!this.game.weapon._originalFireRate) {
            this.game.weapon._originalFireRate = this.game.weapon.fireRate;
        }
        
        // Parse fire rate value if provided
        let fireRate = 0.05; // Default super fast fire rate
        if (value) {
            const parsedValue = parseFloat(value);
            if (!isNaN(parsedValue) && parsedValue > 0) {
                fireRate = parsedValue;
            }
        }
        
        // Toggle rapid fire
        if (this.game.weapon.fireRate === this.game.weapon._originalFireRate) {
            // Enable rapid fire
            this.game.weapon.fireRate = fireRate;
            this.log(`Rapid fire enabled! Fire rate set to ${fireRate} seconds`);
        } else {
            // Disable rapid fire
            this.game.weapon.fireRate = this.game.weapon._originalFireRate;
            this.log(`Rapid fire disabled. Fire rate restored to ${this.game.weapon.fireRate} seconds`);
        }
    }
    
    toggleInfiniteAmmo() {
        if (!this.game || !this.game.weapon) {
            this.log('Error: Weapon not available', 'error');
            return;
        }
        this.game.weapon.infiniteAmmo = !this.game.weapon.infiniteAmmo;
        this.log(this.game.weapon.infiniteAmmo ? 'Infinite ammo enabled!' : 'Infinite ammo disabled.');
    }

    adminPanel() {
        if (!this.game) {
            this.log('Game not available', 'error');
            return;
        }
        this.hide();

        if (this._adminPanel) {
            this._adminPanel.remove();
        }

        const panel = document.createElement('div');
        panel.id = 'admin-panel';
        panel.style.cssText = `
            position:fixed; top:0; left:0; width:100vw; height:100vh;
            background:rgba(0,0,0,0.92); z-index:9999;
            display:flex; align-items:center; justify-content:center;
            font-family:'Rajdhani','Orbitron',sans-serif;
            backdrop-filter:blur(12px);
        `;

        const card = document.createElement('div');
        card.style.cssText = `
            background:rgba(10,10,20,0.95); border:2px solid rgba(0,255,170,0.3);
            border-radius:15px; box-shadow:0 0 40px rgba(0,255,170,0.2);
            width:720px; min-height:420px; color:#fff; display:flex; overflow:hidden;
        `;

        // ─── Login Screen ───
        const loginBox = document.createElement('div');
        loginBox.id = 'admin-login';
        loginBox.style.cssText = `
            position:absolute; top:0; left:0; width:100%; height:100%;
            display:flex; align-items:center; justify-content:center;
            z-index:10;
        `;
        loginBox.innerHTML = `
            <div style="text-align:center;">
                <h2 style="color:#00ffaa; margin-bottom:24px; text-shadow:0 0 15px rgba(0,255,170,0.8); letter-spacing:3px;">ADMIN PANEL</h2>
                <input id="admin-user" type="text" placeholder="Username"
                    style="display:block; width:220px; margin:8px auto; padding:10px 14px;
                    background:rgba(255,255,255,0.08); border:1px solid rgba(0,255,170,0.3);
                    border-radius:6px; color:#fff; font-family:monospace; font-size:14px; outline:none;">
                <input id="admin-pass" type="password" placeholder="Password"
                    style="display:block; width:220px; margin:8px auto; padding:10px 14px;
                    background:rgba(255,255,255,0.08); border:1px solid rgba(0,255,170,0.3);
                    border-radius:6px; color:#fff; font-family:monospace; font-size:14px; outline:none;">
                <div id="admin-login-err" style="color:#ff5252; font-size:13px; min-height:18px; margin-top:6px;"></div>
                <button id="admin-login-btn" style="
                    display:block; width:220px; margin:14px auto 0; padding:12px;
                    background:linear-gradient(135deg,#43A047,#1B5E20); border:none;
                    border-radius:8px; color:#fff; font-size:18px; font-weight:700;
                    cursor:pointer; letter-spacing:2px; text-transform:uppercase;
                    transition:all 0.2s;
                ">Login</button>
            </div>
        `;

        // ─── Main Panel (hidden until login) ───
        const mainPanel = document.createElement('div');
        mainPanel.id = 'admin-main';
        mainPanel.style.cssText = `display:none; width:100%; height:100%; display:none;`;

        // Left sidebar
        const sidebar = document.createElement('div');
        sidebar.style.cssText = `
            width:160px; background:rgba(0,0,0,0.5); padding:20px 0;
            display:flex; flex-direction:column; gap:4px; flex-shrink:0;
        `;

        const tabs = [
            { id: 'player', label: 'Player' },
            { id: 'weapon', label: 'Weapon' },
            { id: 'game', label: 'Game' }
        ];
        const tabButtons = {};

        tabs.forEach(t => {
            const btn = document.createElement('button');
            btn.textContent = t.label;
            btn.style.cssText = `
                display:block; width:100%; padding:14px 20px; border:none;
                background:transparent; color:rgba(255,255,255,0.5);
                font-family:'Rajdhani',sans-serif; font-size:16px; font-weight:600;
                text-align:left; cursor:pointer; letter-spacing:1px;
                border-left:3px solid transparent; transition:all 0.2s;
            `;
            btn.onmouseenter = () => { if (this._activeAdminTab !== t.id) btn.style.color = '#fff'; };
            btn.onmouseleave = () => { if (this._activeAdminTab !== t.id) btn.style.color = 'rgba(255,255,255,0.5)'; };
            btn.onclick = () => this._switchAdminTab(t.id, tabButtons);
            sidebar.appendChild(btn);
            tabButtons[t.id] = btn;
        });

        // Close button in sidebar
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            margin-top:auto; display:block; width:calc(100% - 30px); margin-left:15px;
            padding:10px; border:1px solid rgba(255,80,80,0.4); border-radius:6px;
            background:rgba(255,80,80,0.1); color:#ff5252; font-family:'Rajdhani',sans-serif;
            font-size:14px; cursor:pointer; transition:all 0.2s;
        `;
        closeBtn.onmouseenter = () => { closeBtn.style.background = 'rgba(255,80,80,0.3)'; };
        closeBtn.onmouseleave = () => { closeBtn.style.background = 'rgba(255,80,80,0.1)'; };
        closeBtn.onclick = () => { this._closeAdminPanel(panel); };
        sidebar.appendChild(closeBtn);

        mainPanel.appendChild(sidebar);

        // Right content area
        const content = document.createElement('div');
        content.id = 'admin-content';
        content.style.cssText = `
            flex:1; padding:24px 30px; overflow-y:auto;
            background:rgba(255,255,255,0.03);
        `;
        mainPanel.appendChild(content);

        card.appendChild(mainPanel);

        panel.appendChild(card);
        document.body.appendChild(panel);
        this._adminPanel = panel;
        this._activeAdminTab = null;

        // ═══ Login or skip if already authenticated ═══
        if (this._adminLoggedIn) {
            loginBox.style.display = 'none';
            mainPanel.style.display = 'flex';
            this._switchAdminTab('player', tabButtons);
        } else {
            card.appendChild(loginBox);
        }

        // Pause game when admin panel opens — exit pointer lock so user can interact
        if (this.game) {
            if (document.pointerLockElement === document.body) {
                document.exitPointerLock();
            }
            this.game.isPaused = true;
            if (this.game.player) {
                this.game.player.setPaused(true);
            }
        }

        // Close on Escape
        this._adminPanelKeyHandler = (e) => {
            if (e.key === 'Escape') this._closeAdminPanel(panel);
        };
        document.addEventListener('keydown', this._adminPanelKeyHandler);

        // Wire up login
        const loginBtn = loginBox.querySelector('#admin-login-btn');
        const userInput = loginBox.querySelector('#admin-user');
        const passInput = loginBox.querySelector('#admin-pass');
        const errDiv = loginBox.querySelector('#admin-login-err');

        const doLogin = () => {
            const u = userInput.value.trim();
            const p = passInput.value.trim();
            if (ADMIN_CONFIG.users[u] && ADMIN_CONFIG.users[u] === p) {
                this._adminLoggedIn = true;
                loginBox.style.display = 'none';
                mainPanel.style.display = 'flex';
                this._switchAdminTab('player', tabButtons);
            } else {
                errDiv.textContent = 'Invalid credentials';
                passInput.value = '';
            }
        };
        loginBtn.onclick = doLogin;
        passInput.onkeydown = (e) => { if (e.key === 'Enter') doLogin(); };
        userInput.focus();
    }

    _closeAdminPanel(panel) {
        panel.remove();
        this._adminPanel = null;
        document.removeEventListener('keydown', this._adminPanelKeyHandler);
        // Resume game — restore paused state
        if (this.game) {
            this.game.isPaused = false;
            if (this.game.player) {
                this.game.player.setPaused(false);
            }
        }
    }

    _switchAdminTab(tabId, tabButtons) {
        this._activeAdminTab = tabId;
        const content = this._adminPanel.querySelector('#admin-content');
        if (!content) return;

        Object.keys(tabButtons).forEach(k => {
            const btn = tabButtons[k];
            if (k === tabId) {
                btn.style.color = '#00ffaa';
                btn.style.borderLeftColor = '#00ffaa';
                btn.style.background = 'rgba(0,255,170,0.08)';
            } else {
                btn.style.color = 'rgba(255,255,255,0.5)';
                btn.style.borderLeftColor = 'transparent';
                btn.style.background = 'transparent';
            }
        });

        content.innerHTML = '';
        const factories = { player: '_createPlayerTab', weapon: '_createWeaponTab', game: '_createGameTab' };
        if (factories[tabId] && typeof this[factories[tabId]] === 'function') {
            content.appendChild(this[factories[tabId]]());
        }
    }

    _adminCard(title) {
        const card = document.createElement('div');
        card.style.cssText = `
            background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);
            border-radius:8px; padding:16px 20px; margin-bottom:14px;
        `;
        const h = document.createElement('div');
        h.textContent = title;
        h.style.cssText = `
            color:#00ffaa; font-size:14px; font-weight:700; margin-bottom:12px;
            text-transform:uppercase; letter-spacing:2px;
            border-bottom:1px solid rgba(0,255,170,0.15); padding-bottom:8px;
        `;
        card.appendChild(h);
        return card;
    }

    _adminToggle(label, isOn, onChange) {
        const row = document.createElement('div');
        row.style.cssText = `display:flex; align-items:center; justify-content:space-between; margin:8px 0;`;
        const lbl = document.createElement('span');
        lbl.textContent = label;
        lbl.style.cssText = `color:#ccc; font-size:14px;`;

        const track = document.createElement('div');
        track.style.cssText = `
            width:44px; height:24px; border-radius:12px; cursor:pointer;
            background:${isOn ? 'rgba(0,255,170,0.6)' : 'rgba(255,255,255,0.15)'};
            position:relative; transition:background 0.2s;
        `;
        const thumb = document.createElement('div');
        thumb.style.cssText = `
            width:18px; height:18px; border-radius:50%; background:#fff;
            position:absolute; top:3px; ${isOn ? 'left:23px' : 'left:3px'};
            transition:left 0.2s;
        `;
        track.appendChild(thumb);

        let on = isOn;
        track.onclick = () => {
            on = !on;
            thumb.style.left = on ? '23px' : '3px';
            track.style.background = on ? 'rgba(0,255,170,0.6)' : 'rgba(255,255,255,0.15)';
            if (onChange) onChange(on);
        };

        row.appendChild(lbl);
        row.appendChild(track);
        return row;
    }

    _adminSlider(label, min, max, value, step, onChange) {
        const wrap = document.createElement('div');
        wrap.style.cssText = `margin:10px 0;`;
        const top = document.createElement('div');
        top.style.cssText = `display:flex; justify-content:space-between; margin-bottom:4px;`;
        const lbl = document.createElement('span');
        lbl.textContent = label;
        lbl.style.cssText = `color:#ccc; font-size:14px;`;
        const val = document.createElement('span');
        val.textContent = value;
        val.style.cssText = `color:#00ffaa; font-size:14px; font-weight:700;`;
        top.appendChild(lbl);
        top.appendChild(val);
        wrap.appendChild(top);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = min;
        slider.max = max;
        slider.step = step;
        slider.value = value;
        slider.style.cssText = `
            width:100%; height:6px; -webkit-appearance:none; appearance:none;
            background:rgba(255,255,255,0.12); border-radius:3px; outline:none;
        `;
        slider.oninput = () => {
            val.textContent = slider.value;
            if (onChange) onChange(parseFloat(slider.value));
        };
        wrap.appendChild(slider);
        return wrap;
    }

    _adminButton(label, color, onClick) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText = `
            display:inline-block; padding:10px 20px; margin:4px 8px 4px 0;
            background:${color}; border:none; border-radius:6px;
            color:#fff; font-family:'Rajdhani',sans-serif; font-size:14px;
            font-weight:600; cursor:pointer; letter-spacing:1px; transition:all 0.2s;
        `;
        btn.onmouseenter = () => { btn.style.filter = 'brightness(1.3)'; };
        btn.onmouseleave = () => { btn.style.filter = 'brightness(1)'; };
        btn.onclick = onClick;
        return btn;
    }

    _createPlayerTab() {
        const frag = document.createDocumentFragment();

        // Speed
        const speedCard = this._adminCard('Movement');
        const p = this.game.player;
        speedCard.appendChild(this._adminSlider('Speed', 1, 20, p ? p.speed : 5, 0.5, (v) => {
            if (this.game.player) this.game.player.speed = v;
        }));
        frag.appendChild(speedCard);

        // Health
        const healthCard = this._adminCard('Health');
        healthCard.appendChild(this._adminButton('Restore Full Health', 'linear-gradient(135deg,#43A047,#1B5E20)', () => {
            if (this.game.player) {
                this.game.player.health = this.game.player.maxHealth;
                if (this.game.ui) this.game.ui.updateHealthBar(this.game.player.health, this.game.player.maxHealth);
            }
        }));
        frag.appendChild(healthCard);

        // Fly (replaces old freecam)
        const flyCard = this._adminCard('Fly');
        flyCard.appendChild(this._adminToggle('Enable Fly', this.game.freecamEnabled || false, (on) => {
            if (this.game) this.game.toggleFreecam();
        }));
        flyCard.appendChild(this._adminSlider('Fly Speed', 2, 30, this.game.flySpeed || 10, 1, (v) => {
            if (this.game) this.game.flySpeed = v;
        }));
        const flyHint = document.createElement('div');
        flyHint.style.cssText = 'color:rgba(255,255,255,0.35); font-size:12px; margin-top:8px;';
        flyHint.textContent = 'WASD to move, Space/Q to go up/down, Shift for speed boost';
        flyCard.appendChild(flyHint);
        frag.appendChild(flyCard);

        // Infinite Jump
        const jumpCard = this._adminCard('Jump');
        jumpCard.appendChild(this._adminToggle('Infinite Jump', p ? p.infiniteJump : false, (on) => {
            if (this.game.player) this.game.player.infiniteJump = on;
        }));
        frag.appendChild(jumpCard);

        // God Mode
        const godCard = this._adminCard('God Mode');
        godCard.appendChild(this._adminToggle('Enable God Mode', p ? p.isGodMode : false, (on) => {
            if (this.game.player) {
                if (this.game.player.isGodMode !== on) {
                    this.game.player.toggleGodMode();
                }
            }
        }));
        frag.appendChild(godCard);

        return frag;
    }

    _createWeaponTab() {
        const frag = document.createDocumentFragment();
        const w = this.game.weapon;

        // Rapid Fire
        const rfCard = this._adminCard('Rapid Fire');
        const origRate = w ? (w._originalFireRate || 0.5) : 0.5;
        const currentIsRapid = w && w.fireRate !== origRate;
        const initialRate = currentIsRapid ? w.fireRate : 0.15;

        const rfState = { isRapid: currentIsRapid };
        let rfToggle;

        const rfSlider = this._adminSlider('Fire Rate (seconds)', 0.02, origRate, currentIsRapid ? w.fireRate : origRate, 0.01, (v) => {
            if (this.game.weapon) {
                if (!this.game.weapon._originalFireRate) this.game.weapon._originalFireRate = 0.5;
                this.game.weapon.fireRate = v;
                rfState.isRapid = v < this.game.weapon._originalFireRate;
                rfToggle.textContent = rfState.isRapid ? 'ON' : 'OFF';
                rfToggle.style.color = rfState.isRapid ? '#00ffaa' : '#888';
            }
        });
        rfCard.appendChild(rfSlider);
        const rfRow = document.createElement('div');
        rfRow.style.cssText = 'display:flex; align-items:center; gap:10px; margin-top:8px;';
        const rfLabel = document.createElement('span');
        rfLabel.textContent = 'Status:';
        rfLabel.style.cssText = 'color:#ccc; font-size:14px;';
        rfToggle = document.createElement('span');
        rfToggle.textContent = rfState.isRapid ? 'ON' : 'OFF';
        rfToggle.style.cssText = `color:${rfState.isRapid ? '#00ffaa' : '#888'}; font-size:14px; font-weight:700;`;
        const rfReset = this._adminButton('Reset to Default', 'linear-gradient(135deg,#555,#333)', () => {
            if (this.game.weapon && this.game.weapon._originalFireRate) {
                this.game.weapon.fireRate = this.game.weapon._originalFireRate;
                rfCard.querySelector('input[type=range]').value = this.game.weapon._originalFireRate;
                rfCard.querySelector('span:last-child').textContent = this.game.weapon._originalFireRate;
                rfState.isRapid = false;
                rfToggle.textContent = 'OFF';
                rfToggle.style.color = '#888';
            }
        });
        rfRow.appendChild(rfLabel);
        rfRow.appendChild(rfToggle);
        rfRow.appendChild(rfReset);
        rfCard.appendChild(rfRow);
        frag.appendChild(rfCard);

        // Infinite Ammo
        const ammoCard = this._adminCard('Ammo');
        ammoCard.appendChild(this._adminToggle('Infinite Ammo', w ? w.infiniteAmmo : false, (on) => {
            if (this.game.weapon) this.game.weapon.infiniteAmmo = on;
        }));
        frag.appendChild(ammoCard);

        // Set Ammo
        const setAmmoCard = this._adminCard('Set Ammo');
        const ammoInput = document.createElement('input');
        ammoInput.type = 'number';
        ammoInput.min = '0';
        ammoInput.max = '999';
        ammoInput.value = w ? w.maxAmmo : 30;
        ammoInput.style.cssText = `
            width:80px; padding:8px 12px; background:rgba(255,255,255,0.08);
            border:1px solid rgba(0,255,255,0.2); border-radius:6px;
            color:#fff; font-family:monospace; font-size:14px; outline:none;
            margin-right:10px;
        `;
        const ammoBtn = this._adminButton('Set Ammo', 'linear-gradient(135deg,#2196F3,#0D47A1)', () => {
            if (this.game.weapon) {
                const v = parseInt(ammoInput.value);
                if (!isNaN(v) && v >= 0) {
                    this.game.weapon.ammo = v;
                    this.game.weapon.maxAmmo = v;
                    if (this.game.ui) this.game.ui.updateAmmoCounter(v, v);
                }
            }
        });
        const ammoRow = document.createElement('div');
        ammoRow.style.cssText = 'display:flex; align-items:center; margin-top:4px;';
        const ammoLbl = document.createElement('span');
        ammoLbl.textContent = 'Ammo count:';
        ammoLbl.style.cssText = 'color:#ccc; font-size:14px; margin-right:10px;';
        ammoRow.appendChild(ammoLbl);
        ammoRow.appendChild(ammoInput);
        ammoRow.appendChild(ammoBtn);
        setAmmoCard.appendChild(ammoRow);
        frag.appendChild(setAmmoCard);

        return frag;
    }

    _createGameTab() {
        const frag = document.createDocumentFragment();
        const ws = this.game.waveSystem;

        // Set Wave
        const waveCard = this._adminCard('Set Wave');
        const waveInput = document.createElement('input');
        waveInput.type = 'number';
        waveInput.min = '1';
        waveInput.max = '999';
        waveInput.value = ws ? ws.wave : 1;
        waveInput.style.cssText = `
            width:80px; padding:8px 12px; background:rgba(255,255,255,0.08);
            border:1px solid rgba(0,255,255,0.2); border-radius:6px;
            color:#fff; font-family:monospace; font-size:14px; outline:none;
            margin-right:10px;
        `;
        const waveBtn = this._adminButton('Set Wave', 'linear-gradient(135deg,#FF9800,#E65100)', () => {
            if (this.game.waveSystem) {
                const v = parseInt(waveInput.value);
                if (!isNaN(v) && v >= 1) {
                    this.game.waveSystem.setWave(v);
                }
            }
        });
        const waveRow = document.createElement('div');
        waveRow.style.cssText = 'display:flex; align-items:center; margin-top:4px;';
        const waveLbl = document.createElement('span');
        waveLbl.textContent = 'Wave:';
        waveLbl.style.cssText = 'color:#ccc; font-size:14px; margin-right:10px;';
        waveRow.appendChild(waveLbl);
        waveRow.appendChild(waveInput);
        waveRow.appendChild(waveBtn);
        waveCard.appendChild(waveRow);
        frag.appendChild(waveCard);

        // Spawn Bot
        const botCard = this._adminCard('Spawn Bot');
        const botRow = document.createElement('div');
        botRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; margin-top:4px;';
        const botTypes = ['GRUNT', 'SCOUT', 'HEAVY', 'SNIPER', 'COMMANDER', 'BOSS'];
        botTypes.forEach(type => {
            const btn = document.createElement('button');
            btn.textContent = type.charAt(0) + type.slice(1).toLowerCase();
            btn.style.cssText = `
                padding:8px 14px; background:rgba(255,255,255,0.08);
                border:1px solid rgba(0,255,255,0.2); border-radius:6px;
                color:#00ffaa; font-family:'Rajdhani',sans-serif; font-size:13px; font-weight:600;
                cursor:pointer; transition:all 0.2s; letter-spacing:1px;
            `;
            btn.onmouseenter = () => { btn.style.background = 'rgba(0,255,170,0.15)'; };
            btn.onmouseleave = () => { btn.style.background = 'rgba(255,255,255,0.08)'; };
            btn.onclick = () => {
                if (this.game.enemyManager) {
                    this.game.enemyManager.spawnEnemy(type);
                }
            };
            botRow.appendChild(btn);
        });
        botCard.appendChild(botRow);
        frag.appendChild(botCard);

        // Spawn Powerup
        const spawnCard = this._adminCard('Spawn Power-Up');
        const types = ['health', 'ammo', 'rapidfire'];
        types.forEach(type => {
            const btn = this._adminButton(type.charAt(0).toUpperCase() + type.slice(1),
                'linear-gradient(135deg,#FF9800,#E65100)', () => {
                if (this.game.environment) {
                    this.game.environment.spawnPowerUp(type);
                }
            });
            spawnCard.appendChild(btn);
        });
        frag.appendChild(spawnCard);

        return frag;
    }
}

export default Console;