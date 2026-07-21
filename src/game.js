import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';
import Player from './player.js';
import Enemy from './enemy.js';
import Weapon from './weapon.js';
import UI from './ui.js';
import Wave from './wave.js';
import EnemyManager from './enemyManager.js';
import Environment from './environment.js';
import Input from './input.js';
import GAME_STATES from './gameStates.js';
import Settings from './settings.js';

// Debug mode flag
const DEBUG = process.env.NODE_ENV === 'development';

// Debugging utility
function debug(...args) {
    if (DEBUG) {
        console.log('[GameEngine]', ...args);
    }
}

function debugError(...args) {
    if (DEBUG) {
        console.error('[GameEngine Error]', ...args);
    }
}

class GameEngine {
    constructor() {
        try {
            debug('Initializing GameEngine...');
            
            // Make game engine accessible globally
            window.gameEngine = this;
            
            // Initialize global flags
            window.isBugReportOpen = false;
            window.isInSettingsMenu = false;
            
            // Initialize core components
            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            
            // Try to use WebGPU renderer with fallback to WebGL
            try {
                this.renderer = new THREE.WebGPURenderer({ 
                    antialias: true,
                    powerPreference: "high-performance",
                    samples: 4,
                    trackTimestamp: false
                });
                console.log('Using WebGPU renderer with optimizations');
            } catch (error) {
                console.warn('WebGPU not supported, falling back to WebGL:', error);
                // Fall back to WebGL renderer if WebGPU is not supported
                this.renderer = new THREE.WebGLRenderer({ 
                    antialias: true,
                    powerPreference: "high-performance",
                    precision: "highp"
                });
                console.log('Using WebGL renderer');
            }
            
            this.renderScale = 1;
            this.maxPixelRatio = 2;
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.4;
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.maxPixelRatio) * this.renderScale);
            document.body.appendChild(this.renderer.domElement);
            
            // Set initial camera position
            this.camera.position.set(0, 1.7, 0);
            this.camera.lookAt(0, 1.7, -1);
            
            // Initialize game state
            this.state = GAME_STATES.MAIN_MENU;
            debug('State: MAIN_MENU');
            this.isRunning = false;
            this.isPaused = false;
            this.lastTime = 0;
            this._hasHadPointerLock = false;
            this._lastLockRequestTime = 0;
            this.deltaTime = 0;
            
            // Initialize Input system
            this.input = Input;
            this.input.init();
            
            // Initialize components as null
            this.player = null;
            this.enemyManager = null;
            this.weapon = null;
            this.ui = null;
            this.waveSystem = null;
            this.environment = null;
            
            // FPS limiting properties
            this.useFrameRateLimit = false;
            this.fpsLimit = 0;
            this.frameTimeLimit = 0;
            this.lastFrameTime = 0;
            
            // Screen shake parameters
            this.screenShake = {
                intensity: 0,
                duration: 0,
                startTime: 0,
                isShaking: false,
                originalCameraPosition: new THREE.Vector3(),
                currentOffset: new THREE.Vector3()
            };
            
            // Setup input system
            this.setupInput();
            
