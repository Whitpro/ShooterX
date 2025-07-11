import * as THREE from '../three.js-r178/three.js-r178/src/Three.js';

class PowerUp {
    constructor(type, environment) {
        console.log(`[PowerUp] Constructor called for type: ${type}`);
        this.type = type;
        this.environment = environment;
        this.collected = false;
        this.effectValue = 0;
        this.model = null;
        this.position = this.getRandomPosition();
        console.log(`[PowerUp] Created ${type} at position:`, this.position);
        this.createModel();
        console.log(`[PowerUp] Model created:`, this.model ? 'Success' : 'Failed');
    }

    getRandomPosition() {
        // Place within the map boundary (radius 60 for safety)
        const radius = 60;
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        return new THREE.Vector3(x, 1.2, z); // Slightly above ground
    }

    createModel() {
        if (this.type === 'health') {
            // Red cross or sphere for health (smaller)
            const geometry = new THREE.SphereGeometry(0.3, 16, 16);
            const material = new THREE.MeshPhongMaterial({ color: 0xff4444, emissive: 0x440000 });
            this.model = new THREE.Mesh(geometry, material);
            this.model.position.copy(this.position);
            this.effectValue = 50;
        } else if (this.type === 'ammo') {
            // Green sphere for ammo
            const geometry = new THREE.SphereGeometry(0.3, 16, 16);
            const material = new THREE.MeshPhongMaterial({ color: 0x44ff44, emissive: 0x114400 });
            this.model = new THREE.Mesh(geometry, material);
            this.model.position.copy(this.position);
            this.effectValue = 20;
        } else if (this.type === 'rapidfire') {
            // Blue sphere for rapid fire (different emissive)
            const geometry = new THREE.SphereGeometry(0.3, 16, 16);
            const material = new THREE.MeshPhongMaterial({ color: 0x00bbff, emissive: 0x003366 });
            this.model = new THREE.Mesh(geometry, material);
            this.model.position.copy(this.position);
            this.effectValue = 10; // seconds of rapid fire
        }
        // Add more types here in the future
        if (this.model && this.environment && this.environment.scene) {
            this.environment.scene.add(this.model);
            console.log(`[PowerUp] Added ${this.type} model to scene:`, this.model);
        } else {
            console.error(`[PowerUp] Failed to add model to scene. Model: ${!!this.model}, Environment: ${!!this.environment}, Scene: ${!!this.environment?.scene}`);
        }
    }

    update(player) {
        if (this.collected || !this.model) return;
        // Optional: animate (e.g., spin)
        this.model.rotation.y += 0.03;
        // Simple collision: if player is close enough
        const dist = player.position.distanceTo(this.model.position);
        if (dist < 1.2) {
            console.log(`[PowerUp] Player collected ${this.type} powerup! Distance: ${dist.toFixed(2)}`);
            this.applyEffect(player);
            this.collect();
        }
    }

