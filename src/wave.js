import * as THREE from '../three.js-r178/three.js-r178/src/Three.js';
import { ENEMY_TYPES } from './enemyTypes.js';

class Wave {
    constructor(enemyManager) {
        this.enemyManager = enemyManager;
        this.wave = 1;
        this.state = 'WAITING';
        this.score = {
            current: 0,
            total: 0,
            multiplier: 1.0,
            shotsFired: 0,
            shotsHit: 0,
            timeBonus: 1.0,
            accuracyBonus: 1.0
        };
        this.waveStartTime = 0;
        this.lastSpawnTime = 0;
        this.spawnDelay = 2000;
        this.enemiesSpawned = 0;
        this.enemiesKilled = 0;
        this.enemiesRequired = 5;
        this.spawnPoints = [];
        this.isSpawning = false;
    }

    startWave() {
        if (this.state !== 'WAITING') return;

        this.state = 'ACTIVE';
        this.waveStartTime = performance.now();
        this.lastSpawnTime = 0;
        this.enemiesSpawned = 0;
        this.enemiesKilled = 0;
        this.score.shotsFired = 0;
        this.score.shotsHit = 0;
        this.score.current = 0;
        this.score.multiplier = 1.0;
        this.isSpawning = false;
        
        // Set up enemies for this wave
        this.setupWaveEnemies();
    }

    setupWaveEnemies() {
        // Calculate number of enemies for this wave
        this.enemiesRequired = Math.floor(5 * Math.pow(1.2, this.wave - 1));
        const MAX_ENEMIES_PER_WAVE = 50;
        this.enemiesRequired = Math.min(this.enemiesRequired, MAX_ENEMIES_PER_WAVE);
        
        // Create enemy distribution for this wave
        let enemyTypes = [];
        
        // Add boss every 5 waves or immediately at high waves (wave 10+)
        if (this.wave % 5 === 0 || this.wave >= 10) {
            enemyTypes.push(this.wave % 10 === 0 ? 'BOSS' : 'COMMANDER');
            this.enemiesRequired = Math.max(this.enemiesRequired - 1, 1);
        }
        
        // Fill remaining slots based on wave number
        while (enemyTypes.length < this.enemiesRequired) {
            const roll = Math.random();
            
            if (this.wave >= 10) {
                if (roll < 0.35) enemyTypes.push('GRUNT');
                else if (roll < 0.55) enemyTypes.push('SCOUT');
                else if (roll < 0.75) enemyTypes.push('HEAVY');
                else if (roll < 0.90) enemyTypes.push('SNIPER');
                else enemyTypes.push('COMMANDER');
            } else if (this.wave >= 5) {
                if (roll < 0.45) enemyTypes.push('GRUNT');
                else if (roll < 0.70) enemyTypes.push('SCOUT');
                else if (roll < 0.85) enemyTypes.push('HEAVY');
                else enemyTypes.push('SNIPER');
            } else {
                enemyTypes.push(roll < 0.6 ? 'GRUNT' : 'SCOUT');
            }
        }
        
        // Shuffle enemy types for random spawn order
        for (let i = enemyTypes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [enemyTypes[i], enemyTypes[j]] = [enemyTypes[j], enemyTypes[i]];
        }
        
        // Queue enemies for spawning
        enemyTypes.forEach(type => {
            if (this.enemyManager && this.enemyManager.queueEnemySpawn) {
                this.enemyManager.queueEnemySpawn(type);
            } else {
                console.warn('Enemy manager not properly initialized');
            }
        });

        this.isSpawning = true;
    }

    update(deltaTime) {
        if (this.state !== 'ACTIVE') return;

        // Check for wave completion
        if (this.enemiesKilled >= this.enemiesRequired && 
            !this.enemyManager.hasSpawningEnemies() && 
            !this.isSpawning) {
            console.log('Wave complete! Killed:', this.enemiesKilled, 'Required:', this.enemiesRequired);
            this.completeWave();
            return;
        }

        // Debug logging
        if (this.enemiesKilled >= this.enemiesRequired) {
            console.log('Wave completion check: killed=', this.enemiesKilled, 
                        'required=', this.enemiesRequired, 
                        'hasSpawningEnemies=', this.enemyManager.hasSpawningEnemies(), 
                        'isSpawning=', this.isSpawning);
        }

        // Update score multiplier based on current performance
        this.updateScoreMultiplier();
    }

