import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';
import PowerUp from './powerup.js';

// Import lighting nodes for enhanced lighting effects
import HemisphereLightNode from '../three.js-r178/three.js-r178/src/nodes/lighting/HemisphereLightNode.js';
import PointLightNode from '../three.js-r178/three.js-r178/src/nodes/lighting/PointLightNode.js';
import DirectionalLightNode from '../three.js-r178/three.js-r178/src/nodes/lighting/DirectionalLightNode.js';
import AmbientLightNode from '../three.js-r178/three.js-r178/src/nodes/lighting/AmbientLightNode.js';
import SpotLightNode from '../three.js-r178/three.js-r178/src/nodes/lighting/SpotLightNode.js';

class Environment {
    constructor(scene) {
        this.scene = scene;
        this.walls = []; // Store collision objects
        this.trees = []; // Store tree references
        this.spawnPoints = []; // Store valid spawn points
        this.initialized = false;
        this.useTextures = true; // Enable textures
        
        // Check if we're using WebGPU to enable optimizations
        this.isUsingWebGPU = false;
        if (window.gameEngine && window.gameEngine.renderer) {
            this.isUsingWebGPU = window.gameEngine.renderer.isWebGPURenderer === true;
            console.log('Environment using WebGPU:', this.isUsingWebGPU);
        }
        
        // Initialize texture loader with appropriate settings
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
            // Skip texture loading if disabled
            if (!this.useTextures) {
                console.log('Textures disabled, using basic materials');
            } else {
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
                                
                                // Apply WebGPU-specific optimizations if available
                                if (this.isUsingWebGPU) {
                                    // WebGPU performs better with power-of-two textures
                                    tex.minFilter = THREE.LinearMipmapLinearFilter;
                                    tex.magFilter = THREE.LinearFilter;
                                    tex.generateMipmaps = true;
                                    tex.anisotropy = 16; // Higher anisotropy for WebGPU for better quality
                                }
                                
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
            }
        } catch (error) {
            console.error('Error during texture loading setup:', error);
        }
        
        this.createWorld();
        
        // Set boundary radius and create animated boundary
        this.boundaryRadius = 65;
        
        // Create animated boundary elements
        this.createAnimatedBoundary();

