// Platform.js — платформа игры: Яндекс Игры (YaGames), YouTube Playables (ytgame),
// Playgama Bridge v2 (bridge), CrazyGames SDK v3 или локальный запуск. Игра зовёт только Platform — SDK знает этот файл.
// SDK подключает сборка: build.bat yandex вписывает в index.html скрипт /sdk.js,
// build.bat playables — SDK Playables первым скриптом, build.bat playgama — Bridge с CDN
// первым скриптом и playgama-bridge-config.json рядом с index.html. Без SDK (run.bat, web-сборка)
// работает локальный адаптер: сохранения — в Store, реклама — ничего (с ?mockads в
// адресе — заглушка-оверлей на секунду: проверить паузу, звук и выдачу награды).
//
//   await Platform.init()        SDK, язык платформы, события паузы (main.js)
//   Platform.firstFrame()        экран загрузки на экране (Playables firstFrameReady; main.js)
//   Platform.ready()             игра готова к вводу: Яндекс LoadingAPI.ready, Playables gameReady (main.js)
//   Platform.gameplay(on)        идёт ли игровой процесс (Яндекс GameplayAPI start/stop);
//                                на паузе (Pause.js) движок сам шлёт stop, после — start
//   Platform.ads.roundEnded()    раунд завершён (победа или поражение) — ОДИН раз на раунд
//   Platform.ads.next(go)        переход по кнопке «Далее/Заново/Меню»: после двух
//                                результатов сначала interstitial, потом go(); защита от двойного клика
//   Platform.ads.click()         сборка Playables: клик по кнопке интерфейса просит interstitial
//   await Platform.rewarded(id)  true — ТОЛЬКО если SDK подтвердил просмотр
//   Platform.rewardedReady()     есть ли смысл предлагать «за рекламу» (CrazyGames: блокировщик, Basic Launch)
//   Platform.rewardedCooldownLeft()  сколько секунд ждать кнопке монет за рекламу
//   Platform.reviveOffer()       можно ли предложить «продолжить за рекламу» на этой смерти
//   Platform.submitScore(n)      рекорд: Яндекс — лидерборд 'Score' (не чаще раза в секунду), Playables — sendScore
//   await Platform.leaderboard() [{ rank, name, score, me, avatar }] или null (Яндекс)
//   Platform.authorized() / await Platform.login()  авторизация для рекорда (Яндекс, вход — по кнопке)
//   await Platform.load()        сохранение игры (объект) или null
//   await Platform.save(obj)     записать сохранение (Яндекс — облако игрока + Store, Playables — saveData)
// На время рекламы игра и звук стоят (Pause 'ad'), после — прежнее состояние.

