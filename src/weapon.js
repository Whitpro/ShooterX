import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';

function createRifleModel() {
    const gunBody = new THREE.Group();
    const mainMaterial = new THREE.MeshPhongMaterial({ color: 0x2c3138, shininess: 40 });
    const accentMaterial = new THREE.MeshPhongMaterial({ color: 0x56606f, shininess: 70 });
    const gripMaterial = new THREE.MeshPhongMaterial({ color: 0x111418, shininess: 12 });

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.52), mainMaterial);
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.26), accentMaterial);
    handguard.position.z = -0.32;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.58, 10), gripMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.68;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.2), mainMaterial);
    stock.position.z = 0.34;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.2, 0.095), gripMaterial);
    grip.position.set(0, -0.16, 0.06);
    grip.rotation.x = -0.32;
    gunBody.add(receiver, handguard, barrel, stock, grip);
    gunBody.traverse(child => {
        if (child.isMesh) {
            child.receiveShadow = true;
            child.castShadow = true;
        }
    });
    return gunBody;
}

class Weapon {
    constructor(scene, camera, maxAmmo) {
        this.scene = scene;
        this.camera = camera;
        this.damage = 25;
        this.fireRate = 0.5;
        this._originalFireRate = 0.5;
        this.lastShot = 0;
        this.range = 100;
        this.ammo = 30;
        this.maxAmmo = typeof maxAmmo === 'number' ? maxAmmo : 30;
        this.infiniteAmmo = false;

        this.isReloading = false;
        this.reloadTime = 2000;
        this.reloadStartTime = 0;

        this.recoilAmount = 0.003;
        this.recoilRecoverySpeed = 0.08;
        this.maxRecoil = 0.015;
        this.currentRecoil = 0;
        this.isRecovering = false;
        this.originalRotation = new THREE.Euler();
        this.lastRecoilTime = 0;
        this.recoilCooldown = 100;

        this.positionOffset = new THREE.Vector3(0.2, -0.15, -0.3);
        this.rotationOffset = new THREE.Euler(0, 0, 0);
        this.bobAmount = 0.02;
        this.bobSpeed = 0.1;
        this.bobTime = 0;

        this._raycaster = new THREE.Raycaster();
        this._aimVector = new THREE.Vector2(0, 0);
        this._shotStart = new THREE.Vector3();
        this._shotEnd = new THREE.Vector3();
        this._trailMidpoint = new THREE.Vector3();
        this._direction = new THREE.Vector3();
        this._tmpVelocity = new THREE.Vector3();
        this._bulletLineHideAt = 0;
        this._rapidfireTimeout = null;
        this._maxAmmoTimeout = null;

        this.createModel();

        const lineGeometry = new THREE.BufferGeometry();
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xffff00,
            linewidth: 5,
            opacity: 0.8,
            transparent: true
        });
        this.bulletLine = new THREE.Line(lineGeometry, lineMaterial);
        this.bulletLine.visible = false;
        this.scene.add(this.bulletLine);

        this.trailDuration = 200;
        this.trailPool = [];
        this.trailMaterialFactory = () => new THREE.LineBasicMaterial({
            color: 0xffffaa,
            transparent: true,
            opacity: 0.6
        });
        this.initializeTrailPool(24);

        this.hitParticleGeometry = new THREE.SphereGeometry(0.04, 8, 8);
        this.hitParticlePool = [];
        this.initializeHitParticlePool(60);

        this.hitFlashGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        this.hitFlashPool = [];
        this.initializeFlashPool(this.hitFlashPool, 6, this.hitFlashGeometry, 0xffff00, this.scene);

        this.muzzleFlashGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        this.muzzleFlashPool = [];
        this.initializeFlashPool(this.muzzleFlashPool, 4, this.muzzleFlashGeometry, 0xffff00, this.model, 0.8);

    }

    createModel() {
        this.model = createRifleModel();
        this.model.position.copy(this.positionOffset);
        this.model.rotation.copy(this.rotationOffset);
        this.camera.add(this.model);
        if (!this.scene.children.includes(this.camera)) this.scene.add(this.camera);
    }

    initializeTrailPool(size) {
        for (let i = 0; i < size; i++) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
            const material = this.trailMaterialFactory();
            const line = new THREE.Line(geometry, material);
            line.visible = false;
            this.scene.add(line);
            this.trailPool.push({ mesh: line, active: false, createdAt: 0, duration: this.trailDuration });
        }
    }

    initializeHitParticlePool(size) {
        for (let i = 0; i < size; i++) {
            const material = new THREE.MeshBasicMaterial({
                color: 0xff4500,
                transparent: true,
                opacity: 0.9
            });
            const particle = new THREE.Mesh(this.hitParticleGeometry, material);
            particle.visible = false;
            particle.userData.velocity = new THREE.Vector3();
            particle.userData.life = 0;
            particle.userData.duration = 0;
            this.scene.add(particle);
            this.hitParticlePool.push(particle);
        }
    }

    initializeFlashPool(pool, size, geometry, color, parent, baseOpacity = 0.7) {
        for (let i = 0; i < size; i++) {
            const material = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: baseOpacity
            });
            const flash = new THREE.Mesh(geometry, material);
            flash.visible = false;
            flash.userData.life = 0;
            flash.userData.duration = 0;
            flash.userData.baseOpacity = baseOpacity;
            parent.add(flash);
            pool.push(flash);
        }
    }

    acquireTrail() {
        return this.trailPool.find(trail => !trail.active) || this.trailPool[0];
    }

    acquireParticle() {
        return this.hitParticlePool.find(particle => !particle.visible) || this.hitParticlePool[0];
    }

    acquireFlash(pool) {
        return pool.find(flash => !flash.visible) || pool[0];
    }

    shoot(enemyManager) {
        const currentTime = performance.now() / 1000;

        if (this.isReloading || currentTime - this.lastShot < this.fireRate || (this.ammo <= 0 && !this.infiniteAmmo)) {

            return { fired: false, hit: false, killed: false };
        }


        if (!this.infiniteAmmo) {
            this.ammo--;
        }
        this.lastShot = currentTime;

        if (window.gameEngine) {
            window.gameEngine.applyScreenShake(0.1, 100);
        }

        this._raycaster.setFromCamera(this._aimVector, this.camera);

        const enemyMeshes = [];
        if (enemyManager && enemyManager.enemies) {
            enemyManager.enemies.forEach(enemy => {
                if (enemy.model) {
                    enemyMeshes.push(enemy.model);
                }
            });
        } else {
            console.warn('No valid enemy manager or enemies available');
        }

        const intersects = this._raycaster.intersectObjects(enemyMeshes, true);

        this._shotStart.copy(this.camera.position);
        this._shotEnd.copy(this._shotStart).addScaledVector(this._raycaster.ray.direction, this.range);

        let hit = false;
        let killed = false;

        if (intersects.length > 0) {
            const hitObject = intersects[0].object;
            const hitEnemy = hitObject.userData.enemy;
            this._shotEnd.copy(intersects[0].point);

            if (hitEnemy) {

                this.createHitEffect(this._shotEnd);
                killed = enemyManager.handleHit(hitEnemy, this.damage);
                if (window.gameEngine && window.gameEngine.onShotHit) {
                    window.gameEngine.onShotHit();
                }
                hit = true;
            } else {
                console.warn('Hit object not mapped to an enemy:', hitObject);
            }
        }

        this.createBulletTrail(this._shotStart, this._shotEnd);
        this.updateBulletLine(this._shotStart, this._shotEnd);
        this.createMuzzleFlash();
        this.addRecoil();

        return { fired: true, hit, killed };
    }

    updateBulletLine(startPosition, endPosition) {
        const positions = this.bulletLine.geometry.attributes.position.array;
        positions[0] = startPosition.x;
        positions[1] = startPosition.y;
        positions[2] = startPosition.z;
        positions[3] = endPosition.x;
        positions[4] = endPosition.y;
        positions[5] = endPosition.z;
        this.bulletLine.geometry.attributes.position.needsUpdate = true;
        this.bulletLine.visible = true;
        this._bulletLineHideAt = performance.now() + 50;
    }

    createBulletTrail(startPos, endPos) {
        const trail = this.acquireTrail();
        const positions = trail.mesh.geometry.attributes.position.array;
        positions[0] = startPos.x;
        positions[1] = startPos.y;
        positions[2] = startPos.z;
        positions[3] = endPos.x;
        positions[4] = endPos.y;
        positions[5] = endPos.z;
        trail.mesh.geometry.attributes.position.needsUpdate = true;
        trail.mesh.material.opacity = 0.6;
        trail.mesh.visible = true;
        trail.active = true;
        trail.createdAt = performance.now();
        trail.duration = this.trailDuration;
    }

    createHitEffect(position) {
        const particleCount = 15;

        for (let i = 0; i < particleCount; i++) {
            const particle = this.acquireParticle();
            particle.visible = true;
            particle.position.copy(position);
            particle.position.x += (Math.random() - 0.5) * 0.3;
            particle.position.y += (Math.random() - 0.5) * 0.3;
            particle.position.z += (Math.random() - 0.5) * 0.3;
            particle.scale.set(1, 1, 1);
            particle.material.opacity = 0.9;

            particle.userData.velocity.copy(particle.position).sub(position).normalize().multiplyScalar(0.15 + Math.random() * 0.25);
            particle.userData.life = 0;
            particle.userData.duration = 250;
        }

        const flash = this.acquireFlash(this.hitFlashPool);
        flash.visible = true;
        flash.position.copy(position);
        flash.scale.set(1, 1, 1);
        flash.material.opacity = flash.userData.baseOpacity;
        flash.userData.life = 0;
        flash.userData.duration = 120;
    }

    createMuzzleFlash() {
        const flash = this.acquireFlash(this.muzzleFlashPool);
        flash.visible = true;
        flash.position.set(0, 0, -0.98);
        flash.scale.set(1, 1, 1);
        flash.material.opacity = flash.userData.baseOpacity;
        flash.userData.life = 0;
        flash.userData.duration = 50;
    }

    addRecoil() {
        // Do nothing - no recoil with non-rotating camera
    }

    recoverFromRecoil() {
        // Do nothing - no recoil with non-rotating camera
    }

    update(deltaTime, playerVelocity) {
        this.updateBulletTrails();
        this.updateHitEffects(deltaTime);
        this.updateFlashes(deltaTime);

        if (this.bulletLine.visible && performance.now() >= this._bulletLineHideAt) {
            this.bulletLine.visible = false;
        }

        if (window.gameEngine && window.gameEngine.player) {
            const playerViewMode = window.gameEngine.player.viewMode;
            this.model.visible = playerViewMode !== 'thirdPerson';
        }

        if (!this.model.visible) return;

        if (this.currentRecoil > 0) {
            this.recoverFromRecoil();
        }

        if (playerVelocity) {
            const speed = Math.sqrt(playerVelocity.x * playerVelocity.x + playerVelocity.z * playerVelocity.z);

            if (speed > 0.5) {
                this.bobTime += deltaTime * this.bobSpeed * (speed / 5);
                const bobX = Math.sin(this.bobTime * 2) * this.bobAmount * speed;
                const bobY = Math.sin(this.bobTime * 4) * this.bobAmount * speed;
                this.model.position.x = this.positionOffset.x + bobX;
                this.model.position.y = this.positionOffset.y + bobY;
            } else {
                this.model.position.x = THREE.MathUtils.lerp(this.model.position.x, this.positionOffset.x, deltaTime * 5);
                this.model.position.y = THREE.MathUtils.lerp(this.model.position.y, this.positionOffset.y, deltaTime * 5);
            }
        }

        if (this.isReloading) {
            const elapsed = performance.now() - this.reloadStartTime;
            const progress = Math.min(1, elapsed / this.reloadTime);

            if (progress < 0.5) {
                const downAmount = Math.sin(progress * Math.PI) * 0.2;
                const rotateAmount = progress * 0.3;
                this.model.position.y = this.positionOffset.y - downAmount;
                this.model.rotation.x = this.rotationOffset.x + rotateAmount;
            } else {
                const upProgress = (progress - 0.5) * 2;
                const downAmount = Math.sin((1 - upProgress) * Math.PI) * 0.2;
                const rotateAmount = (1 - upProgress) * 0.3;
                this.model.position.y = this.positionOffset.y - downAmount;
                this.model.rotation.x = this.rotationOffset.x + rotateAmount;
            }

            if (progress >= 1) {
                this.isReloading = false;
                this.ammo = this.maxAmmo;
                this.model.position.copy(this.positionOffset);
                this.model.rotation.copy(this.rotationOffset);
            }
        }
    }

    updateHitEffects(deltaTime) {
        const deltaMs = deltaTime * 1000;

        for (const particle of this.hitParticlePool) {
            if (!particle.visible) continue;
            particle.userData.life += deltaMs;
            particle.position.addScaledVector(particle.userData.velocity, deltaTime * 60);
            particle.scale.multiplyScalar(0.97);
            particle.material.opacity = Math.max(0, 0.9 * (1 - particle.userData.life / particle.userData.duration));

            if (particle.userData.life >= particle.userData.duration) {
                particle.visible = false;
                particle.material.opacity = 0.9;
                particle.scale.set(1, 1, 1);
            }
        }
    }

    updateFlashes(deltaTime) {
        const deltaMs = deltaTime * 1000;
        const updatePool = pool => {
            for (const flash of pool) {
                if (!flash.visible) continue;
                flash.userData.life += deltaMs;
                const progress = flash.userData.life / flash.userData.duration;
                flash.scale.multiplyScalar(1.1);
                flash.material.opacity = Math.max(0, flash.userData.baseOpacity * (1 - progress));

                if (flash.userData.life >= flash.userData.duration) {
                    flash.visible = false;
                    flash.material.opacity = flash.userData.baseOpacity;
                    flash.scale.set(1, 1, 1);
                }
            }
        };

        updatePool(this.hitFlashPool);
        updatePool(this.muzzleFlashPool);
    }

    reload() {
        if (this.ammo < this.maxAmmo && !this.isReloading && !this.infiniteAmmo) {
            this.isReloading = true;
            this.reloadStartTime = performance.now();

            if (window.gameEngine && window.gameEngine.ui) {
                window.gameEngine.ui.showReloadIndicator(this.reloadTime);
            }

            return true;
        }
        return false;
    }

    reset() {


        if (this._rapidfireTimeout) {
            clearTimeout(this._rapidfireTimeout);
            this._rapidfireTimeout = null;
        }

        if (this._maxAmmoTimeout) {
            clearTimeout(this._maxAmmoTimeout);
            this._maxAmmoTimeout = null;
        }

        this.ammo = this.maxAmmo;
        this.lastShot = 0;
        this.currentRecoil = 0;
        this.isRecovering = false;
        this.isReloading = false;
        this.reloadStartTime = 0;
        this.fireRate = this._originalFireRate;
        this.infiniteAmmo = false;
        this._bulletLineHideAt = 0;

        if (this.model) {
            this.model.position.copy(this.positionOffset);
            this.model.rotation.copy(this.rotationOffset);
        }

        if (this.camera) {
            this.camera.rotation.copy(this.originalRotation);
        }

        if (this.bulletLine) {
            this.bulletLine.visible = false;
            this.bulletLine.geometry.attributes.position.array.fill(0);
            this.bulletLine.geometry.attributes.position.needsUpdate = true;
        }

        this.trailPool.forEach(trail => {
            trail.active = false;
            trail.mesh.visible = false;
            trail.mesh.material.opacity = 0.6;
        });

        this.hitParticlePool.forEach(particle => {
            particle.visible = false;
            particle.material.opacity = 0.9;
            particle.scale.set(1, 1, 1);
            particle.userData.life = 0;
        });

        const resetFlashPool = pool => {
            pool.forEach(flash => {
                flash.visible = false;
                flash.material.opacity = flash.userData.baseOpacity;
                flash.scale.set(1, 1, 1);
                flash.userData.life = 0;
            });
        };

        resetFlashPool(this.hitFlashPool);
        resetFlashPool(this.muzzleFlashPool);
        this.bobTime = 0;

    }

    updateBulletTrails() {
        const currentTime = performance.now();

        for (const trail of this.trailPool) {
            if (!trail.active) continue;

            const age = currentTime - trail.createdAt;
            if (age > trail.duration) {
                trail.active = false;
                trail.mesh.visible = false;
                trail.mesh.material.opacity = 0.6;
                continue;
            }

            trail.mesh.visible = true;
            trail.mesh.material.opacity = 1 - age / trail.duration;
        }
    }

    increaseMaxAmmo(amount) {
        this.maxAmmo += amount;
        this.ammo = Math.min(this.maxAmmo, this.ammo + amount);
    }
}

export { createRifleModel };
export default Weapon;
