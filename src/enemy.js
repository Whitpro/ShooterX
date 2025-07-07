import * as THREE from '../three.js-r178/three.js-r178/src/Three.js';
import { ENEMY_TYPES, createEnemyMesh } from './enemyTypes.js';

class Enemy {
    constructor(scene, type, position) {
        this.scene = scene;
        this.type = typeof type === 'string' ? type : type.type;
        const config = ENEMY_TYPES[this.type.toUpperCase()];

        if (!config) {
            console.error('Invalid enemy type:', type);
            return;
        }

        // Basic properties
        this.position = position || new THREE.Vector3();
        this.health = config.health;
        this.maxHealth = config.health;
        this.speed = config.speed || 2;
        this.damage = config.damage || 10;
        this.isAlive = true;
        
        // Movement properties
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.rotationSpeed = 3.0;
        this.lastPosition = this.position.clone();
        
        // Combat properties
        this.attackRange = config.attackRange || 2.0;
        this.detectionRange = config.detectionRange || 20.0;
        this.attackCooldown = 0;
        this.attackDelay = config.attackDelay || 1000;

        // Get roaming config
        this.roamingConfig = config.behavior?.roaming || {
            radius: 15,
            speedMultiplier: 0.6,
            changeTimeMin: 3000,
            changeTimeMax: 7000
        };

        // Chase speed should be a fraction of the base speed to prevent excessive speed
        this.chaseSpeedMultiplier = 0.8; // Reduce chase speed to 80% of base speed

        // Roaming properties
        this.state = 'ROAMING'; // ROAMING, CHASING, ATTACKING
        this.roamTargetPosition = null;
        this.roamRadius = this.roamingConfig.radius;
        this.roamingSpeed = this.speed * this.roamingConfig.speedMultiplier;
        this.roamTargetChangeTime = 0;
        this.roamTargetChangeCooldown = this.getRandomRoamTime();
        this.stuckCheckDelay = 1000;
        this.lastStuckCheckTime = 0;
        this.stuckThreshold = 0.1;
        
        // Map boundaries - these should match your environment size
        this.mapBoundaryRadius = 50; // Enemies shouldn't go beyond this distance from center
        
        // Create the enemy model
        this.createModel();
    }

    getRandomRoamTime() {
        return this.roamingConfig.changeTimeMin + 
            Math.random() * (this.roamingConfig.changeTimeMax - this.roamingConfig.changeTimeMin);
    }

    createModel() {
        // Create enemy mesh
        this.model = createEnemyMesh(this.type.toUpperCase());
        if (this.model) {
            this.model.position.copy(this.position);
            // Place on ground with offset based on height (half of the cylinder height)
            const config = ENEMY_TYPES[this.type.toUpperCase()];
            const height = config.model.geometry.parameters ? 
                          config.model.geometry.parameters.height / 2 : 1.0;
            this.model.position.y = height;
            this.scene.add(this.model);
        }
    }

    update(deltaTime, player) {
        if (!this.isAlive || !this.model || !player) return;

        // Update position reference
        this.position.copy(this.model.position);
        
        // Ensure enemy y position is maintained based on its height
        const config = ENEMY_TYPES[this.type.toUpperCase()];
        const height = config.model.geometry.parameters ? 
                      config.model.geometry.parameters.height / 2 : 1.0;
        this.model.position.y = height;

        // Calculate direction to player
        const toPlayer = new THREE.Vector3();
        toPlayer.subVectors(player.camera.position, this.position);
        const distanceToPlayer = toPlayer.length();

        // State management
        if (distanceToPlayer <= this.attackRange) {
            this.state = 'ATTACKING';
        } else if (distanceToPlayer <= this.detectionRange) {
            this.state = 'CHASING';
        } else {
            this.state = 'ROAMING';
        }

        // Handle state behaviors
        switch (this.state) {
            case 'ROAMING':
                this.handleRoaming(deltaTime);
                break;

            case 'CHASING':
                // Normalize direction to player
                toPlayer.normalize();
                
                // Calculate movement with reduced chase speed
                const movement = toPlayer.multiplyScalar(this.speed * this.chaseSpeedMultiplier * deltaTime);
                
                // Try to move
                this.tryMove(movement);

                // Update rotation to face player
                this.updateRotation(toPlayer);
                break;

            case 'ATTACKING':
                // Update rotation to face player
                toPlayer.normalize();
                this.updateRotation(toPlayer);

                // Try to attack if cooldown expired
                if (this.attackCooldown <= 0) {
                    this.attack(player);
                }
                break;
        }

        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime * 1000;
        }

