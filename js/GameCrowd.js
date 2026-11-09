// GameCrowd.js — толпа монстров одним набором мешей: каждая часть модели (ноги,
// торс, руки, голова) — меш с thin instances, у экземпляра своя матрица и цвет.
// Анимация — поворот частей вокруг их опор (pivot из GLB), без скелета.
// Модели (tools/gen-chars.mjs) смотрят в +Z, руки опущены вниз.
//
// Экземпляр: { x, y, h, heading (рад, по карте), pitch, roll, scale, phase, pose,
//   r, g, b } — pose: 0 ходьба, 1 лазанье, 2 атака, 3 лежит/летит (мёртв), 4 стоит.

class CrowdKind {
    constructor(scene, view, model, cap, name) {
        this.cap = cap;
        this.n = 0;
        /** @type {{ mesh: BABYLON.Mesh, role: string, px: number, py: number, pz: number, buf: Float32Array, col: Float32Array }[]} */
        this.parts = [];
        const root = Model3D.build(model, scene, { name });
        for (const child of root.getChildMeshes(false)) {
            const mesh = /** @type {BABYLON.Mesh} */ (child);
            const md = mesh.metadata || {};
            const role = CrowdKind.role(md.part || mesh.name);
            mesh.parent = null;
            mesh.position.set(0, 0, 0);
            World3D.addObject(view, mesh, 'actor', { ink: false, outline: false });
            mesh.receiveShadows = true;
            mesh.alwaysSelectAsActiveMesh = true;
            mesh.doNotSyncBoundingInfo = true;
            mesh.isPickable = false;
            const buf = new Float32Array(cap * 16), col = new Float32Array(cap * 4).fill(1);
            mesh.thinInstanceSetBuffer('matrix', buf, 16, false);
            mesh.thinInstanceSetBuffer('color', col, 4, false);
            mesh.thinInstanceCount = 0;
            const p = md.pivot || [0, 0, 0];
            this.parts.push({ mesh, role, px: p[0], py: p[1], pz: p[2], buf, col });
        }
        root.dispose(true, false);
    }

    static role(name) {
        const n = String(name).toLowerCase();
        if (n.includes('leg') && n.includes('left')) return 'legL';
        if (n.includes('leg') && n.includes('right')) return 'legR';
        if (n.includes('arm') && n.includes('left')) return 'armL';
        if (n.includes('arm') && n.includes('right')) return 'armR';
        if (n.includes('head')) return 'head';
        return 'body';
    }

    begin() { this.n = 0; }

    // Ёмкость кончилась — вдвое больше буферы (облик популярен в этом уровне).
    grow() {
        const cap = this.cap * 2;
        for (const p of this.parts) {
            const buf = new Float32Array(cap * 16), col = new Float32Array(cap * 4).fill(1);
            buf.set(p.buf); col.set(p.col);
            p.buf = buf; p.col = col;
            p.mesh.thinInstanceSetBuffer('matrix', buf, 16, false);
            p.mesh.thinInstanceSetBuffer('color', col, 4, false);
        }
        this.cap = cap;
    }