            // Create game components
            this.setupGameComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Handle window resize
            window.addEventListener('resize', () => {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.maxPixelRatio) * this.renderScale);
            });
            
            // Freecam parameters
            this.freecamEnabled = false;
            this.freecamYaw = new THREE.Object3D();
            this.freecamPitch = new THREE.Object3D();
            this.freecamYaw.add(this.freecamPitch);
            this.scene.add(this.freecamYaw);
            this._freecamPointerLockHandler = (e) => {
                if (this.freecamEnabled && document.pointerLockElement === document.body) {
                    this.freecamYaw.rotation.y -= e.movementX * 0.002;
                    this.freecamPitch.rotation.x -= e.movementY * 0.002;
                    this.freecamPitch.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.freecamPitch.rotation.x));
                }
            };
            
            this.weaponMaxAmmo = 30; // Persistent max ammo for weapon
            this._renderInProgress = false;
            
            debug('GameEngine initialization complete');
        } catch (error) {
            debugError('Error in GameEngine constructor:', error);
            throw error;
        }
    }

    setupGameComponents() {
        try {
            debug('Setting up game components...');
            
            // Create environment first
            this.environment = new Environment(this.scene);
            debug('Environment created');
            
            // Make sure camera is part of the scene
            if (!this.scene.children.includes(this.camera)) {
                this.scene.add(this.camera);
            }
            
            // Create player with camera reference
            this.player = new Player(this.scene, this.camera);
            debug('Player created');
            
            // Create enemy manager with environment reference
            this.enemyManager = new EnemyManager(this.scene, this.environment);
            debug('Enemy manager created');
            
            // Create weapon with camera reference and persistent max ammo
            this.weapon = new Weapon(this.scene, this.camera, this.weaponMaxAmmo);
            this.player.setFirstPersonWeaponModel(this.weapon.model);
            debug('Weapon created');
            
            // Create UI last
            this.ui = new UI(this);
            debug('UI created');

            // Initialize wave system with enemy manager
            this.waveSystem = new Wave(this.enemyManager);
            debug('Wave system created');
            
            // Initialize settings
            this.settings = new Settings(this, this.ui);
            debug('Settings created');
            
            // Apply settings
            if (this.settings) {
                this.settings.applyAllSettings();
            }
            
            // Make sure game engine is accessible globally
            window.gameEngine = this;
            
            debug('Game components setup complete');
        } catch (error) {
            debugError('Error in setupGameComponents:', error);
            throw error;
        }
    }

    setupEventListeners() {
        try {
            debug('Setting up event listeners...');

            // Single centralized pointer lock handler
            let _lastLockTime = 0;
            document.addEventListener('pointerlockchange', () => {
                const isLocked = document.pointerLockElement === document.body;
                const now = performance.now();
                debug('Pointer lock:', isLocked ? 'locked' : 'unlocked');

                if (isLocked) {
                    _lastLockTime = now;
                    this._hasHadPointerLock = true;
                    if (this.isPaused) {
                        debug('Auto-resuming game due to pointer lock');
                        this.resumeGame();
                    }
                } else {
                    // Debounce: ignore unlock if a lock just happened within 300ms.
                    // Prevents auto-pause when browser briefly rejects pointer lock.
                    if (now - _lastLockTime < 300) {
                        debug('Ignoring rapid unlock after lock');
                        return;
                    }
                    // Ignore unlock if it follows a failed lock request within 500ms.
                    // Fixes resume-button → rejected request → auto-pause loop.
                    if (this._lastLockRequestTime && now - this._lastLockRequestTime < 500) {
                        debug('Ignoring unlock after rejected lock request');
                        this._lastLockRequestTime = 0;
                        return;
                    }
                    // Skip auto-pause during first 2s after game start, or if never locked
                    if (this.state === GAME_STATES.PLAYING && !this.isPaused
                        && !window.isInSettingsMenu && !window.isConsoleOpen
                        && this._hasHadPointerLock
                        && (now - (this._gameStartTime || 0)) > 2000) {
                        debug('Auto-pausing due to pointer unlock');
                        this.pauseGame();
                    }
                }
            });

            // Handle escape key globally
            // Using a separate event listener to ensure it's always captured
            document.addEventListener('keydown', (event) => {
                // Only handle Escape key when game is actively playing (not already paused)
                if (event.key === 'Escape' && this.state === GAME_STATES.PLAYING && !this.isPaused) {
                    event.preventDefault();
                    debug('ESC key pressed - pausing game');
                    this.pauseGame();
                }
            }, true);

            debug('Event listeners setup complete');
        } catch (error) {
            debugError('Error in setupEventListeners:', error);
            throw error;
        }
    }

    startGame() {
        try {
            debug('Starting game...');
            debug('Current state before starting:', this.state, 'isRunning:', this.isRunning);
            
            // Track game start time and lock state for auto-pause guards
            this._gameStartTime = performance.now();
            this._hasHadPointerLock = false;
            
            // Cancel any existing animation frames
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            
            // Make scene visible again if it was hidden
            this.scene.visible = true;
            
            // Hide the black overlay if it exists
            if (this.ui && this.ui.blackOverlay) {
                this.ui.hideBlackOverlay();
            }
            
            // Ensure we're in the correct state
            this.state = GAME_STATES.PLAYING; debug('State: PLAYING');
            this.isRunning = true;
            this.isPaused = false;
            
            // Reset input system
            this.input.reset();
            
            // Clean up the scene
            this.cleanup();
            
            // Reset all components
            debug('Resetting game components');
            
            // Reset environment first (needed by other components)
            if (this.environment) {
                debug('Resetting environment');
                this.environment.reset();
            }
            
            // Reset remaining components
            if (this.enemyManager) {
                debug('Resetting enemy manager');
                this.enemyManager.reset();
            }
            
            if (this.player) {
                debug('Resetting player');
                this.player.reset();
            }
            
            if (this.weapon) {
                debug('Resetting weapon');
                this.weapon.reset();
            }
            
            if (this.waveSystem) {
                debug('Resetting wave system');
                this.waveSystem.reset();
            }
            
            // Update UI
            if (this.ui) {
                debug('Updating UI');
                this.ui.reset();
                this.ui.hideAllMenus();
                this.ui.showGameplayUI();
                this.ui.updateHealthBar(this.player.health, this.player.maxHealth);
                this.ui.updateAmmoCounter(this.weapon.ammo, this.weapon.maxAmmo);
            }
            
            // Start wave system
            debug('Starting wave system');
            if (this.waveSystem) {
                this.waveSystem.startWave();
            }
            
            // Start game loop
            this.lastTime = performance.now() / 1000;
            debug('Starting game loop');
            this.animationFrameId = requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
            
            debug('Game started successfully');
        } catch (error) {
            debugError('Error starting game:', error);
            console.error(error);
        }
    }

    cleanup() {
        debug('Cleaning up scene');
        
        // First, remove all objects that have specific cleanup handlers
        if (this.environment) {
            debug('Cleaning up environment objects');
            this.environment.reset();
        }
        
        // More thorough scene cleaning for remaining objects
        const objectsToRemove = [];
        
        this.scene.traverse(object => {
            // Skip objects that are already handled by environment reset
            if (object.userData && object.userData.isEnvironment) {
                return;
            }
            
            // Remove lights, enemies, and any non-essential objects
            if (object.isLight || 
                object.userData.type === 'enemy' || 
                object.userData.temporary === true ||
                (object.isMesh && !object.userData.isPlayer && !object.userData.isWeapon)) {
                objectsToRemove.push(object);
            }
        });
        
        debug(`Removing ${objectsToRemove.length} additional objects from scene`);
        objectsToRemove.forEach(object => {
            this.scene.remove(object);
            // Dispose geometries and materials
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
        
        // Clear any pending animation frames
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Force garbage collection if available
        if (window.gc) {
            try {
                window.gc();
                debug('Forced garbage collection');
            } catch (e) {
                // Ignore if not available
            }
        }
        
        debug('Scene cleanup complete');
    }

    gameLoop(currentTime) {
        try {
            // Check if the game is ready to run
            if (!this.isRunning || this.state !== GAME_STATES.PLAYING) {
                debug('Game loop stopped - game state:', this.state, 'isRunning:', this.isRunning);
                this.animationFrameId = null;
                return;
            }
            
            // Convert to seconds
            currentTime *= 0.001;
            
            // Calculate delta time
            this.deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;
            
            // Prevent large time jumps (e.g. when tab is inactive)
            if (this.deltaTime > 0.1) {
                debug('Large delta time detected:', this.deltaTime, 'clamping to 0.1');
                this.deltaTime = 0.1;
            }
            
            // Apply FPS limiting if enabled, but don't use fixed delta time
            // which can cause slow motion effects
            if (this.useFrameRateLimit && this.fpsLimit > 0) {
                const now = performance.now();
                const elapsed = now - this.lastFrameTime;
                
                if (elapsed < this.frameTimeLimit) {
                    // Skip this frame to maintain the desired frame rate
                    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
                    return;
                }
                
                // Update last frame time
                this.lastFrameTime = now;
                
                // DO NOT use fixed delta time as it causes slow motion
                // Instead, use the actual measured delta time which keeps game speed consistent
            }
            
            // Skip update if game is paused
            if (this.isPaused) {
                this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
                return;
            }
            
            // Update game state
            this.update(this.deltaTime);
            
            // Render the scene without allowing overlapping async renders
            if (!this._renderInProgress) {
                this._renderInProgress = true;
                this.render()
                    .catch(error => {
                        debugError('Render error:', error);
                    })
                    .finally(() => {
                        this._renderInProgress = false;
                    });
            }
            
            // Continue the game loop
            this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
        } catch (error) {
            debugError('Error in game loop:', error);
            console.error(error);
            
            // Always try to recover the game loop if possible
            if (this.isRunning && this.state === GAME_STATES.PLAYING) {
                debug('Attempting to recover from game loop error');
                this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
            } else {
                this.pauseGame();
            }
        }
    }

    update(deltaTime) {
        if (this.freecamEnabled) {
            const speed = this.input.isKeyPressed('shift') ? 12 : 6;
            const move = new THREE.Vector3();
            if (this.input.isKeyPressed('w')) move.z -= 1;
            if (this.input.isKeyPressed('s')) move.z += 1;
            if (this.input.isKeyPressed('a')) move.x -= 1;
            if (this.input.isKeyPressed('d')) move.x += 1;
            if (this.input.isKeyPressed(' ')) move.y += 1;
            if (this.input.isKeyPressed('q')) move.y -= 1;

            if (move.lengthSq() > 0) {
                move.normalize().multiplyScalar(speed * deltaTime);
                // Transform local movement to world space
                this.freecamYaw.position.add(this.freecamYaw.localToWorld(move).sub(this.freecamYaw.position));
            }

            // No need to update camera position/rotation directly; it's attached to the pitch object
            return;
        }
        if (this.state !== GAME_STATES.PLAYING || !this.player || !this.weapon) return;

        try {
            // Check if player is dead
            if (this.player.health <= 0 || this.player.isDead) {
                this.gameOver();
                return;
            }
            
            // Update input first
            this.input.update();

            // Update player movement and camera
            this.player.update(deltaTime, this.input, this.environment);
            // Update power-ups
            if (this.environment && this.player) {
                this.environment.updatePowerUps(this.player, deltaTime);
            }
            // Show animated boundary ring if near the edge
            if (this.environment && this.player) {
                this.environment.updateBoundaryRing(this.player.position, deltaTime);
                // Update animated barrier wall with player position
                this.environment.updateAnimatedBarrierWall(deltaTime, this.player.position);
            }

            // Update foot lights based on darkness
            if (this.environment && this.environment.dayNightCycle) {
                const darkness = this.environment.dayNightCycle.getDarkness();
                const intensity = darkness * darkness * 3;
                if (this.player) {
                    this.player.setFootLightIntensity(intensity);
                }
                if (this.enemyManager) {
                    for (const enemy of this.enemyManager.enemies) {
                        if (enemy && enemy.isAlive) {
                            enemy.setFootLightIntensity(intensity);
                        }
                    }
                }
            }

            // Handle shooting
            if (this.input.isMouseButtonPressed('left') && document.pointerLockElement === document.body) {
                const shotResult = this.weapon.shoot(this.enemyManager);
                if (shotResult && shotResult.fired) {
                    this.onShotFired();
                }
            }

            // Handle reloading
            if (this.input.isKeyPressed('r')) {
                this.weapon.reload();
            }
            
            // Update weapon with player velocity
            this.weapon.update(deltaTime, this.player.velocity);

            // Update enemies with player reference
            if (this.enemyManager) {
                this.enemyManager.update(deltaTime);
            }

            // Update wave system
            if (this.waveSystem) {
                this.waveSystem.update(deltaTime);
            }

            // Update UI
            if (this.ui) {
                this.ui.update();
            }

            // Update screen shake
            this.updateScreenShake(deltaTime);
        } catch (error) {
            debugError('Error in update:', error);
            throw error;
        }
    }

    async render() {
        try {
            if (this.scene && this.camera) {
                if (this.renderer.isWebGPURenderer) {
                    // Use async methods for WebGPU renderer
                    try {
                        await this.renderer.renderAsync(this.scene, this.camera);
                    } catch (webgpuError) {
                        // If async operations fail, fall back to synchronous (in case backend isn't fully ready)
                        debug('WebGPU async render failed, falling back to sync:', webgpuError);
                        this.renderer.render(this.scene, this.camera);
                    }
                } else {
                    // Use synchronous methods for WebGL renderer
                    this.renderer.render(this.scene, this.camera);
                }
                
                // Performance monitoring
                if (this.renderer.isWebGPURenderer && DEBUG) {
                    if (this._frameCount === undefined) {
                        this._frameCount = 0;
                        this._lastPerfLog = performance.now();
                    }
                    
                    this._frameCount++;
                    
                    // Log performance data every 100 frames
                    if (this._frameCount >= 100) {
                        const now = performance.now();
                        const elapsed = now - this._lastPerfLog;
                        const fps = Math.round((this._frameCount / elapsed) * 1000);
                        debug(`Performance: ${fps} FPS`);
                        this._frameCount = 0;
                        this._lastPerfLog = now;
                    }
                }
            }
        } catch (error) {
            debugError('Error in render:', error);
            throw error;
        }
    }
    
    // Simplified performance monitoring (no quality adjustment)
    monitorPerformance() {
        if (DEBUG) {
            if (this._frameCount === undefined) {
                this._frameCount = 0;
                this._lastPerfLog = performance.now();
            }
            
            this._frameCount++;
            
            // Log FPS every 100 frames
            if (this._frameCount >= 100) {
                const now = performance.now();
                const elapsed = now - this._lastPerfLog;
                const fps = Math.round((this._frameCount / elapsed) * 1000);
                
                debug(`Performance: ${fps} FPS`);
                debug(`Rendered objects: ${this.getVisibleObjectCount()}`);
                
                this._frameCount = 0;
                this._lastPerfLog = now;
            }
        }
    }
    
    // Helper method to count visible objects
    getVisibleObjectCount() {
        let count = 0;
        this.scene.traverse(object => {
            if (object.isMesh && object.visible) count++;
        });
        return count;
    }

    pauseGame() {
        if (this.state !== GAME_STATES.PLAYING) return;
        if (this.isPaused) return;

        debug('Pausing game');
        this.isPaused = true;
        // Don't change state to PAUSED — keep it PLAYING so the game loop continues running.
        // The loop checks isPaused to skip updates; if state changes the loop stops entirely.

        if (!window.isInSettingsMenu && document.pointerLockElement === document.body) {
            document.exitPointerLock();
        }

        this.stopScreenShake();

        if (this.ui && !window.isConsoleOpen && !window.isInSettingsMenu) {
            this.ui.showPauseMenu();
        }

        if (this.player) {
            this.player.setPaused(true);
        }
    }

    resumeGame() {
        if (!this.isPaused) return;

        debug('Resuming game');
        this.isPaused = false;
        this.state = GAME_STATES.PLAYING; debug('State: PLAYING');

        if (this.ui) {
            this.ui.hideAllMenus();
            this.ui.showGameplayUI();
        }

        // Must be called synchronously within user gesture
        if (document.pointerLockElement !== document.body) {
            debug('Requesting pointer lock on resume');
            this._lastLockRequestTime = performance.now();
            document.body.requestPointerLock();
        }

        if (this.player) {
            this.player.setPaused(false);
        }
    }

    togglePause() {
        debug('Toggle pause:', this.isPaused ? 'paused→resume' : 'playing→pause');
        if (this.isPaused) {
            this.resumeGame();
        } else {
            this.pauseGame();
        }
    }

    quitToMenu() {
        debug('Quitting to menu');
        
        // First show black overlay
        if (this.ui) {
            this.ui.showBlackOverlay(() => {
                // This runs after fade to black completes
                this.state = GAME_STATES.MAIN_MENU; debug('State: MAIN_MENU');
                this.isRunning = false;
                this.isPaused = false;
                
                // Reset game state
                this.environment.reset();
                this.enemyManager.reset();
                this.player.reset();
                this.weapon.reset();
                
                this.stopScreenShake();

                // Hide the scene completely - we'll keep the black overlay
                this.scene.visible = false;
                
                // Update UI
                this.ui.hideAllMenus();
                this.ui.hideGameplayUI();
                this.ui.showMainMenu();
                
                // Keep overlay completely opaque (pitch black)
                if (this.ui.blackOverlay) {
                    this.ui.blackOverlay.style.opacity = '1.0';
                }
                
                // Exit pointer lock
                if (document.pointerLockElement === document.body) {
                    document.exitPointerLock();
                }
            });
        }
    }

    gameOver() {
        if (this.state === GAME_STATES.GAME_OVER) return;
        
        try {
            debug('Game over triggered');
            this.state = GAME_STATES.GAME_OVER; debug('State: GAME_OVER');
            this.isPaused = true;
            this.isRunning = false;
            
            // Check if game over is due to player death or wave completion
            const isWaveCompletion = this.waveSystem && this.waveSystem.wave >= this.waveSystem.maxWave;
            
            this.stopScreenShake();

            // Show appropriate game over screen
            if (isWaveCompletion) {
                this.ui.showGameCompletionScreen();
            } else {
                this.ui.showGameOverScreen();
            }
            
            // Release pointer lock
            if (document.pointerLockElement === document.body) {
                document.exitPointerLock();
            }
        } catch (error) {
            debugError('Error in gameOver:', error);
        }
    }

    quitGame() {
        debug('Quitting game');
        this.isRunning = false;
        try {
            const electron = require('electron');
            if (electron && electron.ipcRenderer) {
                electron.ipcRenderer.send('quit-game');
            }
        } catch (error) {
            debugError('Error quitting game:', error);
            window.close();
        }
    }

    spawnEnemy(type, position = null) {
        if (!this.enemyManager || !type) return null;

        try {
            return this.enemyManager.spawnEnemy(type, position);
        } catch (error) {
            console.error('Error spawning enemy:', error);
            return null;
        }
    }

    onEnemyKilled(enemy, isHeadshot) {
        if (!enemy || !enemy.type) {
            console.warn('Invalid enemy object in onEnemyKilled');
            return;
        }

        // Update wave system
        const points = this.waveSystem.onEnemyKill(enemy.type, isHeadshot);
        
        // Update UI with points
        if (this.ui) {
            this.ui.updateScore(this.waveSystem.getCurrentState());
        }
    }

    onShotFired() {
        if (this.waveSystem) {
            this.waveSystem.onShotFired();
            debug('Shot fired registered with wave system');
        }
    }

    onShotHit() {
        if (this.waveSystem) {
            this.waveSystem.onShotHit();
            debug('Shot hit registered with wave system');
        }
    }

    reset() {
        debug('Resetting game state');
        
        // Cancel any ongoing animations first
        if (this.animationFrameId) {
            debug('Canceling animation frame:', this.animationFrameId);
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this._renderInProgress = false;
        
        // Reset game state flags
        const oldState = this.state;
        this.state = GAME_STATES.MAIN_MENU; debug('State: MAIN_MENU'); // Will be changed to PLAYING when startGame is called
        this.isRunning = false;
        this.isPaused = false;
        this.lastTime = 0;
        this.deltaTime = 0;
        debug(`Reset state transition: ${oldState} -> ${this.state}`);
        
        // Clear the scene first to remove all objects
        this.cleanup();

        // Reset components in the correct order
        if (this.environment) {
            debug('Resetting environment');
            this.environment.reset();
        }
        
        if (this.enemyManager) {
            debug('Resetting enemy manager');
            this.enemyManager.reset();
        }
        
        if (this.player) {
            debug('Resetting player');
            this.player.reset();
        }
        
        if (this.weapon) {
            debug('Resetting weapon');
            this.weapon.reset();
        }
        
        if (this.waveSystem) {
            debug('Resetting wave system');
            this.waveSystem.reset();
        }
        
        if (this.ui) {
            debug('Resetting UI');
            this.ui.reset();
        }
        
        // Reset screen shake
        this.screenShake.intensity = 0;
        this.screenShake.duration = 0;
        this.screenShake.isShaking = false;
        if (this.screenShake.originalCameraPosition) {
            this.camera.position.copy(this.screenShake.originalCameraPosition);
        }
        
        // Reset input system
        if (this.input) {
            debug('Resetting input system');
            this.input.reset();
        }
        
        this._hasHadPointerLock = false;
        
        // Clear THREE.js cache to prevent memory leaks
        if (THREE && THREE.Cache) {
            THREE.Cache.clear();
            debug('Cleared THREE.js cache');
        }

        debug('Game state reset complete - ready for restart');
    }

    applyScreenShake(intensity, duration) {
        if (this.screenShake.isShaking) {
            // If already shaking, only update if new shake is stronger
            if (intensity > this.screenShake.intensity) {
                this.screenShake.intensity = intensity;
                this.screenShake.duration = duration;
                this.screenShake.startTime = performance.now();
            }
        } else {
            this.screenShake.intensity = intensity;
            this.screenShake.duration = duration;
            this.screenShake.startTime = performance.now();
            this.screenShake.isShaking = true;
            this.screenShake.originalCameraPosition.copy(this.camera.position);
        }
    }

    updateScreenShake(deltaTime) {
        if (!this.screenShake.isShaking) return;

        const elapsed = performance.now() - this.screenShake.startTime;
        const progress = elapsed / this.screenShake.duration;

        if (progress >= 1) {
            this.stopScreenShake();
            return;
        }

        // Calculate dampening factor (ease out)
        const dampening = 1 - progress * progress;

        // Generate random offset
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ).multiplyScalar(this.screenShake.intensity * dampening);

        // Apply offset to camera
        this.camera.position.copy(this.screenShake.originalCameraPosition).add(offset);
    }

    stopScreenShake() {
        if (this.screenShake.originalCameraPosition) {
            this.camera.position.copy(this.screenShake.originalCameraPosition);
        }
        this.screenShake.intensity = 0;
        this.screenShake.duration = 0;
        this.screenShake.isShaking = false;
    }

    onWindowResize() {
        if (this.camera) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        }
        
        if (this.renderer) {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    setupInput() {
        // Setup keyboard events
        document.addEventListener('keydown', (event) => {
            this.input.handleKeyDown(event);
        });
        
        document.addEventListener('keyup', (event) => {
            this.input.handleKeyUp(event);
        });
        
        // Setup mouse events - note that player handles its own mouse move for camera rotation
        document.addEventListener('mousedown', (event) => {
            this.input.handleMouseDown(event);
        });
        
        document.addEventListener('mouseup', (event) => {
            this.input.handleMouseUp(event);
        });
        
        // The Input module already has its own listener for mousemove
        // So we don't need to call any method here
        document.addEventListener('mousemove', (event) => {
            // Mouse movement is already handled by Input's own listener
            // Remove this.input.handleMouseMove(event) as it doesn't exist
        });
        
        // Prevent context menu on right-click
        document.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
        
        // Handle canvas resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    toggleFreecam() {
        this.freecamEnabled = !this.freecamEnabled;
        if (this.freecamEnabled) {
            // Set yaw and pitch to current camera state
            this.freecamYaw.position.copy(this.camera.position);
            this.freecamYaw.rotation.set(0, this.camera.rotation.y, 0);
            this.freecamPitch.rotation.set(this.camera.rotation.x, 0, 0);
            this.freecamPitch.add(this.camera);
            // Request pointer lock for freecam mouse look
            document.body.requestPointerLock();
            window.addEventListener('mousemove', this._freecamPointerLockHandler);
        } else {
            // Detach camera from pitch and restore to scene
            this.scene.add(this.camera);
            if (this.player) {
                this.player.updateCameraPosition();
            }
            // Exit pointer lock if in freecam
            if (document.pointerLockElement === document.body) {
                document.exitPointerLock();
            }
            window.removeEventListener('mousemove', this._freecamPointerLockHandler);
        }
    }

    showMainMenu() {
        this.state = GAME_STATES.MAIN_MENU; debug('State: MAIN_MENU');
        
        // Hide the scene when showing main menu
        this.scene.visible = false;
        
        // Show black overlay with the menu
        if (this.ui.blackOverlay) {
            this.ui.showBlackOverlay();
                         // Make it more transparent so we can see the menu clearly
             setTimeout(() => {
                 if (this.ui.blackOverlay) {
                     this.ui.blackOverlay.style.opacity = '0.8';
                 }
             }, 100);
        }
        
        this.ui.showMainMenu();
    }
}

function initGame() {
    try {
        const gameEngine = new GameEngine();
        
        // Hide scene immediately before showing main menu
        gameEngine.scene.visible = false;
        
        gameEngine.showMainMenu();

        // For Electron, make the engine accessible globally
        if (typeof window !== 'undefined') {
            window.gameEngine = gameEngine;
        }

        return gameEngine;
    } catch (error) {
        console.error('Failed to initialize game:', error);
        throw error;
    }
}

// Export the GameEngine class and initGame function
export default GameEngine;
export { initGame }; 