        this.powerUps = [];
        this.powerUpSpawnInterval = 20; // seconds between spawns
        this._powerUpTimer = 0;
    }

    reset() {
        console.log('Environment reset: cleaning up scene');
        
        // Track total objects removed for debugging
        let totalObjectsRemoved = 0;
        
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
                totalObjectsRemoved++;
            }
        });
        
        this.trees.forEach(tree => {
            if (tree.trunk) {
                this.scene.remove(tree.trunk);
                if (tree.trunk.geometry) tree.trunk.geometry.dispose();
                if (tree.trunk.material) tree.trunk.material.dispose();
                totalObjectsRemoved++;
            }
            if (tree.foliage) {
                this.scene.remove(tree.foliage);
                if (tree.foliage.geometry) tree.foliage.geometry.dispose();
                if (tree.foliage.material) tree.foliage.material.dispose();
                totalObjectsRemoved++;
            }
        });
        
        // Clean up boundary elements
        if (this.boundaryWall) {
            // Remove all lights from the boundary
            while (this.boundaryWall.children.length > 0) {
                const child = this.boundaryWall.children[0];
                this.boundaryWall.remove(child);
                totalObjectsRemoved++;
            }
            
            // Remove boundary wall
            this.scene.remove(this.boundaryWall);
            if (this.boundaryWall.geometry) this.boundaryWall.geometry.dispose();
            if (this.boundaryWall.material) {
                if (this.boundaryWall.material.alphaMap) {
                    this.boundaryWall.material.alphaMap.dispose();
                }
                this.boundaryWall.material.dispose();
            }
            this.boundaryWall = null;
            totalObjectsRemoved++;
        }
        
        // Clean up barrier lights
        if (this.barrierLights && this.barrierLights.length > 0) {
            this.barrierLights.forEach(light => {
                this.scene.remove(light);
                totalObjectsRemoved++;
            });
        }
        this.barrierLights = [];

        // Specifically find and remove cloud objects
        const cloudsToRemove = [];
        this.scene.traverse(object => {
            if (object.userData && (object.userData.type === 'cloud' || object.userData.type === 'cloud-part')) {
                cloudsToRemove.push(object);
            }
        });
        
        if (cloudsToRemove.length > 0) {
            console.log(`Environment reset: specifically removing ${cloudsToRemove.length} cloud objects`);
            cloudsToRemove.forEach(cloud => {
                this.scene.remove(cloud);
                // Dispose of cloud geometries and materials
                if (cloud.geometry) cloud.geometry.dispose();
                if (cloud.material) {
                    if (Array.isArray(cloud.material)) {
                        cloud.material.forEach(material => material.dispose());
                    } else {
                        cloud.material.dispose();
                    }
                }
                totalObjectsRemoved++;
            });
        }

        // Clean up power-ups
        if (this.powerUps && this.powerUps.length > 0) {
            console.log(`Environment reset: removing ${this.powerUps.length} power-ups`);
            this.powerUps.forEach(powerUp => {
                if (powerUp.model) {
                    this.scene.remove(powerUp.model);
                    if (powerUp.model.geometry) powerUp.model.geometry.dispose();
                    if (powerUp.model.material) {
                        if (Array.isArray(powerUp.model.material)) {
                            powerUp.model.material.forEach(material => material.dispose());
                        } else {
                            powerUp.model.material.dispose();
                        }
                    }
                    totalObjectsRemoved++;
                }
            });
            this.powerUps = [];
        }

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
        
        console.log(`Environment reset: removing ${objectsToRemove.length} additional objects`);
        
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
            totalObjectsRemoved++;
        });

        // Clear THREE.js cache to prevent memory leaks
        THREE.Cache.clear();

        // Reset arrays
        this.walls = [];
        this.trees = [];
        this.spawnPoints = [];
        this.powerUps = [];
        this._powerUpTimer = 0;
        
        console.log(`Environment reset: removed ${totalObjectsRemoved} objects total`);
        console.log('Environment reset: recreating world');

        // Recreate the world
        this.createWorld();
        
        // Set initialization flag
        this.initialized = true;
        
        console.log('Environment reset complete');
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
        // Use an icosahedron with more subdivisions for a smoother, more natural rock shape
        const rockGeometry = new THREE.IcosahedronGeometry(0.7, 1);
        
        // Apply subtle, natural deformation
        const positions = rockGeometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const vertex = new THREE.Vector3();
            vertex.fromBufferAttribute(positions, i);
            
            // Apply subtle, varied displacement
            const deform = 0.15;
            // Use distance from center for more natural deformation
            const distance = vertex.length();
            const factor = 0.5 + Math.random() * 0.5;
            
            // Apply deformation based on position and distance
            vertex.x += (Math.random() - 0.5) * deform * factor;
            vertex.y += (Math.random() - 0.5) * deform * factor;
            vertex.z += (Math.random() - 0.5) * deform * factor;
            
            positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        
        // Update normals for proper lighting
        rockGeometry.computeVertexNormals();
        
        // Create rock with proper material settings
        const rock = new THREE.Mesh(rockGeometry, this.materials.rock);
        rock.position.set(x, y + 0.4, z);
        
        // Vary the scale to create more diversity
        const scale = 0.9 + Math.random() * 0.4;
        // Make rocks slightly flatter for more natural appearance
        rock.scale.set(scale * (0.9 + Math.random() * 0.3), 
                       scale * (0.6 + Math.random() * 0.3), 
                       scale * (0.9 + Math.random() * 0.3));
        
        // Random rotation but keep y-axis more natural
        rock.rotation.set(
            Math.random() * Math.PI * 0.3,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 0.3
        );
        
        rock.castShadow = true;
        rock.receiveShadow = true;
        this.scene.add(rock);
        
        // Simplified collision - just use a sphere instead of complex shapes
        const rockRadius = 0.4 * scale; // Adjust collision radius based on scale
        
        this.walls.push({
            type: 'rock',
            bounds: new THREE.Box3().setFromObject(rock),
            collisionRadius: rockRadius,
            position: new THREE.Vector3(x, y, z),
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
        
        // Create trunk with reduced segments but better shape
        const trunkGeometry = new THREE.CylinderGeometry(0.15, 0.25, 3, 6);
        const trunk = new THREE.Mesh(trunkGeometry, this.materials.bark);
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        
        // Add trunk detail by slightly rotating and bending it
        trunk.geometry.translate(0.1, 0, 0);
        trunk.rotation.z = Math.random() * 0.2 - 0.1;
        trunk.rotation.x = Math.random() * 0.2 - 0.1;
        treeGroup.add(trunk);

        // Create foliage with better color variation
        const foliageGroup = new THREE.Group();
        const foliageColors = [
            0x1B4721,  // Dark green
            0x2D5A27,  // Medium green
            0x3A6B35,  // Light green
        ];
        
        // Create main foliage body with better shape
        // Use 3 cones for better appearance while still being optimized
        for (let i = 0; i < 3; i++) {
            const height = 2.2 - i * 0.4;
            const radius = 1.0 - i * 0.15;
            // Use 6 segments for better performance
            const segments = 6;
            const foliageGeometry = new THREE.ConeGeometry(radius, height, segments);
            const foliageMaterial = new THREE.MeshLambertMaterial({
                color: foliageColors[i % foliageColors.length],
                flatShading: true
            });
            
            const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
            
            // Position cones with better spacing
            foliage.position.y = 3.0 + i * 0.7;
            // Add slight randomness for natural look
            foliage.position.x = (Math.random() - 0.5) * 0.15;
            foliage.position.z = (Math.random() - 0.5) * 0.15;
            
            foliage.rotation.y = Math.random() * Math.PI * 2;
            // Less extreme rotation for more natural look
            foliage.rotation.x = (Math.random() - 0.5) * 0.1;
            foliage.rotation.z = (Math.random() - 0.5) * 0.1;
            
            foliage.castShadow = true;
            foliage.receiveShadow = true;
            foliageGroup.add(foliage);
        }
        
        // Add just 2 detail cones for better performance but still good appearance
        for (let i = 0; i < 2; i++) {
            const smallCone = new THREE.ConeGeometry(0.6, 1.2, 5);
            const material = new THREE.MeshLambertMaterial({
                color: foliageColors[Math.floor(Math.random() * foliageColors.length)],
                flatShading: true
            });
            
            const detail = new THREE.Mesh(smallCone, material);
            // Position on opposite sides for better balance
            const angle = i * Math.PI;
            const radius = 0.7;
            
            detail.position.x = Math.cos(angle) * radius;
            detail.position.z = Math.sin(angle) * radius;
            detail.position.y = 3.5 + Math.random() * 0.8;
            
            // Less extreme rotation for more natural look
            detail.rotation.x = (Math.random() - 0.5) * 0.3;
            detail.rotation.z = (Math.random() - 0.5) * 0.3;
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
        
        // Simplified collision - just use a simple cylinder radius
        const trunkRadius = 0.2;
        
        this.scene.add(treeGroup);
        
        // Simplified collision detection
        this.walls.push({
            type: 'tree',
            bounds: new THREE.Box3().setFromObject(trunk),
            collisionRadius: trunkRadius,
            position: new THREE.Vector3(x, 0, z),
            object: treeGroup
        });
        
        return treeGroup;
    }

    addGrass() {
        // Use instanced mesh for better performance
        const grassGeometry = new THREE.PlaneGeometry(0.15, 0.25);
        const grassMaterial = new THREE.MeshLambertMaterial({  // Using Lambert instead of Standard for performance
            color: 0x3A9D23,
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.5
        });

        // Create instanced mesh
        const instanceCount = 600; // Further reduced for performance
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
        // Performance-optimized lighting setup
        
        // 1. Add ambient light with slightly increased intensity to compensate for fewer lights
        const ambientLight = new THREE.AmbientLight(0xccddff, 0.7); // Increased intensity
        this.scene.add(ambientLight);
        
        // Apply AmbientLightNode if available
        try {
            if (typeof AmbientLightNode === 'function') {
                const ambientNode = new AmbientLightNode(ambientLight);
                ambientLight.userData.lightNode = ambientNode;
            }
        } catch (e) {
            console.warn('AmbientLightNode not fully supported:', e);
        }

        // 2. Add directional light (sun) with optimized settings
        const sunLight = new THREE.DirectionalLight(0xffffcc, 1.2); // Increased intensity
        sunLight.position.set(50, 100, 50);
        sunLight.castShadow = true;
        
        // Apply DirectionalLightNode if available
        try {
            if (typeof DirectionalLightNode === 'function') {
                const dirLightNode = new DirectionalLightNode(sunLight);
                sunLight.userData.lightNode = dirLightNode;
            }
        } catch (e) {
            console.warn('DirectionalLightNode not fully supported:', e);
        }
        
        // Further optimize shadow quality for performance
        if (this.isUsingWebGPU) {
            // Reduced shadow map size for better performance
            sunLight.shadow.mapSize.width = 1024; // Reduced from 2048
            sunLight.shadow.mapSize.height = 1024; // Reduced from 2048
            // Improve shadow precision for WebGPU
            sunLight.shadow.bias = -0.0001;
        } else {
            // WebGL settings
            sunLight.shadow.mapSize.width = 512; // Reduced from 1024
            sunLight.shadow.mapSize.height = 512; // Reduced from 1024
        }
        
        // Optimize shadow camera frustum
        sunLight.shadow.camera.near = 1;
        sunLight.shadow.camera.far = 300; // Reduced from 500
        sunLight.shadow.camera.left = -80; // Reduced from -100
        sunLight.shadow.camera.right = 80; // Reduced from 100
        sunLight.shadow.camera.top = 80; // Reduced from 100
        sunLight.shadow.camera.bottom = -80; // Reduced from -100
        
        this.scene.add(sunLight);

        // 3. Add hemisphere light with optimized settings
        const hemiLight = new THREE.HemisphereLight(0x80bbff, 0x554433, 0.8); // Increased intensity
        hemiLight.position.set(0, 50, 0);
        
        // Apply HemisphereLightNode if available
        try {
            if (typeof HemisphereLightNode === 'function') {
                const hemiNode = new HemisphereLightNode(hemiLight);
                hemiLight.userData.lightNode = hemiNode;
            }
        } catch (e) {
            console.warn('HemisphereLightNode not fully supported:', e);
        }
        
        this.scene.add(hemiLight);

        // Remove additional point lights for performance
        // Instead add just one central light with optimized settings
        const centerLight = this.createPointLight(0, 15, 0, 0xffffaa, 50, 0.6);
        centerLight.castShadow = false; // Disable shadows for point lights for performance
    }

    createPointLight(x, y, z, color, distance, intensity) {
        // Create an optimized point light
        const light = new THREE.PointLight(color, intensity, distance);
        light.position.set(x, y, z);
        
        // Disable shadows for point lights to improve performance
        light.castShadow = false;
        
        // Apply PointLightNode if available
        try {
            if (typeof PointLightNode === 'function') {
                const lightNode = new PointLightNode(light);
                light.userData.lightNode = lightNode;
            }
        } catch (e) {
            console.warn('PointLightNode not fully supported:', e);
        }
        
        this.scene.add(light);
        return light;
    }

    addClouds() {
        console.log('[Environment] Adding clouds to scene');
        
        // Cloud settings based on renderer capabilities
        let segments, cloudCount;
        
        if (this.isUsingWebGPU) {
            // WebGPU can handle more detailed clouds
            segments = 12;
            cloudCount = 10;
        } else {
            // WebGL defaults
            segments = 8;
            cloudCount = 15;
        }
        
        const cloudGeometry = new THREE.SphereGeometry(10, segments, segments);
        const cloudMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });

        // Create clouds based on detected capabilities
        for (let i = 0; i < cloudCount; i++) {
            const cloudCluster = new THREE.Group();
            // Tag the cloud cluster for proper cleanup
            cloudCluster.userData.isEnvironment = true;
            cloudCluster.userData.type = 'cloud';
            
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
                // Tag each cloud part for proper cleanup
                cloudPart.userData.isEnvironment = true;
                cloudPart.userData.type = 'cloud-part';
                cloudCluster.add(cloudPart);
            }

            cloudCluster.position.set(
                (Math.random() - 0.5) * 200,
                60 + Math.random() * 40,
                (Math.random() - 0.5) * 200
            );
            
            this.scene.add(cloudCluster);
        }
        
        // console.log(`[Environment] Added ${cloudCount} cloud clusters to scene`);
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
                    // Optimized tree collision using simple radius check
                    if (wall.collisionRadius && wall.position) {
                        const dx = position.x - wall.position.x;
                        const dz = position.z - wall.position.z;
                        const distanceSquared = dx * dx + dz * dz;
                        if (distanceSquared < (wall.collisionRadius + playerRadius) * (wall.collisionRadius + playerRadius)) {
                            return true;
                        }
                    }
                    break;
                    
                case 'rock':
                    // Optimized rock collision using simple radius check
                    if (wall.collisionRadius && wall.position) {
                        const dx = position.x - wall.position.x;
                        const dz = position.z - wall.position.z;
                        const distanceSquared = dx * dx + dz * dz;
                        if (distanceSquared < (wall.collisionRadius + playerRadius) * (wall.collisionRadius + playerRadius)) {
                            return true;
                        }
                    }
                    break;
                    
                case 'log':
                    // Keep existing log collision logic
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

    createAnimatedBoundary() {
        // Create WebGPU-optimized boundary with proper lighting
        const boundaryHeight = 3.0;
        const segments = 48; // Reduced segment count for better performance
        
        // Create animated texture for the boundary
        const textureSize = 256; // Reduced texture size for better performance
        const canvas = document.createElement('canvas');
        canvas.width = textureSize;
        canvas.height = textureSize;
        const ctx = canvas.getContext('2d');
        
        // Draw striped pattern
        for (let i = 0; i < textureSize; i += 16) {
            const gradient = ctx.createLinearGradient(i, 0, i + 12, 0);
            gradient.addColorStop(0, 'rgba(255, 64, 64, 0.8)');
            gradient.addColorStop(1, 'rgba(255, 180, 180, 0.2)');
            ctx.fillStyle = gradient;
            ctx.fillRect(i, 0, 8, textureSize);
        }
        
        const stripesTexture = new THREE.CanvasTexture(canvas);
        stripesTexture.wrapS = stripesTexture.wrapT = THREE.RepeatWrapping;
        stripesTexture.repeat.set(8, 2);
        stripesTexture.minFilter = THREE.LinearFilter; // Simpler filtering for performance
        
        // Create material optimized for WebGPU lighting with enhanced visibility
        const boundaryMaterial = new THREE.MeshStandardMaterial({
            color: 0xff4040,
            emissive: 0xff2020,
            emissiveIntensity: 1.2, // Increased brightness
            metalness: 0.5,
            roughness: 0.2, // Smoother for better reflections
            transparent: true,
            opacity: 0.9, // Higher opacity for better visibility
            alphaMap: stripesTexture,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        // Create the boundary cylinder
        this.boundaryWall = new THREE.Mesh(
            new THREE.CylinderGeometry(this.boundaryRadius, this.boundaryRadius, boundaryHeight, segments, 1, true),
            boundaryMaterial
        );
        this.boundaryWall.position.y = boundaryHeight / 2;
        this.scene.add(this.boundaryWall);
        
        // Create boundary lights using WebGPU's lighting system
        this.barrierLights = [];
        
        // Add lights at cardinal points for proper boundary illumination
        const lightPositions = [
            { angle: 0, x: this.boundaryRadius, z: 0 },
            { angle: Math.PI/2, x: 0, z: this.boundaryRadius },
            { angle: Math.PI, x: -this.boundaryRadius, z: 0 },
            { angle: Math.PI*3/2, x: 0, z: -this.boundaryRadius }
        ];
        
                // Create lights with WebGPU-optimized settings and enhanced lighting nodes
        // Reduce number of lights for performance - use only 2 instead of 4
        lightPositions.slice(0, 2).forEach(pos => {
            // Create a point light with WebGPU settings - enhanced brightness
            const light = new THREE.PointLight(0xff3030, 5, 30); // Brighter to compensate for fewer lights
            light.position.set(pos.x, boundaryHeight/2, pos.z);
                    
            // Apply PointLightNode for enhanced lighting effects if available
            try {
                if (typeof PointLightNode === 'function') {
                    const lightNode = new PointLightNode(light);
                    light.userData.lightNode = lightNode;
                }
            } catch (e) {
                console.warn('PointLightNode not fully supported:', e);
            }
                    
            // Enable shadows if WebGPU is available
            if (this.isUsingWebGPU) {
                light.castShadow = true;
                light.shadow.mapSize.width = 256; // Reduced shadow map size
                light.shadow.mapSize.height = 256; // Reduced shadow map size
            }
            
            this.scene.add(light);
            this.barrierLights.push(light);
        });
        
        // Add a hemisphere light for barrier glow with enhanced node support
        const hemiLight = new THREE.HemisphereLight(0xff4040, 0x404040, 0.8); // Increased intensity
        hemiLight.position.set(0, boundaryHeight, 0);
        
        // Apply HemisphereLightNode for enhanced lighting effects if available
        try {
            if (typeof HemisphereLightNode === 'function') {
                const hemiLightNode = new HemisphereLightNode(hemiLight);
                hemiLight.userData.lightNode = hemiLightNode;
            }
        } catch (e) {
            console.warn('HemisphereLightNode not fully supported:', e);
        }
        
        this.boundaryWall.add(hemiLight);
        this.barrierLights.push(hemiLight);
        
        // Initialize animation variables
        this._animationTime = 0;
    }
    
    // Empty placeholder methods to maintain API compatibility
    updateBoundaryRing(playerPosition, deltaTime) {
        // No visual boundary ring to update
    }

    updateAnimatedBarrierWall(deltaTime, playerPosition = null) {
        // Update WebGPU-optimized boundary
        if (this.boundaryWall && this.boundaryWall.material) {
            // Update animation time
            this._animationTime += deltaTime;
            
            // Animate texture offset for moving effect - faster animation
            if (this.boundaryWall.material.alphaMap) {
                this.boundaryWall.material.alphaMap.offset.y = this._animationTime * 0.4; // Double animation speed
                this.boundaryWall.material.alphaMap.offset.x = Math.sin(this._animationTime) * 0.1; // Add horizontal movement
                this.boundaryWall.material.alphaMap.needsUpdate = true;
            }
            
            // Player proximity effects
            if (playerPosition) {
                const distanceToCenter = Math.sqrt(playerPosition.x * playerPosition.x + playerPosition.z * playerPosition.z);
                const distanceToBoundary = Math.max(0, this.boundaryRadius - distanceToCenter);
                
                // Increase visual effects when player is close to boundary
                if (distanceToBoundary < 8) {
                    // Calculate intensity based on proximity
                    const proximityFactor = 1.0 + (1.0 - distanceToBoundary / 8) * 2.0;
                    
                    // Increase emissive intensity
                    this.boundaryWall.material.emissiveIntensity = Math.min(2.0, 0.8 * proximityFactor);
                    
                    // Make boundary more visible/intense
                    this.boundaryWall.material.opacity = Math.min(1.0, 0.8 * proximityFactor);
                    
                    // Animate texture faster when close to boundary
                    if (this.boundaryWall.material.alphaMap) {
                        this.boundaryWall.material.alphaMap.offset.y += deltaTime * 0.3 * proximityFactor;
                    }
                    
                    // Update lights intensity
                    this.updateBarrierLights(deltaTime, proximityFactor);
                } else {
                    // Default values when player is far
                    this.boundaryWall.material.emissiveIntensity = 0.8;
                    this.boundaryWall.material.opacity = 0.8;
                    
                    // Update lights with normal intensity
                    this.updateBarrierLights(deltaTime, 1.0);
                }
            } else {
                // Update lights with normal intensity
                this.updateBarrierLights(deltaTime, 1.0);
            }
        }
    }

    updateBarrierLights(deltaTime, intensityFactor = 1.0) {
        if (!this.barrierLights || this.barrierLights.length === 0) return;
        
        // Update the animation time for light pulsing
        this._animationTime += deltaTime;
        const pulseValue = Math.sin(this._animationTime * 2) * 0.3 + 0.7; // Pulsing between 0.4 and 1.0
        
        // Update each barrier light
        this.barrierLights.forEach((light, index) => {
            // Skip hemisphere lights which don't have intensity
            if (light instanceof THREE.HemisphereLight) {
                light.intensity = 0.6 * intensityFactor; // Just adjust base intensity
                return;
            }
            
            // For point lights
            if (light instanceof THREE.PointLight) {
                // Add offset for each light to make them pulse at different times
                const offsetPulse = pulseValue * (1 + index * 0.25) * intensityFactor;
                light.intensity = 4 * offsetPulse; // Doubled intensity for better visibility
                
                // Enhance light color for better visibility
                const r = 1.0; // Keep red channel at maximum
                const g = 0.2 + (0.2 * pulseValue); // More noticeable color variation
                const b = 0.2 + (0.2 * pulseValue); // More noticeable color variation
                light.color.setRGB(r, g, b);
                
                // Update distance based on pulse with larger range
                light.distance = 20 + 10 * pulseValue;
            }
        });
    }

    spawnRandomPowerUp() {
        try {
            // Randomly choose between health, ammo, and rapidfire
            const types = ['health', 'ammo', 'rapidfire'];
            const type = types[Math.floor(Math.random() * types.length)];
            console.log(`[Environment] Spawning random power-up of type: ${type}`);
            
            // Create the power-up with proper error handling
            const powerUp = new PowerUp(type, this);
            
            if (!powerUp) {
                console.error(`[Environment] Failed to create power-up of type: ${type}`);
                return;
            }
            
            this.powerUps.push(powerUp);
            console.log(`[Environment] Power-up created successfully. Power-ups count: ${this.powerUps.length}`);
            
            // Force immediate update to ensure it's visible
            if (powerUp.model && powerUp.model.position) {
                console.log(`[Environment] Power-up position: ${powerUp.model.position.x.toFixed(2)}, ${powerUp.model.position.y.toFixed(2)}, ${powerUp.model.position.z.toFixed(2)}`);
            }
        } catch (error) {
            console.error(`[Environment] Error spawning power-up:`, error);
        }
    }

    updatePowerUps(player, deltaTime) {
        // Ensure timer is not negative to start with
        if (this._powerUpTimer < 0) {
            console.log(`[Environment] Fixing negative power-up timer: ${this._powerUpTimer.toFixed(2)} → 0`);
            this._powerUpTimer = 0;
        }
        
        // Spawn new power-ups at intervals
        this._powerUpTimer += deltaTime;
        // console.log(`[Environment] Power-up timer: ${this._powerUpTimer.toFixed(2)}/${this.powerUpSpawnInterval}`);
        
        if (this._powerUpTimer >= this.powerUpSpawnInterval) {
            console.log(`[Environment] Spawning new power-up after ${this._powerUpTimer.toFixed(2)} seconds`);
            this.spawnRandomPowerUp();
            this._powerUpTimer = 0;
        }
        
        // Update all power-ups
        const beforeCount = this.powerUps.length;
        this.powerUps = this.powerUps.filter(pu => {
            pu.update(player);
            return !pu.collected;
        });
        // console.log(`[Environment] Power-ups active: ${this.powerUps.length}/${beforeCount}`);
    }

    spawnPowerUp(type) {
        if (['health', 'ammo', 'rapidfire'].includes(type)) {
            console.log(`[Environment] Manually spawning power-up of type: ${type}`);
            const powerUp = new PowerUp(type, this);
            this.powerUps.push(powerUp);
            console.log(`[Environment] Power-ups count: ${this.powerUps.length}`);
        } else {
            console.warn(`[Environment] Invalid power-up type: ${type}`);
        }
    }

    // Debug method to force spawn a power-up immediately
    forceSpawnPowerUp(type = null) {
        if (!type) {
            // If no type specified, randomly choose one
            const types = ['health', 'ammo', 'rapidfire'];
            type = types[Math.floor(Math.random() * types.length)];
        }
        
        console.log(`[Environment] Force spawning power-up of type: ${type}`);
        this.spawnPowerUp(type);
        return `Spawned power-up of type: ${type}`;
    }
}

export default Environment; 