    add(it) {
        if (this.n >= this.cap) { if (this.cap >= 1600) return; this.grow(); }
        const i = this.n++;
        // Базовая матрица A = S · Rz(roll) · Rx(pitch) · Ry(yaw) (строчные векторы Babylon).
        const s = it.scale, yaw = Math.PI / 2 - it.heading;
        const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(it.pitch || 0), sx = Math.sin(it.pitch || 0);
        const cz = Math.cos(it.roll || 0), sz = Math.sin(it.roll || 0);
        // Ry
        const Y = CrowdKind._Y; Y[0] = cy; Y[1] = 0; Y[2] = -sy; Y[3] = 0; Y[4] = 1; Y[5] = 0; Y[6] = sy; Y[7] = 0; Y[8] = cy;
        // Rx·Ry
        const XY = CrowdKind._XY;
        XY[0] = Y[0]; XY[1] = Y[1]; XY[2] = Y[2];
        XY[3] = cx * Y[3] + sx * Y[6]; XY[4] = cx * Y[4] + sx * Y[7]; XY[5] = cx * Y[5] + sx * Y[8];
        XY[6] = -sx * Y[3] + cx * Y[6]; XY[7] = -sx * Y[4] + cx * Y[7]; XY[8] = -sx * Y[5] + cx * Y[8];
        // S·Rz·(Rx·Ry)
        const A = CrowdKind._A;
        A[0] = s * (cz * XY[0] + sz * XY[3]); A[1] = s * (cz * XY[1] + sz * XY[4]); A[2] = s * (cz * XY[2] + sz * XY[5]);
        A[3] = s * (-sz * XY[0] + cz * XY[3]); A[4] = s * (-sz * XY[1] + cz * XY[4]); A[5] = s * (-sz * XY[2] + cz * XY[5]);
        A[6] = s * XY[6]; A[7] = s * XY[7]; A[8] = s * XY[8];
        const tx = it.x, ty = it.h, tz = it.y;
        const ph = it.phase || 0, sw = Math.sin(ph), pose = it.pose || 0;
        const R = CrowdKind._R;
        for (const p of this.parts) {
            let ax = 0, ay = 0, az = 0;
            switch (p.role) {
                // Руки моделей опущены вниз: −1.3 рад — вытянуты вперёд (зомби), −2.75 — вверх (лазанье).
                case 'legL': ax = pose === 1 ? sw * 0.55 : pose === 3 ? 0.35 : pose === 4 ? 0 : sw * 0.7; break;
                case 'legR': ax = pose === 1 ? -sw * 0.55 : pose === 3 ? -0.25 : pose === 4 ? 0 : -sw * 0.7; break;
                case 'armL': ax = pose === 1 ? -2.75 + sw * 0.35 : pose === 2 ? -1.15 + Math.sin(ph * 2) * 0.6 : pose === 3 ? -2.4 : pose === 4 ? -0.15 : -1.3 + sw * 0.12; break;
                case 'armR': ax = pose === 1 ? -2.75 - sw * 0.35 : pose === 2 ? -1.15 - Math.sin(ph * 2) * 0.6 : pose === 3 ? -0.5 : pose === 4 ? -0.15 : -1.3 - sw * 0.12; break;
                case 'head': az = pose === 3 ? 0.4 : Math.sin(ph * 0.5) * 0.14; ax = pose === 1 ? -0.35 : 0.06; break;
                default: break;
            }
            const o = i * 16, b = p.buf;
            if (!ax && !ay && !az) {
                b[o] = A[0]; b[o + 1] = A[1]; b[o + 2] = A[2]; b[o + 3] = 0;
                b[o + 4] = A[3]; b[o + 5] = A[4]; b[o + 6] = A[5]; b[o + 7] = 0;
                b[o + 8] = A[6]; b[o + 9] = A[7]; b[o + 10] = A[8]; b[o + 11] = 0;
                b[o + 12] = tx; b[o + 13] = ty; b[o + 14] = tz; b[o + 15] = 1;
            } else {
                CrowdKind.local(R, ax, ay, az);
                // M3 = R·A; t = (p − p·R)·A + T
                for (let r = 0; r < 3; r++) {
                    const r0 = R[r * 3], r1 = R[r * 3 + 1], r2 = R[r * 3 + 2];
                    b[o + r * 4] = r0 * A[0] + r1 * A[3] + r2 * A[6];
                    b[o + r * 4 + 1] = r0 * A[1] + r1 * A[4] + r2 * A[7];
                    b[o + r * 4 + 2] = r0 * A[2] + r1 * A[5] + r2 * A[8];
                    b[o + r * 4 + 3] = 0;
                }
                const qx = p.px - (p.px * R[0] + p.py * R[3] + p.pz * R[6]);
                const qy = p.py - (p.px * R[1] + p.py * R[4] + p.pz * R[7]);
                const qz = p.pz - (p.px * R[2] + p.py * R[5] + p.pz * R[8]);
                b[o + 12] = qx * A[0] + qy * A[3] + qz * A[6] + tx;
                b[o + 13] = qx * A[1] + qy * A[4] + qz * A[7] + ty;
                b[o + 14] = qx * A[2] + qy * A[5] + qz * A[8] + tz;
                b[o + 15] = 1;
            }
            const c = i * 4;
            p.col[c] = it.r; p.col[c + 1] = it.g; p.col[c + 2] = it.b; p.col[c + 3] = 1;
        }
    }

