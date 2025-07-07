import Console from './console.js';
import GAME_STATES from './gameStates.js';

// Debug logging utility
function debug(...args) {
    if (process.env.NODE_ENV === 'development') {
        console.log('[UI]', ...args);
    } else {
        console.log(...args);
    }
}

class UI {
    constructor(game) {
        this.game = game;
        this.initialized = false;
        this.lastMenu = null; // Track the last open menu
        this.console = new Console(game);

        // Get references to existing UI elements
        this.mainMenu = document.getElementById('mainMenu');
        this.pauseMenu = document.getElementById('pauseMenu');
        this.gameOverScreen = document.getElementById('gameOverScreen');
        this.healthBar = document.getElementById('healthBar');
        this.staminaBar = document.getElementById('staminaBar');
        this.ammoCounter = document.getElementById('ammoCounter');
        this.crosshair = document.getElementById('crosshair');
        this.waveInfo = document.getElementById('waveInfo');
        this.scoreInfo = document.getElementById('scoreInfo');

        // Verify all required elements exist
        if (!this.mainMenu || !this.pauseMenu || !this.gameOverScreen) {
            console.error('Required UI elements not found. Make sure the DOM is loaded before initializing UI.');
            return;
        }

        // Initialize UI
        this.setupEventListeners();
        this.initialized = true;

        // Check if we should auto-start the game (from restart)
        const urlParams = new URLSearchParams(window.location.search);
        const autoStart = urlParams.get('autostart');
        
        if (autoStart === 'true') {
            debug('Auto-starting game from restart');
            this.hideAllMenus();
            this.hideGameplayUI();
            
            // Start game after a short delay to ensure all systems are ready
            setTimeout(() => {
                this.game.startGame();
                
                // Request pointer lock after game has started
                setTimeout(() => {
                    document.body.requestPointerLock();
                }, 200);
                
                // Clear the autostart parameter from URL
                const url = window.location.href.split('?')[0];
                window.history.replaceState({}, document.title, url);
            }, 300);
        } else {
            // Show main menu initially
            this.hideAllMenus();
            this.hideGameplayUI();
            this.showMainMenu();
        }

        // Add Monster Info button to main menu (move it above Start Game)
        this.monsterInfoButton = document.createElement('button');
        this.monsterInfoButton.id = 'monsterInfoButton';
        this.monsterInfoButton.className = 'menu-button';
        this.monsterInfoButton.textContent = 'Info';
        const mainMenuContent = this.mainMenu.querySelector('.menu-content');
        const mainMenuFirstButton = mainMenuContent.querySelector('button');
        mainMenuContent.insertBefore(this.monsterInfoButton, mainMenuFirstButton);
        // Force purple background and white text
        this.monsterInfoButton.style.background = 'linear-gradient(135deg, #a259ff, #6a1b9a)';
        this.monsterInfoButton.style.color = '#fff';
        this.monsterInfoButton.onclick = () => {
            this.showMonsterInfoScreen();
        };

        // Add Monster Info button to pause menu (move it above Resume)
        this.pauseMonsterInfoButton = document.createElement('button');
        this.pauseMonsterInfoButton.id = 'pauseMonsterInfoButton';
        this.pauseMonsterInfoButton.className = 'menu-button';
        this.pauseMonsterInfoButton.textContent = 'Info';
        const pauseMenuContent = this.pauseMenu.querySelector('.menu-content');
        const pauseMenuFirstButton = pauseMenuContent.querySelector('button');
        pauseMenuContent.insertBefore(this.pauseMonsterInfoButton, pauseMenuFirstButton);
        // Force purple background and white text
        this.pauseMonsterInfoButton.style.background = 'linear-gradient(135deg, #a259ff, #6a1b9a)';
        this.pauseMonsterInfoButton.style.color = '#fff';
        this.pauseMonsterInfoButton.onclick = () => {
            this.showMonsterInfoScreen();
        };

        // Create Monster Info screen (hidden by default)
        this.monsterInfoScreen = document.createElement('div');
        this.monsterInfoScreen.id = 'monsterInfoScreen';
        this.monsterInfoScreen.style.display = 'none';
        this.monsterInfoScreen.style.position = 'fixed';
        this.monsterInfoScreen.style.top = '0';
        this.monsterInfoScreen.style.left = '0';
        this.monsterInfoScreen.style.width = '100vw';
        this.monsterInfoScreen.style.height = '100vh';
        this.monsterInfoScreen.style.background = 'rgba(0,0,0,0.95)';
        this.monsterInfoScreen.style.zIndex = '9999';
        this.monsterInfoScreen.style.display = 'flex';
        this.monsterInfoScreen.style.flexDirection = 'column';
        this.monsterInfoScreen.style.justifyContent = 'center';
        this.monsterInfoScreen.style.alignItems = 'center';
        this.monsterInfoScreen.innerHTML = `
            <div style="background:#181818;padding:2rem;border-radius:10px;max-width:90vw;max-height:90vh;overflow-y:auto;text-align:center;color:#fff;box-shadow:0 0 40px 10px #000a;">
                <h1>Enemy Types</h1>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1.5rem;margin:2rem 0;padding:1rem;">
                    <div style="background:rgba(0,0,0,0.4);padding:1.5rem;border-radius:8px;box-shadow:0 2px 8px #0006;">
                        <h3 style='color:#ff5252;'>Grunt</h3>
                        <p>Health: 100</p>
                        <p>Speed: Normal</p>
                        <p>Damage: 10</p>
                        <p>Points: 100</p>
                        <p style='margin-top:1em;color:#bdbdbd;'>Basic enemy that slowly approaches and attacks the player at close range.</p>
                        <p style='color:#ff5252;'>Color: Red</p>
                    </div>
                    <div style="background:rgba(0,0,0,0.4);padding:1.5rem;border-radius:8px;box-shadow:0 2px 8px #0006;">
                        <h3 style='color:#ff5252;'>Scout</h3>
                        <p>Health: 75</p>
                        <p>Speed: Fast</p>
                        <p>Damage: 8</p>
                        <p>Points: 150</p>
                        <p style='margin-top:1em;color:#bdbdbd;'>Fast-moving enemy that tries to flank and overwhelm the player.</p>
                        <p style='color:#4CAF50;'>Color: Green</p>
                    </div>
                    <div style="background:rgba(0,0,0,0.4);padding:1.5rem;border-radius:8px;box-shadow:0 2px 8px #0006;">
                        <h3 style='color:#ff5252;'>Heavy</h3>
                        <p>Health: 200</p>
                        <p>Speed: Slow</p>
                        <p>Damage: 15</p>
                        <p>Points: 200</p>
                        <p style='margin-top:1em;color:#bdbdbd;'>Slow but tough enemy that can absorb a lot of damage and deals heavy hits.</p>
                        <p style='color:#FFC107;'>Color: Yellow</p>
                    </div>
                    <div style="background:rgba(0,0,0,0.4);padding:1.5rem;border-radius:8px;box-shadow:0 2px 8px #0006;">
                        <h3 style='color:#ff5252;'>Sniper</h3>
                        <p>Health: 60</p>
                        <p>Speed: Normal</p>
                        <p>Damage: 25</p>
                        <p>Points: 250</p>
                        <p style='margin-top:1em;color:#bdbdbd;'>Attacks from a distance with high-damage shots, but has low health.</p>
                        <p style='color:#2196F3;'>Color: Blue</p>
                    </div>
                    <div style="background:rgba(0,0,0,0.4);padding:1.5rem;border-radius:8px;box-shadow:0 2px 8px #0006;">
                        <h3 style='color:#ff5252;'>Commander</h3>
                        <p>Health: 175</p>
                        <p>Speed: Fast</p>
                        <p>Damage: 12</p>
                        <p>Points: 300</p>
                        <p style='margin-top:1em;color:#bdbdbd;'>Buffs nearby enemies and coordinates group attacks.</p>
                        <p style='color:#9C27B0;'>Color: Purple</p>
                    </div>
                    <div style="background:rgba(0,0,0,0.4);padding:1.5rem;border-radius:8px;box-shadow:0 2px 8px #0006;">
                        <h3 style='color:#ff5252;'>Boss</h3>
                        <p>Health: 400</p>
                        <p>Speed: Normal</p>
                        <p>Damage: 30</p>
                        <p>Points: 500</p>
                        <p style='margin-top:1em;color:#bdbdbd;'>Extremely tough and dangerous, with special attacks and high health.</p>
                        <p style='color:#FF5722;'>Color: Orange</p>
                    </div>
                </div>
                <h1 style="margin-top:2.5rem;">Power-Ups</h1>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1.5rem;margin:2rem 0;padding:1rem;">
                    <div style="background:rgba(0,0,0,0.4);padding:1.5rem;border-radius:8px;box-shadow:0 2px 8px #0006;">
                        <h3 style='color:#44ff44;'>Health Boost</h3>
                        <p>Restores 50 health instantly.</p>
                        <p style='color:#ff4444;'>Color: Red</p>
                    </div>
                    <div style="background:rgba(0,0,0,0.4);padding:1.5rem;border-radius:8px;box-shadow:0 2px 8px #0006;">
                        <h3 style='color:#44ff44;'>Ammo Refill</h3>
                        <p>Temporarily increases max ammo to 50 and refills ammo. Lasts 20 seconds, then reverts to 30/30.</p>
                        <p style='color:#44ff44;'>Color: Green</p>
                    </div>
                    <div style="background:rgba(0,0,0,0.4);padding:1.5rem;border-radius:8px;box-shadow:0 2px 8px #0006;">
                        <h3 style='color:#00bbff;'>Rapid Fire</h3>
                        <p>Greatly increases fire rate for 10 seconds.</p>
                        <p style='color:#00bbff;'>Color: Blue</p>
                    </div>
                </div>
                <button id="monsterInfoBackButton" style="margin-top:1rem;padding:0.8rem 2rem;font-size:1.1rem;background:#ff5252;color:white;border:none;border-radius:5px;cursor:pointer;">Back</button>
            </div>
        `;
        this.monsterInfoScreen.style.display = 'none';
        document.body.appendChild(this.monsterInfoScreen);
    }

