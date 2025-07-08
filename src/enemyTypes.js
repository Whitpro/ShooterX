import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';

const ENEMY_TYPES = {
    GRUNT: {
        health: 100,
        speed: 3.5,
        damage: 10,
        attackRange: 1.2,
        detectionRange: 20,
        attackDelay: 1000,
        points: 100,
        hitboxRadius: 0.14,
        model: {
            geometry: new THREE.CylinderGeometry(0.24, 0.24, 1.7, 8),
            material: new THREE.MeshPhongMaterial({ 
                color: 0xff0000,
                shininess: 30
            })
        },
        behavior: {
            pursueChance: 0.7,
            strafeChance: 0.2,
            suppressChance: 0.1,
            roaming: {
                radius: 12,
                speedMultiplier: 0.7,
                changeTimeMin: 3000,
                changeTimeMax: 7000
            }
        }
    },
    SCOUT: {
        health: 75,
        speed: 5,
        damage: 8,
        attackRange: 0.9,
        detectionRange: 25,
        attackDelay: 800,
        points: 150,
        hitboxRadius: 0.12,
        model: {
            geometry: new THREE.CylinderGeometry(0.21, 0.21, 1.5, 8),
            material: new THREE.MeshPhongMaterial({ 
                color: 0x00ff00,
                shininess: 50
            })
        },
        behavior: {
            pursueChance: 0.3,
            strafeChance: 0.6,
            suppressChance: 0.1,
            roaming: {
                radius: 20,
                speedMultiplier: 0.8,
                changeTimeMin: 2000,
                changeTimeMax: 5000
            }
        }
    },
    HEAVY: {
        health: 200,
        speed: 2.5,
        damage: 15,
        attackRange: 1.8,
        detectionRange: 18,
        attackDelay: 1200,
        points: 200,
        hitboxRadius: 0.25,
        model: {
            geometry: new THREE.CylinderGeometry(0.42, 0.42, 2.0, 8),
            material: new THREE.MeshPhongMaterial({ 
                color: 0x0000ff,
                shininess: 20
            })
        },
        behavior: {
            pursueChance: 0.2,
            strafeChance: 0.2,
            suppressChance: 0.6,
            roaming: {
                radius: 8,
                speedMultiplier: 0.5,
                changeTimeMin: 4000,
                changeTimeMax: 8000
            }
        }
    },
    SNIPER: {
        health: 60,
        speed: 3,
        damage: 25,
        attackRange: 15,
        detectionRange: 30,
        attackDelay: 2000,
        points: 250,
        hitboxRadius: 0.13,
        model: {
            geometry: new THREE.CylinderGeometry(0.22, 0.22, 1.6, 8),
            material: new THREE.MeshPhongMaterial({ 
                color: 0xffff00,
                shininess: 60
            })
        },
        behavior: {
            pursueChance: 0.1,
            strafeChance: 0.3,
            suppressChance: 0.6,
            roaming: {
                radius: 15,
                speedMultiplier: 0.6,
                changeTimeMin: 5000,
                changeTimeMax: 10000
            }
        }
    },
    COMMANDER: {
        health: 175,
        speed: 4,
        damage: 12,
        attackRange: 7,
        detectionRange: 28,
        attackDelay: 900,
        points: 300,
        hitboxRadius: 0.19,
        model: {
            geometry: new THREE.CylinderGeometry(0.31, 0.31, 1.9, 8),
            material: new THREE.MeshPhongMaterial({ 
                color: 0xff00ff,
                shininess: 70
            })
        },
        behavior: {
            pursueChance: 0.4,
            strafeChance: 0.4,
            suppressChance: 0.2,
            roaming: {
                radius: 18,
                speedMultiplier: 0.65,
                changeTimeMin: 3500,
                changeTimeMax: 8000
            }
        }
    },
    BOSS: {
        health: 400,
        speed: 3,
        damage: 30,
        attackRange: 9,
        detectionRange: 35,
        attackDelay: 1500,
        points: 500,
        hitboxRadius: 0.31,
        model: {
            geometry: new THREE.CylinderGeometry(0.52, 0.52, 2.8, 8),
            material: new THREE.MeshPhongMaterial({ 
                color: 0xFF9800,
                emissive: 0x600000,
                shininess: 100
            })
        },
        behavior: {
            pursueChance: 0.3,
            strafeChance: 0.4,
            suppressChance: 0.3,
            roaming: {
                radius: 25,
                speedMultiplier: 0.55,
                changeTimeMin: 4000,
                changeTimeMax: 9000
            }
        }
    }
};

function createEnemyMesh(type) {
    const config = ENEMY_TYPES[type];
    if (!config) {
        throw new Error(`Invalid enemy type: ${type}`);
    }

    const mesh = new THREE.Mesh(config.model.geometry, config.model.material.clone());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export { ENEMY_TYPES, createEnemyMesh }; 