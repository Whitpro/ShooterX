import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';
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
            
            // Create health bar with size based on enemy type
            const barWidth = Math.min(2.0, Math.max(1.2, config.health / 80)); // Increased size
            const barHeight = 0.25; // Increased height
            const yOffset = height * 2 + 0.5; // Position higher above the enemy
            this.createHealthBar(yOffset, barWidth, barHeight);
        }
    }
    
    createHealthBar(yOffset, width = 1.5, height = 0.2) {
        // Create container for health bar
        this.healthBarContainer = new THREE.Group();
        this.model.add(this.healthBarContainer);
        
        // Position the health bar above the enemy
        this.healthBarContainer.position.set(0, yOffset, 0);
        
        // Create background bar (dark red gradient)
        const backgroundGeometry = new THREE.PlaneGeometry(width, height);
        
        // Create gradient texture for background
        const bgCanvas = document.createElement('canvas');
        bgCanvas.width = 64;
        bgCanvas.height = 16;
        const bgCtx = bgCanvas.getContext('2d');
        const bgGradient = bgCtx.createLinearGradient(0, 0, 0, bgCanvas.height);
        bgGradient.addColorStop(0, '#8B0000'); // Dark red
        bgGradient.addColorStop(1, '#FF0000'); // Bright red
        bgCtx.fillStyle = bgGradient;
        bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
        
        const bgTexture = new THREE.CanvasTexture(bgCanvas);
        
        const backgroundMaterial = new THREE.MeshBasicMaterial({ 
            map: bgTexture,
            side: THREE.DoubleSide,
            depthTest: false,
            transparent: true,
            opacity: 0.9
        });
        
        this.healthBarBackground = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
        this.healthBarBackground.renderOrder = 999; // Ensure it renders on top
        this.healthBarContainer.add(this.healthBarBackground);
        
        // Create foreground bar (green gradient) - same size as background
        const foregroundGeometry = new THREE.PlaneGeometry(width, height);
        
        // Create gradient texture for foreground
        const fgCanvas = document.createElement('canvas');
        fgCanvas.width = 64;
        fgCanvas.height = 16;
        const fgCtx = fgCanvas.getContext('2d');
        const fgGradient = fgCtx.createLinearGradient(0, 0, 0, fgCanvas.height);
        fgGradient.addColorStop(0, '#00FF00'); // Bright green
        fgGradient.addColorStop(1, '#32CD32'); // Lime green
        fgCtx.fillStyle = fgGradient;
        fgCtx.fillRect(0, 0, fgCanvas.width, fgCanvas.height);
        
        const fgTexture = new THREE.CanvasTexture(fgCanvas);
        
        const foregroundMaterial = new THREE.MeshBasicMaterial({ 
            map: fgTexture,
            side: THREE.DoubleSide,
            depthTest: false,
            transparent: true,
            opacity: 1.0
        });
        
        this.healthBarForeground = new THREE.Mesh(foregroundGeometry, foregroundMaterial);
        this.healthBarForeground.renderOrder = 1000; // Ensure it renders on top of background
        
        // Create a clip plane for the health bar
        // We'll use a different approach - create a container for the foreground
        this.healthBarForegroundContainer = new THREE.Group();
        this.healthBarForegroundContainer.position.z = 0.001; // Slightly in front of background
        this.healthBarContainer.add(this.healthBarForegroundContainer);
        this.healthBarForegroundContainer.add(this.healthBarForeground);
        
        // Add a better border around the health bar
        // Create a slightly larger geometry for the border
        const borderGeometry = new THREE.PlaneGeometry(width + 0.05, height + 0.05);
        const borderMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xFFFFFF,
            side: THREE.DoubleSide,
            depthTest: false,
            transparent: true,
            opacity: 0.7,
            wireframe: false
        });
        
        this.healthBarBorder = new THREE.Mesh(borderGeometry, borderMaterial);
        this.healthBarBorder.renderOrder = 998; // Render behind the health bar
        this.healthBarContainer.add(this.healthBarBorder);
        
        // Ensure the health bar is properly initialized
        // Force full health bar at start
        this.healthBarForeground.scale.x = 1.0;
        this.healthBarForeground.position.x = 0;
        
        // Hide health bar initially since enemy is at full health
        this.healthBarContainer.visible = false;
        
        // Make health bar face upward (fixed orientation)
        this.healthBarContainer.rotation.x = -Math.PI / 2;
    }
    
    updateHealthBar() {
        if (!this.healthBarForeground) return;
        
        // Calculate health percentage
        const healthPercent = Math.max(0, Math.min(1, this.health / this.maxHealth));
        
        // Use clipping approach instead of scaling
        // Create a clip geometry that's the right width
        const width = this.healthBarForeground.geometry.parameters.width;
        
        // Update the foreground container's position to create a clipping effect
        // Move the container to the left edge of the background
        this.healthBarForegroundContainer.position.x = -width * (1 - healthPercent) / 2;
        
        // Create a box to clip the foreground bar
        if (!this.clipMesh) {
            const clipGeometry = new THREE.BoxGeometry(width * healthPercent, 
                                                     this.healthBarForeground.geometry.parameters.height, 
                                                     0.1);
            const clipMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide
            });
            this.clipMesh = new THREE.Mesh(clipGeometry, clipMaterial);
            this.healthBarForegroundContainer.add(this.clipMesh);
            this.clipMesh.position.x = width * (1 - healthPercent) / 2;
        } else {
            // Update the clip mesh size
            this.clipMesh.scale.x = healthPercent;
            this.clipMesh.position.x = width * (1 - healthPercent) / 2;
        }
        
        // Update health bar color based on percentage
        if (healthPercent <= 0.25) {
            // Critical health - create red/orange gradient
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 16;
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#FF4500'); // OrangeRed
            gradient.addColorStop(1, '#FF8C00'); // DarkOrange
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Dispose of old texture if it exists
            if (this.healthBarForeground.material.map) {
                this.healthBarForeground.material.map.dispose();
            }
            
            // Apply new texture
            const texture = new THREE.CanvasTexture(canvas);
            this.healthBarForeground.material.map = texture;
            this.healthBarForeground.material.needsUpdate = true;
            
            // Make health bar pulse when critical
            if (!this.pulseAnimation) {
                this.pulseAnimation = setInterval(() => {
                    if (this.healthBarForeground) {
                        this.healthBarForeground.material.opacity = 0.7 + Math.sin(Date.now() * 0.01) * 0.3;
                    } else {
                        // Clean up interval if health bar is gone
                        if (this.pulseAnimation) {
                            clearInterval(this.pulseAnimation);
                            this.pulseAnimation = null;
                        }
                    }
                }, 100);
            }
        } else if (healthPercent <= 0.5) {
            // Low health - create yellow gradient
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 16;
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#FFFF00'); // Yellow
            gradient.addColorStop(1, '#FFA500'); // Orange
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Dispose of old texture if it exists
            if (this.healthBarForeground.material.map) {
                this.healthBarForeground.material.map.dispose();
            }
            
            // Apply new texture
            const texture = new THREE.CanvasTexture(canvas);
            this.healthBarForeground.material.map = texture;
            this.healthBarForeground.material.needsUpdate = true;
            
            // Stop pulse animation if it was running
            if (this.pulseAnimation) {
                clearInterval(this.pulseAnimation);
                this.pulseAnimation = null;
                this.healthBarForeground.material.opacity = 1.0;
            }
        } else {
            // Normal health - keep the original green gradient
            // Stop pulse animation if it was running
            if (this.pulseAnimation) {
                clearInterval(this.pulseAnimation);
                this.pulseAnimation = null;
                this.healthBarForeground.material.opacity = 1.0;
            }
        }
        
        // Show health bar if health is less than full
        this.healthBarContainer.visible = healthPercent < 1 && healthPercent > 0;
    }

    update(deltaTime, player) {
        if (!this.isAlive || !this.model || !player) return;

        // Ensure deltaTime is within reasonable bounds to prevent speed issues
        // This helps maintain consistent movement regardless of frame rate
        const clampedDeltaTime = Math.min(Math.max(deltaTime, 0.001), 0.1);

        // Update position reference
        this.position.copy(this.model.position);
        
        // Ensure enemy y position is maintained based on its height
        const config = ENEMY_TYPES[this.type.toUpperCase()];
        const height = config.model.geometry.parameters ? 
                      config.model.geometry.parameters.height / 2 : 1.0;
        this.model.position.y = height;
        
        // No need to make health bar face the camera anymore - it's fixed orientation

        // Get the player's position - use the player model position instead of camera
        const playerPosition = player.position ? player.position.clone() : player.camera.position.clone();
        
        // Calculate direction to player
        const toPlayer = new THREE.Vector3();
        toPlayer.subVectors(playerPosition, this.position);
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
                this.handleRoaming(clampedDeltaTime);
                break;

            case 'CHASING':
                // Normalize direction to player
                toPlayer.normalize();
                
                // Calculate movement with reduced chase speed
                const movement = toPlayer.multiplyScalar(this.speed * this.chaseSpeedMultiplier * clampedDeltaTime);
                
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
            this.attackCooldown -= clampedDeltaTime * 1000;
        }

        // Check if we're stuck
        this.checkIfStuck(clampedDeltaTime);
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
            
            // Calculate movement - ensure consistent speed regardless of frame rate
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
        
        // Get the player's position - use the player model position instead of camera
        const playerPosition = player.position ? player.position.clone() : player.camera.position.clone();
        
        // Check distance to player
        const toPlayer = new THREE.Vector3();
        toPlayer.subVectors(playerPosition, this.position);
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
        if (!this.isAlive) return;

        this.health -= amount;
        
        // Ensure health is within bounds
        this.health = Math.max(0, Math.min(this.maxHealth, this.health));
        
        // Show and update health bar
        if (this.healthBarContainer) {
            this.healthBarContainer.visible = true;
            this.updateHealthBar();
        }
        
        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        if (!this.isAlive) return;
        
        this.isAlive = false;
        
        // Hide health bar
        if (this.healthBarContainer) {
            this.healthBarContainer.visible = false;
        }
        
        // Clear any animations
        if (this.pulseAnimation) {
            clearInterval(this.pulseAnimation);
            this.pulseAnimation = null;
        }
        
        // Remove from scene after a delay
        setTimeout(() => {
        if (this.model) {
            this.scene.remove(this.model);
                
                // Dispose of geometries and materials
                if (this.model.geometry) this.model.geometry.dispose();
                if (this.model.material) {
                    if (Array.isArray(this.model.material)) {
                        this.model.material.forEach(material => material.dispose());
                    } else {
                        this.model.material.dispose();
                    }
                }
                
                // Dispose of health bar resources
                if (this.healthBarBackground) {
                    if (this.healthBarBackground.geometry) this.healthBarBackground.geometry.dispose();
                    if (this.healthBarBackground.material) {
                        if (this.healthBarBackground.material.map) {
                            this.healthBarBackground.material.map.dispose();
                        }
                        this.healthBarBackground.material.dispose();
                    }
                }
                
                if (this.healthBarForeground) {
                    if (this.healthBarForeground.geometry) this.healthBarForeground.geometry.dispose();
                    if (this.healthBarForeground.material) {
                        if (this.healthBarForeground.material.map) {
                            this.healthBarForeground.material.map.dispose();
                        }
                        this.healthBarForeground.material.dispose();
                    }
                }
                
                if (this.healthBarBorder) {
                    if (this.healthBarBorder.geometry) this.healthBarBorder.geometry.dispose();
                    if (this.healthBarBorder.material) this.healthBarBorder.material.dispose();
                }
                
                this.model = null;
                this.healthBarContainer = null;
                this.healthBarBackground = null;
                this.healthBarForeground = null;
                this.healthBarBorder = null;
            }
        }, 1000);
    }
}

export default Enemy; 