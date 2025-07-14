import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';

class Weapon {
    constructor(scene, camera, maxAmmo) {
        this.scene = scene;
        this.camera = camera;
        this.damage = 25;
        this.fireRate = 0.5; // seconds
        this._originalFireRate = 0.5; // Store the original fire rate
        this.lastShot = 0;
        this.range = 100;
        this.ammo = 30;
        this.maxAmmo = typeof maxAmmo === 'number' ? maxAmmo : 30;
        this.infiniteAmmo = false; // Add infinite ammo property

        // Reload parameters
        this.isReloading = false;
        this.reloadTime = 2000; // 2 seconds reload time
        this.reloadStartTime = 0;

        // Recoil parameters
        this.recoilAmount = 0.003; // Very small recoil
        this.recoilRecoverySpeed = 0.08; // Slower, smoother recovery
        this.maxRecoil = 0.015; // Maximum recoil buildup
        this.currentRecoil = 0;
        this.isRecovering = false;
        this.originalRotation = new THREE.Euler();
        this.lastRecoilTime = 0;
        this.recoilCooldown = 100; // ms

        // Weapon position and rotation offsets
        this.positionOffset = new THREE.Vector3(0.2, -0.15, -0.3);
        this.rotationOffset = new THREE.Euler(0, 0, 0);
        this.bobAmount = 0.02;
        this.bobSpeed = 0.1;
        this.bobTime = 0;

        // Create weapon model
        this.createModel();

        // Create thicker line for bullet visualization
        const lineGeometry = new THREE.BufferGeometry();
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffff00,
            linewidth: 5, // Thicker line (note: limited by WebGL)
            opacity: 0.8,
            transparent: true
        });
        this.bulletLine = new THREE.Line(lineGeometry, lineMaterial);
        this.scene.add(this.bulletLine);
        this.bulletLine.visible = false;
        
        // Create bullet trail effect
        this.bulletTrailMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffaa,
            transparent: true,
            opacity: 0.6
        });
        this.activeTrails = [];

        console.log('[Weapon] Constructed, fireRate:', this.fireRate, '_originalFireRate:', this._originalFireRate);
    }

    createModel() {
        // Create weapon parts
        const gunBody = new THREE.Group();

        // Main body
        const bodyGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.4);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);

        // Barrel
        const barrelGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
        const barrelMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = 0.25;

        // Handle
        const handleGeometry = new THREE.BoxGeometry(0.08, 0.15, 0.1);
        const handleMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.y = -0.12;
        handle.position.z = -0.05;
        handle.rotation.x = 0.3;

        // Sight
        const sightGeometry = new THREE.BoxGeometry(0.02, 0.04, 0.02);
        const sightMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
        const sight = new THREE.Mesh(sightGeometry, sightMaterial);
        sight.position.y = 0.06;
        sight.position.z = 0.1;

        // Assemble weapon
        gunBody.add(body);
        gunBody.add(barrel);
        gunBody.add(handle);
        gunBody.add(sight);
        
        // Rotate the entire gun group to point forward
        gunBody.rotation.y = 0;

        this.model = gunBody;
        
        // Make weapon more visible with brighter material 
        this.model.traverse(child => {
            if (child.isMesh) {
                // Make materials brighter
                child.material.color.multiplyScalar(1.5);
                // Ensure they receive light
                child.receiveShadow = true;
                child.castShadow = true;
            }
        });
        
        // Position weapon in front of camera with proper offsets
        this.model.position.copy(this.positionOffset);
        this.model.rotation.copy(this.rotationOffset);
        
        // Remove the model if it already exists
        if (this.camera.children.find(child => child === this.model)) {
            this.camera.remove(this.model);
        }
        
        // Add model to camera
        this.camera.add(this.model);
        
        // Make sure scene reference is to the camera as well
        if (!this.scene.children.includes(this.camera)) {
            this.scene.add(this.camera);
        }
    }

    shoot(enemyManager) {
        const currentTime = performance.now() / 1000;
        
        // Prevent shooting if reloading or rate of fire cooldown or no ammo
        if (this.isReloading || currentTime - this.lastShot < this.fireRate || (this.ammo <= 0 && !this.infiniteAmmo)) {
            // Play empty clip sound if no ammo
            if (this.ammo <= 0 && !this.infiniteAmmo) {
                console.log('Click! Out of ammo. Press R to reload.');
                // Could add a sound effect for empty gun here
            }
            return false;
        }

        console.log('[Weapon] Shot fired, fireRate:', this.fireRate);
        // Only decrease ammo if infinite ammo is not enabled
        if (!this.infiniteAmmo) {
            this.ammo--;
        }
        this.lastShot = currentTime;
        
        // Removed auto-reload when empty

        // Register shot fired with wave system
        if (window.gameEngine && window.gameEngine.onShotFired) {
            window.gameEngine.onShotFired();
        }

        // Trigger screen shake based on weapon type
        if (window.gameEngine) {
            const shakeIntensity = 0.1; // Base intensity
            const shakeDuration = 100; // ms
            window.gameEngine.applyScreenShake(shakeIntensity, shakeDuration);
        }

        // Create ray from camera
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

        // Get all meshes from enemies for intersection testing
        const enemyMeshes = [];
        const enemyMap = new Map(); // Map to track which mesh belongs to which enemy
        
        if (enemyManager && enemyManager.enemies) {
            enemyManager.enemies.forEach(enemy => {
                if (enemy.model) {
                    // Map the enemy model to the enemy instance
                    enemyMap.set(enemy.model.id, enemy);
                    enemyMeshes.push(enemy.model);
                    
                    // Also add any child meshes and map them
                    enemy.model.traverse((child) => {
                        if (child.isMesh) {
                            enemyMap.set(child.id, enemy);
                            enemyMeshes.push(child);
                        }
                    });
                }
            });
        } else {
            console.warn('No valid enemy manager or enemies available');
        }

        // Check for intersections
        const intersects = raycaster.intersectObjects(enemyMeshes, true);

        // Calculate end position
        const startPosition = this.camera.position.clone();
        let endPosition;
        let hitEnemy = null;
        
        if (intersects.length > 0) {
            endPosition = intersects[0].point;
            
            // Get the enemy that was hit using our map
            const hitObject = intersects[0].object;
            hitEnemy = enemyMap.get(hitObject.id);

            if (hitEnemy) {
                console.log('Hit enemy of type:', hitEnemy.type);
                
                // Create hit effect at impact point
                this.createHitEffect(endPosition);
                
                // Handle the hit and get points
                const points = enemyManager.handleHit(hitEnemy, this.damage);
                console.log('Enemy hit! Points:', points);
                
                // Register shot hit with wave system directly
                if (window.gameEngine && window.gameEngine.onShotHit) {
                    window.gameEngine.onShotHit();
                }
                
                return points;
            } else {
                console.warn('Hit object not mapped to an enemy:', hitObject);
            }
        } else {
            endPosition = startPosition.clone().add(
                raycaster.ray.direction.multiplyScalar(this.range)
            );
        }

        // Create bullet trail
        this.createBulletTrail(startPosition, endPosition);

        // Update bullet line
        const positions = new Float32Array([
            startPosition.x, startPosition.y, startPosition.z,
            endPosition.x, endPosition.y, endPosition.z
        ]);
        this.bulletLine.geometry.setAttribute('position', 
            new THREE.BufferAttribute(positions, 3)
        );
        this.bulletLine.visible = true;

        // Hide bullet line after a short delay
        setTimeout(() => {
            this.bulletLine.visible = false;
        }, 50);

        // Create muzzle flash
        this.createMuzzleFlash();

        // Add recoil
        this.addRecoil();

        return 0; // No points if no enemy was hit
    }

    createBulletTrail(startPos, endPos) {
        // Create a cylinder between start and end points
        const direction = new THREE.Vector3().subVectors(endPos, startPos);
        const distance = direction.length();
        
        // Create trail geometry
        const geometry = new THREE.CylinderGeometry(0.03, 0.01, distance, 8);
        const trail = new THREE.Mesh(geometry, this.bulletTrailMaterial.clone());
        
        // Position and orient trail
        trail.position.copy(startPos.clone().add(endPos).multiplyScalar(0.5));
        trail.lookAt(endPos);
        trail.rotateX(Math.PI / 2);
        
        // Add to scene
        this.scene.add(trail);
        
        // Track for cleanup
        const trailData = {
            mesh: trail,
            createdAt: performance.now(),
            duration: 200 // ms
        };
        this.activeTrails.push(trailData);
        
        // Schedule removal
        setTimeout(() => {
            this.scene.remove(trailData.mesh);
            this.activeTrails = this.activeTrails.filter(t => t !== trailData);
        }, trailData.duration);
    }

    createHitEffect(position) {
        // Create hit particle effect
        const particleCount = 15; // More particles
        const particles = new THREE.Group();
        
        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(0.04, 8, 8); // Bigger particles
            const material = new THREE.MeshBasicMaterial({
                color: 0xff4500, // Brighter orange-red
                transparent: true,
                opacity: 0.9
            });
            const particle = new THREE.Mesh(geometry, material);
            
            // Set random position around hit point
            particle.position.copy(position);
            particle.position.x += (Math.random() - 0.5) * 0.3;
            particle.position.y += (Math.random() - 0.5) * 0.3;
            particle.position.z += (Math.random() - 0.5) * 0.3;
            
            particles.add(particle);
            
            // Add to scene directly for better visibility
            this.scene.add(particle);
            
            // Animate particle
            const direction = particle.position.clone().sub(position).normalize();
            const speed = 0.15 + Math.random() * 0.25; // Faster particles
            
            const animate = () => {
                particle.position.add(direction.clone().multiplyScalar(speed));
                particle.material.opacity -= 0.03;
                particle.scale.multiplyScalar(0.97); // Shrink particles
                
                if (particle.material.opacity > 0) {
                    requestAnimationFrame(animate);
                } else {
                    this.scene.remove(particle);
                }
            };
            
            animate();
        }
        
        // Create impact flash
        const flashGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.7
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(position);
        this.scene.add(flash);
        
        // Animate flash
        let flashScale = 1.0;
        const animateFlash = () => {
            flashScale *= 1.1;
            flash.scale.set(flashScale, flashScale, flashScale);
            flash.material.opacity -= 0.1;
            
            if (flash.material.opacity > 0) {
                requestAnimationFrame(animateFlash);
            } else {
                this.scene.remove(flash);
            }
        };
        
        animateFlash();
    }

    createMuzzleFlash() {
        const flashGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        
        // Position flash at weapon tip (front of barrel)
        flash.position.set(0, 0, 0.5);
        this.model.add(flash);

        // Remove flash after short delay
        setTimeout(() => {
            this.model.remove(flash);
        }, 50);
    }

    addRecoil() {
        // Do nothing - no recoil with non-rotating camera
    }

    recoverFromRecoil() {
        // Do nothing - no recoil with non-rotating camera
    }

    update(deltaTime, playerVelocity) {
        // Update bullet trails
        this.updateBulletTrails();
        
        // Hide bullet line after a short delay
        if (this.bulletLine.visible) {
            setTimeout(() => {
                this.bulletLine.visible = false;
            }, 50);
        }
        
        // Check if player is in third-person mode and hide weapon model if so
        if (window.gameEngine && window.gameEngine.player) {
            const playerViewMode = window.gameEngine.player.viewMode;
            this.model.visible = (playerViewMode !== 'thirdPerson');
        }
        
        // Skip weapon updates if not visible
        if (!this.model.visible) return;
        
        // Recover from recoil
        if (this.currentRecoil > 0) {
            this.recoverFromRecoil();
        }
        
        // Handle weapon bobbing based on player movement
        if (playerVelocity) {
            const speed = Math.sqrt(playerVelocity.x * playerVelocity.x + playerVelocity.z * playerVelocity.z);
            
            if (speed > 0.5) {
                // Increase bob time based on player speed
                this.bobTime += deltaTime * this.bobSpeed * (speed / 5);
                
                // Calculate bob offsets
                const bobX = Math.sin(this.bobTime * 2) * this.bobAmount * speed;
                const bobY = Math.sin(this.bobTime * 4) * this.bobAmount * speed;
                
                // Apply bobbing to weapon position
                this.model.position.x = this.positionOffset.x + bobX;
                this.model.position.y = this.positionOffset.y + bobY;
            } else {
                // Gradually return to rest position when not moving
                this.model.position.x = THREE.MathUtils.lerp(this.model.position.x, this.positionOffset.x, deltaTime * 5);
                this.model.position.y = THREE.MathUtils.lerp(this.model.position.y, this.positionOffset.y, deltaTime * 5);
            }
        }
        
        // Handle reload animation
        if (this.isReloading) {
            const elapsed = Date.now() - this.reloadStartTime;
            const progress = Math.min(1, elapsed / this.reloadTime);
            
            // Simple reload animation
            if (progress < 0.5) {
                // First half: move weapon down and rotate
                const downAmount = Math.sin(progress * Math.PI) * 0.2;
                const rotateAmount = progress * 0.3;
                
                this.model.position.y = this.positionOffset.y - downAmount;
                this.model.rotation.x = this.rotationOffset.x + rotateAmount;
            } else {
                // Second half: move weapon back up and rotate back
                const upProgress = (progress - 0.5) * 2;
                const downAmount = Math.sin((1 - upProgress) * Math.PI) * 0.2;
                const rotateAmount = (1 - upProgress) * 0.3;
                
                this.model.position.y = this.positionOffset.y - downAmount;
                this.model.rotation.x = this.rotationOffset.x + rotateAmount;
            }
            
            // Reload complete
            if (progress >= 1) {
                this.isReloading = false;
                this.ammo = this.maxAmmo;
                
                // Reset position and rotation
                this.model.position.copy(this.positionOffset);
                this.model.rotation.copy(this.rotationOffset);
            }
        }
    }

    reload() {
        // Only reload if not at max ammo and not already reloading and infinite ammo is not enabled
        if (this.ammo < this.maxAmmo && !this.isReloading && !this.infiniteAmmo) {
            // Start reloading
            this.isReloading = true;
            this.reloadStartTime = performance.now();
            
            // Show reload UI indicator if available
            if (window.gameEngine && window.gameEngine.ui) {
                window.gameEngine.ui.showReloadIndicator(this.reloadTime);
            }
            
            // Play reload sound (if available)
            // ...
            
            return true;
        }
        return false;
    }

    reset() {
        console.log('[Weapon] Resetting weapon state');
        
        // Reset ammo and shooting parameters
        this.ammo = this.maxAmmo;
        this.lastShot = 0;
        this.currentRecoil = 0;
        this.isRecovering = false;
        this.isReloading = false;
        this.reloadStartTime = 0;
        
        // Restore fireRate to original value
        this.fireRate = this._originalFireRate;
        
        // Reset infinite ammo
        this.infiniteAmmo = false;
        
        // Reset weapon position and rotation
        if (this.model) {
            this.model.position.copy(this.positionOffset);
            this.model.rotation.copy(this.rotationOffset);
        }
        
        // Reset camera rotation if available
        if (this.camera) {
            this.camera.rotation.copy(this.originalRotation);
        }
        
        // Hide bullet line
        if (this.bulletLine) {
            this.bulletLine.visible = false;
            
            // Reset bullet line geometry
            const positions = new Float32Array(6);
            this.bulletLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            this.bulletLine.geometry.attributes.position.needsUpdate = true;
        }
        
        // Clean up any active bullet trails
        if (this.activeTrails && this.activeTrails.length > 0) {
            this.activeTrails.forEach(trail => {
                if (trail.mesh) {
                    this.scene.remove(trail.mesh);
                    if (trail.mesh.geometry) trail.mesh.geometry.dispose();
                    if (trail.mesh.material) trail.mesh.material.dispose();
                }
            });
            this.activeTrails = [];
        }
        
        // Reset weapon bobbing
        this.bobTime = 0;
        
        console.log('[Weapon] Reset complete, fireRate:', this.fireRate, '_originalFireRate:', this._originalFireRate);
    }

    updateBulletTrails() {
        // Clean up any expired bullet trails
        const currentTime = performance.now();
        this.activeTrails = this.activeTrails.filter(trail => {
            const age = currentTime - trail.createdAt;
            if (age > trail.duration) {
                this.scene.remove(trail.mesh);
                return false;
            }
            
            // Fade out the trail
            const opacity = 1 - (age / trail.duration);
            trail.mesh.material.opacity = opacity;
            
            return true;
        });
    }

    // Add a method to increase max ammo
    increaseMaxAmmo(amount) {
        this.maxAmmo += amount;
        // Optionally, also increase current ammo by the same amount
        this.ammo = Math.min(this.maxAmmo, this.ammo + amount);
    }
}

export default Weapon; 