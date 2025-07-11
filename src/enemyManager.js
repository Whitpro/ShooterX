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
        
        // Spawn system
        this.spawnQueue = [];
        this.isSpawning = false;
        this.spawnPoints = [];
        this.spawnPointCooldown = 5000; // 5 seconds cooldown for spawn points
        this.spawnPointLastUse = new Map();
        this.minSpawnDistance = 15;
        this.spawnAreaRadius = 25;
        
        // Group behavior system
        this.enemyGroups = [];
        this.groupLeaders = new Map(); // Maps group ID to leader enemy
        this.enemyToGroup = new Map(); // Maps enemy to group ID
        this.nextGroupId = 1;
        
        // Initialize spawn points in a more dynamic way
        this.initializeSpawnPoints();
    }

    initializeSpawnPoints() {
        // Create spawn points in rings for better distribution
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
                
                // Only add point if it's in a valid position
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

    spawnEnemy(type, position) {
        // If no specific position provided, use spawn point system
        if (!position) {
            const spawnPoint = this.getValidSpawnPoint();
            if (!spawnPoint) {
                console.warn('No valid spawn point found for enemy type:', type);
                return null;
            }
            position = spawnPoint.clone();
        }

        // Create the enemy
        const enemy = new Enemy(this.scene, type, position);
        this.enemies.push(enemy);
        
        // Decide if this enemy should be part of a group
        // Different enemy types have different group behavior
        this.handleGroupAssignment(enemy, type);
        
        console.log(`Spawned enemy: ${type} at position (${position.x.toFixed(2)}, ${position.z.toFixed(2)})`);
        return enemy;
    }
    
    handleGroupAssignment(enemy, type) {
        if (!enemy) return;
        
        // Check enemy type to determine group behavior
        const typeConfig = ENEMY_TYPES[type];
        if (!typeConfig) return;
        
        // Skip grouping for boss and commander types
        if (type === 'BOSS' || type === 'COMMANDER') return;
        
        // Group probability varies by type
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
        
        // Determine if this enemy joins a group
        if (Math.random() < groupProbability) {
            // First, check if there's an existing group of the same type nearby
            const sameTypeGroups = this.findNearbyGroups(enemy, type, 20);
            
            if (sameTypeGroups.length > 0 && Math.random() < 0.7) {
                // Join an existing group
                const groupId = sameTypeGroups[Math.floor(Math.random() * sameTypeGroups.length)];
                this.addEnemyToGroup(enemy, groupId);
            } else {
                // Create a new group with this enemy as leader
                const groupId = this.nextGroupId++;
                this.createGroup(groupId, enemy);
            }
        }
    }
    
    findNearbyGroups(enemy, type, maxDistance) {
        if (!enemy || !enemy.position) return [];
        
        const nearbyGroups = [];
        
        // Check each group to see if it has members of the same type nearby
        for (const [groupId, members] of Object.entries(this.enemyGroups)) {
            for (const member of members) {
                if (member.type === type && 
                    member.position.distanceTo(enemy.position) < maxDistance) {
                    nearbyGroups.push(parseInt(groupId));
                    break; // Found one member of this group nearby, no need to check others
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
        // Update group roaming behaviors
        for (const [groupId, members] of Object.entries(this.enemyGroups)) {
            // Remove dead members
            const aliveMembers = members.filter(enemy => enemy && enemy.isAlive);
            this.enemyGroups[groupId] = aliveMembers;
            
            // Skip empty groups
            if (aliveMembers.length === 0) {
                delete this.enemyGroups[groupId];
                this.groupLeaders.delete(parseInt(groupId));
                continue;
            }
            
            // Check if leader is still alive
            const leader = this.groupLeaders.get(parseInt(groupId));
            if (!leader || !leader.isAlive) {
                // Assign a new leader
                const newLeader = aliveMembers[0];
                this.groupLeaders.set(parseInt(groupId), newLeader);
            }
            
            // Only coordinate roaming if leader is in ROAMING state
            const currentLeader = this.groupLeaders.get(parseInt(groupId));
            if (currentLeader && currentLeader.state === 'ROAMING') {
                // Share leader's roam target with other members
                for (const member of aliveMembers) {
                    if (member !== currentLeader && member.state === 'ROAMING') {
                        // Add some variation to prevent perfect overlap
                        if (currentLeader.roamTargetPosition) {
                            const offset = new THREE.Vector3(
                                (Math.random() - 0.5) * 3,
                                0,
                                (Math.random() - 0.5) * 3
                            );
                            
                            member.roamTargetPosition = currentLeader.roamTargetPosition.clone().add(offset);
                        }
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
            // Skip points that are on cooldown
            if (this.spawnPointLastUse.has(point) && 
                now - this.spawnPointLastUse.get(point) < this.spawnPointCooldown) {
                continue;
            }

            // Skip points too close to walls
            if (this.environment.checkWallCollision(point)) {
                continue;
            }

            let score = Math.random() * 20; // Add some randomness
            
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

        // Process spawn queue with adjusted timing for 5-wave system
        if (this.spawnQueue.length > 0 && 
            now - this.lastSpawnTime > this.spawnCooldown && 
            this.enemies.length < this.maxEnemies) {
            
            // Get next enemy type from queue
            const type = this.spawnQueue.shift();
            
            // Spawn the enemy
            const enemy = this.spawnEnemy(type);
            
            // Update spawn time
                this.lastSpawnTime = now;
            
            // Adjust spawn cooldown based on wave number
            if (window.gameEngine && window.gameEngine.waveSystem) {
                const currentWave = window.gameEngine.waveSystem.wave;
                // Faster spawns in later waves
                this.spawnCooldown = Math.max(500, 2000 - (currentWave * 300));
            }
        }

        // Notify wave system when all queued enemies have been spawned
        if (this.spawnQueue.length === 0 && 
            window.gameEngine && 
            window.gameEngine.waveSystem && 
            window.gameEngine.waveSystem.isSpawning) {
            window.gameEngine.waveSystem.isSpawning = false;
            console.log('All enemies spawned, notifying wave system');
        }

        // Update all enemies
        this.enemies.forEach(enemy => {
            if (enemy && enemy.isAlive) {
                enemy.update(deltaTime, window.gameEngine?.player);
            }
        });
        
        // Update group behaviors
        this.updateGroups();

        // Clean up dead enemies
        this.enemies = this.enemies.filter(enemy => {
            if (!enemy.isAlive) {
                // Remove from group
                const groupId = this.enemyToGroup.get(enemy);
                if (groupId !== undefined) {
                    this.enemyToGroup.delete(enemy);
                }
                
                // Remove from scene
                if (enemy.model) {
                    this.scene.remove(enemy.model);
                    
                    // Clean up geometry and materials
                    if (enemy.model.geometry) {
                        enemy.model.geometry.dispose();
                    }
                    
                    if (enemy.model.material) {
                        if (Array.isArray(enemy.model.material)) {
                            enemy.model.material.forEach(mat => mat.dispose());
                        } else {
                            enemy.model.material.dispose();
                        }
                    }
                }
                
                return false;
            }
            return true;
        });
    }
    
    // Reset all enemies
    reset() {
        console.log('Resetting enemy manager');
        
        // Clean up all enemies
        this.enemies.forEach(enemy => {
                if (enemy.model) {
                    this.scene.remove(enemy.model);
                
                // Clean up geometry and materials
                if (enemy.model.geometry) {
                    enemy.model.geometry.dispose();
                }
                
                if (enemy.model.material) {
                    if (Array.isArray(enemy.model.material)) {
                        enemy.model.material.forEach(mat => mat.dispose());
                    } else {
                        enemy.model.material.dispose();
                    }
                }
            }
        });
        
        // Reset arrays and maps
        this.enemies = [];
        this.spawnQueue = [];
        this.enemyGroups = [];
        this.groupLeaders = new Map();
        this.enemyToGroup = new Map();
        this.nextGroupId = 1;
        this.lastSpawnTime = 0;
        
        // Reset spawn cooldown to default
        this.spawnCooldown = 2000;
        
        // Reset spawn point cooldowns
        this.spawnPointLastUse.clear();
    }

    handleHit(enemy, damage) {
        if (!enemy || !enemy.isAlive) return false;

        // Apply damage to enemy
        enemy.takeDamage(damage);
        
        // Check if enemy died from this hit
        if (!enemy.isAlive) {
            // Notify wave system about the kill
            if (window.gameEngine && window.gameEngine.waveSystem) {
                const waveSystemState = window.gameEngine.waveSystem.onEnemyKill(enemy.type);
                
                // Log for debugging
                console.log('Enemy killed:', enemy.type, 'Wave system state:', waveSystemState);
                
                // Update UI if available
                if (window.gameEngine.ui) {
                    window.gameEngine.ui.updateScore(waveSystemState);
                }
            }

            return true; // Enemy was killed
        }

        return false; // Enemy still alive
    }
}

export default EnemyManager; 


