import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';
import { ENEMY_TYPES, createEnemyMesh } from './enemyTypes.js';

class Enemy {
    static _nextId = 1;

    constructor(scene, type, position, environment = null) {
        this.id = Enemy._nextId++;
        this.scene = scene;
        this.environment = environment;
        this.type = typeof type === 'string' ? type : type.type;
        const config = ENEMY_TYPES[this.type.toUpperCase()];

        if (!config) {
            console.error('Invalid enemy type:', type);
            return;
        }

        this.position = position ? position.clone() : new THREE.Vector3();
        this.health = config.health;
        this.maxHealth = config.health;
        this.speed = config.chaseSpeed || config.speed || 2;
        this.damage = config.damage || 10;
        this.isAlive = true;
        this._isDisposed = false;

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.rotationSpeed = 3.0;
        this.lastPosition = this.position.clone();

        this.attackRange = config.attackRange || 2.0;
        this.detectionRange = config.detectionRange || 20.0;
        this.attackCooldown = 0;
        this.attackDelay = config.attackDelay || 1000;
        this.attackWindup = config.attackWindup || 500;
        this.windupTimer = 0;

        this.roamingConfig = config.behavior?.roaming || {
            radius: 15,
            speedMultiplier: 0.6,
            changeTimeMin: 3000,
            changeTimeMax: 7000
        };

        this.state = 'ROAMING';
        this.roamTargetPosition = null;
        this.roamRadius = this.roamingConfig.radius;
        this.roamingSpeed = config.roamSpeed || (this.speed * (this.roamingConfig.speedMultiplier || 0.6));
        this.roamTargetChangeTime = 0;
        this.roamTargetChangeCooldown = this.getRandomRoamTime();
        this.stuckCheckDelay = 1000;
        this.lastStuckCheckTime = 0;
        this.stuckThreshold = 0.1;
        this.mapBoundaryRadius = 50;

        this._playerPosition = new THREE.Vector3();
        this._toPlayer = new THREE.Vector3();
        this._toTarget = new THREE.Vector3();
        this._newPosition = new THREE.Vector3();
        this._slideX = new THREE.Vector3();
        this._slideZ = new THREE.Vector3();

        this.healthBarState = 'healthy';
        this.pulseAnimation = null;
        this.healthBarTextures = null;

        this.footLight = null;
        this.createModel();
    }

    getRandomRoamTime() {
        return this.roamingConfig.changeTimeMin + Math.random() * (this.roamingConfig.changeTimeMax - this.roamingConfig.changeTimeMin);
    }

