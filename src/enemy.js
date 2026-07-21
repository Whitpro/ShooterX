import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';
import { ENEMY_TYPES, createEnemyMesh } from './enemyTypes.js';

class Enemy {
    constructor(scene, type, position, environment = null) {
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
        this.speed = config.speed || 2;
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

        this.roamingConfig = config.behavior?.roaming || {
            radius: 15,
            speedMultiplier: 0.6,
            changeTimeMin: 3000,
            changeTimeMax: 7000
        };

        this.chaseSpeedMultiplier = 0.8;
        this.state = 'ROAMING';
        this.roamTargetPosition = null;
        this.roamRadius = this.roamingConfig.radius;
        this.roamingSpeed = this.speed * this.roamingConfig.speedMultiplier;
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

    createModel() {
        this.model = createEnemyMesh(this.type.toUpperCase());
        if (!this.model) return;

        this.model.position.copy(this.position);
        const config = ENEMY_TYPES[this.type.toUpperCase()];
        const height = config.model.geometry.parameters ? config.model.geometry.parameters.height / 2 : 1.0;
        this.model.position.y = height;
        this.model.userData.type = 'enemy';
        this.model.userData.enemy = this;
        this.scene.add(this.model);

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
        const height = config.model.geometry.parameters ? config.model.geometry.parameters.height / 2 : 1.0;
        this.model.position.y = height;

        this._playerPosition.copy(player.position || player.camera.position);
        this._toPlayer.subVectors(this._playerPosition, this.position);
        const distanceToPlayer = this._toPlayer.length();

        if (distanceToPlayer <= this.attackRange) {
            this.state = 'ATTACKING';
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
                this.velocity.copy(this._toPlayer).multiplyScalar(this.speed * this.chaseSpeedMultiplier * clampedDeltaTime);
                this.tryMove(this.velocity);
                this.updateRotation(this._toPlayer);
                break;
            case 'ATTACKING':
                this._toPlayer.normalize();
                this.updateRotation(this._toPlayer);
                if (this.attackCooldown <= 0) {
                    this.attack(player);
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
        const height = config.model.geometry.parameters ? config.model.geometry.parameters.height / 2 : 1.0;
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
            player.takeDamage(this.damage);
            this.attackCooldown = this.attackDelay;
        }
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
        this.healthBarContainer = null;
        this.healthBarBackground = null;
        this.healthBarForeground = null;
        this.healthBarBorder = null;
        this.healthBarTextures = null;
    }
}

export default Enemy;
