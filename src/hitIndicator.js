import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';

export class HitIndicator {
    constructor() {
        this.flashEl = document.getElementById('hit-flash');
        this.arrows = {
            top: document.getElementById('hitArrowTop'),
            bottom: document.getElementById('hitArrowBottom'),
            left: document.getElementById('hitArrowLeft'),
            right: document.getElementById('hitArrowRight')
        };
    }

    showDamage(attackerPosition, camera) {
        this.showFlash();
        if (attackerPosition && camera) {
            this.showDirectional(attackerPosition, camera);
        }
    }

    showFlash() {
        if (!this.flashEl) return;
        this.flashEl.classList.remove('active');
        void this.flashEl.offsetWidth;
        this.flashEl.classList.add('active');
    }

    showDirectional(attackerWorldPos, camera) {
        const dir = new THREE.Vector3().subVectors(attackerWorldPos, camera.position);
        dir.y = 0;
        dir.normalize();

        const cameraDir = new THREE.Vector3();
        camera.getWorldDirection(cameraDir);
        cameraDir.y = 0;
        cameraDir.normalize();

        const angle = Math.atan2(cameraDir.x, cameraDir.z) - Math.atan2(dir.x, dir.z);

        let arrowKey;
        const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (a > Math.PI * 0.75 && a < Math.PI * 1.25) {
            arrowKey = 'top';
        } else if (a < Math.PI * 0.25 || a > Math.PI * 1.75) {
            arrowKey = 'bottom';
        } else if (a >= Math.PI * 0.25 && a <= Math.PI * 0.75) {
            arrowKey = 'left';
        } else {
            arrowKey = 'right';
        }

        const arrow = this.arrows[arrowKey];
        if (!arrow) return;
        arrow.classList.remove('active');
        void arrow.offsetWidth;
        arrow.classList.add('active');
    }
}