    setupEventListeners() {
        // Setup start button
        const startButton = document.getElementById('startButton');
        if (startButton) {
            startButton.onclick = () => {
                console.log('Start button clicked');
                // Hide the main menu first
                this.hideMainMenu();
                
                // Start the game directly, which will show the gameplay UI
                this.game.startGame();
                
                // Request pointer lock
                document.body.requestPointerLock();
            };
        }

        // Setup resume button
        const resumeButton = document.getElementById('resumeButton');
        if (resumeButton) {
            resumeButton.onclick = () => {
                this.hidePauseMenu();
                this.game.resumeGame();
            };
        }

        // Setup menu buttons
        const menuButton = document.getElementById('menuButton');
        if (menuButton) {
            menuButton.onclick = () => this.game.quitToMenu();
        }

        const menuGameOverButton = document.getElementById('menuGameOverButton');
        if (menuGameOverButton) {
            menuGameOverButton.onclick = () => this.game.quitToMenu();
        }

        // Setup quit buttons
        const quitButton = document.getElementById('quitButton');
        if (quitButton) {
            quitButton.onclick = () => this.game.quitGame();
        }

        const quitPauseButton = document.getElementById('quitPauseButton');
        if (quitPauseButton) {
            quitPauseButton.onclick = () => this.game.quitGame();
        }

        const quitGameOverButton = document.getElementById('quitGameOverButton');
        if (quitGameOverButton) {
            quitGameOverButton.onclick = () => this.game.quitGame();
        }

        // Setup restart button
        const restartButton = document.getElementById('restartButton');
        if (restartButton) {
            restartButton.onclick = () => {
                debug('Restart button clicked - reloading with auto-start flag');
                
                // Disable button to prevent multiple clicks
                restartButton.disabled = true;
                
                // 1. Exit pointer lock
                if (document.pointerLockElement === document.body) {
                    document.exitPointerLock();
                }
                
                // 2. Hide all UI screens
                this.hideGameOverScreen();
                this.hideAllMenus();
                this.hideGameplayUI();
                
                // 3. Cancel any animation frames
                if (this.game.animationFrameId) {
                    cancelAnimationFrame(this.game.animationFrameId);
                    this.game.animationFrameId = null;
                }
                
                // 4. Reload page with auto-start parameter
                setTimeout(() => {
                    // Add auto-start flag to URL
                    window.location.href = window.location.href.split('?')[0] + '?autostart=true';
                }, 100);
            };
        }

        // Monster Info button event handlers
        if (this.monsterInfoButton) {
            this.monsterInfoButton.onclick = () => {
                this.showMonsterInfoScreen();
            };
        }
        if (this.pauseMonsterInfoButton) {
            this.pauseMonsterInfoButton.onclick = () => {
                this.showMonsterInfoScreen();
            };
        }
    }

