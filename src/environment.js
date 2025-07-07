import * as THREE from '../three.js-r178/three.js-r178/src/Three.js';
import PowerUp from './powerup.js';

class Environment {
    constructor(scene) {
        this.scene = scene;
        this.walls = []; // Store collision objects
        this.trees = []; // Store tree references
        this.spawnPoints = []; // Store valid spawn points
        this.initialized = false;
        
        // Initialize texture loader
        this.textureLoader = new THREE.TextureLoader();
        
        // Create materials
        this.materials = {};
        this.textures = {};
        
        const textureQueue = [
            { name: 'grass', material: new THREE.MeshLambertMaterial({ color: 0x44aa44 }) },
            { name: 'dirt', material: new THREE.MeshLambertMaterial({ color: 0x8B4513 }) },
            { name: 'stone', material: new THREE.MeshLambertMaterial({ color: 0x777777 }) },
            { name: 'bark', material: new THREE.MeshLambertMaterial({ color: 0x55341A }) },
            { name: 'leaves', material: new THREE.MeshLambertMaterial({ color: 0x22dd22 }) },
            { name: 'water', material: new THREE.MeshLambertMaterial({ color: 0x4444ff, transparent: true, opacity: 0.7 }) },
            { name: 'rock', material: new THREE.MeshLambertMaterial({ color: 0x666666 }) }
        ];
        
        // Create fallback materials in case textures fail to load
        const materialSettings = {
            ground: { 
                color: 0x355E3B, // Forest green
                roughness: 0.9,
                metalness: 0.1
            },
            rock: { 
                color: 0x808080, // Gray
                roughness: 0.8,
                metalness: 0.2
            },
            bark: { 
                color: 0x4A3C2A, // Brown
                roughness: 0.9,
                metalness: 0.1
            }
        };
        
        // Start with basic materials
        this.materials = {
            ground: new THREE.MeshStandardMaterial(materialSettings.ground),
            rock: new THREE.MeshStandardMaterial(materialSettings.rock),
            bark: new THREE.MeshStandardMaterial(materialSettings.bark)
        };
        
        // Try loading textures
        console.log('Loading textures...');
        try {
            // Try multiple possible texture paths (direct path first)
            const texturePaths = [
                './textures/environment/',
                './src/textures/environment/',
                '../textures/environment/',
                '../../textures/environment/',
                '/textures/environment/'
            ];
            
            // Function to load a texture with proper error handling
            const loadTexture = (name, material, callback) => {
                // Try each path until one works
                let loaded = false;
                let loadAttempts = 0;
                
                const tryNextPath = () => {
                    if (loadAttempts >= texturePaths.length || loaded) return;
                    
                    const path = texturePaths[loadAttempts] + name;
                    console.log(`Trying to load ${name} from: ${path}`);
                    
                    const texture = this.textureLoader.load(
                        path,
                        // Success callback
                        (tex) => {
                            console.log(`Successfully loaded ${name} from ${path}`);
                            loaded = true;
                            if (callback) callback(tex);
                        },
                        // Progress callback
                        undefined,
                        // Error callback - try next path
                        (err) => {
                            console.log(`Failed to load ${name} from ${path}, trying next path...`);
                            loadAttempts++;
                            tryNextPath();
                        }
                    );
                };
                
                // Start the loading process
                tryNextPath();
            };
            
            // Load ground texture
            loadTexture('ground.jpg', this.materials.ground, (texture) => {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(8, 8);
                this.materials.ground.map = texture;
                this.materials.ground.needsUpdate = true;
            });
            
            // Load rock texture
            loadTexture('rock.jpg', this.materials.rock, (texture) => {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(2, 2);
                this.materials.rock.map = texture;
                this.materials.rock.color.set(0xBBBBBB); // Light gray tint
                this.materials.rock.needsUpdate = true;
            });
            
            // Load bark texture
            loadTexture('bark.jpg', this.materials.bark, (texture) => {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(1, 3);
                this.materials.bark.map = texture;
                this.materials.bark.needsUpdate = true;
            });
        } catch (error) {
            console.error('Error during texture loading setup:', error);
        }
        
        this.createWorld();

        // === Animated Boundary Ring ===
        this.boundaryRadius = 65;
        const ringGeometry = new THREE.RingGeometry(this.boundaryRadius - 0.5, this.boundaryRadius + 0.5, 128);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff2222,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
        });
        // Create a striped texture for the ring
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        for (let i = 0; i < size; i += 32) {
            ctx.fillStyle = (i / 32) % 2 === 0 ? '#ff2222' : '#000';
            ctx.fillRect(i, 0, 16, size);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(16, 1);
        ringMaterial.map = texture;
        ringMaterial.needsUpdate = true;
        this.boundaryRing = new THREE.Mesh(ringGeometry, ringMaterial);
        this.boundaryRing.rotation.x = -Math.PI / 2;
        this.boundaryRing.position.y = 0.1; // Raise above ground
        this.boundaryRing.visible = false; // Set to true for debugging if needed
        this.scene.add(this.boundaryRing);
        this._boundaryRingAngle = 0;

        // === Simple Red Outline for Boundary ===
        this.barrierOutline = new THREE.Mesh(
            new THREE.RingGeometry(this.boundaryRadius - 0.2, this.boundaryRadius + 0.2, 128),
            new THREE.MeshBasicMaterial({
                color: 0xff2222,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8,
                depthWrite: false // Always draws on top
            })
        );
        this.barrierOutline.rotation.x = -Math.PI / 2;
        this.barrierOutline.position.y = 0.12; // Slightly above ground
        this.barrierOutline.visible = true;
        this.scene.add(this.barrierOutline);

        // === Animated Red Striped Barrier Wall ===
        const barrierHeight = 2.5;
        const segments = 128;
        const boundaryRadius = this.boundaryRadius;
        // Create animated striped texture
        const barrierTexSize = 256;
        const barrierTexCanvas = document.createElement('canvas');
        barrierTexCanvas.width = barrierTexSize;
        barrierTexCanvas.height = barrierTexSize;
        const barrierTexCtx = barrierTexCanvas.getContext('2d');
        for (let i = 0; i < barrierTexSize; i += 48) {
            barrierTexCtx.fillStyle = '#ff4444'; // Brighter red
            barrierTexCtx.fillRect(i, 0, 32, barrierTexSize); // Wider stripes
            barrierTexCtx.fillStyle = 'rgba(0,0,0,0)';
            barrierTexCtx.fillRect(i + 32, 0, 16, barrierTexSize); // Narrower transparent
        }
        const animatedTexture = new THREE.CanvasTexture(barrierTexCanvas);
        animatedTexture.wrapS = animatedTexture.wrapT = THREE.RepeatWrapping;
        animatedTexture.repeat.set(16, 1);
        const barrierMaterial = new THREE.MeshBasicMaterial({
            map: animatedTexture,
            color: 0xff4444, // Brighter base color
            transparent: true,
            opacity: 1.0, // Fully opaque
            side: THREE.DoubleSide,
            depthWrite: false
        });
        // Add a glow effect by duplicating the wall with a larger, more transparent mesh
        this.animatedBarrierWall = new THREE.Mesh(
            new THREE.CylinderGeometry(boundaryRadius + 0.5, boundaryRadius + 0.5, barrierHeight + 0.5, segments, 1, true),
            barrierMaterial
        );
        this.animatedBarrierWall.position.y = barrierHeight / 2;
        this.animatedBarrierWall.visible = true;
        this.scene.add(this.animatedBarrierWall);
        // Glow mesh
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.animatedBarrierGlow = new THREE.Mesh(
            new THREE.CylinderGeometry(boundaryRadius + 1.2, boundaryRadius + 1.2, barrierHeight + 1.5, segments, 1, true),
            glowMaterial
        );
        this.animatedBarrierGlow.position.y = barrierHeight / 2;
        this.animatedBarrierGlow.visible = true;
        this.scene.add(this.animatedBarrierGlow);
        this._barrierStripeAngle = 0;

        this.powerUps = [];
        this.powerUpSpawnInterval = 20; // seconds between spawns
        this._powerUpTimer = 0;
    }

    reset() {
        console.log('Environment reset: cleaning up scene');
        
        // Clear existing objects
        this.walls.forEach(wall => {
            if (wall.object) {
                this.scene.remove(wall.object);
                if (wall.object.geometry) wall.object.geometry.dispose();
                if (wall.object.material) {
                    if (Array.isArray(wall.object.material)) {
                        wall.object.material.forEach(mat => mat.dispose());
                    } else {
                        wall.object.material.dispose();
                    }
                }
            }
        });
        
        this.trees.forEach(tree => {
            if (tree.trunk) {
                this.scene.remove(tree.trunk);
                if (tree.trunk.geometry) tree.trunk.geometry.dispose();
                if (tree.trunk.material) tree.trunk.material.dispose();
            }
            if (tree.foliage) {
                this.scene.remove(tree.foliage);
                if (tree.foliage.geometry) tree.foliage.geometry.dispose();
                if (tree.foliage.material) tree.foliage.material.dispose();
            }
        });

        // Remove all lights and other environment objects
        const objectsToRemove = [];
        this.scene.traverse(object => {
            // Check if this object belongs to the environment (don't remove player, weapons, UI)
            if (object.userData.isEnvironment || 
                object.isLight || 
                (object.isMesh && !object.userData.isPlayer && !object.userData.isWeapon)) {
                objectsToRemove.push(object);
            }
        });
        
        console.log(`Environment reset: removing ${objectsToRemove.length} objects`);
        
        objectsToRemove.forEach(object => {
            this.scene.remove(object);
            // Dispose geometries and materials
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });

        // Clear THREE.js cache to prevent memory leaks
        THREE.Cache.clear();

        // Reset arrays
        this.walls = [];
        this.trees = [];
        this.spawnPoints = [];
        
        console.log('Environment reset: recreating world');

        // Recreate the world
        this.createWorld();
        
        // Set initialization flag
        this.initialized = true;
        
        console.log('Environment reset complete');

        this.powerUps = [];
        this._powerUpTimer = 0;
    }

    createWorld() {
        // Create a simple sky background using a scene clear color instead of a mesh
        this.scene.background = new THREE.Color(0xADD8E6); // Light blue sky
        
        // Add fog for distance fading
        this.scene.fog = new THREE.FogExp2(0xADD8E6, 0.0025);

        // Create ground first
        this.createGround();
        
        // Add strategic cover points
        this.addCoverPoints();
        
        // Add trees in specific patterns
        this.addTrees();

        // Add grass for detail
        this.addGrass();

        // Setup lighting
        this.setupLighting();

        // Add clouds
        this.addClouds();

        // Add map boundaries
        this.createMapBoundaries();
    }

    createGround() {
        // Create a smaller ground
        const groundSize = 160;
        const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 1, 1);
        const ground = new THREE.Mesh(groundGeometry, this.materials.ground);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        // Add environment flag for cleanup
        ground.userData.isEnvironment = true;
        this.scene.add(ground);
    }

    addCoverPoints() {
        // Strategic cover points with original positioning
        const coverPoints = [
            { type: 'rock', positions: [
                [-15, 0, -15], [15, 0, 15], [-15, 0, 15], [15, 0, -15],
                [0, 0, -20], [0, 0, 20], [-20, 0, 0], [20, 0, 0]
            ]},
            { type: 'log', positions: [
                [-10, 0, -20], [10, 0, 20], [-20, 0, 10], [20, 0, -10],
                [-5, 0, 15], [5, 0, -15], [15, 0, 5], [-15, 0, -5]
            ]}
        ];

        coverPoints.forEach(cover => {
            cover.positions.forEach(pos => {
                if (cover.type === 'rock') {
                    this.createRock(pos[0], pos[1], pos[2]);
                } else {
                    this.createFallenLog(pos[0], pos[1], pos[2]);
                }
            });
        });
    }

    createRock(x, y, z) {
        // Use a simpler geometry that displays textures better
        const rockGeometry = new THREE.SphereGeometry(1.0, 8, 6);
        
        // Apply slight random deformation to make it look more natural
        const positions = rockGeometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const vertex = new THREE.Vector3();
            vertex.fromBufferAttribute(positions, i);
            
            // Apply random displacement
            const deform = 0.3;
            vertex.x += (Math.random() - 0.5) * deform;
            vertex.y += (Math.random() - 0.5) * deform;
            vertex.z += (Math.random() - 0.5) * deform;
            
            positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        
        // Update normals for proper lighting
        rockGeometry.computeVertexNormals();
        
        // Create rock with proper material settings
        const rock = new THREE.Mesh(rockGeometry, this.materials.rock);
        rock.position.set(x, y + 0.5, z);
        rock.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        rock.castShadow = true;
        rock.receiveShadow = true;
        this.scene.add(rock);
        
        // Create a more precise collision shape using convex hull
        const rockShape = new THREE.Box3();
        rockShape.setFromObject(rock);
        const rockSize = new THREE.Vector3();
        rockShape.getSize(rockSize);
        
        // Create an octagonal collision boundary
        const collisionPoints = [];
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const radius = rockSize.x * 0.4; // Tighter collision radius
            collisionPoints.push(new THREE.Vector3(
                x + Math.cos(angle) * radius,
                0,
                z + Math.sin(angle) * radius
            ));
        }
        
        this.walls.push({
            type: 'rock',
            bounds: rockShape,
            collisionPoints: collisionPoints,
            object: rock
        });
    }

    createFallenLog(x, y, z) {
        const logGeometry = new THREE.CylinderGeometry(0.2, 0.3, 4, 8);
        const log = new THREE.Mesh(logGeometry, this.materials.bark);
        log.position.set(x, y + 0.3, z);
        const rotation = Math.random() * Math.PI;
        log.rotation.set(
            0.1,
            rotation,
            Math.PI/2 * 0.1
        );
        log.castShadow = true;
        log.receiveShadow = true;
        this.scene.add(log);
        
        // Create a capsule-like collision shape for the log
        const logLength = 4;
        const logRadius = 0.3;
        const numPoints = 8;
        const collisionPoints = [];
        
        // Calculate log's direction vector
        const direction = new THREE.Vector3(Math.cos(rotation), 0, Math.sin(rotation));
        
        // Create collision points along the log's length
        for (let i = 0; i < numPoints; i++) {
            const t = (i / (numPoints - 1)) * logLength - logLength / 2;
            const point = new THREE.Vector3(
                x + direction.x * t,
                0,
                z + direction.z * t
            );
            collisionPoints.push(point);
        }
        
        this.walls.push({
            type: 'log',
            bounds: new THREE.Box3().setFromObject(log),
            collisionPoints: collisionPoints,
            logRadius: logRadius,
            direction: direction,
            object: log
        });
    }

    addTrees() {
        // Add trees in strategic locations with adjusted positions
        const treePatterns = [
            // Center clusters
            { x: -8, z: -8, radius: 6, count: 2 },
            { x: 8, z: 8, radius: 6, count: 2 },
            // Corner forests
            { x: -25, z: -25, radius: 8, count: 4 },
            { x: 25, z: 25, radius: 8, count: 4 },
            { x: -25, z: 25, radius: 8, count: 4 },
            { x: 25, z: -25, radius: 8, count: 4 },
            // Edge treelines
            { x: 0, z: -30, radius: 15, count: 4 },
            { x: 0, z: 30, radius: 15, count: 4 },
            { x: -30, z: 0, radius: 15, count: 4 },
            { x: 30, z: 0, radius: 15, count: 4 }
        ];

        treePatterns.forEach(pattern => {
            this.createTreeCluster(pattern.x, pattern.z, pattern.radius, pattern.count);
        });
    }

    createTreeCluster(centerX, centerZ, radius, count) {
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
            const distance = Math.random() * radius;
            const x = centerX + Math.cos(angle) * distance;
            const z = centerZ + Math.sin(angle) * distance;
            
            const tree = this.createTree(x, z);
            const scale = 0.8 + Math.random() * 0.4;
            tree.scale.set(scale, scale, scale);
            
            this.trees.push(tree);

            if (scale > 0.9) {
                // Create a precise collision box for the tree
                const collisionBox = new THREE.Box3().setFromObject(tree);
                collisionBox.min.y = 0; // Ensure collision starts from ground
                this.walls.push({
                    type: 'tree',
                    bounds: collisionBox,
                    object: tree
                });
            }
        }
    }

    createTree(x, z) {
        const treeGroup = new THREE.Group();
        
        // Create trunk with simple bark texture
        const trunkGeometry = new THREE.CylinderGeometry(0.15, 0.25, 3, 8);
        const trunk = new THREE.Mesh(trunkGeometry, this.materials.bark);
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        
        // Add trunk detail by slightly rotating segments
        trunk.geometry.translate(0.1, 0, 0);
        trunk.rotation.z = Math.random() * 0.2 - 0.1;
        trunk.rotation.x = Math.random() * 0.2 - 0.1;
        treeGroup.add(trunk);

        // Create more organic looking foliage using multiple overlapping shapes
        const foliageGroup = new THREE.Group();
        const foliageColors = [
            0x1B4721,  // Dark green
            0x2D5A27,  // Medium green
            0x3A6B35,  // Light green
            0x2F5A1E   // Olive green
        ];
        
        // Create main foliage body using multiple cones
        for (let i = 0; i < 4; i++) {
            const height = 2.5 - i * 0.2;
            const radius = 1.2 - i * 0.15;
            const segments = 8;
            const foliageGeometry = new THREE.ConeGeometry(radius, height, segments);
            const foliageMaterial = new THREE.MeshStandardMaterial({
                color: foliageColors[i % foliageColors.length],
                roughness: 1.0,
                metalness: 0.0,
                flatShading: true
            });
            
            const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
            
            // Offset each cone slightly for more organic look
            foliage.position.y = 3.0 + i * 0.8;
            foliage.position.x = (Math.random() - 0.5) * 0.2;
            foliage.position.z = (Math.random() - 0.5) * 0.2;
            
            // Rotate each cone slightly
            foliage.rotation.y = Math.random() * Math.PI * 2;
            foliage.rotation.x = (Math.random() - 0.5) * 0.2;
            foliage.rotation.z = (Math.random() - 0.5) * 0.2;
            
            foliage.castShadow = true;
            foliage.receiveShadow = true;
            foliageGroup.add(foliage);
        }
        
        // Add smaller detail cones around the main body
        for (let i = 0; i < 6; i++) {
            const smallCone = new THREE.ConeGeometry(0.6, 1.2, 6);
            const material = new THREE.MeshStandardMaterial({ 
                color: foliageColors[Math.floor(Math.random() * foliageColors.length)],
                roughness: 1.0,
                metalness: 0.0,
                flatShading: true
            });
            
            const detail = new THREE.Mesh(smallCone, material);
            const angle = (i / 6) * Math.PI * 2;
            const radius = 0.7;
            
            detail.position.x = Math.cos(angle) * radius;
            detail.position.z = Math.sin(angle) * radius;
            detail.position.y = 3.5 + Math.random() * 1.5;
            
            detail.rotation.x = (Math.random() - 0.5) * 0.4;
            detail.rotation.z = (Math.random() - 0.5) * 0.4;
            detail.rotation.y = Math.random() * Math.PI * 2;
            
            detail.castShadow = true;
            detail.receiveShadow = true;
            foliageGroup.add(detail);
        }

        // Add the foliage group to the tree
        treeGroup.add(foliageGroup);
        
        // Position the entire tree
        treeGroup.position.set(x, 0, z);
        
        // Add some random rotation to the entire tree
        treeGroup.rotation.y = Math.random() * Math.PI * 2;
        
        // Create a cylinder-shaped collision for the trunk
        const trunkRadius = 0.15;
        const collisionPoints = [];
        const numPoints = 8;
        
        // Create circular collision points around the trunk
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            collisionPoints.push(new THREE.Vector3(
                x + Math.cos(angle) * trunkRadius,
                0,
                z + Math.sin(angle) * trunkRadius
            ));
        }
        
        this.scene.add(treeGroup);
        
        // Add to walls for collision detection
        this.walls.push({
            type: 'tree',
            bounds: new THREE.Box3().setFromObject(trunk),
            collisionPoints: collisionPoints,
            treeRadius: trunkRadius,
            object: treeGroup
        });
        
        return treeGroup;
    }

    addGrass() {
        // Use instanced mesh for better performance
        const grassGeometry = new THREE.PlaneGeometry(0.15, 0.25);
        const grassMaterial = new THREE.MeshStandardMaterial({
            color: 0x3A9D23,
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.5
        });

        // Create instanced mesh
        const instanceCount = 800; // Reduced from 1500
        const grass = new THREE.InstancedMesh(grassGeometry, grassMaterial, instanceCount);
        
        // Temporary objects for matrix calculations
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const rotation = new THREE.Euler();
        const scale = new THREE.Vector3(1, 1, 1);
        
        // Create grass instances
        let validInstanceCount = 0;
        let attempts = 0;
        const maxAttempts = instanceCount * 2;
        
        while (validInstanceCount < instanceCount && attempts < maxAttempts) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 15 + Math.random() * 30;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            if (!this.isOnPath(x, z)) {
                position.set(x, 0.05, z);
                rotation.set(
                    Math.PI/2 + (Math.random() - 0.5) * 0.2,
                    Math.random() * Math.PI,
                    0
                );
                
                matrix.compose(position, new THREE.Quaternion().setFromEuler(rotation), scale);
                grass.setMatrixAt(validInstanceCount, matrix);
                validInstanceCount++;
            }
            attempts++;
        }
        
        grass.instanceMatrix.needsUpdate = true;
        grass.castShadow = true;
        grass.receiveShadow = true;
        this.scene.add(grass);
    }

    isOnPath(x, z) {
        // Define main paths
        const pathWidth = 5;
        return (Math.abs(x) < pathWidth || Math.abs(z) < pathWidth);
    }

    setupLighting() {
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Add directional light (sun)
        const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
        sunLight.position.set(50, 100, 50);
        sunLight.castShadow = true;
        
        // Improve shadow quality
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        sunLight.shadow.camera.left = -100;
        sunLight.shadow.camera.right = 100;
        sunLight.shadow.camera.top = 100;
        sunLight.shadow.camera.bottom = -100;
        
        this.scene.add(sunLight);

        // Add hemisphere light for better ambient lighting
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        hemiLight.position.set(0, 50, 0);
        this.scene.add(hemiLight);
    }

    addClouds() {
        // Original cloud settings
        const cloudGeometry = new THREE.SphereGeometry(10, 8, 8); // Original segments
        const cloudMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });

        // Original number of clouds
        for (let i = 0; i < 15; i++) { // Original count
            const cloudCluster = new THREE.Group();
            
            const numSpheres = 3 + Math.floor(Math.random() * 3); // Original spheres per cloud
            for (let j = 0; j < numSpheres; j++) {
                const cloudPart = new THREE.Mesh(cloudGeometry, cloudMaterial);
                cloudPart.position.set(
                    (Math.random() - 0.5) * 15,
                    (Math.random() - 0.5) * 3,
                    (Math.random() - 0.5) * 15
                );
                cloudPart.scale.set(
                    0.5 + Math.random(),
                    0.3 + Math.random() * 0.2,
                    0.5 + Math.random()
                );
                cloudCluster.add(cloudPart);
            }

            cloudCluster.position.set(
                (Math.random() - 0.5) * 200,
                60 + Math.random() * 40,
                (Math.random() - 0.5) * 200
            );
            
            this.scene.add(cloudCluster);
        }
    }

    createMapBoundaries() {
        const boundaryRadius = 75; // Original larger radius
        const numBoundaryObjects = 80; // Original count

        for (let i = 0; i < numBoundaryObjects; i++) {
            const angle = (i / numBoundaryObjects) * Math.PI * 2;
            const x = Math.cos(angle) * boundaryRadius;
            const z = Math.sin(angle) * boundaryRadius;

            try {
                if (i % 3 === 0) {
                    // Create rocks around the boundary
                    this.createRock(x, 0, z);
                } else {
                    // Create trees around the boundary
                    const tree = this.createTree(x, z);
                    
                    // Ensure the tree is properly added to the scene and tracking arrays
                    if (tree && !this.trees.includes(tree)) {
                        this.trees.push(tree);
                    }
                }
            } catch (error) {
                console.error(`Error creating boundary object at position (${x}, 0, ${z}):`, error);
                // Continue with the next object even if one fails
            }
        }
    }

    checkWallCollision(position) {
        const playerRadius = 0.2;
        // Invisible circular boundary (RESTORED)
        const boundaryRadius = 65;
        if (Math.sqrt(position.x * position.x + position.z * position.z) > boundaryRadius) {
            return true;
        }
        
        for (const wall of this.walls) {
            switch(wall.type) {
                case 'tree':
                    // Check distance to trunk center
                    const trunkCenter = new THREE.Vector2(wall.object.position.x, wall.object.position.z);
                    const playerPos2D = new THREE.Vector2(position.x, position.z);
                    const distanceToTrunk = trunkCenter.distanceTo(playerPos2D);
                    if (distanceToTrunk < 0.2) { // Tight trunk collision
                        return true;
                    }
                    break;
                    
                case 'rock':
                    // Check if player is inside the rock's octagonal boundary
                    if (this.isPointInPolygon(position, wall.collisionPoints)) {
                        return true;
                    }
                    break;
                    
                case 'log':
                    // Check distance to log's central line
                    const distanceToLog = this.pointToLineDistance(
                        position,
                        wall.collisionPoints[0],
                        wall.direction,
                        wall.logRadius + playerRadius
                    );
                    if (distanceToLog < wall.logRadius + playerRadius) {
                        // Check if within log length
                        const localPos = new THREE.Vector3().subVectors(position, wall.collisionPoints[0]);
                        const projectionLength = localPos.dot(wall.direction);
                        if (projectionLength >= 0 && projectionLength <= 4) { // Log length is 4
                return true;
                        }
                    }
                    break;
            }
        }
        return false;
    }

    isPointInPolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].z;
            const xj = polygon[j].x, yj = polygon[j].z;
            
            if (((yi > point.z) !== (yj > point.z)) &&
                (point.x < (xj - xi) * (point.z - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    pointToLineDistance(point, lineStart, direction, maxDistance) {
        const toPoint = new THREE.Vector3().subVectors(point, lineStart);
        const projectionLength = toPoint.dot(direction);
        const projection = direction.clone().multiplyScalar(projectionLength);
        const perpendicular = toPoint.sub(projection);
        return perpendicular.length();
    }

    // Call this every frame, passing the player position and deltaTime
    updateBoundaryRing(playerPosition, deltaTime) {
        const dist = Math.sqrt(playerPosition.x * playerPosition.x + playerPosition.z * playerPosition.z);
        // Show ring if player is within 8 units of the boundary
        this.boundaryRing.visible = (dist > this.boundaryRadius - 8 && dist < this.boundaryRadius + 8);
        // Animate stripes by rotating the texture
        if (this.boundaryRing.material.map) {
            this._boundaryRingAngle += deltaTime * 0.5;
            this.boundaryRing.material.map.offset.x = this._boundaryRingAngle % 1;
            this.boundaryRing.material.map.needsUpdate = true;
        }
    }

    // Call this every frame to animate the barrier wall
    updateAnimatedBarrierWall(deltaTime) {
        if (this.animatedBarrierWall.material.map) {
            this._barrierStripeAngle += deltaTime * 0.5;
            this.animatedBarrierWall.material.map.offset.x = this._barrierStripeAngle % 1;
            this.animatedBarrierWall.material.map.needsUpdate = true;
        }
    }

    spawnRandomPowerUp() {
        // Randomly choose between health, ammo, and rapidfire
        const types = ['health', 'ammo', 'rapidfire'];
        const type = types[Math.floor(Math.random() * types.length)];
        const powerUp = new PowerUp(type, this);
        this.powerUps.push(powerUp);
    }

    updatePowerUps(player, deltaTime) {
        // Spawn new power-ups at intervals
        this._powerUpTimer += deltaTime;
        if (this._powerUpTimer >= this.powerUpSpawnInterval) {
            this.spawnRandomPowerUp();
            this._powerUpTimer = 0;
        }
        // Update all power-ups
        this.powerUps = this.powerUps.filter(pu => {
            pu.update(player);
            return !pu.collected;
        });
    }

    spawnPowerUp(type) {
        const PowerUp = require('./powerup');
        if (['health', 'ammo', 'rapidfire'].includes(type)) {
            const pu = new PowerUp(type, this);
            this.powerUps.push(pu);
        }
    }
}

export default Environment; 