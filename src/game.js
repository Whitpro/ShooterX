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
            
            // Initialize core components
            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            
            // Try to use WebGPU renderer with fallback to WebGL
            try {
                this.renderer = new THREE.WebGPURenderer({ 
                    antialias: true,
                    powerPreference: "high-performance",
                    // WebGPU-specific optimizations
                    samples: 4, // MSAA for improved quality
                    trackTimestamp: false, // Disable timing queries to prevent "Maximum number of queries exceeded" error
                    colorBufferType: THREE.HalfFloatType // Optimal color buffer format
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
            
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.setPixelRatio(window.devicePixelRatio);
            document.body.appendChild(this.renderer.domElement);
            
            // Set initial camera position
            this.camera.position.set(0, 1.7, 0);
            this.camera.lookAt(0, 1.7, -1);
            
            // Initialize game state
            this.state = GAME_STATES.MAIN_MENU;
            this.isRunning = false;
            this.isPaused = false;
            this.lastTime = 0;
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
            debug('Weapon created');
            
            // Create UI last
            this.ui = new UI(this);
            debug('UI created');

            // Initialize wave system with enemy manager
            this.waveSystem = new Wave(this.enemyManager);
            debug('Wave system created');
            
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

            // Handle pointer lock
            document.addEventListener('pointerlockchange', () => {
                const isLocked = document.pointerLockElement === document.body;
                debug('Pointer lock change detected:', isLocked ? 'locked' : 'unlocked');
                
                // Only process pointer lock events when game is in a stable state
                if (this.state !== GAME_STATES.PLAYING) {
                    debug('Ignoring pointer lock change - game not in playing state');
                    return;
                }
                
                // If we're not running, pointer lock events won't affect game state
                if (!this.isRunning) {
                    debug('Ignoring pointer lock change - game not running');
                    return;
                }
                
                // Handle auto-pause when pointer is unlocked during gameplay
                if (!isLocked && !this.isPaused) {
                    debug('Auto-pausing game due to pointer unlock');
                    this.pauseGame();
                }
                
                // Auto-resume when pointer is locked and game is paused
                if (isLocked && this.isPaused) {
                    debug('Auto-resuming game due to pointer lock');
                    this.resumeGame();
                }
            });

            // Handle escape key globally
            // Using a separate event listener to ensure it's always captured
            document.addEventListener('keydown', (event) => {
                // Only handle Escape key in this listener to avoid conflicts
                if (event.key === 'Escape' && this.state === GAME_STATES.PLAYING) {
                    debug('ESC key pressed - toggling pause state');
                    this.togglePause();
                }
            }, true); // Use capture phase to ensure it gets processed first
            
            // Debug key handler in a separate listener
            window.addEventListener('keydown', (event) => {
                // Debug key to log camera data
                if (event.key === 'F12') {
                    if (this.player && this.camera) {
                        console.log('-------- CAMERA DEBUG --------');
                        console.log('Pitch:', this.player.pitch);
                        console.log('Yaw:', this.player.yaw);
                        console.log('Camera rotation:', this.camera.rotation);
                        console.log('Camera quaternion:', this.camera.quaternion);
                        console.log('Pointer locked:', document.pointerLockElement === document.body);
                    }
                }
            });

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
            this.state = GAME_STATES.PLAYING;
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
            
            // Force enemy spawn
            debug('Spawning initial enemies');
            setTimeout(() => {
                this.spawnEnemies();
            }, 200);
            
            // Start game loop
            this.lastTime = performance.now();
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
        // More thorough scene cleaning
        const objectsToRemove = [];
        
        this.scene.traverse(object => {
            // Remove lights, enemies, and any non-essential objects
            if (object.isLight || 
                object.userData.type === 'enemy' || 
                object.userData.temporary === true) {
                objectsToRemove.push(object);
            }
        });
        
        debug(`Removing ${objectsToRemove.length} objects from scene`);
        objectsToRemove.forEach(object => {
            this.scene.remove(object);
            // Dispose of geometries and materials to free memory
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
        
        debug('Scene cleanup complete');
    }

    gameLoop(currentTime) {
        try {
            // Check if the game is ready to run
            if (!this.isRunning || this.state !== GAME_STATES.PLAYING) {
                debug('Game loop stopped - game state:', this.state, 'isRunning:', this.isRunning);
                return;
            }

            // Calculate delta time
            this.deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap at 0.1s
            this.lastTime = currentTime;

            // Update game if not paused
            if (!this.isPaused) {
                this.update(this.deltaTime);
                
                // Handle rendering - now asynchronous with WebGPU
                this.render().catch(error => {
                    debugError('Render error:', error);
                });
            }

            // Continue the loop
            this.animationFrameId = requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
        } catch (error) {
            debugError('Error in game loop:', error);
            console.error(error);
            
            // Always try to recover the game loop if possible
            if (this.isRunning && this.state === GAME_STATES.PLAYING) {
                debug('Attempting to recover from game loop error');
                this.animationFrameId = requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
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
            
            // Handle shooting
            if (this.input.isMouseButtonPressed('left') && document.pointerLockElement === document.body) {
                if (this.weapon.shoot(this.enemyManager)) {
                    // Shot was fired
                    if (this.waveSystem) {
                        this.waveSystem.onShotFired();
                    }
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
                this.enemyManager.enemies.forEach(enemy => {
                    enemy.update(deltaTime, this.player);
                });
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
                        // Clear previous renders asynchronously
                        await this.renderer.clearAsync();
                        
                        // Render the scene asynchronously
                        await this.renderer.renderAsync(this.scene, this.camera);
                        
                        // Resolve timestamp queries to prevent "Maximum number of queries exceeded" error
                        if (this.renderer.resolveTimestampsAsync) {
                            try {
                                // Use the THREE.TimestampQuery.RENDER constant if available
                                const TimestampQuery = THREE.TimestampQuery || { RENDER: 'render' };
                                await this.renderer.resolveTimestampsAsync(TimestampQuery.RENDER);
                            } catch (timestampError) {
                                // Ignore timestamp resolution errors
                                console.warn('Error resolving WebGPU timestamps:', timestampError);
                            }
                        }
                    } catch (webgpuError) {
                        // If async operations fail, fall back to synchronous (in case backend isn't fully ready)
                        debug('WebGPU async render failed, falling back to sync:', webgpuError);
                        this.renderer.clear();
                        this.renderer.render(this.scene, this.camera);
                    }
                } else {
                    // Use synchronous methods for WebGL renderer
                    this.renderer.clear();
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

    pauseGame() {
        if (this.isPaused) return;
        debug('Pausing game');
        this.isPaused = true;
        // Update player state
        if (this.player) {
            this.player.setPaused(true);
        }
        // Exit pointer lock
        if (document.pointerLockElement === document.body) {
            document.exitPointerLock();
        }
        // Show pause menu only if the console is not open
        if (this.ui && (!this.ui.console || !this.ui.console.isVisible)) {
            this.ui.hideGameplayUI();
            this.ui.showPauseMenu();
        }
    }

    resumeGame() {
        if (!this.isPaused) return;
        
        debug('Resuming game');
        this.isPaused = false;
        
        // Update player state
        if (this.player) {
            this.player.setPaused(false);
        }
        
        // Get pointer lock if needed
        if (document.pointerLockElement !== document.body) {
            document.body.requestPointerLock();
        }
        
        // Update UI
        if (this.ui) {
            this.ui.hideAllMenus();
            this.ui.showGameplayUI();
        }
        
        // Reset timing to prevent large delta time
        this.lastTime = performance.now();
    }

    togglePause() {
        debug('Toggle pause called. Current state:', this.isPaused ? 'paused' : 'playing');
        
        if (this.isPaused) {
            debug('Resuming game from pause');
            this.resumeGame();
        } else {
            debug('Pausing game');
            this.pauseGame();
        }
    }

    quitToMenu() {
        debug('Quitting to menu');
        
        // First show black overlay
        if (this.ui) {
            this.ui.showBlackOverlay(() => {
                // This runs after fade to black completes
                this.state = GAME_STATES.MAIN_MENU;
                this.isRunning = false;
                this.isPaused = false;
                
                // Reset game state
                this.environment.reset();
                this.enemyManager.reset();
                this.player.reset();
                this.weapon.reset();
                
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
        debug('Game over');
        this.state = GAME_STATES.GAME_OVER;
        this.isRunning = false;
        this.isPaused = false;
        
        // Update UI
        this.ui.hideGameplayUI();
        this.ui.showGameOverScreen();
        
        // Exit pointer lock
        if (document.pointerLockElement === document.body) {
            document.exitPointerLock();
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

    spawnEnemies() {
        if (!this.waveSystem || this.waveSystem.state !== 'active') return;

        const enemyConfig = this.waveSystem.getNextEnemy();
        if (!enemyConfig) return;

        // Spawn enemy with config
        const spawnPoint = this.getRandomSpawnPoint();
        if (spawnPoint) {
            this.spawnEnemy(spawnPoint.x, spawnPoint.z, enemyConfig);
        }
        
        // Schedule next spawn
        setTimeout(() => this.spawnEnemies(), this.waveSystem.waveConfig.spawnDelay);
    }

    getRandomSpawnPoint() {
        if (!this.environment) return null;

        const angle = Math.random() * Math.PI * 2;
        const radius = 15 + Math.random() * 5; // Spawn between 15-20 units away
        return {
            x: Math.cos(angle) * radius,
            z: Math.sin(angle) * radius
        };
    }

    spawnEnemy(x, z, config) {
        if (!this.enemyManager || !config) return;

        try {
            this.enemyManager.spawnEnemy(x, z, config);
        } catch (error) {
            console.error('Error spawning enemy:', error);
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
        
        // Reset game state flags
        const oldState = this.state;
        this.state = GAME_STATES.MAIN_MENU; // Will be changed to PLAYING when startGame is called
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
            // Reset camera position
            this.camera.position.copy(this.screenShake.originalCameraPosition);
            this.screenShake.isShaking = false;
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
        this.state = GAME_STATES.MAIN_MENU;
        
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
        
        // Start animation loop if not already running
        if (!this.animationFrameId) {
            this.gameLoop(performance.now());
        }
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