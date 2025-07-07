class Console {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this.commandHistory = [];
        this.historyIndex = -1;
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
            'spawnpowerup': (type) => this.spawnPowerUp(type)
        };
        this.rgbMode = true;
        this._rgbHue = 0;

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

        // Add elements to console
        this.consoleElement.appendChild(this.outputElement);
        this.consoleElement.appendChild(this.inputElement);
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
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory('up');
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory('down');
            }
        });
    }

    show() {
        this.isVisible = true;
        this.consoleElement.style.display = 'block';
        this.inputElement.focus();
        // Pause the game if possible
        if (this.game && typeof this.game.pauseGame === 'function' && this.game.isRunning && !this.game.isPaused) {
            this.game.pauseGame();
            this._pausedForConsole = true;
        }
    }

    hide() {
        this.isVisible = false;
        this.consoleElement.style.display = 'none';
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
        Object.keys(this.commands).forEach(cmd => {
            this.log(`- ${cmd}`);
        });
    }

    clearConsole() {
        this.outputElement.innerHTML = '';
    }

    showVersion() {
        this.log('ShooterX v1.2.0');
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
}

export default Console;