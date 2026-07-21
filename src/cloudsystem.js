import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';

const CLOUD_RADIUS = 8;
const SPHERE_SEGMENTS = 8;

class CloudSystem {
    constructor(scene) {
        this.scene = scene;
        this.clouds = [];
        this.instancedMesh = null;
        this._dummy = new THREE.Object3D();
    }

    generate(count = 15) {
        const puffsPerCloud = [];
        let totalPuffs = 0;
        for (let i = 0; i < count; i++) {
            const n = 4 + Math.floor(Math.random() * 3);
            puffsPerCloud.push(n);
            totalPuffs += n;
        }

        const geo = new THREE.SphereGeometry(CLOUD_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            transparent: true,
            opacity: 0.65,
            roughness: 0.9,
            metalness: 0,
            fog: true,
        });
        this.instancedMesh = new THREE.InstancedMesh(geo, mat, totalPuffs);
        this.instancedMesh.castShadow = true;
        this.instancedMesh.receiveShadow = false;
        this.scene.add(this.instancedMesh);

        const dummy = this._dummy;
        let instanceIndex = 0;

        for (let i = 0; i < count; i++) {
            const cloud = {
                position: new THREE.Vector3(
                    (Math.random() - 0.5) * 200,
                    70 + Math.random() * 40,
                    (Math.random() - 0.5) * 200
                ),
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 1.5,
                    0,
                    (Math.random() - 0.5) * 1.5
                ),
                puffData: [],
            };

            const n = puffsPerCloud[i];
            for (let j = 0; j < n; j++) {
                const offset = new THREE.Vector3(
                    (Math.random() - 0.5) * 14,
                    (Math.random() - 0.5) * 3,
                    (Math.random() - 0.5) * 14
                );
                const s = 0.4 + Math.random() * 0.7;

                dummy.position.copy(cloud.position).add(offset);
                dummy.scale.set(s, s * 0.5, s);
                dummy.updateMatrix();
                this.instancedMesh.setMatrixAt(instanceIndex, dummy.matrix);

                cloud.puffData.push({ idx: instanceIndex, offset, scale: s });
                instanceIndex++;
            }

            this.clouds.push(cloud);
        }

        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    update(deltaTime) {
        if (!this.instancedMesh || this.clouds.length === 0) return;

        const dummy = this._dummy;
        const boundary = 150;

        for (const cloud of this.clouds) {
            cloud.position.x += cloud.velocity.x * deltaTime;
            cloud.position.z += cloud.velocity.z * deltaTime;

            if (cloud.position.x > boundary) cloud.position.x = -boundary;
            else if (cloud.position.x < -boundary) cloud.position.x = boundary;
            if (cloud.position.z > boundary) cloud.position.z = -boundary;
            else if (cloud.position.z < -boundary) cloud.position.z = boundary;

            for (const pd of cloud.puffData) {
                dummy.position.copy(cloud.position).add(pd.offset);
                dummy.scale.set(pd.scale, pd.scale * 0.5, pd.scale);
                dummy.updateMatrix();
                this.instancedMesh.setMatrixAt(pd.idx, dummy.matrix);
            }
        }

        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        if (this.instancedMesh) {
            this.scene.remove(this.instancedMesh);
            if (this.instancedMesh.geometry) this.instancedMesh.geometry.dispose();
            if (this.instancedMesh.material) this.instancedMesh.material.dispose();
            this.instancedMesh = null;
        }
        this.clouds = [];
    }
}

export default CloudSystem;
