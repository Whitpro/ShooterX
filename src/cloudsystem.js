import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';
import { mergeGeometries } from '../three.js-r178/three.js-r178/examples/jsm/utils/BufferGeometryUtils.js';

const CLOUD_RADIUS = 8;
const SPHERE_SEGMENTS = 8;

class CloudSystem {
    constructor(scene) {
        this.scene = scene;
        this.clouds = [];
        this._material = null;
    }

    generate(count = 15) {
        this._material = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            transparent: true,
            opacity: 0.65,
            roughness: 0.9,
            metalness: 0,
            fog: true,
        });

        for (let i = 0; i < count; i++) {
            const n = 4 + Math.floor(Math.random() * 3);
            const center = new THREE.Vector3(
                (Math.random() - 0.5) * 200,
                70 + Math.random() * 40,
                (Math.random() - 0.5) * 200
            );
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 1.5,
                0,
                (Math.random() - 0.5) * 1.5
            );

            const puffs = [];
            for (let j = 0; j < n; j++) {
                const offset = new THREE.Vector3(
                    (Math.random() - 0.5) * 14,
                    (Math.random() - 0.5) * 3,
                    (Math.random() - 0.5) * 14
                );
                const s = 0.4 + Math.random() * 0.7;
                const geo = new THREE.SphereGeometry(CLOUD_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
                const pos = geo.attributes.position;
                for (let k = 0; k < pos.count; k++) {
                    pos.setXYZ(k,
                        pos.getX(k) * s + offset.x,
                        pos.getY(k) * (s * 0.5) + offset.y,
                        pos.getZ(k) * s + offset.z
                    );
                }
                pos.needsUpdate = true;
                geo.computeVertexNormals();
                puffs.push(geo);
            }

            const mergedGeo = mergeGeometries(puffs, false);
            const mesh = new THREE.Mesh(mergedGeo, this._material);
            mesh.position.copy(center);
            mesh.castShadow = true;
            mesh.receiveShadow = false;
            this.scene.add(mesh);

            this.clouds.push({ mesh, velocity, center });

            for (const g of puffs) g.dispose();
        }
    }

    update(deltaTime) {
        const boundary = 150;
        for (const cloud of this.clouds) {
            cloud.center.x += cloud.velocity.x * deltaTime;
            cloud.center.z += cloud.velocity.z * deltaTime;
            if (cloud.center.x > boundary) cloud.center.x = -boundary;
            else if (cloud.center.x < -boundary) cloud.center.x = boundary;
            if (cloud.center.z > boundary) cloud.center.z = -boundary;
            else if (cloud.center.z < -boundary) cloud.center.z = boundary;
            cloud.mesh.position.copy(cloud.center);
        }
    }

    dispose() {
        for (const cloud of this.clouds) {
            this.scene.remove(cloud.mesh);
            cloud.mesh.geometry.dispose();
        }
        this.clouds = [];
        if (this._material) {
            this._material.dispose();
            this._material = null;
        }
    }
}

export default CloudSystem;
