// GameState.js — прогресс игрока Backflip Rooftops Survivor: монеты, открытые уровни и звёзды,
// купленные предметы, просмотры рекламы для разблокировки, экипировка, прокачка.
// Хранится через Platform.save/load (облако платформы + Store).

/** @satisfies {Record<string, any>} */
const GameState = {
    /** @type {any} */
    s: null,
    _saveTimer: 0,

    fresh() {
        const owned = [], eq = {};
        for (const sec of GameData.SECTIONS) {
            const free = sec.items.find(it => it.price.type === 'free');
            if (free) { owned.push(free.id); eq[sec.id] = free.id; }
        }
        eq.gun = 'pistol-1';
        return { v: 1, coins: 150, level: 1, stars: {}, owned, ads: {}, eq, up: {}, kills: 0, played: 0 };
    },

    async load() {
        let data = null;
        try { data = await Platform.load(); } catch (e) { console.warn('GameState.load:', (e && e.message) || e); }
        // Игра раньше называлась Shoot Monsters (GAME_ID shootmonsters): локальный прогресс — со старого ключа.
        if (!data && (Platform.name === 'local' || Platform.name === 'yandex')) data = Store.getJSON('shootmonsters.save', null);
        const base = this.fresh();
        const s = data && typeof data === 'object' && data.v === 1 ? data : base;
        // Досыпать поля, которых не было в старом сохранении.
        s.stars = s.stars || {}; s.ads = s.ads || {}; s.up = s.up || {};
        s.owned = Array.isArray(s.owned) ? s.owned : base.owned;
        for (const id of base.owned) if (!s.owned.includes(id)) s.owned.push(id);
        s.eq = Object.assign({}, base.eq, s.eq || {});
        for (const [k, id] of Object.entries(s.eq)) if (!GameData.ITEMS[id] || !s.owned.includes(id)) s.eq[k] = base.eq[k];
        s.coins = Math.max(0, Math.floor(Number(s.coins) || 0));
        s.level = Math.max(1, Math.min(GameData.MAX_LEVEL, Math.floor(Number(s.level) || 1)));
        this.s = s;
        return s;
    },

    // Сохранение — не чаще раза в 400 мс (покупки пачкой, конец уровня).
    save(now) {
        clearTimeout(this._saveTimer);
        const go = () => { Platform.save(this.s); };
        if (now) go(); else this._saveTimer = setTimeout(go, 400);
    },

    get coins() { return this.s.coins; },

    addCoins(n) {
        this.s.coins = Math.max(0, this.s.coins + Math.floor(n));
        this.save();
        window.dispatchEvent(new CustomEvent('sm-coins'));
    },

    owns(id) { return this.s.owned.includes(id); },

    // Сколько просмотров уже накоплено на предмет за рекламу.
    adViews(id) { return this.s.ads[id] || 0; },

    // Покупка за монеты: true — куплено.
    buyCoins(id) {
        const it = GameData.ITEMS[id];
        if (!it || this.owns(id) || it.price.type !== 'coins' || this.s.coins < it.price.value) return false;
        this.s.coins -= it.price.value;
        this.s.owned.push(id);
        this.save(true);
        window.dispatchEvent(new CustomEvent('sm-coins'));
        return true;
    },

    // Засчитать один подтверждённый просмотр. true — предмет открыт.
    addAdView(id) {
        const it = GameData.ITEMS[id];
        if (!it || this.owns(id) || it.price.type !== 'ads') return false;
        this.s.ads[id] = (this.s.ads[id] || 0) + 1;
        const done = this.s.ads[id] >= it.price.value;
        if (done) { this.s.owned.push(id); delete this.s.ads[id]; }
        this.save(true);
        return done;
    },

    // Экипировать: оружие — слот gun (стартовый ствол) или раздел (косметика).
    equip(id) {
        const it = GameData.ITEMS[id];
        if (!it || !this.owns(id)) return false;
        if (it.cls) this.s.eq.gun = id; else this.s.eq[it.section] = id;
        this.save();
        return true;
    },

    equipped(section) { return section === 'gun' ? this.s.eq.gun : this.s.eq[section]; },
    isEquipped(id) {
        const it = GameData.ITEMS[id];
        return !!it && (it.cls ? this.s.eq.gun === id : this.s.eq[it.section] === id);
    },

    upLevel(id) { return this.s.up[id] || 0; },
    upValue(id) {
        const u = GameData.UPGRADES.find(x => x.id === id);
        return u ? this.upLevel(id) * u.per : 0;
    },
    buyUpgrade(id) {
        const u = GameData.UPGRADES.find(x => x.id === id);
        const lvl = this.upLevel(id);
        if (!u || lvl >= u.max) return false;
        const cost = GameData.upgradeCost(id, lvl);
        if (this.s.coins < cost) return false;
        this.s.coins -= cost;
        this.s.up[id] = lvl + 1;
        this.save(true);
        window.dispatchEvent(new CustomEvent('sm-coins'));
        return true;
    },

    // Итог уровня: звёзды (лучшие), открытие следующего.
    finishLevel(n, stars) {
        const prev = this.s.stars[n] || 0;
        if (stars > prev) this.s.stars[n] = stars;
        if (n >= this.s.level && n < GameData.MAX_LEVEL) this.s.level = n + 1;
        this.save(true);
    },

    // --- ежедневный подарок: n — сколько получено всего, last — дата последнего (местная) ---
    today() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); },
    dailyReady() { return !this.s.daily || this.s.daily.last !== this.today(); },
    dailyIndex() { return ((this.s.daily && this.s.daily.n) || 0) % GameData.DAILY.length; },
    // Забрать подарок дня (mult — ×2 за рекламу для монет): { coins } или { item } либо null.
    claimDaily(mult) {
        if (!this.dailyReady()) return null;
        const D = this.s.daily || (this.s.daily = { n: 0, last: '' });
        const g = GameData.DAILY[D.n % GameData.DAILY.length];
        let res;
        if (g.item && GameData.ITEMS[g.item] && !this.owns(g.item)) { this.s.owned.push(g.item); res = { item: g.item }; }
        else { const c = g.coins * (mult || 1); this.s.coins += c; res = { coins: c }; }
        D.n++; D.last = this.today();
        this.save(true);
        window.dispatchEvent(new CustomEvent('sm-coins'));
        return res;
    },

    totalStars() { return Object.values(this.s.stars).reduce((a, b) => a + b, 0); },

    // Сколько предметов открыто в разделе (для бейджей магазина).
    ownedIn(section) {
        const sec = GameData.section(section);
        return sec ? sec.items.filter(it => this.owns(it.id)).length : 0;
    },
};
