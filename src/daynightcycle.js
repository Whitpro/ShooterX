import * as THREE from '../three.js-r178/three.js-r178/src/Three.WebGPU.js';

const _c1 = new THREE.Color();
const _c2 = new THREE.Color();

function lerpHex(a, b, t) {
    _c1.setHex(a); _c2.setHex(b); _c1.lerp(_c2, t);
    return _c1.getHex();
}

function lerp(a, b, t) { return a + (b - a) * t; }

const KEYFRAMES = [
    { hour: 0,
        ambient: [0x3a3a60, 0.45],
        sun: [0x5577bb, 0.30],
        hemi: [0x2a2a60, 0x1a1a40, 0.40],
        fill: [0x2a2a70, 0.30, 80],
        rim: [0x2a2a70, 0.20, 50, 40, 50],
        fog: 0x3a3a60,
        sky: ['#151540','#252560','#353580','#2a2a60','#2a2a60'] },
    { hour: 5,
        ambient: [0x505080, 0.50],
        sun: [0xbb99dd, 0.55],
        hemi: [0x5050a0, 0x303060, 0.55],
        fill: [0x9070c0, 0.45, 80],
        rim: [0x9070c0, 0.30, 50, 50, 50],
        fog: 0x505080,
        sky: ['#1a1a40','#3a3070','#5050a0','#6060c0','#505090'] },
    { hour: 7,
        ambient: [0x604020, 0.25],
        sun: [0xff8844, 0.80],
        hemi: [0xcc8855, 0x3a2010, 0.50],
        fill: [0xff8844, 0.35, 80],
        rim: [0xff6633, 0.15, 40, 40, 40],
        fog: 0x886644,
        sky: ['#2a1030','#5a2030','#aa5533','#ddaa66','#eebb99'] },
    { hour: 12,
        ambient: [0x303050, 0.45],
        sun: [0xffdd88, 2.00],
        hemi: [0x8899bb, 0x3a3020, 0.75],
        fill: [0xffcc77, 0.50, 80],
        rim: [0x8899bb, 0.20, 70, 60, 70],
        fog: 0x8a9aaa,
        sky: ['#203050','#3060a0','#6090c0','#90aabb','#aabbcc'] },
    { hour: 15,
        ambient: [0x503830, 0.40],
        sun: [0xffaa44, 2.00],
        hemi: [0xbb9966, 0x3a2a1a, 0.65],
        fill: [0xff9944, 0.50, 80],
        rim: [0xff8844, 0.20, 60, 50, 60],
        fog: 0xaa8866,
        sky: ['#203050','#4a4060','#aa7744','#cc9966','#ddaa77'] },
    { hour: 19,
        ambient: [0x705040, 0.55],
        sun: [0xff8844, 1.00],
        hemi: [0xcc8866, 0x4a3030, 0.60],
        fill: [0xff8844, 0.55, 80],
        rim: [0xff6633, 0.30, 60, 50, 60],
        fog: 0xaa7755,
        sky: ['#2a0a20','#5a2020','#994433','#cc7744','#dd8855'] },
    { hour: 22,
        ambient: [0x3a3a70, 0.40],
        sun: [0x6688cc, 0.35],
        hemi: [0x303080, 0x202050, 0.40],
        fill: [0x303090, 0.30, 80],
        rim: [0x303090, 0.20, 50, 40, 50],
        fog: 0x3a3a70,
        sky: ['#151540','#252560','#353580','#404090','#303060'] },
];

class DayNightCycle {
    constructor(env) {
        this.env = env;
        // Start at noon for bright default lighting
        this.hour = 12;
        // Full 24h day in real seconds
        this.cycleDuration = 300;

        this._lastGradientKey = -1;
        this._skipFirstFrame = 2;
        this.frozen = false;

        // Reusable position vectors
        this._sunPos = new THREE.Vector3();
        this._moonPos = new THREE.Vector3();
    }

    setFrozen(frozen, hour = null) {
        this.frozen = frozen;
        if (frozen && hour !== null) {
            this.hour = hour % 24;
            this._lastGradientKey = -1;
            this._skipFirstFrame = 2;
        }
    }

    dispose() {
        this.env = null;
    }

    refresh(env) {
        this.env = env;
    }

    update(deltaTime) {
        if (!this.env) return;

        // Skip first few frames to let the scene settle
        if (this._skipFirstFrame > 0) {
            this._skipFirstFrame--;
            return;
        }

        if (!this.frozen) {
            const hourDelta = (deltaTime / this.cycleDuration) * 24;
            this.hour = (this.hour + hourDelta) % 24;
        }

        const kf = this._sample(this.hour);

        this._applyLights(kf);
        this._updateSunPosition();
        this._updateMoonPosition();
        this._updateSkyDome(kf);
        this._updateFog(kf);
    }

    /** Returns 0 (bright day) → 1 (pitch night) */
    getDarkness() {
        const rawElev = Math.sin(((this.hour - 6) / 12) * Math.PI);
        const t = (rawElev - 0.1) / (-0.3 - 0.1);
        return Math.max(0, Math.min(1, t));
    }

