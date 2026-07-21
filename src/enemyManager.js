import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';
import Enemy from './enemy.js';
import { ENEMY_TYPES } from './enemyTypes.js';

class EnemyManager {
    constructor(scene, environment) {
        this.scene = scene;
        this.environment = environment;
        this.enemies = [];
        this.lastSpawnTime = 0;
        this.spawnCooldown = 2000;
        this.maxEnemies = 10;

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
            case 'HEAVY':
                groupProbability = 0.3;
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
                this.spawnCooldown = Math.max(500, 2000 - currentWave * 300);
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

export default EnemyManager;