    createGradientTexture(topColor, bottomColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, topColor);
        gradient.addColorStop(1, bottomColor);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return new THREE.CanvasTexture(canvas);
    }

    _makeGlowSpriteMap() {
        const c = document.createElement('canvas');
        c.width = 64;
        c.height = 64;
        const ctx = c.getContext('2d');
        const half = 32;
        const g = ctx.createRadialGradient(half, half, 0, half, half, half);
        g.addColorStop(0, 'rgba(255, 180, 80, 0.9)');
        g.addColorStop(0.3, 'rgba(255, 140, 50, 0.4)');
        g.addColorStop(0.6, 'rgba(200, 100, 30, 0.1)');
        g.addColorStop(1, 'rgba(150, 70, 20, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
    }

    createModel() {
        this.model = createEnemyMesh(this.type.toUpperCase());
        if (!this.model) return;

        this.model.position.copy(this.position);
        const config = ENEMY_TYPES[this.type.toUpperCase()];
        const height = config.model ? (config.model.height || 1.7) / 2 : 1.0;
        this.model.position.y = height;
        this.model.userData.type = 'enemy';
        this.model.userData.enemy = this;
        this.scene.add(this.model);

        // Foot glow — emissive sphere + sprite (cheaper than PointLight)
        const glowGeo = new THREE.SphereGeometry(0.3, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xffaa55,
            transparent: true,
            opacity: 0,
        });
        this.footGlow = new THREE.Mesh(glowGeo, glowMat);
        this.footGlow.position.set(0, 0.05, 0);
        this.footGlow.raycast = () => {}; // Don't block bullets
        this.model.add(this.footGlow);

        // Glow sprite for visible light cone on the ground
        const spriteMap = this._makeGlowSpriteMap();
        const spriteMat = new THREE.SpriteMaterial({
            map: spriteMap,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0,
        });
        this.footGlowSprite = new THREE.Sprite(spriteMat);
        this.footGlowSprite.position.set(0, 0.02, 0);
        this.footGlowSprite.scale.set(1.6, 1.6, 1);
        this.footGlowSprite.raycast = () => {};
        this.model.add(this.footGlowSprite);

        const barWidth = Math.min(2.0, Math.max(1.2, config.health / 80));
        const barHeight = 0.25;
        const yOffset = height * 2 + 0.5;
        this.createHealthBar(yOffset, barWidth, barHeight);
    }

    createHealthBar(yOffset, width = 1.5, height = 0.2) {
        this.healthBarTextures = {
            healthy: this.createGradientTexture('#00FF00', '#32CD32'),
            low: this.createGradientTexture('#FFFF00', '#FFA500'),
            critical: this.createGradientTexture('#FF4500', '#FF8C00'),
            background: this.createGradientTexture('#8B0000', '#FF0000')
        };

        this.healthBarContainer = new THREE.Group();
        this.healthBarContainer.userData.enemy = this;
        this.healthBarContainer.position.set(0, yOffset, 0);
        this.healthBarContainer.rotation.x = -Math.PI / 2;
        this.healthBarContainer.visible = false;
        this.model.add(this.healthBarContainer);

        const backgroundGeometry = new THREE.PlaneGeometry(width, height);
        const backgroundMaterial = new THREE.MeshBasicMaterial({
            map: this.healthBarTextures.background,
            side: THREE.DoubleSide,
            depthTest: false,
            transparent: true,
            opacity: 0.9
        });
        this.healthBarBackground = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
        this.healthBarBackground.renderOrder = 999;
        this.healthBarBackground.userData.enemy = this;
        this.healthBarContainer.add(this.healthBarBackground);

        const foregroundGeometry = new THREE.PlaneGeometry(width, height);
        const foregroundMaterial = new THREE.MeshBasicMaterial({
            map: this.healthBarTextures.healthy,
            side: THREE.DoubleSide,
            depthTest: false,
            transparent: true,
            opacity: 1
        });
        this.healthBarForeground = new THREE.Mesh(foregroundGeometry, foregroundMaterial);
        this.healthBarForeground.renderOrder = 1000;
        this.healthBarForeground.userData.enemy = this;
        this.healthBarContainer.add(this.healthBarForeground);

        const borderGeometry = new THREE.PlaneGeometry(width + 0.05, height + 0.05);
        const borderMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            depthTest: false,
            transparent: true,
            opacity: 0.7,
            wireframe: false
        });
        this.healthBarBorder = new THREE.Mesh(borderGeometry, borderMaterial);
        this.healthBarBorder.renderOrder = 998;
        this.healthBarBorder.userData.enemy = this;
        this.healthBarContainer.add(this.healthBarBorder);

        this.healthBarForeground.scale.x = 1;
        this.healthBarForeground.position.x = 0;
    }

    setHealthBarState(state) {
        if (!this.healthBarForeground || this.healthBarState === state) return;

        this.healthBarState = state;
        this.healthBarForeground.material.map = this.healthBarTextures[state];
        this.healthBarForeground.material.needsUpdate = true;

        if (state === 'critical') {
            if (!this.pulseAnimation) {
                this.pulseAnimation = setInterval(() => {
                    if (!this.healthBarForeground) return;
                    this.healthBarForeground.material.opacity = 0.7 + Math.sin(Date.now() * 0.01) * 0.3;
                }, 100);
            }
            return;
        }

        if (this.pulseAnimation) {
            clearInterval(this.pulseAnimation);
            this.pulseAnimation = null;
        }
        this.healthBarForeground.material.opacity = 1;
    }

    updateHealthBar() {
        if (!this.healthBarForeground) return;

        const healthPercent = Math.max(0, Math.min(1, this.health / this.maxHealth));
        const width = this.healthBarForeground.geometry.parameters.width;

        this.healthBarForeground.scale.x = healthPercent;
        this.healthBarForeground.position.x = -width * (1 - healthPercent) / 2;

        if (healthPercent <= 0.25) {
            this.setHealthBarState('critical');
        } else if (healthPercent <= 0.5) {
            this.setHealthBarState('low');
        } else {
            this.setHealthBarState('healthy');
        }

        this.healthBarContainer.visible = healthPercent < 1 && healthPercent > 0;
    }

    update(deltaTime, player) {
        if (!this.isAlive || !this.model || !player) return;

        const clampedDeltaTime = Math.min(Math.max(deltaTime, 0.001), 0.1);
        this.position.copy(this.model.position);

        const config = ENEMY_TYPES[this.type.toUpperCase()];
        const height = config.model ? (config.model.height || 1.7) / 2 : 1.0;
        this.model.position.y = height;

        this._playerPosition.copy(player.position || player.camera.position);
        this._toPlayer.subVectors(this._playerPosition, this.position);
        const distanceToPlayer = this._toPlayer.length();

        if (distanceToPlayer <= this.attackRange) {
            if (this.state !== 'WINDUP' && this.state !== 'ATTACKING') {
                this.state = 'WINDUP';
                this.windupTimer = this.attackWindup;
            }
        } else if (distanceToPlayer <= this.detectionRange) {
            this.state = 'CHASING';
        } else {
            this.state = 'ROAMING';
        }

        switch (this.state) {
            case 'ROAMING':
                this.handleRoaming(clampedDeltaTime);
                break;
            case 'CHASING':
                this._toPlayer.normalize();
                this.velocity.copy(this._toPlayer).multiplyScalar(this.speed * clampedDeltaTime);
                if (config.behavior?.combatStrafe) {
                    const strafeDir = this._slideX.set(-this._toPlayer.z, 0, this._toPlayer.x);
                    const sign = Math.sin(performance.now() * 0.005 + this.id) > 0 ? 1 : -1;
                    strafeDir.multiplyScalar(this.speed * config.behavior.combatStrafe * 0.35 * clampedDeltaTime * sign);
                    this.velocity.add(strafeDir);
                }
                this.tryMove(this.velocity);
                this.updateRotation(this._toPlayer);
                break;
            case 'WINDUP':
                this._toPlayer.normalize();
                this.updateRotation(this._toPlayer);
                this.windupTimer -= clampedDeltaTime * 1000;
                // Pulse foot glow during windup
                if (this.footGlow) {
                    const pulse = 0.5 + Math.sin(performance.now() * 0.02) * 0.5;
                    this.footGlow.material.opacity = pulse;
                }
                if (this.footGlowSprite) {
                    this.footGlowSprite.material.opacity = 0.8;
                    const pulse = 1.0 + Math.sin(performance.now() * 0.015) * 0.3;
                    this.footGlowSprite.scale.setScalar(pulse * 2.0);
                }
                if (this.windupTimer <= 0) {
                    this.attack(player);
                    this.state = 'ATTACKING';
                }
                break;
            case 'ATTACKING':
                this._toPlayer.normalize();
                this.updateRotation(this._toPlayer);
                // Combat strafe during attack cooldown
                if (config.behavior?.combatStrafe) {
                    const strafeDir = this._slideX.set(-this._toPlayer.z, 0, this._toPlayer.x);
                    const sign = Math.sin(performance.now() * 0.003 + this.id + 1) > 0 ? 1 : -1;
                    strafeDir.multiplyScalar(sign);
                    this.velocity.copy(strafeDir).multiplyScalar(this.speed * config.behavior.combatStrafe * clampedDeltaTime);
                    this.tryMove(this.velocity);
                }
                if (this.attackCooldown <= 0) {
                    // Ready to attack again — re-enter windup if player still in range
                    if (distanceToPlayer <= this.attackRange) {
                        this.state = 'WINDUP';
                        this.windupTimer = this.attackWindup;
                    }
                }
                break;
        }

        if (this.attackCooldown > 0) {
            this.attackCooldown -= clampedDeltaTime * 1000;
        }

        this.checkIfStuck();
    }

    handleRoaming(deltaTime) {
        const now = performance.now();

        if (!this.roamTargetPosition || now - this.roamTargetChangeTime > this.roamTargetChangeCooldown) {
            this.chooseNewRoamTarget();
            this.roamTargetChangeTime = now;
        }

        if (!this.roamTargetPosition) return;

        this._toTarget.subVectors(this.roamTargetPosition, this.position);
        const distanceToTarget = this._toTarget.length();
        if (distanceToTarget < 1) {
            this.chooseNewRoamTarget();
            return;
        }

        this._toTarget.normalize();
        this.velocity.copy(this._toTarget).multiplyScalar(this.roamingSpeed * deltaTime);
        this.tryMove(this.velocity);
        this.updateRotation(this._toTarget);
    }

    chooseNewRoamTarget(biasTowardsCenter = false) {
        const maxDistance = biasTowardsCenter
            ? Math.min(this.roamRadius, this.mapBoundaryRadius * 0.5)
            : this.roamRadius;

        const distanceFromCenter = Math.hypot(this.position.x, this.position.z);
        let angle;

        if (distanceFromCenter > this.mapBoundaryRadius * 0.8 || biasTowardsCenter) {
            angle = Math.atan2(-this.position.z, -this.position.x) + (Math.random() - 0.5) * Math.PI / 2;
        } else {
            angle = Math.random() * Math.PI * 2;
        }

        const distance = Math.random() * maxDistance;
        const x = this.position.x + Math.cos(angle) * distance;
        const z = this.position.z + Math.sin(angle) * distance;

        if (this.roamTargetPosition) {
            this.roamTargetPosition.set(x, 0, z);
        } else {
            this.roamTargetPosition = new THREE.Vector3(x, 0, z);
        }

        this.roamTargetChangeCooldown = this.getRandomRoamTime();
    }

    checkIfStuck() {
        const now = performance.now();
        if (now - this.lastStuckCheckTime < this.stuckCheckDelay) {
            return;
        }

        this.lastStuckCheckTime = now;
        const distanceMoved = this.position.distanceTo(this.lastPosition);

        if (distanceMoved < this.stuckThreshold && this.state === 'ROAMING') {
            this.chooseNewRoamTarget();
        }

        this.lastPosition.copy(this.position);
    }

    tryMove(movement) {
        this._newPosition.copy(this.position).add(movement);

        if (!this.checkCollision(this._newPosition)) {
            this.model.position.copy(this._newPosition);
        } else {
            this._slideX.set(this._newPosition.x, this.position.y, this.position.z);
            if (!this.checkCollision(this._slideX)) {
                this.model.position.copy(this._slideX);
            } else {
                this._slideZ.set(this.position.x, this.position.y, this._newPosition.z);
                if (!this.checkCollision(this._slideZ)) {
                    this.model.position.copy(this._slideZ);
                }
            }
        }

        const config = ENEMY_TYPES[this.type.toUpperCase()];
        const height = config.model ? (config.model.height || 1.7) / 2 : 1.0;
        this.model.position.y = height;
    }

    checkCollision(position) {
        if (this.environment && this.environment.checkWallCollision) {
            return this.environment.checkWallCollision(position);
        }
        return false;
    }

    updateRotation(direction) {
        if (!this.model) return;

        const targetRotation = Math.atan2(direction.x, direction.z);
        let rotationDiff = targetRotation - this.model.rotation.y;
        if (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
        if (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
        this.model.rotation.y += rotationDiff * this.rotationSpeed * 0.1;
    }

    attack(player) {
        if (!player) return;

        this._playerPosition.copy(player.position || player.camera.position);
        this._toPlayer.subVectors(this._playerPosition, this.position);
        const distanceToPlayer = this._toPlayer.length();

        if (distanceToPlayer <= this.attackRange) {
            player.takeDamage(this.damage, this.position.clone());
            this.createAttackTrail(player);
            this.attackCooldown = this.attackDelay;

            const config = ENEMY_TYPES[this.type.toUpperCase()];
            if (config.knockback) {
                this._toPlayer.normalize();
                this._slideX.copy(this._toPlayer).multiplyScalar(config.knockback);
                this._slideX.y = 2;
                const newPos = player.position.clone().add(this._slideX);
                if (this.environment && !this.environment.checkWallCollision(newPos)) {
                    player.position.copy(newPos);
                }
            }
        }
    }

    createAttackTrail(player) {
        if (!this.scene || !player) return;

        const startPos = this.position.clone();
        const config = ENEMY_TYPES[this.type.toUpperCase()];
        const height = config && config.model ? (config.model.height || 1.7) * 0.7 : 1.2;
        startPos.y = height;

        const targetPos = (player.camera ? player.camera.position.clone() : player.position.clone());
        
        // Direction and distance
        const direction = new THREE.Vector3().subVectors(targetPos, startPos);
        const distance = direction.length();
        if (distance <= 0) return;

        // Choose trail color based on enemy type
        let trailColor = 0xff3333; // Default red
        const upperType = this.type.toUpperCase();
        if (upperType === 'SCOUT') trailColor = 0x33ff33;
        else if (upperType === 'SNIPER') trailColor = 0xffff33;
        else if (upperType === 'COMMANDER') trailColor = 0xff33ff;
        else if (upperType === 'BOSS') trailColor = 0xff8800;

        // Create glowing laser beam trail
        const geometry = new THREE.CylinderGeometry(0.04, 0.04, distance, 6);
        const material = new THREE.MeshBasicMaterial({
            color: trailColor,
            transparent: true,
            opacity: 0.9
        });

        const beam = new THREE.Mesh(geometry, material);
        beam.position.copy(startPos.clone().add(targetPos).multiplyScalar(0.5));
        beam.lookAt(targetPos);
        beam.rotateX(Math.PI / 2);

        this.scene.add(beam);

        // Muzzle flash particle at enemy position
        const flashGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({
            color: trailColor,
            transparent: true,
            opacity: 1.0
        });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(startPos);
        this.scene.add(flash);

        // Animate beam & flash fade out
        const startTime = performance.now();
        const duration = 180; // ms

        const fade = () => {
            const elapsed = performance.now() - startTime;
            const progress = elapsed / duration;

            if (progress < 1.0) {
                material.opacity = (1 - progress) * 0.9;
                flashMat.opacity = 1 - progress;
                flash.scale.setScalar(1 + progress * 1.5);
                requestAnimationFrame(fade);
            } else {
                this.scene.remove(beam);
                this.scene.remove(flash);
                geometry.dispose();
                material.dispose();
                flashGeo.dispose();
                flashMat.dispose();
            }
        };

        fade();
    }

    takeDamage(amount) {
        if (!this.isAlive) return false;

        this.health = Math.max(0, Math.min(this.maxHealth, this.health - amount));

        if (this.healthBarContainer) {
            this.healthBarContainer.visible = true;
            this.updateHealthBar();
        }

        if (this.health <= 0) {
            this.die();
            return true;
        }

        return false;
    }

    die() {
        if (!this.isAlive) return;

        this.isAlive = false;
        if (this.healthBarContainer) {
            this.healthBarContainer.visible = false;
        }

        if (this.pulseAnimation) {
            clearInterval(this.pulseAnimation);
            this.pulseAnimation = null;
        }
    }

    disposeMaterial(material) {
        if (!material) return;
        if (Array.isArray(material)) {
            material.forEach(mat => this.disposeMaterial(mat));
            return;
        }
        if (material.map) {
            material.map.dispose();
        }
        material.dispose();
    }

    setFootLightIntensity(value) {
        const v = Math.min(value, 1);
        if (this.footGlow) {
            this.footGlow.material.opacity = v;
        }
        if (this.footGlowSprite) {
            this.footGlowSprite.material.opacity = v * 0.8;
        }
    }

    dispose() {
        if (this._isDisposed) return;
        this._isDisposed = true;

        if (this.pulseAnimation) {
            clearInterval(this.pulseAnimation);
            this.pulseAnimation = null;
        }

        if (this.model) {
            this.scene.remove(this.model);

            if (this.healthBarBackground) {
                if (this.healthBarBackground.geometry) this.healthBarBackground.geometry.dispose();
                this.disposeMaterial(this.healthBarBackground.material);
            }

            if (this.healthBarForeground) {
                if (this.healthBarForeground.geometry) this.healthBarForeground.geometry.dispose();
                this.disposeMaterial(this.healthBarForeground.material);
            }

            if (this.healthBarBorder) {
                if (this.healthBarBorder.geometry) this.healthBarBorder.geometry.dispose();
                this.disposeMaterial(this.healthBarBorder.material);
            }

            if (this.model.material) {
                this.disposeMaterial(this.model.material);
            }
        }

        this.model = null;
        this.footGlow = null;
        this.footGlowSprite = null;
        this.healthBarContainer = null;
        this.healthBarBackground = null;
        this.healthBarForeground = null;
        this.healthBarBorder = null;
        this.healthBarTextures = null;
    }
}

export default Enemy;

// ─── EnemyManager ──────────────────────────────────────────────

class EnemyManager {
    constructor(scene, environment) {
        this.scene = scene;
        this.environment = environment;
        this.enemies = [];
        this.lastSpawnTime = 0;
        this.spawnCooldown = 2000;
        this.maxEnemies = 100;

        this.spawnQueue = [];
        this.isSpawning = false;
        this.spawnPoints = [];
        this.spawnPointCooldown = 5000;
        this.spawnPointLastUse = new Map();
        this.minSpawnDistance = 15;
        this.spawnAreaRadius = 25;

        this.enemyGroups = [];
        this.groupLeaders = new Map();
        this.enemyToGroup = new Map();
        this.nextGroupId = 1;

        this.initializeSpawnPoints();
    }

    initializeSpawnPoints() {
        const rings = [
            { radius: 20, points: 8 },
            { radius: 25, points: 12 },
            { radius: 30, points: 16 }
        ];

        rings.forEach(ring => {
            for (let i = 0; i < ring.points; i++) {
                const angle = (i / ring.points) * Math.PI * 2;
                const x = Math.cos(angle) * ring.radius;
                const z = Math.sin(angle) * ring.radius;
                const point = new THREE.Vector3(x, 0, z);

                if (!this.environment.checkWallCollision(point)) {
                    this.spawnPoints.push(point);
                }
            }
        });

        console.log(`Initialized ${this.spawnPoints.length} spawn points`);
    }

    queueEnemySpawn(type) {
        if (!ENEMY_TYPES[type]) {
            console.warn(`Invalid enemy type: ${type}`);
            return;
        }

        this.spawnQueue.push(type);
        console.log(`Queued enemy spawn: ${type}, queue length: ${this.spawnQueue.length}`);
    }

    hasSpawningEnemies() {
        return this.spawnQueue.length > 0;
    }

    spawnEnemy(type, position = null) {
        if (!position) {
            const spawnPoint = this.getValidSpawnPoint();
            if (!spawnPoint) {
                console.warn('No valid spawn point found for enemy type:', type);
                return null;
            }
            position = spawnPoint.clone();
        }

        const enemy = new Enemy(this.scene, type, position, this.environment);
        this.enemies.push(enemy);
        this.handleGroupAssignment(enemy, type);

        console.log(`Spawned enemy: ${type} at position (${position.x.toFixed(2)}, ${position.z.toFixed(2)})`);
        return enemy;
    }

    handleGroupAssignment(enemy, type) {
        if (!enemy) return;

        const typeConfig = ENEMY_TYPES[type];
        if (!typeConfig) return;
        if (type === 'BOSS' || type === 'COMMANDER') return;

        let groupProbability = 0;
        switch (type) {
            case 'GRUNT':
                groupProbability = 0.7;
                break;
            case 'SCOUT':
                groupProbability = 0.4;
                break;
            case 'SNIPER':
                groupProbability = 0.1;
                break;
            default:
                groupProbability = 0.3;
        }

        if (Math.random() < groupProbability) {
            const sameTypeGroups = this.findNearbyGroups(enemy, type, 20);

            if (sameTypeGroups.length > 0 && Math.random() < 0.7) {
                const groupId = sameTypeGroups[Math.floor(Math.random() * sameTypeGroups.length)];
                this.addEnemyToGroup(enemy, groupId);
            } else {
                const groupId = this.nextGroupId++;
                this.createGroup(groupId, enemy);
            }
        }
    }

    findNearbyGroups(enemy, type, maxDistance) {
        if (!enemy || !enemy.position) return [];

        const nearbyGroups = [];

        for (const [groupId, members] of Object.entries(this.enemyGroups)) {
            for (const member of members) {
                if (member.type === type && member.position.distanceTo(enemy.position) < maxDistance) {
                    nearbyGroups.push(parseInt(groupId, 10));
                    break;
                }
            }
        }

        return nearbyGroups;
    }

    createGroup(groupId, leader) {
        this.enemyGroups[groupId] = [leader];
        this.groupLeaders.set(groupId, leader);
        this.enemyToGroup.set(leader, groupId);
    }

    addEnemyToGroup(enemy, groupId) {
        if (!this.enemyGroups[groupId]) {
            this.enemyGroups[groupId] = [];
        }

        this.enemyGroups[groupId].push(enemy);
        this.enemyToGroup.set(enemy, groupId);
    }

    updateGroups() {
        for (const [groupId, members] of Object.entries(this.enemyGroups)) {
            const aliveMembers = members.filter(enemy => enemy && enemy.isAlive);
            this.enemyGroups[groupId] = aliveMembers;

            if (aliveMembers.length === 0) {
                delete this.enemyGroups[groupId];
                this.groupLeaders.delete(parseInt(groupId, 10));
                continue;
            }

            const leader = this.groupLeaders.get(parseInt(groupId, 10));
            if (!leader || !leader.isAlive) {
                this.groupLeaders.set(parseInt(groupId, 10), aliveMembers[0]);
            }

            const currentLeader = this.groupLeaders.get(parseInt(groupId, 10));
            if (currentLeader && currentLeader.state === 'ROAMING' && currentLeader.roamTargetPosition) {
                for (const member of aliveMembers) {
                    if (member !== currentLeader && member.state === 'ROAMING') {
                        member.roamTargetPosition.copy(currentLeader.roamTargetPosition).add(new THREE.Vector3(
                            (Math.random() - 0.5) * 3,
                            0,
                            (Math.random() - 0.5) * 3
                        ));
                    }
                }
            }
        }
    }

    getValidSpawnPoint() {
        const now = performance.now();
        let bestPoint = null;
        let bestScore = -Infinity;

        for (const point of this.spawnPoints) {
            if (this.spawnPointLastUse.has(point) && now - this.spawnPointLastUse.get(point) < this.spawnPointCooldown) {
                continue;
            }

            if (this.environment.checkWallCollision(point)) {
                continue;
            }

            const score = Math.random() * 20;
            if (score > bestScore) {
                bestScore = score;
                bestPoint = point;
            }
        }

        if (bestPoint) {
            this.spawnPointLastUse.set(bestPoint, now);
        }

        return bestPoint;
    }

    update(deltaTime) {
        const now = performance.now();

        if (
            this.spawnQueue.length > 0 &&
            now - this.lastSpawnTime > this.spawnCooldown &&
            this.enemies.length < this.maxEnemies
        ) {
            const type = this.spawnQueue.shift();
            this.spawnEnemy(type);
            this.lastSpawnTime = now;

            if (window.gameEngine && window.gameEngine.waveSystem) {
                const currentWave = window.gameEngine.waveSystem.wave;
                this.spawnCooldown = Math.max(400, 2000 - currentWave * 160);
            }
        }

        if (
            this.spawnQueue.length === 0 &&
            window.gameEngine &&
            window.gameEngine.waveSystem &&
            window.gameEngine.waveSystem.isSpawning
        ) {
            window.gameEngine.waveSystem.isSpawning = false;
            console.log('All enemies spawned, notifying wave system');
        }

        for (const enemy of this.enemies) {
            if (enemy && enemy.isAlive) {
                enemy.update(deltaTime, window.gameEngine?.player);
            }
        }

        // Commander rally: commanders in combat order nearby enemies to chase
        const player = window.gameEngine?.player;
        if (player) {
            const aggressiveStates = new Set(['CHASING', 'WINDUP', 'ATTACKING']);
            for (const commander of this.enemies) {
                if (!commander || !commander.isAlive) continue;
                const cfg = ENEMY_TYPES[commander.type.toUpperCase()];
                const commandRadius = cfg?.commandRadius;
                if (!commandRadius) continue;
                if (!aggressiveStates.has(commander.state)) continue;

                for (const other of this.enemies) {
                    if (other === commander || !other || !other.isAlive) continue;
                    if (other.type === 'COMMANDER' || other.type === 'BOSS') continue;
                    if (other.state === 'WINDUP' || other.state === 'ATTACKING') continue;
                    if (other.position.distanceTo(commander.position) > commandRadius) continue;
                    other.state = 'CHASING';
                }
            }
        }

        this.updateGroups();

        this.enemies = this.enemies.filter(enemy => {
            if (!enemy.isAlive) {
                this.enemyToGroup.delete(enemy);
                enemy.dispose();
                return false;
            }
            return true;
        });
    }

    reset() {
        console.log('Resetting enemy manager');

        this.enemies.forEach(enemy => enemy.dispose());
        this.enemies = [];
        this.spawnQueue = [];
        this.enemyGroups = [];
        this.groupLeaders = new Map();
        this.enemyToGroup = new Map();
        this.nextGroupId = 1;
        this.lastSpawnTime = 0;
        this.spawnCooldown = 2000;
        this.spawnPointLastUse.clear();
    }

    handleHit(enemy, damage) {
        if (!enemy || !enemy.isAlive) return false;

        const killed = enemy.takeDamage(damage);
        if (!killed) {
            return false;
        }

        if (window.gameEngine && window.gameEngine.waveSystem) {
            const waveSystemState = window.gameEngine.waveSystem.onEnemyKill(enemy.type);
            console.log('Enemy killed:', enemy.type, 'Wave system state:', waveSystemState);

            if (window.gameEngine.ui) {
                window.gameEngine.ui.updateScore(waveSystemState);
            }
        }

        return true;
    }
}

export { EnemyManager };