    updateScoreMultiplier() {
        // Calculate accuracy bonus (0.5 to 1.5)
        if (this.score.shotsFired > 0) {
            const accuracy = this.score.shotsHit / this.score.shotsFired;
            this.score.accuracyBonus = Math.max(0.5, Math.min(1.5, 0.5 + accuracy));
        }

        // Calculate time bonus (1.0 to 1.2)
        const waveTime = (performance.now() - this.waveStartTime) / 1000; // seconds
        const expectedTime = 30 + (this.wave * 5); // More time for later waves
        this.score.timeBonus = Math.max(1.0, Math.min(1.2, 1.2 - (waveTime / expectedTime) * 0.2));

        // Update final multiplier
        this.score.multiplier = this.score.accuracyBonus * this.score.timeBonus;
    }

    onEnemyKill(type) {
        if (this.state !== 'ACTIVE') return this.getCurrentState();

        this.enemiesKilled++;
        // Add points based on enemy type
        const pointValue = ENEMY_TYPES[type]?.points || 100;
        this.score.current += Math.round(pointValue * this.score.multiplier);
        // Update UI with new state
        if (window.gameEngine && window.gameEngine.ui) {
            window.gameEngine.ui.updateScore(this.getCurrentState());
        }
        return this.getCurrentState();
    }

    onShotFired() {
        if (this.state === 'ACTIVE') {
            this.score.shotsFired++;
        }
    }

    onShotHit() {
        if (this.state === 'ACTIVE') {
            this.score.shotsHit++;
        }
    }

    completeWave() {
        if (this.state !== 'ACTIVE') return;

        console.log('Wave completed!', this.wave);
        this.state = 'COMPLETE';
        this.score.total += this.score.current;
        this.wave++;
        
        // Update UI
        if (window.gameEngine && window.gameEngine.ui) {
            window.gameEngine.ui.updateScore(this.getCurrentState());
        }
        
        // Reset for next wave
        setTimeout(() => {
            console.log('Starting next wave:', this.wave);
            this.state = 'WAITING';
            this.startWave(); // Automatically start next wave
        }, 3000);
    }

    getCurrentState() {
        return {
            wave: this.wave,
            state: this.state,
            enemiesKilled: this.enemiesKilled,
            enemiesRequired: this.enemiesRequired,
            score: Math.round(this.score.current),
            totalScore: Math.round(this.score.total),
            multiplier: parseFloat(this.score.multiplier.toFixed(2)),
            accuracy: this.score.shotsFired > 0 ? 
                     parseFloat((this.score.shotsHit / this.score.shotsFired * 100).toFixed(1)) : 100,
            timeBonus: parseFloat(this.score.timeBonus.toFixed(2)),
            accuracyBonus: parseFloat(this.score.accuracyBonus.toFixed(2))
        };
    }

    reset() {
        this.wave = 1;
        this.state = 'WAITING';
        this.score = {
            current: 0,
            total: 0,
            multiplier: 1.0,
            shotsFired: 0,
            shotsHit: 0,
            timeBonus: 1.0,
            accuracyBonus: 1.0
        };
        this.waveStartTime = 0;
        this.lastSpawnTime = 0;
        this.enemiesSpawned = 0;
        this.enemiesKilled = 0;
        this.enemiesRequired = 5;
    }

    setMaxWave() {
        // Clamp to a reasonable max wave
        const MAX_WAVE = 100;
        this.wave = MAX_WAVE;
        this.state = 'WAITING';
        this.startWave();
        if (window.gameEngine && window.gameEngine.ui) {
            window.gameEngine.ui.updateScore(this.getCurrentState());
        }
    }
}

export default Wave; 