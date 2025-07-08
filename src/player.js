import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';

class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera; // Use the camera passed from GameEngine
        this.speed = 5;
        this.sprintSpeed = 8; // Sprint speed
        this.stamina = 100; // Maximum stamina
        this.currentStamina = 100; // Current stamina
        this.staminaDrain = 25; // Stamina drain per second while sprinting
        this.staminaRegen = 20; // Stamina regeneration per second while not sprinting
        this.jumpForce = 5;
        this.gravity = 9.8;
        this.velocity = new THREE.Vector3();
        this.isGrounded = false;
        this.health = 100;
        this.maxHealth = 100;
        this.healthRegenRate = 2; // Slower health regeneration per second (was 5)
        this.healthRegenLimit = 50; // Health regeneration stops at this value
        this.mouseSensitivity = 0.002; // Sensitivity for first-person camera
        this.isPointerLocked = false;
        this.isPaused = false;
        this.isGodMode = false;
        this.infiniteJump = false;
        
        // Camera view mode: 'firstPerson' or 'topDown'
        this.viewMode = 'firstPerson';
        
        // Player position (separate from camera)
        this.position = new THREE.Vector3(0, 1.0, 0); // Lower initial height
        
        // First-person camera properties
        this.cameraOffset = new THREE.Vector3(0, 0.5, 0); // Head height reduced
        this.lookDirection = new THREE.Vector3(0, 0, -1); // Looking forward
        
        // Camera smoothing properties
        this.cameraTargetPosition = new THREE.Vector3();
        this.cameraTargetLookAt = new THREE.Vector3();
        this.cameraSmoothingFactor = 0.9; // Higher = smoother but more laggy
        this.lastDelta = { x: 0, y: 0 }; // Store last mouse movement
        this.movementBuffer = []; // Buffer for mouse movements to reduce jitter
        this.bufferSize = 3; // Number of frames to average
        
        // Create a simple player representation (a cube for now)
        this.createPlayerModel();
        
        // Set initial camera position based on view mode
        this.updateCameraPosition();
        
        // Ensure camera is part of the scene
        if (!this.scene.children.includes(this.camera)) {
            this.scene.add(this.camera);
        }
        
        // Setup pointer lock for first-person mode
        this.setupPointerLock();
        
        console.log("Player initialized with improved camera system");
    }

    createPlayerModel() {
        // Create a smaller player model (cube)
        const geometry = new THREE.BoxGeometry(0.6, 1.4, 0.6); // Smaller dimensions
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.model = new THREE.Mesh(geometry, material);
        this.model.position.copy(this.position);
        this.scene.add(this.model);
    }
    
    setupPointerLock() {
        // Add click handler to request pointer lock
        document.addEventListener('click', () => {
            if (!this.isPointerLocked && !this.isPaused && this.viewMode === 'firstPerson') {
                document.body.requestPointerLock();
                console.log('Requesting pointer lock');
            }
        });
        
        // Add pointer lock change handler
        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === document.body;
            
            if (this.isPointerLocked) {
                console.log('Pointer locked');
                document.body.style.cursor = 'none';
                // Reset movement buffer on pointer lock
                this.movementBuffer = [];
                this.lastDelta = { x: 0, y: 0 };
            } else {
                console.log('Pointer unlocked');
                document.body.style.cursor = 'default';
            }
        });
        
        // Handle mouse movement for first-person camera
        document.addEventListener('mousemove', (event) => {
            if (this.isPointerLocked && this.viewMode === 'firstPerson') {
                // Get mouse movement with safety checks
                const movementX = event.movementX || 0;
                const movementY = event.movementY || 0;
                 
                // Add to movement buffer
                this.movementBuffer.push({ x: movementX, y: movementY });
                
                // Keep buffer at desired size
                if (this.movementBuffer.length > this.bufferSize) {
                    this.movementBuffer.shift();
                }
                
                // Calculate average movement from buffer
                let avgX = 0, avgY = 0;
                this.movementBuffer.forEach(m => {
                    avgX += m.x;
                    avgY += m.y;
                });
                avgX /= this.movementBuffer.length;
                avgY /= this.movementBuffer.length;
                
                // Store for velocity calculation
                this.lastDelta = { x: avgX, y: avgY };
                
                // IMPROVED CAMERA ROTATION:
                // First handle yaw (left/right) rotation - simpler and more reliable
                const yawQuat = new THREE.Quaternion();
                yawQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -avgX * this.mouseSensitivity);
                this.lookDirection.applyQuaternion(yawQuat);
                
                // For pitch (up/down), use Euler angles which are more intuitive for this purpose
                // Extract current pitch from lookDirection
                const currentPitch = Math.asin(this.lookDirection.y);
                
                // Apply new pitch, with clamping to prevent flipping
                const newPitch = Math.max(-Math.PI/2.5, Math.min(Math.PI/2.5, currentPitch - avgY * this.mouseSensitivity));
                
                // Reconstruct lookDirection with new pitch
                const horizontalLength = Math.cos(newPitch);
                const horizontalDirection = new THREE.Vector2(this.lookDirection.x, this.lookDirection.z).normalize();
                
                this.lookDirection.x = horizontalDirection.x * horizontalLength;
                this.lookDirection.y = Math.sin(newPitch);
                this.lookDirection.z = horizontalDirection.y * horizontalLength;
                this.lookDirection.normalize();
                
                // Update camera immediately
                this.updateCameraPosition();
            }
        });
        
        // Add key handler for toggling view mode
        document.addEventListener('keydown', (event) => {
            if (event.key === 'v' && !this.isPaused) {
                this.toggleViewMode();
            }
        });
    }
    
    toggleViewMode() {
        this.viewMode = this.viewMode === 'firstPerson' ? 'topDown' : 'firstPerson';
        console.log(`Switched to ${this.viewMode} view`);
        
        // Exit pointer lock if switching to top-down
        if (this.viewMode === 'topDown' && document.pointerLockElement === document.body) {
            document.exitPointerLock();
        }
        
        // Update camera position
        this.updateCameraPosition();
    }
    
    updateCameraPosition() {
        if (this.viewMode === 'firstPerson') {
            // Position camera at head level
            const headPosition = this.position.clone().add(this.cameraOffset);
            
            // Set target position and look target
            this.cameraTargetPosition.copy(headPosition);
            const target = headPosition.clone().add(this.lookDirection);
            this.cameraTargetLookAt.copy(target);
            
            // Apply immediate position for responsive feel
            this.camera.position.copy(this.cameraTargetPosition);
            this.camera.lookAt(this.cameraTargetLookAt);
        } else {
            // Top-down view with smooth interpolation
            this.cameraTargetPosition.set(this.position.x, 10, this.position.z + 15);
            this.cameraTargetLookAt.copy(this.position);
            
            // Apply immediate position in top-down view
            this.camera.position.copy(this.cameraTargetPosition);
            this.camera.lookAt(this.cameraTargetLookAt);
        }
    }

    update(deltaTime, input, environment) {
        if (this.isPaused) return;

        // Handle movement
        const moveDirection = new THREE.Vector3();

        if (this.viewMode === 'firstPerson') {
            // First-person movement: forward/backward in look direction, strafe left/right
            const forward = new THREE.Vector3(
                this.lookDirection.x,
                0, // Keep movement on XZ plane
                this.lookDirection.z
            ).normalize();
            
            // Calculate the correct right vector (positive X direction is right)
            // Right vector should be perpendicular to forward vector in the XZ plane
            const up = new THREE.Vector3(0, 1, 0);
            const right = new THREE.Vector3();
            right.crossVectors(forward, up).normalize();
            
            // Apply movement based on keys
            if (input.isKeyPressed('w')) moveDirection.add(forward);
            if (input.isKeyPressed('s')) moveDirection.sub(forward);
            if (input.isKeyPressed('a')) moveDirection.sub(right);  // A moves left (subtract right)
            if (input.isKeyPressed('d')) moveDirection.add(right);  // D moves right (add right)
            
            // Remove up/down movement with Q/E in first-person mode
            // const up = new THREE.Vector3(0, 1, 0);
            // if (input.isKeyPressed('e')) moveDirection.add(up);
            // if (input.isKeyPressed('q')) moveDirection.sub(up);
        } else {
            // Top-down view: direct cardinal movement
            const forward = new THREE.Vector3(0, 0, -1);   // Forward is always -Z
            const right = new THREE.Vector3(1, 0, 0);      // Right is always +X
            
            // Forward/backward movement with W/S
            if (input.isKeyPressed('w')) moveDirection.add(forward);
            if (input.isKeyPressed('s')) moveDirection.sub(forward);
            
            // Left/right movement with A/D
            if (input.isKeyPressed('a')) moveDirection.sub(right);  // A moves left (subtract right)
            if (input.isKeyPressed('d')) moveDirection.add(right);  // D moves right (add right)
        }
        
        // Handle sprinting
        let currentSpeed = this.speed;
        if (input.isKeyPressed('shift') && this.currentStamina > 0 && moveDirection.length() > 0) {
            currentSpeed = this.sprintSpeed;
            this.currentStamina = Math.max(0, this.currentStamina - this.staminaDrain * deltaTime);
        } else if (!input.isKeyPressed('shift')) {
            this.currentStamina = Math.min(this.stamina, this.currentStamina + this.staminaRegen * deltaTime);
        }

        // Normalize and apply movement
        if (moveDirection.length() > 0) {
            moveDirection.normalize();
            moveDirection.multiplyScalar(currentSpeed * deltaTime);
        }

        // Calculate new position from movement
        const newPosition = this.position.clone();
        newPosition.add(moveDirection);
        
        // Handle jumping with spacebar
        if (input.isKeyPressed(' ') && (this.isGrounded || this.infiniteJump)) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
        }

        // Apply gravity
        this.velocity.y -= this.gravity * deltaTime;
        newPosition.y += this.velocity.y * deltaTime;

        // Check for collisions and update position
        if (!environment.checkWallCollision(newPosition)) {
            this.position.copy(newPosition);
        } else {
            // Try horizontal movement only if vertical movement fails
            newPosition.y = this.position.y;
            if (!environment.checkWallCollision(newPosition)) {
                this.position.copy(newPosition);
            }
        }

        // Ground check - always check ground without the E/Q condition
        if (this.position.y <= 1.0) {
            this.position.y = 1.0; // Set to player height
            this.velocity.y = 0;
            this.isGrounded = true;
        }
        
        // Update the player model position
        this.model.position.copy(this.position);
        
        // Make the model invisible in first-person mode
        if (this.viewMode === 'firstPerson') {
            this.model.visible = false;
        } else {
            this.model.visible = true;
        }
        
        // Update camera position
        this.updateCameraPosition();
        
        // Apply smooth camera movement - lerp between current and target
        if (!this.isPointerLocked) {
            // Smoothly interpolate camera position when not pointer locked
            this.camera.position.lerp(this.cameraTargetPosition, this.cameraSmoothingFactor * deltaTime * 10);
            
            // Create a temporary vector for the current look target
            const currentLookTarget = new THREE.Vector3();
            this.camera.getWorldDirection(currentLookTarget);
            currentLookTarget.multiplyScalar(10);
            currentLookTarget.add(this.camera.position);
            
            // Smoothly interpolate the look target
            currentLookTarget.lerp(this.cameraTargetLookAt, this.cameraSmoothingFactor * deltaTime * 10);
            this.camera.lookAt(currentLookTarget);
        }
        
        // Update velocity for weapon bob effects
        this.velocity.x = moveDirection.x / deltaTime;
        this.velocity.z = moveDirection.z / deltaTime;
        
        // Health regeneration up to the limit
        if (this.health < this.healthRegenLimit) {
            this.health = Math.min(this.healthRegenLimit, this.health + this.healthRegenRate * deltaTime);
        }
    }

    takeDamage(amount) {
        if (this.isGodMode) return; // Ignore damage if god mode is enabled
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            // Trigger game over
            this.isDead = true;
            if (window.gameEngine) {
                console.log('Player died, triggering game over');
                window.gameEngine.gameOver();
            }
        }
    }

    getHealth() {
        return this.health;
    }

    getMaxHealth() {
        return this.maxHealth;
    }

    setPaused(paused) {
        this.isPaused = paused;
        
        // When pausing in pointer lock, exit pointer lock
        if (paused && document.pointerLockElement === document.body) {
            document.exitPointerLock();
        }
    }

    // Add stamina getter methods
    getStamina() {
        return this.currentStamina;
    }

    getMaxStamina() {
        return this.stamina;
    }

    reset() {
        // Reset position
        this.position.set(0, 1.0, 0); // Lower reset height
        this.model.position.copy(this.position);
        
        // Reset look direction
        this.lookDirection = new THREE.Vector3(0, 0, -1);
        
        // Reset camera smoothing buffers
        this.cameraTargetPosition.copy(this.position.clone().add(this.cameraOffset));
        this.cameraTargetLookAt.copy(this.cameraTargetPosition.clone().add(this.lookDirection));
        this.movementBuffer = [];
        this.lastDelta = { x: 0, y: 0 };
        
        // Reset camera
        this.updateCameraPosition();
        
        // Reset movement
        this.velocity.set(0, 0, 0);
        this.isGrounded = false;
        
        // Reset stats
        this.health = this.maxHealth;
        this.currentStamina = this.stamina;
        
        // Reset state
        this.isPointerLocked = false;
        this.isPaused = false;
    }

    toggleGodMode() {
        this.isGodMode = !this.isGodMode;
        return this.isGodMode;
    }

    toggleInfiniteJump() {
        this.infiniteJump = !this.infiniteJump;
        return this.infiniteJump;
    }
}

export default Player; 