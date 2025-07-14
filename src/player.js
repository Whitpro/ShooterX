import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';

class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera; // Use the camera passed from GameEngine
        this.speed = 5;
        this.sprintSpeed = 8; // Sprint speed
        
        // Stamina system - completely rewritten
        this._stamina = {
            max: 100,
            current: 100,
            drainRate: 25,  // per second while sprinting
            regenRate: 20,  // per second while not sprinting
            canSprint: true,
            wasSprintingLastFrame: false
        };
        
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
        this.isDead = false;
        
        // Camera view mode: 'firstPerson', 'thirdPerson', or 'topDown'
        this.viewMode = 'firstPerson';
        
        // Player position (separate from camera)
        this.position = new THREE.Vector3(0, 1.0, 0); // Lower initial height
        
        // First-person camera properties
        this.cameraOffset = new THREE.Vector3(0, 0.5, 0); // Head height reduced
        
        // Third-person camera properties
        this.thirdPersonDistance = 4.0; // Distance behind player
        this.thirdPersonHeight = 1.5;   // Height above player
        this.thirdPersonOffset = new THREE.Vector3(0, this.thirdPersonHeight, this.thirdPersonDistance);
        
        this.lookDirection = new THREE.Vector3(0, 0, -1); // Looking forward
        
        // Camera smoothing properties
        this.cameraTargetPosition = new THREE.Vector3();
        this.cameraTargetLookAt = new THREE.Vector3();
        this.cameraSmoothingFactor = 0.9; // Higher = smoother but more laggy
        this.lastDelta = { x: 0, y: 0 }; // Store last mouse movement
        this.movementBuffer = []; // Buffer for mouse movements to reduce jitter
        this.bufferSize = 3; // Number of frames to average
        
        // Animation properties
        this.animationState = 'idle'; // idle, walking, running, jumping
        this.animationTime = 0;
        this.animationSpeed = {
            idle: 1.0,
            walking: 1.5,
            running: 2.5
        };
        this.bobAmount = {
            idle: 0.03,
            walking: 0.05,
            running: 0.08
        };
        
        // Create player models
        this.createPlayerModel();
        
        // Set initial camera position based on view mode
        this.updateCameraPosition();
        
        // Ensure camera is part of the scene
        if (!this.scene.children.includes(this.camera)) {
            this.scene.add(this.camera);
        }
        
        // Setup pointer lock for first-person mode
        this.setupPointerLock();
        
    }

    createPlayerModel() {
        // Create a group to hold all player models
        this.modelGroup = new THREE.Group();
        this.scene.add(this.modelGroup);
        
        // Create simple box model (used for first-person shadows and top-down view)
        const boxGeometry = new THREE.BoxGeometry(0.6, 1.4, 0.6);
        const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.boxModel = new THREE.Mesh(boxGeometry, boxMaterial);
        this.modelGroup.add(this.boxModel);
        
        // Create detailed player model for third-person view
        this.createDetailedPlayerModel();
        
        // Position the model group
        this.modelGroup.position.copy(this.position);
    }
    
    createDetailedPlayerModel() {
        // Create a detailed humanoid model for third-person view
        this.detailedModel = new THREE.Group();
        
        // Body parts with better materials
        const bodyMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x3366ff,
            shininess: 30
        });
        
        // Torso - positioned lower
        const torsoGeometry = new THREE.BoxGeometry(0.6, 0.7, 0.3);
        const torso = new THREE.Mesh(torsoGeometry, bodyMaterial);
        torso.position.y = 0.2; // Lower from 0.35 to 0.2
        this.detailedModel.add(torso);
        this.torso = torso; // Store reference for animations
        
        // Head - smooth sphere with no jagged parts
        const headGeometry = new THREE.SphereGeometry(0.2, 24, 24); // Higher resolution sphere
        const headMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xffcc99,
            shininess: 20
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 0.7;
        this.detailedModel.add(head);
        this.head = head; // Store reference for animations
        
        // Arms - positioned lower
        const armGeometry = new THREE.BoxGeometry(0.2, 0.6, 0.2);
        
        // Left arm
        const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
        leftArm.position.set(-0.4, 0.15, 0); // Lower from 0.3 to 0.15
        this.detailedModel.add(leftArm);
        this.leftArm = leftArm; // Store reference for animations
        
        // Right arm
        const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
        rightArm.position.set(0.4, 0.15, 0); // Lower from 0.3 to 0.15
        this.detailedModel.add(rightArm);
        this.rightArm = rightArm; // Store reference for animations
        
        // Legs - positioned lower
        const legGeometry = new THREE.BoxGeometry(0.25, 0.7, 0.25);
        const legMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x222244,
            shininess: 10
        });
        
        // Left leg
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-0.2, -0.5, 0); // Lower from -0.35 to -0.5
        this.detailedModel.add(leftLeg);
        this.leftLeg = leftLeg; // Store reference for animations
        
        // Right leg
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(0.2, -0.5, 0); // Lower from -0.35 to -0.5
        this.detailedModel.add(rightLeg);
        this.rightLeg = rightLeg; // Store reference for animations
        
        // Add weapon to right hand
        const weaponGroup = new THREE.Group();
        
        // Gun body - larger for third-person view
        const gunGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.6); // Increased size
        const gunMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        const gun = new THREE.Mesh(gunGeometry, gunMaterial);
        weaponGroup.add(gun);
        
        // Barrel - larger for third-person view
        const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8); // Increased size
        const barrelMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = 0.35; // Adjusted for larger gun
        weaponGroup.add(barrel);
        
        // Add a grip to make the gun more visible
        const gripGeometry = new THREE.BoxGeometry(0.1, 0.25, 0.1);
        const gripMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
        const grip = new THREE.Mesh(gripGeometry, gripMaterial);
        grip.position.y = -0.15;
        grip.position.z = -0.15;
        weaponGroup.add(grip);
        
        // Position weapon in right hand - pointing forward and more to the front
        weaponGroup.position.set(0.4, 0.15, -0.3);  // Moved more to the front (z increased)
        weaponGroup.rotation.y = Math.PI;          // 180 degree rotation
        weaponGroup.rotation.z = 0;                // No tilt
        this.detailedModel.add(weaponGroup);
        this.weapon = weaponGroup; // Store reference for animations
        
        // Set up shadows for all parts
        this.detailedModel.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        // Add the detailed model to the model group
        this.modelGroup.add(this.detailedModel);
        
        // Initially hide detailed model
        this.detailedModel.visible = false;
        
        // Lower the entire model slightly
        this.detailedModel.position.y = -0.2; // Add an overall offset to lower the model
    }
    
    setupPointerLock() {
        // Add click handler to request pointer lock
        document.addEventListener('click', () => {
            if (window.isBugReportOpen) return; // Prevent pointer lock if bug report is open
            if (window.isInSettingsMenu) return; // Prevent pointer lock if settings menu is open
            if (window.isConsoleOpen) return; // Prevent pointer lock if console is open
            
            // Request pointer lock in first-person and third-person modes when not paused
            if (!this.isPointerLocked && !this.isPaused && 
                (this.viewMode === 'firstPerson' || this.viewMode === 'thirdPerson')) {
                document.body.requestPointerLock();
                
                // If game has a _preventAutoPause flag, clear it when player explicitly requests pointer lock
                if (window.gameEngine && window.gameEngine._preventAutoPause) {
                    window.gameEngine._preventAutoPause = false;
                }
            }
        });
        
        // Add pointer lock change handler
        document.addEventListener('pointerlockchange', () => {
            if (window.isBugReportOpen) {
                this.isPointerLocked = false;
                document.body.style.cursor = 'default';
                return;
            }
            
            // Don't lock pointer if settings menu is open
            if (window.isInSettingsMenu) {
                if (document.pointerLockElement === document.body) {
                    document.exitPointerLock();
                }
                this.isPointerLocked = false;
                document.body.style.cursor = 'default';
                return;
            }
            
            this.isPointerLocked = document.pointerLockElement === document.body;
            
            if (this.isPointerLocked) {
                document.body.style.cursor = 'none';
                // Reset movement buffer on pointer lock
                this.movementBuffer = [];
                this.lastDelta = { x: 0, y: 0 };
            } else {
                document.body.style.cursor = 'default';
            }
        });
        
        // Handle mouse movement for camera control
        document.addEventListener('mousemove', (event) => {
            // Skip mouse movement if settings menu is open
            if (window.isInSettingsMenu) return;
            
            if (this.isPointerLocked && 
                (this.viewMode === 'firstPerson' || this.viewMode === 'thirdPerson')) {
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
                
                // In third-person mode, rotate the detailed model to face the look direction
                this.updatePlayerRotation();
            }
        });
        
        // Add key handler for toggling view mode
        document.addEventListener('keydown', (event) => {
            if (event.key === 'v' && !this.isPaused) {
                this.toggleViewMode();
            }
        });
    }
    
    updatePlayerRotation() {
        // Always rotate the player model to face the look direction
        if (this.detailedModel) {
            // Calculate the angle between the look direction and the negative z-axis
            const angle = Math.atan2(this.lookDirection.x, -this.lookDirection.z);
            
            // Apply rotation immediately for more responsive movement
            this.detailedModel.rotation.y = angle;
            
            // Also rotate the weapon to match player orientation
            if (this.weapon) {
                // Keep weapon rotation aligned with player's forward direction
                this.weapon.rotation.y = Math.PI; // Keep pointing forward relative to player
            }
        }
    }
    
    toggleViewMode() {
        // Cycle through view modes: firstPerson -> thirdPerson -> topDown -> firstPerson
        if (this.viewMode === 'firstPerson') {
            this.viewMode = 'thirdPerson';
        } else if (this.viewMode === 'thirdPerson') {
            this.viewMode = 'topDown';
            // Exit pointer lock when switching to top-down
            if (document.pointerLockElement === document.body) {
                document.exitPointerLock();
            }
        } else {
            this.viewMode = 'firstPerson';
        }
        
        // Update model visibility based on view mode
        this.updateModelVisibility();
        
        // Update camera position
        this.updateCameraPosition();
    }
    
    updateModelVisibility() {
        // Update model visibility based on view mode
        if (this.viewMode === 'firstPerson') {
            // In first-person, hide all models
            this.boxModel.visible = false;
            this.detailedModel.visible = false;
        } else if (this.viewMode === 'thirdPerson') {
            // In third-person, show detailed model, hide box model
            this.boxModel.visible = false;
            this.detailedModel.visible = true;
        } else {
            // In top-down, show box model, hide detailed model
            this.boxModel.visible = true;
            this.detailedModel.visible = false;
        }
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
        } else if (this.viewMode === 'thirdPerson') {
            // Calculate third-person camera position
            // Start with player position
            const playerPos = this.position.clone();
            
            // Calculate camera position behind player based on look direction
            const reverseLookDir = this.lookDirection.clone().multiplyScalar(-1);
            
            // Create offset vector: behind and above player
            const offset = new THREE.Vector3(
                reverseLookDir.x * this.thirdPersonDistance,
                this.thirdPersonHeight,
                reverseLookDir.z * this.thirdPersonDistance
            );
            
            // Set camera target position
            this.cameraTargetPosition.copy(playerPos.add(offset));
            
            // Look at player position plus a small forward offset
            const lookAtPos = this.position.clone().add(
                new THREE.Vector3(
                    this.lookDirection.x * 2,
                    this.thirdPersonHeight * 0.5,
                    this.lookDirection.z * 2
                )
            );
            this.cameraTargetLookAt.copy(lookAtPos);
            
            // Apply position and look target
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
        // Check for pause state first thing and return immediately if paused
        if (this.isPaused) {
            // When paused, ensure velocity is zero to prevent any movement
            this.velocity.set(0, 0, 0);
            return;
        }

        // Handle movement
        const moveDirection = new THREE.Vector3();
        let isMovingForward = false;
        let isStrafing = false;

        if (this.viewMode === 'firstPerson' || this.viewMode === 'thirdPerson') {
            // First-person and third-person movement: forward/backward in look direction, strafe left/right
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
            
            // Track which keys are pressed for animation purposes
            const wPressed = input.isKeyPressed('w');
            const sPressed = input.isKeyPressed('s');
            const aPressed = input.isKeyPressed('a');
            const dPressed = input.isKeyPressed('d');
            
            // Apply movement based on keys
            if (wPressed) {
                moveDirection.add(forward);
                isMovingForward = true;
            }
            if (sPressed) {
                moveDirection.sub(forward);
                isMovingForward = false;
            }
            if (aPressed) {
                moveDirection.sub(right);  // A moves left (subtract right)
                isStrafing = true;
            }
            if (dPressed) {
                moveDirection.add(right);  // D moves right (add right)
                isStrafing = true;
            }
            
            // Always update player rotation to face look direction in third-person view
            if (this.viewMode === 'thirdPerson') {
                this.updatePlayerRotation();
                
                // If only strafing (not moving forward/backward), add a slight rotation offset
                // to make the player look more natural when strafing
                if (isStrafing && !wPressed && !sPressed && this.detailedModel) {
                    const strafeAngle = aPressed ? Math.PI / 8 : -Math.PI / 8;
                    this.detailedModel.rotation.y += strafeAngle;
                }
            }
        } else {
            // Top-down view: direct cardinal movement
            const forward = new THREE.Vector3(0, 0, -1);   // Forward is always -Z
            const right = new THREE.Vector3(1, 0, 0);      // Right is always +X
            
            // Forward/backward movement with W/S
            if (input.isKeyPressed('w')) {
                moveDirection.add(forward);
                isMovingForward = true;
            }
            if (input.isKeyPressed('s')) {
                moveDirection.sub(forward);
                isMovingForward = false;
            }
            
            // Left/right movement with A/D
            if (input.isKeyPressed('a')) {
                moveDirection.sub(right);  // A moves left (subtract right)
                isStrafing = true;
            }
            if (input.isKeyPressed('d')) {
                moveDirection.add(right);  // D moves right (add right)
                isStrafing = true;
            }
        }
        
        // COMPLETELY REWRITTEN STAMINA & SPRINT HANDLING
        // =============================================
        
        // 1. Determine if we should be sprinting
        let currentSpeed = this.speed;
        const isMoving = moveDirection.length() > 0;
        const isShiftPressed = input.isKeyPressed('shift');
        const isSprinting = isShiftPressed && isMoving && this._stamina.canSprint;
        
        // 2. Apply sprint speed if sprinting
        if (isSprinting) {
            currentSpeed = this.sprintSpeed;
        }
        
        // 3. Update stamina based on sprinting state
        this.updateStamina(deltaTime, isSprinting);
        
        // 4. Normalize and apply movement
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
        this.modelGroup.position.copy(this.position);
        
        // Update model visibility based on view mode
        this.updateModelVisibility();
        
        // Update player rotation to face the look direction
        this.updatePlayerRotation();
        
        // Update animation state based on movement
        this.updateAnimationState(isMoving, isSprinting, isMovingForward, isStrafing);
        
        // Update animations
        this.updateAnimations(deltaTime);
        
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
    
    updateAnimationState(isMoving, isSprinting, isMovingForward = true, isStrafing = false) {
        // Determine animation state based on movement
        if (!this.isGrounded) {
            this.animationState = 'jumping';
        } else if (isMoving) {
            this.animationState = isSprinting ? 'running' : 'walking';
        } else {
            this.animationState = 'idle';
        }
        
        // Store movement direction for animations
        this.isMovingForward = isMovingForward;
        this.isStrafing = isStrafing;
    }
    
    updateAnimations(deltaTime) {
        // Only update animations if in third-person view and model is visible
        if (this.viewMode !== 'thirdPerson' || !this.detailedModel.visible) return;
        
        // Get animation parameters based on current state
        const speed = this.animationSpeed[this.animationState] || this.animationSpeed.idle;
        const bobAmount = this.bobAmount[this.animationState] || this.bobAmount.idle;
        
        // Update animation time
        this.animationTime += deltaTime * speed;
        
        // Apply animations based on state
        switch (this.animationState) {
            case 'idle':
                // Subtle breathing animation
                this.torso.position.y = 0.2 + Math.sin(this.animationTime * 0.5) * 0.01;
                this.head.position.y = 0.7 + Math.sin(this.animationTime * 0.5) * 0.01;
                
                // Reset limb positions
                this.leftArm.rotation.x = Math.sin(this.animationTime * 0.5) * 0.05;
                this.rightArm.rotation.x = Math.sin(this.animationTime * 0.5) * 0.05;
                this.leftLeg.rotation.x = 0;
                this.rightLeg.rotation.x = 0;
                
                // Reset any forward lean
                this.detailedModel.rotation.x = 0;
                break;
                
            case 'walking':
                // Walking animation - arms and legs swing in opposite directions
                const walkFactor = this.isMovingForward ? 1 : -1; // Reverse animation when moving backward
                
                if (this.isStrafing && !this.isMovingForward) {
                    // Special strafing animation - arms and legs move differently
                    this.leftArm.rotation.x = Math.sin(this.animationTime * 2) * 0.3;
                    this.rightArm.rotation.x = Math.sin(this.animationTime * 2 + Math.PI) * 0.3;
                    this.leftLeg.rotation.z = Math.sin(this.animationTime * 2) * 0.1; // Side-to-side leg movement
                    this.rightLeg.rotation.z = Math.sin(this.animationTime * 2 + Math.PI) * 0.1;
                    this.leftLeg.rotation.x = Math.sin(this.animationTime * 2) * 0.2;
                    this.rightLeg.rotation.x = Math.sin(this.animationTime * 2 + Math.PI) * 0.2;
                } else {
                    // Regular walking animation
                    this.leftArm.rotation.x = Math.sin(this.animationTime * 2) * 0.4 * walkFactor;
                    this.rightArm.rotation.x = Math.sin(this.animationTime * 2 + Math.PI) * 0.4 * walkFactor;
                    this.leftLeg.rotation.x = Math.sin(this.animationTime * 2 + Math.PI) * 0.4 * walkFactor;
                    this.rightLeg.rotation.x = Math.sin(this.animationTime * 2) * 0.4 * walkFactor;
                    
                    // Reset any z-rotation
                    this.leftLeg.rotation.z = 0;
                    this.rightLeg.rotation.z = 0;
                }
                
                // Subtle body bob
                this.torso.position.y = 0.2 + Math.abs(Math.sin(this.animationTime * 4)) * bobAmount;
                this.head.position.y = 0.7 + Math.abs(Math.sin(this.animationTime * 4)) * bobAmount;
                
                // Slight lean forward or backward based on movement direction
                if (!this.isStrafing) {
                    this.detailedModel.rotation.x = this.isMovingForward ? 0.05 : -0.05;
                } else {
                    this.detailedModel.rotation.x = 0; // No forward/backward lean when strafing
                }
                break;
                
            case 'running':
                // Running animation - more exaggerated movement
                const runFactor = this.isMovingForward ? 1 : -1; // Reverse animation when moving backward
                
                if (this.isStrafing && !this.isMovingForward) {
                    // Special strafing run animation
                    this.leftArm.rotation.x = Math.sin(this.animationTime * 2) * 0.6;
                    this.rightArm.rotation.x = Math.sin(this.animationTime * 2 + Math.PI) * 0.6;
                    this.leftLeg.rotation.z = Math.sin(this.animationTime * 2) * 0.15; // Side-to-side leg movement
                    this.rightLeg.rotation.z = Math.sin(this.animationTime * 2 + Math.PI) * 0.15;
                    this.leftLeg.rotation.x = Math.sin(this.animationTime * 2) * 0.4;
                    this.rightLeg.rotation.x = Math.sin(this.animationTime * 2 + Math.PI) * 0.4;
                } else {
                    // Regular running animation
                    this.leftArm.rotation.x = Math.sin(this.animationTime * 2) * 0.8 * runFactor;
                    this.rightArm.rotation.x = Math.sin(this.animationTime * 2 + Math.PI) * 0.8 * runFactor;
                    this.leftLeg.rotation.x = Math.sin(this.animationTime * 2 + Math.PI) * 0.8 * runFactor;
                    this.rightLeg.rotation.x = Math.sin(this.animationTime * 2) * 0.8 * runFactor;
                    
                    // Reset any z-rotation
                    this.leftLeg.rotation.z = 0;
                    this.rightLeg.rotation.z = 0;
                }
                
                // More pronounced body bob
                this.torso.position.y = 0.2 + Math.abs(Math.sin(this.animationTime * 4)) * bobAmount;
                this.head.position.y = 0.7 + Math.abs(Math.sin(this.animationTime * 4)) * bobAmount;
                
                // More significant forward/backward lean based on movement direction
                if (!this.isStrafing) {
                    this.detailedModel.rotation.x = this.isMovingForward ? 0.1 : -0.1;
                } else {
                    this.detailedModel.rotation.x = 0; // No forward/backward lean when strafing
                }
                break;
                
            case 'jumping':
                // Jumping animation - arms up, legs bent
                this.leftArm.rotation.x = -0.5;
                this.rightArm.rotation.x = -0.5;
                this.leftLeg.rotation.x = 0.3;
                this.rightLeg.rotation.x = 0.3;
                
                // Reset any z-rotation
                this.leftLeg.rotation.z = 0;
                this.rightLeg.rotation.z = 0;
                break;
        }
        
        // Make weapon follow right arm animation
        if (this.weapon) {
            // Adjust weapon position based on arm movement
            const armOffset = Math.sin(this.animationTime * 2 + Math.PI) * 0.05;
            this.weapon.position.y = 0.15 + armOffset;
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

    // Getter for current stamina
    getStamina() {
        return this._stamina.current;
    }
    
    // Getter for max stamina
    getMaxStamina() {
        return this._stamina.max;
    }
    
    // Method to handle stamina changes
    updateStamina(deltaTime, isSprinting) {
        if (isSprinting) {
            // Drain stamina while sprinting
            this._stamina.current -= this._stamina.drainRate * deltaTime;
            
        } else {
            // Regenerate stamina when not sprinting
            this._stamina.current += this._stamina.regenRate * deltaTime;
            
        }
        
        // Ensure stamina stays within bounds
        this._stamina.current = Math.max(0, Math.min(this._stamina.current, this._stamina.max));
        
        // Update canSprint flag
        this._stamina.canSprint = this._stamina.current > 0;
        
        // Track sprinting state for this frame
        this._stamina.wasSprintingLastFrame = isSprinting;
    }

    reset() {
        console.log('[Player] Resetting player state');
        
        // Reset position
        this.position.set(0, 1.0, 0); // Lower reset height
        this.modelGroup.position.copy(this.position);
        
        // Reset look direction
        this.lookDirection = new THREE.Vector3(0, 0, -1);
        
        // Reset camera smoothing buffers
        this.cameraTargetPosition.copy(this.position.clone().add(this.cameraOffset));
        this.cameraTargetLookAt.copy(this.cameraTargetPosition.clone().add(this.lookDirection));
        this.movementBuffer = [];
        this.lastDelta = { x: 0, y: 0 };
        
        // Reset camera position and rotation immediately
        this.camera.position.copy(this.position.clone().add(this.cameraOffset));
        this.camera.lookAt(this.position.clone().add(this.cameraOffset).add(this.lookDirection));
        
        // Reset movement
        this.velocity.set(0, 0, 0);
        this.isGrounded = true; // Force grounded state on reset
        
        // Reset stats
        this.health = this.maxHealth;
        
        // Reset stamina system
        this._stamina.current = this._stamina.max;
        this._stamina.canSprint = true;
        this._stamina.wasSprintingLastFrame = false;
        
        this.isDead = false;
        
        // Reset state
        this.isPointerLocked = false;
        this.isPaused = false;
        
        // Reset view mode to first person
        this.viewMode = 'firstPerson';
        
        // Reset animation state
        this.animationState = 'idle';
        this.animationTime = 0;
        this.isMovingForward = true;
        this.isStrafing = false;
        
        // Reset model rotations and positions
        if (this.detailedModel) {
            this.detailedModel.rotation.x = 0;
            
            // Reset limb positions and rotations
            if (this.leftArm) {
                this.leftArm.rotation.x = 0;
                this.leftArm.rotation.y = 0;
                this.leftArm.rotation.z = 0;
            }
            if (this.rightArm) {
                this.rightArm.rotation.x = 0;
                this.rightArm.rotation.y = 0;
                this.rightArm.rotation.z = 0;
            }
            if (this.leftLeg) {
                this.leftLeg.rotation.x = 0;
                this.leftLeg.rotation.y = 0;
                this.leftLeg.rotation.z = 0;
            }
            if (this.rightLeg) {
                this.rightLeg.rotation.x = 0;
                this.rightLeg.rotation.y = 0;
                this.rightLeg.rotation.z = 0;
            }
            
            // Reset torso and head positions
            if (this.torso) this.torso.position.y = 0.2;
            if (this.head) this.head.position.y = 0.7;
            
            // Reset weapon position
            if (this.weapon) {
                this.weapon.position.y = 0.15;
                this.weapon.rotation.y = Math.PI; // Keep pointing forward
            }
        }
        
        // Update model visibility based on view mode
        this.updateModelVisibility();
        
        // Update camera position to match the reset state
        this.updateCameraPosition();
        
        console.log('[Player] Reset complete');
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