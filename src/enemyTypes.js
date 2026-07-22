// ─── Enemy type configuration ──────────────────────────────────
// Core stats are at the top of each entry for easy tweaking.
// Model and behavior settings are below.

import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';

const ENEMY_TYPES = {
    GRUNT: {
        // ── Core stats ──
        health: 100,
        damage: 5,
        attackRange: 1.2,
        roamSpeed: 3,
        chaseSpeed: 4,
        attackWindup: 400,

        // ── Internal ──
        detectionRange: 15,
        attackDelay: 1000,
        points: 100,
        model: { radius: 0.24, height: 1.7, segments: 8, color: 0xff0000, shininess: 30 },
        behavior: {
            pursueChance: 0.7,
            strafeChance: 0.2,
            suppressChance: 0.1,
            roaming: { radius: 12, changeTimeMin: 3000, changeTimeMax: 7000 }
        }
    },

    SCOUT: {
        health: 75,
        damage: 8,
        attackRange: 0.9,
        roamSpeed: 5.5,
        chaseSpeed: 6.0,
        attackWindup: 400,

        detectionRange: 24,
        attackDelay: 900,
        points: 150,
        model: { radius: 0.21, height: 1.5, segments: 8, color: 0x00ff00, shininess: 50 },
        behavior: {
            pursueChance: 0.2,
            strafeChance: 0.7,
            suppressChance: 0.1,
            combatStrafe: 1.3,
            roaming: { radius: 28, changeTimeMin: 600, changeTimeMax: 2000 }
        }
    },

    SNIPER: {
        health: 60,
        damage: 25,
        attackRange: 10,
        roamSpeed: 1.8,
        chaseSpeed: 3.0,
        attackWindup: 1200,
        knockback: 6,

        detectionRange: 27,
        attackDelay: 2000,
        points: 250,
        model: { radius: 0.22, height: 1.6, segments: 8, color: 0xffff00, shininess: 60 },
        behavior: {
            pursueChance: 0.1,
            strafeChance: 0.3,
            suppressChance: 0.6,
            roaming: { radius: 15, changeTimeMin: 5000, changeTimeMax: 10000 }
        }
    },

    COMMANDER: {
        health: 150,
        damage: 12,
        attackRange: 7,
        roamSpeed: 2.6,
        chaseSpeed: 4.0,
        attackWindup: 500,
        commandRadius: 20,

        detectionRange: 28,
        attackDelay: 900,
        points: 300,
        model: { radius: 0.31, height: 1.9, segments: 8, color: 0xff00ff, shininess: 70 },
        behavior: {
            pursueChance: 0.4,
            strafeChance: 0.4,
            suppressChance: 0.2,
            roaming: { radius: 18, changeTimeMin: 3500, changeTimeMax: 8000 }
        }
    },

    BOSS: {
        health: 500,
        damage: 30,
        attackRange: 9,
        roamSpeed: 1.65,
        chaseSpeed: 3.0,
        attackWindup: 1000,

        detectionRange: 35,
        attackDelay: 1500,
        points: 500,
        model: { radius: 0.52, height: 2.8, segments: 8, color: 0xFF9800, emissive: 0x600000, shininess: 100 },
        behavior: {
            pursueChance: 0.3,
            strafeChance: 0.4,
            suppressChance: 0.3,
            roaming: { radius: 25, changeTimeMin: 4000, changeTimeMax: 9000 }
        }
    }
};

function createEnemyMesh(type) {
    const cfg = ENEMY_TYPES[type];
    if (!cfg) throw new Error(`Invalid enemy type: ${type}`);

    const m = cfg.model;
    const geo = new THREE.CylinderGeometry(m.radius, m.radius, m.height, m.segments || 8);
    const mat = new THREE.MeshPhongMaterial({
        color: m.color,
        emissive: m.emissive || 0x000000,
        shininess: m.shininess || 30
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export { ENEMY_TYPES, createEnemyMesh };