    hideAllMenus() {
        console.log('Hiding all menus');
        if (this.mainMenu) this.mainMenu.style.display = 'none';
        if (this.pauseMenu) this.pauseMenu.style.display = 'none';
        if (this.gameOverScreen) this.gameOverScreen.style.display = 'none';
    }

    hideGameplayUI() {
        if (this.healthBar) this.healthBar.style.display = 'none';
        if (this.staminaBar) this.staminaBar.style.display = 'none';
        if (this.ammoCounter) this.ammoCounter.style.display = 'none';
        if (this.crosshair) this.crosshair.style.display = 'none';
        if (this.waveInfo) this.waveInfo.style.display = 'none';
        if (this.scoreInfo) this.scoreInfo.style.display = 'none';
    }

    showGameplayUI() {
        console.log('Showing gameplay UI');
        if (this.healthBar) this.healthBar.style.display = 'block';
        if (this.staminaBar) this.staminaBar.style.display = 'block';
        if (this.ammoCounter) this.ammoCounter.style.display = 'block';
        if (this.crosshair) this.crosshair.style.display = 'block';
        if (this.waveInfo) this.waveInfo.style.display = 'block';
        if (this.scoreInfo) this.scoreInfo.style.display = 'block';
    }

    showMainMenu() {
        console.log('Showing main menu');
        if (this.mainMenu) {
            // Ensure we set display: flex for proper layout
            this.mainMenu.style.display = 'flex';
            
            // Add visible class for animation
            setTimeout(() => {
                this.mainMenu.classList.add('visible');
                
                // Add a staggered animation to the buttons
                const buttons = this.mainMenu.querySelectorAll('button');
                buttons.forEach((button, index) => {
                    button.style.opacity = '0';
                    button.style.transform = 'translateY(20px) translateZ(0)';
                    setTimeout(() => {
                        button.style.opacity = '1';
                        button.style.transform = 'translateY(0) translateZ(0)';
                    }, 200 + (index * 150));
                });
                
                // Animate the title
                const title = this.mainMenu.querySelector('h1');
                if (title) {
                    title.style.opacity = '0';
                    title.style.transform = 'scale(0.9) translateY(-20px)';
                    setTimeout(() => {
                        title.style.opacity = '1';
                        title.style.transform = 'scale(1) translateY(0)';
                    }, 100);
                }
            }, 10);
        }
    }