    // Локальный поворот части: Ry(ay) · Rx(ax) · Rz(az).
    static local(R, ax, ay, az) {
        const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax), cz = Math.cos(az), sz = Math.sin(az);
        // Ry
        const a0 = cy, a1 = 0, a2 = -sy, a3 = 0, a4 = 1, a5 = 0, a6 = sy, a7 = 0, a8 = cy;
        // ·Rx  (Rx = [1,0,0; 0,cx,sx; 0,-sx,cx])
        const b0 = a0, b1 = a1 * cx - a2 * sx, b2 = a1 * sx + a2 * cx;
        const b3 = a3, b4 = a4 * cx - a5 * sx, b5 = a4 * sx + a5 * cx;
        const b6 = a6, b7 = a7 * cx - a8 * sx, b8 = a7 * sx + a8 * cx;
        // ·Rz  (Rz = [cz,sz,0; -sz,cz,0; 0,0,1])
        R[0] = b0 * cz - b1 * sz; R[1] = b0 * sz + b1 * cz; R[2] = b2;
        R[3] = b3 * cz - b4 * sz; R[4] = b3 * sz + b4 * cz; R[5] = b5;
        R[6] = b6 * cz - b7 * sz; R[7] = b6 * sz + b7 * cz; R[8] = b8;
    }

    end() {
        for (const p of this.parts) {
            p.mesh.thinInstanceCount = this.n;
            p.mesh.thinInstanceBufferUpdated('matrix');
            p.mesh.thinInstanceBufferUpdated('instanceColor');   // setBuffer('color') хранится как instanceColor
            p.mesh.setEnabled(this.n > 0);
            if (this.n > 0) ensureInstanceColor(p.mesh);
        }
    }

    dispose() { for (const p of this.parts) p.mesh.dispose(false, false); this.parts = []; }
}
CrowdKind._Y = new Float32Array(9);
CrowdKind._XY = new Float32Array(9);
CrowdKind._A = new Float32Array(9);
CrowdKind._R = new Float32Array(9);

/** @satisfies {Record<string, any>} */
const GameCrowd = {
    /** @type {Record<string, CrowdKind>} */
    kinds: {},
    /** @type {Record<string, Promise<CrowdKind | null>>} */
    loading: {},
    scene: null, view: null, cap: 160,

    // Сцена и стартовая ёмкость набора; модели — лениво (ensure / preload).
    async init(scene, view, cap) {
        if (this.scene === scene) return;
        this.dispose();
        this.scene = scene; this.view = view; this.cap = cap;
    },

    // Набор облика: модель грузится один раз, до готовности — промис.
    ensure(url) {
        if (this.kinds[url]) return Promise.resolve(this.kinds[url]);
        if (!this.loading[url]) {
            this.loading[url] = Model3D.load(url).then((model) => {
                if (!this.scene) return null;
                const k = new CrowdKind(this.scene, this.view, model, this.cap, 'crowd');
                this.kinds[url] = k;
                return k;
            }).catch((e) => { console.warn('GameCrowd:', url, (e && e.message) || e); return null; });
        }
        return this.loading[url];
    },

    preload(urls) { return Promise.all(urls.map(u => this.ensure(u))); },

    begin() { for (const k of Object.values(this.kinds)) k.begin(); },
    add(url, it) { const k = this.kinds[url]; if (k) k.add(it); else this.ensure(url); },
    end() { for (const k of Object.values(this.kinds)) k.end(); },
    dispose() { for (const k of Object.values(this.kinds)) k.dispose(); this.kinds = {}; this.loading = {}; this.scene = null; },
};
