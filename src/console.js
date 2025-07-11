// Import BugReport module
import BugReport from './bugReport.js';
import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';
import { ENEMY_TYPES } from './enemyTypes.js';

class Console {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this.commandHistory = [];
        this.historyIndex = -1;
        this.bugReporter = new BugReport(game);
        this.commands = {
            'help': () => this.showHelp(),
            'clear': () => this.clearConsole(),
            'version': () => this.showVersion(),
            'fps': () => this.showFPS(),
            'god': () => this.toggleGodMode(),
            'killall': () => this.killAllEnemies(),
            'spawn': (enemyType) => this.spawnEnemy(enemyType),
            'ammo': () => this.giveAmmo(),
            'health': () => this.giveHealth(),
            'freecam': () => this.toggleFreecam(),
            'setmaxwave': () => this.setMaxWave(),
            'rgb': () => this.toggleRGBMode(),
            'infinitejump': () => this.toggleInfiniteJump(),
            'speed': (value) => this.setPlayerSpeed(value),
            'spawnpowerup': (type) => this.spawnPowerUp(type),
            'report': () => this.reportBug(),
            'rapidfire': (value) => this.toggleRapidFire(value),
            'infiniteammo': () => this.toggleInfiniteAmmo()
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
        this.log('- god: Toggle god mode');
        this.log('- killall: Kill all enemies');
        this.log('- spawn [type]: Spawn an enemy of specified type');
        this.log('- ammo: Refill ammo');
        this.log('- health: Restore health');
        this.log('- freecam: Toggle free camera mode');
        this.log('- setmaxwave: Set wave to maximum');
        this.log('- rgb: Toggle RGB mode in console');
        this.log('- infinitejump: Toggle infinite jump');
        this.log('- speed [value]: Set player movement speed');
        this.log('- spawnpowerup [type]: Spawn a power-up (health/ammo/rapidfire)');
        this.log('- report: Report a bug');
        this.log('- rapidfire [rate]: Toggle rapid fire mode (optional rate in seconds)');
        this.log('- infiniteammo: Toggle infinite ammo');
    }

    clearConsole() {
        this.outputElement.innerHTML = '';
    }

    showVersion() {
        this.log('ShooterX v1.2.6');
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
}

export default Console;