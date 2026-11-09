// GameMusic.js — музыка Backflip Rooftops Survivor. Фон — свои треки игры
// (assets/sounds/bgm-*.ogg, ноты и синтезатор — tools/gen-music.mjs) через Sound.music:
// меню — bgm-menu, бой — bgm-run и bgm-break по очереди от уровня к уровню, босс —
// bgm-boss. Короткие джинглы start / win / lose — свой синтезатор
// на Web Audio (без файлов). Выход джинглов — шина музыки движка (Sound.musicGain):
// громкость MUSIC_VOLUME, выключение звука и пауза работают сами.

/** @satisfies {Record<string, any>} */
const GameMusic = {
    bus: null, wet: null, _noise: null, _ctx: null,

    // Фоновые треки: путь и громкость (×MUSIC_VOLUME) — выровнены по LUFS (отчёт
    // gen-music): меню ≈ −14.5, бой и босс ≈ −15.5, чтобы эффекты оставались слышны.
    TRACKS: {
        menu: { url: 'assets/sounds/bgm-menu.ogg', volume: 0.9 },
        game: { url: 'assets/sounds/bgm-run.ogg', volume: 0.75 },
        game2: { url: 'assets/sounds/bgm-break.ogg', volume: 0.72 },
        boss: { url: 'assets/sounds/bgm-boss.ogg', volume: 0.78 },
    },

    // Трек по имени ('menu' | 'game' | 'boss' | null); level — номер уровня: бой чередует
    // два трека (чётные уровни — второй). Смена — плавная (Sound.music), до первого жеста
    // игрока трек ждёт и стартует сам.
    play(name, level) {
        const key = name === 'game' && level && level % 2 === 0 ? 'game2' : name;
        const tr = key ? this.TRACKS[key] : null;
        Sound.music(tr ? tr.url : null, tr ? { volume: tr.volume, fade: 1 } : { fade: 0.8 });
    },

    mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); },

    // Ждать жеста игрока: контекст создаёт Sound на первом касании/клавише.
    _setup() {
        const ctx = Sound.ctx;
        if (!ctx || !Sound.musicGain) return null;
        if (this._ctx === ctx) return ctx;
        this._ctx = ctx;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
        comp.connect(Sound.musicGain);
        this.bus = ctx.createGain(); this.bus.gain.value = 0.55; this.bus.connect(comp);
        // Реверберация: импульс из затухающего шума.
        const len = Math.floor(ctx.sampleRate * 1.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
        const conv = ctx.createConvolver(); conv.buffer = ir;
        this.wet = ctx.createGain(); this.wet.gain.value = 0.28;
        this.wet.connect(conv); conv.connect(comp);
        const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this._noise = nb;
        return ctx;
    },

    _env(g, t, a, peak, d, sustain, end) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + a);
        g.gain.setTargetAtTime(peak * sustain, t + a, d);
        g.gain.setTargetAtTime(0.0001, end, 0.05);
    },

    kick(t, out, v) {
        const ctx = this._ctx, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.36);
    },

    noise(t, out, v, len, type, freq, q) {
        const ctx = this._ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = this._noise; src.playbackRate.value = 1;
        f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
        src.connect(f); f.connect(g); g.connect(out);
        src.start(t, Math.random() * 0.5); src.stop(t + len + 0.02);
        return g;
    },

    snare(t, out, v) {
        this.noise(t, out, v, 0.18, 'highpass', 1400);
        const ctx = this._ctx, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
        g.gain.setValueAtTime(v * 0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.12);
        const s = this.noise(t, this.wet, v * 0.3, 0.1, 'bandpass', 2500, 1);
        void s;
    },

    hat(t, out, v, open) { this.noise(t, out, v, open ? 0.22 : 0.045, 'highpass', 7500); },

    tom(t, out, midi, v) {
        const ctx = this._ctx, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; const f = this.mtof(midi);
        o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.1);
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.27);
    },

    bass(t, out, midi, len, heavy) {
        const ctx = this._ctx, f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'lowpass'; f.Q.value = heavy ? 9 : 6;
        f.frequency.setValueAtTime(heavy ? 1800 : 1300, t); f.frequency.setTargetAtTime(heavy ? 380 : 260, t, 0.06);
        for (const det of heavy ? [-8, 8] : [0]) {
            const o = ctx.createOscillator();
            o.type = 'sawtooth'; o.frequency.value = this.mtof(midi); o.detune.value = det;
            o.connect(f); o.start(t); o.stop(t + len + 0.1);
        }
        this._env(g, t, 0.005, heavy ? 0.34 : 0.3, 0.08, 0.6, t + len);
        f.connect(g); g.connect(out);
    },

    pluck(t, out, midi, len, v) {
        const ctx = this._ctx, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'square'; o.frequency.value = this.mtof(midi);
        f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.setTargetAtTime(700, t, 0.05);
        g.gain.setValueAtTime(v, t); g.gain.setTargetAtTime(0.0001, t + 0.01, 0.07);
        o.connect(f); f.connect(g); g.connect(out); g.connect(this.wet);
        o.start(t); o.stop(t + Math.max(0.3, len) + 0.1);
    },

    pad(t, out, notes, len) {
        const ctx = this._ctx, f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.5;
        for (const n of notes) for (const det of [-9, 9]) {
            const o = ctx.createOscillator();
            o.type = 'sawtooth'; o.frequency.value = this.mtof(n); o.detune.value = det;
            o.connect(f); o.start(t); o.stop(t + len + 0.8);
        }
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.4); g.gain.setTargetAtTime(0.0001, t + len, 0.25);
        f.connect(g); g.connect(out); g.connect(this.wet);
    },

    lead(t, out, midi, len, vol) {
        const ctx = this._ctx, f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'lowpass'; f.frequency.setValueAtTime(3600, t); f.frequency.setTargetAtTime(1800, t, 0.12); f.Q.value = 2;
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 5.5; lg.gain.value = 9; lfo.connect(lg);
        for (const [type, det] of [['square', -6], ['sawtooth', 6]]) {
            const o = ctx.createOscillator();
            o.type = /** @type {OscillatorType} */ (type); o.frequency.value = this.mtof(midi); o.detune.value = det;
            lg.connect(o.detune);
            o.connect(f); o.start(t); o.stop(t + len + 0.3);
        }
        lfo.start(t); lfo.stop(t + len + 0.3);
        this._env(g, t, 0.01, 0.085 * (vol || 1), 0.1, 0.7, t + len * 0.92);
        f.connect(g); g.connect(out); g.connect(this.wet);
    },

    bell(t, out, midi, len) {
        const ctx = this._ctx, g = ctx.createGain();
        for (const [mul, v] of [[1, 1], [2.01, 0.35], [3.98, 0.12]]) {
            const o = ctx.createOscillator(), og = ctx.createGain();
            o.type = 'sine'; o.frequency.value = this.mtof(midi) * mul; og.gain.value = v;
            o.connect(og); og.connect(g); o.start(t); o.stop(t + len + 1.6);
        }
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.13, t + 0.01); g.gain.setTargetAtTime(0.0001, t + 0.02, Math.min(0.9, len * 0.5));
        g.connect(out); g.connect(this.wet);
    },

    // Короткие джинглы поверх трека: start, win, lose.
    jingle(name) {
        const ctx = this._setup();
        if (!ctx || ctx.state !== 'running') return;
        const out = this.bus, t = ctx.currentTime + 0.03, b = 0.11;
        const seq = {
            start: [[0, 62, 1], [1, 66, 1], [2, 69, 1], [3, 74, 3]],
            win: [[0, 72, 1], [1, 76, 1], [2, 79, 1], [3, 84, 2], [5, 79, 1], [6, 84, 5]],
            lose: [[0, 69, 2], [2, 68, 2], [4, 67, 2], [6, 66, 6]],
        }[name];
        if (!seq) return;
        for (const [st, n, len] of seq) {
            this.lead(t + st * b, out, n, len * b + 0.05, 1.3);
            this.pluck(t + st * b, out, n - 12, len * b, 0.09);
        }
        if (name === 'win') { this.pad(t + 6 * b, out, [60, 64, 67, 72], 0.9); this.kick(t, out, 0.7); this.kick(t + 6 * b, out, 0.8); }
        if (name === 'lose') this.pad(t + 6 * b, out, [54, 57, 60], 0.9);
    },
};