    _sample(hour) {
        const n = KEYFRAMES.length;
        let i = 0;
        for (; i < n - 1; i++) {
            if (hour < KEYFRAMES[i + 1].hour) break;
        }
        const a = KEYFRAMES[i];
        const b = KEYFRAMES[(i + 1) % n];

        let t;
        if (b.hour < a.hour) {
            t = (hour - a.hour) / (24 - a.hour + b.hour);
        } else {
            t = (hour - a.hour) / (b.hour - a.hour);
        }
        t = Math.max(0, Math.min(1, t));

        return {
            ambientColor: lerpHex(a.ambient[0], b.ambient[0], t),
            ambientIntensity: lerp(a.ambient[1], b.ambient[1], t),
            sunColor: lerpHex(a.sun[0], b.sun[0], t),
            sunIntensity: lerp(a.sun[1], b.sun[1], t),
            hemiSky: lerpHex(a.hemi[0], b.hemi[0], t),
            hemiGround: lerpHex(a.hemi[1], b.hemi[1], t),
            hemiIntensity: lerp(a.hemi[2], b.hemi[2], t),
            fillColor: lerpHex(a.fill[0], b.fill[0], t),
            fillIntensity: lerp(a.fill[1], b.fill[1], t),
            fillDistance: lerp(a.fill[2], b.fill[2], t),
            rimColor: lerpHex(a.rim[0], b.rim[0], t),
            rimIntensity: lerp(a.rim[1], b.rim[1], t),
            rimX: lerp(a.rim[2], b.rim[2], t),
            rimY: lerp(a.rim[3], b.rim[3], t),
            rimZ: lerp(a.rim[4], b.rim[4], t),
            fog: lerpHex(a.fog, b.fog, t),
            skyA: lerpHex(parseInt(a.sky[0].slice(1),16), parseInt(b.sky[0].slice(1),16), t),
            skyB: lerpHex(parseInt(a.sky[1].slice(1),16), parseInt(b.sky[1].slice(1),16), t),
            skyC: lerpHex(parseInt(a.sky[2].slice(1),16), parseInt(b.sky[2].slice(1),16), t),
            skyD: lerpHex(parseInt(a.sky[3].slice(1),16), parseInt(b.sky[3].slice(1),16), t),
            skyE: lerpHex(parseInt(a.sky[4].slice(1),16), parseInt(b.sky[4].slice(1),16), t),
        };
    }

    _applyLights(kf) {
        const env = this.env;
        if (env.ambientLight) {
            env.ambientLight.color.setHex(kf.ambientColor);
            env.ambientLight.intensity = kf.ambientIntensity;
        }
        if (env.sunLight) {
            env.sunLight.color.setHex(kf.sunColor);
            env.sunLight.intensity = kf.sunIntensity;
        }
        if (env.hemiLight) {
            env.hemiLight.color.setHex(kf.hemiSky);
            env.hemiLight.groundColor.setHex(kf.hemiGround);
            env.hemiLight.intensity = kf.hemiIntensity;
        }
        if (env.fillLight) {
            env.fillLight.color.setHex(kf.fillColor);
            env.fillLight.intensity = kf.fillIntensity;
            env.fillLight.distance = kf.fillDistance;
        }
        if (env.rimLight) {
            env.rimLight.color.setHex(kf.rimColor);
            env.rimLight.intensity = kf.rimIntensity;
            env.rimLight.position.set(kf.rimX, kf.rimY, kf.rimZ);
        }
    }

    _updateSunPosition() {
        const env = this.env;
        const phi = ((this.hour - 6) / 12) * Math.PI;
        const elev = Math.sin(phi);
        const horiz = Math.cos(phi);

        // Sun orbits in an arc shifted off-center
        const x = -horiz * 50 + 70;
        const y = elev * 100 + 50;
        const z = horiz * 10 + 20;
        this._sunPos.set(x, y, z);

        if (env.sunLight) {
            env.sunLight.position.copy(this._sunPos);
        }

        // Show/hide the visible sun based on whether it's above the horizon
        const visible = y > 10;
        for (const obj of env.sunObjects) {
            obj.position.copy(this._sunPos);
            obj.visible = visible;
        }
    }

    _updateMoonPosition() {
        const env = this.env;
        // Moon is 12 hours offset from the sun
        const phi = (((this.hour + 12) - 6) / 12) * Math.PI;
        const elev = Math.sin(phi);
        const horiz = Math.cos(phi);

        const x = -horiz * 50 + 70;
        const y = elev * 100 + 50;
        const z = horiz * 10 + 20;
        this._moonPos.set(x, y, z);

        const darkness = this.getDarkness();
        const visible = darkness > 0.15 && y > 10;
        for (const obj of env.moonObjects) {
            obj.position.copy(this._moonPos);
            obj.visible = visible;
        }
    }

    _updateSkyDome(kf) {
        const env = this.env;
        if (!env.skyDome || !env.skyDome.material || !env.skyDome.material.map) return;

        const h = Math.floor(this.hour * 4);
        if (h === this._lastGradientKey) return;
        this._lastGradientKey = h;

        const toCSS = (hex) => {
            const r = (hex >> 16) & 0xff;
            const g = (hex >> 8) & 0xff;
            const b = hex & 0xff;
            return `rgb(${r},${g},${b})`;
        };

        const canvas = env.skyDome.material.map.image;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 1, 256);
        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0,   toCSS(kf.skyA));
        grad.addColorStop(0.3, toCSS(kf.skyB));
        grad.addColorStop(0.6, toCSS(kf.skyC));
        grad.addColorStop(0.8, toCSS(kf.skyD));
        grad.addColorStop(1,   toCSS(kf.skyE));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1, 256);

        env.skyDome.material.map.needsUpdate = true;
    }

    _updateFog(kf) {
        const env = this.env;
        if (env.scene && env.scene.fog) {
            env.scene.fog.color.setHex(kf.fog);
        }
    }
}

export default DayNightCycle;
