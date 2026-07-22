import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';
import { ENEMY_TYPES, createEnemyMesh } from './enemyTypes.js';
import Enemy from './enemy.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

class BossFight {
    constructor(scene, environment, enemyManager) {
        this.scene = scene;
        this.environment = environment;
        this.enemyManager = enemyManager;

        this.boss = null;
        this.state = 'IDLE';
        this.shieldMesh = null;
        this.shieldHp = 300;
        this.maxShieldHp = 300;
        this.shieldRegenerating = false;

        this.phase = 1;

        this.ringPool = [];
        this.projectilePool = [];

        this._ringTimer = 0;
        this._ballTimer = 0;
        this._idleTimer = 0;
        this._introElapsed = 0;
        this._impactDone = false;
        this._startY = 0;

        this._onDefeated = null;
    }

    start() {
        const engine = window.gameEngine;
        if (!engine) return;

        // Clean up any previous boss state (handles re-calling start without reset)
        this._cleanup();
        if (this.boss && this.boss.model) {
            this.scene.remove(this.boss.model);
        }
        this.boss = null;

        this.state = 'INTRO';
        this._introElapsed = 0;
        this._impactDone = false;
        this.phase = 1;
        this.shieldHp = this.maxShieldHp;
        this.shieldRegenerating = false;
        this._ringTimer = 3;
        this._ballTimer = 2;

        engine.isPaused = true;
        engine._cutsceneActive = true;
        document.exitPointerLock();

        const type = 'BOSS';
        const cfg = ENEMY_TYPES[type];
        const mesh = createEnemyMesh(type);
        this._startY = 35;
        mesh.position.set(0, this._startY, 0);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.boss = new Enemy(this.scene, type, mesh.position, this.environment);
        // Remove default model created by Enemy constructor — we use our own
        if (this.boss.model) {
            this.scene.remove(this.boss.model);
        }
        // Assign custom boss mesh with proper raycast target
        this.boss.model = mesh;
        mesh.userData.type = 'enemy';
        mesh.userData.enemy = this.boss;
        this.scene.add(mesh);
        this.boss.position.copy(mesh.position);
        this.boss._bossFight = this;
        this.boss.health = cfg.health;
        this.boss.maxHealth = cfg.health;
        this.boss.isAlive = true;
        this.boss.state = 'ROAMING';
        this.enemyManager.enemies.push(this.boss);

        this._createShield();

        this.boss.model.position.y = this._startY;
        this.boss.position.y = this._startY;

        engine._bossFightInstance = this;
    }

    update(deltaTime) {
        if (this.state === 'IDLE' || !this.boss) return;

        switch (this.state) {
            case 'INTRO':
                if (!this.boss.isAlive) return;
                this._updateIntro(deltaTime);
                break;
            case 'ATTACKING':
                if (!this.boss.isAlive) return;
                this._updateAttacking(deltaTime);
                break;
            case 'DEFEATED':
                this._updateDefeated(deltaTime);
                break;
        }

        if (this.state === 'ATTACKING' || this.state === 'INTRO') {
            this._updateRings(deltaTime);
            this._updateProjectiles(deltaTime);
            this._updateShieldVisual();
        }
    }

