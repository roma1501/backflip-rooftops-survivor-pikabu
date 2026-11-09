// Game.js — Backflip Rooftops Survivor: связка мира, интерфейса и платформы. Хуки движка:
// init(app) -> ready() -> update(dt). Меню — живая сцена уровня (герой на крыше,
// орда на стенах), уровень — карта Maps.js (app.loadMap) + GameWorld.buildLevel.
// Реклама: interstitial — по правилу Platform.ads (два результата -> показ по
// кнопке перехода; CrazyGames — не на кнопке меню), в Playables — ещё и по клику по кнопкам интерфейса (GameUI.breakOnClick);
// rewarded — разблокировка в магазине, монеты, ×2, продолжение.

/** @satisfies {Record<string, any>} */
const Game = {
    /** @type {LoryApp | null} */
    app: null,
    world: GameWorld,
    ui: GameUI,
    roundOpen: false,
    levelN: 1,
    _busy: false,

    async init(app) {
        this.app = app;
        // Камера — за героем: ввод камеры игроку не нужен (ЛКМ/тач — джойстик).
        app.camera.detach();
        app.camera.setFree(true);
        await GameState.load();
        await GameWorld.init(app);
        GameWorld.ui = GameUI;
        GameUI.init(this);
        window.addEventListener('resize', () => GameWorld.fitCamera(true));
        // Пауза от платформы (YouTube onPause, Яндекс game_api_pause): свой оверлей «Пауза»
        // поверх любого экрана, без кнопок — снимает его только onResume платформы, игра
        // продолжается сама. Прогресс при паузе — в сохранение.
        Pause.onChange(() => {
            const on = Pause.has('platform');
            if (on === this._platformPaused) return;
            this._platformPaused = on;
            GameUI.platformPause(on);
            if (on) GameState.save(true);
        });
    },
    _platformPaused: false,

    async ready() {
        // Обучение — сразу при первом запуске (старое сохранение с пройденными уровнями — без него).
        if (!GameState.s.tut && GameState.s.level > 1) GameState.s.tut = 1;
        if (!GameState.s.tut) {
            await GameWorld.buildLevel(1, false);
            this.levelN = 1;
            this._tutPending = true;
            GameUI.show('hud');
        } else {
            await GameWorld.buildLevel(GameState.s.level, true);
            GameUI.show('menu');
            Platform.gameplay(false);
            GameMusic.play('menu');
        }
        document.body.classList.remove('boot');
        this.syncScore();
    },

    update(dt) {
        if (this._tutPending) { this._tutPending = false; this.beginTutorial(); }
        GameWorld.input = GameUI.inputVector();
        GameWorld.update(dt);
        GameTutorial.update(dt);
    },

    // Уровень 1 с обучением: без выбора сложности, волны — по шагам обучения.
    beginTutorial() {
        GameWorld.startPlay('normal');
        GameUI.show('hud');
        this.roundOpen = true;
        Platform.gameplay(true);
        GameMusic.play('game');
        GameTutorial.start();
    },

    // Клик по кнопке интерфейса (не игрового процесса): в Playables — запрос interstitial.
    clickBreak() { Platform.ads.click(); },

    // --- переходы --------------------------------------------------------------
    play(n) {
        if (this._busy) return;
        Platform.ads.next(() => this.startLevel(n));
    },

    async startLevel(n) {
        if (this._busy) return;
        this._busy = true;
        try {
            Pause.set('manual', false);
            const cfg = GameData.level(n);
            this.levelN = cfg.n;
            await this.app.loadMap(cfg.map, {
                title: Lang.t('levelN', { n: cfg.n }),
                prepare: async () => {
                    await GameWorld.buildLevel(cfg.n, false);
                    if (!GameState.s.tut && cfg.n === 1) { this._tutPending = true; GameUI.show('hud'); } else GameUI.showDiff(GameWorld.lvl);
                },
                gameplay: false,
            });
        } catch (e) {
            console.warn('startLevel:', e);
        } finally {
            this._busy = false;
        }
    },

    // Выбрана сложность на оверлее: раунд начался.
    beginLevel(diffId) {
        if (GameWorld.mode !== 'ready') return;
        GameState.s.diff = diffId;
        GameState.save();
        GameWorld.startPlay(diffId);
        GameUI.show('hud');
        this.roundOpen = true;
        Platform.gameplay(true);
        GameMusic.play('game', this.levelN);
        GameMusic.jingle('start');
        const d = GameWorld.diff;
        GameUI.toast(Lang.t('levelN', { n: this.levelN }) + (d.id !== 'normal' ? ' · ' + Lang.t('diff_' + d.id) : ''), d.id === 'normal' ? '#ffcf2e' : d.color);
    },

    // Итог раунда: один раз на раунд (движок считает interstitial по результатам).
    levelFinished(win, stars, coins) {
        if (!this.roundOpen) return;
        GameTutorial.stop();
        this.roundOpen = false;
        Platform.ads.roundEnded();
        Platform.levelEnd(win, this.levelN);
        Platform.gameplay(false);
        GameState.s.played = (GameState.s.played || 0) + 1;
        if (win) {
            GameState.finishLevel(this.levelN, stars);
            GameState.addCoins(coins + Math.round(GameData.level(this.levelN).reward * (GameWorld.diff ? GameWorld.diff.reward : 1)));
        }
        this.syncScore();
        GameState.save(true);
    },

    // Рекорд платформы (лидерборд Score) — всего убито монстров за всю игру.
    syncScore() { Platform.submitScore(GameState.s.kills || 0); },

    // Поражение закрывает раунд при уходе с экрана (продолжение за рекламу — тот же раунд).
    closeLost() {
        if (GameWorld.mode === 'lose' && this.roundOpen) {
            GameState.addCoins(GameWorld.levelCoins);
            this.levelFinished(false, 0, 0);
        }
    },

    next() {
        const n = Math.min(GameData.MAX_LEVEL, this.levelN + 1);
        if (this.levelN >= GameData.MAX_LEVEL) { this.toMenu(); return; }
        Platform.ads.next(() => this.startLevel(n));
    },

    restart() {
        GameTutorial.stop();
        this.closeLost();
        Pause.set('manual', false);
        Platform.ads.next(() => this.startLevel(this.levelN));
    },

    toMenu() {
        GameTutorial.stop();
        this.closeLost();
        this.syncScore();
        Pause.set('manual', false);
        Platform.ads.next(async () => {
            this.roundOpen = false;
            Platform.gameplay(false);
            const cfg = GameData.level(GameState.s.level);
            await this.app.loadMap(cfg.map, { title: GAME_TITLE, prepare: async () => { await GameWorld.buildLevel(GameState.s.level, true); GameUI.show('menu'); }, gameplay: false });
            GameMusic.play('menu');
        }, true);
    },

    revive() {
        GameWorld.revive();
        GameMusic.play(GameWorld.boss && GameWorld.boss.state !== 'dead' ? 'boss' : 'game', this.levelN);
        GameUI.show('hud');
        Platform.gameplay(true);
    },

    pause(on) {
        if (on && GameWorld.mode !== 'play') return;
        Pause.set('manual', on);
        GameUI.show(on ? 'pause' : 'hud');
    },

    shopClosed() { GameUI.show('menu'); },

    // Магазин скинов: сцена меню крупным планом, выбранный скин — примерка на герое.
    openSkins() {
        if (GameWorld.mode !== 'menu') return;
        GameUI.skSel = '';
        GameWorld.showcase = true;
        GameUI.show('skins');
    },
    closeSkins() {
        GameWorld.showcase = false;
        if (GameWorld.previewHero) { GameWorld.previewHero = null; this.equipmentChanged(); }
        GameUI.show('menu');
    },
    previewSkin(id) {
        GameWorld.previewHero = GameState.equipped('heroes') === id ? null : id;
        this.equipmentChanged();
    },

    // Купили/надели предмет в меню: герой на крыше переодевается сразу.
    equipmentChanged() {
        this._eq = (this._eq || Promise.resolve()).then(() => this.rebuildMenuHero()).catch(e => console.warn('equip:', e));
        return this._eq;
    },
    async rebuildMenuHero() {
        if (GameWorld.mode !== 'menu' || !GameWorld.hero) return;
        const H = GameWorld.hero;
        const x = H.x, y = H.y, h = H.h, roof = H.roof;
        GameWorld.disposeHero();
        await GameWorld.buildHero(x, y, h, roof);
        GameWorld.bag = new Array(9).fill(null);
        GameWorld.bag[4] = { id: GameState.equipped('gun'), tier: 0 };
        await GameWorld.rebuildGuns();
    },
};
