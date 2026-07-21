import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';
import { createRifleModel } from './weapon.js';

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
        this._ignoreMouseMove = false;
        this.isPaused = false;
        this.isGodMode = false;
        this.infiniteJump = false;
        this.isDead = false;
        
        // Camera view mode
        this.viewMode = 'firstPerson';
        this.firstPersonWeaponModel = null;
        
        // Player position (separate from camera)
        this.position = new THREE.Vector3(0, 1.0, 0); // Lower initial height
        
        // First-person camera properties
        this.cameraOffset = new THREE.Vector3(0, 0.5, 0); // Head height reduced
        
        // Third-person camera properties
        this.thirdPersonDistance = 4.8;
        this.thirdPersonHeight = 1.65;
        this.thirdPersonShoulderOffset = 0.72;
        this.shoulderSide = 1;
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

        // Reusable temp objects to reduce per-frame allocations
        this._moveDirection = new THREE.Vector3();
        this._forward = new THREE.Vector3();
        this._right = new THREE.Vector3();
        this._newPosition = new THREE.Vector3();
        this._currentLookTarget = new THREE.Vector3();
        this._headPosition = new THREE.Vector3();
        this._reverseLookDir = new THREE.Vector3();
        this._lookAtOffset = new THREE.Vector3();
        this._yawQuat = new THREE.Quaternion();
        this._yawAxis = new THREE.Vector3(0, 1, 0);
        this._horizontalDirection = new THREE.Vector2();
        this._cameraRaycaster = new THREE.Raycaster();
        this._cameraRayOrigin = new THREE.Vector3();
        this._cameraRayDirection = new THREE.Vector3();
        this._cameraCollisionObjects = [];
        this._cachedWallCount = -1;
        this.lastUpdateDelta = 0.016;
        
        // Create player models
        this.createPlayerModel();
        
        this.updateModelVisibility();

        // Set initial camera position based on view mode
        this.updateCameraPosition();
        this.applyCameraTarget(true);
        
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

        // Foot light — turns on in darkness
        this.footLight = new THREE.PointLight(0xffaa44, 0, 20);
        this.footLight.position.set(0, 0.1, 0);
        this.footLight.decay = 2;
        this.modelGroup.add(this.footLight);

        // Cleaner low-detail body for top-down / shadow use
        const boxGeometry = new THREE.CapsuleGeometry(0.22, 0.95, 6, 12);
        const boxMaterial = new THREE.MeshPhongMaterial({ color: 0x2957d1, shininess: 20 });
        this.boxModel = new THREE.Mesh(boxGeometry, boxMaterial);
        this.boxModel.position.y = 0.2;
        this.modelGroup.add(this.boxModel);
        
        // Create detailed player model for third-person view
        this.createDetailedPlayerModel();
        
        // Position the model group
        this.modelGroup.position.copy(this.position);
    }
    
    createDetailedPlayerModel() {
        this.detailedModel = new THREE.Group();

        const armorMaterial = new THREE.MeshPhongMaterial({
            color: 0x2f62ff,
            shininess: 45
        });
        const armorDarkMaterial = new THREE.MeshPhongMaterial({
            color: 0x1b2f88,
            shininess: 25
        });
        const undersuitMaterial = new THREE.MeshPhongMaterial({
            color: 0x101625,
            shininess: 12
        });
        const skinMaterial = new THREE.MeshPhongMaterial({
            color: 0xf2c18d,
            shininess: 18
        });


        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), armorMaterial);
        torso.position.y = 0.18;
        this.detailedModel.add(torso);
        this.torso = torso;

        const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.48, 0.08), armorDarkMaterial);
        chestPlate.position.set(0, 0.2, -0.18);
        this.detailedModel.add(chestPlate);

        const waist = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.26), undersuitMaterial);
        waist.position.set(0, -0.24, 0);
        this.detailedModel.add(waist);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 20), skinMaterial);
        head.position.y = 0.78;
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 8), skinMaterial);
        nose.rotation.x = -Math.PI / 2;
        nose.position.set(0, -0.015, -0.22);
        head.add(nose);
        this.detailedModel.add(head);
        this.head = head;



        const shoulderGeometry = new THREE.SphereGeometry(0.13, 12, 10);
        const armGeometry = new THREE.CapsuleGeometry(0.09, 0.44, 5, 10);
        const forearmGeometry = new THREE.CapsuleGeometry(0.08, 0.28, 5, 10);
        const legGeometry = new THREE.CapsuleGeometry(0.12, 0.5, 5, 10);
        const shinGeometry = new THREE.CapsuleGeometry(0.11, 0.3, 5, 10);

        const createArm = side => {
            const pivot = new THREE.Group();
            pivot.position.set(side * 0.39, 0.36, 0);

            const shoulder = new THREE.Mesh(shoulderGeometry, armorDarkMaterial);
            pivot.add(shoulder);

            const upperArm = new THREE.Mesh(armGeometry, armorMaterial);
            upperArm.position.y = -0.28;
            pivot.add(upperArm);

            const forearm = new THREE.Mesh(forearmGeometry, armorDarkMaterial);
            forearm.position.set(0, -0.66, -0.02);
            pivot.add(forearm);

            this.detailedModel.add(pivot);
            return pivot;
        };

        this.leftArm = createArm(-1);
        this.rightArm = createArm(1);

        const leftLeg = new THREE.Mesh(legGeometry, undersuitMaterial);
        leftLeg.position.set(-0.16, -0.52, 0);
        this.detailedModel.add(leftLeg);
        this.leftLeg = leftLeg;

        const rightLeg = new THREE.Mesh(legGeometry, undersuitMaterial);
        rightLeg.position.set(0.16, -0.52, 0);
        this.detailedModel.add(rightLeg);
        this.rightLeg = rightLeg;

        const leftShin = new THREE.Mesh(shinGeometry, armorDarkMaterial);
        leftShin.position.set(-0.16, -0.96, 0.03);
        this.detailedModel.add(leftShin);

        const rightShin = new THREE.Mesh(shinGeometry, armorDarkMaterial);
        rightShin.position.set(0.16, -0.96, 0.03);
        this.detailedModel.add(rightShin);

        this.weapon = createRifleModel();
        this.weapon.scale.setScalar(1.0);
        this.weapon.position.set(0.12, 0.2, -0.48);
        this.weapon.rotation.set(0.02, 0, 0);
        this.detailedModel.add(this.weapon);

        this.detailedModel.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        this.modelGroup.add(this.detailedModel);
        this.detailedModel.visible = false;
    }
    
    setupPointerLock() {
        // Click handler to request pointer lock during gameplay
        document.addEventListener('click', () => {
            if (window.isBugReportOpen || window.isInSettingsMenu || window.isConsoleOpen) return;
            const game = window.gameEngine;
            if (!game || game.isPaused || !game.isRunning) return;
            if (!this.isPointerLocked) {
                document.body.requestPointerLock();
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
                // Reset movement buffer and ignore accumulated mouse movement
                this.movementBuffer = [];
                this.lastDelta = { x: 0, y: 0 };
                this._ignoreMouseMove = true;
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
                // Ignore first mousemove after pointer lock (accumulated cursor jump)
                if (this._ignoreMouseMove) {
                    this._ignoreMouseMove = false;
                    return;
                }
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
                this._yawQuat.setFromAxisAngle(this._yawAxis, -avgX * this.mouseSensitivity);
                this.lookDirection.applyQuaternion(this._yawQuat);
                
                // For pitch (up/down), use Euler angles which are more intuitive for this purpose
                const currentPitch = Math.asin(this.lookDirection.y);
                const newPitch = Math.max(-Math.PI/2.5, Math.min(Math.PI/2.5, currentPitch - avgY * this.mouseSensitivity));
                
                // Reconstruct lookDirection with new pitch
                const horizontalLength = Math.cos(newPitch);
                this._horizontalDirection.set(this.lookDirection.x, this.lookDirection.z).normalize();
                
                this.lookDirection.x = this._horizontalDirection.x * horizontalLength;
                this.lookDirection.y = Math.sin(newPitch);
                this.lookDirection.z = this._horizontalDirection.y * horizontalLength;
                this.lookDirection.normalize();
                
                this.updateCameraPosition();
                this.applyCameraTarget(this.viewMode === 'firstPerson');
                this.updatePlayerRotation();
            }
        });
        
        // Add key handler for toggling view mode
        document.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            if (key === 'v' && !this.isPaused) {
                this.toggleViewMode();
            } else if (key === 'c' && !this.isPaused && this.viewMode === 'thirdPerson') {
                this.shoulderSide *= -1;
            }
        });
    }
    
    updatePlayerRotation() {
        // Always rotate the player model to face the look direction
        if (this.detailedModel) {
            // Calculate the angle between the look direction and the negative z-axis
            const angle = -Math.atan2(this.lookDirection.x, -this.lookDirection.z);
            
            // Body follows camera yaw; head also follows camera pitch.
            this.detailedModel.rotation.y = angle;
            if (this.head) {
                const pitch = Math.asin(THREE.MathUtils.clamp(this.lookDirection.y, -1, 1));
                this.head.rotation.x = -THREE.MathUtils.clamp(pitch, -0.65, 0.65);
            }
        }
    }
    
    toggleViewMode() {
        this.viewMode = this.viewMode === 'firstPerson' ? 'thirdPerson' : 'firstPerson';
        
        // Update model visibility based on view mode
        this.updateModelVisibility();
        
        // Update camera position
        this.updateCameraPosition();
        this.applyCameraTarget(true);
    }

    setFootLightIntensity(value) {
        if (this.footLight) {
            this.footLight.intensity = value;
        }
    }
    
    setFirstPersonWeaponModel(model) {
        this.firstPersonWeaponModel = model;
        this.updateModelVisibility();
    }

    updateModelVisibility() {
        if (this.firstPersonWeaponModel) {
            this.firstPersonWeaponModel.visible = this.viewMode === 'firstPerson';
        }

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
    
    updateCameraPosition(environment = null) {
        if (this.viewMode === 'firstPerson') {
            this._headPosition.copy(this.position).add(this.cameraOffset);
            this.cameraTargetPosition.copy(this._headPosition);
            this.cameraTargetLookAt.copy(this._headPosition).add(this.lookDirection);
        } else if (this.viewMode === 'thirdPerson') {
            this._reverseLookDir.copy(this.lookDirection).multiplyScalar(-this.thirdPersonDistance);
            this._right.crossVectors(this.lookDirection, this._yawAxis).normalize();
            this.cameraTargetPosition.set(
                this.position.x + this._reverseLookDir.x,
                this.position.y + this.thirdPersonHeight,
                this.position.z + this._reverseLookDir.z
            ).addScaledVector(this._right, this.thirdPersonShoulderOffset * this.shoulderSide);

            this.cameraTargetLookAt.copy(this.position)
                .addScaledVector(this.lookDirection, 5.5);
            this.cameraTargetLookAt.y += 0.75;
            this.resolveThirdPersonCameraCollision(environment);
        } else {
            this.cameraTargetPosition.set(this.position.x, 10, this.position.z + 15);
            this.cameraTargetLookAt.copy(this.position);
        }
    }

    resolveThirdPersonCameraCollision(environment) {
        if (!environment || !Array.isArray(environment.walls)) return;

        if (this._cachedWallCount !== environment.walls.length) {
            this._cameraCollisionObjects.length = 0;
            for (const wall of environment.walls) {
                if (wall.object) this._cameraCollisionObjects.push(wall.object);
            }
            this._cachedWallCount = environment.walls.length;
        }

        this._cameraRayOrigin.copy(this.position);
        this._cameraRayOrigin.y += 0.75;
        this._cameraRayDirection.subVectors(this.cameraTargetPosition, this._cameraRayOrigin);
        const desiredDistance = this._cameraRayDirection.length();
        if (desiredDistance <= 0 || this._cameraCollisionObjects.length === 0) return;

        this._cameraRayDirection.multiplyScalar(1 / desiredDistance);
        this._cameraRaycaster.set(this._cameraRayOrigin, this._cameraRayDirection);
        this._cameraRaycaster.near = 0.2;
        this._cameraRaycaster.far = desiredDistance;
        const hit = this._cameraRaycaster.intersectObjects(this._cameraCollisionObjects, true)[0];
        if (hit) {
            const safeDistance = Math.max(0.65, hit.distance - 0.2);
            this.cameraTargetPosition.copy(this._cameraRayOrigin)
                .addScaledVector(this._cameraRayDirection, safeDistance);
        }
    }

    applyCameraTarget(immediate = false) {
        if (immediate) {
            this.camera.position.copy(this.cameraTargetPosition);
            this.camera.lookAt(this.cameraTargetLookAt);
            return;
        }

        this.camera.position.lerp(this.cameraTargetPosition, this.cameraSmoothingFactor * this.lastUpdateDelta * 10);
        this.camera.getWorldDirection(this._currentLookTarget);
        this._currentLookTarget.multiplyScalar(10).add(this.camera.position);
        this._currentLookTarget.lerp(this.cameraTargetLookAt, this.cameraSmoothingFactor * this.lastUpdateDelta * 10);
        this.camera.lookAt(this._currentLookTarget);
    }

    update(deltaTime, input, environment) {
        // Check for pause state first thing and return immediately if paused
        if (this.isPaused) {
            // When paused, ensure velocity is zero to prevent any movement
            this.velocity.set(0, 0, 0);
            return;
        }

        this.lastUpdateDelta = deltaTime;

        // Handle movement
        const moveDirection = this._moveDirection;
        moveDirection.set(0, 0, 0);
        let isMovingForward = false;
        let isStrafing = false;

        if (this.viewMode === 'firstPerson' || this.viewMode === 'thirdPerson') {
            // First-person and third-person movement: forward/backward in look direction, strafe left/right
            const forward = this._forward.set(
                this.lookDirection.x,
                0,
                this.lookDirection.z
            ).normalize();
            
            // Calculate the correct right vector (positive X direction is right)
            const right = this._right.crossVectors(forward, this._yawAxis).normalize();
            
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
            
        } else {
            // Top-down view: direct cardinal movement
            const forward = this._forward.set(0, 0, -1);   // Forward is always -Z
            const right = this._right.set(1, 0, 0);      // Right is always +X
            
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
        const newPosition = this._newPosition.copy(this.position).add(moveDirection);
        
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
        
        // Update animation state based on movement
        this.updateAnimationState(isMoving, isSprinting, isMovingForward, isStrafing);
        
        // Update animations
        this.updateAnimations(deltaTime);
        
        // Update player rotation once per frame in third-person view
        if (this.viewMode === 'thirdPerson') {
            this.updatePlayerRotation();
            if (isStrafing && !isMovingForward && this.detailedModel) {
                this.detailedModel.rotation.y += input.isKeyPressed('a') ? Math.PI / 8 : -Math.PI / 8;
            }
        }

        // Update camera position
        this.updateCameraPosition(environment);
        this.applyCameraTarget(this.viewMode === 'firstPerson' && this.isPointerLocked);
        
        // Update velocity for weapon bob effects
        if (deltaTime > 0) {
            this.velocity.x = moveDirection.x / deltaTime;
            this.velocity.z = moveDirection.z / deltaTime;
        } else {
            this.velocity.x = 0;
            this.velocity.z = 0;
        }
        
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
                this.head.position.y = 0.78 + Math.sin(this.animationTime * 0.5) * 0.01;
                
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
                this.head.position.y = 0.78 + Math.abs(Math.sin(this.animationTime * 4)) * bobAmount;
                
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
                this.head.position.y = 0.78 + Math.abs(Math.sin(this.animationTime * 4)) * bobAmount;
                
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
        
        // Preserve a readable two-handed aiming pose while the lower body moves.
        const weaponBob = Math.abs(Math.sin(this.animationTime * 4)) * 0.025;
        this.leftArm.rotation.set(1.02 + weaponBob, 0.08, 0.42);
        this.rightArm.rotation.set(1.08 + weaponBob, -0.06, -0.3);
        this.weapon.position.y = 0.2 + weaponBob;
    }

    takeDamage(amount) {
        if (this.isGodMode) return; // Ignore damage if god mode is enabled
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            // Trigger game over
            this.isDead = true;
            if (window.gameEngine) {

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

        // Reset position
        this.position.set(0, 1.0, 0); // Lower reset height
        this.modelGroup.position.copy(this.position);
        
        // Reset look direction
        this.lookDirection.set(0, 0, -1);
        
        // Reset camera smoothing buffers
        this.cameraTargetPosition.copy(this.position).add(this.cameraOffset);
        this.cameraTargetLookAt.copy(this.cameraTargetPosition).add(this.lookDirection);
        this.movementBuffer = [];
        this.lastDelta = { x: 0, y: 0 };
        
        // Reset camera position and rotation immediately
        this.camera.position.copy(this.cameraTargetPosition);
        this.camera.lookAt(this.cameraTargetLookAt);
        
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
        this._ignoreMouseMove = false;
        
        // Reset view mode to first person
        this.viewMode = 'firstPerson';
        this.shoulderSide = 1;
        
        // Reset animation state
        this.animationState = 'idle';
        this.animationTime = 0;
        this.isMovingForward = true;
        this.isStrafing = false;
        
        // Reset model rotations and positions
        if (this.detailedModel) {
            this.detailedModel.rotation.x = 0;
            
            // Reset limb positions and rotations
            if (this.leftArm) this.leftArm.rotation.set(1.02, 0.08, 0.42);
            if (this.rightArm) this.rightArm.rotation.set(1.08, -0.06, -0.3);
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
            if (this.head) {
                this.head.position.y = 0.78;
                this.head.rotation.set(0, 0, 0);
            }
            
            // Reset weapon position
            if (this.weapon) {
                this.weapon.position.set(0.12, 0.2, -0.48);
                this.weapon.rotation.set(0.02, 0, 0);
            }
        }
        
        // Update model visibility based on view mode
        this.updateModelVisibility();
        
        // Update camera position to match the reset state
        this.updateCameraPosition();
        this.applyCameraTarget(true);

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