        // Check if we're stuck
        this.checkIfStuck(deltaTime);
    }

    handleRoaming(deltaTime) {
        // Get current time for cooldown checks
        const now = performance.now();
        
        // Check if we need a new roam target
        if (!this.roamTargetPosition || now - this.roamTargetChangeTime > this.roamTargetChangeCooldown) {
            this.chooseNewRoamTarget();
            this.roamTargetChangeTime = now;
        }
        
        if (this.roamTargetPosition) {
            // Calculate direction to roam target
            const toTarget = new THREE.Vector3();
            toTarget.subVectors(this.roamTargetPosition, this.position);
            
            // Check if we've reached the target (within 1 unit)
            const distanceToTarget = toTarget.length();
            if (distanceToTarget < 1) {
                // We've reached the target, get a new one
                this.chooseNewRoamTarget();
                return;
            }
            
            // Normalize direction
            toTarget.normalize();
            
            // Calculate movement
            const movement = toTarget.multiplyScalar(this.roamingSpeed * deltaTime);
            
            // Try to move
            this.tryMove(movement);
            
            // Update rotation to face movement direction
            this.updateRotation(toTarget);
        }
    }

    chooseNewRoamTarget(biasTowardsCenter = false) {
        // If biased towards center, reduce the roam radius to encourage movement towards center
        const maxDistance = biasTowardsCenter ? 
                            Math.min(this.roamRadius, this.mapBoundaryRadius * 0.5) : 
                            this.roamRadius;
        
        // Get current distance from center
        const distanceFromCenter = new THREE.Vector2(this.position.x, this.position.z).length();
        
        // If we're near the boundary, bias direction towards center
        let angle;
        if (distanceFromCenter > this.mapBoundaryRadius * 0.8 || biasTowardsCenter) {
            // Calculate angle back toward center with some randomness
            const toCenter = new THREE.Vector2(-this.position.x, -this.position.z).normalize();
            const angleToCenter = Math.atan2(toCenter.y, toCenter.x);
            
            // Add some randomness (+/- 45 degrees)
            angle = angleToCenter + (Math.random() - 0.5) * Math.PI / 2;
        } else {
            // Choose a random angle
            angle = Math.random() * Math.PI * 2;
        }
        
        // Choose a random distance within the allowed radius
        const distance = Math.random() * maxDistance;
        
        // Calculate new position
        const x = this.position.x + Math.cos(angle) * distance;
        const z = this.position.z + Math.sin(angle) * distance;
        
        // Set new roam target
        this.roamTargetPosition = new THREE.Vector3(x, 0, z);
        
        // Choose new cooldown time for variety in movement
        this.roamTargetChangeCooldown = this.getRandomRoamTime();
    }

    checkIfStuck(deltaTime) {
        const now = performance.now();
        
        // Only check periodically to save performance
        if (now - this.lastStuckCheckTime < this.stuckCheckDelay) {
            return;
        }
        
        this.lastStuckCheckTime = now;
        
        // Calculate distance moved since last check
        const distanceMoved = this.position.distanceTo(this.lastPosition);
        
        // If we've barely moved, we might be stuck
        if (distanceMoved < this.stuckThreshold && this.state === 'ROAMING') {
            // Choose a new target to try to get unstuck
            this.chooseNewRoamTarget();
        }
        
        // Update last position for next check
        this.lastPosition.copy(this.position);
    }

    tryMove(movement) {
        // Calculate new position
        const newPosition = new THREE.Vector3().addVectors(this.position, movement);
        
        // Check for collisions at the new position
        if (!this.checkCollision(newPosition)) {
            // No collision, update the position
            this.model.position.copy(newPosition);
            
            // Keep the y position based on enemy height
            const config = ENEMY_TYPES[this.type.toUpperCase()];
            const height = config.model.geometry.parameters ? 
                          config.model.geometry.parameters.height / 2 : 1.0;
            this.model.position.y = height;
        } else {
            // Try sliding along the X axis
            const slideX = new THREE.Vector3(newPosition.x, this.position.y, this.position.z);
            if (!this.checkCollision(slideX)) {
                this.model.position.copy(slideX);
            } 
            // Try sliding along the Z axis
            else {
                const slideZ = new THREE.Vector3(this.position.x, this.position.y, newPosition.z);
                if (!this.checkCollision(slideZ)) {
                    this.model.position.copy(slideZ);
                }
            }
            
            // Keep the y position based on enemy height after sliding
            const config = ENEMY_TYPES[this.type.toUpperCase()];
            const height = config.model.geometry.parameters ? 
                          config.model.geometry.parameters.height / 2 : 1.0;
            this.model.position.y = height;
        }
    }

    checkCollision(position) {
        // Get enemy hitbox radius based on type
        const config = ENEMY_TYPES[this.type.toUpperCase()];
        const radius = config.hitboxRadius !== undefined ? config.hitboxRadius : (config.model.geometry.parameters ? config.model.geometry.parameters.radiusTop : 0.5);
        
        // Basic collision detection with environment
        if (this.environment && this.environment.checkWallCollision) {
            return this.environment.checkWallCollision(position);
        }
        
        return false;
    }

    updateRotation(direction) {
        if (!this.model) return;

        // Calculate target rotation
        const targetRotation = Math.atan2(direction.x, direction.z);
        
        // Get current rotation
        let currentRotation = this.model.rotation.y;
        
        // Calculate shortest rotation path
        let rotationDiff = targetRotation - currentRotation;
        if (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
        if (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
        
        // Apply smooth rotation
        this.model.rotation.y += rotationDiff * this.rotationSpeed * 0.1;
    }

    attack(player) {
        if (!player) return;
        
        // Check distance to player
        const toPlayer = new THREE.Vector3();
        toPlayer.subVectors(player.camera.position, this.position);
        const distanceToPlayer = toPlayer.length();
        
        // Use only attackRange for attack, not radius
        if (distanceToPlayer <= this.attackRange) {
            // Deal damage to player
            player.takeDamage(this.damage);
            
            // Set cooldown
            this.attackCooldown = this.attackDelay;
        }
    }

    takeDamage(amount) {
        if (!this.isAlive) return false;

        this.health -= amount;
        
        if (this.health <= 0) {
            this.die();
            return true;
        }
        
        return false;
    }

    die() {
        this.isAlive = false;
        if (this.model) {
            this.scene.remove(this.model);
        }
    }
}

export default Enemy; 