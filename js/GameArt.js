// GameArt.js — процедурная графика Backflip Rooftops Survivor: шапки, оружие ближнего боя,
// рюкзаки, питомцы, скины оружия и 3D-превью предметов магазина (отдельный
// маленький движок Babylon на скрытом холсте -> PNG data URL).
// Модели героев, монстров и бластеров — GLB из assets/models (Model3D).

/** @satisfies {Record<string, any>} */
const GameArt = {
    _mats: new Map(),

    // Материал цвета hex на сцену (кэш). opts: { emissive: 0..1, alpha, unlit, spec }.
    mat(scene, hex, opts) {
        const o = opts || {};
        const key = scene.uid + '|' + hex + '|' + (o.emissive || 0) + '|' + (o.alpha || 1) + '|' + (o.unlit ? 1 : 0) + '|' + (o.spec || 0);
        let m = this._mats.get(key);
        if (m && m.getScene() === scene && !m.isDisposed) return m;
        m = new BABYLON.StandardMaterial('sm-' + hex, scene);
        const c = BABYLON.Color3.FromHexString(hex);
        m.diffuseColor = c;
        m.specularColor = new BABYLON.Color3(o.spec || 0.08, o.spec || 0.08, o.spec || 0.08);
        if (o.emissive) m.emissiveColor = c.scale(o.emissive);
        if (o.alpha != null && o.alpha < 1) m.alpha = o.alpha;
        if (o.unlit) { m.disableLighting = true; m.emissiveColor = c; }
        this._mats.set(key, m);
        return m;
    },

    // Примитив -> меш с материалом, позицией, поворотом (градусы) и масштабом.
    prim(scene, kind, size, hex, pos, rot, opts) {
        const B = BABYLON.MeshBuilder;
        let m;
        if (kind === 'box') m = B.CreateBox('p', { width: size[0], height: size[1], depth: size[2] }, scene);
        else if (kind === 'cyl') m = B.CreateCylinder('p', { diameterTop: size[0], diameterBottom: size[1], height: size[2], tessellation: size[3] || 16 }, scene);
        else if (kind === 'sph') m = B.CreateSphere('p', { diameter: 1, segments: 10 }, scene);
        else if (kind === 'torus') m = B.CreateTorus('p', { diameter: size[0], thickness: size[1], tessellation: size[2] || 24 }, scene);
        else m = B.CreateBox('p', { size: 1 }, scene);
        if (kind === 'sph') m.scaling.set(size[0], size[1], size[2]);
        m.material = this.mat(scene, hex, opts);
        if (pos) m.position.set(pos[0], pos[1], pos[2]);
        if (rot) m.rotation.set(rot[0] * Math.PI / 180, rot[1] * Math.PI / 180, rot[2] * Math.PI / 180);
        return m;
    },

    // Детали -> один меш (материалы — MultiMaterial). Пустой список -> пустой меш.
    merge(scene, name, parts) {
        if (!parts.length) return new BABYLON.Mesh(name, scene);
        const m = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, true);
        m.name = name;
        return m;
    },

    // --- шапки: координаты головы героя (модель, px): макушка y = 270, лицо к +Z ---
    hat(scene, kind) {
        const P = (k, s, c, p, r, o) => this.prim(scene, k, s, c, p, r, o);
        const T = 270, parts = [];
        switch (kind) {
            case 'cap':
                parts.push(P('sph', [88, 50, 88], '#d8322b', [0, T - 4, 0]), P('box', [70, 6, 46], '#d8322b', [0, T - 2, 52]), P('sph', [14, 10, 14], '#ffffff', [0, T + 20, 0]));
                break;
            case 'beanie':
                parts.push(P('sph', [90, 66, 90], '#2f6fd6', [0, T - 6, 0]), P('cyl', [92, 92, 14], '#f2f2f2', [0, T - 18, 0]), P('sph', [26, 26, 26], '#f2f2f2', [0, T + 30, 0]));
                break;
            case 'cowboy':
                parts.push(P('cyl', [130, 130, 5], '#8a5a2b', [0, T, 0]), P('cyl', [56, 66, 44], '#8a5a2b', [0, T + 22, 0]), P('cyl', [68, 68, 8], '#3a2413', [0, T + 8, 0]));
                break;
            case 'tophat':
                parts.push(P('cyl', [104, 104, 5], '#1b1b1f', [0, T, 0]), P('cyl', [64, 64, 74], '#1b1b1f', [0, T + 38, 0]), P('cyl', [66, 66, 12], '#c0392b', [0, T + 10, 0]));
                break;
            case 'helmet':
                parts.push(P('sph', [96, 64, 96], '#f5c518', [0, T - 6, 0]), P('cyl', [106, 106, 5], '#f5c518', [0, T - 10, 0]), P('box', [12, 16, 10], '#fff5c0', [0, T + 8, 46], null, { emissive: 0.6 }));
                break;
            case 'party':
                parts.push(P('cyl', [0, 54, 78], '#ff4fa3', [0, T + 36, 0]), P('sph', [18, 18, 18], '#ffd23f', [0, T + 78, 0]), P('cyl', [52, 54, 8], '#3ec1ff', [0, T + 6, 0]));
                break;
            case 'chef':
                parts.push(P('cyl', [74, 74, 34], '#f7f7f7', [0, T + 14, 0]), P('sph', [96, 56, 96], '#ffffff', [0, T + 40, 0]));
                break;
            case 'viking':
                parts.push(P('sph', [92, 62, 92], '#8e99a4', [0, T - 6, 0]), P('cyl', [94, 94, 10], '#6b5530', [0, T - 12, 0]),
                    P('cyl', [0, 20, 56], '#f0e6c8', [-56, T + 18, 0], [0, 0, 55]), P('cyl', [0, 20, 56], '#f0e6c8', [56, T + 18, 0], [0, 0, -55]));
                break;
            case 'pirate':
                parts.push(P('cyl', [124, 124, 22, 3], '#1d1d22', [0, T + 8, 0], [0, 90, 0]), P('cyl', [80, 80, 16, 3], '#1d1d22', [0, T + 24, 0], [0, 90, 0]),
                    P('sph', [20, 20, 6], '#f2f2f2', [0, T + 20, 36]));
                break;
            case 'headphones':
                parts.push(P('torus', [96, 9, 24], '#222428', [0, T - 36, 0], [0, 0, 90]),
                    P('cyl', [34, 34, 18], '#e84118', [-48, T - 76, 0], [0, 0, 90]), P('cyl', [34, 34, 18], '#e84118', [48, T - 76, 0], [0, 0, 90]));
                break;
            case 'propeller':
                parts.push(P('sph', [88, 50, 88], '#3ec1ff', [0, T - 4, 0]), P('box', [70, 6, 44], '#ffd23f', [0, T - 2, 50]),
                    P('cyl', [6, 6, 26], '#333333', [0, T + 30, 0]));
                break;
            case 'crown':
                parts.push(P('cyl', [74, 74, 22, 10], '#ffcc00', [0, T + 10, 0], null, { emissive: 0.15, spec: 0.6 }));
                for (let i = 0; i < 6; i++) {
                    const a = i / 6 * Math.PI * 2;
                    parts.push(P('cyl', [0, 16, 24, 4], '#ffcc00', [Math.cos(a) * 32, T + 32, Math.sin(a) * 32], null, { emissive: 0.15, spec: 0.6 }));
                    parts.push(P('sph', [9, 9, 9], i % 2 ? '#e8243c' : '#2fb5ff', [Math.cos(a) * 37, T + 12, Math.sin(a) * 37], null, { emissive: 0.4 }));
                }
                break;
            case 'halo':
                parts.push(P('torus', [70, 8, 28], '#fff08a', [0, T + 34, 0], null, { unlit: true }));
                break;
            default: break;
        }
        const m = this.merge(scene, 'hat-' + kind, parts);
        if (kind === 'propeller') {
            const blade = P('box', [84, 3, 12], '#e84118', [0, T + 44, 0]);
            blade.parent = m;
            blade.metadata = { spin: 1 };
        }
        return m;
    },

    // --- ближний бой: модель GLB (tools/gen-guns.mjs), рукоять в начале координат, вдоль +Y ---
    async melee(scene, item) {
        return this.model(scene, item.model, 'melee-' + item.kind);
    },

    // --- рюкзак: координаты торса героя, спина — к −Z ---
    pack(scene, item) {
        const P = (k, s, c, p, r, o) => this.prim(scene, k, s, c, p, r, o);
        const a = item.color, b = item.color2, glow = item.style >= 8 ? { emissive: item.style === 9 ? 0.5 : 0.15, spec: 0.5 } : null;
        const parts = [
            P('box', [76, 92, 40], a, [0, 148, -52], null, glow), P('box', [80, 16, 44], b, [0, 196, -52]),
            P('box', [54, 34, 12], b, [0, 124, -76]), P('box', [10, 92, 6], b, [-26, 150, -30]), P('box', [10, 92, 6], b, [26, 150, -30]),
            P('cyl', [26, 26, 70], b, [0, 104, -52], [0, 0, 90]),
        ];
        if (item.style === 7) parts.push(P('cyl', [24, 30, 50], '#95a5a6', [-28, 112, -80]), P('cyl', [24, 30, 50], '#95a5a6', [28, 112, -80]));
        if (item.style === 6) parts.push(P('box', [60, 8, 6], '#e84118', [0, 170, -74], null, { emissive: 0.4 }));
        if (item.style === 9) parts.push(P('box', [80, 4, 4], b, [0, 104, -74], null, { unlit: true }), P('box', [4, 92, 4], b, [-40, 148, -74], null, { unlit: true }), P('box', [4, 92, 4], b, [40, 148, -74], null, { unlit: true }));
        return this.merge(scene, 'pack', parts);
    },

    // --- питомец: мировые px, центр в начале координат ---
    pet(scene, kind) {
        const P = (k, s, c, p, r, o) => this.prim(scene, k, s, c, p, r, o);
        const parts = [], eyes = (z, y, d) => { parts.push(P('sph', [d, d, d], '#111', [-d * 0.9, y, z]), P('sph', [d, d, d], '#111', [d * 0.9, y, z])); };
        switch (kind) {
            case 'drone':
                parts.push(P('box', [34, 12, 34], '#3a3f45'), P('sph', [16, 12, 16], '#2fb5ff', [0, -8, 10], null, { emissive: 0.6 }));
                for (const [x, z] of [[-22, -22], [22, -22], [-22, 22], [22, 22]]) parts.push(P('cyl', [26, 26, 3], '#8e99a4', [x, 8, z]), P('cyl', [4, 4, 10], '#222', [x, 3, z]));
                break;
            case 'orb':
                parts.push(P('sph', [34, 34, 34], '#b06bff', null, null, { emissive: 0.7 }), P('torus', [50, 4, 24], '#3cf2ff', null, [70, 0, 0], { unlit: true }));
                break;
            case 'bat':
                parts.push(P('sph', [30, 26, 26], '#3b2a4a'), P('box', [40, 4, 20], '#4d3a5e', [-30, 4, 0], [0, 0, 15]), P('box', [40, 4, 20], '#4d3a5e', [30, 4, 0], [0, 0, -15]),
                    P('cyl', [0, 8, 12, 4], '#3b2a4a', [-8, 16, 0]), P('cyl', [0, 8, 12, 4], '#3b2a4a', [8, 16, 0]));
                eyes(12, 2, 5);
                break;
            case 'ufo':
                parts.push(P('cyl', [20, 60, 12], '#aab4be', null, null, { spec: 0.6 }), P('sph', [28, 22, 28], '#7cff5a', [0, 8, 0], null, { emissive: 0.4, alpha: 0.85 }),
                    P('cyl', [60, 30, 6], '#8e99a4', [0, -8, 0]));
                break;
            case 'cube':
                parts.push(P('box', [34, 34, 34], '#ffb81f'), P('box', [36, 8, 36], '#e8891c', [0, -12, 0]));
                eyes(18, 4, 7);
                break;
            case 'star':
                for (let i = 0; i < 5; i++) {
                    const a = i / 5 * Math.PI * 2 - Math.PI / 2;
                    parts.push(P('cyl', [0, 16, 22, 4], '#ffe066', [Math.cos(a) * 12, -Math.sin(a) * 12, 0], [0, 0, -(a * 180 / Math.PI) - 90], { emissive: 0.5 }));
                }
                parts.push(P('sph', [26, 26, 14], '#ffe066', null, null, { emissive: 0.5 }));
                eyes(8, 2, 4);
                break;
            case 'dragon':
                parts.push(P('sph', [30, 28, 38], '#3fbf5f'), P('sph', [22, 20, 22], '#3fbf5f', [0, 12, 20]),
                    P('box', [36, 3, 18], '#2c8a43', [-24, 10, -2], [0, 0, 25]), P('box', [36, 3, 18], '#2c8a43', [24, 10, -2], [0, 0, -25]),
                    P('cyl', [0, 7, 12, 4], '#ffd23f', [-6, 26, 18]), P('cyl', [0, 7, 12, 4], '#ffd23f', [6, 26, 18]), P('cyl', [2, 10, 26], '#3fbf5f', [0, -4, -26], [70, 0, 0]));
                eyes(30, 14, 4);
                break;
            default: break;
        }
        return this.merge(scene, 'pet-' + kind, parts);
    },

    // --- скин оружия: множитель цвета материалов и свечение; радуга — живой оттенок ---
    applySkin(root, skin, time) {
        if (!root) return;
        const meshes = [root].concat(root.getChildMeshes(false));
        let tint = skin && skin.tint;
        if (tint === 'rainbow') {
            const c = BABYLON.Color3.FromHSV(((time || 0) * 90) % 360, 0.7, 1);
            tint = [c.r * 1.3, c.g * 1.3, c.b * 1.3];
        }
        for (const m of meshes) {
            const mats = m.material ? (m.material.subMaterials || [m.material]) : [];
            for (const mt of mats) {
                if (!mt) continue;
                const md = mt.metadata || (mt.metadata = {});
                if (!md.baseDiffuse) md.baseDiffuse = mt.diffuseColor.clone();
                const b = md.baseDiffuse;
                mt.diffuseColor = tint ? new BABYLON.Color3(b.r * tint[0], b.g * tint[1], b.b * tint[2]) : b.clone();
                const g = (skin && skin.glow) || 0;
                mt.emissiveColor = tint && g ? new BABYLON.Color3(tint[0] * g * 0.5, tint[1] * g * 0.5, tint[2] * g * 0.5) : BABYLON.Color3.Black();
            }
        }
    },

    // Модель GLB -> меш на сцене (промис). Ошибка -> пустой меш (сцена не падает).
    async model(scene, url, name) {
        try {
            const model = await Model3D.load(url);
            return Model3D.build(model, scene, { name: name || 'm' });
        } catch (e) {
            console.warn('GameArt.model:', url, (e && e.message) || e);
            return new BABYLON.Mesh(name || 'missing', scene);
        }
    },

    // --- превью предметов --------------------------------------------------------
    _thumbs: new Map(),
    _queue: Promise.resolve(),
    _eng: null,

    _thumbScene() {
        if (this._eng) return this._eng;
        const cv = document.createElement('canvas');
        cv.width = 256; cv.height = 256;
        const engine = new BABYLON.Engine(cv, true, { preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: true, stencil: false, antialias: true }, false);
        const scene = new BABYLON.Scene(engine);
        scene.useRightHandedSystem = true;
        scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
        const cam = new BABYLON.TargetCamera('tc', new BABYLON.Vector3(0, 0, 10), scene);
        cam.fov = 0.55;
        cam.minZ = 1; cam.maxZ = 20000;
        const hemi = new BABYLON.HemisphericLight('h', new BABYLON.Vector3(0.2, 1, 0.3), scene);
        hemi.intensity = 0.75; hemi.groundColor = new BABYLON.Color3(0.45, 0.45, 0.5); hemi.specular = BABYLON.Color3.Black();
        const sun = new BABYLON.DirectionalLight('d', new BABYLON.Vector3(-0.5, -0.8, -0.6), scene);
        sun.intensity = 0.7;
        this._eng = { cv, engine, scene, cam };
        return this._eng;
    },

    // Превью предмета: Promise<data URL>. Строится один раз, дальше — из кэша.
    thumb(id) {
        if (this._thumbs.has(id)) return this._thumbs.get(id);
        const p = this._queue = this._queue.then(() => this._renderThumb(id)).catch((e) => { console.warn('thumb', id, e); return ''; });
        this._thumbs.set(id, p);
        return p;
    },

    async _renderThumb(id) {
        const T = this._thumbScene(), scene = T.scene;
        const it = GameData.ITEMS[id];
        const roots = [];
        let view = { yaw: -35, pitch: 18 };
        const add = (m) => { roots.push(m); return m; };
        if (id === 'coin') { add(await this.model(scene, M_PROP.coin)); view = { yaw: -20, pitch: 8 }; }
        else if (id === 'heart') { add(await this.model(scene, M_PROP.heart)); view = { yaw: -15, pitch: 5 }; }
        else if (id === 'jewel') { add(await this.model(scene, M_PROP.jewel)); }
        else if (id === 'chest') { add(await this.model(scene, M_PROP.chest)); }
        else if (id.startsWith('gunskin:')) {
            const [, gunId, skinId] = id.split(':');
            const g = add(await this.model(scene, GameData.ITEMS[gunId].model));
            this.applySkin(g, GameData.ITEMS[skinId] || { tint: GameData.ITEMS[gunId].tint });
            view = { yaw: -90, pitch: 12 };
        } else if (!it) return '';
        else if (it.cls) {
            const g = add(await this.model(scene, it.model));
            this.applySkin(g, { tint: it.tint, glow: 0 });
            view = { yaw: -90, pitch: 12 };
        } else if (it.section === 'melee') { add(await this.melee(scene, it)); view = { yaw: -10, pitch: 10, roll: -35 }; }
        else if (it.section === 'heroes') { add(await this.model(scene, it.model)); view = { yaw: -25, pitch: 8 }; }
        else if (it.section === 'hats') {
            if (it.kind === 'none') add(this.prim(scene, 'cyl', [60, 60, 4], '#9aa4ad', [0, 270, 0]));
            else add(this.hat(scene, it.kind));
        } else if (it.section === 'packs') { add(this.pack(scene, it)); view = { yaw: 150, pitch: 15 }; }
        else if (it.section === 'pets') {
            if (it.kind === 'none') add(this.prim(scene, 'cyl', [40, 40, 4], '#9aa4ad'));
            else add(this.pet(scene, it.kind));
            view = { yaw: -25, pitch: 15 };
        } else if (it.section === 'arms') {
            const seg = [];
            for (let i = 0; i < 7; i++) {
                const t = i / 6, x = -60 + t * 120, y = Math.sin(t * Math.PI) * 50;
                seg.push(this.prim(scene, 'sph', [22, 22, 22], i % 2 ? it.color2 : it.color, [x, y, 0], null, it.glow ? { emissive: 0.35 } : null));
            }
            add(this.merge(scene, 'arm', seg));
            add(this.prim(scene, 'box', [34, 14, 26], '#2b2f35', [70, -6, 0]));
            view = { yaw: 0, pitch: 10 };
        } else if (it.section === 'skins') {
            const g = add(await this.model(scene, GameData.ITEMS['pistol-1'].model));
            this.applySkin(g, it, 1.2);
            view = { yaw: -90, pitch: 12 };
        } else if (it.section === 'tracers') {
            const col = it.color === 'rainbow' ? ['#ff4040', '#ffd23f', '#40ff70', '#40a0ff'] : [it.color];
            const parts = [];
            for (let i = 0; i < 3; i++) parts.push(this.prim(scene, 'cyl', [10 * it.size, 10 * it.size, 120, 10], col[i % col.length], [0, (i - 1) * 34, (i - 1) * -20], [0, 0, 90], { unlit: true }));
            add(this.merge(scene, 'tr', parts));
            view = { yaw: 0, pitch: 5 };
        } else if (it.section === 'kills' || it.section === 'trails') {
            const cols = it.colors || ['#9aa4ad'];
            const parts = [];
            let seed = it.index * 97 + 13;
            const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
            const n = it.colors ? 16 : 1;
            for (let i = 0; i < n; i++) {
                const a = R() * Math.PI * 2, r = it.section === 'kills' ? 20 + R() * 55 : 0;
                const x = it.section === 'trails' ? -70 + i * 9 : Math.cos(a) * r, y = it.section === 'trails' ? Math.sin(i * 0.8) * 10 : Math.sin(a) * r;
                const s = it.section === 'trails' ? 10 + i * 1.3 : 12 + R() * 14;
                parts.push(this.prim(scene, it.section === 'kills' && i % 2 ? 'box' : 'sph', [s, s, s], cols[i % cols.length], [x, y, 0], [R() * 90, R() * 90, 0], { emissive: 0.35 }));
            }
            add(this.merge(scene, 'fx', parts));
            view = { yaw: 0, pitch: 5 };
        }
        // Камера по габариту.
        let min = new BABYLON.Vector3(Infinity, Infinity, Infinity), max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
        for (const r of roots) {
            if (view.roll) r.rotation.z = view.roll * Math.PI / 180;
            r.computeWorldMatrix(true);
            const b = r.getHierarchyBoundingVectors(true);
            min = BABYLON.Vector3.Minimize(min, b.min); max = BABYLON.Vector3.Maximize(max, b.max);
        }
        if (!Number.isFinite(min.x)) { min.set(-10, -10, -10); max.set(10, 10, 10); }
        const c = min.add(max).scale(0.5), rad = Math.max(1, BABYLON.Vector3.Distance(min, max) / 2);
        const D = Math.PI / 180, dist = rad / Math.sin(T.cam.fov / 2) * 1.02;
        T.cam.position.set(c.x + Math.sin(view.yaw * D) * Math.cos(view.pitch * D) * dist, c.y + Math.sin(view.pitch * D) * dist, c.z + Math.cos(view.yaw * D) * Math.cos(view.pitch * D) * dist);
        T.cam.setTarget(c);
        scene.activeCamera = T.cam;
        await scene.whenReadyAsync();
        scene.render();
        scene.render();
        const url = T.cv.toDataURL('image/png');
        for (const r of roots) r.dispose(false, false);
        return url;
    },
};