    _updateIntro(deltaTime) {
        this._introElapsed += deltaTime;

        // Force player camera to look at boss throughout the intro
        const engine = window.gameEngine;
        if (engine && engine.player && this.boss) {
            const player = engine.player;
            _v.subVectors(this.boss.position, player.position).normalize();
            player.lookDirection.copy(_v);
            player.updateCameraPosition(engine.environment);
            player.applyCameraTarget(true);
        }

        if (this._introElapsed < 0.5) {
            const overlay = document.getElementById('bossIntroOverlay');
            if (overlay) overlay.style.opacity = Math.min(1, this._introElapsed * 4);
        }

        if (this._introElapsed < 2.0) {
            const t = this._introElapsed / 2.0;
            const y = this._startY - t * t * (this._startY - 1.7);
            this.boss.model.position.y = y;
            this.boss.position.y = y;
            this.boss.model.rotation.z = Math.sin(t * Math.PI * 4) * 0.1;
        } else if (!this._impactDone) {
            this._impactDone = true;
            this.boss.model.position.y = 1.7;
            this.boss.position.y = 1.7;
            this.boss.model.rotation.z = 0;

            if (window.gameEngine) {
                window.gameEngine.applyScreenShake(0.3, 500);
            }

            const cfg = ENEMY_TYPES['BOSS'];
            const height = cfg.model.height || 2.8;
            this.boss.model.position.y = height / 2;
            this.boss.position.y = height / 2;

            const overlay = document.getElementById('bossIntroOverlay');
            if (overlay) overlay.style.opacity = 0;
        }

        if (this._introElapsed > 2.8) {
            this._endIntro();
        }
    }

    _endIntro() {
        this.state = 'ATTACKING';
        const engine = window.gameEngine;
        if (engine) {
            engine._cutsceneActive = false;
            engine.isPaused = false;
            if (engine.player) {
                engine.player.setPaused(false);
            }
            if (engine.ui) {
                engine.ui.hideAllMenus();
                engine.ui.showGameplayUI();
            }
        }
        if (this.ui) this.ui.showBossHealthBar(this.boss);
        this._idleTimer = 1.5;
    }

    _updateAttacking(deltaTime) {
        if (!this.boss || !this.boss.isAlive) return;

        this._idleTimer -= deltaTime;
        if (this._idleTimer > 0) return;

        const cfg = ENEMY_TYPES['BOSS'];

        this._ringTimer -= deltaTime;
        this._ballTimer -= deltaTime;

        const phaseMultiplier = this.phase === 1 ? 1 : this.phase === 2 ? 0.8 : 0.6;

        if (this._ringTimer <= 0) {
            this._spawnRing();
            this._ringTimer = (4 + Math.random() * 2) * phaseMultiplier;
            this._idleTimer = 1.5;
        } else if (this._ballTimer <= 0) {
            const count = this.phase;
            this._fireProjectiles(count);
            this._ballTimer = (4 + Math.random() * 1.5) * phaseMultiplier;
            this._idleTimer = 1.5;
        }
    }

    _spawnRing() {
        if (!this.boss || !this.boss.isAlive) return;

        const ring = this._acquireRing();
        const pos = this.boss.position.clone();
        pos.y = 0.1;
        ring.mesh.position.copy(pos);
        ring.mesh.visible = true;
        ring.mesh.scale.set(1, 1, 1);
        ring.mesh.material.opacity = 0.9;
        ring.active = true;
        ring.elapsed = 0;
        ring.radius = 0;
        ring.maxRadius = 40;
        ring.duration = 1.5;
    }

    _acquireRing() {
        let ring = this.ringPool.find(r => !r.active);
        if (ring) return ring;

        const geo = new THREE.RingGeometry(0.05, 0.35, 32);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        this.scene.add(mesh);
        mesh.visible = false;

        ring = { mesh, active: false, elapsed: 0, radius: 0, maxRadius: 28, duration: 1.5 };
        this.ringPool.push(ring);
        return ring;
    }

    _updateRings(deltaTime) {
        for (const ring of this.ringPool) {
            if (!ring.active) continue;
            ring.elapsed += deltaTime;
            const progress = ring.elapsed / ring.duration;

            if (progress >= 1) {
                ring.active = false;
                ring.mesh.visible = false;
                continue;
            }

            const scale = progress * (ring.maxRadius / 0.35);
            ring.mesh.scale.set(scale, scale, scale);
            ring.mesh.material.opacity = 0.9 * (1 - progress);

            if (progress > 0.15 && progress < 0.8) {
                this._checkRingHit(ring);
            }
        }
    }

