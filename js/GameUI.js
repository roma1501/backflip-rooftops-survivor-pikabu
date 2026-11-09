// GameUI.js — интерфейс Backflip Rooftops Survivor (DOM поверх #world3d): меню, карта 100
// уровней, магазин (разделы оружия и косметики, прокачка, бесплатные монеты),
// HUD, рюкзак 3×3 с перетаскиванием и слиянием, пауза, победа/поражение,
// джойстик. Тексты — Lang, стили — в index.html.

/** @satisfies {Record<string, any>} */
const GameUI = {
    /** @type {HTMLElement | null} */
    root: null,
    /** @type {any} */
    game: null,
    screen: '',
    shopTab: 'pistol',
    shopSel: '',
    _hud: {},
    joy: { id: -1, x: 0, y: 0, dx: 0, dy: 0, active: false },
    _labels: new Set(),
    _dmgPool: [],
    _dmgI: 0,

    $(sel, root) { return /** @type {HTMLElement} */ ((root || this.root).querySelector(sel)); },
    esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },
    name(obj) { return obj ? (obj[Lang.code] || obj.en || '') : ''; },
    fmt(n) { n = Math.floor(n); return n >= 100000 ? Math.round(n / 1000) + 'K' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); },
    click() { Sound.play('assets/sounds/click.ogg', { volume: 0.6 }); },

    init(game) {
        this.game = game;
        const root = document.createElement('div');
        root.id = 'ui';
        root.innerHTML = this.template();
        document.body.appendChild(root);
        this.root = root;
        Lang.apply(root);
        root.addEventListener('click', (e) => {
            const t = /** @type {HTMLElement} */ (e.target).closest('[data-act]');
            if (!t || t.hasAttribute('disabled')) return;
            const el = /** @type {HTMLElement} */ (t);
            if (this.breakOnClick(el.dataset.act, el)) this.game.clickBreak();
            this.act(el.dataset.act, el);
        });
        window.addEventListener('sm-coins', () => this.refreshCoins());
        this.initJoystick();
        for (let i = 0; i < 24; i++) { const d = document.createElement('div'); d.className = 'dmg'; this.$('#dmg-layer').appendChild(d); this._dmgPool.push(d); }
        this.refreshCoins();
        this.refreshSound();
    },

    template() {
        const ic = (n) => `<i class="ic ic-${n}"></i>`;
        return `
<div id="scr-menu" class="scr">
  <div class="topbar">
    <div class="pill coins"><i class="coin"></i><b class="coin-val">0</b><button class="plus" data-act="freecoins"><img src="assets/ui/plus.png" alt=""></button></div>
    <div class="grow"></div>
    <div class="pill stars">${ic('star')}<b id="m-stars">0</b></div>
    <button class="round lbbtn" data-act="leaders"><img src="assets/ui/trophy.png" alt=""></button>
    <button class="round gift" data-act="daily"><img src="assets/ui/gift.png" alt=""><span class="dot" id="m-giftdot"></span></button>
    <button class="round" data-act="sound">${ic('audioon')}</button>
  </div>
  <div class="logo">${GAME_TITLE.toUpperCase().split(/\s+/).map((w, i) => `<div class="l${i + 1}">${w}</div>`).join('')}<div class="tag" data-t="tagline"></div></div>
  <div class="menu-bottom">
    <button class="btn big green pulse" data-act="play"><span data-t="play"></span><small id="m-level"></small></button>
    <div class="row">
      <button class="btn blue" data-act="levels">${ic('menugrid')}<span data-t="levels"></span></button>
      <button class="btn orange" data-act="shop">${ic('shoppingcart')}<span data-t="shop"></span><span class="dot" id="m-shopdot"></span></button>
      <button class="btn pink" data-act="skins"><img class="bimg" src="assets/ui/btn-skins.png" alt=""><span data-t="skins"></span><span class="new">NEW</span></button>
      <button class="btn purple" data-act="upgrades">${ic('arrowup')}<span data-t="upgrades"></span></button>
    </div>
  </div>
</div>

<div id="scr-levels" class="scr panel-scr">
  <div class="head"><button class="round back" data-act="menu">${ic('left')}</button><h2 data-t="levels"></h2><div class="pill stars">${ic('star')}<b id="l-stars">0</b></div></div>
  <div class="lv-scroll"><div id="lv-list"></div></div>
</div>

<div id="scr-shop" class="scr panel-scr">
  <div class="head"><button class="round back" data-act="shop-close">${ic('left')}</button><h2 data-t="shop"></h2><div class="pill coins"><i class="coin"></i><b class="coin-val">0</b></div></div>
  <div class="shop-body">
    <div class="tabs" id="shop-tabs"></div>
    <div class="shop-main">
      <div class="shop-title"><h3 id="shop-sec"></h3><span id="shop-count"></span></div>
      <div class="grid" id="shop-grid"></div>
    </div>
    <div class="detail" id="shop-detail"></div>
  </div>
</div>

<div id="scr-skins" class="scr">
  <div class="sk-head"><button class="round back" data-act="skins-close">${ic('left')}</button><h2><img class="h2i" src="assets/ui/tab-heroes.png" alt=""><span data-t="skins"></span></h2><div class="pill coins"><i class="coin"></i><b class="coin-val">0</b></div></div>
  <div class="sk-panel">
    <div class="sk-filters" id="sk-filters"></div>
    <div class="sk-grid" id="sk-grid"></div>
    <div class="sk-bar" id="sk-bar"></div>
  </div>
</div>

<div id="scr-diff" class="scr overlay">
  <div class="diff-wrap">
    <h2 id="d-title"></h2>
    <div class="dsub" data-t="diffPick"></div>
    <div class="diffs" id="d-list"></div>
  </div>
</div>

<div id="scr-hud" class="scr">
  <div id="touch"></div>
  <div class="hud-top">
    <div class="hp"><i class="heart"></i><div class="bar"><div class="fill" id="h-hp"></div><span id="h-hpt"></span></div></div>
    <div class="prog"><div class="lvl" id="h-lvl"></div><div class="bar"><div class="fill" id="h-prog"></div><span id="h-progt"></span></div></div>
    <div class="right"><div class="pill coins small"><i class="coin"></i><b id="h-coins">0</b></div><button class="round" data-act="pause">${ic('pause')}</button></div>
  </div>
  <div class="boss" id="h-boss"><div class="bname"><img src="assets/ui/boss.png" alt=""><span data-t="bossName"></span></div><div class="bar"><div class="fill" id="h-bossfill"></div></div></div>
  <div class="petab" id="h-pet"><div class="pring"><img id="h-petimg" alt=""></div><b id="h-petname"></b></div>
  <button class="bagbtn" data-act="bag"><div class="mini" id="h-bag"></div><span class="bl"><img src="assets/ui/backpack.png" alt=""><span data-t="backpack"></span></span></button>
  <div class="joy" id="joy"><div class="knob"></div></div>
  <div class="hint" id="h-hint"></div>
</div>

<div id="scr-bag" class="scr overlay">
  <div class="bag-wrap">
    <h2><img class="h2i" src="assets/ui/backpack.png" alt=""><span data-t="backpack"></span></h2>
    <div class="bag"><div class="cells" id="bag-cells"></div></div>
    <div class="tray" id="bag-tray"></div>
    <div class="bag-hint" data-t="bagHint"></div>
    <div class="row">
      <button class="btn blue" data-act="bag-auto">${ic('auto')}<span data-t="auto"></span></button>
      <button class="btn red" data-act="bag-sell" id="bag-sell">${ic('trashcan')}<span id="bag-sell-t"></span></button>
      <button class="btn green" data-act="bag-done" id="bag-done"><span data-t="done"></span></button>
    </div>
  </div>
  <div class="ghost" id="bag-ghost"></div>
</div>

<div id="scr-pause" class="scr overlay">
  <div class="card">
    <h2 data-t="pause"></h2>
    <button class="btn green big" data-act="resume"><span data-t="resume"></span></button>
    <div class="row">
      <button class="btn blue" data-act="restart">${ic('return')}<span data-t="restart"></span></button>
      <button class="btn orange" data-act="to-menu">${ic('home')}<span data-t="menu"></span></button>
      <button class="round" data-act="sound">${ic('audioon')}</button>
    </div>
  </div>
</div>

<div id="scr-result" class="scr overlay">
  <div class="card result">
    <div class="rtitle" id="r-title"></div>
    <div class="rstars" id="r-stars"></div>
    <div class="rinfo" id="r-info"></div>
    <div class="rbtns" id="r-btns"></div>
  </div>
</div>

<div id="tut" class="tut"><div class="tcard"><div class="tdemo" id="t-demo"></div><div class="ttext"><div class="tstep" id="t-step"></div><b id="t-title"></b><span id="t-text"></span></div>
  <button class="tskip" data-act="tut-skip" data-t="tutSkip"></button></div></div>
<div id="tut-arrow" class="tarrow"><i></i></div>

<div id="scr-tips" class="scr overlay">
  <div class="card tips">
    <h2 data-t="tipsTitle"></h2>
    <div class="tip"><i class="ic ic-shoppingcart" style="--c:var(--orange)"></i><div><b data-t="shop"></b><span data-t="tipShop"></span></div></div>
    <div class="tip"><img src="assets/ui/btn-skins.png" alt=""><div><b data-t="skins"></b><span data-t="tipSkins"></span></div></div>
    <div class="tip"><i class="ic ic-arrowup" style="--c:var(--purple)"></i><div><b data-t="upgrades"></b><span data-t="tipUp"></span></div></div>
    <div class="tip"><img src="assets/ui/diff-hard.png" alt=""><div><b data-t="diffLabel"></b><span data-t="tipDiff"></span></div></div>
    <button class="btn green big" data-act="tips-ok"><span data-t="tipsOk"></span></button>
  </div>
</div>

<div id="scr-daily" class="scr overlay">
  <div class="card daily">
    <button class="round dclose" data-act="daily-close">${ic('left')}</button>
    <img class="dgift" src="assets/ui/gift.png" alt="">
    <h2 data-t="dailyTitle"></h2>
    <div class="dsub" data-t="dailySub"></div>
    <div class="days" id="daily-days"></div>
    <div class="rbtns" id="daily-btns"></div>
  </div>
</div>

<div id="scr-leaders" class="scr overlay">
  <div class="card leaders">
    <button class="round dclose" data-act="leaders-close">${ic('left')}</button>
    <img class="lbtrophy" src="assets/ui/trophy.png" alt="">
    <h2 data-t="leaders"></h2>
    <div class="dsub" data-t="leadersSub"></div>
    <div class="lb-me"><img src="assets/ui/skull.png" alt=""><span data-t="lbMine"></span><b id="lb-mine">0</b></div>
    <div class="lb-list" id="lb-list"></div>
    <div class="lb-note" id="lb-note"></div>
    <div class="rbtns" id="lb-btns"></div>
  </div>
</div>

<div id="ppause" class="ppause"><div class="ppcard"><i class="ic ic-pause"></i><h2 data-t="pause"></h2></div></div>

<div id="toast"></div>
<div id="labels"></div>
<div id="dmg-layer"></div>`;
    },

    // --- экраны ---------------------------------------------------------------
    show(name) {
        this.screen = name;
        this.root.dataset.scr = name;   // CSS: цифры урона живого меню не лезут поверх окон
        for (const el of this.root.querySelectorAll('.scr')) el.classList.toggle('on', el.id === 'scr-' + name || (name === 'bag' && el.id === 'scr-hud') || ((name === 'pause' || name === 'result') && el.id === 'scr-hud'));
        if (name === 'menu') this.renderMenu();
        if (name === 'levels') this.renderLevels();
        if (name === 'shop') this.renderShop();
        if (name === 'hud') this.resetHud();
        if (name === 'skins') this.renderSkins();
    },

    // Кнопки без interstitial по клику (Playables, Game.clickBreak): игровой процесс —
    // HUD, пауза, рюкзак, выбор сложности, обучение — и rewarded-предложения (свой ролик).
    // Пока идёт раунд, interstitial зовут только кнопки выхода из него.
    IN_PLAY: new Set(['pause', 'resume', 'bag', 'bag-auto', 'bag-sell', 'bag-done', 'tut-skip', 'diff', 'revive', 'double', 'daily-x2', 'rw-coins']),
    breakOnClick(a, el) {
        if (!a || this.IN_PLAY.has(a) || el.classList.contains('rwbtn')) return false;
        return this.game.world.mode !== 'play' || a === 'restart' || a === 'to-menu';
    },

    act(a, el) {
        const G = this.game;
        this.click();
        switch (a) {
            case 'play': G.play(GameState.s.level); break;
            case 'levels': this.show('levels'); break;
            case 'skins': G.openSkins(); break;
            case 'skins-close': G.closeSkins(); break;
            case 'sk-filter': this.skFilter = el.dataset.f; this.renderSkins(); break;
            case 'sk-item': this.skSel = el.dataset.id; this.renderSkins(); G.previewSkin(el.dataset.id); break;
            case 'diff': G.beginLevel(el.dataset.d); break;
            case 'tut-skip': GameTutorial.skip(); break;
            case 'tips-ok': GameState.s.tips = 1; GameState.save(); this.show('menu'); break;
            case 'daily': this.showDaily(); break;
            case 'daily-close': clearInterval(this._dailyTimer); this.show('menu'); break;
            case 'daily-claim': this.claimDaily(1, el); break;
            case 'daily-x2': this.claimDaily(2, el); break;
            case 'leaders': this.showLeaders(); break;
            case 'leaders-close': this.show('menu'); break;
            case 'lb-login': this.lbLogin(el); break;
            case 'shop': this.shopTab = this.shopTab === 'upgrades' ? 'pistol' : this.shopTab; this.show('shop'); break;
            case 'upgrades': this.shopTab = 'upgrades'; this.show('shop'); break;
            case 'freecoins': this.shopTab = 'free'; this.show('shop'); break;
            case 'menu': this.show('menu'); break;
            case 'shop-close': G.shopClosed(); break;
            case 'sound': Sound.toggleMuted(); this.refreshSound(); break;
            case 'level': G.play(Number(el.dataset.n)); break;
            case 'tab': this.shopTab = el.dataset.tab; this.shopSel = ''; this.renderShop(); break;
            case 'item': this.shopSel = el.dataset.id; this.renderShopGrid(); this.renderDetail(); break;
            case 'buy': this.buy(el.dataset.id); break;
            case 'equip':
                GameState.equip(el.dataset.id); Sound.play('assets/sounds/confirm.ogg', { volume: 0.7 });
                if (this.screen === 'skins') { G.world.previewHero = null; this.renderSkins(); } else { this.renderShopGrid(); this.renderDetail(); }
                G.equipmentChanged(); break;
            case 'upgrade': this.buyUpgrade(el.dataset.id); break;
            case 'rw-coins': this.adCoins(); break;
            case 'pause': G.pause(true); break;
            case 'resume': G.pause(false); break;
            case 'restart': G.restart(); break;
            case 'to-menu': G.toMenu(); break;
            case 'bag': if (G.world.mode === 'play' && !G.world.frozen) { G.world.frozen = true; this.openBag(null); } break;
            case 'bag-auto': this.bagAuto(); break;
            case 'bag-sell': this.bagSell(); break;
            case 'bag-done': this.bagDone(); break;
            case 'next': G.next(); break;
            case 'retry': G.restart(); break;
            case 'revive': this.revive(el); break;
            case 'double': this.double(el); break;
            default: break;
        }
    },

    refreshCoins() {
        if (!GameState.s) return;
        for (const el of this.root.querySelectorAll('.coin-val')) el.textContent = this.fmt(GameState.s.coins);
    },

    refreshSound() {
        for (const el of this.root.querySelectorAll('[data-act="sound"] .ic')) el.className = 'ic ic-' + (Sound.muted ? 'audiooff' : 'audioon');
    },

    // --- меню ------------------------------------------------------------------
    renderMenu() {
        this.$('#m-level').textContent = Lang.t('levelN', { n: GameState.s.level });
        this.$('#m-stars').textContent = String(GameState.totalStars());
        // Точка у магазина: есть что купить за монеты.
        const can = Object.values(GameData.ITEMS).some(it => !GameState.owns(it.id) && it.price.type === 'coins' && it.price.value <= GameState.s.coins)
            || GameData.UPGRADES.some(u => GameState.upLevel(u.id) < u.max && GameData.upgradeCost(u.id, GameState.upLevel(u.id)) <= GameState.s.coins);
        this.$('#m-shopdot').classList.toggle('on', can);
        this.fillThumbs(this.$('#scr-menu'));
        this.refreshCoins();
        this.$('#m-giftdot').classList.toggle('on', GameState.dailyReady());
        // Рейтинг есть у Яндекса; локально — свой счёт и пояснение. Playables/Playgama — без кнопки.
        this.$('[data-act="leaders"]').style.display = Platform.name === 'yandex' || Platform.name === 'local' ? '' : 'none';
        this.$('[data-act="freecoins"]').style.display = Platform.rewardedReady() ? '' : 'none';
        if (GameState.s.tut && !GameState.s.tips) setTimeout(() => { if (this.screen === 'menu') { this.show('tips'); this.fillThumbs(this.$('#scr-tips')); } }, 600);
        else if (GameState.s.tut && GameState.dailyReady() && !this._dailyAuto) { this._dailyAuto = true; setTimeout(() => { if (this.screen === 'menu') this.showDaily(); }, 700); }
    },

    // --- лидеры: рейтинг платформы по убийствам монстров (лидерборд Score) -------------
    /** @type {any[] | null} */
    _lb: null,
    _lbAt: 0,

    async showLeaders() {
        this.show('leaders');
        this.$('#lb-mine').textContent = this.fmt(GameState.s.kills || 0);
        this.game.syncScore();
        // Лимит Яндекса — 20 запросов таблицы за 5 минут: свежую таблицу держим 30 с.
        if (this._lb && Date.now() - this._lbAt < 30000) { this.renderLeaders(this._lb); return; }
        this.renderLeaders(undefined);
        const rows = await Platform.leaderboard({ quantityTop: 10, includeUser: true, quantityAround: 2 });
        if (rows) { this._lb = rows; this._lbAt = Date.now(); }
        if (this.screen === 'leaders') this.renderLeaders(rows);
    },

    // rows: undefined — загрузка, null — рейтинга нет, [] — пусто.
    renderLeaders(rows) {
        const list = this.$('#lb-list'), note = this.$('#lb-note');
        let text = '', html = '', prev = 0;
        if (rows === undefined) text = Lang.t('lbLoading');
        else if (!rows) text = Lang.t(Platform.name === 'yandex' ? 'lbFail' : 'lbLocal');
        else if (!rows.length) text = Lang.t('lbEmpty');
        else for (const r of rows) {
            if (prev && r.rank > prev + 1) html += '<div class="lbgap">• • •</div>';
            prev = r.rank;
            const name = r.name || (r.me ? Lang.t('lbYou') : Lang.t('lbAnon'));
            const ava = r.avatar ? `<img class="av" src="${this.esc(r.avatar)}" alt="" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">` : '<i class="av"></i>';
            html += `<div class="lbr${r.rank <= 3 ? ' m' + r.rank : ''}${r.me ? ' me' : ''}"><span class="rk">${r.rank}</span>${ava}`
                + `<span class="nm">${this.esc(name)}${r.me && r.name ? `<em class="you">${Lang.t('lbYou')}</em>` : ''}</span>`
                + `<b class="sc"><img src="assets/ui/skull.png" alt="">${this.fmt(r.score)}</b></div>`;
        }
        list.innerHTML = html;
        list.style.display = html ? '' : 'none';
        note.textContent = text;
        note.style.display = text ? '' : 'none';
        // Аноним в рейтинг не попадает (setScore Яндекса — только после входа): вход — по кнопке.
        this.$('#lb-btns').innerHTML = Platform.name === 'yandex' && !Platform.authorized()
            ? `<div class="lbl">${Lang.t('lbLogin')}</div><button class="btn green" data-act="lb-login"><span>${Lang.t('lbLoginBtn')}</span></button>` : '';
    },

    async lbLogin(el) {
        el.setAttribute('disabled', '');
        if (await Platform.login()) {
            this.game.syncScore();
            this._lb = null;
            // setScore уходит асинхронно — таблицу перечитываем чуть позже.
            setTimeout(() => { if (this.screen === 'leaders') this.showLeaders(); }, 1500);
        } else el.removeAttribute('disabled');
    },

    renderLevels() {
        const list = this.$('#lv-list');
        const cur = GameState.s.level;
        let html = '';
        for (let ch = 0; ch < 10; ch++) {
            html += `<div class="chapter" style="--ch:${ch}"><div class="chname ch${ch}"><b>${ch + 1}</b><span>${this.esc(Lang.t('chapter' + ch))}</span></div><div class="lv-grid">`;
            for (let i = 1; i <= 10; i++) {
                const n = ch * 10 + i, st = GameState.s.stars[n] || 0, open = n <= cur;
                const boss = n % 10 === 0 ? 'lv-mega' : n % 5 === 0 ? 'lv-boss' : '';
                html += `<button class="lv ${open ? 'open' : 'locked'} ${n === cur ? 'cur' : ''} ${boss}" ${open ? `data-act="level" data-n="${n}"` : 'disabled'}>
                    <span class="num">${open ? n : '<i class="ic ic-locked"></i>'}</span>
                    <span class="st">${[1, 2, 3].map(k => `<i class="s ${k <= st ? 'on' : ''}"></i>`).join('')}</span>
                    ${boss ? '<span class="skull">' + (boss === 'lv-mega' ? '<img src="assets/ui/boss.png" alt="">' + Lang.t('bossTag2') : '<img src="assets/ui/skull.png" alt="">' + Lang.t('bossTag')) + '</span>' : ''}
                </button>`;
            }
            html += '</div></div>';
        }
        list.innerHTML = html;
        this.$('#l-stars').textContent = String(GameState.totalStars());
        const c = /** @type {HTMLElement} */ (list.querySelector('.lv.cur'));
        if (c) setTimeout(() => c.scrollIntoView({ block: 'center' }), 30);
    },

    // --- магазин ---------------------------------------------------------------
    TAB_IMG: { pistol: 'assets/ui/tab-pistol.png', smg: 'assets/ui/tab-smg.png', shotgun: 'assets/ui/tab-shotgun.png', rifle: 'assets/ui/tab-rifle.png', heavy: 'assets/ui/tab-heavy.png',
        energy: 'assets/ui/tab-energy.png', explosive: 'assets/ui/tab-explosive.png', melee: 'assets/ui/tab-melee.png', heroes: 'assets/ui/tab-heroes.png', hats: 'assets/ui/tab-hats.png',
        packs: 'assets/ui/tab-packs.png', arms: 'assets/ui/tab-arms.png', skins: 'assets/ui/tab-skins.png', tracers: 'assets/ui/tab-tracers.png', kills: 'assets/ui/tab-kills.png',
        trails: 'assets/ui/tab-trails.png', pets: 'assets/ui/tab-pets.png', upgrades: 'assets/ui/tab-upgrades.png', free: 'assets/ui/tab-free.png' },

    renderShop() {
        const tabs = this.$('#shop-tabs');
        const groups = [['weapons', Lang.t('grpWeapons')], ['style', Lang.t('grpStyle')], ['more', Lang.t('grpMore')]];
        let html = '';
        for (const [g, title] of groups) {
            html += `<div class="tgroup">${this.esc(title)}</div>`;
            const secs = g === 'more' ? [{ id: 'upgrades', name: { ru: Lang.t('upgrades'), en: Lang.t('upgrades') } }, { id: 'free', name: { ru: Lang.t('freeCoins'), en: Lang.t('freeCoins') } }]
                : GameData.SECTIONS.filter(s => s.group === g);
            for (const s of secs) {
                const count = s.items ? `<em>${GameState.ownedIn(s.id)}/${s.items.length}</em>` : '';
                const icon = `<img src="${this.TAB_IMG[s.id]}" alt="">`;
                html += `<button class="tab ${this.shopTab === s.id ? 'on' : ''}" data-act="tab" data-tab="${s.id}">${icon}<span>${this.esc(this.name(s.name))}</span>${count}</button>`;
            }
        }
        tabs.innerHTML = html;
        this.fillThumbs(tabs);
        const on = /** @type {HTMLElement} */ (tabs.querySelector('.tab.on'));
        if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
        this.renderShopGrid();
        this.renderDetail();
        this.refreshCoins();
    },

    fillThumbs(root) {
        for (const img of /** @type {NodeListOf<HTMLImageElement>} */ (root.querySelectorAll('img[data-thumb]'))) {
            const id = img.dataset.thumb;
            img.removeAttribute('data-thumb');
            GameArt.thumb(id).then(url => { if (url) img.src = url; });
        }
    },

    priceHtml(it) {
        if (GameState.owns(it.id)) return GameState.isEquipped(it.id) ? `<span class="tag eq"><i class="ic ic-checkmark"></i>${Lang.t('equipped')}</span>` : `<span class="tag own">${Lang.t('owned')}</span>`;
        if (it.price.type === 'coins') return `<span class="tag price ${GameState.s.coins >= it.price.value ? '' : 'poor'}"><i class="coin"></i>${this.fmt(it.price.value)}</span>`;
        return `<span class="tag rw"><i class="ic ic-video"></i>${GameState.adViews(it.id)}/${it.price.value}</span>`;
    },

    renderShopGrid() {
        const grid = this.$('#shop-grid'), tab = this.shopTab;
        const title = this.$('#shop-sec'), count = this.$('#shop-count');
        if (tab === 'upgrades') { title.textContent = Lang.t('upgrades'); count.textContent = ''; grid.className = 'grid ups'; grid.innerHTML = this.upgradesHtml(); this.$('#shop-detail').classList.remove('on'); this.fillThumbs(grid); return; }
        if (tab === 'free') { title.textContent = Lang.t('freeCoins'); count.textContent = ''; grid.className = 'grid free'; grid.innerHTML = this.freeHtml(); this.$('#shop-detail').classList.remove('on'); this.fillThumbs(grid); return; }
        const sec = GameData.section(tab);
        if (!sec) return;
        grid.className = 'grid';
        title.textContent = this.name(sec.name);
        count.textContent = GameState.ownedIn(sec.id) + ' / ' + sec.items.length;
        if (!this.shopSel || !GameData.ITEMS[this.shopSel] || GameData.ITEMS[this.shopSel].section !== tab) this.shopSel = (sec.items.find(it => GameState.isEquipped(it.id)) || sec.items[0]).id;
        grid.innerHTML = sec.items.map(it => {
            const tier = Math.min(4, Math.floor(it.index / Math.max(1, sec.items.length) * 5));
            const rs = it.rarity != null ? ` style="--t:color-mix(in srgb, ${GameData.RARITY[it.rarity].color} 70%, #000 30%)"` : '';
            return `<button${rs} class="item t${tier} ${this.shopSel === it.id ? 'sel' : ''} ${GameState.owns(it.id) ? 'owned' : ''}" data-act="item" data-id="${it.id}">
                <img data-thumb="${it.id}" alt=""><span class="iname">${this.esc(this.name(it.name))}</span>${this.priceHtml(it)}</button>`;
        }).join('');
        this.fillThumbs(grid);
    },

    renderDetail() {
        const box = this.$('#shop-detail'), it = GameData.ITEMS[this.shopSel];
        if (!it || this.shopTab === 'upgrades' || this.shopTab === 'free') { box.classList.remove('on'); return; }
        box.classList.add('on');
        let stats = '';
        if (it.cls) {
            const s = GameData.weaponStats(it.id, 0);
            const bar = (label, v, max) => `<div class="stat"><span>${label}</span><div class="sbar"><div style="width:${Math.min(100, v / max * 100)}%"></div></div><b>${Math.round(v)}</b></div>`;
            stats = bar(Lang.t('stDmg'), s.dmg * (s.pellets || 1), 260) + bar(Lang.t('stRate'), s.rate * 10, 140) + bar(Lang.t('stRange'), s.range, 1200);
            stats += `<p class="note">${Lang.t('gunNote')}</p>`;
            const ab = GameData.ABILITIES[it.cls], R = GameData.RARITY;
            if (ab) stats += `<div class="abx"><b style="--c:${R[GameData.LEGENDARY].color}">${Lang.t('legAb')}: ${this.esc(this.name(ab.name))}</b><span>${this.esc(this.name(ab.desc))}</span>
                <b style="--c:${R[GameData.MYTHIC].color}">${Lang.t('mythAb')}</b><span>${this.esc(this.name(ab.d2))}</span></div>`;
        } else if (it.section === 'melee') {
            const bar = (label, v, max) => `<div class="stat"><span>${label}</span><div class="sbar"><div style="width:${Math.min(100, v / max * 100)}%"></div></div><b>${Math.round(v)}</b></div>`;
            stats = bar(Lang.t('stDmg'), it.dmg, 130) + bar(Lang.t('stRadius'), it.radius, 220) + `<p class="note">${Lang.t('meleeNote')}</p>`;
        } else if (it.section === 'pets' && it.dps) {
            const R = GameData.RARITY[it.rarity || 0], ab = it.ability;
            stats = `<div class="abx"><em class="rtag" style="--c:${R.color}">${this.esc(this.name(R.name))}</em>
                <b style="--c:${R.color}"><img class="abi" src="${ab.icon}" alt="">${Lang.t('petAbility')}: ${this.esc(this.name(ab.name))}</b><span>${this.esc(this.name(ab.desc))} · ${Lang.t('every', { n: ab.cd })}</span></div>
                <p class="note">${Lang.t('petNote', { n: it.dps })}</p>`;
        } else stats = `<p class="note">${Lang.t('cosmeticNote')}</p>`;
        let btn;
        if (GameState.owns(it.id)) btn = GameState.isEquipped(it.id) ? `<button class="btn green" disabled><i class="ic ic-checkmark"></i><span>${Lang.t('equipped')}</span></button>`
            : `<button class="btn blue" data-act="equip" data-id="${it.id}"><span>${Lang.t('equip')}</span></button>`;
        else if (it.price.type === 'coins') btn = `<button class="btn yellow" data-act="buy" data-id="${it.id}" ${GameState.s.coins >= it.price.value ? '' : 'disabled'}><i class="coin"></i><span>${this.fmt(it.price.value)}</span></button>`;
        else btn = `<button class="btn purple rwbtn" data-act="buy" data-id="${it.id}"><i class="ic ic-video"></i><span>${Lang.t('watchAd')} ${GameState.adViews(it.id)}/${it.price.value}</span></button>
            <div class="rwsteps">${Array.from({ length: it.price.value }, (_, k) => `<i class="${k < GameState.adViews(it.id) ? 'on' : ''}"></i>`).join('')}</div>`;
        // Кнопка — сразу под названием: внизу панели её не видно на низких экранах и под прокруткой.
        box.innerHTML = `<div class="dthumb"><img data-thumb="${it.id}" alt=""></div><h3>${this.esc(this.name(it.name))}</h3><div class="dbtn">${btn}</div>${stats}`;
        this.fillThumbs(box);
    },

    async buy(id) {
        const it = GameData.ITEMS[id];
        if (!it) return;
        if (it.price.type === 'coins') {
            if (GameState.buyCoins(id)) {
                Sound.play('assets/sounds/buy.ogg', { volume: 0.8 });
                GameState.equip(id);
                this.toast(Lang.t('bought'), '#7fd34e');
                this.game.equipmentChanged();
            } else Sound.play('assets/sounds/error.ogg', { volume: 0.6 });
        } else if (it.price.type === 'ads') {
            const ok = await Platform.rewarded('unlock-item');
            if (ok) {
                const done = GameState.addAdView(id);
                if (done) { Sound.play('assets/sounds/merge.ogg', { volume: 0.8 }); GameState.equip(id); this.toast(Lang.t('unlocked'), '#b45cff'); this.game.equipmentChanged(); }
                else this.toast(Lang.t('adProgress', { a: GameState.adViews(id), b: it.price.value }), '#b45cff');
            } else this.toast(Lang.t('adFail'), '#ff6b6b');
        }
        if (this.screen === 'skins') this.renderSkins(); else this.renderShop();
    },

    // --- магазин скинов: редкость, примерка на герое в сцене ------------------------------
    skFilter: 'all', skSel: '',

    renderSkins() {
        const sec = GameData.section('heroes'), R = GameData.RARITY;
        if (!sec) return;
        if (!this.skSel || !GameData.ITEMS[this.skSel]) this.skSel = GameState.equipped('heroes');
        const rars = [...new Set(sec.items.filter(it => !it.exclusive || GameState.owns(it.id)).map(it => it.rarity))].sort((a, b) => b - a);
        this.$('#sk-filters').innerHTML = [['all', Lang.t('skAll'), '#5b6b86']].concat(rars.map(r => [String(r), this.name(R[r].name), R[r].color]))
            .map(([f, t, c]) => `<button class="chip ${this.skFilter === f ? 'on' : ''}" style="--c:${c}" data-act="sk-filter" data-f="${f}">${this.esc(t)}</button>`).join('');
        const list = sec.items.filter(it => (!it.exclusive || GameState.owns(it.id)) && (this.skFilter === 'all' || String(it.rarity) === this.skFilter)).sort((a, b) => b.rarity - a.rarity || a.index - b.index);
        const grid = this.$('#sk-grid');
        grid.innerHTML = list.map(it => `<button class="skin ${it.rarity >= GameData.LEGENDARY ? 'leg' : ''} ${this.skSel === it.id ? 'sel' : ''} ${GameState.owns(it.id) ? 'owned' : ''}" style="--c:${R[it.rarity].color}" data-act="sk-item" data-id="${it.id}">
            ${it.exclusive ? `<i class="ribbon excl">${Lang.t('exclusive')}</i>` : it.brainrot ? '<i class="ribbon">BRAINROT</i>' : ''}<img data-thumb="${it.id}" alt=""><span class="sname">${this.esc(this.name(it.name))}</span>${this.priceHtml(it)}</button>`).join('');
        this.fillThumbs(grid);
        const it = GameData.ITEMS[this.skSel], r = R[it.rarity || 0];
        let btn;
        if (GameState.owns(it.id)) btn = GameState.isEquipped(it.id) ? `<button class="btn green" disabled><i class="ic ic-checkmark"></i><span>${Lang.t('equipped')}</span></button>`
            : `<button class="btn blue" data-act="equip" data-id="${it.id}"><span>${Lang.t('equip')}</span></button>`;
        else if (it.price.type === 'coins') btn = `<button class="btn yellow" data-act="buy" data-id="${it.id}" ${GameState.s.coins >= it.price.value ? '' : 'disabled'}><i class="coin"></i><span>${this.fmt(it.price.value)}</span></button>`;
        else btn = `<button class="btn purple rwbtn" data-act="buy" data-id="${it.id}"><i class="ic ic-video"></i><span>${Lang.t('watchAd')} ${GameState.adViews(it.id)}/${it.price.value}</span></button>`;
        this.$('#sk-bar').innerHTML = `<div class="sbname"><em class="rtag" style="--c:${r.color}">${this.esc(this.name(r.name))}</em><b>${this.esc(this.name(it.name))}</b></div>${btn}`;
        this.refreshCoins();
    },

    // --- сложность уровня ---------------------------------------------------------------------
    showDiff(lvl) {
        this.show('diff');
        this.$('#d-title').textContent = Lang.t('levelN', { n: lvl.n });
        const last = GameState.s.diff || 'normal';
        const pct = (v) => '+' + Math.round((v - 1) * 100) + '%';
        this.$('#d-list').innerHTML = GameData.DIFFS.map((id, i) => {
            const d = GameData.difficulty(id);
            const stats = i ? `<span>${Lang.t('dHp')} <b>${pct(d.hp)}</b></span><span>${Lang.t('dDmg')} <b>${pct(d.dmg)}</b></span><span>${Lang.t('dSpawn')} <b>${pct(d.spawn)}</b></span>` : `<span>${Lang.t('dNormal')}</span>`;
            return `<button class="dcard d-${id} ${id === last ? 'last' : ''}" style="--c:${d.color}" data-act="diff" data-d="${id}">
                <div class="dskulls"><img src="${this.DIFF_IMG[id]}" alt=""></div><b class="dname">${Lang.t('diff_' + id)}</b>
                <div class="dstats">${stats}</div>
                <div class="dreward"><i class="coin"></i>${this.fmt(Math.round(lvl.reward * d.reward))}${i ? `<em>×${d.reward}</em>` : ''}</div></button>`;
        }).join('');
    },

    // Пауза от платформы: оверлей без кнопок поверх всего, снимает только onResume платформы.
    platformPause(on) {
        this.$('#ppause').classList.toggle('on', on);
        if (on) { this.releaseJoy(); this.keys.clear(); }
    },

    // --- обучение: карточка шага, стрелка над целью --------------------------------------------
    tutCard(step) {
        const el = this.$('#tut');
        if (!step) { el.classList.remove('on'); this.tutArrow(null); return; }
        this.$('#t-step').textContent = step.n + ' / ' + step.total;
        this.$('#t-title').textContent = step.title;
        this.$('#t-text').textContent = step.text;
        const demo = this.$('#t-demo');
        demo.className = 'tdemo d-' + step.demo;
        demo.innerHTML = this.tutDemo(step.demo);
        this.fillThumbs(demo);
        el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    },
    tutDemo(kind) {
        if (kind === 'move') return IS_MOBILE ? '<div class="djoy"><i></i></div>' : '<div class="dswap"><div class="dkeys"><i>W</i><i>A</i><i>S</i><i>D</i></div><div class="dmouse"><i></i></div></div>';
        if (kind === 'shoot') return '<img src="assets/ui/tab-pistol.png" alt="">';
        if (kind === 'melee') return `<img data-thumb="${GameState.equipped('melee')}" alt="">`;
        if (kind === 'crate') return '<div class="dcrate"><i></i></div>';
        if (kind === 'bag') return `<div class="dmerge"><img data-thumb="${GameState.equipped('gun')}" alt=""><b>+</b><img data-thumb="${GameState.equipped('gun')}" alt=""></div>`;
        if (kind === 'tnt') return '<div class="dtnt">TNT</div>';
        if (kind === 'jump') return '<div class="djump"></div>';
        if (kind === 'zip') return '<div class="dzip"><i></i></div>';
        if (kind === 'coins') return '<i class="coin"></i>';
        return '<i class="ic ic-fightfist"></i>';
    },
    // Стрелка над точкой мира (null — спрятать).
    tutArrow(p) {
        const el = this.$('#tut-arrow');
        const w = this.game.world, s = p && w.view ? w.view.projectToScreen(p.x, p.y, p.h) : null;
        if (!s || !s.visible) { el.classList.remove('on'); return; }
        el.classList.add('on');
        el.style.transform = `translate(${s.x}px, ${s.y}px)`;
    },

    DIFF_IMG: { normal: 'assets/ui/diff-normal.png', high: 'assets/ui/diff-high.png', hard: 'assets/ui/diff-hard.png' },

    // --- ежедневный подарок: 7 дней, 7-й — эксклюзивный скин Алика ---------------------------
    showDaily() {
        this.show('daily');
        this.renderDaily();
        clearInterval(this._dailyTimer);
        this._dailyTimer = setInterval(() => { if (this.screen !== 'daily') { clearInterval(this._dailyTimer); return; } if (!GameState.dailyReady()) this.renderDailyBtns(); }, 1000);
    },
    renderDaily() {
        const cur = GameState.dailyIndex(), ready = GameState.dailyReady();
        this.$('#daily-days').innerHTML = GameData.DAILY.map((g, i) => {
            const it = g.item ? GameData.ITEMS[g.item] : null, gotItem = it && GameState.owns(it.id) && !(i === cur && ready);
            const state = i < cur ? 'got' : i === cur ? (ready ? 'today' : 'got') : 'wait';
            const useItem = it && (!GameState.owns(it.id) || state === 'got' && i < cur);
            const pic = useItem ? `<img data-thumb="${it.id}" alt="">` : `<img src="assets/ui/coins-pile.png" alt="">`;
            const label = useItem ? this.esc(this.name(it.name)) : `<i class="coin"></i>${this.fmt(g.coins)}`;
            void gotItem;
            return `<div class="day ${state} ${g.exclusive ? 'd7' : ''}">${g.exclusive ? `<i class="ribbon excl">${Lang.t('exclusive')}</i>` : ''}
                <b>${Lang.t('dayN', { n: i + 1 })}</b>${pic}<span>${label}</span>${state === 'got' ? '<i class="ic ic-checkmark done"></i>' : ''}</div>`;
        }).join('');
        this.fillThumbs(this.$('#daily-days'));
        this.renderDailyBtns();
    },
    renderDailyBtns() {
        const box = this.$('#daily-btns');
        if (GameState.dailyReady()) {
            const g = GameData.DAILY[GameState.dailyIndex()], coins = !(g.item && GameData.ITEMS[g.item] && !GameState.owns(g.item));
            box.innerHTML = `<button class="btn green big" data-act="daily-claim"><span>${Lang.t('claim')}</span></button>`
                + (coins && Platform.rewardedReady() ? `<button class="btn purple rwbtn" data-act="daily-x2"><i class="ic ic-video"></i><span>${Lang.t('watchAd')}</span><em class="x2">×2</em></button>` : '');
            return;
        }
        const d = new Date(), end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), s = Math.max(0, Math.floor((end.getTime() - d.getTime()) / 1000));
        const t = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(v => String(v).padStart(2, '0')).join(':');
        box.innerHTML = `<div class="dnext">${Lang.t('nextGift', { t })}</div><button class="btn blue" data-act="daily-close"><span>OK</span></button>`;
    },
    async claimDaily(mult, el) {
        if (!GameState.dailyReady()) return;
        if (mult > 1) {
            el.setAttribute('disabled', '');
            const ok = await Platform.rewarded('daily-x2');
            if (!ok) { this.toast(Lang.t('adFail'), '#ff6b6b'); if (Platform.rewardedReady()) el.removeAttribute('disabled'); else el.remove(); return; }
        }
        const res = GameState.claimDaily(mult);
        if (!res) return;
        Sound.play('assets/sounds/buy.ogg', { volume: 0.8 });
        if (res.item) {
            const it = GameData.ITEMS[res.item];
            GameState.equip(res.item);
            this.toast(it.exclusive ? Lang.t('newSkin', { n: this.name(it.name) }) : this.name(it.name), it.exclusive ? '#ff3df0' : '#7fd34e');
            this.game.equipmentChanged();
        } else this.toast('+' + this.fmt(res.coins), '#ffcf2e');
        this.$('#m-giftdot').classList.remove('on');
        this.renderDaily();
    },

    // Надпись над точкой мира (крит, способность, везение): пул из 6.
    popText(x, y, h, text, color) {
        const w = this.game.world;
        if (!w.view) return;
        const p = w.view.projectToScreen(x, y, h);
        if (!p.visible) return;
        if (!this._pops) { this._pops = []; this._popI = 0; for (let i = 0; i < 6; i++) { const d = document.createElement('div'); d.className = 'pop'; this.$('#dmg-layer').appendChild(d); this._pops.push(d); } }
        const d = this._pops[this._popI++ % this._pops.length];
        d.textContent = text;
        d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; d.style.setProperty('--c', color || '#ffd23a');
        d.classList.remove('on'); void d.offsetWidth; d.classList.add('on');
    },

    upgradesHtml() {
        const icon = { hp: '<img src="assets/ui/up-health.png">', dmg: '<img src="assets/ui/up-damage.png">', rate: '<img src="assets/ui/up-firerate.png">', speed: '<img src="assets/ui/up-speed.png">',
            magnet: '<img src="assets/ui/up-magnet.png">', coins: '<img src="assets/ui/up-coins.png">', start: '<img src="assets/ui/up-startguns.png">', melee: '<img src="assets/ui/up-melee.png">', luck: '<img src="assets/ui/up-luck.png">' };
        return GameData.UPGRADES.map(u => {
            const lvl = GameState.upLevel(u.id), max = lvl >= u.max, cost = GameData.upgradeCost(u.id, lvl);
            const val = u.id === 'start' ? '+' + lvl : '+' + Math.round(lvl * u.per * 100) + '%';
            return `<div class="up"><div class="uicon">${icon[u.id]}</div><div class="uinfo"><b>${this.esc(this.name(u.name))}</b><span class="uval">${val}</span>${u.note ? `<small class="unote">${this.esc(this.name(u.note))}</small>` : ''}
                <div class="pips">${Array.from({ length: u.max }, (_, k) => `<i class="${k < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
                ${max ? `<button class="btn green" disabled><span>MAX</span></button>` : `<button class="btn yellow" data-act="upgrade" data-id="${u.id}" ${GameState.s.coins >= cost ? '' : 'disabled'}><i class="coin"></i><span>${this.fmt(cost)}</span></button>`}</div>`;
        }).join('');
    },

    buyUpgrade(id) {
        if (GameState.buyUpgrade(id)) { Sound.play('assets/sounds/merge.ogg', { volume: 0.7 }); this.game.equipmentChanged(); }
        else Sound.play('assets/sounds/error.ogg', { volume: 0.6 });
        this.renderShopGrid();
    },

    adCoinsValue() { return GameData.nice(120 + GameState.s.level * 30); },

    freeHtml() {
        const left = Platform.rewardedCooldownLeft();
        // Рекламы нет — надпись вместо кнопки; после просмотра кнопка ждёт с таймером (tickFree).
        const btn = !Platform.rewardedReady() ? `<p class="rwoff">${Lang.t('adsOff')}</p>`
            : `<button class="btn purple big" data-act="rw-coins" ${left ? 'disabled' : ''}><i class="ic ic-video"></i><span>${left ? Lang.t('rwWait', { n: left }) : Lang.t('watchAd')}</span></button>`;
        return `<div class="freecard"><img src="assets/ui/coins-pile.png" class="bigcoin"><h3>${Lang.t('freeTitle', { n: this.adCoinsValue() })}</h3><p>${Lang.t('freeNote')}</p>${btn}</div>`;
    },

    // Пока идёт пауза между роликами — раз в секунду обновить вкладку монет.
    tickFree() {
        clearTimeout(this._freeTimer);
        if (!Platform.rewardedCooldownLeft()) return;
        this._freeTimer = setTimeout(() => {
            if (this.screen === 'shop' && this.shopTab === 'free') { this.renderShopGrid(); this.tickFree(); }
        }, 1000);
    },

    async adCoins() {
        const ok = await Platform.rewarded('coins');
        if (ok) { const n = this.adCoinsValue(); GameState.addCoins(n); Sound.play('assets/sounds/buy.ogg', { volume: 0.8 }); this.toast('+' + n, '#ffcf2e'); }
        else this.toast(Lang.t('adFail'), '#ff6b6b');
        this.renderShop();
        this.tickFree();
    },

    // --- HUD -------------------------------------------------------------------
    resetHud() {
        this._hud = {};
        this.$('#h-boss').classList.remove('on');
        const hint = this.$('#h-hint');
        hint.textContent = IS_MOBILE ? Lang.t('hintTouch') : Lang.t('hintKeys');
        hint.classList.toggle('on', GameState.s.played < 2 && !GameTutorial.active);
    },

    hud(w) {
        const H = w.hero, h = this._hud;
        const set = (key, val, fn) => { if (h[key] !== val) { h[key] = val; fn(val); } };
        set('lvl', w.lvl.n, v => { this.$('#h-lvl').textContent = Lang.t('levelN', { n: v }); });
        const hp = Math.max(0, Math.round(H.hp)), mx = Math.round(H.maxHp);
        set('hp', hp + '/' + mx, () => { this.$('#h-hp').style.width = (hp / mx * 100) + '%'; this.$('#h-hpt').textContent = hp + ' / ' + mx; this.$('.hp').classList.toggle('low', hp / mx < 0.3); });
        const k = Math.min(w.kills, w.lvl.kills);
        set('kills', k, () => { this.$('#h-prog').style.width = (k / w.lvl.kills * 100) + '%'; this.$('#h-progt').textContent = k + ' / ' + w.lvl.kills; });
        set('coins', w.levelCoins, v => { this.$('#h-coins').textContent = this.fmt(v); });
        const boss = w.boss && w.boss.state !== 'dead' ? w.boss : null;
        set('boss', boss ? Math.ceil(boss.hp / boss.maxHp * 100) : -1, (v) => {
            this.$('#h-boss').classList.toggle('on', v >= 0);
            if (v >= 0) this.$('#h-bossfill').style.width = v + '%';
        });
        const P = w.pet, ab = P && P.item.ability;
        const pel = this.$('#h-pet');
        set('pet', ab ? P.item.id : '', (v) => {
            pel.classList.toggle('on', !!v);
            if (!v) return;
            pel.style.setProperty('--c', GameData.RARITY[P.item.rarity || 0].color);
            this.$('#h-petname').textContent = this.name(ab.name);
            /** @type {HTMLImageElement} */ (this.$('#h-petimg')).src = ab.icon;
        });
        if (ab) {
            const f = P.abT == null ? 0.5 : Math.max(0, Math.min(1, 1 - P.abT / ab.cd));
            set('petf', Math.round(f * 50), () => { pel.style.setProperty('--p', String(f)); pel.classList.toggle('ready', f >= 0.98); });
        }
        if (h.hintT == null) h.hintT = 0;
        if (Math.hypot(w.input.x, w.input.y) > 0.3) this.$('#h-hint').classList.remove('on');
    },

    hudBag(bag) {
        const el = this.$('#h-bag');
        if (!el) return;
        el.innerHTML = bag.map(s => `<i style="${s ? 'background:' + GameData.RARITY[s.tier].color : ''}"></i>`).join('');
    },

    toast(text, color) {
        const t = this.$('#toast');
        t.textContent = text;
        t.style.setProperty('--c', color || '#ffcf2e');
        t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    },

    damageText(x, y, h, dmg) {
        const w = this.game.world;
        if (!w.view) return;
        const p = w.view.projectToScreen(x, y, h);
        if (!p.visible) return;
        const d = this._dmgPool[this._dmgI++ % this._dmgPool.length];
        d.textContent = String(Math.round(dmg));
        d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
        d.classList.toggle('big', dmg >= 80);
        d.classList.remove('on'); void d.offsetWidth; d.classList.add('on');
    },

    // «x3 КОМБО!» над точкой удара (одна надпись: следующая заменяет).
    comboText(x, y, h, n) {
        const w = this.game.world;
        if (!w.view) return;
        const p = w.view.projectToScreen(x, y, h);
        if (!p.visible) return;
        let el = this._combo;
        if (!el) { el = this._combo = document.createElement('div'); el.className = 'combo'; this.$('#dmg-layer').appendChild(el); }
        el.textContent = 'x' + n + ' ' + Lang.t('combo');
        el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
        el.style.setProperty('--s', String(Math.min(1.6, 0.9 + n * 0.1)));
        el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    },

    label(text, color) {
        const el = document.createElement('div');
        el.className = 'plabel';
        el.textContent = text;
        el.style.setProperty('--c', color);
        this.$('#labels').appendChild(el);
        this._labels.add(el);
        return el;
    },
    placeLabel(el, x, y, h) {
        const p = this.game.world.view.projectToScreen(x, y, h);
        el.style.display = p.visible ? '' : 'none';
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    },
    removeLabel(el) { el.remove(); this._labels.delete(el); },
    clearLabels() { for (const el of this._labels) el.remove(); this._labels.clear(); },

    // --- джойстик и клавиши ---------------------------------------------------------------
    initJoystick() {
        const touch = this.$('#touch'), joy = this.$('#joy'), knob = /** @type {HTMLElement} */ (joy.querySelector('.knob'));
        const J = this.joy, R = 56;
        const move = (e) => {
            let dx = e.clientX - J.x, dy = e.clientY - J.y;
            const d = Math.hypot(dx, dy);
            if (d > R) { dx = dx / d * R; dy = dy / d * R; }
            J.dx = dx / R; J.dy = dy / R;
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
        };
        touch.addEventListener('pointerdown', (e) => {
            if (J.id >= 0) return;
            J.id = e.pointerId; J.x = e.clientX; J.y = e.clientY; J.dx = J.dy = 0; J.active = true;
            try { touch.setPointerCapture(e.pointerId); } catch (err) { /* синтетическое */ }
            joy.style.left = J.x + 'px'; joy.style.top = J.y + 'px';
            joy.classList.add('on'); knob.style.transform = '';
        });
        touch.addEventListener('pointermove', (e) => { if (e.pointerId === J.id) move(e); });
        const up = (e) => { if (e.pointerId !== J.id) return; this.releaseJoy(); };
        touch.addEventListener('pointerup', up);
        touch.addEventListener('pointercancel', up);
        window.addEventListener('lory-release-input', () => { this.releaseJoy(); this.keys.clear(); });
        window.addEventListener('keydown', (e) => {
            if (/^(INPUT|TEXTAREA)$/.test(/** @type {HTMLElement} */ (e.target).tagName)) return;
            this.keys.add(e.code);
            if (e.code === 'Escape' || e.code === 'KeyP') { if (this.screen === 'hud' && this.game.world.mode === 'play') this.game.pause(true); else if (this.screen === 'pause') this.game.pause(false); }
            if ((e.code === 'KeyB' || e.code === 'Tab') && this.screen === 'hud') { e.preventDefault(); this.act('bag', this.root); }
            if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.keys.clear());
    },
    keys: new Set(),

    releaseJoy() {
        const J = this.joy;
        J.id = -1; J.dx = J.dy = 0; J.active = false;
        const joy = this.$('#joy');
        joy.classList.remove('on');
        /** @type {HTMLElement} */ (joy.querySelector('.knob')).style.transform = '';
    },

    // Вектор движения в экранных осях (−1..1).
    inputVector() {
        const k = this.keys;
        let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
        let y = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
        if (this.joy.active) { x += this.joy.dx; y += this.joy.dy; }
        const l = Math.hypot(x, y);
        return l > 1 ? { x: x / l, y: y / l } : { x, y };
    },

    // --- рюкзак ---------------------------------------------------------------------------
    bag: [], tray: null, _drag: null, queue: [],

    openBag(item) {
        const w = this.game.world;
        // Рюкзак уже открыт — новое оружие в очередь.
        if (this.screen === 'bag') { if (item) { if (this.tray) this.queue.push(item); else this.tray = item; } this.renderBag(); return; }
        this.bag = w.bag.map(s => s ? { id: s.id, tier: s.tier } : null);
        this.tray = item;
        this.queue = [];
        this.renderBag();
        this.show('bag');
        this.releaseJoy(); this.keys.clear();
        if (item && GameState.s.played < 3) this.$('#scr-bag').classList.add('teach'); else this.$('#scr-bag').classList.remove('teach');
    },

    cellHtml(s, big) {
        if (!s) return '';
        const it = GameData.ITEMS[s.id], r = GameData.RARITY[s.tier];
        const ab = s.tier >= GameData.LEGENDARY ? GameData.ABILITIES[it.cls] : null;
        const cls = s.tier >= GameData.MYTHIC ? 'leg myth' : ab ? 'leg' : '';
        return `<div class="gun ${cls}" style="--r:${r.color}"><img data-thumb="${s.id}" alt=""><span class="rt">${this.esc(r.name[Lang.code] || r.name.en)}</span>${big ? `<b>${this.esc(this.name(it.name))}</b>` : ''}${ab ? `<i class="abl">${this.esc(this.name(ab.name))}</i>` : ''}${s.tier >= GameData.MYTHIC ? '<img class="myb" src="assets/ui/rarity-mythic.png" alt="">' : ''}</div>`;
    },

    renderBag() {
        if (!this.tray && this.queue.length) this.tray = this.queue.shift();
        const cells = this.$('#bag-cells');
        cells.innerHTML = this.bag.map((s, i) => `<div class="cell ${s ? 'full' : ''}" data-cell="${i}">${this.cellHtml(s, false)}</div>`).join('');
        const tray = this.$('#bag-tray');
        tray.innerHTML = this.tray ? `<div class="newitem" data-cell="tray">${this.cellHtml(this.tray, true)}<div class="hand"></div>${this.queue.length ? `<span class="more">+${this.queue.length}</span>` : ''}</div>` : '';
        this.fillThumbs(this.root.querySelector('#scr-bag'));
        const sell = this.$('#bag-sell');
        sell.style.display = this.tray ? '' : 'none';
        this.$('#bag-sell-t').textContent = Lang.t('sell', { n: this.sellValue() });
        this.$('#bag-done').toggleAttribute('disabled', !!this.tray);
        // Подсветка: куда можно слить.
        if (this.tray) for (const el of cells.querySelectorAll('.cell')) {
            const s = this.bag[Number(/** @type {HTMLElement} */ (el).dataset.cell)];
            el.classList.toggle('merge', !!s && s.id === this.tray.id && s.tier === this.tray.tier && s.tier < GameData.MYTHIC);
        }
        for (const el of /** @type {NodeListOf<HTMLElement>} */ (this.root.querySelectorAll('#scr-bag [data-cell]'))) el.onpointerdown = (e) => this.dragStart(e, el.dataset.cell);
    },

    sellValue() { return this.tray ? Math.round((8 + this.game.world.lvl.n * 2) * (this.tray.tier + 1)) : 0; },

    getSlot(key) { return key === 'tray' ? this.tray : this.bag[Number(key)]; },
    setSlot(key, v) { if (key === 'tray') this.tray = v; else this.bag[Number(key)] = v; },

    // Перенос from -> to: пусто — переложить, такой же — слить (+редкость), иначе — поменять.
    drop(from, to) {
        if (from === to) return false;
        const a = this.getSlot(from), b = this.getSlot(to);
        if (!a) return false;
        if (to === 'tray' && b) return false;
        if (b && b.id === a.id && b.tier === a.tier && b.tier < GameData.MYTHIC) {
            this.setSlot(to, { id: b.id, tier: b.tier + 1 });
            this.setSlot(from, null);
            Sound.play('assets/sounds/merge.ogg', { volume: 0.9 });
            this.game.world.emit('merge');
            const nr = GameData.RARITY[b.tier + 1], ab = b.tier + 1 >= GameData.LEGENDARY ? GameData.ABILITIES[GameData.ITEMS[b.id].cls] : null;
            this.toast(ab ? this.name(ab.name) + '!' : this.name(nr.name), nr.color);
        } else {
            this.setSlot(to, a);
            this.setSlot(from, b || null);
            Sound.play('assets/sounds/reload.ogg', { volume: 0.7 });
        }
        return true;
    },

    dragStart(e, key) {
        const s = this.getSlot(key);
        if (!s) return;
        e.preventDefault();
        const ghost = this.$('#bag-ghost');
        ghost.innerHTML = this.cellHtml(s, false);
        this.fillThumbs(ghost);
        const src = /** @type {HTMLElement} */ (e.currentTarget);
        const startX = e.clientX, startY = e.clientY;
        let moved = false;
        const place = (ev) => { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; };
        const onMove = (ev) => {
            if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) { moved = true; ghost.classList.add('on'); src.classList.add('dragging'); this.$('#scr-bag').classList.remove('teach'); }
            if (moved) place(ev);
        };
        const onUp = (ev) => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            ghost.classList.remove('on');
            src.classList.remove('dragging');
            if (!moved) { if (key === 'tray') this.bagAuto(); return; }
            ghost.style.display = 'none';
            const under = /** @type {HTMLElement} */ (document.elementFromPoint(ev.clientX, ev.clientY));
            ghost.style.display = '';
            const cell = under && /** @type {HTMLElement} */ (under.closest('[data-cell]'));
            if (cell && this.drop(key, cell.dataset.cell)) this.renderBag();
        };
        place(e);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    },

    // Авто: новый предмет — слить с таким же, иначе в пустую клетку, иначе заменить слабейший;
    // затем слить все пары в рюкзаке.
    bagAuto() {
        if (this.tray) {
            const t = this.tray;
            let i = this.bag.findIndex(s => s && s.id === t.id && s.tier === t.tier && s.tier < GameData.MYTHIC);
            if (i < 0) i = [4, 1, 3, 5, 7, 0, 2, 6, 8].find(k => !this.bag[k]) ?? -1;
            if (i < 0) {
                let weak = 0, wv = Infinity;
                this.bag.forEach((s, k) => { const v = s ? (s.tier + 1) * 10 + GameData.ITEMS[s.id].rank : 0; if (v < wv) { wv = v; weak = k; } });
                const v = (t.tier + 1) * 10 + GameData.ITEMS[t.id].rank;
                if (v > wv) { this.bag[weak] = null; i = weak; } else { this.bagSell(); return; }
            }
            this.drop('tray', String(i));
        }
        let merged = true;
        while (merged) {
            merged = false;
            for (let a = 0; a < 9 && !merged; a++) for (let b = a + 1; b < 9 && !merged; b++) {
                const A = this.bag[a], B = this.bag[b];
                if (A && B && A.id === B.id && A.tier === B.tier && A.tier < GameData.MYTHIC) { this.drop(String(b), String(a)); merged = true; }
            }
        }
        this.renderBag();
    },

    bagSell() {
        if (!this.tray) return;
        const v = this.sellValue();
        this.game.world.levelCoins += v;
        this.tray = null;
        Sound.play('assets/sounds/coin.ogg', { volume: 0.8 });
        this.renderBag();
    },

    async bagDone() {
        if (this.tray) return;
        const w = this.game.world;
        await w.setBag(this.bag);
        w.frozen = false;
        this.show('hud');
        w.emit('bag-done');
    },

    // --- итоги -----------------------------------------------------------------------------
    showWin(lvl, stars, coins) {
        this.game.levelFinished(true, stars, coins);
        this.show('result');
        const D = this.game.world.diff || GameData.difficulty('normal');
        const bonus = Math.round(lvl.reward * D.reward);
        this._result = { coins, bonus, doubled: false };
        this.$('#r-title').innerHTML = `<img class="trophy" src="assets/ui/trophy.png" alt=""><span class="win">${Lang.t('win')}</span><small>${Lang.t('levelN', { n: lvl.n })}</small>`;
        this.$('#r-stars').innerHTML = [1, 2, 3].map(k => `<i class="bs ${k <= stars ? 'on' : ''}" style="--d:${k * 0.25}s"></i>`).join('');
        this.$('#r-info').innerHTML = `<div class="rrow"><span>${Lang.t('earned')}</span><b><i class="coin"></i><span id="r-earn">${this.fmt(coins)}</span></b></div>
            <div class="rrow"><span>${Lang.t('bonus')}</span><b><i class="coin"></i>${this.fmt(bonus)}</b></div>
            <div class="rrow"><span>${Lang.t('diffLabel')}</span><b style="color:${D.color}">${Lang.t('diff_' + D.id)}${D.reward > 1 ? ' ×' + D.reward : ''}</b></div>`;
        const last = lvl.n >= GameData.MAX_LEVEL;
        // CrazyGames: кнопка без рекламы того же размера и цвета, что и кнопка за рекламу.
        const even = Platform.name === 'crazygames';
        this.$('#r-btns').classList.toggle('even', even);
        this.$('#r-btns').innerHTML = (Platform.rewardedReady() ? `<button class="btn ${even ? 'green' : 'purple'} big rwbtn" data-act="double"><i class="ic ic-video"></i><span>${Lang.t('double')}</span><em class="rwnote">${Lang.t('watchAd')}</em></button>` : '') +
            `<button class="btn green big" data-act="next"><span>${last ? Lang.t('menu') : Lang.t('next')}</span><i class="ic ic-right"></i></button>`;
        this.$('.result').className = 'card result winc';
    },

    showLose(lvl, kills, canRevive) {
        this.show('result');
        this._result = null;
        if (Platform.name === 'crazygames') Platform.gameplay(false);   // перерыв; продолжение — снова gameplayStart (Game.revive)
        this.$('#r-title').innerHTML = `<span class="lose">${Lang.t('lose')}</span><small>${Lang.t('levelN', { n: lvl.n })}</small>`;
        this.$('#r-stars').innerHTML = '';
        this.$('#r-info').innerHTML = `<div class="rrow"><span>${Lang.t('killed')}</span><b>${kills} / ${lvl.kills}</b></div>`;
        const revive = canRevive && Platform.reviveOffer();
        // CrazyGames: «заново» — кнопка без рекламы того же размера и цвета, что и «продолжить за рекламу».
        const even = revive && Platform.name === 'crazygames';
        this.$('#r-btns').classList.toggle('even', even);
        const retry = `<i class="ic ic-return"></i><span>${Lang.t('restart')}</span>`, home = `<button class="btn orange" data-act="to-menu"><i class="ic ic-home"></i><span>${Lang.t('menu')}</span></button>`;
        this.$('#r-btns').innerHTML = (revive ? `<button class="btn ${even ? 'green' : 'purple'} big rwbtn" data-act="revive"><i class="ic ic-video"></i><span>${Lang.t('revive')}</span><em class="rwnote">${Lang.t('watchAd')}</em></button>` : '') +
            (even ? `<button class="btn green big" data-act="retry">${retry}</button><div class="row">${home}</div>` : `<div class="row"><button class="btn blue" data-act="retry">${retry}</button>
            ${home}</div>`);
        this.$('.result').className = 'card result losec';
    },

    async revive(el) {
        el.setAttribute('disabled', '');
        const ok = await Platform.rewarded('revive');
        if (ok) { this.game.revive(); }
        else { this.toast(Lang.t('adFail'), '#ff6b6b'); el.remove(); }
    },

    async double(el) {
        if (!this._result || this._result.doubled) return;
        el.setAttribute('disabled', '');
        const ok = await Platform.rewarded('double-coins');
        if (ok && this._result && !this._result.doubled) {
            this._result.doubled = true;
            GameState.addCoins(this._result.coins + this._result.bonus);
            Sound.play('assets/sounds/buy.ogg', { volume: 0.8 });
            const e = this.$('#r-earn'); if (e) e.textContent = this.fmt(this._result.coins * 2);
            el.remove();
            this.toast('×2', '#ffcf2e');
        } else if (!ok) { this.toast(Lang.t('adFail'), '#ff6b6b'); if (Platform.rewardedReady()) el.removeAttribute('disabled'); else el.remove(); }
    },
};
