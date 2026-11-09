// GameWorld.js — мир Backflip Rooftops Survivor: крыши из карты, герой с рюкзаком и мех-руками,
// орда (улица -> стена -> крыша), стрельба, ближний бой, ящики, TNT, сундуки,
// батуты и тарзанки, монеты, эффекты. Логика хранит своё состояние сама (px карты:
// x, y по карте, h — высота); 3D — только представление.
//
// Раскладка уровня — объекты карты (Maps.js, редактор): building (здания-крыши),
// bg-building (фон), jump (батут, курс rot[1] — к соседней крыше), zip (столб
// тарзанки, пара — ближайший столб на другой крыше), crate / box (оружейный и деревянный ящики,
// стопка — один x, y), tnt, chest; маркер spawn — старт героя.

// Числа игры из Constants.js (typeof + дефолт: в редакторе это свойства window).
function smConfig() {
    const U = 'undefined';
    return {
        heroSpeed: typeof SM_HERO_SPEED !== U ? SM_HERO_SPEED : 330,
        heroHp: typeof SM_HERO_HP !== U ? SM_HERO_HP : 100,
        heroScale: typeof SM_HERO_SCALE !== U ? SM_HERO_SCALE : 0.4,
        enemies: typeof SM_MAX_ENEMIES !== U ? SM_MAX_ENEMIES : 150,
        enemiesMobile: typeof SM_MAX_ENEMIES_MOBILE !== U ? SM_MAX_ENEMIES_MOBILE : 80,
        crowd: typeof SM_CROWD !== U ? SM_CROWD : 200,
        crowdMobile: typeof SM_CROWD_MOBILE !== U ? SM_CROWD_MOBILE : 100,
        view: typeof SM_VIEW !== U ? SM_VIEW : 1700,
        fogZoom: typeof SM_FOG_ZOOM !== U ? SM_FOG_ZOOM : 0.6,
        magnet: typeof SM_MAGNET !== U ? SM_MAGNET : 170,
        gravity: typeof SM_GRAVITY !== U ? SM_GRAVITY : 2600,
    };
}

// Шейдер материала собирается при первом показе; если тогда экземпляров ещё не было,
// define INSTANCESCOLOR не включится и цвет экземпляров не дойдёт. Проверка дешёвая.
function ensureInstanceColor(mesh) {
    for (const sm of mesh.subMeshes || []) {
        const d = /** @type {any} */ (sm).materialDefines;
        if (d && !d.INSTANCESCOLOR) {
            const mt = sm.getMaterial();
            if (mt) mt.markAsDirty(BABYLON.Constants.MATERIAL_AttributesDirtyFlag);
        }
    }
}

// Пул thin instances одного меша: матрица 3×3 + перенос, цвет RGBA.
class InstPool {
    constructor(mesh, cap) {
        this.mesh = mesh; this.cap = cap; this.n = 0;
        this.buf = new Float32Array(cap * 16);
        this.col = new Float32Array(cap * 4).fill(1);
        mesh.thinInstanceSetBuffer('matrix', this.buf, 16, false);
        mesh.thinInstanceSetBuffer('color', this.col, 4, false);
        mesh.thinInstanceCount = 0;
        mesh.alwaysSelectAsActiveMesh = true;
        mesh.doNotSyncBoundingInfo = true;
        mesh.isPickable = false;
    }
    begin() { this.n = 0; }
    // Строки матрицы: a (ось X меша), b (ось Y), c (ось Z); t — перенос.
    put(ax, ay, az, bx, by, bz, cx, cy, cz, tx, ty, tz, r, g, b, a) {
        if (this.n >= this.cap) return;
        const o = this.n * 16, B = this.buf;
        B[o] = ax; B[o + 1] = ay; B[o + 2] = az; B[o + 3] = 0;
        B[o + 4] = bx; B[o + 5] = by; B[o + 6] = bz; B[o + 7] = 0;
        B[o + 8] = cx; B[o + 9] = cy; B[o + 10] = cz; B[o + 11] = 0;
        B[o + 12] = tx; B[o + 13] = ty; B[o + 14] = tz; B[o + 15] = 1;
        const c = this.n * 4;
        this.col[c] = r; this.col[c + 1] = g; this.col[c + 2] = b; this.col[c + 3] = a == null ? 1 : a;
        this.n++;
    }
    // Масштаб s (x, y, z) и поворот вокруг вертикали yaw (рад Babylon) в точке карты.
    trs(x, y, h, sx, sy, sz, yaw, r, g, b, a) {
        const c = Math.cos(yaw), s = Math.sin(yaw);
        this.put(c * sx, 0, -s * sx, 0, sy, 0, s * sz, 0, c * sz, x, h, y, r, g, b, a);
    }
    // Вытянутый вдоль направления (fx, fh, fy) бокс длиной len и толщиной w.
    axis(x, y, h, fx, fy, fh, len, w, r, g, b, a) {
        const L = Math.hypot(fx, fy, fh) || 1;
        const X = fx / L, Y = fh / L, Z = fy / L;
        let ux = 0, uy = 1, uz = 0;
        if (Math.abs(Y) > 0.95) { ux = 1; uy = 0; }
        // right = f × up, up' = right × f
        let rx = Y * uz - Z * uy, ry = Z * ux - X * uz, rz = X * uy - Y * ux;
        const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
        const vx = ry * Z - rz * Y, vy = rz * X - rx * Z, vz = rx * Y - ry * X;
        this.put(X * len, Y * len, Z * len, vx * w, vy * w, vz * w, rx * w, ry * w, rz * w, x, h, y, r, g, b, a);
    }
    end() {
        this.mesh.thinInstanceCount = this.n;
        this.mesh.thinInstanceBufferUpdated('matrix');
        this.mesh.thinInstanceBufferUpdated('instanceColor');   // setBuffer('color') хранится как instanceColor
        this.mesh.setEnabled(this.n > 0);
        if (this.n > 0) ensureInstanceColor(this.mesh);
    }
}

const HEX = (h) => { const c = BABYLON.Color3.FromHexString(h); return [c.r, c.g, c.b]; };