    _checkRingHit(ring) {
        const player = window.gameEngine?.player;
        if (!player) return;

        const ringWorldR = ring.radius + (ring.maxRadius - ring.radius) * (ring.elapsed / ring.duration);
        _v.copy(ring.mesh.position);
        _v2.copy(player.position);
        _v2.y = 0;
        const dist = _v.distanceTo(_v2);

        const tolerance = 1.0;
        if (Math.abs(dist - ringWorldR) < tolerance && player.position.y <= 1.5) {
            player.takeDamage(20, this.boss.position.clone());
            _v2.subVectors(player.position, this.boss.position).normalize().multiplyScalar(8);
            _v2.y = 2;
            const newPos = player.position.clone().add(_v2);
            if (this.environment && !this.environment.checkWallCollision(newPos)) {
                player.position.copy(newPos);
            }
            ring.active = false;
            ring.mesh.visible = false;
        }
    }

    _fireProjectiles(count) {
        if (!this.boss || !this.boss.isAlive) return;
        const player = window.gameEngine?.player;
        if (!player) return;

        for (let i = 0; i < count; i++) {
            const proj = this._acquireProjectile();
            proj.mesh.position.copy(this.boss.position);
            proj.mesh.position.y += 1.5;

            const spread = (i - (count - 1) / 2) * 0.15;
            const dir = new THREE.Vector3().subVectors(player.position, proj.mesh.position).normalize();
            const angle = Math.atan2(dir.x, dir.z) + spread;
            proj.direction.set(Math.sin(angle), 0, Math.cos(angle));
            proj.direction.y = -0.1;

            proj.mesh.visible = true;
            proj.active = true;
            proj.life = 0;
            proj.maxLife = 3;
            proj.speed = 25;
        }
    }

