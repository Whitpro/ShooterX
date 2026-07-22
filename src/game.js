import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';
import Player from './player.js';
import Weapon from './weapon.js';
import UI from './ui.js';
import Wave from './wave.js';
import Enemy, { EnemyManager } from './enemy.js';
import Environment from './environment.js';
import Input from './input.js';
import GAME_STATES from './gameStates.js';
import Settings from './settings.js';
import { HitIndicator } from './hitIndicator.js';
import BossFight from './boss.js';

const DEBUG = process.env.NODE_ENV === 'development';

function debug(...args) {
    if (DEBUG) console.log('[GameEngine]', ...args);
}

function debugError(...args) {
    if (DEBUG) console.error('[GameEngine Error]', ...args);
}

class GameEngine {
    constructor() {
        try {
            window.gameEngine = this;
            window.isBugReportOpen = false;
            window.isInSettingsMenu = false;

            this.scene = new THREE.Scene();
            let savedFov = 75;
            try {
                const savedSettings = localStorage.getItem('shooterx-settings');
                if (savedSettings) {
                    const parsed = JSON.parse(savedSettings);
                    if (parsed.fieldOfView) savedFov = parsed.fieldOfView;
                }
            } catch (e) {}

            this.camera = new THREE.PerspectiveCamera(savedFov, window.innerWidth / window.innerHeight, 0.1, 1000);

            try {
                this.renderer = new THREE.WebGPURenderer({
                    antialias: true,
                    powerPreference: "high-performance",
                    samples: 4,
                    trackTimestamp: false
                });
            } catch (error) {
                console.warn('WebGPU not supported, falling back to WebGL:', error);
                this.renderer = new THREE.WebGLRenderer({
                    antialias: true,
                    powerPreference: "high-performance",
                    precision: "highp"
                });
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

            this.camera.position.set(0, 1.7, 0);

            this.state = GAME_STATES.MAIN_MENU;
            this.isRunning = false;
            this.isPaused = false;
            this.lastTime = 0;
            this._hasHadPointerLock = false;
            this._lastLockRequestTime = 0;
            this.deltaTime = 0;

            this.input = Input;
            this.input.init();

            this.player = null;
            this.enemyManager = null;
            this.weapon = null;
            this.ui = null;
            this.waveSystem = null;
            this.environment = null;

            this.useFrameRateLimit = false;
            this.fpsLimit = 0;
            this.frameTimeLimit = 0;
            this.lastFrameTime = 0;

            this.screenShake = {
                intensity: 0, duration: 0, startTime: 0, isShaking: false,
                originalCameraPosition: new THREE.Vector3(), currentOffset: new THREE.Vector3()
            };

            this.freecamEnabled = false;
            this.flySpeed = 10;
            this.weaponMaxAmmo = 30;
            this._renderInProgress = false;
            this._menuTimer = null;

            this.gameLoop = this.gameLoop.bind(this);

            this._setupComponents();
            this._initEvents();

            window.addEventListener('resize', () => {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.maxPixelRatio) * this.renderScale);
            });
        } catch (error) {
            debugError('Error in constructor:', error);
            throw error;
        }
    }

    _setupComponents() {
        try {
            this.environment = new Environment(this.scene);

            if (!this.scene.children.includes(this.camera)) {
                this.scene.add(this.camera);
            }

            this.player = new Player(this.scene, this.camera);

            this.enemyManager = new EnemyManager(this.scene, this.environment);

            this.weapon = new Weapon(this.scene, this.camera, this.weaponMaxAmmo);
            this.player.setFirstPersonWeaponModel(this.weapon.model);

            this.ui = new UI(this);

            this.waveSystem = new Wave(this.enemyManager, this);

            this.bossFight = new BossFight(this.scene, this.environment, this.enemyManager);
            this.bossFight.ui = this.ui;

            this.settings = new Settings(this, this.ui);

            this.hitIndicator = new HitIndicator();

            if (this.settings) {
                this.settings.applyAllSettings();
            }
        } catch (error) {
            debugError('Error in _setupComponents:', error);
            throw error;
        }
    }

    _initEvents() {
        let _lastLockTime = 0;
        document.addEventListener('pointerlockchange', () => {
            const isLocked = document.pointerLockElement === document.body;
            const now = performance.now();

            if (isLocked) {
                _lastLockTime = now;
                this._hasHadPointerLock = true;
                if (this.isPaused) {
                    this.resumeGame();
                }
            } else {
                if (now - _lastLockTime < 300) return;
                if (this._lastLockRequestTime && now - this._lastLockRequestTime < 500) {
                    this._lastLockRequestTime = 0;
                    return;
                }
                if (this.state === GAME_STATES.PLAYING && !this.isPaused
                    && !window.isInSettingsMenu && !window.isConsoleOpen
                    && this._hasHadPointerLock
                    && (now - (this._gameStartTime || 0)) > 2000) {
                    this.pauseGame();
                }
            }
        });

        let _lastEscTime = 0;
        document.addEventListener('keydown', (event) => {
            if (this._cutsceneActive) return;
            if (event.key === 'Escape' && this.state === GAME_STATES.PLAYING) {
                const now = performance.now();
                if (now - _lastEscTime < 400) return;
                _lastEscTime = now;
                event.preventDefault();
                this.isPaused ? this.resumeGame() : this.pauseGame();
            }
        }, true);

        document.addEventListener('keydown', (event) => this.input.handleKeyDown(event));
        document.addEventListener('keyup', (event) => this.input.handleKeyUp(event));
        document.addEventListener('mousedown', (event) => this.input.handleMouseDown(event));
        document.addEventListener('mouseup', (event) => this.input.handleMouseUp(event));
        document.addEventListener('contextmenu', (event) => event.preventDefault());
        window.addEventListener('resize', () => this.onWindowResize());
    }

    startGame() {
        try {
            this._gameStartTime = performance.now();
            this._hasHadPointerLock = false;

            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }

            this.scene.visible = true;

            if (this.ui && this.ui.blackOverlay) {
                this.ui.hideBlackOverlay();
            }

            this.state = GAME_STATES.PLAYING;
            this.isRunning = true;
            this.isPaused = false;
            this.input.reset();

            this.cleanup();

            if (this.ui) {
                this.ui.reset();
                this.ui.hideAllMenus();
                this.ui.showGameplayUI();
                this.ui.updateHealthBar(this.player.health, this.player.maxHealth);
                this.ui.updateAmmoCounter(this.weapon.ammo, this.weapon.maxAmmo);
            }

            if (this.waveSystem) {
                this.waveSystem.startWave();
            }

            this.lastTime = performance.now() / 1000;
            this.animationFrameId = requestAnimationFrame(this.gameLoop);
        } catch (error) {
            debugError('Error starting game:', error);
            console.error(error);
        }
    }

    cleanup() {
        if (this.bossFight) this.bossFight.reset();
        if (this.enemyManager) this.enemyManager.reset();
        if (this.player) this.player.reset();
        if (this.weapon) this.weapon.reset();
        if (this.waveSystem) this.waveSystem.reset();

        const objectsToRemove = [];
        this.scene.traverse(object => {
            if (object.userData && object.userData.isEnvironment) return;
            if (object.userData.type === 'enemy' ||
                object.userData.temporary === true ||
                (object.isMesh && !object.userData.isPlayer && !object.userData.isWeapon)) {
                objectsToRemove.push(object);
            }
        });

        objectsToRemove.forEach(object => {
            this.scene.remove(object);
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Must run last — its own internal traverse wipes + recreates all world objects and lights
        if (this.environment) this.environment.reset();

        if (window.gc) {
            try { window.gc(); } catch (e) {}
        }
    }

    gameLoop(currentTime) {
        try {
            if (!this.isRunning || this.state !== GAME_STATES.PLAYING) {
                this.animationFrameId = null;
                return;
            }

            currentTime *= 0.001;
            this.deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;

            if (this.deltaTime > 0.1) {
                this.deltaTime = 0.1;
            }

            if (this.useFrameRateLimit && this.fpsLimit > 0) {
                const now = performance.now();
                if (now - this.lastFrameTime < this.frameTimeLimit) {
                    this.animationFrameId = requestAnimationFrame(this.gameLoop);
                    return;
                }
                this.lastFrameTime = now;
            }

            if (this.isPaused) {
                if (this._cutsceneActive && this.bossFight) {
                    this.bossFight.update(this.deltaTime);
                    this.render();
                }
                    this.animationFrameId = requestAnimationFrame(this.gameLoop);
                return;
            }

            this.update(this.deltaTime);

            if (!this._renderInProgress) {
                this._renderInProgress = true;
                this.render()
                    .catch(e => debugError('Render error:', e))
                    .finally(() => { this._renderInProgress = false; });
            }

            this.animationFrameId = requestAnimationFrame(this.gameLoop);
        } catch (error) {
            debugError('Error in game loop:', error);
            console.error(error);
            if (this.isRunning && this.state === GAME_STATES.PLAYING) {
                this.animationFrameId = requestAnimationFrame(this.gameLoop);
            } else {
                this.pauseGame();
            }
        }
    }

    update(deltaTime) {
        if (this.state !== GAME_STATES.PLAYING || !this.player || !this.weapon) return;

        try {
            if (this.player.health <= 0 || this.player.isDead) {
                this.gameOver();
                return;
            }

            this.input.update();

            this.player.update(deltaTime, this.input, this.environment);

            if (this.environment && this.player) {
                this.environment.updatePowerUps(this.player, deltaTime);
                this.environment.updateBoundaryRing(this.player.position, deltaTime);
                this.environment.updateAnimatedBarrierWall(deltaTime, this.player.position);
            }

            if (this.environment && this.environment.dayNightCycle) {
                const darkness = this.environment.dayNightCycle.getDarkness();
                const intensity = darkness * darkness * 5;
                if (this.player) this.player.setFootLightIntensity(intensity);
                if (this.enemyManager) {
                    for (const enemy of this.enemyManager.enemies) {
                        if (enemy && enemy.isAlive) enemy.setFootLightIntensity(intensity);
                    }
                }
            }

            if (this.input.isMouseButtonPressed('left') && document.pointerLockElement === document.body) {
                const shotResult = this.weapon.shoot(this.enemyManager);
                if (shotResult && shotResult.fired) {
                    this.onShotFired();
                }
            }

            if (this.input.isKeyPressed('r')) {
                this.weapon.reload();
            }

            this.weapon.update(deltaTime, this.player.velocity);

            if (this.bossFight) this.bossFight.update(deltaTime);
            if (this.enemyManager) this.enemyManager.update(deltaTime);
            if (this.waveSystem) this.waveSystem.update(deltaTime);
            if (this.ui) this.ui.update();

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
                    try {
                        await this.renderer.renderAsync(this.scene, this.camera);
                    } catch (e) {
                        this.renderer.render(this.scene, this.camera);
                    }
                } else {
                    this.renderer.render(this.scene, this.camera);
                }

                if (this.renderer.isWebGPURenderer && DEBUG) {
                    if (this._frameCount === undefined) {
                        this._frameCount = 0;
                        this._lastPerfLog = performance.now();
                    }
                    this._frameCount++;
                    if (this._frameCount >= 100) {
                        const now = performance.now();
                        const fps = Math.round((this._frameCount / (now - this._lastPerfLog)) * 1000);
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
        if (this.state !== GAME_STATES.PLAYING || this.isPaused) return;
        this.isPaused = true;

        if (!window.isInSettingsMenu && document.pointerLockElement === document.body) {
            document.exitPointerLock();
        }

        this.stopScreenShake();

        if (this.ui && !window.isConsoleOpen && !window.isInSettingsMenu) {
            this.ui.showPauseMenu();
        }

        if (this.player) this.player.setPaused(true);
    }

    resumeGame() {
        if (!this.isPaused) return;
        this.isPaused = false;
        this.state = GAME_STATES.PLAYING;

        if (this.ui) {
            this.ui.hideAllMenus();
            this.ui.showGameplayUI();
        }

        if (document.pointerLockElement !== document.body) {
            this._lastLockRequestTime = performance.now();
            document.body.requestPointerLock();
        }

        if (this.player) this.player.setPaused(false);
    }

    togglePause() {
        this.isPaused ? this.resumeGame() : this.pauseGame();
    }

    quitToMenu() {
        if (this.ui) {
            this.ui.showBlackOverlay(() => {
                this.state = GAME_STATES.MAIN_MENU;
                this.isRunning = false;
                this.isPaused = false;

                this.cleanup();
                this.stopScreenShake();
                this.scene.visible = false;

                this.ui.hideAllMenus();
                this.ui.hideGameplayUI();
                this.ui.showMainMenu();

                if (this.ui.blackOverlay) {
                    this.ui.blackOverlay.style.opacity = '1.0';
                }

                if (document.pointerLockElement === document.body) {
                    document.exitPointerLock();
                }
            });
        }
    }

    continueFromEndless() {
        if (this.waveSystem) {
            this.waveSystem.maxWave = 999;
            this.waveSystem.state = 'WAITING';
            this.waveSystem.wave++;
            this.waveSystem.startWave();
        }
        this.scene.visible = true;
        this.isRunning = true;
        this.isPaused = false;
        this.state = GAME_STATES.PLAYING;
        if (this.ui) this.ui.showGameplayUI();
        if (this.player) this.player.setPaused(false);
        if (document.pointerLockElement !== document.body) {
            document.body.requestPointerLock();
        }
        this.lastTime = performance.now() / 1000;
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }

    gameOver() {
        if (this.state === GAME_STATES.GAME_OVER) return;

        try {
            this.state = GAME_STATES.GAME_OVER;
            this.isPaused = true;
            this.isRunning = false;

            const isWaveCompletion = this.waveSystem && this.waveSystem.wave >= this.waveSystem.maxWave
                && this.player && !this.player.isDead;

            this.stopScreenShake();

            if (isWaveCompletion) {
                this.ui.showGameCompletionScreen();
            } else {
                this.ui.showGameOverScreen();
            }

            if (document.pointerLockElement === document.body) {
                document.exitPointerLock();
            }
        } catch (error) {
            debugError('Error in gameOver:', error);
        }
    }

    quitGame() {
        this.isRunning = false;
        if (window.electron && window.electron.ipcRenderer) {
            window.electron.ipcRenderer.send('quit-game');
        } else {
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
        const points = this.waveSystem.onEnemyKill(enemy.type, isHeadshot);
        if (this.ui) {
            this.ui.updateScore(this.waveSystem.getCurrentState());
        }
    }

    onShotFired() {
        if (this.waveSystem) {
            this.waveSystem.onShotFired();
        }
    }

    onShotHit() {
        if (this.waveSystem) {
            this.waveSystem.onShotHit();
        }
    }

    reset() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this._renderInProgress = false;

        this.state = GAME_STATES.MAIN_MENU;
        this.isRunning = false;
        this.isPaused = false;
        this.lastTime = 0;
        this.deltaTime = 0;

        this.cleanup();

        if (this.ui) this.ui.reset();

        this.stopScreenShake();

        if (this.input) this.input.reset();

        this._hasHadPointerLock = false;

        if (THREE && THREE.Cache) {
            THREE.Cache.clear();
        }
    }

    applyScreenShake(intensity, duration) {
        if (this.screenShake.isShaking) {
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

        this.screenShake.originalCameraPosition.copy(this.camera.position);

        const envelope = Math.cos(progress * Math.PI * 0.5);
        const amp = this.screenShake.intensity * envelope;
        const freq = 10;
        const angle = elapsed * 0.001 * Math.PI * 2 * freq;

        const offset = new THREE.Vector3(
            Math.sin(angle) * amp,
            Math.sin(angle * 1.3 + 1) * amp * 0.6,
            Math.sin(angle * 0.7 + 2) * amp * 0.4
        );

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

    toggleFreecam() {
        this.freecamEnabled = !this.freecamEnabled;
        if (this.freecamEnabled) {
            if (this.player) {
                this.player.gravity = 0;
                this.player.velocity.y = 0;
            }
        } else if (this.player) {
            this.player.gravity = 9.8;
        }
    }

    showMainMenu() {
        this.state = GAME_STATES.MAIN_MENU;
        this.scene.visible = false;

        if (this.ui) {
            if (this.ui.blackOverlay) {
                this.ui.showBlackOverlay();
                if (this._menuTimer) clearTimeout(this._menuTimer);
                this._menuTimer = setTimeout(() => {
                    this._menuTimer = null;
                    if (this.ui && this.ui.blackOverlay) {
                        this.ui.blackOverlay.style.opacity = '0.8';
                    }
                }, 100);
            }
            this.ui.showMainMenu();
        }
    }
}

function initGame() {
    try {
        const gameEngine = new GameEngine();
        gameEngine.scene.visible = false;
        gameEngine.showMainMenu();

        if (typeof window !== 'undefined') {
            window.gameEngine = gameEngine;
        }

        return gameEngine;
    } catch (error) {
        console.error('Failed to initialize game:', error);
        throw error;
    }
}

export default GameEngine;
export { initGame };