/** @satisfies {Record<string, any>} */
const Platform = {
    name: 'local',        // 'yandex' | 'playables' | 'playgama' | 'crazygames' | 'local'
    sdk: null,            // объект SDK Яндекса (ysdk)
    lang: null,           // язык платформы (BCP-47) или null
    player: null,         // игрок Яндекса
    LEADERBOARD: 'Score', // технический id лидерборда Яндекса (в интерфейсе — «Рекорды»)
    _readySent: false,
    _readyWanted: false,      // игра уже сообщила о готовности (для Bridge, поднявшегося с опозданием)
    _bridgeLate: false,       // Bridge завершил initialize после таймаута
    _bridgeReadySent: false,
    _loadFailed: false,       // загрузка сохранения не удалась: облако не перезаписывать вслепую
    _firstFrameSent: false,
    _playing: false,
    _gameplaySent: false, // последнее, что ушло в GameplayAPI: stop без start не шлётся
    _adBusy: false,
    _loaded: null,        // Promise первого load() — Playables: saveData только после loadData
    _scoreAt: 0,
    _scoreTimer: 0,
    _scorePending: null,
    _noAds: false,        // CrazyGames: блокировщик или реклама выключена (Basic Launch) — rewarded спрятан
    _dataOff: false,      // CrazyGames: модуль data выключен для игры — сохранения в Store
    _rewardedAt: 0,       // Date.now() последнего успешного rewarded
    _reviveAt: 0,         // Date.now() последнего предложения «продолжить за рекламу»

    async init() {
        try {
            if (typeof bridge !== 'undefined' && bridge && typeof bridge.initialize === 'function') await this._initPlaygama();
            else if (typeof YaGames !== 'undefined') await this._initYandex();
            else if (typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV) await this._initPlayables();
            else if (typeof CrazyGames !== 'undefined' && CrazyGames.SDK) await this._initCrazy();
        } catch (e) {
            // В Playables нельзя незаметно перейти на локальные сохранения или
            // потерять обязательные SDK-события. Загрузка покажет ошибку/повтор.
            if (typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV) throw e;
            console.warn('Platform: SDK не поднялся, играем локально — ' + ((e && e.message) || e));
            this.name = 'local';
            this.sdk = null;
        }
        Pause.onChange(() => this._syncGameplay());
        console.log('Platform: ' + this.name + (this.lang ? ', язык платформы ' + this.lang : ''));
        return this;
    },

    async _initYandex() {
        let timer = 0;
        const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('YaGames.init timeout')), 8000); });
        try { this.sdk = await Promise.race([YaGames.init(), timeout]); } finally { clearTimeout(timer); }
        this.name = 'yandex';
        try { this.lang = this.sdk.environment.i18n.lang || null; } catch (e) { /* язык по умолчанию */ }
        if (typeof this.sdk.on === 'function') {
            this.sdk.on('game_api_pause', () => Pause.set('platform', true));
            this.sdk.on('game_api_resume', () => Pause.set('platform', false));
        }
        try { this.player = await this.sdk.getPlayer({ scopes: false }); } catch (e) { this.player = null; }
    },

    // Playgama Bridge v2: initialize до любого bridge.*, язык платформы, пауза и звук —
    // события платформы (вкладка, реклама, системная пауза), начальный звук — isAudioEnabled.
    async _initPlaygama() {
        let timer = 0;
        const init = Promise.resolve(bridge.initialize());
        const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('bridge.initialize timeout')), 10000); });
        try { await Promise.race([init, timeout]); } catch (e) {
            // Bridge поднялся позже таймаута: игра уже идёт локально, но готовность платформе
            // всё равно нужна — отправить, как только initialize завершится.
            init.then(() => { this._bridgeLate = true; if (this._readyWanted) this._bridgeReady(); }).catch(() => {});
            throw e;
        } finally { clearTimeout(timer); }
        this.name = 'playgama';
        this.sdk = bridge;
        try { this.lang = bridge.platform.language || null; } catch (e) { this.lang = null; }
        const E = bridge.EVENT_NAME;
        bridge.platform.on(E.PAUSE_STATE_CHANGED, (paused) => Pause.set('platform', !!paused));
        bridge.platform.on(E.AUDIO_STATE_CHANGED, (on) => Sound.setPlatformMuted(!on));
        Sound.setPlatformMuted(bridge.platform.isAudioEnabled === false);
        // Игра открылась поверх уже показанной рекламы — сразу пауза (снимет событие паузы).
        try { if (bridge.advertisement.interstitialState === 'opened') Pause.set('platform', true); } catch (e) { /* нет рекламы */ }
    },

    // Событие жизненного цикла платформе (Playgama: level_started / level_completed / level_failed).
    message(id, data) {
        if (this.name !== 'playgama') return;
        try { bridge.platform.sendMessage(id, data); } catch (e) { /* платформа не принимает сообщение */ }
    },

    // Итог раунда: платформе (аналитика Playgama); реклама считается отдельно (ads.roundEnded).
    levelEnd(win, level) {
        this.message(win ? 'level_completed' : 'level_failed', level ? { level: String(level) } : undefined);
    },

    async _initPlayables() {
        this.name = 'playables';
        const sys = ytgame.system;
        sys.onPause(() => Pause.set('platform', true));
        sys.onResume(() => Pause.set('platform', false));
        sys.onAudioEnabledChange((on) => Sound.setPlatformMuted(!on));
        Sound.setPlatformMuted(!sys.isAudioEnabled());
        try { this.lang = await sys.getLanguage(); } catch (e) { this.lang = null; }
    },

    // CrazyGames SDK v3: init раньше любого вызова SDK; 'disabled' (чужой домен) — играем локально.
    // Язык — systemInfo.locale, звук — настройка сайта muteAudio (важнее кнопки игры), блокировщик
    // прячет предложения «за рекламу». Сверено с docs.crazygames.com, 2026-11-01.
    async _initCrazy() {
        const sdk = CrazyGames.SDK;
        const limit = (promise, ms, what) => {
            let timer = 0;
            const source = Promise.resolve(promise);
            source.catch(() => {});   // поздний отказ после таймаута — не unhandled
            const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(what + ' timeout')), ms); });
            return Promise.race([source, timeout]).finally(() => clearTimeout(timer));
        };
        await limit(sdk.init(), 10000, 'CrazyGames.SDK.init');
        if (sdk.environment === 'disabled') throw new Error('CrazyGames SDK отключён на этом домене');
        this.name = 'crazygames';
        this.sdk = sdk;
        try { sdk.game.loadingStart(); } catch (e) { /* старый SDK */ }
        try { this.lang = sdk.user.systemInfo.locale || null; } catch (e) { this.lang = null; }
        try {
            sdk.game.addSettingsChangeListener((s) => Sound.setPlatformMuted(!!(s && s.muteAudio)));
            // Без mute ничего не трогаем: контекст звука создаст первый жест игрока.
            if (sdk.game.settings && sdk.game.settings.muteAudio) Sound.setPlatformMuted(true);
        } catch (e) { /* настройки по умолчанию */ }
        try { this._noAds = (await limit(sdk.ad.hasAdblock(), 3000, 'CrazyGames.SDK.ad.hasAdblock')) === true; } catch (e) { /* неизвестно — реклама есть */ }
    },

    // --- Жизненный цикл -------------------------------------------------------

    firstFrame() {
        if (!this._firstFrameSent && typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV) {
            ytgame.game.firstFrameReady();
            this._firstFrameSent = true;
        }
    },

    // Сцена готова, первые кадры ещё не нарисованы (LoadingScreen.ready). Playgama: game_ready —
    // уже сейчас. Автопроверка архива идёт без видеокарты, первый кадр там рисуется десятки
    // секунд, и готовность «после кадров» в её таймаут не попадает; на устройствах игроков
    // разница — два кадра. Яндекс и Playables — как раньше, после снятия экрана загрузки.
    // Возвращает паузу в мс без кадров после сообщения (LoadingScreen.ready): родительская
    // страница получает game_ready до первого кадра, который занимает поток.
    sceneReady() {
        if (this.name !== 'playgama') return 0;
        this.ready();
        return 300;
    },

    // Playgama: под экраном загрузки 3D-кадры не рисуются (main.js) — шейдеры соберутся в двух
    // кадрах перед снятием экрана, как и раньше, но загрузка не тратит время на невидимые кадры.
    get quietLoading() { return this.name === 'playgama'; },

    _bridgeReady() {
        if (this._bridgeReadySent) return;
        try { bridge.platform.sendMessage('game_ready'); this._bridgeReadySent = true; } catch (e) { console.warn('Platform.ready:', e); }
    },

    ready() {
        this._readyWanted = true;
        if (this._bridgeLate) this._bridgeReady();
        if (this._readySent) return;
        try {
            if (this.name === 'yandex') this.sdk.features.LoadingAPI && this.sdk.features.LoadingAPI.ready();
            else if (this.name === 'playgama') { bridge.platform.sendMessage('game_ready'); this._bridgeReadySent = true; }
            else if (this.name === 'crazygames') this.sdk.game.loadingStop();
            else if (this.name === 'playables') {
                this.firstFrame();
                ytgame.game.gameReady();
            }
            this._readySent = true;
        } catch (e) {
            if (this.name === 'playables') throw e;
            console.warn('Platform.ready:', e);
        }
    },

    // on — игрок в игровом процессе (раунд идёт). Меню, экран результата, пауза — false.
    gameplay(on) {
        if (on && !this._playing) this.message('level_started');
        this._playing = !!on;
        this._syncGameplay();
    },

    _syncGameplay() {
        // CrazyGames: фокус и уход со страницы ведёт сам сайт — автопауза не остановка игрового процесса.
        const crazy = this.name === 'crazygames';
        const want = this._playing && (crazy ? ![...Pause.reasons].some(r => r !== 'auto') : !Pause.active);
        if (this._gameplaySent === want || (this.name !== 'yandex' && !crazy)) { this._gameplaySent = want; return; }
        this._gameplaySent = want;
        if (crazy) {
            try { if (want) this.sdk.game.gameplayStart(); else this.sdk.game.gameplayStop(); } catch (e) { /* SDK старый */ }
            return;
        }
        try {
            const api = this.sdk.features.GameplayAPI;
            if (api) { if (want) api.start(); else api.stop(); }
        } catch (e) { /* SDK без GameplayAPI */ }
    },

    // --- Реклама ----------------------------------------------------------------

    // Interstitial. true — запрос успешен (Playables НЕ подтверждает факт показа).
    // Яндекс возвращает shown. Ошибка/нет API — false, переход всё равно продолжается.
    async interstitial() {
        if (this._adBusy) return false;
        this._adBusy = true;
        if (this.name !== 'crazygames') Pause.set('ad', true);   // CrazyGames — своя пауза (_crazyAd)
        try {
            if (this.name === 'crazygames') return await this._crazyAd('midgame');
            if (this.name === 'yandex') {
                return await new Promise((resolve) => this.sdk.adv.showFullscreenAdv({ callbacks: {
                    onClose: (shown) => resolve(!!shown),
                    onError: () => resolve(false),
                    onOffline: () => resolve(false),
                } }));
            }
            if (this.name === 'playables') {
                if (!ytgame.ads || !ytgame.ads.requestInterstitialAd) return false;
                await ytgame.ads.requestInterstitialAd();
                return true;
            }
            if (this.name === 'playgama') return await this._bridgeAd(false, 'level_completed');
            return await this._mockAd(false);
        } catch (e) {
            return false;
        } finally {
            Pause.set('ad', false);
            this._adBusy = false;
        }
    },

    // Rewarded. id — стабильный id награды без данных игрока ('continue', 'coins-x2').
    // true — ТОЛЬКО по подтверждению SDK; закрытие и ошибка — false. Награду выдаёт
    // игра по true и один раз.
    async rewarded(id) {
        const ok = await this._rewarded(id);
        if (ok) this._rewardedAt = Date.now();
        return ok;
    },

    rewardedReady() { return !this._noAds; },

    rewardedCooldownLeft() {
        const sec = typeof REWARDED_COOLDOWN_SEC !== 'undefined' ? REWARDED_COOLDOWN_SEC : 0;
        return Math.max(0, Math.ceil(sec - (Date.now() - this._rewardedAt) / 1000));
    },

    // Предложить «продолжить за рекламу» на этой смерти? CrazyGames: не при каждой смерти (таймер)
    // и не вместе с midgame в одном переходе — ads.next этот переход пропустит.
    reviveOffer() {
        if (!this.rewardedReady()) return false;
        if (this.name !== 'crazygames') return true;
        const gap = (typeof CRAZY_REVIVE_GAP_SEC !== 'undefined' ? CRAZY_REVIVE_GAP_SEC : 0) * 1000;
        if (this._reviveAt && Date.now() - this._reviveAt < gap) return false;
        this._reviveAt = Date.now();
        this.ads.keepPlayingOffered = true;
        return true;
    },

    // CrazyGames: requestAd. Пока идёт запрос — пауза 'adwait' (игра стоит, звук играет, интерфейс
    // закрыт прозрачным слоем), с adStarted — 'ad' (звук молчит); всё снимается на любом исходе.
    // true — adFinished (rewarded: награда подтверждена). adblock и adsDisabled (Basic Launch, режим
    // Kids; adsDisabledBasicLaunch — прежнее имя кода) прячут rewarded; unfilled, adCooldown — игра идёт дальше.
    _crazyAd(type) {
        return new Promise((resolve) => {
            let done = false, timer = 0;
            const block = document.createElement('div');
            block.style.cssText = 'position:fixed;inset:0;z-index:99998;background:transparent';
            document.body.appendChild(block);
            Pause.set('adwait', true);
            const finish = (ok) => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                block.remove();
                Pause.set('ad', false);
                Pause.set('adwait', false);
                resolve(ok === true);
            };
            timer = setTimeout(() => finish(false), 15000);
            try {
                this.sdk.ad.requestAd(type, {
                    adStarted: () => {
                        if (done) return;
                        Pause.set('ad', true);
                        clearTimeout(timer);
                        timer = setTimeout(() => finish(false), 300000);
                    },
                    adFinished: () => finish(true),
                    adError: (err) => {
                        const code = err && err.code;
                        if (code === 'adblock' || code === 'adsDisabled' || code === 'adsDisabledBasicLaunch') this._noAds = true;
                        finish(false);
                    },
                });
            } catch (e) {
                finish(false);
            }
        });
    },

    async _rewarded(id) {
        if (this._adBusy) return false;
        this._adBusy = true;
        if (this.name !== 'crazygames') Pause.set('ad', true);
        try {
            if (this.name === 'crazygames') return await this._crazyAd('rewarded');
            if (this.name === 'yandex') {
                return await new Promise((resolve) => {
                    let got = false;
                    this.sdk.adv.showRewardedVideo({ callbacks: {
                        onRewarded: () => { got = true; },
                        onClose: () => resolve(got),
                        onError: () => resolve(false),
                    } });
                });
            }
            if (this.name === 'playables') {
                if (!ytgame.ads || !ytgame.ads.requestRewardedAd) return false;
                return (await ytgame.ads.requestRewardedAd(String(id || 'reward'))) === true;
            }
            if (this.name === 'playgama') return await this._bridgeAd(true, String(id || 'reward'));
            return await this._mockAd(true);
        } catch (e) {
            return false;
        } finally {
            Pause.set('ad', false);
            this._adBusy = false;
        }
    },

    // Реклама Bridge по событиям состояния. Rewarded — true ТОЛЬКО если было состояние
    // 'rewarded' (закрытие без него — false). Interstitial — true, если реклама открылась.
    // Bridge молча пропускает показ чаще minimumDelayBetweenInterstitial: нет ни одного
    // события за 3 с — дальше без рекламы (после 'loading' ждём до 15 с, после 'opened' — закрытия).
    _bridgeAd(rewarded, placement) {
        const ad = bridge.advertisement;
        if (rewarded ? !ad.isRewardedSupported : !ad.isInterstitialSupported) return Promise.resolve(false);
        const E = rewarded ? bridge.EVENT_NAME.REWARDED_STATE_CHANGED : bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED;
        return new Promise((resolve) => {
            let opened = false, got = false, done = false, timer = 0;
            const wait = (ms) => { clearTimeout(timer); timer = ms ? setTimeout(() => finish(rewarded ? got : opened), ms) : 0; };
            const finish = (v) => {
                if (done) return;
                done = true; clearTimeout(timer);
                if (typeof ad.off === 'function') try { ad.off(E, on); } catch (e) { /* старый SDK */ }
                resolve(!!v);
            };
            const on = (state) => {
                if (state === 'loading') wait(15000);
                else if (state === 'opened') { opened = true; wait(0); }
                else if (state === 'rewarded') got = true;
                else if (state === 'closed') finish(rewarded ? got : opened);
                else if (state === 'failed') finish(rewarded ? got : false);
            };
            ad.on(E, on);
            wait(3000);
            try { if (rewarded) ad.showRewarded(placement); else ad.showInterstitial(placement); } catch (e) { finish(false); }
        });
    },

    // Локальная заглушка рекламы: только с ?mockads в адресе — оверлей на секунду,
    // rewarded засчитывается. Без флага — рекламы нет (false).
    _mockAd(reward) {
        if (!/[?&#]mockads\b/.test(location.search + location.hash)) return Promise.resolve(false);
        return new Promise((resolve) => {
            const el = document.createElement('div');
            el.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
                'background:rgba(0,0,0,.85);color:#fff;font:bold 22px system-ui,sans-serif;text-align:center';
            el.textContent = (reward ? 'REWARDED' : 'INTERSTITIAL') + ' — local mock';
            document.body.appendChild(el);
            setTimeout(() => { el.remove(); resolve(true); }, 1000);
        });
    },

    // Счётчик interstitial по правилу игры: реклама — после каждых ДВУХ завершённых
    // раундов (любой исход), и только по кнопке перехода, не в момент результата.
    ads: {
        results: 0,
        busy: false,
        /** @type {Promise<void> | null} */
        _clickAd: null,
        keepPlayingOffered: false,   // CrazyGames: на этом переходе уже было «продолжить за рекламу»

        // Playables: interstitial по клику по кнопке интерфейса (требование пользователя,
        // 26.10.2026). «Отправил и забыл»: показывать ли ролик и как часто, решает YouTube;
        // если ролик пошёл, SDK сам ставит игру на паузу (onPause) — своей паузы нет, и звук
        // не дёргается на каждом клике. Кнопки игрового процесса и rewarded сюда не зовут
        // (GameUI.breakOnClick). Запрос гасит заработанную по раундам рекламу: next() не
        // просит вторую подряд. Локально (сборка playables без SDK) — заглушка ?mockads.
        click() {
            const yt = Platform.name === 'playables';
            if (!(yt || String(GAME_PLATFORM) === 'playables') || Platform._adBusy || this._clickAd) return;
            this.results = 0;
            this._clickAd = (yt ? Promise.resolve().then(() => ytgame.ads.requestInterstitialAd()) : Platform.interstitial())
                .then(() => {}, () => {}).finally(() => { this._clickAd = null; });
        },

        // Раунд завершён (победа или поражение) — звать ОДИН раз на раунд.
        roundEnded() { this.results++; },

        // Переход по кнопке: после двух результатов — сначала реклама, затем go().
        // Повторный клик, пока идёт переход, игнорируется. Реклама не пришла или
        // ошибка — переход без задержки, новый цикл из двух результатов.
        // nav — кнопка навигации (меню): CrazyGames запрещает на ней midgame, заработанная реклама ждёт
        // следующего перехода между уровнями.
        async next(go, nav) {
            if (this.busy) return;
            this.busy = true;
            try {
                const skip = Platform.name === 'crazygames' && (nav || this.keepPlayingOffered);
                this.keepPlayingOffered = false;
                if (this.results >= 2 && !skip) {
                    this.results = 0;
                    await Platform.interstitial();
                }
                if (go) await go();
            } finally {
                this.busy = false;
            }
        },
    },

    // --- Рекорды -------------------------------------------------------------------

    // Рекорд игрока. Яндекс: лидерборд 'Score', не чаще раза в секунду (лишнее — последним
    // значением через секунду). Playables: sendScore.
    submitScore(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return;
        const v = Math.max(0, Math.floor(number));
        if (!Number.isSafeInteger(v)) return;
        if (this.name === 'playables') {
            try { ytgame.engagement.sendScore({ value: v }).catch(() => {}); } catch (e) { /* SDK старый */ }
            return;
        }
        if (this.name !== 'yandex') return;
        this._scorePending = v;
        const wait = this._scoreAt + 1100 - Date.now();
        if (wait > 0) {
            if (!this._scoreTimer) this._scoreTimer = setTimeout(() => { this._scoreTimer = 0; this.submitScore(this._scorePending); }, wait);
            return;
        }
        this._scoreAt = Date.now();
        this._scorePending = null;
        const lb = this.sdk.leaderboards;
        const send = () => (lb && lb.setScore ? lb.setScore(this.LEADERBOARD, v)
            : this.sdk.getLeaderboards().then((old) => old.setLeaderboardScore(this.LEADERBOARD, v)));
        // setScore — только авторизованным: сначала isAvailableMethod (документация Яндекса).
        const p = typeof this.sdk.isAvailableMethod === 'function'
            ? Promise.resolve(this.sdk.isAvailableMethod('leaderboards.setScore')).then((ok) => (ok ? send() : null))
            : send();
        Promise.resolve(p).catch((e) => console.warn('Platform.submitScore:', (e && e.message) || e));
    },

    // Игрок авторизован на платформе (Яндекс: player.isAuthorized). Вне Яндекса — false.
    authorized() {
        if (this.name !== 'yandex' || !this.player) return false;
        try {
            if (typeof this.player.isAuthorized === 'function') return !!this.player.isAuthorized();
            if (typeof this.player.getMode === 'function') return this.player.getMode() !== 'lite';
        } catch (e) { return false; }
        return true;
    },

    // Окно входа платформы — только по нажатию игрока. true — игрок теперь авторизован.
    async login() {
        if (this.name !== 'yandex' || !this.sdk.auth || typeof this.sdk.auth.openAuthDialog !== 'function') return false;
        try {
            await this.sdk.auth.openAuthDialog();
            this.player = await this.sdk.getPlayer({ scopes: false });
        } catch (e) { return false; }
        return this.authorized();
    },

    // Таблица рекордов (Яндекс): [{ rank, name, score, me, avatar }] или null — нет SDK,
    // нет лидерборда или ошибка. Лимит Яндекса — 20 запросов за 5 минут: кэшировать в игре.
    async leaderboard(opts) {
        if (this.name !== 'yandex') return null;
        const o = Object.assign({ quantityTop: 10, includeUser: true, quantityAround: 3 }, opts || {});
        try {
            const lb = this.sdk.leaderboards;
            const res = lb && lb.getEntries ? await lb.getEntries(this.LEADERBOARD, o)
                : await (await this.sdk.getLeaderboards()).getLeaderboardEntries(this.LEADERBOARD, o);
            let myId = '';
            try { myId = this.player ? this.player.getUniqueID() : ''; } catch (e) { /* аноним */ }
            return (res.entries || []).map((e) => {
                let avatar = '';
                try { avatar = (e.player && typeof e.player.getAvatarSrc === 'function' && e.player.getAvatarSrc('small')) || ''; } catch (err) { /* без аватара */ }
                return {
                    rank: e.rank, score: e.score, avatar,
                    name: (e.player && e.player.publicName) || '',
                    me: !!(myId && e.player && e.player.uniqueID === myId),
                };
            });
        } catch (e) {
            return null;
        }
    },

    // --- Сохранения ------------------------------------------------------------------

    _storeKey() { return (typeof GAME_ID !== 'undefined' ? GAME_ID : 'lory-game') + '.save'; },

    // Сохранение игры: объект или null.
    load() {
        if (!this._loaded) this._loaded = this._load().catch((error) => {
            this._loaded = null; // ошибка сети/данных не означает пустое сохранение; возможен повтор
            this._loadFailed = true;
            throw error;
        });
        return this._loaded;
    },

    async _load() {
        if (this.name === 'playgama') {
            // Только Storage Bridge (правило Playgama: никакого localStorage напрямую). Хранилище
            // может не ответить — без таймаута игра навсегда осталась бы на экране загрузки.
            let timer = 0;
            const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('bridge.storage.get timeout')), 8000); });
            let res;
            try { res = await Promise.race([bridge.storage.get(['save']), timeout]); } finally { clearTimeout(timer); }
            const raw = Array.isArray(res) ? res[0] : res && res.save;
            if (raw == null || raw === '') return null;
            const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return data && typeof data === 'object' ? data : null;
        }
        if (this.name === 'crazygames') {
            // Модуль data: гость — локально у SDK, вход — облако аккаунта. Ошибку нельзя превращать
            // в null: следом save затёр бы прогресс. Модуль выключен в настройках игры — Store.
            if (!this._dataOff) {
                try {
                    const raw = await this.sdk.data.getItem('save');
                    if (raw == null || raw === '') return null;
                    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    return data && typeof data === 'object' ? data : null;
                } catch (e) {
                    if (!this._crazyDataOff(e)) throw e;
                }
            }
            return Store.getJSON(this._storeKey(), null);
        }
        if (this.name === 'playables') {
            // Только SDK. Успешный loadData обязателен ДО saveData; ошибку нельзя
            // превращать в null и затем перезаписывать облако новой игрой.
            const raw = await ytgame.game.loadData();
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || typeof data !== 'object') throw new Error('Invalid Playables save data');
            return data;
        }
        const local = Store.getJSON(this._storeKey(), null);
        try {
            if (this.name === 'yandex' && this.player) {
                const data = await this.player.getData(['save']);
                if (data && data.save && typeof data.save === 'object') return data.save;
            }
        } catch (e) {
            console.warn('Platform.load:', (e && e.message) || e);
        }
        return local;
    },

    // Ошибка data — «модуль выключен для игры»? Тогда дальше сохраняем в Store.
    _crazyDataOff(e) {
        const off = !!e && String(e.code || e.message || '').includes('dataModuleDisabled');
        if (off) this._dataOff = true;
        return off;
    },

    // Записать JSON. Playables: только SDK, после УСПЕШНОГО load; без localStorage.
    // До начала новой игры нужно await Platform.load() и применить загруженный
    // прогресс; rejected load следует показать как ошибку с повтором.
    async save(obj) {
        try {
            const data = JSON.stringify(obj);
            if (typeof data !== 'string') return false;
            if (this.name === 'playgama') {
                // Загрузка при старте не удалась, а позже облако ответило прогрессом, который
                // игра не применила: не затирать его новой игрой этого сеанса.
                const cloud = await this.load();
                if (this._loadFailed && cloud) return false;
                await bridge.storage.set(['save'], [data]);
                return true;
            }
            if (this.name === 'crazygames') {
                await this.load();   // запись только после успешной загрузки
                if (!this._dataOff) {
                    try { await this.sdk.data.setItem('save', data); return true; } catch (e) {
                        if (!this._crazyDataOff(e)) throw e;
                    }
                }
            }
            if (this.name === 'playables') {
                // Консервативная проверка обоих представлений: < 3 MiB (MUST).
                // JSON.stringify экранирует непарные суррогаты: строка well-formed UTF-16.
                const bytes = Math.max(data.length * 2, new TextEncoder().encode(data).byteLength);
                if (bytes >= 3 * 1024 * 1024) throw new Error('Playables save must be smaller than 3 MiB');
                await this.load();
                await ytgame.game.saveData(data);
            } else {
                const stored = Store.set(this._storeKey(), data);
                if (this.name === 'yandex' && this.player) await this.player.setData({ save: obj }, true);
                else if (!stored) return false;
            }
            return true;
        } catch (e) {
            console.warn('Platform.save:', (e && e.message) || e);
            return false;
        }
    },
};