    _acquireProjectile() {
        let proj = this.projectilePool.find(p => !p.active);
        if (proj) return proj;

        const geo = new THREE.SphereGeometry(0.18, 8, 8);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 1
        });
        const mesh = new THREE.Mesh(geo, mat);
        this.scene.add(mesh);
        mesh.visible = false;

        proj = { mesh, active: false, direction: new THREE.Vector3(), speed: 15, life: 0, maxLife: 3 };
        this.projectilePool.push(proj);
        return proj;
    }

    _updateProjectiles(deltaTime) {
        const player = window.gameEngine?.player;
        for (const proj of this.projectilePool) {
            if (!proj.active) continue;
            proj.life += deltaTime;

            if (proj.life >= proj.maxLife) {
                proj.active = false;
                proj.mesh.visible = false;
                continue;
            }

            proj.mesh.position.addScaledVector(proj.direction, proj.speed * deltaTime);

            if (this.environment && this.environment.checkWallCollision(proj.mesh.position)) {
                proj.active = false;
                proj.mesh.visible = false;
                continue;
            }

            if (player) {
                _v.copy(proj.mesh.position);
                _v2.copy(player.position);
                _v2.y += 1;
                if (_v.distanceTo(_v2) < 0.6) {
                    player.takeDamage(15, this.boss.position.clone());
                    proj.active = false;
                    proj.mesh.visible = false;
                }
            }
        }
    }

    _createShield() {
        if (this.shieldMesh) {
            this.boss.model.remove(this.shieldMesh);
            this.shieldMesh.geometry.dispose();
            this.shieldMesh.material.dispose();
        }
        const geo = new THREE.SphereGeometry(0.85, 16, 16);
        const mat = new THREE.MeshPhongMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.25,
            emissive: 0x2244aa,
            emissiveIntensity: 0.3,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.shieldMesh = new THREE.Mesh(geo, mat);
        this.shieldMesh.raycast = () => {};
        this.boss.model.add(this.shieldMesh);
    }

    _updateShieldVisual() {
        if (!this.shieldMesh) return;
        if (this.shieldHp <= 0) {
            this.shieldMesh.visible = false;
            return;
        }
        this.shieldMesh.visible = true;
        const ratio = this.shieldHp / this.maxShieldHp;
        this.shieldMesh.material.opacity = 0.15 + ratio * 0.3;
        this.shieldMesh.material.emissiveIntensity = 0.2 + ratio * 0.5;
        const pulse = 1 + Math.sin(performance.now() * 0.003) * 0.03;
        this.shieldMesh.scale.setScalar(pulse);
    }

    handleHit(damage) {
        if (!this.boss || !this.boss.isAlive) return false;

        if (this.shieldHp > 0) {
            this.shieldHp = Math.max(0, this.shieldHp - damage);
            this.shieldMesh.material.opacity = 0.15 + (this.shieldHp / this.maxShieldHp) * 0.3;
            if (this.shieldHp <= 0) {
                this._breakShield();
            }
            if (this.ui) this.ui.updateBossHealthBar(this.shieldHp, this.boss.health);
            return false;
        }

        const killed = this.boss.takeDamage(damage);
        if (this.ui) this.ui.updateBossHealthBar(0, this.boss.health);

        if (killed) {
            this._onBossDefeated();
            return true;
        }

        this._checkPhaseTransition();
        return false;
    }

    _breakShield() {
        this.shieldMesh.visible = false;
        if (window.gameEngine) {
            window.gameEngine.applyScreenShake(0.12, 200);
        }
    }

    _checkPhaseTransition() {
        if (!this.boss) return;
        const hpRatio = this.boss.health / this.boss.maxHealth;

        let newPhase = this.phase;
        if (hpRatio <= 0.33) newPhase = 3;
        else if (hpRatio <= 0.66) newPhase = 2;

        if (newPhase !== this.phase) {
            this.phase = newPhase;
            this.shieldHp = this.maxShieldHp;
            this.shieldRegenerating = false;
            this._createShield();
        }
    }

    _onBossDefeated() {
        this.state = 'DEFEATED';
        this._defeatedTimer = 0;

        for (const ring of this.ringPool) {
            ring.active = false;
            ring.mesh.visible = false;
        }
        for (const proj of this.projectilePool) {
            proj.active = false;
            proj.mesh.visible = false;
        }

        if (this.ui) this.ui.hideBossHealthBar();

        const engine = window.gameEngine;
        if (engine) {
            engine.applyScreenShake(0.3, 600);
        }
        if (this.boss && this.boss.model) {
            this.boss.model.rotation.x = Math.PI / 2;
        }
    }

    _updateDefeated(deltaTime) {
        this._defeatedTimer += deltaTime;
        if (this._defeatedTimer > 2.0) {
            if (this.boss && this.boss.model) {
                this.boss.model.visible = false;
                this.scene.remove(this.boss.model);
            }
            this.state = 'IDLE';
        }
    }

    _cleanup() {
        for (const ring of this.ringPool) {
            this.scene.remove(ring.mesh);
            ring.mesh.geometry.dispose();
            ring.mesh.material.dispose();
        }
        this.ringPool = [];
        for (const proj of this.projectilePool) {
            this.scene.remove(proj.mesh);
            proj.mesh.geometry.dispose();
            proj.mesh.material.dispose();
        }
        this.projectilePool = [];
        if (this.shieldMesh) {
            this.shieldMesh.geometry.dispose();
            this.shieldMesh.material.dispose();
        }
        this.shieldMesh = null;
    }

    reset() {
        if (this.ui) {
            this.ui.hideBossHealthBar();
        }
        this._cleanup();
        this.boss = null;
        this.state = 'IDLE';
        this.phase = 1;
        this.shieldHp = this.maxShieldHp;
        this._ringTimer = 0;
        this._ballTimer = 0;
        this._idleTimer = 0;
        this._introElapsed = 0;
        this._impactDone = false;
        if (window.gameEngine) window.gameEngine._bossFightInstance = null;
    }
}

export default BossFight;