    applyEffect(player) {
        // Helper to show a temporary message
        function showPowerupMessage(text) {
            const msg = document.getElementById('powerup-message');
            if (!msg) return;
            msg.textContent = text;
            msg.style.display = 'block';
            msg.style.opacity = '1';
            // Fade out after 2 seconds
            setTimeout(() => {
                msg.style.transition = 'opacity 0.5s';
                msg.style.opacity = '0';
                setTimeout(() => { msg.style.display = 'none'; msg.style.transition = ''; }, 500);
            }, 2000);
        }
        if (this.type === 'health') {
            player.health = Math.min(player.maxHealth, player.health + this.effectValue);
            if (player.scene && player.scene.ui && typeof player.scene.ui.updateHealthBar === 'function') {
                player.scene.ui.updateHealthBar(player.health, player.maxHealth);
            }
            showPowerupMessage('Picked up: Health Boost!');
        } else if (this.type === 'ammo') {
            // Add ammo to the player's weapon, not player.ammo
            if (window.gameEngine && window.gameEngine.weapon) {
                const weapon = window.gameEngine.weapon;
                if (weapon.maxAmmo < 50) {
                    weapon.increaseMaxAmmo(50 - weapon.maxAmmo);
                    weapon.ammo = weapon.maxAmmo;
                    if (window.gameEngine.weaponMaxAmmo !== undefined) {
                        window.gameEngine.weaponMaxAmmo = weapon.maxAmmo;
                    }
                    // Set a timer to revert maxAmmo and ammo after 20 seconds
                    if (weapon._maxAmmoTimeout) clearTimeout(weapon._maxAmmoTimeout);
                    weapon._maxAmmoTimeout = setTimeout(() => {
                        weapon.maxAmmo = 30;
                        weapon.ammo = 30;
                        if (window.gameEngine.weaponMaxAmmo !== undefined) {
                            window.gameEngine.weaponMaxAmmo = 30;
                        }
                        if (player.scene && player.scene.ui && typeof player.scene.ui.updateAmmoCounter === 'function') {
                            player.scene.ui.updateAmmoCounter(weapon.ammo, weapon.maxAmmo);
                        }
                        showPowerupMessage('Ammo boost ended. Back to 30/30.');
                    }, 20000);
                } else {
                    weapon.ammo = Math.min(weapon.maxAmmo, weapon.ammo + this.effectValue);
                }
                if (player.scene && player.scene.ui && typeof player.scene.ui.updateAmmoCounter === 'function') {
                    player.scene.ui.updateAmmoCounter(weapon.ammo, weapon.maxAmmo);
                }
            }
            showPowerupMessage('Picked up: Ammo Refill!');
        } else if (this.type === 'rapidfire') {
            showPowerupMessage('Picked up: Rapid Fire!');
            console.log('[PowerUp] Rapidfire effect triggered');
            let weapon = null;
            if (window.gameEngine && window.gameEngine.weapon) {
                weapon = window.gameEngine.weapon;
                console.log('[PowerUp] window.gameEngine.weapon:', weapon);
            } else {
                console.log('[PowerUp] No weapon found on window.gameEngine');
            }
            if (weapon) {
                // Always set original fire rate to the default (0.5)
                weapon._originalFireRate = 0.5;
                // Clear any existing rapidfire timeout
                if (weapon._rapidfireTimeout) {
                    clearTimeout(weapon._rapidfireTimeout);
                }
                weapon.fireRate = 0.2; // Faster shooting
                console.log('[PowerUp] Rapidfire applied, fireRate:', weapon.fireRate);
                // Set a timer to revert after effectValue seconds
                weapon._rapidfireTimeout = setTimeout(() => {
                    weapon.fireRate = weapon._originalFireRate || 0.5;
                    weapon._rapidfireTimeout = null;
                    console.log('[PowerUp] Rapidfire ended, fireRate:', weapon.fireRate);
                }, this.effectValue * 1000);
                // Optionally update UI or show effect
            }
        }
        // Add more effects for other types
    }

    collect() {
        this.collected = true;
        if (this.model && this.environment && this.environment.scene) {
            // Particle effect: spawn a few small spheres that fly outward and fade
            const particles = [];
            const particleCount = 8;
            for (let i = 0; i < particleCount; i++) {
                const geom = new THREE.SphereGeometry(0.08, 8, 8);
                const mat = new THREE.MeshPhongMaterial({ color: 0xffbbbb, emissive: 0x440000 });
                const mesh = new THREE.Mesh(geom, mat);
                mesh.position.copy(this.model.position);
                // Give each particle a random direction and speed
                mesh.userData = {
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * 2,
                        Math.random() * 2,
                        (Math.random() - 0.5) * 2
                    ),
                    life: 0.5 // seconds
                };
                this.environment.scene.add(mesh);
                particles.push(mesh);
            }
            // Animate and remove particles
            const scene = this.environment.scene;
            let elapsed = 0;
            function animateParticles(delta) {
                elapsed += delta;
                for (const p of particles) {
                    p.position.addScaledVector(p.userData.velocity, delta * 2);
                    p.userData.velocity.y -= 4 * delta; // gravity
                    p.material.opacity = Math.max(0, 1 - elapsed * 2);
                    p.material.transparent = true;
                }
                if (elapsed < 0.5) {
                    requestAnimationFrame((t) => animateParticles(1/60));
                } else {
                    for (const p of particles) {
                        scene.remove(p);
                    }
                }
            }
            animateParticles(1/60);
            this.environment.scene.remove(this.model);
        }
        this.model = null;
    }
}

export default PowerUp; 