    hideMainMenu() {
        if (this.mainMenu) {
            // Remove visible class first to trigger animation
            this.mainMenu.classList.remove('visible');
            // Then hide after animation completes
            setTimeout(() => {
                this.mainMenu.style.display = 'none';
            }, 400); // Match animation duration
        }
    }

    showPauseMenu() {
        console.log('Showing pause menu');
        if (this.pauseMenu) {
            // Ensure we set display: flex for proper layout
            this.pauseMenu.style.display = 'flex';
            
            // Add visible class for animation
            setTimeout(() => {
                this.pauseMenu.classList.add('visible');
            }, 10); // Small delay to ensure DOM updates

            // Add a slight visual bump to the pause title 
            const pauseTitle = this.pauseMenu.querySelector('h1');
            if (pauseTitle) {
                pauseTitle.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    pauseTitle.style.transform = 'scale(1)';
                }, 200);
            }
        }
    }

    hidePauseMenu() {
        if (this.pauseMenu) {
            // Remove visible class first to trigger animation
            this.pauseMenu.classList.remove('visible');
            // Then hide after animation completes
            setTimeout(() => {
                this.pauseMenu.style.display = 'none';
            }, 400); // Match animation duration
        }
    }

    showGameOverScreen() {
        this.hideAllMenus();
        this.hideGameplayUI();
        if (this.gameOverScreen) {
            // Add score information
            const scoreElement = this.gameOverScreen.querySelector('.score');
            if (scoreElement && this.game.waveSystem) {
                const state = this.game.waveSystem.getCurrentState();
                scoreElement.innerHTML = `
                    Wave: ${state.wave}<br>
                    Final Score: <span class="multiplier">${state.totalScore}</span><br>
                    Enemies Killed: ${state.enemiesKilled}
                `;
            }
            
            // Ensure we set display: flex for proper layout
            this.gameOverScreen.style.display = 'flex';
            
            // Add visible class for animation
            setTimeout(() => {
                this.gameOverScreen.classList.add('visible');
                
                // Add a staggered animation to the buttons
                const buttons = this.gameOverScreen.querySelectorAll('button');
                buttons.forEach((button, index) => {
                    button.style.opacity = '0';
                    button.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        button.style.opacity = '1';
                        button.style.transform = 'translateY(0)';
                    }, 300 + (index * 100));
                });
            }, 10);
            
            if (document.pointerLockElement === document.body) {
                document.exitPointerLock();
            }
        }
    }

    hideGameOverScreen() {
        if (this.gameOverScreen) {
            // Remove visible class first to trigger animation
            this.gameOverScreen.classList.remove('visible');
            
            // Then hide after animation completes
            setTimeout(() => {
                this.gameOverScreen.style.display = 'none';
            }, 400); // Match animation duration
            
            debug('Game over screen hidden');
        }
    }

    updateHealthBar(currentHealth, maxHealth) {
        if (this.healthBar) {
            const healthPercentage = (currentHealth / maxHealth) * 100;
            
            // Update the transform of the :before element instead of width
            this.healthBar.style.setProperty('--health-percent', `${healthPercentage}%`);
            this.healthBar.style.setProperty('--health-scaleX', healthPercentage / 100);
            
            // Update pseudo-element directly (this is the actual bar)
            if (this.healthBar.style.setProperty) {
                this.healthBar.style.setProperty('--health-scaleX', healthPercentage / 100);
            } else {
                // Fallback for browsers not supporting CSS variables
                const beforeElement = this.healthBar.querySelector(':before');
                if (beforeElement) {
                    beforeElement.style.transform = `scaleX(${healthPercentage / 100})`;
                }
            }
            
            // Update text
            const healthBarText = document.getElementById('healthBarText');
            if (healthBarText) {
                healthBarText.textContent = `${Math.round(currentHealth)}/${maxHealth}`;
            }
            
            // Change color based on health level
            let healthColor = 'linear-gradient(90deg, #f00, #ff5252)';
            if (healthPercentage > 60) {
                healthColor = 'linear-gradient(90deg, #4CAF50, #8BC34A)'; // Green
            } else if (healthPercentage > 30) {
                healthColor = 'linear-gradient(90deg, #FFC107, #FF9800)'; // Yellow-Orange
            }
            
            // Apply color to pseudo-element
            this.healthBar.style.setProperty('--health-color', healthColor);
        }
    }

    updateStaminaBar(currentStamina, maxStamina) {
        if (this.staminaBar) {
            const staminaPercentage = (currentStamina / maxStamina) * 100;
            
            // Update the transform of the :before element instead of width
            this.staminaBar.style.setProperty('--stamina-scaleX', staminaPercentage / 100);
            
            // Update pseudo-element directly (this is the actual bar)
            if (this.staminaBar.style.setProperty) {
                this.staminaBar.style.setProperty('--stamina-scaleX', staminaPercentage / 100);
            } else {
                // Fallback for browsers not supporting CSS variables
                const beforeElement = this.staminaBar.querySelector(':before');
                if (beforeElement) {
                    beforeElement.style.transform = `scaleX(${staminaPercentage / 100})`;
                }
            }
            
            // Change color based on stamina level
            let staminaColor = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
            if (staminaPercentage <= 30) {
                staminaColor = 'linear-gradient(90deg, #FF9800, #FF5722)'; // Orange
            } else if (staminaPercentage <= 60) {
                staminaColor = 'linear-gradient(90deg, #CDDC39, #FFC107)'; // Yellow-Lime
            }
            
            // Apply color to pseudo-element
            this.staminaBar.style.setProperty('--stamina-color', staminaColor);
        }
    }

    updateAmmoCounter(currentAmmo, maxAmmo) {
        if (this.ammoCounter) {
            // Show special message if out of ammo
            if (currentAmmo <= 0) {
                this.showOutOfAmmoWarning();
                return;
            }
            
            this.ammoCounter.textContent = `${currentAmmo} / ${maxAmmo}`;
            
            // Add low-ammo warning effect
            if (currentAmmo < maxAmmo * 0.25) {
                this.ammoCounter.classList.add('low-ammo');
            } else {
                this.ammoCounter.classList.remove('low-ammo');
                this.ammoCounter.classList.remove('out-of-ammo');
            }
        }
    }
    
    showOutOfAmmoWarning() {
        if (this.ammoCounter) {
            // Clear existing classes
            this.ammoCounter.classList.remove('low-ammo');
            this.ammoCounter.classList.remove('reloading');
            
            // Add out-of-ammo class
            this.ammoCounter.classList.add('out-of-ammo');
            
            // Display message
            this.ammoCounter.textContent = 'OUT OF AMMO - PRESS R TO RELOAD';
            
            // Add pulsing animation effect
            if (!this._pulseInterval) {
                let opacity = 1;
                let increasing = false;
                
                this._pulseInterval = setInterval(() => {
                    // Only continue if the element still has the out-of-ammo class
                    if (!this.ammoCounter.classList.contains('out-of-ammo')) {
                        clearInterval(this._pulseInterval);
                        this._pulseInterval = null;
                        return;
                    }
                    
                    // Pulse opacity between 0.5 and 1
                    if (increasing) {
                        opacity += 0.05;
                        if (opacity >= 1) {
                            opacity = 1;
                            increasing = false;
                        }
                    } else {
                        opacity -= 0.05;
                        if (opacity <= 0.5) {
                            opacity = 0.5;
                            increasing = true;
                        }
                    }
                    
                    this.ammoCounter.style.opacity = opacity;
                }, 50);
            }
        }
    }
    
    showReloadIndicator(reloadTime) {
        if (this.ammoCounter) {
            // Clear existing classes and intervals
            this.ammoCounter.classList.remove('low-ammo');
            this.ammoCounter.classList.remove('out-of-ammo');
            if (this._pulseInterval) {
                clearInterval(this._pulseInterval);
                this._pulseInterval = null;
            }
            
            // Add reloading class for styling
            this.ammoCounter.classList.add('reloading');
            this.ammoCounter.textContent = 'RELOADING...';
            
            // Add a progress animation
            this.ammoCounter.style.setProperty('--reload-time', `${reloadTime}ms`);
            this.ammoCounter.style.animationDuration = `${reloadTime}ms`;
            
            // Create and add a reload progress animation
            const progressPercent = document.createElement('span');
            progressPercent.classList.add('reload-percent');
            progressPercent.style.opacity = '0';
            this.ammoCounter.appendChild(progressPercent);
            
            // Animate the progress percentage
            let startTime = performance.now();
            let animFrame;
            
            const updateProgress = (timestamp) => {
                const elapsed = timestamp - startTime;
                const percent = Math.min(Math.floor((elapsed / reloadTime) * 100), 100);
                
                // Update the percentage text
                if (percent < 100) {
                    progressPercent.style.opacity = '1';
                    progressPercent.textContent = ` ${percent}%`;
                    animFrame = requestAnimationFrame(updateProgress);
                } else {
                    progressPercent.textContent = ' 100%';
                    setTimeout(() => {
                        progressPercent.style.opacity = '0';
                    }, 200);
                }
            };
            
            animFrame = requestAnimationFrame(updateProgress);
            
            // Store animation frame ID for cleanup
            this._reloadAnimFrame = animFrame;
        }
    }
    
    hideReloadIndicator() {
        if (this.ammoCounter) {
            // Remove reloading class
            this.ammoCounter.classList.remove('reloading');
            this.ammoCounter.classList.remove('out-of-ammo');
            
            // Cancel animation frame if it exists
            if (this._reloadAnimFrame) {
                cancelAnimationFrame(this._reloadAnimFrame);
                this._reloadAnimFrame = null;
            }
            
            // Cancel any pulse interval
            if (this._pulseInterval) {
                clearInterval(this._pulseInterval);
                this._pulseInterval = null;
            }
            
            // Remove any added elements
            const progressPercent = this.ammoCounter.querySelector('.reload-percent');
            if (progressPercent) {
                this.ammoCounter.removeChild(progressPercent);
            }
            
            // Add a brief "READY!" message
            this.ammoCounter.textContent = 'READY!';
            this.ammoCounter.classList.add('ready');
            
            // Update ammo counter with the new full ammo value after a short delay
            setTimeout(() => {
                this.ammoCounter.classList.remove('ready');
                if (this.game.weapon) {
                    this.updateAmmoCounter(this.game.weapon.ammo, this.game.weapon.maxAmmo);
                }
            }, 800);
        }
    }

    updateScore(waveState) {
        if (this.waveInfo && this.scoreInfo) {
            // Update wave info with better formatting
            let waveText = `WAVE ${waveState.wave}`;
            if (waveState.state !== 'ACTIVE') {
                waveText += ` - ${waveState.state}`;
            }
            waveText += ` - Enemies: ${waveState.enemiesKilled}/${waveState.enemiesRequired}`;
            this.waveInfo.textContent = waveText;

            // Update score info with formatted elements and classes
            this.scoreInfo.innerHTML = 
                `Score: <span class="multiplier">${waveState.score}</span> (Total: <span class="multiplier">${waveState.totalScore}</span>) `+
                `<br>Multiplier: <span class="multiplier">${waveState.multiplier.toFixed(2)}x</span> | `+
                `Accuracy: <span class="bonus">${waveState.accuracy}%</span>`+
                `<br>Bonuses: Time <span class="bonus">${waveState.timeBonus.toFixed(2)}x</span> | `+
                `Accuracy <span class="bonus">${waveState.accuracyBonus.toFixed(2)}x</span>`;
        }
    }

    update() {
        // Update player-related UI
        if (this.game.player) {
            this.updateHealthBar(this.game.player.getHealth(), this.game.player.getMaxHealth());
            this.updateStaminaBar(this.game.player.getStamina(), this.game.player.getMaxStamina());
        }

        // Update weapon-related UI
        if (this.game.weapon) {
            this.updateAmmoCounter(this.game.weapon.ammo, this.game.weapon.maxAmmo);
        }

        // Update wave and score info
        if (this.game.waveSystem) {
            this.updateScore(this.game.waveSystem.getCurrentState());
        }
    }

    reset() {
        debug('Resetting UI');
        
        // Hide all screens
        this.hideAllMenus();
        this.hideGameplayUI();
        
        // Reset UI state
        if (this.healthBar) {
            this.updateHealthBar(100, 100);
        }
        
        if (this.staminaBar) {
            this.updateStaminaBar(100, 100);
        }
        
        if (this.ammoCounter) {
            this.updateAmmoCounter(30, 30);
            this.ammoCounter.classList.remove('low-ammo', 'out-of-ammo', 'reloading');
        }
        
        if (this.crosshair) {
            this.crosshair.classList.remove('hit', 'kill');
        }
        
        if (this.waveInfo) {
            this.waveInfo.textContent = 'WAVE 1';
        }
        
        if (this.scoreInfo) {
            const scoreDisplay = this.scoreInfo.querySelector('.multiplier');
            if (scoreDisplay) scoreDisplay.textContent = '0';
            
            const multiplierDisplay = this.scoreInfo.querySelector('.multiplier:nth-child(2)');
            if (multiplierDisplay) multiplierDisplay.textContent = '1.0x';
            
            const accuracyDisplay = this.scoreInfo.querySelector('.bonus');
            if (accuracyDisplay) accuracyDisplay.textContent = '100%';
        }
        
        debug('UI reset complete');
    }

    showMonsterInfoScreen() {
        this.lastMenu = null;
        if (this.mainMenu && this.mainMenu.style.display !== 'none') {
            this.lastMenu = 'mainMenu';
        } else if (this.pauseMenu && this.pauseMenu.style.display !== 'none') {
            this.lastMenu = 'pauseMenu';
        }
        this.hideAllMenus();
        this.monsterInfoScreen.style.display = 'flex';
        // Set up the back button handler every time the screen is shown
        const backBtn = document.getElementById('monsterInfoBackButton');
        if (backBtn) {
            backBtn.onclick = () => {
                this.hideMonsterInfoScreen();
            };
        }
    }

    hideMonsterInfoScreen() {
        this.monsterInfoScreen.style.display = 'none';
        if (this.lastMenu === 'mainMenu') {
            this.showMainMenu();
        } else if (this.lastMenu === 'pauseMenu') {
            this.showPauseMenu();
        }
        this.lastMenu = null;
    }
}

export default UI; 