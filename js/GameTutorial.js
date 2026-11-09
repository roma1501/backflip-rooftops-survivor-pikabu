// GameTutorial.js — обучение при первом запуске: уровень 1, шаги по всем механикам.
// Шаг — карточка сверху (демо, заголовок, текст), стрелка и кольцо над целью в мире,
// свои зомби (выходят на крышу героя). Шаг закрывает настоящее действие игрока:
// событие GameWorld.emit (удар, ящик, рюкзак, TNT, прыжок…) или условие poll.
// Пока идёт обучение, волны уровня стоят (tutHold), а герой не падает ниже 50% HP
// (tutSafe); последний шаг включает волны — дальше обычный уровень 1.

/** @satisfies {Record<string, any>} */
const GameTutorial = {
    active: false,
    i: -1,
    ringT: 0,
    /** @type {any} */
    st: null,
    /** @type {any[]} */
    steps: [],
    bagSeen: false,        // рюкзак уже показан (ящик разбит раньше своего шага)
    inter: false,          // вставка «Рюкзак» поверх текущего шага

    start() {
        const W = GameWorld;
        this.active = true;
        W.tutHold = true; W.tutSafe = true;
        // Первый же оружейный ящик даёт копию стартового ствола — чтобы показать слияние.
        W.tutDrop = { id: GameState.equipped('gun'), tier: 0 };
        this.bagSeen = false; this.inter = false;
        GameUI.$('#h-hint').classList.remove('on');
        this.steps = this.build();
        this.i = -1;
        this.next();
    },

    // Шаги: enter(st) — подготовка, target(st) — точка стрелки, poll(st) — условие,
    // on — события и сколько раз, auto — секунд до перехода, skip() — шага нет на этой крыше.
    build() {
        const W = GameWorld, H = () => W.hero;
        const onRoof = (list) => list.filter(o => o.roof === H().roof);
        return [
            { id: 'move', demo: 'move', enter: (s) => { s.x = H().x; s.y = H().y; }, poll: (s) => Math.hypot(H().x - s.x, H().y - s.y) > 200 },
            { id: 'shoot', demo: 'shoot', enter: (s) => { s.k = W.kills; this.spawnEdge(3); }, poll: (s) => W.kills - s.k >= 3,
                retry: (s) => { if (!this.aliveOnRoof()) this.spawnEdge(Math.max(1, 3 - (W.kills - s.k))); } },
            { id: 'melee', demo: 'melee', enter: () => this.spawnAround(H().x, H().y, 4, 300), on: { melee: 1 },
                retry: () => { if (!this.aliveOnRoof()) this.spawnAround(H().x, H().y, 3, 260); } },
            { id: 'crate', demo: 'crate', on: { pickup: 1 }, skip: () => this.bagSeen,
                enter: (s) => {
                    s.b = W.pickups.length ? null : this.nearest(onRoof(W.blocks.filter(b => b.alive && b.kind === 'crate')));
                    if (!s.b && !W.pickups.length) { W.spawnPickup(H().x + 170, H().y, H().h, GameState.equipped('gun'), 0); W.tutDrop = null; }
                },
                target: (s) => s.b && s.b.alive ? { x: s.b.x, y: s.b.y, h: s.b.h + s.b.size } : this.pickupTarget() },
            { id: 'bag', demo: 'bag', on: { 'bag-done': 1 }, skip: () => this.bagSeen, enter: () => { this.bagSeen = true; } },
            { id: 'tnt', demo: 'tnt', on: { tnt: 1 },
                skip: () => !this.nearest(onRoof(W.tnts.filter(t => t.alive))),
                enter: (s) => { s.t = this.nearest(onRoof(W.tnts.filter(t => t.alive))); this.spawnAround(s.t.x, s.t.y, 5, 150); },
                target: (s) => s.t.alive ? { x: s.t.x, y: s.t.y, h: s.t.h + 130 } : null },
            { id: 'jump', demo: 'jump', on: { land: 1 },
                skip: () => !this.nearest(onRoof(W.jumps.filter(j => j.target >= 0))),
                enter: (s) => { s.j = this.nearest(onRoof(W.jumps.filter(j => j.target >= 0))); },
                target: (s) => H().air ? null : { x: s.j.x, y: s.j.y, h: s.j.h + 70 } },
            { id: 'zip', demo: 'zip', on: { 'zip-land': 1 },
                skip: () => !this.nearest(onRoof(W.zips.filter(z => z.pair))),
                enter: (s) => { s.z = this.nearest(onRoof(W.zips.filter(z => z.pair))); },
                target: (s) => H().air ? null : { x: s.z.x, y: s.z.y, h: s.z.h + 250 } },
            { id: 'coins', demo: 'coins', enter: () => this.spawnEdge(4), on: { coin: 3 }, auto: 9 },
            { id: 'fight', demo: 'fight', final: true, auto: 5,
                enter: () => { W.tutHold = false; W.tutSafe = false; GameState.s.tut = 1; GameState.save(); } },
        ];
    },

    next() {
        while (++this.i < this.steps.length) {
            const s = this.steps[this.i];
            if (s.skip && s.skip()) continue;
            this.st = { cnt: {}, t: 0, rt: 3 };
            if (s.enter) s.enter(this.st);
            this.card(s);
            Sound.play('assets/sounds/confirm.ogg', { volume: 0.5 });
            return;
        }
        this.stop();
    },

    card(s) {
        const txt = 'tut_' + s.id + (s.id === 'move' && IS_MOBILE ? 'M' : '') + 'T';
        GameUI.tutCard({ n: this.steps.indexOf(s) + 1, total: this.steps.length, title: Lang.t('tut_' + s.id), text: Lang.t(txt), demo: s.demo });
    },

    update(dt) {
        if (!this.active || this.inter) return;
        const s = this.steps[this.i], W = GameWorld;
        if (!s || !W.hero || W.mode !== 'play') { GameUI.tutArrow(null); return; }
        const st = this.st;
        st.t += dt;
        const tg = s.target ? s.target(st) : null;
        GameUI.tutArrow(tg);
        if (tg && !W.frozen) {
            this.ringT -= dt;
            if (this.ringT <= 0) { this.ringT = 0.8; W.ring(tg.x, tg.y, W.groundAt(tg.x, tg.y) + 6, 110, '#ffd23a', 0.7); }
        }
        if (s.retry && !W.frozen) { st.rt -= dt; if (st.rt <= 0) { st.rt = 3; s.retry(st); } }
        if ((s.poll && s.poll(st)) || (s.auto && st.t >= s.auto)) this.complete();
    },

    // Событие мира: шаг закрывается, когда набрано нужное число.
    event(ev) {
        const s = this.steps[this.i];
        // Оружие подобрано раньше своего шага: вставка «Рюкзак», потом — текущий шаг.
        if (ev === 'pickup' && s && s.id !== 'crate' && !this.bagSeen) {
            this.bagSeen = true; this.inter = true;
            GameUI.tutArrow(null);
            this.card(this.steps.find(x => x.id === 'bag'));
            return;
        }
        if (ev === 'bag-done' && this.inter) { this.inter = false; if (s) this.card(s); return; }
        if (!s || !s.on || !s.on[ev]) return;
        const c = this.st.cnt[ev] = (this.st.cnt[ev] || 0) + 1;
        if (c >= s.on[ev]) this.complete();
    },

    complete() {
        const s = this.steps[this.i], H = GameWorld.hero;
        if (s && s.final) { this.stop(); return; }
        if (H) GameUI.popText(H.x, H.y, H.h + 200, Lang.t('tutGood'), '#7fd34e');
        this.next();
    },

    stop() {
        if (!this.active) return;
        const W = GameWorld;
        this.active = false;
        W.tutHold = false; W.tutSafe = false; W.tutDrop = null;
        GameUI.tutCard(null);
    },

    skip() {
        GameState.s.tut = 1;
        GameState.save();
        this.stop();
    },

    // --- зомби обучения: выходят на крышу героя из-за края -------------------------------
    spawnAt(x, y) {
        const W = GameWorld, H = W.hero, r = W.roofs[H.roof];
        if (!r) return null;
        const m = W.spawnMonster('walker');
        if (!m) return null;
        m.state = 'roof'; m.roof = H.roof; m.target = H.roof;
        m.x = Math.max(r.wx0, Math.min(r.wx1, x)); m.y = Math.max(r.wy0, Math.min(r.wy1, y)); m.h = r.h; m.vh = 0;
        W.app.fx.play('dust', [m.x, m.h + 10, m.y]);
        return m;
    },
    // По краю крыши на стороне, дальней от героя.
    spawnEdge(n) {
        const W = GameWorld, H = W.hero, r = W.roofs[H.roof];
        if (!r) return;
        const base = Math.atan2(r.y - H.y, r.x - H.x);
        for (let k = 0; k < n; k++) {
            const a = base + (k - (n - 1) / 2) * 0.45;
            this.spawnAt(r.x + Math.cos(a) * r.w * 0.46, r.y + Math.sin(a) * r.d * 0.46);
        }
    },
    spawnAround(x, y, n, R) {
        for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + 0.3; this.spawnAt(x + Math.cos(a) * R, y + Math.sin(a) * R); }
    },
    aliveOnRoof() {
        const W = GameWorld;
        return W.mons.filter(m => m.state !== 'dead' && m.roof === W.hero.roof).length;
    },
    nearest(list) {
        const H = GameWorld.hero;
        let best = null, bd = Infinity;
        for (const o of list) { const d = Math.hypot(o.x - H.x, o.y - H.y); if (d < bd) { bd = d; best = o; } }
        return best;
    },
    pickupTarget() {
        const p = GameWorld.pickups[0];
        return p ? { x: p.x, y: p.y, h: p.h + 120 } : null;
    },
};
