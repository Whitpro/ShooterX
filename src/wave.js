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
        this.maxWave = 10;
        this.waveCounts = [0, 5, 7, 9, 12, 15, 18, 22, 26, 30, 35];
        this.nextWaveTimeoutId = null;
    }

    startWave() {
        if (this.state !== 'WAITING') return;

        if (this.nextWaveTimeoutId) {
            clearTimeout(this.nextWaveTimeoutId);
            this.nextWaveTimeoutId = null;
        }

        this.state = 'ACTIVE';
        this.waveStartTime = performance.now();
        this.lastSpawnTime = 0;
        this.enemiesSpawned = 0;
        this.enemiesKilled = 0;
        this.score.shotsFired = 0;
        this.score.shotsHit = 0;
        this.score.current = 0;
        this.score.multiplier = 1.0;
        this.score.timeBonus = 1.0;
        this.score.accuracyBonus = 1.0;
        this.isSpawning = false;

        this.setupWaveEnemies();
    }

    setupWaveEnemies() {
        const totalEnemies = this.waveCounts[Math.min(this.wave, this.waveCounts.length - 1)];
        const enemyTypes = [];

        if (this.wave === 10) {
            enemyTypes.push('BOSS');
        }

        while (enemyTypes.length < totalEnemies) {
            const roll = Math.random();

            if (this.wave === 10) {
                if (roll < 0.35) enemyTypes.push('GRUNT');
                else if (roll < 0.55) enemyTypes.push('SCOUT');
                else if (roll < 0.75) enemyTypes.push('HEAVY');
                else if (roll < 0.9) enemyTypes.push('SNIPER');
                else enemyTypes.push('COMMANDER');
            } else if (this.wave >= 3) {
                if (roll < 0.45) enemyTypes.push('GRUNT');
                else if (roll < 0.7) enemyTypes.push('SCOUT');
                else if (roll < 0.85) enemyTypes.push('HEAVY');
                else enemyTypes.push('SNIPER');
            } else {
                enemyTypes.push(roll < 0.6 ? 'GRUNT' : 'SCOUT');
            }
        }

        for (let i = enemyTypes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [enemyTypes[i], enemyTypes[j]] = [enemyTypes[j], enemyTypes[i]];
        }

        this.enemiesRequired = enemyTypes.length;

        enemyTypes.forEach(type => {
            if (this.enemyManager && this.enemyManager.queueEnemySpawn) {
                this.enemyManager.queueEnemySpawn(type);
            } else {
                console.warn('Enemy manager not properly initialized');
            }
        });

        this.isSpawning = true;
    }

    update() {
        if (this.state !== 'ACTIVE') return;

        if (
            this.enemiesKilled >= this.enemiesRequired &&
            !this.enemyManager.hasSpawningEnemies() &&
            !this.isSpawning
        ) {
            console.log('Wave complete! Killed:', this.enemiesKilled, 'Required:', this.enemiesRequired);
            this.completeWave();
            return;
        }

        this.updateScoreMultiplier();
    }

    updateScoreMultiplier() {
        if (this.score.shotsFired > 0) {
            const accuracy = this.score.shotsHit / this.score.shotsFired;
            this.score.accuracyBonus = Math.max(0.5, Math.min(1.5, 0.5 + accuracy));
        }

        const waveTime = (performance.now() - this.waveStartTime) / 1000;
        const expectedTime = 30 + this.wave * 5;
        this.score.timeBonus = Math.max(1.0, Math.min(1.2, 1.2 - (waveTime / expectedTime) * 0.2));
        this.score.multiplier = this.score.accuracyBonus * this.score.timeBonus;
    }

    onEnemyKill(type) {
        if (this.state !== 'ACTIVE') return this.getCurrentState();

        this.enemiesKilled++;
        const pointValue = ENEMY_TYPES[type]?.points || 100;
        this.score.current += Math.round(pointValue * this.score.multiplier);

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
        this.isSpawning = false;
        this.score.total += this.score.current;

        if (this.wave >= this.maxWave) {
            console.log('Maximum wave reached! Game completed!');
            if (window.gameEngine) {
                window.gameEngine.gameOver();
            }
            return;
        }

        this.wave++;

        if (window.gameEngine && window.gameEngine.ui) {
            window.gameEngine.ui.updateScore(this.getCurrentState());
        }

        this.nextWaveTimeoutId = setTimeout(() => {
            this.nextWaveTimeoutId = null;
            console.log('Starting next wave:', this.wave);
            this.state = 'WAITING';
            this.startWave();
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
            accuracy: this.score.shotsFired > 0
                ? parseFloat(((this.score.shotsHit / this.score.shotsFired) * 100).toFixed(1))
                : 100,
            timeBonus: parseFloat(this.score.timeBonus.toFixed(2)),
            accuracyBonus: parseFloat(this.score.accuracyBonus.toFixed(2))
        };
    }

    reset() {
        if (this.nextWaveTimeoutId) {
            clearTimeout(this.nextWaveTimeoutId);
            this.nextWaveTimeoutId = null;
        }

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
        this.isSpawning = false;
    }

    setMaxWave() {
        if (this.nextWaveTimeoutId) {
            clearTimeout(this.nextWaveTimeoutId);
            this.nextWaveTimeoutId = null;
        }

        this.wave = this.maxWave;
        this.state = 'WAITING';
        this.startWave();

        if (window.gameEngine && window.gameEngine.ui) {
            window.gameEngine.ui.updateScore(this.getCurrentState());
        }
    }
}

export default Wave;