/** @satisfies {Record<string, any>} */
const GameWorld = {
    /** @type {LoryApp | null} */
    app: null,
    scene: null, view: null,
    mode: 'none',          // 'menu' | 'play' | 'win' | 'lose'
    frozen: false,         // рюкзак открыт: мир стоит, звук интерфейса работает
    time: 0,
    lvl: null,
    roofs: [], obstacles: [], solids: [], blocks: [], tnts: [], chests: [], jumps: [], zips: [],
    mons: [], crowd: [], bullets: [], coins: [], gibs: [], decals: [], flashes: [], pickups: [], rings: [], texts: [],
    mines: [], stickies: [], fires: [], nukes: [], impacts: [], streaks: [], bolts: [], delayed: [], sprs: [],
    diff: null,            // сложность уровня (GameData.difficulty), выбор на оверлее
    showcase: false,       // магазин скинов: камера ближе, герой крутится
    previewHero: null,     // примерка скина (id) без покупки
    tutHold: false,        // обучение: волны не идут, зомби выпускает GameTutorial
    tutSafe: false,        // обучение: герой не падает ниже половины здоровья
    tutDrop: null,         // обучение: что выпадет из следующего оружейного ящика
    bag: [], guns: [], hero: null, pet: null,
    kills: 0, levelCoins: 0, bossSpawned: false, boss: null, revived: false,
    K: smConfig(), hitStop: 0, spawnT: 0, grid: new Map(), _soundAt: {}, _ready: false, _levelMeshes: [],
    ui: null,              // GameUI: hud, openBag, win, lose, toast, label
    GUN_YAW: 0,            // свои стволы (tools/gen-props.mjs) смотрят в +Z

    // --- подготовка сцены (раз на страницу) ---------------------------------------
    async init(app) {
        this.app = app;
        this.K = smConfig();
        this.view = app.location.view;
        this.scene = this.view.scene;
        const scene = this.scene;
        const mobile = IS_MOBILE;
        const unlit = (name, add) => {
            const m = new BABYLON.StandardMaterial(name, scene);
            m.disableLighting = true; m.emissiveColor = BABYLON.Color3.White(); m.diffuseColor = BABYLON.Color3.White();
            m.specularColor = BABYLON.Color3.Black();
            if (add) { m.alpha = 0.99; m.alphaMode = BABYLON.Constants.ALPHA_ADD; m.disableDepthWrite = true; }
            m.metadata = { toon: false };
            return m;
        };
        const lit = (name) => {
            const m = new BABYLON.StandardMaterial(name, scene);
            m.diffuseColor = BABYLON.Color3.White(); m.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
            return m;
        };
        // Пули-трассеры.
        const tr = BABYLON.MeshBuilder.CreateBox('tracers', { size: 1 }, scene);
        tr.material = unlit('tracer-mat', true);
        this.poolTracer = new InstPool(tr, 700);
        // Прозрачные эффекты — в слое OVERLAY (глубина общая с миром): обводка силуэта
        // (HighlightLayer слоя WORLD) не считает их заслонкой — иначе ствол внутри
        // сияния или монстр во вспышке взрыва заливались чёрным.
        tr.renderingGroupId = World3D.LAYER.OVERLAY;
        // Вспышки выстрелов, искры, кольца — светящиеся сферы.
        const fl = BABYLON.MeshBuilder.CreateSphere('flashes', { diameter: 1, segments: 6 }, scene);
        fl.material = unlit('flash-mat', true);
        this.poolFlash = new InstPool(fl, 400);
        fl.renderingGroupId = World3D.LAYER.OVERLAY;
        // Ошмётки / конфетти / монетки эффектов — кубики со светом.
        const gb = BABYLON.MeshBuilder.CreateBox('gibs', { size: 1 }, scene);
        gb.material = lit('gib-mat');
        World3D.addObject(this.view, gb, 'prop', { ink: false, outline: false, castShadow: false });
        this.poolGib = new InstPool(gb, mobile ? 700 : 1400);
        // Пятна крови на крыше.
        const dc = BABYLON.MeshBuilder.CreateGround('decals', { width: 1, height: 1 }, scene);
        const dm = unlit('decal-mat', false);
        const tex = new BABYLON.Texture('assets/sprites/blood-splat05.png', scene);
        tex.hasAlpha = true;
        dm.diffuseTexture = tex; dm.useAlphaFromDiffuseTexture = true; dm.zOffset = -2; dm.disableDepthWrite = true;
        dm.emissiveColor = BABYLON.Color3.White();
        dc.material = dm;
        this.poolDecal = new InstPool(dc, 160);
        // Пятна из assets/fx (ImageGen): синяя кровь (3 формы), слизь, трещины от приземления.
        const decalPool = (name, url, cap, alpha) => {
            const g = BABYLON.MeshBuilder.CreateGround(name, { width: 1, height: 1 }, scene);
            const m = unlit(name + '-mat', false), tx = new BABYLON.Texture(url, scene);
            tx.hasAlpha = true;
            m.diffuseTexture = tx; m.useAlphaFromDiffuseTexture = true; m.zOffset = -2; m.disableDepthWrite = true;
            if (alpha) { m.alpha = 0.999; g.hasVertexAlpha = true; }
            g.material = m;
            return new InstPool(g, cap);
        };
        this.decalPools = {
            gen: this.poolDecal,
            b1: decalPool('blood-b1', 'assets/fx/blood-blue-1.png', 60), b2: decalPool('blood-b2', 'assets/fx/blood-blue-2.png', 60), b3: decalPool('blood-b3', 'assets/fx/blood-blue-3.png', 60),
            slime: decalPool('slime', 'assets/fx/slime-splat.png', 60),
            crack: decalPool('cracks', 'assets/fx/crack.png', 16, true),
        };
        // Спрайты эффектов (assets/fx): к камере, на земле или вдоль направления.
        const sprite = (name, url, cap, add) => {
            const pl = BABYLON.MeshBuilder.CreatePlane(name, { size: 1 }, scene);
            const m = unlit(name + '-mat', false), tx = new BABYLON.Texture(url, scene);
            tx.hasAlpha = true;
            m.diffuseTexture = tx; m.useAlphaFromDiffuseTexture = true; m.backFaceCulling = false; m.disableDepthWrite = true; m.alpha = 0.999;
            if (add) m.alphaMode = BABYLON.Constants.ALPHA_ADD;
            pl.material = m; pl.hasVertexAlpha = true; pl.renderingGroupId = World3D.LAYER.OVERLAY;
            return new InstPool(pl, cap);
        };
        this.spr = {
            muzzle: sprite('spr-muzzle', 'assets/fx/muzzle-front.png', 90, true),
            flame: sprite('spr-flame', 'assets/fx/muzzle-side.png', 90, true),
            spark: sprite('spr-spark', 'assets/fx/spark.png', 140, true),
            glow: sprite('spr-glow', 'assets/fx/glow.png', 60, true),
            plasma: sprite('spr-plasma', 'assets/fx/plasma-orb.png', 50, true),
            fireball: sprite('spr-fireball', 'assets/fx/fireball.png', 90, true),
            heal: sprite('spr-heal', 'assets/fx/heal-plus.png', 30, true),
            coin: sprite('spr-coin', 'assets/fx/coin-sparkle.png', 50, true),
            ice: sprite('spr-ice', 'assets/fx/ice-burst.png', 20, true),
            streak: sprite('spr-streak', 'assets/fx/spark-streak.png', 60, true),
            ring: sprite('spr-ring', 'assets/fx/shockwave-ring.png', 40, true),
        };
        // Звезда удара ближнего боя: комиксовая зубчатая вспышка к камере.
        const im = BABYLON.MeshBuilder.CreatePlane('impacts', { size: 1 }, scene);
        const imm = unlit('impact-mat', false), itex = new BABYLON.DynamicTexture('impact-tex', 256, scene, true);
        {
            const g = itex.getContext(), N = 11;
            g.clearRect(0, 0, 256, 256);
            const star = (R0, R1, seed) => { g.beginPath(); for (let i = 0; i < N * 2; i++) { const a = i / (N * 2) * Math.PI * 2 + 0.2, r = i % 2 ? R0 : R1 * (0.72 + 0.28 * Math.abs(Math.sin(i * 2.3 + seed))); g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.closePath(); };
            star(52, 124, 1); g.fillStyle = '#ff7a1a'; g.fill();
            star(40, 100, 1); const gr = g.createRadialGradient(128, 128, 8, 128, 128, 100); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#fff6c0'); gr.addColorStop(1, '#ffd23a'); g.fillStyle = gr; g.fill();
            star(18, 46, 3); g.fillStyle = '#ffffff'; g.fill();
            itex.hasAlpha = true; itex.update();
        }
        imm.diffuseTexture = itex; imm.useAlphaFromDiffuseTexture = true; imm.backFaceCulling = false; imm.disableDepthWrite = true; imm.alpha = 0.999;
        im.material = imm; im.hasVertexAlpha = true; im.renderingGroupId = World3D.LAYER.OVERLAY;
        this.poolImpact = new InstPool(im, 40);
        // Гарь от взрывов: мягкое полупрозрачное пятно (не форма брызг).
        const sc = BABYLON.MeshBuilder.CreateGround('scorches', { width: 1, height: 1 }, scene);
        const scm = unlit('scorch-mat', false), stex = new BABYLON.Texture('assets/fx/scorch.png', scene);
        stex.hasAlpha = true;
        scm.diffuseTexture = stex; scm.useAlphaFromDiffuseTexture = true; scm.zOffset = -1; scm.disableDepthWrite = true; scm.alpha = 0.999;
        sc.material = scm; sc.hasVertexAlpha = true;   // альфа из цвета экземпляра
        this.poolScorch = new InstPool(sc, 40);
        // Сегменты мех-рук.
        const seg = BABYLON.MeshBuilder.CreateSphere('armseg', { diameter: 1, segments: 8 }, scene);
        seg.material = lit('arm-mat');
        World3D.addObject(this.view, seg, 'actor', { ink: false, outline: false });
        this.poolArm = new InstPool(seg, 120);
        // Монеты и сердечки — модели Kenney с thin instances.
        try {
            this.kindCoin = new CrowdKind(scene, this.view, await Model3D.load(M_PROP.coin), mobile ? 160 : 260, 'coins');
            this.kindHeart = new CrowdKind(scene, this.view, await Model3D.load(M_PROP.heart), 24, 'hearts');
        } catch (e) { console.warn('coins', e); }
        // Шлейф удара: сектор 250°, голова — к +Z (оружие), хвост прозрачный.
        const inner = [], outer = [], cols = [], N = 36, SW = 250 * Math.PI / 180;
        for (let i = 0; i <= N; i++) {
            const a = -SW * (1 - i / N);
            inner.push(new BABYLON.Vector3(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3));
            outer.push(new BABYLON.Vector3(Math.sin(a) * 1, 0.02, Math.cos(a) * 1));
        }
        this.slash = BABYLON.MeshBuilder.CreateRibbon('slash', { pathArray: [inner, outer], sideOrientation: BABYLON.Mesh.DOUBLESIDE, updatable: false }, scene);
        for (let p = 0; p < 2; p++) for (let i = 0; i <= N; i++) { const k = i / N; cols.push(1, 1, 1, Math.pow(k, 1.6) * (p ? 0.95 : 0.35)); }
        this.slash.setVerticesData(BABYLON.VertexBuffer.ColorKind, cols);
        this.slash.hasVertexAlpha = true;
        const sm = unlit('slash-mat', false);
        sm.alpha = 0.999; sm.backFaceCulling = false; sm.disableDepthWrite = true;
        this.slash.material = sm;
        this.slash.isPickable = false;
        this.slash.setEnabled(false);
        this.slash.renderingGroupId = World3D.LAYER.OVERLAY;

        await GameCrowd.init(scene, this.view, mobile ? 90 : 160);
        this.kindProj = {};
        for (const [key, url] of [['rocket', M_PROP.rocket], ['grenade', M_PROP.grenade], ['mine', M_PROP.mine], ['bomblet', M_PROP.bomblet], ['sticky', M_PROP.sticky]]) {
            try { this.kindProj[key] = new CrowdKind(scene, this.view, await Model3D.load(url), 80, 'proj-' + key); } catch (e) { console.warn('proj', key, e); }
        }
        // Взрыв: флипбук assets/fx/explosion-sheet (огонь -> дым, обычное смешивание — дым тёмный) + искры.
        const boomSheet = (s0, s1, life) => ({ burst: 1, capacity: 1, life: [life, life], size: [s0, s1], speed: [0, 0], color: '#ffffff', blend: 'standard', texture: 'assets/fx/explosion-sheet.png', sheet: { width: 256, height: 256, start: 0, end: 15, speed: 1 } });
        const boomSparks = (n, sp) => ({ burst: n, capacity: n + 4, life: [.25, .7], size: [16, 40], speed: [sp * 0.3, sp], color: '#ffc05a', gravity: [0, -300, 0], texture: 'assets/fx/spark.png' });
        app.fx.register('boom-s', [boomSheet(190, 240, 0.6), boomSparks(18, 360)]);
        app.fx.register('boom', [boomSheet(330, 400, 0.75), boomSparks(34, 480)]);
        app.fx.register('boom-l', [boomSheet(560, 660, 0.9), boomSparks(60, 620),
            { delay: .25, burst: 8, capacity: 8, life: [1.4, 2.2], size: [180, 280], speed: [30, 90], direction: [[-.5, .4, -.5], [.5, 1, .5]], color: '#9a9496', blend: 'standard', texture: 'assets/fx/smoke-puff.png', gravity: [0, 50, 0], sizeGradient: [[0, .5], [1, 1.6]] }]);
        app.fx.register('ice', [
            { burst: 1, capacity: 1, life: [.45, .45], size: [220, 240], speed: [0, 0], color: '#ffffff', texture: 'assets/fx/ice-burst.png', sizeGradient: [[0, .4], [.3, 1.1], [1, 1.3]] },
            { burst: 16, capacity: 16, life: [.5, 1], size: [26, 48], speed: [220, 520], direction: [[-1, .3, -1], [1, 1, 1]], color: '#ffffff', blend: 'standard', texture: 'assets/fx/ice-shard.png', gravity: [0, -900, 0], spin: [-6, 6] },
        ]);
        app.fx.register('slime', [
            { burst: 1, capacity: 1, life: [.5, .5], size: [260, 300], speed: [0, 0], color: '#ffffff', blend: 'standard', texture: 'assets/fx/slime-burst.png', sizeGradient: [[0, .4], [.25, 1], [1, 1.2]], colorGradient: [[0, '#ffffff', 1], [.7, '#ffffff', 1], [1, '#ffffff', 0]] },
        ]);
        app.fx.register('zap', [{ burst: 1, capacity: 1, life: [.35, .35], size: [120, 150], speed: [0, 0], color: '#ffffff', texture: 'assets/fx/electric-sheet.png', sheet: { width: 256, height: 256, start: 0, end: 15, speed: 1 } }]);
        app.fx.register('blood', [{ burst: 10, capacity: 10, life: [.4, .8], size: [16, 30], speed: [200, 480], direction: [[-1, .4, -1], [1, 1.2, 1]], color: '#ffffff', blend: 'standard', texture: 'assets/fx/blood-drop.png', gravity: [0, -1400, 0] }]);
        app.fx.register('heal', [{ burst: 6, capacity: 6, life: [.6, 1], size: [26, 44], speed: [60, 140], direction: [[-.4, 1, -.4], [.4, 1, .4]], box: [[-40, 0, -40], [40, 60, 40]], color: '#ffffff', texture: 'assets/fx/heal-plus.png', colorGradient: [[0, '#ffffff', 1], [1, '#ffffff', 0]] }]);
        // Мини-ядерка: огненный шар (флипбук взрыва крупно), столб дыма, огненная шапка,
        // которая темнеет в дым, клубы по краю шапки и искры. Готовой картинки гриба нет —
        // гриб собирается из частиц и живёт в объёме.
        const sheet = { width: 256, height: 256, start: 0, end: 15, speed: 1 };
        app.fx.register('nuke', [
            { burst: 1, capacity: 1, life: [1.3, 1.3], size: [900, 1000], speed: [0, 0], offset: [0, 240, 0], color: '#ffffff', blend: 'standard', texture: 'assets/fx/explosion-sheet.png', sheet },
            // Огненный столб вверх: 0.5 с целиком (испускание 0.15 с + частица до 0.35 с).
            { rate: 80, duration: .15, capacity: 14, life: [.25, .35], size: [240, 340], speed: [1300, 1600], direction: [[-.06, 1, -.06], [.06, 1, .06]], box: [[-40, 0, -40], [40, 40, 40]], color: '#ffffff', blend: 'standard', texture: 'assets/fx/explosion-sheet.png', sheet },
            { delay: .3, burst: 7, capacity: 7, life: [1.3, 1.7], size: [340, 460], speed: [110, 240], direction: [[-1, -.05, -1], [1, .35, 1]], offset: [0, 620, 0], color: '#ffffff', blend: 'standard', texture: 'assets/fx/explosion-sheet.png', sheet },
            { delay: .75, burst: 14, capacity: 14, life: [1.8, 2.8], size: [260, 400], speed: [160, 320], direction: [[-1, -.05, -1], [1, .25, 1]], offset: [0, 680, 0], color: '#ffffff', blend: 'standard', texture: 'assets/fx/smoke-puff.png', gravity: [0, 20, 0], sizeGradient: [[0, .5], [1, 1.5]], colorGradient: [[0, '#b8a8a0', 0.9], [1, '#6e6360', 0]] },
            { burst: 110, capacity: 120, life: [.5, 1.4], size: [14, 34], speed: [500, 1300], color: '#ffd27a', gravity: [0, -900, 0], texture: 'assets/fx/spark.png' },
        ]);        app.fx.register('muzzle-smoke', [{ burst: 3, capacity: 4, life: [.2, .45], size: [18, 30], speed: [10, 40], color: '#e0e0e0', blend: 'standard', texture: 'assets/fx/smoke-puff.png', sizeGradient: [[0, .5], [1, 1.4]] }]);
        app.fx.register('sparkle', [{ burst: 22, capacity: 24, life: [.4, .9], size: [22, 44], speed: [60, 220], color: '#ffffff', texture: 'assets/fx/coin-sparkle.png', gravity: [0, -150, 0], spin: [-3, 3] }]);
        app.fx.register('dust', [{ burst: 16, capacity: 18, life: [.4, .9], size: [44, 80], speed: [150, 320], direction: [[-1, 0, -1], [1, .3, 1]], color: '#ffffff', blend: 'standard', texture: 'assets/fx/dust-puff.png', sizeGradient: [[0, .6], [1, 1.5]], colorGradient: [[0, '#ffffff', .9], [1, '#ffffff', 0]] }]);
        // Пожары карты (маркеры 'fire'): одна система огня, одна дыма и одна искр на все
        // очаги — частица рождается в случайном очаге рядом с героем (вес — размер очага).
        this.mapFires = []; this._fireNear = []; this._fireW = 0; this._fireT = 0;
        const firePS = (name, cap, tex, add, yOff, spread, sheet) => {
            const ps = new BABYLON.ParticleSystem(name, cap, scene, null, !!sheet);
            if (sheet) {
                ps.spriteCellWidth = 256; ps.spriteCellHeight = 256; ps.startSpriteCellID = 0; ps.endSpriteCellID = 15;
                ps.spriteCellLoop = true; ps.spriteRandomStartCell = true; ps.spriteCellChangeSpeed = 1.6;
            }
            // Частицы Babylon читают текстуру без переворота по V (как ParticleFX): иначе пламя,
            // кадры листа и клубы дыма вверх ногами.
            ps.particleTexture = new BABYLON.Texture(tex, scene, false, false);
            ps.emitter = BABYLON.Vector3.Zero();
            ps.blendMode = add ? BABYLON.ParticleSystem.BLENDMODE_ADD : BABYLON.ParticleSystem.BLENDMODE_STANDARD;
            ps.startPositionFunction = (wm, pos) => {
                const f = this.pickFire();
                if (!f) { pos.set(0, -99999, 0); return; }
                const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread * f.s;
                pos.set(f.x + Math.cos(a) * r, f.h + yOff * f.s + Math.random() * 14, f.y + Math.sin(a) * r);
            };
            ps.emitRate = 0;
            ps.start();
            return ps;
        };
        const fire = firePS('map-fire', mobile ? 120 : 220, 'assets/fx/fire-sheet.png', true, 30, 40, true);
        fire.minLifeTime = 0.55; fire.maxLifeTime = 0.9; fire.minSize = 90; fire.maxSize = 150;
        fire.direction1 = new BABYLON.Vector3(-0.1, 1, -0.1); fire.direction2 = new BABYLON.Vector3(0.1, 1, 0.1);
        fire.minEmitPower = 20; fire.maxEmitPower = 60; fire.gravity = new BABYLON.Vector3(0, 30, 0);
        fire.addColorGradient(0, new BABYLON.Color4(1, 1, 1, 0));
        fire.addColorGradient(0.15, new BABYLON.Color4(1, 1, 1, 1));
        fire.addColorGradient(0.75, new BABYLON.Color4(1, 0.9, 0.8, 0.85));
        fire.addColorGradient(1, new BABYLON.Color4(1, 0.6, 0.4, 0));
        for (const [k, s] of [[0, 0.7], [0.3, 1], [1, 0.8]]) fire.addSizeGradient(k, s * fire.minSize, s * fire.maxSize);
        const smoke = firePS('map-smoke', mobile ? 200 : 380, 'assets/fx/smoke-puff.png', false, 110, 55);
        smoke.minLifeTime = 2.4; smoke.maxLifeTime = 3.8; smoke.minSize = 110; smoke.maxSize = 230;
        smoke.direction1 = new BABYLON.Vector3(-0.12, 1, -0.12); smoke.direction2 = new BABYLON.Vector3(0.4, 1, 0.18);
        smoke.minEmitPower = 55; smoke.maxEmitPower = 115; smoke.gravity = new BABYLON.Vector3(12, 22, 0);
        smoke.minAngularSpeed = -0.4; smoke.maxAngularSpeed = 0.4; smoke.maxInitialRotation = Math.PI * 2;
        smoke.addColorGradient(0, new BABYLON.Color4(0.16, 0.14, 0.13, 0));
        smoke.addColorGradient(0.12, new BABYLON.Color4(0.18, 0.16, 0.15, 0.62));
        smoke.addColorGradient(0.6, new BABYLON.Color4(0.3, 0.28, 0.27, 0.38));
        smoke.addColorGradient(1, new BABYLON.Color4(0.42, 0.4, 0.4, 0));
        for (const [k, s] of [[0, 0.45], [1, 2.1]]) smoke.addSizeGradient(k, s * smoke.minSize, s * smoke.maxSize);
        const embers = firePS('map-embers', mobile ? 70 : 140, 'assets/fx/spark.png', true, 40, 50);
        embers.minLifeTime = 0.9; embers.maxLifeTime = 1.8; embers.minSize = 7; embers.maxSize = 15;
        embers.direction1 = new BABYLON.Vector3(-0.6, 1, -0.6); embers.direction2 = new BABYLON.Vector3(0.6, 1, 0.6);
        embers.minEmitPower = 90; embers.maxEmitPower = 230; embers.gravity = new BABYLON.Vector3(20, 40, 0);
        embers.color1 = new BABYLON.Color4(1, 0.75, 0.3, 1); embers.color2 = new BABYLON.Color4(1, 0.45, 0.1, 1); embers.colorDead = new BABYLON.Color4(0.4, 0.05, 0, 0);
        this.firePS = [[fire, 9], [smoke, 7], [embers, 4]];
        Pause.onChange(() => this.syncFires());
        this.cam = { x: 0, y: 0, h: 0 };
        this._ready = true;
    },

    // Очаг для новой частицы: случайный из ближних, вес — размер.
    pickFire() {
        const near = this._fireNear;
        if (!near.length) return null;
        let k = Math.random() * this._fireW;
        for (const f of near) { k -= f.s; if (k <= 0) return f; }
        return near[near.length - 1];
    },

    // Какие очаги рядом (раз в 0.3 с), темп частиц — по сумме размеров, пауза — стоп.
    updateMapFires(dt) {
        this._fireT -= dt;
        if (this._fireT <= 0 && this.hero) {
            this._fireT = 0.3;
            const H = this.hero, R = IS_MOBILE ? 2200 : 2800;
            this._fireNear = this.mapFires.filter(f => Math.abs(f.x - H.x) < R && Math.abs(f.y - H.y) < R * 0.9).slice(0, 12)
                .concat(this.fires.slice(-8).map(z => ({ x: z.x, y: z.y, h: z.h - 20, s: Math.min(4, z.r / 55) })));
            this._fireW = this._fireNear.reduce((a, f) => a + f.s, 0);
        }
        this.syncFires();
    },
    syncFires() {
        if (!this.firePS) return;
        const on = !Pause.active && !this.frozen;
        for (const [ps, rate] of this.firePS) { ps.updateSpeed = on ? 0.01 : 0; ps.emitRate = on ? rate * this._fireW : 0; }
    },

    cfgCaps() {
        return {
            enemies: IS_MOBILE ? this.K.enemiesMobile : this.K.enemies,
            crowd: IS_MOBILE ? this.K.crowdMobile : this.K.crowd,
        };
    },

    // --- уровень ---------------------------------------------------------------------
    // Разобрать карту: крыши, препятствия, объекты уровня.
    parseMap() {
        const loc = this.app.location;
        this.roofs = []; this.obstacles = []; this.blocks = []; this.tnts = []; this.chests = []; this.jumps = []; this.zips = []; this.solids = [];
        const base = (n) => String(n || '').replace(/-\d+$/, '');
        for (const rec of loc.objects) {
            const d = rec.def, name = base(d.name);
            const s = Array.isArray(d.scale) ? d.scale : [d.scale || 1, d.scale || 1, d.scale || 1];
            const rot = Array.isArray(d.rot) ? d.rot : [0, d.rot || 0, 0];
            const x = Number(d.x) || 0, y = Number(d.y) || 0, h = Number(d.h) || 0;
            const b = GameData.BUILDINGS[d.model];
            if (b) {
                const turned = Math.round(((rot[1] % 180) + 180) % 180) === 90;
                const w = (turned ? b.d : b.w) * (turned ? s[2] : s[0]), dd = (turned ? b.w : b.d) * (turned ? s[0] : s[2]);
                const r = {
                    i: 0, bg: !!b.bg || name === 'bg-building', x, y, w, d: dd, h: h + b.h * s[1],
                    x0: x - w / 2 - 30, x1: x + w / 2 + 30, y0: y - dd / 2 - 30, y1: y + dd / 2 + 30,
                    wx0: x - w / 2 + 70, wx1: x + w / 2 - 70, wy0: y - dd / 2 + 70, wy1: y + dd / 2 - 70,
                };
                this.obstacles.push(r);
                if (!r.bg) { r.i = this.roofs.length; this.roofs.push(r); }
                continue;
            }
            const solidR = CITY_DATA.solids[d.model];
            if (solidR) { this.solids.push({ x, y, r: solidR * Math.max(s[0], s[2]), roof: -1 }); continue; }
            if (name === 'crate' || name === 'box') this.blocks.push({ rec, kind: name, x, y, h, h0: h, size: 100 * s[1], hp: name === 'crate' ? 3 : 2, bump: 0, alive: true });
            else if (name === 'tnt') this.tnts.push({ rec, x, y, h, hp: 26, alive: true, bump: 0 });
            else if (name === 'chest') this.chests.push({ rec, x, y, h, open: false, t: 0 });
            else if (name === 'jump') this.jumps.push({ rec, x, y, h, heading: (Number(rot[1]) || 0) * Math.PI / 180, target: -1, squash: 0 });
            else if (name === 'zip') this.zips.push({ rec, x, y, h, pair: null });
        }
        for (const list of [this.blocks, this.tnts, this.chests, this.jumps, this.zips, this.solids]) for (const o of list) o.roof = this.roofAt(o.x, o.y);
        this.solids = this.solids.filter(o => o.roof >= 0);
        // Батут: цель — крыша по курсу (±40°), иначе ближайшая другая.
        for (const j of this.jumps) {
            let best = -1, bestD = Infinity;
            for (const r of this.roofs) {
                if (r.i === j.roof) continue;
                const dx = r.x - j.x, dy = r.y - j.y, d = Math.hypot(dx, dy);
                let da = Math.abs(Math.atan2(dy, dx) - j.heading); if (da > Math.PI) da = 2 * Math.PI - da;
                const score = d * (da < 0.7 ? 1 : 4);
                if (score < bestD) { bestD = score; best = r.i; }
            }
            j.target = best;
        }
        // Тарзанка: пара — ближайший столб на другой крыше.
        for (const z of this.zips) {
            if (z.pair) continue;
            let best = null, bd = Infinity;
            for (const o of this.zips) if (o !== z && !o.pair && o.roof !== z.roof) { const d = Math.hypot(o.x - z.x, o.y - z.y); if (d < bd) { bd = d; best = o; } }
            if (best) { z.pair = best; best.pair = z; }
        }
        // Стопки ящиков: какие ящики стоят на каком.
        this.blocks.sort((a, b) => a.h - b.h);
    },

    // Статичные объекты карты: матрицы заморожены; улица, фон и ориентиры — без теней
    // (они далеко ниже кадра теней, а список кастеров обходится каждый кадр).
    optimizeStatic() {
        const still = ['building', 'bg-building', 'street', 'landmark', 'roofprop', 'deco', 'zip'], noShadow = ['bg-building', 'street', 'landmark', 'deco'];
        for (const rec of this.app.location.objects) {
            const m = rec.mesh;
            if (!m) continue;
            const n = String(rec.def.name || '').replace(/-\d+$/, '');
            if (!still.includes(n)) continue;
            m.computeWorldMatrix(true);
            m.freezeWorldMatrix();
            for (const c of m.getChildMeshes(false)) { c.computeWorldMatrix(true); c.freezeWorldMatrix(); }
            if (noShadow.includes(n)) this.view.removeShadowCaster(m);
        }
    },

    roofAt(x, y) {
        for (const r of this.roofs) if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return r.i;
        return -1;
    },
    groundAt(x, y) {
        for (const r of this.obstacles) if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return r.h;
        return 0;
    },
    insideAny(x, y, pad) {
        for (const r of this.obstacles) if (x >= r.x0 - pad && x <= r.x1 + pad && y >= r.y0 - pad && y <= r.y1 + pad) return true;
        return false;
    },

    // Свет и небо темы уровня.
    applyTheme(i) {
        const t = GameData.THEMES[i % GameData.THEMES.length];
        const c = World3D.cfg();
        c.sky = t.sky; c.fog = t.fog; c.sunColor = t.sun; c.sunIntensity = t.sunI; c.skyLight = t.hemi; c.skyIntensity = t.hemiI;
        c.groundLight = t.ground; c.shadowColor = t.shadow; c.sunEl = t.el;
        this.view.opts = {};
        this.view.applyLighting(c);
        this.fogBase = t.fog;
    },
    fogBase: 0,

    clearLevel() {
        for (const m of this._levelMeshes) { try { m.dispose(false, false); } catch (e) { /* уже снят */ } }
        this._levelMeshes = [];
        this.disposeHero();
        for (const p of this.pickups) this.disposePickup(p);
        this.mons = []; this.crowd = []; this.bullets = []; this.coins = []; this.gibs = []; this.decals = []; this.flashes = [];
        this.pickups = []; this.rings = []; this.guns = []; this.boss = null; this.mines = []; this.stickies = []; this.fires = []; this.nukes = []; this.impacts = []; this.streaks = []; this.bolts = []; this.delayed = []; this.sprs = [];
        this.mapFires = []; this._fireNear = []; this._fireW = 0; this._fireT = 0;
        if (this.ui) this.ui.clearLabels();
    },

    // Подготовить уровень n (или меню, если menu). Зовётся из prepare загрузки карты.
    async buildLevel(n, menu) {
        this.clearLevel();
        this.lvl = GameData.level(n);
        this.mode = menu ? 'menu' : 'ready';   // ready — оверлей сложности, мир стоит
        // Витрина и примерка скинов — только в меню (уровень всегда с надетым скином, камера обычная).
        if (!menu) { this.showcase = false; this.previewHero = null; }
        this.frozen = false;
        this.diff = GameData.difficulty('normal');
        this.parseMap();
        this.optimizeStatic();
        this.mapFires = this.app.location.markers('fire').map(d => ({ x: Number(d.x) || 0, y: Number(d.y) || 0, h: Number(d.h) || 0, s: Array.isArray(d.scale) ? Number(d.scale[0]) || 1 : Number(d.scale) || 1 }));
        this.applyTheme(this.lvl.theme);
        await GameCrowd.preload(this.lvl.models);
        this.crowdTypes = this.lvl.roster.filter(id => !GameData.ENEMIES[id].fly);
        this.kills = 0; this.levelCoins = 0; this.bossSpawned = false; this.revived = false; this.spawnT = 0; this.time = 0;
        const sp = this.app.location.marker('spawn') || { x: this.roofs[0] ? this.roofs[0].x : 3500, y: this.roofs[0] ? this.roofs[0].y : 3500 };
        const roof = this.roofAt(sp.x, sp.y);
        await this.buildHero(sp.x, sp.y, roof >= 0 ? this.roofs[roof].h : 0, roof);
        // Рюкзак: стартовый ствол + прокачка «оружие на старте».
        this.bag = new Array(9).fill(null);
        this.bag[4] = { id: GameState.equipped('gun'), tier: 0 };
        const extra = GameState.upLevel('start');
        const slots = [1, 3, 5];
        for (let i = 0; i < extra; i++) this.bag[slots[i]] = { id: GameData.randomWeapon(GameState.s.owned), tier: 0 };
        await this.rebuildGuns();
        this.buildRopes();
        this.seedCrowd(true);
        this.app.camera.follow(this.cam);
        this.cam.x = this.hero.x; this.cam.y = this.hero.y; this.cam.h = this.hero.h;
        this.fitCamera(true);
    },

    // Событие для обучения (удар, ящик, рюкзак, прыжок…).
    emit(ev) { if (typeof GameTutorial !== 'undefined' && GameTutorial.active) GameTutorial.event(ev); },

    // Старт уровня после выбора сложности.
    startPlay(diffId) {
        this.diff = GameData.difficulty(diffId);
        this.mode = 'play';
        this.spawnT = 0;
    },

    buildRopes() {
        const scene = this.scene;
        const done = new Set();
        for (const z of this.zips) {
            if (!z.pair || done.has(z)) continue;
            done.add(z); done.add(z.pair);
            const a = new BABYLON.Vector3(z.x, z.h + 205, z.y), b = new BABYLON.Vector3(z.pair.x, z.pair.h + 205, z.pair.y);
            const rope = BABYLON.MeshBuilder.CreateTube('rope', { path: [a, BABYLON.Vector3.Lerp(a, b, 0.5).add(new BABYLON.Vector3(0, -40, 0)), b], radius: 5, tessellation: 8 }, scene);
            rope.material = GameArt.mat(scene, '#ff8a1f', { emissive: 0.15 });
            World3D.addObject(this.view, rope, 'prop', { ink: false, outline: false });
            this._levelMeshes.push(rope);
        }
    },

    // --- герой ---------------------------------------------------------------------
    disposeHero() {
        const h = this.hero;
        if (h && h.root) { World3D.removeObject(this.view, h.root); }
        for (const g of this.guns) if (g.mesh) World3D.removeObject(this.view, g.mesh);
        if (this.pet && this.pet.mesh) World3D.removeObject(this.view, this.pet.mesh);
        this.hero = null; this.pet = null; this.guns = [];
    },

    async buildHero(x, y, h, roof) {
        const scene = this.scene;
        const heroItem = GameData.ITEMS[this.previewHero || GameState.equipped('heroes')] || GameData.ITEMS['hero-a'];
        const root = await GameArt.model(scene, heroItem.model, 'hero');
        const S = this.K.heroScale;
        root.scaling.set(S, S, S);
        const parts = {};
        for (const m of root.getChildMeshes(false)) {
            const md = m.metadata || {};
            const role = CrowdKind.role(md.part || m.name);
            parts[role] = m;
            if (md.pivot) m.setPivotPoint(BABYLON.Vector3.FromArray(md.pivot));
        }
        // Шапка — на голову, рюкзак — на торс, оружие — в правую руку.
        const hat = GameData.ITEMS[GameState.equipped('hats')];
        if (hat && hat.kind !== 'none' && parts.head) { const m = GameArt.hat(scene, hat.kind); m.parent = parts.head; }
        const pack = GameData.ITEMS[GameState.equipped('packs')];
        if (pack && parts.body) { const m = GameArt.pack(scene, pack); m.parent = parts.body; }
        const melee = GameData.ITEMS[GameState.equipped('melee')] || GameData.ITEMS['melee-1'];
        let meleeMesh = null;
        if (parts.armR) {
            const piv = (parts.armR.metadata && parts.armR.metadata.pivot) || [-40, 180, 0];
            meleeMesh = await GameArt.melee(scene, melee);
            meleeMesh.parent = parts.armR;
            meleeMesh.position.set(piv[0] - 4, piv[1] - 92, piv[2] + 6);
            meleeMesh.rotation.x = Math.PI / 2 * 0.85;
        }
        World3D.addObject(this.view, root, 'actor', { ink: false });
        const hpMax = this.K.heroHp * (1 + GameState.upValue('hp'));
        this.hero = {
            root, parts, meleeMesh, melee, x, y, h, roof, heading: -Math.PI / 2, vx: 0, vy: 0, speed: this.K.heroSpeed * (1 + GameState.upValue('speed')),
            hp: hpMax, maxHp: hpMax, state: 'walk', phase: 0, meleeCd: 0.5, spin: 0, spinT: 0, hurtT: 0, invul: 0, air: null, trailT: 0, deadT: 0, jumpCd: 0,
        };
        // Питомец.
        const petItem = GameData.ITEMS[GameState.equipped('pets')];
        if (petItem && petItem.kind !== 'none') {
            const pm = GameArt.pet(scene, petItem.kind);
            World3D.addObject(this.view, pm, 'actor', { ink: false });
            this.pet = { mesh: pm, item: petItem, x: x - 80, y: y + 40, h: h + 150, cd: 0.5, t: 0 };
        }
        this.placeHero(0);
    },

    // Стволы рюкзака -> модели у мех-рук.
    async rebuildGuns() {
        for (const g of this.guns) if (g.mesh) World3D.removeObject(this.view, g.mesh);
        this.guns = [];
        const skin = GameData.ITEMS[GameState.equipped('skins')];
        const list = this.bag.map((s, i) => s ? { slot: i, s } : null).filter(Boolean);
        for (const { slot, s } of list) {
            const it = GameData.ITEMS[s.id];
            if (!it) continue;
            const mesh = await GameArt.model(this.scene, it.model, 'gun');
            mesh.scaling.set(0.62, 0.62, 0.62);
            World3D.addObject(this.view, mesh, 'actor', { ink: false });
            GameArt.applySkin(mesh, skin && skin.tint ? skin : { tint: it.tint, glow: 0 }, 0);
            const st = GameData.weaponStats(s.id, s.tier);
            this.guns.push({ slot, id: s.id, tier: s.tier, mesh, st, cd: Math.random() * 0.4, target: null, retarget: 0, x: 0, y: 0, h: 0, yaw: 0, pitch: 0, kick: 0, flash: 0 });
        }
        if (this.ui) this.ui.hudBag(this.bag);
    },

    placeHero(dt) {
        const H = this.hero;
        if (!H || !H.root) return;
        const r = H.root;
        r.position.set(H.x, H.h + (H.air && H.air.kind === 'zip' ? -150 : 0), H.y);
        r.rotation.set(0, Math.PI / 2 - H.heading + H.spin, 0);
        const P = H.parts, sw = Math.sin(H.phase), moving = Math.hypot(H.vx, H.vy) > 20;
        const walk = moving && !H.air ? 1 : 0;
        if (P.legL) P.legL.rotation.x = H.air ? (H.air.kind === 'zip' ? 0.5 : -0.9) : sw * 0.8 * walk;
        if (P.legR) P.legR.rotation.x = H.air ? (H.air.kind === 'zip' ? 0.2 : -0.6) : -sw * 0.8 * walk;
        if (P.armL) { P.armL.rotation.x = H.air && H.air.kind === 'zip' ? Math.PI : -sw * 0.6 * walk; P.armL.rotation.z = H.air && H.air.kind === 'jump' ? -0.6 : 0; }
        const swing = H.spinT > 0, wind = swing && (1 - H.spinT / this.MELEE_T) * this.MELEE_T < this.MELEE_WIND;
        if (H.meleeMesh) H.meleeMesh.rotation.x = swing ? (wind ? 2.2 : Math.PI - 0.12) : Math.PI / 2 * 0.85;
        if (swing && P.armL) { P.armL.rotation.x = wind ? -2.4 : -1.45; P.armL.rotation.z = wind ? 0 : -0.35; }
        if (P.armR) {
            if (swing) { P.armR.rotation.x = wind ? -2.4 : -1.45; P.armR.rotation.z = wind ? 0 : 0.35; }
            else if (H.air && H.air.kind === 'zip') { P.armR.rotation.x = Math.PI; P.armR.rotation.z = 0; }
            else { P.armR.rotation.x = sw * 0.6 * walk - 0.15; P.armR.rotation.z = H.air && H.air.kind === 'jump' ? 0.6 : 0; }
        }
        if (this.mode === 'win' && P.armL && P.armR) { P.armL.rotation.x = Math.PI + Math.sin(this.time * 10) * 0.3; P.armR.rotation.x = Math.PI - Math.sin(this.time * 10) * 0.3; }
        // Сальто в прыжке, падение при смерти.
        if (H.air && H.air.kind === 'jump') r.rotation.x = H.air.t / H.air.dur * Math.PI * 2;
        else if (H.spinT > 0) r.rotation.x = 0.16;
        else if (H.state === 'dead') r.rotation.x = -Math.min(1, H.deadT * 3) * Math.PI / 2;
        else r.rotation.x = 0;
        const hurt = H.hurtT > 0 ? 1 : 0;
        const vis = H.invul > 0 && Math.floor(this.time * 16) % 2 ? 0.45 : 1;
        for (const k in P) P[k].visibility = vis;
        if (hurt && dt) H.hurtT -= dt;
    },

    // --- ввод и камера ---------------------------------------------------------------
    input: { x: 0, y: 0 },

    fitCamera(snap) {
        const cam = this.app.camera, cv = World3D.canvas;
        const w = (cv && cv.clientWidth) || 800, h = (cv && cv.clientHeight) || 600;
        const view = this.K.view;
        const zoom = Math.max(0.2, Math.min(this.showcase ? 3.2 : 2, Math.min(w, h * 1.25) / view * (this.showcase ? 2.3 : 1)));
        cam.zoomTarget = zoom;
        if (snap) cam.zoom = zoom;
    },

    // --- кадр ------------------------------------------------------------------------
    update(dt) {
        if (!this._ready || !this.hero) return;
        const cam = this.app.camera;
        if (this.hitStop > 0) { this.hitStop -= dt; dt *= 0.12; }
        if (!this.frozen) {
            this.time += dt;
            if (this.mode === 'play' || this.mode === 'win' || this.mode === 'lose') this.updateHero(dt);
            else this.updateMenuHero(dt);
            if (this.mode === 'play' && !this.tutHold) this.director(dt);
            this.updateMonsters(dt);
            this.updateCrowd(dt);
            this.updateGuns(dt);
            this.updateBullets(dt);
            this.updatePickups(dt);
            this.updateProps(dt);
            this.updateFx(dt);
        }
        this.updateMapFires(this.frozen ? 0 : dt);
        if (this.fires.length && !this._fireNear.some(f => f.s > 1.6)) this._fireT = 0;
        // Камера: цель — герой (с высотой), в меню — медленный облёт.
        const H = this.hero;
        this.cam.x = H.x; this.cam.y = H.y + 60; this.cam.h = H.h + (H.air && H.air.kind === 'zip' ? -120 : 30);
        // Витрина скинов: герой — в свободной части экрана (панель справа или снизу).
        if (this.showcase) {
            const cv = World3D.canvas, land = cv && cv.clientWidth > cv.clientHeight;
            if (land) this.cam.x += 150; else { this.cam.y += 170; this.cam.h -= 40; }
        }
        if (this.mode === 'menu') cam.azimuth = this.showcase ? -Math.PI / 2 : -Math.PI / 2 + Math.sin(this.time * 0.12) * 0.5;
        else cam.azimuth += (-Math.PI / 2 - cam.azimuth) * Math.min(1, dt * 2);
        this.fitCamera(false);
        // Туман сцены считается от расстояния до камеры, а на узком экране (телефон) камера в разы
        // дальше: плотность — по зуму, чтобы дымка у героя была как на ПК, а не закрывала поле.
        if (this.fogBase) this.view.scene.fogDensity = this.fogBase * Math.min(1, cam.zoom / this.K.fogZoom);
        this.placeHero(this.frozen ? 0 : dt);
        this.render();
        if (this.ui && this.mode !== 'menu') this.ui.hud(this);
    },

    updateMenuHero(dt) {
        const H = this.hero;
        H.vx = 0; H.vy = 0; H.phase += dt * 2;
        if (this.showcase) H.heading += dt * 0.9;
        else { H.heading = ((H.heading - Math.PI / 2) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI + Math.PI / 2; H.heading += (Math.PI / 2 - H.heading) * Math.min(1, dt * 3); }
        H.meleeCd -= dt;
    },

    updateHero(dt) {
        const H = this.hero;
        H.invul = Math.max(0, H.invul - dt);
        if (H.shieldT > 0) { H.shieldT -= dt; if (H.shieldT <= 0) H.shield = 0; }
        if (H.shieldHit > 0) H.shieldHit -= dt;
        H.jumpCd = Math.max(0, H.jumpCd - dt);
        if (H.state === 'dead') { H.deadT += dt; H.vx = H.vy = 0; return; }
        if (H.air) { this.updateAir(dt); return; }
        let ix = this.mode === 'play' ? this.input.x : 0, iy = this.mode === 'play' ? this.input.y : 0;
        const il = Math.hypot(ix, iy);
        if (il > 1) { ix /= il; iy /= il; }
        const w = this.app.camera.screenDeltaToWorld(ix, iy), wl = Math.hypot(w.x, w.y);
        const tvx = wl > 1e-6 ? w.x / wl * H.speed * Math.min(1, il) : 0, tvy = wl > 1e-6 ? w.y / wl * H.speed * Math.min(1, il) : 0;
        const k = Math.min(1, dt * 14);
        H.vx += (tvx - H.vx) * k; H.vy += (tvy - H.vy) * k;
        let nx = H.x + H.vx * dt, ny = H.y + H.vy * dt;
        const r = this.roofs[H.roof];
        if (r) { nx = Math.max(r.wx0, Math.min(r.wx1, nx)); ny = Math.max(r.wy0, Math.min(r.wy1, ny)); }
        // Препятствия: ящики, бочки, сундуки — круги.
        const push = (ox, oy, rad) => { const dx = nx - ox, dy = ny - oy, d = Math.hypot(dx, dy); if (d < rad && d > 0.01) { nx = ox + dx / d * rad; ny = oy + dy / d * rad; } };
        for (const b of this.blocks) if (b.alive && b.roof === H.roof && b.h - H.h < 60) push(b.x, b.y, b.size * 0.5 + 34);
        for (const t of this.tnts) if (t.alive && t.roof === H.roof) push(t.x, t.y, 70);
        for (const o of this.solids) if (o.roof === H.roof) push(o.x, o.y, o.r + 30);
        H.x = nx; H.y = ny;
        const sp = Math.hypot(H.vx, H.vy);
        if (sp > 20) {
            H.phase += dt * sp / 26;
            const want = Math.atan2(H.vy, H.vx);
            let da = want - H.heading; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
            if (H.spinT <= 0) H.heading += da * Math.min(1, dt * 12);
            H.trailT -= dt;
            if (H.trailT <= 0) { H.trailT = 0.06; this.trailPuff(H.x, H.y, H.h); }
        }
        // Удар: авто, если рядом монстр или ящик.
        H.meleeCd -= dt;
        if (H.spinT > 0) this.updateSwing(dt);
        if (H.meleeCd <= 0 && H.spinT <= 0) {
            const R = H.melee.radius;
            const near = this.mons.some(m => m.state === 'roof' && m.roof === H.roof && Math.hypot(m.x - H.x, m.y - H.y) < R + m.radius * 0.5)
                || this.blocks.some(b => b.alive && b.roof === H.roof && Math.hypot(b.x - H.x, b.y - H.y) < R + b.size * 0.3 && b.h - H.h < 90)
                || this.tnts.some(t => t.alive && t.roof === H.roof && Math.hypot(t.x - H.x, t.y - H.y) < R);
            if (near) this.meleeSwing();
        }
        // Батуты и тарзанки.
        if (H.jumpCd <= 0) {
            for (const j of this.jumps) if (j.roof === H.roof && j.target >= 0 && Math.hypot(j.x - H.x, j.y - H.y) < 70) { this.startJump(j); return; }
            for (const z of this.zips) if (z.pair && z.roof === H.roof && Math.hypot(z.x - H.x, z.y - H.y) < 70) { this.startZip(z); return; }
        }
        // Сундуки.
        for (const c of this.chests) if (!c.open && c.roof === H.roof && Math.hypot(c.x - H.x, c.y - H.y) < 95) this.openChest(c);
        // Питомец.
        this.updatePet(dt);
    },

    // Удар вращением: замах назад (0.09 с), затем 1.1 оборота с замедлением. Урон —
    // тем, мимо кого прошло лезвие (сектор между прошлым и текущим углом), по разу.
    MELEE_T: 0.46, MELEE_WIND: 0.09,

    meleeSwing() {
        const H = this.hero;
        H.spinT = this.MELEE_T; H.meleeCd = H.melee.cd; H.spin = 0; H.swingHit = new Set(); H.swingPrev = null; H.swingHits = 0;
        const light = ['bat', 'pan', 'sword', 'katana'].includes(H.melee.kind);
        this.sfx(light ? 'swingLight' : 'swingHeavy', 0.85, (light ? 1 : 0.85) + Math.random() * 0.15);
    },

    // Кадр удара: угол, поражение, эффекты.
    updateSwing(dt) {
        const H = this.hero, T = this.MELEE_T, W = this.MELEE_WIND;
        H.spinT = Math.max(0, H.spinT - dt);
        const p = 1 - H.spinT / T;
        if (p * T < W) { H.spin = -0.45 * (p * T / W); return; }
        const q = Math.min(1, (p * T - W) / (T - W)), e = 1 - Math.pow(1 - q, 3);
        H.spin = -0.45 + (Math.PI * 2 * 1.1 + 0.45) * e;
        // Лезвие смотрит вдоль направления тела: курс героя минус поворот.
        const cur = H.heading - H.spin, prev = H.swingPrev == null ? cur + 0.45 : H.swingPrev;
        H.swingPrev = cur;
        const R = H.melee.radius * 1.15, dmg = H.melee.dmg * (1 + GameState.upValue('melee')) * (1 + GameState.upValue('dmg') * 0.5);
        const swept = (x, y) => {
            let a = Math.atan2(y - H.y, x - H.x);
            // Поворот идёт по убыванию угла: попадание, если a между cur и prev.
            let da = prev - a; while (da < 0) da += Math.PI * 2; while (da >= Math.PI * 2) da -= Math.PI * 2;
            let span = prev - cur; while (span < 0) span += Math.PI * 2;
            return da <= span + 0.05;
        };
        for (const m of this.mons) {
            if (H.swingHit.has(m) || m.state === 'dead' || (m.state !== 'roof' && m.state !== 'vault' && m.state !== 'leap') || m.roof !== H.roof && m.state === 'roof') continue;
            const dx = m.x - H.x, dy = m.y - H.y, d = Math.hypot(dx, dy);
            if (d > R + m.radius * 0.6 || Math.abs(m.h - H.h) > 140 || !swept(m.x, m.y)) continue;
            H.swingHit.add(m);
            // Удар по касательной к кругу: тела разлетаются веером.
            const tx = -dy / (d || 1), ty = dx / (d || 1), ox = dx / (d || 1), oy = dy / (d || 1);
            this.damage(m, dmg, ox * 0.8 - tx * 0.6, oy * 0.8 - ty * 0.6, 640);
            H.swingHits++;
            if (H.swingHits === 1) this.emit('melee');
            this.meleeImpact(m.x - ox * m.radius * 0.5, m.y - oy * m.radius * 0.5, m.h + m.height * 0.55, tx, ty, m.boss ? 1.5 : 1, H.swingHits);
            this.hitStop = Math.max(this.hitStop || 0, m.boss ? 0.08 : 0.055);
        }
        for (const b of this.blocks) {
            if (!b.alive || H.swingHit.has(b) || b.roof !== H.roof || b.h - H.h >= 90) continue;
            if (Math.hypot(b.x - H.x, b.y - H.y) < R + b.size * 0.3 && swept(b.x, b.y)) { H.swingHit.add(b); this.hitBlock(b); this.meleeImpact(b.x, b.y, b.h + b.size * 0.5, 0, 0, 0.9, 0); this.hitStop = Math.max(this.hitStop || 0, 0.04); }
        }
        for (const tn of this.tnts) if (tn.alive && !H.swingHit.has(tn) && tn.roof === H.roof && Math.hypot(tn.x - H.x, tn.y - H.y) < R && swept(tn.x, tn.y)) { H.swingHit.add(tn); this.meleeImpact(tn.x, tn.y, tn.h + 60, 0, 0, 1, 0); this.hitTnt(tn, 999); }
        if (H.swingHits && !H.swingSound) {
            H.swingSound = true;
            const k = H.melee.kind, mat = k === 'bat' || k === 'guitar' ? 'hitWood' : k === 'sword' || k === 'katana' || k === 'chainsaw' ? 'hitSlice' : k === 'thunder' ? 'hitThunder' : 'hitMetal';
            this.sfx(mat, 0.8, 0.9 + Math.random() * 0.2);
            this.sfx('hitPunch', 0.9, 0.85 + Math.random() * 0.2);
        }
        if (H.spinT <= 0) {
            H.spin = 0; H.swingSound = false;
            // Тяжёлые молоты — удар о крышу в конце.
            if ((H.melee.kind === 'hammer' || H.melee.kind === 'thunder') && H.swingHits) {
                this.ring(H.x, H.y, H.h + 6, R * 1.1, H.melee.kind === 'thunder' ? '#6fd0ff' : '#ffffff', 0.3);
                this.app.fx.play('dust', [H.x, H.h + 8, H.y]);
                if (H.roof >= 0) this.decal(H.x, H.y, H.h, R * 1.3, null, 'crack');
                if (H.melee.kind === 'thunder') this.app.fx.play('zap', [H.x, H.h + 40, H.y]);
            }
        }
    },

    // Попадание пули со способностью легендарного/мифического оружия.
    abilityHit(b, m, dx, dy) {
        const lv = b.abLv, x = m.x, y = m.y, h = m.h + m.height * 0.55;
        let dmg = b.dmg;
        if (b.ab === 'crit' && Math.random() < (lv > 1 ? 0.4 : 0.25)) {
            dmg *= lv > 1 ? 4 : 3;
            if (this.ui) this.ui.popText(x, y, h + 60, Lang.t('crit'), '#ff4848');
            this.flashAt(x, y, h, 70, '#ff6a6a');
        }
        this.damage(m, dmg, dx, dy, b.knock);
        if (b.ab === 'explosive' && Math.random() < (lv > 1 ? 0.35 : 0.2)) this.miniBlast(x, y, h, lv > 1 ? 130 : 95, b.dmg * 0.8);
        else if (b.ab === 'burn' && !m.e.fireproof) { m.dotT = 2.2; m.dotDps = Math.max(m.dotDps || 0, b.dmg * (lv > 1 ? 1.4 : 0.8)); m.dotBoom = lv > 1; }
        else if (b.ab === 'chain') {
            let from = m;
            const hit = new Set([m]);
            for (let k = 0; k < (lv > 1 ? 4 : 2); k++) {
                let best = null, bd = 320 * 320;
                for (const o of this.mons) { if (hit.has(o) || o.state === 'dead' || !this.targetable(o)) continue; const d = (o.x - from.x) ** 2 + (o.y - from.y) ** 2; if (d < bd) { bd = d; best = o; } }
                if (!best) break;
                hit.add(best);
                this.bolts.push({ x0: from.x, y0: from.y, h0: from.h + from.height * 0.55, x1: best.x, y1: best.y, h1: best.h + best.height * 0.55, t: 0, life: 0.16, w: 7, jit: 40, col: HEX('#8fd8ff') });
                this.damage(best, b.dmg * 0.7, 0, 0, 60);
                if (this.time - (this._zapT || 0) > 0.06) { this._zapT = this.time; this.app.fx.play('zap', [best.x, best.h + best.height * 0.55, best.y]); }
                from = best;
            }
            if (hit.size > 1) this.sfx('laser', 0.25, 1.5, 0.08);
        } else if (b.ab === 'ricochet' && b.bounce > 0) {
            let best = null, bd = 380 * 380;
            for (const o of this.mons) { if (o === m || o.state === 'dead' || !this.targetable(o) || (b.hit && b.hit.includes(o))) continue; const d = (o.x - x) ** 2 + (o.y - y) ** 2; if (d < bd) { bd = d; best = o; } }
            if (best) {
                const sp = Math.hypot(b.vx, b.vy, b.vh) || 2000, tx = best.x - x, ty = best.y - y, th = best.h + best.height * 0.55 - h, l = Math.hypot(tx, ty, th) || 1;
                this.bullets.push(Object.assign({}, b, { x, y, h, vx: tx / l * sp, vy: ty / l * sp, vh: th / l * sp, life: 0.6, bounce: b.bounce - 1, hit: [m], dmg: b.dmg * (lv > 1 ? 1 : 0.75), pierce: 0 }));
                this.flashAt(x, y, h, 30, '#ffe066');
            }
        }
    },

    // Малый взрыв без системы частиц (разрывные пули, звёзды питомца): вспышка, кольцо, осколки.
    miniBlast(x, y, h, R, dmg, col) {
        const c = col || '#ffb33a';
        this.flashes.push({ x, y, h, size: R * 0.8, col: HEX(c), t: 0, life: 0.12, vh: 0 });
        this.ring(x, y, h, R, c, 0.22);
        for (let k = 0; k < 6; k++) this.gib(x, y, h, HEX(k % 2 ? c : '#fff2a8'), 5 + Math.random() * 6, 380, 0.4);
        this.sfx('explosion', 0.3, 1.3 + Math.random() * 0.3, 0.09);
        for (const o of this.mons) {
            if (o.state === 'dead') continue;
            const dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy);
            if (d < R + o.radius && Math.abs(o.h + o.height / 2 - h) < 140) this.damage(o, dmg * (o.e.blastproof ? 0.35 : 1), dx / (d || 1), dy / (d || 1), 220, true);
        }
    },

    // Суперспособность питомца: сила — по редкости, перезарядка — PET_ABILITIES.cd.
    petAbility(P) {
        const H = this.hero, ab = P.item.ability, rar = P.item.rarity || 0, pow = 1 + rar * 0.3;
        const base = P.item.dps * (1 + GameState.upValue('dmg')) * (1 + (this.lvl.n - 1) * 0.03) * pow;
        const near = (R, n, boss) => this.mons.filter(m => m.state !== 'dead' && this.targetable(m) && (boss || !m.boss) && Math.hypot(m.x - H.x, m.y - H.y) < R)
            .sort((a, b) => Math.hypot(a.x - H.x, a.y - H.y) - Math.hypot(b.x - H.x, b.y - H.y)).slice(0, n);
        const pop = (col) => { if (this.ui) this.ui.popText(P.x, P.y, P.h + 70, this.ui.name(ab.name), col); this.ring(P.x, P.y, P.h, 90, col, 0.3); };
        const id = ab.id;
        if (id === 'shield') {
            H.shield = H.maxHp * 0.3 * pow; H.shieldT = 5;
            pop('#6fd0ff'); this.sfx('assets/sounds/confirm.ogg', 0.6, 0.8);
            return true;
        }
        const list = near(id === 'freeze' ? 460 : 720, id === 'vampire' || id === 'abduct' ? 3 : id === 'starfall' ? 8 : 12, id !== 'abduct');
        if (!list.length) return false;
        if (id === 'volley') {
            pop('#ffd23a');
            for (let k = 0; k < 6; k++) this.delayed.push({ t: k * 0.09, run: () => { const t = list[k % list.length]; if (t.state !== 'dead') this.fire({ x: P.x, y: P.y, h: P.h }, t, { dmg: base * 2.2, speed: 1100, spread: 0.1, pellets: 1, pierce: 0, splash: 110, kind: 'homing', proj: 'rocket', tracer: 1.2, range: 900 }, '#ffb33a'); } });
            this.sfx('rocket', 0.5, 1.2);
        } else if (id === 'vampire') {
            pop('#ff3b5c');
            for (const m of list) {
                this.bolts.push({ x0: P.x, y0: P.y, h0: P.h, x1: m.x, y1: m.y, h1: m.h + m.height * 0.6, t: 0, life: 0.3, w: 9, jit: 26, col: HEX('#ff2d55') });
                this.damage(m, base * 4, 0, 0, 120);
                H.hp = Math.min(H.maxHp, H.hp + H.maxHp * 0.05 * pow);
                for (let k = 0; k < 5; k++) this.gib(m.x, m.y, m.h + m.height * 0.6, HEX('#ff2d55'), 6, 260, 0.5);
            }
            this.flashAt(H.x, H.y, H.h + 80, 90, '#ff6a8a');
            this.app.fx.play('heal', [H.x, H.h + 60, H.y]);
        } else if (id === 'abduct') {
            pop('#7cff8a');
            for (const m of list) {
                this.bolts.push({ x0: P.x, y0: P.y, h0: P.h + 30, x1: m.x, y1: m.y, h1: m.h, t: 0, life: 0.9, w: 38, jit: 0, beam: 1, col: HEX('#7cff8a') });
                if (m.boss) { this.damage(m, base * 8, 0, 0, 0); continue; }
                this.kill(m, 0, 0, 0);
                m.vx = 0; m.vy = 0; m.vh = 1300; m.spinV = 10;
            }
            this.sfx('assets/sounds/ghost.ogg', 0.5, 1.5);
        } else if (id === 'freeze') {
            pop('#9fe8ff');
            this.ring(H.x, H.y, H.h + 10, 480, '#9fe8ff', 0.5);
            this.app.fx.play('ice', [H.x, H.h + 60, H.y]);
            this.sprite('ice', H.x, H.y, H.h + 20, 300, 960, 0.6, { mode: 'ground' });
            for (const m of list) { m.slowT = 3 * pow; this.damage(m, base * 2, 0, 0, 0); for (let k = 0; k < 3; k++) this.gib(m.x, m.y, m.h + m.height * 0.5, HEX(k % 2 ? '#bfefff' : '#ffffff'), 8, 300); }
            this.sfx('assets/sounds/merge.ogg', 0.6, 1.4);
        } else if (id === 'starfall') {
            pop('#fff27a');
            list.forEach((m, k) => this.delayed.push({ t: k * 0.12, run: () => {
                const x = m.x + (Math.random() - 0.5) * 40, y = m.y + (Math.random() - 0.5) * 40, h = m.h + 20;
                this.bolts.push({ x0: x + 120, y0: y - 60, h0: h + 900, x1: x, y1: y, h1: h, t: 0, life: 0.18, w: 16, jit: 0, beam: 1, col: HEX('#fff27a') });
                this.delayed.push({ t: 0.12, run: () => { this.miniBlast(x, y, h, 130, base * 5, '#fff27a'); this.impacts.push({ x, y, h: h + 40, size: 130, rot: Math.random() * 3, t: 0, life: 0.25, col: [1, 1, 0.6] }); } });
            } }));
        } else if (id === 'breath') {
            pop('#ff7a1a');
            const t = list[0], a = Math.atan2(t.y - P.y, t.x - P.x), R = 680;
            for (let k = 0; k < 14; k++) this.delayed.push({ t: k * 0.035, run: () => {
                const d = (k + 1) / 14 * R, s = (Math.random() - 0.5) * 0.5;
                this.sprite('fireball', P.x + Math.cos(a + s) * d * 0.3, P.y + Math.sin(a + s) * d * 0.3, P.h - d * 0.05, 60, 110 + d * 0.15, 0.5, { rot: Math.random() * 6.28, vx: Math.cos(a + s) * 900, vy: Math.sin(a + s) * 900, vh: -120 });
            } });
            for (const m of this.mons) {
                if (m.state === 'dead' || !this.targetable(m)) continue;
                const dx = m.x - P.x, dy = m.y - P.y, d = Math.hypot(dx, dy);
                let da = Math.abs(Math.atan2(dy, dx) - a); if (da > Math.PI) da = 2 * Math.PI - da;
                if (d < R && da < 0.5) { this.damage(m, base * 5, dx / (d || 1), dy / (d || 1), 300); if (!m.e.fireproof) { m.dotT = 2.5; m.dotDps = base * 2; } }
            }
            for (let k = 1; k <= 3; k++) { const fx = P.x + Math.cos(a) * R * k / 3.5, fy = P.y + Math.sin(a) * R * k / 3.5; this.fires.push({ x: fx, y: fy, h: this.groundAt(fx, fy), r: 120, t: 3, dps: base * 2 }); }
            this.sfx('explosion', 0.5, 0.7);
        }
        return true;
    },

    // Эффект удара ближним боем: звезда к камере, искры, линии скорости вдоль удара,
    // кольцо у ног, цвет — по оружию; с третьего попадания за взмах — надпись комбо.
    meleeImpact(x, y, h, tx, ty, k, hits) {
        const kind = this.hero && this.hero.melee ? this.hero.melee.kind : '';
        const tint = kind === 'thunder' ? [0.6, 0.95, 1] : kind === 'chainsaw' ? [1, 0.75, 0.45] : kind === 'katana' || kind === 'sword' ? [0.85, 0.95, 1] : [1, 1, 1];
        if (this.impacts.length > 36) this.impacts.shift();
        this.impacts.push({ x, y, h, size: 120 * k, rot: Math.random() * Math.PI, t: 0, life: 0.2, col: tint });
        this.flashAt(x, y, h, 60 * k, kind === 'thunder' ? '#9fe8ff' : '#fff6c8');
        const spark = HEX(kind === 'thunder' ? '#8fe0ff' : '#ffd23a');
        for (let i = 0; i < 7; i++) this.gib(x, y, h, i % 3 ? spark : HEX('#ffffff'), 4 + Math.random() * 5, 420 + Math.random() * 260, 0.35);
        // Линии скорости: по касательной удара (tx, ty) и немного вверх.
        if (tx || ty) for (let i = 0; i < 3; i++) {
            const a = Math.atan2(ty, tx) + (Math.random() - 0.5) * 0.9, L = 70 + Math.random() * 60;
            this.sprite('streak', x + Math.cos(a) * 30, y + Math.sin(a) * 30, h + (Math.random() - 0.5) * 30, L, L * 1.6, 0.16, { mode: 'dir', dx: Math.cos(a), dy: Math.sin(a), vx: Math.cos(a) * 500, vy: Math.sin(a) * 500 });
        }
        this.ring(x, y, Math.max(h - 60, this.hero ? this.hero.h + 4 : h), 70 * k, kind === 'thunder' ? '#6fd0ff' : '#ffffff', 0.18);
        if (hits >= 3 && this.ui && this.ui.comboText) this.ui.comboText(x, y, h + 80, hits);
    },

    updatePet(dt) {
        const P = this.pet, H = this.hero;
        if (!P) return;
        P.t += dt;
        const tx = H.x + Math.cos(H.heading + 2.4) * 90, ty = H.y + Math.sin(H.heading + 2.4) * 90, th = H.h + 150 + Math.sin(P.t * 3) * 12;
        const k = Math.min(1, dt * 5);
        P.x += (tx - P.x) * k; P.y += (ty - P.y) * k; P.h += (th - P.h) * k;
        P.cd -= dt;
        const ab = P.item.ability;
        if (ab && this.mode === 'play') {
            P.abT = (P.abT == null ? ab.cd * 0.5 : P.abT) - dt;
            if (P.abT <= 0) P.abT = this.petAbility(P) ? ab.cd : 0.5;
        }
        if (P.cd <= 0 && this.mode === 'play') {
            const t = this.nearestTarget(P.x, P.y, 600, null);
            if (t) {
                P.cd = (P.item.rarity || 0) >= 5 ? 0.35 : 0.55;
                const dmg = P.item.dps * 0.55 * (1 + GameState.upValue('dmg')) * (1 + (this.lvl.n - 1) * 0.03);
                this.fire({ x: P.x, y: P.y, h: P.h }, t, { dmg, speed: 1800, spread: 0.02, pellets: 1, pierce: 0, splash: 0, tracer: 0.7, range: 700, beam: 1 }, '#9ff3ff');
                this.sprite('plasma', P.x, P.y, P.h, 24, 50, 0.12);
            } else P.cd = 0.2;
        }
    },

    // Прыжок с батута: дуга на крышу-цель, приземление — ударная волна.
    startJump(j) {
        const H = this.hero, r = this.roofs[j.target];
        let tx = r.x, ty = r.y;
        const dx = r.x - j.x, dy = r.y - j.y, d = Math.hypot(dx, dy) || 1;
        // Точка приземления: на прямой к центру цели, в 280 px от её ближнего края.
        for (let s = 0; s < d; s += 20) {
            const px = j.x + dx / d * s, py = j.y + dy / d * s;
            if (px >= r.wx0 && px <= r.wx1 && py >= r.wy0 && py <= r.wy1) { tx = Math.max(r.wx0, Math.min(r.wx1, px + dx / d * 280)); ty = Math.max(r.wy0, Math.min(r.wy1, py + dy / d * 280)); break; }
        }
        const dist = Math.hypot(tx - H.x, ty - H.y);
        H.air = { kind: 'jump', t: 0, dur: 0.85 + dist / 2600, x0: H.x, y0: H.y, h0: H.h, x1: tx, y1: ty, h1: r.h, peak: Math.max(H.h, r.h) + 420, roof: r.i };
        H.heading = Math.atan2(ty - H.y, tx - H.x);
        j.squash = 1;
        this.sfx('assets/sounds/boing.ogg', 0.8);
        this.leaveRoof(H.roof, r.i);
    },

    startZip(z) {
        const H = this.hero, o = z.pair;
        const dist = Math.hypot(o.x - z.x, o.y - z.y);
        H.air = { kind: 'zip', t: 0, dur: Math.max(0.8, dist / 1100), x0: z.x, y0: z.y, h0: z.h + 195, x1: o.x, y1: o.y, h1: o.h + 195, roof: o.roof };
        H.heading = Math.atan2(o.y - z.y, o.x - z.x);
        this.sfx('assets/sounds/zip.ogg', 0.8);
        this.leaveRoof(H.roof, o.roof);
    },

    // Герой ушёл с крыши: снизу орда сразу лезет на новую крышу, сверху — прыгает следом.
    leaveRoof(from, to) {
        for (const m of this.mons) if (m.state === 'street' || m.state === 'float') m.target = to;
    },

    // Прыжок монстра на крышу T к точке (ax, ay): приземление у ближнего края, дуга
    // по дальности. Слишком далеко — спрыгнуть вниз и лезть заново.
    startLeap(m, T, ax, ay) {
        const lx = Math.max(T.wx0, Math.min(T.wx1, m.x)), ly = Math.max(T.wy0, Math.min(T.wy1, m.y));
        const tx = lx + (Math.max(T.wx0, Math.min(T.wx1, ax)) - lx) * 0.25 + (Math.random() - 0.5) * 90;
        const ty = ly + (Math.max(T.wy0, Math.min(T.wy1, ay)) - ly) * 0.25 + (Math.random() - 0.5) * 90;
        const dist = Math.hypot(tx - m.x, ty - m.y);
        if (dist > 1900) { m.state = 'fall'; m.vx = (tx - m.x) / dist * 200; m.vy = (ty - m.y) / dist * 200; m.vh = 250; m.roof = -1; return; }
        m.state = 'leap';
        m.leap = { t: 0, dur: 0.55 + dist / 1500, x0: m.x, y0: m.y, h0: m.h, x1: Math.max(T.wx0, Math.min(T.wx1, tx)), y1: Math.max(T.wy0, Math.min(T.wy1, ty)), h1: T.h,
            peak: Math.max(m.h, T.h) + 180 + dist * 0.25, roof: T.i };
        m.heading = Math.atan2(ty - m.y, tx - m.x);
        if (m.boss) this.sfx('assets/sounds/boing.ogg', 0.8, 0.6);
    },

    // Босс приземлился: волна, тряска, отброс героя — если рядом.
    landShockBoss(m) {
        this.app.fx.play('dust', [m.x, m.h + 10, m.y]);
        this.ring(m.x, m.y, m.h + 6, 260, '#ff6b6b', 0.4);
        this.sfx('assets/sounds/land.ogg', 1, 0.6);
        const H = this.hero;
        if (!H.air && H.roof === m.roof && Math.hypot(H.x - m.x, H.y - m.y) < 240) this.hurtHero(m.dmg * 0.35);
    },

    updateAir(dt) {
        const H = this.hero, A = H.air;
        A.t += dt;
        const f = Math.min(1, A.t / A.dur);
        if (A.kind === 'jump') {
            const e = f;
            H.x = A.x0 + (A.x1 - A.x0) * e; H.y = A.y0 + (A.y1 - A.y0) * e;
            // Парабола через пик.
            const a = A.h0, b = A.peak, c = A.h1;
            H.h = (1 - e) * (1 - e) * a + 2 * (1 - e) * e * (2 * b - (a + c) / 2) + e * e * c;
        } else {
            const e = f * f * (3 - 2 * f);
            H.x = A.x0 + (A.x1 - A.x0) * e; H.y = A.y0 + (A.y1 - A.y0) * e;
            H.h = A.h0 + (A.h1 - A.h0) * e - Math.sin(e * Math.PI) * 40;
        }
        H.phase += dt * 6;
        this.updatePet(dt);
        if (f >= 1) {
            const r = this.roofs[A.roof];
            H.roof = A.roof; H.h = r.h;
            if (A.kind === 'zip') {
                const cx = r.x - H.x, cy = r.y - H.y, cd = Math.hypot(cx, cy) || 1;
                H.x += cx / cd * 120; H.y += cy / cd * 120;
            }
            H.x = Math.max(r.wx0, Math.min(r.wx1, H.x)); H.y = Math.max(r.wy0, Math.min(r.wy1, H.y));
            H.air = null; H.jumpCd = 0.8;
            this.landShock(H.x, H.y, H.h, A.kind === 'jump' ? 300 : 180);
            this.emit(A.kind === 'zip' ? 'zip-land' : 'land');
        }
    },

    landShock(x, y, h, R) {
        this.sfx('assets/sounds/land.ogg', 0.9);
        this.app.fx.play('dust', [x, h + 10, y]);
        this.ring(x, y, h + 6, R, '#ffffff', 0.35);
        if (R >= 250 && this.roofAt(x, y) >= 0) this.decal(x, y, h, R * 0.9, null, 'crack');
        for (const m of this.mons) {
            if (m.state !== 'roof' || m.roof !== this.hero.roof) continue;
            const dx = m.x - x, dy = m.y - y, d = Math.hypot(dx, dy);
            if (d < R) this.damage(m, 30 * (1 + GameState.upValue('melee')), dx / (d || 1), dy / (d || 1), 700);
        }
    },

    // --- орда -------------------------------------------------------------------------
    director(dt) {
        const L = this.lvl, caps = this.cfgCaps();
        const alive = this.mons.filter(m => m.state !== 'dead').length;
        if (this.kills < L.kills) {
            this.spawnT -= dt;
            const D = this.diff || GameData.difficulty('normal');
            const cap = Math.min(caps.enemies, L.alive * D.spawn);
            while (this.spawnT <= 0 && alive + 0 < cap) {
                this.spawnT += 1 / (L.spawnRate * D.spawn);
                this.spawnMonster(this.pickType());
                break;
            }
            if (this.spawnT < -1) this.spawnT = 0;
        }
        if (L.boss && !this.bossSpawned && this.kills >= L.kills * 0.55) {
            this.bossSpawned = true;
            this.boss = this.spawnMonster(L.boss);
            if (this.ui) this.ui.toast(Lang.t(L.boss === 'megaboss' ? 'megaboss' : 'boss'), '#ff4848');
            this.sfx('assets/sounds/ghost.ogg', 0.8, 0.6);
            GameMusic.play('boss');
        }
        const bossDone = !L.boss || (this.bossSpawned && (!this.boss || this.boss.state === 'dead'));
        if (this.kills >= L.kills && bossDone && this.mode === 'play') this.win();
    },

    pickType() {
        const w = this.lvl.weights;
        let sum = 0; for (const k in w) sum += w[k];
        let r = Math.random() * sum;
        for (const k in w) { r -= w[k]; if (r <= 0) return k; }
        return 'walker';
    },

    // Точка на улице у стены крыши roof: { x, y, nx, ny } — наружная нормаль.
    wallPoint(roof, along, side) {
        const r = this.roofs[roof];
        if (side === 0) return { x: r.x0 + (r.x1 - r.x0) * along, y: r.y0, nx: 0, ny: -1 };
        if (side === 1) return { x: r.x1, y: r.y0 + (r.y1 - r.y0) * along, nx: 1, ny: 0 };
        if (side === 2) return { x: r.x0 + (r.x1 - r.x0) * along, y: r.y1, nx: 0, ny: 1 };
        return { x: r.x0, y: r.y0 + (r.y1 - r.y0) * along, nx: -1, ny: 0 };
    },

    spawnMonster(type) {
        const e = GameData.ENEMIES[type], L = this.lvl, H = this.hero;
        const roof = H.air ? H.air.roof : H.roof;
        if (roof < 0) return null;
        let px = 0, py = 0, ok = false, wall = null;
        for (let n = 0; n < 12 && !ok; n++) {
            const side = Math.floor(Math.random() * 4);
            wall = this.wallPoint(roof, 0.1 + Math.random() * 0.8, side);
            const out = 120 + Math.random() * 520;
            px = wall.x + wall.nx * out; py = wall.y + wall.ny * out;
            ok = !this.insideAny(px, py, 20);
        }
        if (!ok) { px = wall.x + wall.nx * 40; py = wall.y + wall.ny * 40; }
        const D = this.diff || GameData.difficulty('normal');
        const hp = 30 * e.hp * L.hpMul * D.hp;
        const m = {
            type, e, url: e.models[Math.floor(Math.random() * e.models.length)], x: px, y: py, h: 0, heading: 0, state: e.fly ? 'float' : 'street', target: roof, roof: -1,
            hp, maxHp: hp, speed: e.speed * (0.9 + Math.random() * 0.2), climb: e.climb * (0.85 + Math.random() * 0.3), dmg: e.dmg * L.dmgMul * D.dmg,
            scale: e.scale * (0.92 + Math.random() * 0.16), radius: 34 * e.scale / 0.43, height: 100 * e.scale / 0.43 * (e.crawl ? 0.5 : 1), phase: Math.random() * 6,
            pitch: 0, roll: 0, vx: 0, vy: 0, vh: 0, kx: 0, ky: 0, flash: 0, deadT: 0, wall: null, t: 0, leaving: false, boss: !!e.boss,
            tint: e.tint, spin: 0, spinV: 0,
        };
        this.mons.push(m);
        return m;
    },

    // Декоративная толпа внизу: бродит у стен крыши героя, часть лезет по стенам и срывается.
    seedCrowd(all) {
        const caps = this.cfgCaps(), H = this.hero, roof = H.roof >= 0 ? H.roof : 0;
        if (!this.roofs.length) return;
        if (all) this.crowd = [];
        while (this.crowd.length < caps.crowd) this.crowd.push({});
        for (const c of this.crowd) if (all || c.far) this.placeCrowd(c, roof);
    },

    placeCrowd(c, roof) {
        const types = this.crowdTypes && this.crowdTypes.length ? ['walker', 'walker'].concat(this.crowdTypes) : ['walker'];
        const e = GameData.ENEMIES[types[Math.floor(Math.random() * types.length)]];
        const side = Math.floor(Math.random() * 4), w = this.wallPoint(roof, Math.random(), side);
        const climbing = Math.random() < 0.28;
        const out = climbing ? 16 : 40 + Math.random() * 700;
        let x = w.x + w.nx * out, y = w.y + w.ny * out;
        if (!climbing && this.insideAny(x, y, 10)) { x = w.x + w.nx * 30; y = w.y + w.ny * 30; }
        Object.assign(c, {
            e, url: e.models[Math.floor(Math.random() * e.models.length)], x, y, h: climbing ? Math.random() * this.roofs[roof].h * 0.55 : 0, roof,
            state: climbing ? 'climb' : 'mill', heading: climbing ? Math.atan2(-w.ny, -w.nx) : Math.random() * 6.28,
            nx: w.nx, ny: w.ny, phase: Math.random() * 6, speed: 40 + Math.random() * 90, scale: e.scale * (0.9 + Math.random() * 0.2),
            vh: 0, far: false, top: this.roofs[roof].h * (0.45 + Math.random() * 0.3), tint: e.tint.map(v => v * 0.72),
        });
    },

    updateCrowd(dt) {
        const roof = this.hero.air ? this.hero.air.roof : this.hero.roof;
        const R = this.roofs[roof];
        if (!R) return;
        const G = this.K.gravity;
        for (const c of this.crowd) {
            if (c.roof !== roof && Math.random() < dt * 1.5) { this.placeCrowd(c, roof); continue; }
            c.phase += dt * (c.state === 'climb' ? 7 : 5 + c.speed * 0.02);
            if (c.state === 'mill') {
                // К ближайшей стене, у стены — начать лезть.
                const tx = Math.max(R.x0, Math.min(R.x1, c.x)), ty = Math.max(R.y0, Math.min(R.y1, c.y));
                const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
                if (d < 20) {
                    c.state = 'climb'; c.h = 0; c.top = R.h * (0.45 + Math.random() * 0.3);
                    c.nx = Math.abs(dx) > Math.abs(dy) ? -Math.sign(dx) : 0; c.ny = c.nx ? 0 : -Math.sign(dy || 1);
                    c.heading = Math.atan2(-c.ny, -c.nx);
                } else {
                    c.heading = Math.atan2(dy, dx) + Math.sin(c.phase * 0.3) * 0.4;
                    c.x += Math.cos(c.heading) * c.speed * dt; c.y += Math.sin(c.heading) * c.speed * dt;
                }
            } else if (c.state === 'climb') {
                c.h += 95 * dt;
                if (c.h >= c.top) { c.state = 'drop'; c.vh = 0; c.vx = c.nx * 120; c.vy = c.ny * 120; }
            } else if (c.state === 'drop') {
                c.vh -= G * dt; c.h += c.vh * dt; c.x += c.vx * dt; c.y += c.vy * dt;
                if (c.h <= 0) { c.h = 0; c.state = 'mill'; c.x += c.nx * 60; c.y += c.ny * 60; }
            }
        }
    },

    // Урон монстру: вспышка, отбрасывание, смерть.
    damage(m, dmg, dx, dy, knock, quiet) {
        if (m.state === 'dead') return;
        m.hp -= dmg;
        m.flash = 1;
        const res = m.e.knockRes || 0;
        if (knock) { m.kx += dx * knock * (1 - res); m.ky += dy * knock * (1 - res); }
        if (this.ui && !quiet && (dmg >= 25 || Math.random() < 0.25)) this.ui.damageText(m.x, m.y, m.h + m.height, dmg);
        if (m.hp <= 0) this.kill(m, dx, dy, knock || 200);
        else if (Math.random() < 0.35) this.burst(m.x, m.y, m.h + m.height * 0.6, 4, 180);
    },

    kill(m, dx, dy, force) {
        m.state = 'dead'; m.deadT = 0;
        const f = Math.max(250, force) * (1 - (m.e.knockRes || 0) * 0.7);
        m.vx = dx * f * (0.8 + Math.random() * 0.5); m.vy = dy * f * (0.8 + Math.random() * 0.5); m.vh = 380 + Math.random() * 420;
        m.spinV = (Math.random() - 0.5) * 12;
        this.kills++;
        GameState.s.kills = (GameState.s.kills || 0) + 1;
        this.burst(m.x, m.y, m.h + m.height * 0.6, m.boss ? 60 : 16, m.boss ? 520 : 330);
        if ((m.boss || (this.hero && this.hero.spinT > 0)) && GameState.equipped('kills') === 'kill-1' && this.time - (this._bloodT || 0) > 0.08) {
            this._bloodT = this.time;
            this.app.fx.play('blood', [m.x, m.h + m.height * 0.6, m.y]);
        }
        if (m.roof >= 0 && m.h > 10) this.decal(m.x, m.y, this.roofs[m.roof] ? this.roofs[m.roof].h : m.h, (m.boss ? 200 : 72) * (0.6 + Math.random() * 0.5));
        this.sfx('zombieDie', m.boss ? 1 : 0.55, (m.boss ? 0.7 : 0.9) + Math.random() * 0.25, 0.06);
        if (Math.random() < 0.4) this.sfx('assets/sounds/splat.ogg', 0.45, 0.85 + Math.random() * 0.3);
        // Монеты.
        const value = Math.max(1, Math.round(m.e.coins * this.lvl.coinMul * (1 + GameState.upValue('coins'))));
        const drops = Math.min(m.boss ? 14 : 3, value);
        for (let i = 0; i < drops; i++) this.dropCoin(m.x, m.y, m.h + 50, Math.ceil(value / drops));
        if (!m.boss && Math.random() < 0.025) this.dropHeart(m.x, m.y, m.h + 50);
        if (m.e.burst) {
            this.ring(m.x, m.y, m.h + 20, 190, '#8aff5a', 0.45);
            this.app.fx.play('slime', [m.x, m.h + 70, m.y]);
            if (m.roof >= 0) { const kd = this.decals.length; this.decal(m.x, m.y, m.h, 260); if (this.decals[kd]) this.decals[kd].pk = 'slime'; }
            for (let k = 0; k < 10; k++) this.gib(m.x, m.y, m.h + 50, HEX(k % 2 ? '#8aff5a' : '#c8ff9a'), 8 + Math.random() * 14, 520);
            this.sfx('assets/sounds/splat-big.ogg', 0.8, 0.8);
            const dmg = 40 * this.lvl.hpMul;
            for (const o of this.mons) if (o !== m && o.state !== 'dead' && Math.hypot(o.x - m.x, o.y - m.y) < 190 && Math.abs(o.h - m.h) < 120) this.damage(o, dmg, (o.x - m.x) / 190, (o.y - m.y) / 190, 400);
        }
        if (m.boss) { this.app.fx.play('boom', [m.x, m.h + 80, m.y]); this.sfx('explosionBig', 1); }
    },

    updateMonsters(dt) {
        const H = this.hero, G = this.K.gravity;
        const heroRoof = H.air ? H.air.roof : H.roof;          // куда идёт орда
        const aimX = H.air ? H.air.x1 : H.x, aimY = H.air ? H.air.y1 : H.y;   // точка героя (в прыжке — приземление)
        // Сетка для раздвигания на крыше.
        const grid = this.grid; grid.clear();
        const CELL = 90, key = (x, y) => (Math.floor(x / CELL) & 0xffff) * 65536 + (Math.floor(y / CELL) & 0xffff);
        for (const m of this.mons) if (m.state === 'roof') { const k = key(m.x, m.y); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(m); }
        let hurt = 0;
        const dt0 = dt;
        for (let i = this.mons.length - 1; i >= 0; i--) {
            const m = this.mons[i];
            m.flash = Math.max(0, m.flash - dt * 7);
            m.t += dt;
            const slow = m.slowT > 0 ? 0.35 : 1;
            if (m.slowT > 0) m.slowT -= dt;
            if (m.burnT > 0) m.burnT -= dt;
            dt = dt0 * slow;
            if (m.state === 'dead') {
                m.deadT += dt;
                const ground = this.groundAt(m.x, m.y);
                if (!m.lying) {
                    m.vh -= G * dt; m.x += m.vx * dt; m.y += m.vy * dt; m.h += m.vh * dt;
                    m.pitch += m.spinV * dt * 0.7; m.roll += m.spinV * dt * 0.4;
                    if (m.h <= ground && m.vh < 0) {
                        m.h = ground;
                        if (Math.abs(m.vh) > 500 && !m.bounced) { m.vh = -m.vh * 0.3; m.vx *= 0.4; m.vy *= 0.4; m.bounced = true; }
                        else { m.lying = true; m.pitch = Math.random() < 0.5 ? -Math.PI / 2 : Math.PI / 2; m.roll = 0; m.lieT = 0; }
                    }
                } else {
                    m.lieT += dt;
                    if (m.lieT > 1.6) m.scaleK = Math.max(0, 1 - (m.lieT - 1.6) * 3);
                    if (m.lieT > 2) this.mons.splice(i, 1);
                }
                continue;
            }
            if (m.e.heal && (m.state === 'roof' || m.state === 'street')) {
                m.healT = (m.healT || 0) + dt;
                if (m.healT > 1) {
                    m.healT = 0;
                    for (const o of this.mons) if (o !== m && o.state !== 'dead' && o.hp < o.maxHp && Math.hypot(o.x - m.x, o.y - m.y) < 240) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.08); this.flashes.push({ x: o.x, y: o.y, h: o.h + o.height + 10, size: 18, col: [0.3, 1, 0.4], t: 0, life: 0.5, vh: 60 }); }
                }
            }
            // Отбрасывание гаснет.
            const kd = Math.min(1, dt * 6);
            const kx = m.kx * dt, ky = m.ky * dt;
            m.kx -= m.kx * kd; m.ky -= m.ky * kd;
            if ((m.state === 'street' || m.state === 'float') && heroRoof >= 0) m.target = heroRoof;
            if (m.state === 'street') {
                const R = this.roofs[m.target];
                if (!R) { this.mons.splice(i, 1); continue; }
                const tx = Math.max(R.x0, Math.min(R.x1, m.x)), ty = Math.max(R.y0, Math.min(R.y1, m.y));
                const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
                if (d < 24) {
                    m.state = 'climb'; m.roof = -1;
                    m.wall = Math.abs(dx) > Math.abs(dy) ? { nx: -Math.sign(dx), ny: 0 } : { nx: 0, ny: -Math.sign(dy || 1) };
                    m.x = tx + m.wall.nx * 18; m.y = ty + m.wall.ny * 18;
                    m.heading = Math.atan2(-m.wall.ny, -m.wall.nx);
                } else {
                    m.heading = Math.atan2(dy, dx);
                    m.x += dx / d * m.speed * dt; m.y += dy / d * m.speed * dt;
                    m.phase += dt * m.speed / 22;
                }
            } else if (m.state === 'float') {
                // Призрак: к стене и вверх без лазанья.
                const R = this.roofs[m.target];
                if (!R) { this.mons.splice(i, 1); continue; }
                const tx = Math.max(R.wx0, Math.min(R.wx1, m.x)), ty = Math.max(R.wy0, Math.min(R.wy1, m.y));
                const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
                m.h = Math.min(R.h + 40, m.h + m.climb * dt);
                if (d > 10) { m.x += dx / d * m.speed * 0.6 * dt; m.y += dy / d * m.speed * 0.6 * dt; m.heading = Math.atan2(dy, dx); }
                m.phase += dt * 3;
                if (m.h >= R.h + 30 && d < 20) { m.state = 'roof'; m.roof = R.i; m.h = R.h; }
            } else if (m.state === 'climb') {
                const R = this.roofs[m.target];
                if (!R) { this.mons.splice(i, 1); continue; }
                m.h += m.climb * dt;
                m.phase += dt * 8;
                // Сбит пулей со стены: сильное отбрасывание — падение.
                if (Math.hypot(m.kx, m.ky) > 260) { m.state = 'fall'; m.vx = m.kx; m.vy = m.ky; m.vh = 100; }
                else if (m.h >= R.h - 8) { m.state = 'vault'; m.t = 0; m.vault = { x0: m.x, y0: m.y, x1: m.x - m.wall.nx * 90, y1: m.y - m.wall.ny * 90 }; }
            } else if (m.state === 'vault') {
                const R = this.roofs[m.target], f = Math.min(1, m.t / 0.35);
                m.x = m.vault.x0 + (m.vault.x1 - m.vault.x0) * f; m.y = m.vault.y0 + (m.vault.y1 - m.vault.y0) * f;
                m.h = R.h - 8 + Math.sin(f * Math.PI) * 50 + 8 * f;
                m.phase += dt * 8;
                if (f >= 1) { m.state = 'roof'; m.roof = R.i; m.h = R.h; }
            } else if (m.state === 'roof') {
                const R = this.roofs[m.roof];
                let gx = 0, gy = 0;
                m.attack = false;
                if (heroRoof === m.roof && H.state !== 'dead') {
                    // Та же крыша: к герою (в прыжке — к точке приземления), вплотную — атака.
                    const dx = aimX - m.x, dy = aimY - m.y, d = Math.hypot(dx, dy);
                    const reach = m.radius + 34;
                    if (d > reach || H.air) { if (d > 1) { gx = dx / d; gy = dy / d; } }
                    else {
                        m.attack = true;
                        if (H.invul <= 0 && this.mode === 'play') hurt += m.dmg * dt;
                    }
                    m.heading = Math.atan2(dy, dx);
                } else if (heroRoof >= 0 && H.state !== 'dead') {
                    // Другая крыша: к краю напротив героя и прыжок следом.
                    const T = this.roofs[heroRoof];
                    const ex = Math.max(R.x0 + 14, Math.min(R.x1 - 14, aimX)), ey = Math.max(R.y0 + 14, Math.min(R.y1 - 14, aimY));
                    const dx = ex - m.x, dy = ey - m.y, d = Math.hypot(dx, dy) || 1;
                    gx = dx / d; gy = dy / d; m.heading = Math.atan2(aimY - m.y, aimX - m.x);
                    const atEdge = d < 40 && (ex <= R.x0 + 15 || ex >= R.x1 - 15 || ey <= R.y0 + 15 || ey >= R.y1 - 15);
                    if (atEdge) this.startLeap(m, T, aimX, aimY);
                }
                // Раздвигание.
                let sx = 0, sy = 0;
                const cx = Math.floor(m.x / CELL), cy = Math.floor(m.y / CELL);
                for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
                    const a = grid.get(((cx + ox) & 0xffff) * 65536 + ((cy + oy) & 0xffff));
                    if (!a) continue;
                    for (const o of a) {
                        if (o === m) continue;
                        const dx = m.x - o.x, dy = m.y - o.y, d2 = dx * dx + dy * dy, rr = (m.radius + o.radius) * 0.85;
                        if (d2 < rr * rr && d2 > 0.01) { const d = Math.sqrt(d2); sx += dx / d * (rr - d); sy += dy / d * (rr - d); }
                    }
                }
                if (m.state !== 'roof') continue;   // уже прыгнул
                if (m.e.zigzag && (gx || gy)) { const z = Math.sin(m.t * 7 + m.phase) * 0.8, cz = Math.cos(z), sz = Math.sin(z); const nx = gx * cz - gy * sz; gy = gx * sz + gy * cz; gx = nx; }
                let sp = m.speed * (m.attack ? 0.2 : 1);
                if (m.e.charge && heroRoof === m.roof && Math.hypot(H.x - m.x, H.y - m.y) < 460) sp *= 1.9;
                m.x += gx * sp * dt + sx * Math.min(1, dt * 8) + kx; m.y += gy * sp * dt + sy * Math.min(1, dt * 8) + ky;
                if (gx || gy) m.phase += dt * m.speed / 22; else m.phase += dt * (m.attack ? 6 : 1);
                // Край крыши: сильный толчок (взрыв, удар) сбрасывает вниз.
                const out = m.x < R.x0 + 10 || m.x > R.x1 - 10 || m.y < R.y0 + 10 || m.y > R.y1 - 10;
                if (out && Math.hypot(m.kx, m.ky) > 220) {
                    m.state = 'fall'; m.vx = m.kx; m.vy = m.ky; m.vh = 220; m.roof = -1;
                } else {
                    m.x = Math.max(R.x0 + 12, Math.min(R.x1 - 12, m.x)); m.y = Math.max(R.y0 + 12, Math.min(R.y1 - 12, m.y));
                    for (const o of this.solids) {
                        if (o.roof !== m.roof) continue;
                        const dx = m.x - o.x, dy = m.y - o.y, dd = Math.hypot(dx, dy), rr = o.r + m.radius * 0.8;
                        if (dd < rr && dd > 0.01) { m.x = o.x + dx / dd * rr; m.y = o.y + dy / dd * rr; }
                    }
                }
            } else if (m.state === 'leap') {
                // Прыжок с крыши на крышу: дуга через улицу.
                const L = m.leap;
                L.t += dt;
                const f = Math.min(1, L.t / L.dur);
                const e = f;
                m.x = L.x0 + (L.x1 - L.x0) * e; m.y = L.y0 + (L.y1 - L.y0) * e;
                m.h = (1 - e) * (1 - e) * L.h0 + 2 * (1 - e) * e * L.peak + e * e * L.h1;
                m.phase += dt * 6;
                if (f >= 1) {
                    m.state = 'roof'; m.roof = L.roof; m.h = L.h1;
                    if (m.boss) { this.landShockBoss(m); }
                    else if (Math.random() < 0.3) this.app.fx.play('dust', [m.x, m.h + 5, m.y]);
                }
            } else if (m.state === 'fall') {
                m.vh -= G * dt; m.x += m.vx * dt; m.y += m.vy * dt; m.h += m.vh * dt;
                m.pitch += dt * 3;
                const ground = this.groundAt(m.x, m.y);
                if (m.h <= ground && m.vh < 0) {
                    m.h = ground; m.pitch = 0; m.vx = m.vy = 0;
                    const r = this.roofAt(m.x, m.y);
                    if (ground > 0 && r >= 0) { m.state = 'roof'; m.roof = r; }
                    else { m.state = 'street'; m.roof = -1; m.target = H.air ? H.air.roof : Math.max(0, H.roof); }
                }
            }
        }
        if (hurt > 0) this.hurtHero(hurt);
    },

    hurtHero(amount) {
        const H = this.hero;
        if (H.state === 'dead' || this.mode !== 'play') return;
        if (this.tutSafe && H.hp - amount < H.maxHp * 0.5) { H.hurtT = 0.15; return; }
        if (H.shield > 0) { const a = Math.min(H.shield, amount); H.shield -= a; amount -= a; H.shieldHit = 0.15; if (amount <= 0) return; }
        H.hp -= amount;
        H.hurtT = 0.15;
        if (Math.random() < 0.08) this.sfx('assets/sounds/hurt.ogg', 0.5);
        if (H.hp <= 0) { H.hp = 0; H.state = 'dead'; H.deadT = 0; this.lose(); }
    },

    // --- стрельба ---------------------------------------------------------------------
    targetable(m) {
        return m.state === 'roof' || m.state === 'vault' || m.state === 'leap' || (m.state === 'climb' && m.h > this.roofs[m.target].h - 520) || (m.state === 'float' && m.h > 300);
    },

    nearestTarget(x, y, range, taken) {
        let best = null, bd = range * range;
        for (const m of this.mons) {
            if (m.state === 'dead' || !this.targetable(m)) continue;
            if (taken && taken.has(m)) continue;
            const dx = m.x - x, dy = m.y - y, d = dx * dx + dy * dy * 1.0;
            if (d < bd) { bd = d; best = m; }
        }
        return best;
    },

    updateGuns(dt) {
        const H = this.hero, n = this.guns.length;
        if (!n) return;
        const taken = new Set();
        const up = 1 + GameState.upValue('dmg'), rateUp = 1 + GameState.upValue('rate');
        const skin = GameData.ITEMS[GameState.equipped('skins')];
        for (let i = 0; i < n; i++) {
            const g = this.guns[i];
            // Место у героя: веер за спиной.
            const spread = Math.min(0.85, 5.6 / Math.max(1, n));
            const a = H.heading + Math.PI + (i - (n - 1) / 2) * spread;
            const rad = 70 + (n > 5 ? 18 : 0);
            g.x = H.x + Math.cos(a) * rad; g.y = H.y + Math.sin(a) * rad;
            g.h = H.h + (H.air && H.air.kind === 'zip' ? -60 : 105) + (i % 2) * 22 + Math.sin(this.time * 2.2 + i) * 6;
            g.retarget -= dt;
            if (this.mode === 'play' && (g.retarget <= 0 || !g.target || g.target.state === 'dead' || !this.targetable(g.target))) {
                g.retarget = 0.18;
                g.target = this.nearestTarget(g.x, g.y, g.st.range, taken) || this.nearestTarget(g.x, g.y, g.st.range, null);
            }
            if (g.target) taken.add(g.target);
            else if (g.spinUp) g.spinUp = Math.max(0, g.spinUp - dt * 0.8);
            let yaw = H.heading, pitch = 0;
            if (g.target) {
                const t = g.target, dx = t.x - g.x, dy = t.y - g.y, dh = t.h + t.height * 0.55 - g.h;
                yaw = Math.atan2(dy, dx); pitch = Math.atan2(dh, Math.hypot(dx, dy));
            }
            let dyaw = yaw - g.yaw; while (dyaw > Math.PI) dyaw -= 2 * Math.PI; while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
            g.yaw += dyaw * Math.min(1, dt * 16); g.pitch += (pitch - g.pitch) * Math.min(1, dt * 16);
            g.kick = Math.max(0, g.kick - dt * 8);
            g.cd -= dt;
            if (g.target && g.cd <= 0 && this.mode === 'play' && !H.air) {
                g.spinUp = g.st.ab === 'spin' ? Math.min(1, (g.spinUp || 0) + 0.06) : 0;
                g.cd = 1 / (g.st.rate * rateUp * (1 + (g.spinUp || 0) * (g.st.abLv > 1 ? 1.2 : 0.6)));
                const muzzle = { x: g.x + Math.cos(g.yaw) * 36, y: g.y + Math.sin(g.yaw) * 36, h: g.h + 4 };
                const st = Object.assign({}, g.st, { dmg: g.st.dmg * up });
                const tr = GameData.ITEMS[GameState.equipped('tracers')];
                this.fire(muzzle, g.target, st, tr ? tr.color : '#ffe066', tr ? tr.size : 1);
                g.kick = 1;
                const ms = 30 * Math.min(1.8, st.tracer || 1), cy = g.st.beam ? [0.6, 0.9, 1.2] : [1, 1, 1];
                this.sprite('flame', muzzle.x, muzzle.y, muzzle.h, ms * 2.4, ms * 2.9, 0.07, { mode: 'dir', dx: Math.cos(g.yaw), dy: Math.sin(g.yaw), col: cy });
                this.sprite('muzzle', muzzle.x, muzzle.y, muzzle.h, ms * 0.9, ms * 1.3, 0.06, { rot: Math.random() * 6.28, col: cy });
                this.sfx(st.sound, 0.34 / Math.sqrt(n), (0.92 + Math.random() * 0.16) * (st.soundRate || 1), 0.05);
            }
            const m = g.mesh;
            if (m) {
                const back = g.kick * 10;
                m.position.set(g.x - Math.cos(g.yaw) * back, g.h, g.y - Math.sin(g.yaw) * back);
                m.rotation.set(-g.pitch, Math.PI / 2 - g.yaw + this.GUN_YAW, 0);
                if (skin && skin.tint === 'rainbow') GameArt.applySkin(m, skin, this.time);
            }
        }
    },

    fire(from, t, st, color, size) {
        const pellets = st.pellets || 1, kind = st.kind || '';
        const tt = Math.hypot(t.x - from.x, t.y - from.y) / (st.speed || 2000);
        // Упреждение: цель на крыше движется к герою.
        const px = t.x + (t.state === 'roof' ? Math.cos(t.heading) * t.speed * tt * 0.5 : 0);
        const py = t.y + (t.state === 'roof' ? Math.sin(t.heading) * t.speed * tt * 0.5 : 0);
        const ph = t.h + t.height * 0.55;
        const rainbow = color === 'rainbow';
        const base = { dmg: st.dmg, pierce: st.pierce || 0, splash: st.splash || 0, knock: st.knock || 90, kind, proj: st.proj || '', burst: st.burst || '',
            rocket: kind === 'rocket' || kind === 'homing', size: (st.tracer || 1) * (size || 1), hit: null, target: t, g: 0, beam: st.beam || 0, ab: st.ab || '', abLv: st.abLv || 0, bounce: st.ab === 'ricochet' ? (st.abLv > 1 ? 3 : 1) : 0 };
        // Навесом (граната, миномёт, мина): время полёта из дальности, гравитация снаряда.
        if (kind === 'lob' || kind === 'mine') {
            const G = 1800;
            let tx = px, ty = py, th = t.h;
            if (kind === 'mine') { const a = Math.random() * Math.PI * 2, r = Math.random() * 70; tx += Math.cos(a) * r; ty += Math.sin(a) * r; th = this.groundAt(tx, ty); }
            const dx = tx - from.x, dy = ty - from.y, dh = th - from.h;
            const T = Math.max(0.45, Math.min(1.15, Math.hypot(dx, dy) / (st.speed || 900))) * (st.arc || 1);
            this.bullets.push(Object.assign({}, base, { x: from.x, y: from.y, h: from.h, vx: dx / T, vy: dy / T, vh: (dh + 0.5 * G * T * T) / T, g: G, life: T + 1.5,
                col: HEX(kind === 'mine' ? '#ffc21a' : '#ffb33a'), toMine: kind === 'mine' }));
            return;
        }
        const dx = px - from.x, dy = py - from.y, dh = ph - from.h, d = Math.hypot(dx, dy, dh) || 1;
        for (let p = 0; p < pellets; p++) {
            const sp = st.spread || 0, ya = (Math.random() - 0.5) * 2 * sp, pa = (Math.random() - 0.5) * sp;
            const c = Math.cos(ya), s = Math.sin(ya);
            let vx = (dx * c - dy * s) / d, vy = (dx * s + dy * c) / d, vh = dh / d + pa;
            const l = Math.hypot(vx, vy, vh); vx /= l; vy /= l; vh /= l;
            const col = rainbow ? HEX(['#ff4040', '#ffd23f', '#40ff70', '#40a0ff', '#c050ff'][Math.floor(Math.random() * 5)]) : HEX(color || '#ffe066');
            this.bullets.push(Object.assign({}, base, {
                x: from.x, y: from.y, h: from.h, vx: vx * st.speed, vy: vy * st.speed, vh: vh * st.speed,
                life: (st.range * 1.2) / st.speed + (kind === 'homing' ? 1.5 : 0), col,
            }));
        }
    },

    updateBullets(dt) {
        const list = this.bullets;
        for (let i = list.length - 1; i >= 0; i--) {
            const b = list[i];
            b.life -= dt;
            // Самонаведение: поворот скорости к цели.
            if (b.kind === 'homing') {
                if (!b.target || b.target.state === 'dead') b.target = this.nearestTarget(b.x, b.y, 700, null);
                const tg = b.target;
                if (tg) {
                    const sp = Math.hypot(b.vx, b.vy, b.vh) || 1;
                    const tx = tg.x - b.x, ty = tg.y - b.y, th = tg.h + tg.height * 0.5 - b.h, tl = Math.hypot(tx, ty, th) || 1;
                    const k = Math.min(1, dt * 5);
                    b.vx += (tx / tl * sp - b.vx) * k; b.vy += (ty / tl * sp - b.vy) * k; b.vh += (th / tl * sp - b.vh) * k;
                    const nl = Math.hypot(b.vx, b.vy, b.vh) || 1; b.vx *= sp / nl; b.vy *= sp / nl; b.vh *= sp / nl;
                }
            }
            const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy, b.vh) * dt / 30));
            let dead = b.life <= 0;
            if (dead && (b.splash || b.toMine)) this.blast(b, b.x, b.y, b.h);
            for (let s = 0; s < steps && !dead; s++) {
                const f = dt / steps;
                if (b.g) b.vh -= b.g * f;
                b.x += b.vx * f; b.y += b.vy * f; b.h += b.vh * f;
                if (b.rocket && Math.random() < 0.5) this.puff(b.x, b.y, b.h);
                // Попадание в монстра (мины и навесные — только при падении).
                if (!b.toMine) for (const m of this.mons) {
                    if (m.state === 'dead' || m.state === 'street') continue;
                    if (b.hit && b.hit.includes(m)) continue;
                    const dx = m.x - b.x, dy = m.y - b.y;
                    const r = m.radius + 10 * b.size;
                    if (dx * dx + dy * dy > r * r) continue;
                    if (b.h < m.h - 10 || b.h > m.h + m.height + 10) continue;
                    if (b.kind === 'sticky') { this.stickies.push({ m, ox: b.x - m.x, oy: b.y - m.y, oh: b.h - m.h, t: 0.7, b }); this.sfx('assets/sounds/splat.ogg', 0.5, 1.4); dead = true; break; }
                    if (b.splash) { this.blast(b, b.x, b.y, b.h); dead = true; break; }
                    const l = Math.hypot(b.vx, b.vy) || 1;
                    if (b.ab) this.abilityHit(b, m, b.vx / l, b.vy / l);
                    else this.damage(m, b.dmg, b.vx / l, b.vy / l, b.knock);
                    this.sparks(b.x, b.y, b.h, b.col, b.beam);
                    if (b.pierce > 0) { b.pierce--; (b.hit || (b.hit = [])).push(m); }
                    else { dead = true; break; }
                }
                if (dead) break;
                // Бочки TNT.
                for (const tn of this.tnts) {
                    if (!tn.alive || b.toMine) continue;
                    if (Math.hypot(tn.x - b.x, tn.y - b.y) < 45 && b.h > tn.h && b.h < tn.h + 110) { this.hitTnt(tn, b.dmg); if (b.splash) this.blast(b, b.x, b.y, b.h); dead = true; break; }
                }
                if (dead) break;
                // Земля / крыша.
                const gr = this.groundAt(b.x, b.y);
                if (b.h <= gr) {
                    if (b.toMine) this.addMine(b, b.x, b.y, gr);
                    else if (b.splash) this.blast(b, b.x, b.y, gr);
                    else this.sparks(b.x, b.y, gr + 4, b.col);
                    dead = true;
                }
            }
            if (dead) { list[i] = list[list.length - 1]; list.pop(); }
        }
        // Липучки: едут на монстре и взрываются.
        for (let i = this.stickies.length - 1; i >= 0; i--) {
            const s = this.stickies[i];
            s.t -= dt;
            if (s.m.state !== 'dead') { s.x = s.m.x + s.ox; s.y = s.m.y + s.oy; s.h = s.m.h + s.oh; }
            if (s.t <= 0 || s.x == null) { if (s.x != null) this.blast(s.b, s.x, s.y, s.h); this.stickies.splice(i, 1); }
        }
        // Мины: взвод 0.4 с, срабатывают от монстра рядом.
        for (let i = this.mines.length - 1; i >= 0; i--) {
            const mn = this.mines[i];
            mn.t += dt;
            if (mn.t > 30) { this.mines.splice(i, 1); continue; }
            if (mn.t < 0.4) continue;
            const hitM = this.mons.some(m => m.state !== 'dead' && m.state !== 'street' && Math.hypot(m.x - mn.x, m.y - mn.y) < 70 && Math.abs(m.h - mn.h) < 60);
            if (hitM) { this.mines.splice(i, 1); this.blast(mn.b, mn.x, mn.y, mn.h + 10); }
        }
        // Горение от способности: урон в секунду, горящие искры.
        for (const m of this.mons) {
            if (!(m.dotT > 0) || m.state === 'dead') continue;
            m.dotT -= dt; m.burnT = 0.2;
            this.damage(m, m.dotDps * dt, 0, 0, 0, true);
            if (Math.random() < dt * 8) this.flashes.push({ x: m.x + (Math.random() - 0.5) * 30, y: m.y + (Math.random() - 0.5) * 30, h: m.h + m.height * (0.3 + Math.random() * 0.6), size: 22 + Math.random() * 18, col: [1, 0.55, 0.15], t: 0, life: 0.35, vh: 140 });
            if (m.state === 'dead' && m.dotBoom) this.explode(m.x, m.y, m.h + 30, 120, m.dotDps, false);
        }
        // Огонь напалма: урон всем внутри, языки пламени.
        for (let i = this.fires.length - 1; i >= 0; i--) {
            const z = this.fires[i];
            z.t -= dt;
            if (z.t <= 0) { this.fires.splice(i, 1); continue; }
            for (const m of this.mons) {
                if (m.state === 'dead' || m.state === 'street') continue;
                if (!m.e.fireproof && Math.hypot(m.x - z.x, m.y - z.y) < z.r && Math.abs(m.h - z.h) < 90) { this.damage(m, z.dps * dt, 0, 0, 0, true); m.burnT = 0.4; }
            }

        }
    },

    // Ядерный гриб: огненный шар, столб и шляпка дыма, обломки крыши, горящая земля.
    nukeFx(x, y, h, R) {
        this.app.fx.play('nuke', [x, h + 20, y]);
        this.sfx('explosionBig', 1, 0.6, 0);
        this.sfx('explosion', 1, 0.5, 0);
        this.sfx('assets/sounds/splat-big.ogg', 0.6, 0.5, 0);
        for (let k = 0; k < 2; k++) this.ring(x, y, h + 8 + k * 30, R * (0.55 + k * 0.3), k ? '#ff9a3a' : '#ffd27a', 0.6 + k * 0.3);
        // Обломки: куски крыши и горящие угли разлетаются вверх и в стороны.
        const rock = ['#a9b3b9', '#8a949b', '#6b747b', '#4a5057'].map(HEX), ember = ['#ff8a1f', '#ffd23f', '#ff4d1f'].map(HEX);
        for (let k = 0; k < 70; k++) {
            const burning = k % 3 === 0;
            this.gib(x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 80, h + 20, burning ? ember[k % 3] : rock[k % 4], 12 + Math.random() * 26, 1150, 2 + Math.random() * 1.6);
        }
        // Горящая земля кольцом вокруг эпицентра.
        for (let k = 0; k < 6; k++) {
            const a = k / 6 * Math.PI * 2, r = R * 0.45;
            const fx = x + Math.cos(a) * r, fy = y + Math.sin(a) * r;
            this.fires.push({ x: fx, y: fy, h: this.groundAt(fx, fy), r: R * 0.32, t: 3.5 + Math.random(), dps: 60 * this.lvl.hpMul });
        }
        this.fires.push({ x, y, h, r: R * 0.4, t: 4.5, dps: 80 * this.lvl.hpMul });
        this.nukes.push({ x, y, h, t: 0, R });
    },

    addMine(b, x, y, h) {
        if (this.mines.length >= 14) this.mines.shift();
        this.mines.push({ x, y, h, t: 0, b });
        this.sfx('assets/sounds/land.ogg', 0.4, 1.5);
    },

    // Разрыв снаряда с особым эффектом: кассета, напалм, заморозка, ядерный.
    blast(b, x, y, h) {
        const nuke = b.burst === 'nuke';
        if (b.ab === 'double' && !b.echo) {
            const n = b.abLv > 1 ? 2 : 1, R = (b.splash || 150) * (b.abLv > 1 ? 1.25 : 1);
            for (let k = 1; k <= n; k++) this.delayed.push({ t: 0.32 * k, run: () => { this.explode(x, y, h, R, b.dmg * 0.6, false); this.ring(x, y, h + 10, R * 1.3, '#ff4848', 0.35); } });
        }
        this.explode(x, y, h, b.splash || 120, b.dmg, nuke || b.splash >= 250);
        if (b.burst === 'cluster') {
            for (let k = 0; k < 6; k++) {
                const a = k / 6 * Math.PI * 2 + Math.random() * 0.5, r = 90 + Math.random() * 150, T = 0.45 + Math.random() * 0.25, G = 1800;
                const tx = x + Math.cos(a) * r, ty = y + Math.sin(a) * r, dh = this.groundAt(tx, ty) - h;
                this.bullets.push({ x, y, h: h + 10, vx: (tx - x) / T, vy: (ty - y) / T, vh: (dh + 0.5 * G * T * T) / T, g: G, life: T + 1, dmg: b.dmg * 0.45, pierce: 0,
                    splash: 100, knock: 200, kind: 'lob', proj: 'bomblet', burst: '', rocket: false, size: 1, col: HEX('#ffb33a'), hit: null, target: null });
            }
        } else if (b.burst === 'fire') {
            this.fires.push({ x, y, h: this.groundAt(x, y), r: (b.splash || 150) * 0.85, t: 3.2, dps: b.dmg * 0.9 });
            this.decal(x, y, this.groundAt(x, y), (b.splash || 150) * 1.4, [0.1, 0.06, 0.04], true);
        } else if (b.burst === 'freeze') {
            for (const m of this.mons) if (m.state !== 'dead' && Math.hypot(m.x - x, m.y - y) < (b.splash || 200) + m.radius) m.slowT = 3.5;
            this.ring(x, y, h + 10, (b.splash || 200) * 1.1, '#9fe8ff', 0.5);
            this.app.fx.play('ice', [x, h + 60, y]);
            this.sprite('ice', x, y, h + 20, (b.splash || 200), (b.splash || 200) * 2.2, 0.5, { mode: 'ground' });
        } else if (nuke) {
            this.nukeFx(x, y, this.groundAt(x, y) || h, b.splash || 520);
        }
    },

    explode(x, y, h, R, dmg, big) {
        this.app.fx.play(R >= 260 ? 'boom-l' : R >= 150 ? 'boom' : 'boom-s', [x, h + 40 + R * 0.25, y]);
        if (R < 260) this.sprite('glow', x, y, h + 40, R * 0.9, R * 1.4, 0.16, { col: [1, 0.7, 0.35] });
        this.ring(x, y, h + 10, R * 1.2, '#ffb33a', 0.3);
        this.sfx(big ? 'explosionBig' : 'explosion', big ? 1 : 0.6, 0.9 + Math.random() * 0.2, 0.06);
        if (big) this.sfx('explosion', 0.7, 0.8, 0.06);
        for (const m of this.mons) {
            if (m.state === 'dead') continue;
            const dx = m.x - x, dy = m.y - y, dh = (m.h + m.height / 2) - h, d = Math.hypot(dx, dy, dh * 0.6);
            if (d < R + m.radius) this.damage(m, dmg * (m.e.blastproof ? 0.35 : 1) * (1 - d / (R + m.radius) * 0.5), dx / (Math.hypot(dx, dy) || 1), dy / (Math.hypot(dx, dy) || 1), 700 * (1 - d / (R + m.radius)) + 200);
        }
        for (const t of this.tnts) if (t.alive && Math.hypot(t.x - x, t.y - y) < R * 0.9) t.chain = 0.15;
        // Взрывы героя не ранят.
        if (this.hero.roof >= 0 && Math.abs(this.roofs[this.hero.roof].h - h) < 60) this.decal(x, y, h, R * 0.85, [0.08, 0.07, 0.07], true);
    },

    // --- ящики, бочки, сундуки -------------------------------------------------------------
    hitBlock(b) {
        b.hp--; b.bump = 1;
        const cols = b.kind === 'crate' ? ['#1a9e96', '#5fd6cf', '#2b3440'] : ['#a8743f', '#6b4423', '#c99459'];
        for (let i = 0; i < 8; i++) this.gib(b.x, b.y, b.h + b.size * 0.6, HEX(cols[i % 3]), 8 + Math.random() * 10, 260);
        this.sfx('crate', 0.8, 0.9 + Math.random() * 0.2);
        if (b.hp > 0) return;
        b.alive = false;
        if (b.rec) this.app.location.removeObject(b.rec);
        b.rec = null;
        for (let i = 0; i < 16; i++) this.gib(b.x, b.y, b.h + b.size * 0.5, HEX(cols[i % 3]), 10 + Math.random() * 16, 420);
        // Ящики выше в стопке опускаются.
        for (const o of this.blocks) if (o.alive && Math.abs(o.x - b.x) < 5 && Math.abs(o.y - b.y) < 5 && o.h > b.h) o.h -= b.size;
        if (b.kind === 'crate') {
            const forced = this.tutDrop;
            this.tutDrop = null;
            if (forced) this.spawnPickup(b.x, b.y, b.h, forced.id, forced.tier);
            else this.spawnPickup(b.x, b.y, b.h, GameData.randomWeapon(GameState.s.owned), this.luckyTier(this.lvl.boxRarity));
            this.emit('crate');
        } else {
            const n = 4 + Math.floor(Math.random() * 4);
            for (let i = 0; i < n; i++) this.dropCoin(b.x, b.y, b.h + 40, Math.ceil(2 * this.lvl.coinMul));
            if (Math.random() < 0.4) this.dropHeart(b.x, b.y, b.h + 40);
        }
    },

    // Редкость оружия из оружейного ящика: база уровня + Везучесть (прокачка, до +100%).
    // Каждый шаг вверх — отдельный бросок: везучесть открывает эпик и легендарку.
    luckyTier(base) {
        const luck = GameState.upValue('luck');
        const p = [base + luck * 0.35, base * 0.25 + luck * 0.2, luck * 0.1, luck * 0.025];
        let tier = 0;
        for (const q of p) { if (Math.random() < q) tier++; else break; }
        return tier;
    },

    hitTnt(t, dmg) {
        if (!t.alive) return;
        t.hp -= dmg; t.bump = 1;
        if (t.hp <= 0) t.chain = t.chain || 0.01;
    },

    explodeTnt(t) {
        if (!t.alive) return;
        t.alive = false;
        if (t.rec) this.app.location.removeObject(t.rec);
        t.rec = null;
        this.explode(t.x, t.y, t.h + 40, 300, 260 * this.lvl.hpMul, true);
        this.emit('tnt');
        for (let i = 0; i < 20; i++) this.gib(t.x, t.y, t.h + 50, HEX(i % 2 ? '#d6231e' : '#3b2b28'), 10 + Math.random() * 14, 600);
    },

    openChest(c) {
        c.open = true;
        if (c.rec) this.app.location.removeObject(c.rec);
        c.rec = null;
        this.app.fx.play('sparkle', [c.x, c.h + 60, c.y]);
        this.sfx('assets/sounds/chest.ogg', 0.9);
        const luck = GameState.upValue('luck');
        const tier = Math.random() < luck * 0.15 ? 4 : Math.random() < 0.35 + luck * 0.3 ? 3 : 2;
        this.spawnPickup(c.x, c.y, c.h, GameData.randomWeapon(GameState.s.owned), tier);
        if (tier >= 4 && this.ui) this.ui.popText(c.x, c.y, c.h + 160, Lang.t('lucky'), '#ffd23a');
        for (let i = 0; i < 8; i++) this.dropCoin(c.x, c.y, c.h + 60, Math.ceil(3 * this.lvl.coinMul));
    },

    updateProps(dt) {
        const loc = this.app.location;
        for (const b of this.blocks) {
            if (!b.alive || !b.rec || !b.rec.mesh) continue;
            b.bump = Math.max(0, b.bump - dt * 5);
            const m = b.rec.mesh, s = b.rec.def.scale, sc = Array.isArray(s) ? s : [s, s, s];
            const cur = m.position.y;
            m.position.y = cur + (b.h - cur) * Math.min(1, dt * 12);
            const k = 1 + Math.sin(b.bump * Math.PI) * 0.18;
            m.scaling.set(sc[0] * k, sc[1] / k, sc[2] * k);
        }
        for (const t of this.tnts) {
            if (!t.alive) continue;
            if (t.chain) { t.chain -= dt; if (t.chain <= 0) { this.explodeTnt(t); continue; } }
            t.bump = Math.max(0, t.bump - dt * 6);
            if (t.rec && t.rec.mesh) { const s = t.rec.def.scale, sc = Array.isArray(s) ? s : [s, s, s], k = 1 + t.bump * 0.12; t.rec.mesh.scaling.set(sc[0] * k, sc[1] / k, sc[2] * k); }
        }
        for (const j of this.jumps) {
            j.squash = Math.max(0, j.squash - dt * 4);
            if (j.rec && j.rec.mesh) { const s = j.rec.def.scale, sc = Array.isArray(s) ? s : [s, s, s], k = 1 - Math.sin(j.squash * Math.PI) * 0.35; j.rec.mesh.scaling.set(sc[0] / Math.sqrt(k), sc[1] * k, sc[2] / Math.sqrt(k)); }
        }
        for (const c of this.chests) if (!c.open && c.rec && c.rec.mesh) c.rec.mesh.position.y = c.h + Math.abs(Math.sin(this.time * 3)) * 8;
        void loc;
    },

    // --- добыча ------------------------------------------------------------------------
    dropCoin(x, y, h, value) {
        if (this.coins.length > 240) return;
        const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 220;
        const k = this.diff ? this.diff.reward : 1;
        this.coins.push({ kind: 'coin', x, y, h, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vh: 450 + Math.random() * 300, value: Math.ceil(value * k), t: 0, rest: false, fly: false });
    },
    dropHeart(x, y, h) {
        this.coins.push({ kind: 'heart', x, y, h, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, vh: 500, value: 0, t: 0, rest: false, fly: false });
    },

    async spawnPickup(x, y, h, id, tier) {
        const it = GameData.ITEMS[id];
        if (!it) return;
        const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 70, R = this.roofs[this.roofAt(x, y)];
        let px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (R) { px = Math.max(R.wx0, Math.min(R.wx1, px)); py = Math.max(R.wy0, Math.min(R.wy1, py)); }
        const p = { id, tier, x: px, y: py, h: h + 20, t: 0, mesh: null, ring: null, label: null, taken: false };
        this.pickups.push(p);
        p.mesh = await GameArt.model(this.scene, it.model, 'pickup');
        if (p.taken || this.pickups.indexOf(p) < 0) { p.mesh.dispose(false, false); return; }
        p.mesh.scaling.set(0.9, 0.9, 0.9);
        World3D.addObject(this.view, p.mesh, 'actor', { ink: false });
        GameArt.applySkin(p.mesh, { tint: it.tint, glow: 0 }, 0);
        const ring = BABYLON.MeshBuilder.CreateDisc('pring', { radius: 70, tessellation: 32 }, this.scene);
        ring.rotation.x = Math.PI / 2;
        ring.material = GameArt.mat(this.scene, GameData.RARITY[tier].color, { unlit: true, alpha: 0.45 });
        p.ring = ring;
        if (this.ui) p.label = this.ui.label(GameData.RARITY[tier].name[Lang.code] || GameData.RARITY[tier].name.en, GameData.RARITY[tier].color);
        this.sfx('assets/sounds/pickup-weapon.ogg', 0.5, 1.2);
    },

    disposePickup(p) {
        p.taken = true;
        if (p.mesh) World3D.removeObject(this.view, p.mesh);
        if (p.ring) p.ring.dispose(false, false);
        if (p.label && this.ui) this.ui.removeLabel(p.label);
        p.mesh = p.ring = p.label = null;
    },

    updatePickups(dt) {
        const H = this.hero, G = this.K.gravity * 0.7;
        const magnet = this.K.magnet * (1 + GameState.upValue('magnet'));
        for (let i = this.coins.length - 1; i >= 0; i--) {
            const c = this.coins[i];
            c.t += dt;
            const dx = H.x - c.x, dy = H.y - c.y, dh = H.h + 60 - c.h, d = Math.hypot(dx, dy);
            if (!c.fly && c.t > 0.35 && d < magnet && Math.abs(dh) < 260 && H.state !== 'dead') c.fly = true;
            if (c.fly) {
                const sp = 900 + c.t * 400, l = Math.hypot(dx, dy, dh) || 1;
                c.x += dx / l * sp * dt; c.y += dy / l * sp * dt; c.h += dh / l * sp * dt;
                if (l < 40) {
                    if (c.kind === 'coin') { this.emit('coin'); this.sprite('coin', H.x + (Math.random() - 0.5) * 50, H.y, H.h + 80 + Math.random() * 40, 30, 60, 0.3, { rot: Math.random() * 6 }); this.levelCoins += c.value; this.sfx('assets/sounds/coin.ogg', 0.35, 0.95 + Math.random() * 0.2, 0.04); }
                    else { H.hp = Math.min(H.maxHp, H.hp + H.maxHp * 0.25); this.sfx('assets/sounds/heart.ogg', 0.7); this.ring(H.x, H.y, H.h + 8, 120, '#ff5a8a', 0.3); this.app.fx.play('heal', [H.x, H.h + 60, H.y]); }
                    this.coins[i] = this.coins[this.coins.length - 1]; this.coins.pop();
                }
                continue;
            }
            if (!c.rest) {
                c.vh -= G * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.h += c.vh * dt;
                const g = this.groundAt(c.x, c.y);
                if (c.h <= g) { c.h = g; if (Math.abs(c.vh) > 200) { c.vh *= -0.4; c.vx *= 0.5; c.vy *= 0.5; } else { c.rest = true; } }
            }
            if (c.t > 25) { this.coins[i] = this.coins[this.coins.length - 1]; this.coins.pop(); }
        }
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            p.t += dt;
            const bob = Math.sin(p.t * 3) * 10;
            if (p.mesh) { p.mesh.position.set(p.x, p.h + 70 + bob, p.y); p.mesh.rotation.set(0, p.t * 2, 0.2); }
            if (p.ring) { p.ring.position.set(p.x, p.h + 3, p.y); const k = 1 + Math.sin(p.t * 5) * 0.08; p.ring.scaling.set(k, k, k); }
            if (p.label && this.ui) this.ui.placeLabel(p.label, p.x, p.y, p.h + 160);
            if (this.mode === 'play' && !H.air && H.state !== 'dead' && Math.hypot(H.x - p.x, H.y - p.y) < 80 && Math.abs(H.h - p.h) < 120 && p.t > 0.4) {
                this.pickups.splice(i, 1);
                this.disposePickup(p);
                this.sfx('assets/sounds/pickup-weapon.ogg', 0.9);
                if (this.ui) { this.frozen = true; this.ui.openBag({ id: p.id, tier: p.tier }); }
                this.emit('pickup');
            }
        }
    },

    // Рюкзак изменился (интерфейс): пересобрать стволы.
    async setBag(bag) {
        this.bag = bag.slice();
        await this.rebuildGuns();
    },

    // --- эффекты ------------------------------------------------------------------------
    killColors() {
        const k = GameData.ITEMS[GameState.equipped('kills')];
        return (k && k.colors ? k.colors : ['#1d4fd8', '#3d8cff']).map(HEX);
    },

    burst(x, y, h, n, speed) {
        const cols = this.killColors();
        for (let i = 0; i < n; i++) this.gib(x, y, h, cols[i % cols.length], 6 + Math.random() * 12, speed);
    },

    gib(x, y, h, col, size, speed, life) {
        if (this.gibs.length > (IS_MOBILE ? 600 : 1300)) this.gibs.shift();
        const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
        this.gibs.push({ x, y, h, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vh: s * (0.4 + Math.random() * 0.9), size, col, t: 0, life: life || 0.8 + Math.random() * 0.9, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 12 });
    },

    trailPuff(x, y, h) {
        const tr = GameData.ITEMS[GameState.equipped('trails')];
        if (!tr || !tr.colors) return;
        const col = HEX(tr.colors[Math.floor(Math.random() * tr.colors.length)]);
        this.flashes.push({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30, h: h + 8 + Math.random() * 10, size: 14 + Math.random() * 10, col, t: 0, life: 0.6, vh: 40 });
    },

    puff(x, y, h) { this.flashes.push({ x, y, h, size: 16, col: [1, 0.6, 0.2], t: 0, life: 0.25, vh: 30 }); },

    sparks(x, y, h, col, energy) {
        if (energy) this.sprite('plasma', x, y, h, 30, 80, 0.14, { rot: Math.random() * 6.28 });
        else this.sprite('spark', x, y, h, 24, 60, 0.1, { rot: Math.random() * 6.28, col: [1, 0.9 + col[1] * 0.1, 0.7 + col[2] * 0.3] });
        for (let i = 0; i < 2; i++) this.gib(x, y, h, col, 4 + Math.random() * 4, 200);
    },

    flashAt(x, y, h, size, hex) { this.flashes.push({ x, y, h, size, col: HEX(hex), t: 0, life: 0.06, vh: 0 }); },

    ring(x, y, h, R, hex, life) { this.sprite('ring', x, y, h, R * 0.5, R * 2.3, life, { mode: 'ground', col: HEX(hex), rot: Math.random() * 6.28 }); },

    // Спрайт эффекта: k — пул this.spr, размер s0 -> s1 за life. opts: mode 'cam' | 'ground' | 'dir'
    // (dx, dy — направление), rot, spin, col, vh — подъём, vx/vy — полёт, fin — доля времени на проявление.
    sprite(k, x, y, h, s0, s1, life, opts) {
        if (this.sprs.length > 400) this.sprs.shift();
        const o = opts || {};
        this.sprs.push({ k, x, y, h, s0, s1, life, t: 0, mode: o.mode || 'cam', dx: o.dx || 1, dy: o.dy || 0, rot: o.rot || 0, spin: o.spin || 0,
            col: o.col || [1, 1, 1], vh: o.vh || 0, vx: o.vx || 0, vy: o.vy || 0, fin: o.fin || 0 });
    },

    // kind: true / 'scorch' — гарь, 'crack' — трещина (гаснет); без kind — кровь по эффекту убийства:
    // синяя кровь и слизь — свои картинки, остальные — общее пятно цвета эффекта.
    decal(x, y, h, size, col, kind) {
        if (this.decals.length > 150) this.decals.shift();
        const kill = GameState.equipped('kills');
        const pk = kind === true || kind === 'scorch' ? 'scorch' : kind === 'crack' ? 'crack' : kill === 'kill-1' ? ['b1', 'b2', 'b3'][Math.floor(Math.random() * 3)] : kill === 'kill-3' ? 'slime' : 'gen';
        this.decals.push({ x, y, h: h + (pk === 'scorch' ? 1 : pk === 'crack' ? 0.8 : 1.5), size, yaw: Math.random() * 6.28, col: col || this.killColors()[0], t: 0, pk, scorch: pk === 'scorch' });
    },

    updateFx(dt) {
        for (let i = this.nukes.length - 1; i >= 0; i--) {
            const n = this.nukes[i];
            n.t += dt;
            if (n.t > 1.6) { this.nukes.splice(i, 1); continue; }
            const k = 1 - n.t / 1.6;
            for (let j = 0; j < 3; j++) {
                const a = Math.random() * Math.PI * 2, r = Math.random() * 45;
                this.flashes.push({ x: n.x + Math.cos(a) * r, y: n.y + Math.sin(a) * r, h: n.h + 20 + Math.random() * 60, size: 60 + Math.random() * 60 * k,
                    col: Math.random() < 0.5 ? [1, 0.55, 0.12] : [1, 0.85, 0.3], t: 0, life: 0.7, vh: 520 + Math.random() * 280 });
            }
        }
        const G = this.K.gravity * 0.8;
        for (let i = this.gibs.length - 1; i >= 0; i--) {
            const g = this.gibs[i];
            g.t += dt;
            if (g.t > g.life) { this.gibs[i] = this.gibs[this.gibs.length - 1]; this.gibs.pop(); continue; }
            if (!g.rest) {
                g.vh -= G * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.h += g.vh * dt; g.rot += g.spin * dt;
                const gr = this.groundAt(g.x, g.y);
                if (g.h <= gr) { g.h = gr + g.size * 0.3; g.rest = true; }
            }
        }
        for (let i = this.flashes.length - 1; i >= 0; i--) {
            const f = this.flashes[i];
            f.t += dt; f.h += (f.vh || 0) * dt;
            if (f.t > f.life) { this.flashes[i] = this.flashes[this.flashes.length - 1]; this.flashes.pop(); }
        }
        for (let i = this.sprs.length - 1; i >= 0; i--) {
            const s = this.sprs[i];
            s.t += dt; s.h += s.vh * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.spin * dt;
            if (s.t >= s.life) { this.sprs[i] = this.sprs[this.sprs.length - 1]; this.sprs.pop(); }
        }
        for (const d of this.decals) d.t += dt;
        for (const list of [this.impacts, this.streaks, this.bolts]) for (let i = list.length - 1; i >= 0; i--) { list[i].t += dt; if (list[i].t >= list[i].life) list.splice(i, 1); }
        for (let i = this.delayed.length - 1; i >= 0; i--) { const d = this.delayed[i]; d.t -= dt; if (d.t <= 0) { this.delayed.splice(i, 1); d.run(); } }
    },

    // --- отрисовка ----------------------------------------------------------------------
    render() {
        const H = this.hero;
        // Монстры: активные + декоративные.
        GameCrowd.begin();
        const it = { x: 0, y: 0, h: 0, heading: 0, pitch: 0, roll: 0, scale: 1, phase: 0, pose: 0, r: 1, g: 1, b: 1 };
        for (const m of this.mons) {
            it.x = m.x; it.y = m.y; it.h = m.h; it.heading = m.heading; it.phase = m.phase;
            it.scale = m.scale * (m.scaleK == null ? 1 : m.scaleK);
            it.pitch = m.state === 'dead' || m.state === 'fall' ? m.pitch : m.state === 'climb' ? -0.1 : m.state === 'float' ? 0.1 : m.e.crawl && m.state === 'roof' ? 1.15 : 0.12;
            it.roll = m.state === 'dead' ? m.roll : 0;
            it.pose = m.state === 'climb' || m.state === 'vault' || m.state === 'leap' ? 1 : m.state === 'dead' ? 3 : m.attack ? 2 : 0;
            if (m.state === 'leap') it.pitch = 0.35;
            const white = m.state === 'dead' ? Math.min(1, m.deadT * 5) : 0;
            const fl = 1 + m.flash * 2.2;
            it.r = (m.tint[0] * (1 - white) + 0.92 * white) * fl; it.g = (m.tint[1] * (1 - white) + 0.9 * white) * fl; it.b = (m.tint[2] * (1 - white) + 0.9 * white) * fl;
            if (m.slowT > 0 && m.state !== 'dead') { it.r *= 0.55; it.g *= 0.85; it.b *= 1.6; }
            if (m.burnT > 0 && m.state !== 'dead') { it.r *= 1.5; it.g *= 0.8; it.b *= 0.5; }
            if (m.state === 'climb' && m.wall) { it.x = m.x; it.y = m.y; }
            GameCrowd.add(m.url, it);
        }
        for (const c of this.crowd) {
            if (!c.e) continue;
            it.x = c.x; it.y = c.y; it.h = c.h; it.heading = c.heading; it.phase = c.phase; it.scale = c.scale;
            it.pitch = c.state === 'drop' ? 0.9 : c.state === 'climb' ? -0.1 : c.e.crawl ? 1.15 : 0.12; it.roll = 0;
            it.pose = c.state === 'climb' ? 1 : c.state === 'drop' ? 3 : 0;
            it.r = c.tint[0]; it.g = c.tint[1]; it.b = c.tint[2];
            GameCrowd.add(c.url, it);
        }
        GameCrowd.end();
        // Монеты и сердца.
        if (this.kindCoin) {
            this.kindCoin.begin(); this.kindHeart.begin();
            const ci = { x: 0, y: 0, h: 0, heading: 0, pitch: 0, roll: 0, scale: 1.1, phase: 0, pose: 4, r: 1, g: 1, b: 1 };
            for (const c of this.coins) {
                ci.x = c.x; ci.y = c.y; ci.h = c.h + (c.rest ? 6 + Math.sin(this.time * 4 + c.x) * 5 : 0); ci.heading = this.time * 4 + c.x * 0.01;
                ci.scale = c.kind === 'coin' ? 0.9 : 1.2;
                (c.kind === 'coin' ? this.kindCoin : this.kindHeart).add(ci);
            }
            this.kindCoin.end(); this.kindHeart.end();
        }
        // Снаряды-модели (ракеты, гранаты, мины, липучки).
        const PK = this.kindProj || {};
        for (const k in PK) PK[k].begin();
        const pi = { x: 0, y: 0, h: 0, heading: 0, pitch: 0, roll: 0, scale: 1, phase: 0, pose: 4, r: 1, g: 1, b: 1 };
        for (const b of this.bullets) {
            const K = b.proj && PK[b.proj];
            if (!K) continue;
            pi.x = b.x; pi.y = b.y; pi.h = b.h; pi.heading = Math.atan2(b.vy, b.vx); pi.pitch = -Math.atan2(b.vh, Math.hypot(b.vx, b.vy));
            pi.roll = b.kind === 'lob' || b.kind === 'mine' ? this.time * 12 : 0; pi.scale = b.proj === 'bomblet' && b.splash > 150 ? 2.2 : 1.3;
            K.add(pi);
        }
        pi.pitch = 0; pi.roll = 0; pi.scale = 1.3;
        if (PK.mine) for (const mn of this.mines) { pi.x = mn.x; pi.y = mn.y; pi.h = mn.h; pi.heading = 0; const bl = mn.t > 0.4 && Math.floor(this.time * 4) % 2 ? 1.6 : 1; pi.r = bl; pi.g = bl; pi.b = bl; PK.mine.add(pi); }
        pi.r = pi.g = pi.b = 1;
        if (PK.sticky) for (const s of this.stickies) if (s.x != null) { pi.x = s.x; pi.y = s.y; pi.h = s.h; pi.heading = this.time * 3; const p = 1 + Math.sin(this.time * 30) * 0.15; pi.scale = 1.3 * p; PK.sticky.add(pi); }
        for (const k in PK) PK[k].end();
        // Пули.
        const T = this.poolTracer; T.begin();
        for (const b of this.bullets) {
            if (b.proj && PK[b.proj]) continue;
            const sp = Math.hypot(b.vx, b.vy, b.vh) || 1;
            const len = Math.min(150, sp * 0.03) * (b.rocket ? 0.5 : 1);
            const w = (b.rocket ? 16 : 5) * b.size;
            T.axis(b.x - b.vx / sp * len * 0.5, b.y - b.vy / sp * len * 0.5, b.h - b.vh / sp * len * 0.5, b.vx, b.vy, b.vh, len, w, b.col[0] * 1.4, b.col[1] * 1.4, b.col[2] * 1.4, 1);
        }
        // Молнии и лучи: ломаная из 4 звеньев, дрожит каждый кадр.
        for (const z of this.bolts) {
            const q = 1 - z.t / z.life, N = z.beam ? 1 : 4;
            let px = z.x0, py = z.y0, ph = z.h0;
            for (let s = 1; s <= N; s++) {
                const f = s / N, j = s < N ? z.jit : 0;
                const nx = z.x0 + (z.x1 - z.x0) * f + (Math.random() - 0.5) * j, ny = z.y0 + (z.y1 - z.y0) * f + (Math.random() - 0.5) * j, nh = z.h0 + (z.h1 - z.h0) * f + (Math.random() - 0.5) * j;
                const dx = nx - px, dy = ny - py, dh = nh - ph, L = Math.hypot(dx, dy, dh) || 1;
                T.axis(px + dx / 2, py + dy / 2, ph + dh / 2, dx, dy, dh, L, z.w * q, z.col[0] * 1.6, z.col[1] * 1.6, z.col[2] * 1.6, 1);
                px = nx; py = ny; ph = nh;
            }
        }
        // Линии скорости удара: вылетают по касательной и сжимаются.

        T.end();
        // Вспышки, следы, кольца.
        const F = this.poolFlash; F.begin();
        for (const f of this.flashes) {
            const k = 1 - f.t / f.life, s = f.size * (0.6 + k * 0.6);
            F.trs(f.x, f.y, f.h, s, s, s, 0, f.col[0] * k, f.col[1] * k, f.col[2] * k, 1);
        }
        // Щит питомца: мерцающий пузырь вокруг героя.
        if (H.shield > 0) {
            const k = 0.14 + (H.shieldHit > 0 ? 0.25 : 0) + Math.sin(this.time * 6) * 0.03, s = 200;
            F.trs(H.x, H.y, H.h + 80, s, s * 1.05, s, 0, 0.25 * k * 3, 0.6 * k * 3, 1 * k * 3, 1);
        }
        F.end();
        // Ошмётки.
        const Gp = this.poolGib; Gp.begin();
        for (const g of this.gibs) {
            const k = g.t > g.life - 0.3 ? (g.life - g.t) / 0.3 : 1, s = g.size * k;
            Gp.trs(g.x, g.y, g.h, s, s, s, g.rot, g.col[0], g.col[1], g.col[2], 1);
        }
        Gp.end();
        // Пятна.
        const DP = this.decalPools, S = this.poolScorch;
        for (const k in DP) DP[k].begin();
        S.begin();
        for (const d of this.decals) {
            const k = Math.min(1, d.t * 8), s = d.size * (0.4 + 0.6 * k);
            if (d.pk === 'scorch') S.trs(d.x, d.y, d.h, s, 1, s, d.yaw, 1, 1, 1, 0.85);
            else if (d.pk === 'crack') DP.crack.trs(d.x, d.y, d.h, s, 1, s, d.yaw, 1, 1, 1, Math.max(0, Math.min(0.9, (7 - d.t) / 2)));
            else if (d.pk === 'gen') DP.gen.trs(d.x, d.y, d.h, s, 1, s, d.yaw, d.col[0], d.col[1], d.col[2], 1);
            else DP[d.pk].trs(d.x, d.y, d.h, s * 1.15, 1, s * 1.15, d.yaw, 1, 1, 1, 1);
        }
        for (const k in DP) DP[k].end();
        S.end();
        // Спрайты эффектов (assets/fx) + постоянные: сияние легендарных стволов и выпавшего оружия.
        const SP = this.spr;
        for (const k in SP) SP[k].begin();
        {
            const cm = this.view.camera.getWorldMatrix().m, cp = this.view.camera.globalPosition;
            const rx = cm[0], ry = cm[1], rz = cm[2], ux = cm[4], uy = cm[5], uz = cm[6], fx = cm[8], fy = cm[9], fz = cm[10];
            const put = (P, mode, x, y, h, s, rot, col, a, dx, dy) => {
                if (mode === 'ground') { const c = Math.cos(rot) * s, sn = Math.sin(rot) * s; P.put(c, 0, sn, -sn, 0, c, 0, 1, 0, x, h, y, col[0], col[1], col[2], a); return; }
                if (mode === 'dir') { const L = s, W = s * 0.5; P.put(dx * L, 0, dy * L, -dy * W, 0, dx * W, 0, 1, 0, x + dx * L * 0.45, h, y + dy * L * 0.45, col[0], col[1], col[2], a); return; }
                const c = Math.cos(rot) * s, sn = Math.sin(rot) * s;
                let ox = cp.x - x, oh = cp.y - h, oy = cp.z - y; const ol = Math.hypot(ox, oh, oy) || 1; ox = ox / ol * 25; oh = oh / ol * 25; oy = oy / ol * 25;
                P.put(rx * c + ux * sn, ry * c + uy * sn, rz * c + uz * sn, -rx * sn + ux * c, -ry * sn + uy * c, -rz * sn + uz * c, fx, fy, fz, x + ox, h + oh, y + oy, col[0], col[1], col[2], a);
            };
            for (const s of this.sprs) {
                const q = s.t / s.life, e = 1 - (1 - q) * (1 - q), sz = s.s0 + (s.s1 - s.s0) * e;
                const a = s.fin && q < s.fin ? q / s.fin : 1 - Math.max(0, (q - (s.fin || 0.25)) / (1 - (s.fin || 0.25)));
                put(SP[s.k], s.mode, s.x, s.y, s.h, sz, s.rot, s.col, a, s.dx, s.dy);
            }
            for (const g of this.guns) {
                if (g.tier < GameData.LEGENDARY) continue;
                const c = HEX(GameData.RARITY[g.tier].color), p = 0.75 + Math.sin(this.time * 5 + g.slot) * 0.25;
                put(SP.glow, 'cam', g.x, g.y, g.h, g.tier >= GameData.MYTHIC ? 150 : 120, 0, c, p);
            }
            for (const p of this.pickups) put(SP.glow, 'cam', p.x, p.y, p.h + 60, 170 + Math.sin(p.t * 5) * 20, 0, HEX(GameData.RARITY[p.tier].color), 0.8);
        }
        for (const k in SP) SP[k].end();
        // Звёзды удара: плоскость к камере, вспухают и гаснут, чуть ближе к камере цели.
        const I = this.poolImpact; I.begin();
        if (this.impacts.length) {
            const cm = this.view.camera.getWorldMatrix().m, cp = this.view.camera.globalPosition;
            const rx = cm[0], ry = cm[1], rz = cm[2], ux = cm[4], uy = cm[5], uz = cm[6], fx = cm[8], fy = cm[9], fz = cm[10];
            for (const p of this.impacts) {
                const q = p.t / p.life, s = p.size * (q < 0.25 ? 0.45 + q / 0.25 * 0.75 : 1.2 + (q - 0.25) * 0.35), al = 1 - Math.max(0, (q - 0.4) / 0.6);
                const c = Math.cos(p.rot + q * 0.6), sn = Math.sin(p.rot + q * 0.6);
                let ox = cp.x - p.x, oh = cp.y - p.h, oy = cp.z - p.y; const ol = Math.hypot(ox, oh, oy) || 1; ox = ox / ol * 60; oh = oh / ol * 60; oy = oy / ol * 60;
                I.put((rx * c + ux * sn) * s, (ry * c + uy * sn) * s, (rz * c + uz * sn) * s, (-rx * sn + ux * c) * s, (-ry * sn + uy * c) * s, (-rz * sn + uz * c) * s, fx, fy, fz, p.x + ox, p.h + oh, p.y + oy, p.col[0], p.col[1], p.col[2], al);
            }
        }
        I.end();
        // Мех-руки: цепочки от рюкзака к стволам.
        const A = this.poolArm; A.begin();
        const arm = GameData.ITEMS[GameState.equipped('arms')];
        const c1 = HEX(arm ? arm.color : '#8c96a3'), c2 = HEX(arm ? arm.color2 : '#4a525c');
        const glow = arm && arm.glow ? 1.4 : 1;
        if (H && H.state !== 'dead') {
            const bx = H.x - Math.cos(H.heading) * 26, by = H.y - Math.sin(H.heading) * 26, bh = H.h + (H.air && H.air.kind === 'zip' ? -95 : 62);
            for (const g of this.guns) {
                const mx = (bx + g.x) / 2, my = (by + g.y) / 2, mh = Math.max(bh, g.h) + 40;
                const N = 6;
                for (let s = 1; s <= N; s++) {
                    const t = s / (N + 1), u = 1 - t;
                    const x = u * u * bx + 2 * u * t * mx + t * t * g.x, y = u * u * by + 2 * u * t * my + t * t * g.y, hh = u * u * bh + 2 * u * t * mh + t * t * (g.h - 6);
                    const sz = 15 - s * 0.9, col = s % 2 ? c1 : c2;
                    A.trs(x, y, hh, sz, sz, sz, 0, col[0] * glow, col[1] * glow, col[2] * glow, 1);
                }
            }
        }
        A.end();
        // Питомец.
        if (this.pet && this.pet.mesh) {
            const P = this.pet;
            P.mesh.position.set(P.x, P.h, P.y);
            P.mesh.rotation.y = Math.PI / 2 - H.heading + Math.sin(P.t * 2) * 0.3;
        }
        // Шлейф удара.
        if (H && H.spinT > 0 && (1 - H.spinT / this.MELEE_T) * this.MELEE_T >= this.MELEE_WIND) {
            const q = (1 - H.spinT / this.MELEE_T), R = H.melee.radius * 1.15;
            this.slash.setEnabled(true);
            this.slash.position.set(H.x, H.h + 62, H.y);
            this.slash.rotation.set(0, Math.PI / 2 - H.heading + H.spin, 0);
            this.slash.scaling.set(R, 1, R);
            const col = BABYLON.Color3.FromHexString(H.melee.color || '#ffffff');
            const mt = /** @type {any} */ (this.slash.material);
            mt.emissiveColor = new BABYLON.Color3(0.75 + col.r * 0.25, 0.75 + col.g * 0.25, 0.75 + col.b * 0.25);
            mt.alpha = Math.min(1, (1 - q) * 2.2);
        } else this.slash.setEnabled(false);
    },

    // --- итог уровня -------------------------------------------------------------------
    win() {
        this.mode = 'win';
        // Оставшиеся монстры падают замертво — финальная волна.
        for (const m of this.mons) if (m.state !== 'dead') { const dx = m.x - this.hero.x, dy = m.y - this.hero.y, d = Math.hypot(dx, dy) || 1; this.kill(m, dx / d, dy / d, 600); }
        this.ring(this.hero.x, this.hero.y, this.hero.h + 10, 600, '#ffe066', 0.6);
        GameMusic.play(null);
        GameMusic.jingle('win');
        const stars = GameData.stars(this.hero.hp / this.hero.maxHp);
        setTimeout(() => { if (this.mode === 'win' && this.ui) this.ui.showWin(this.lvl, stars, this.levelCoins); }, 1400);
    },

    lose() {
        this.mode = 'lose';
        GameMusic.play(null);
        GameMusic.jingle('lose');
        setTimeout(() => { if (this.mode === 'lose' && this.ui) this.ui.showLose(this.lvl, this.kills, !this.revived); }, 1300);
    },

    // Продолжить после смерти (награда за рекламу): здоровье, волна вокруг.
    revive() {
        const H = this.hero;
        this.revived = true;
        H.state = 'walk'; H.hp = H.maxHp * 0.7; H.invul = 2.5; H.deadT = 0;
        this.mode = 'play';
        for (const m of this.mons) {
            if (m.state === 'dead') continue;
            const dx = m.x - H.x, dy = m.y - H.y, d = Math.hypot(dx, dy);
            if (d < 700 && (m.state === 'roof' || m.state === 'vault' || m.state === 'climb')) this.kill(m, dx / (d || 1), dy / (d || 1), 900);
        }
        this.kills = Math.max(0, this.kills);
        this.ring(H.x, H.y, H.h + 10, 700, '#7fe7ff', 0.6);
    },

    // Звук с ограничением частоты (много стволов — не каша).
    sfx(url, volume, rate, gap) {
        const set = typeof url === 'string' && !url.startsWith('assets/') ? GameData.SFX[url] : url;
        if (Array.isArray(set)) url = set[Math.floor(Math.random() * set.length)];
        if (!url) return;
        const now = performance.now(), last = this._soundAt[url] || 0;
        if (now - last < (gap || 0.03) * 1000) return;
        this._soundAt[url] = now;
        Sound.play(url, { volume: volume == null ? 1 : volume, rate: rate || 1 });
    },
};
