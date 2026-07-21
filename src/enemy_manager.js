import * as THREE from '../three.js-r178/three.js-r178/src/Three.js';
import Enemy from './enemy.js';

class EnemyManager {
    constructor(scene, environment) {
        this.scene = scene;
        this.environment = environment;
        this.enemies = [];
        this.spawnQueue = [];
        this.spawnPoints = [];
        this.lastSpawnTime = 0;
        this.spawnDelay = 2000; // 2 seconds between spawns
    }

    handleHit(enemy, damage) {
        if (!enemy || !enemy.isAlive) return 0;

        // Apply damage and check if enemy died
        enemy.takeDamage(damage);
        
        // If enemy died from this hit
        if (!enemy.isAlive) {
            // Calculate points based on enemy type
            const points = this.calculatePoints(enemy);
            
            // Remove enemy from active list
            const index = this.enemies.indexOf(enemy);
            if (index > -1) {
                this.enemies.splice(index, 1);
            }

            // Notify wave system of kill
            if (window.gameEngine && window.gameEngine.waveSystem) {
                window.gameEngine.waveSystem.onEnemyKill(enemy.type);
            }

            return points;
        }

        return 0; // No points for just a hit
    }

    calculatePoints(enemy) {
        // Base points for different enemy types
        const pointValues = {
            'GRUNT': 100,
            'SCOUT': 150,
            'HEAVY': 200,
            'SNIPER': 250,
            'COMMANDER': 500,
            'BOSS': 1000
        };

        // Get base points for enemy type or default to 100
        let points = pointValues[enemy.type] || 100;

        // Add distance bonus (further = more points, up to 1.5x)
        const distanceToPlayer = enemy.position.distanceTo(this.player.position);
        const distanceMultiplier = Math.min(1.5, 1 + (distanceToPlayer / 50));
        points *= distanceMultiplier;

        return Math.round(points);
    }

    queueEnemySpawn(type) {
        this.spawnQueue.push(type);
    }

    hasSpawningEnemies() {
        return this.spawnQueue.length > 0;
    }

    update(deltaTime, player) {
        // Update all active enemies
        this.enemies.forEach(enemy => {
            if (enemy.isAlive) {
                enemy.update(deltaTime, player);
            }
        });

        // Handle enemy spawning
        const currentTime = performance.now();
        if (this.spawnQueue.length > 0 && currentTime - this.lastSpawnTime >= this.spawnDelay) {
            this.spawnNextEnemy();
            this.lastSpawnTime = currentTime;
        }
    }

    spawnNextEnemy() {
        if (this.spawnQueue.length === 0) return;

        const type = this.spawnQueue.shift();
        const spawnPoint = this.getRandomSpawnPoint();
        
        if (spawnPoint) {
            const enemy = new Enemy(this.scene, type, spawnPoint);
            this.enemies.push(enemy);
        }
    }

    getRandomSpawnPoint() {
        if (this.spawnPoints.length === 0) {
            // Generate spawn points if none exist
            this.generateSpawnPoints();
        }

        if (this.spawnPoints.length === 0) {
            console.warn('No valid spawn points available');
            return null;
        }

        const index = Math.floor(Math.random() * this.spawnPoints.length);
        return this.spawnPoints[index];
    }

    generateSpawnPoints() {
        // Clear existing spawn points
        this.spawnPoints = [];

        // Get environment boundaries
        const bounds = this.environment.getBounds();
        if (!bounds) return;

        // Generate spawn points around the perimeter
        const spacing = 5; // Distance between spawn points
        const margin = 2; // Distance from edge

        // Top edge
        for (let x = bounds.min.x + margin; x <= bounds.max.x - margin; x += spacing) {
            this.spawnPoints.push(new THREE.Vector3(x, 0, bounds.max.z - margin));
        }

        // Bottom edge
        for (let x = bounds.min.x + margin; x <= bounds.max.x - margin; x += spacing) {
            this.spawnPoints.push(new THREE.Vector3(x, 0, bounds.min.z + margin));
        }

        // Left edge
        for (let z = bounds.min.z + margin; z <= bounds.max.z - margin; z += spacing) {
            this.spawnPoints.push(new THREE.Vector3(bounds.min.x + margin, 0, z));
        }

        // Right edge
        for (let z = bounds.min.z + margin; z <= bounds.max.z - margin; z += spacing) {
            this.spawnPoints.push(new THREE.Vector3(bounds.max.x - margin, 0, z));
        }
    }

    reset() {
        // Remove all enemies from scene
        this.enemies.forEach(enemy => {
            if (enemy.model) {
                this.scene.remove(enemy.model);
            }
        });

        // Clear arrays
        this.enemies = [];
        this.spawnQueue = [];
        this.spawnPoints = [];
        this.lastSpawnTime = 0;
    }
}

export default EnemyManager; 