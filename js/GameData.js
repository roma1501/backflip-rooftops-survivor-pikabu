// GameData.js — содержимое Backflip Rooftops Survivor: редкости, оружие, косметика, разделы
// магазина и цены, прокачка, монстры, темы неба и параметры 100 уровней.
// Раскладка уровней (здания, батуты, ящики) — карты Maps.js; здесь только числа
// баланса и каталоги. Все пути моделей — строковыми литералами (их видит сборщик).

/** @typedef {{ ru: string, en: string }} L10n */

// Свои модели (tools/gen-chars.mjs, tools/gen-props.mjs) — пути литералами для сборщика.
const M_GUN = {
    p1: 'assets/models/guns/g-pistol-1.glb', p2: 'assets/models/guns/g-pistol-2.glb', p3: 'assets/models/guns/g-pistol-3.glb', p4: 'assets/models/guns/g-pistol-4.glb',
    s1: 'assets/models/guns/g-smg-1.glb', s2: 'assets/models/guns/g-smg-2.glb', s3: 'assets/models/guns/g-smg-3.glb',
    sh1: 'assets/models/guns/g-shotgun-1.glb', sh2: 'assets/models/guns/g-shotgun-2.glb', sh3: 'assets/models/guns/g-shotgun-3.glb',
    r1: 'assets/models/guns/g-rifle-1.glb', r2: 'assets/models/guns/g-rifle-2.glb', r3: 'assets/models/guns/g-rifle-3.glb', r4: 'assets/models/guns/g-rifle-4.glb',
    h1: 'assets/models/guns/g-heavy-1.glb', h2: 'assets/models/guns/g-heavy-2.glb', h3: 'assets/models/guns/g-heavy-3.glb', h4: 'assets/models/guns/g-heavy-4.glb',
    e1: 'assets/models/guns/g-energy-1.glb', e2: 'assets/models/guns/g-energy-2.glb', e3: 'assets/models/guns/g-energy-3.glb', e4: 'assets/models/guns/g-energy-4.glb',
    xGrenade: 'assets/models/guns/g-x-grenade.glb', xRocket: 'assets/models/guns/g-x-rocket.glb', xHoming: 'assets/models/guns/g-x-homing.glb',
    xCluster: 'assets/models/guns/g-x-cluster.glb', xMortar: 'assets/models/guns/g-x-mortar.glb', xNapalm: 'assets/models/guns/g-x-napalm.glb',
    xMines: 'assets/models/guns/g-x-mines.glb', xFreeze: 'assets/models/guns/g-x-freeze.glb', xSticky: 'assets/models/guns/g-x-sticky.glb', xNuke: 'assets/models/guns/g-x-nuke.glb',
};
const M_HERO = {
    a: 'assets/models/chars/hero-a.glb', b: 'assets/models/chars/hero-b.glb', c: 'assets/models/chars/hero-c.glb',
    d: 'assets/models/chars/hero-d.glb', e: 'assets/models/chars/hero-e.glb', f: 'assets/models/chars/hero-f.glb',
    g: 'assets/models/chars/hero-g.glb', h: 'assets/models/chars/hero-h.glb', i: 'assets/models/chars/hero-i.glb',
    j: 'assets/models/chars/hero-j.glb', k: 'assets/models/chars/hero-k.glb', l: 'assets/models/chars/hero-l.glb',
    m: 'assets/models/chars/hero-m.glb', n: 'assets/models/chars/hero-n.glb', o: 'assets/models/chars/hero-o.glb',
    p: 'assets/models/chars/hero-p.glb', q: 'assets/models/chars/hero-q.glb', r: 'assets/models/chars/hero-r.glb',
    // Легендарные скины-брейнроты (tools/gen-chars.mjs, тот же скелет, что у героев).
    tralalero: 'assets/models/chars/br-tralalero.glb', tungtung: 'assets/models/chars/br-tungtung.glb', bombardiro: 'assets/models/chars/br-bombardiro.glb',
    ballerina: 'assets/models/chars/br-ballerina.glb', patapim: 'assets/models/chars/br-patapim.glb', chimpanzini: 'assets/models/chars/br-chimpanzini.glb',
    lirili: 'assets/models/chars/br-lirili.glb', assassino: 'assets/models/chars/br-assassino.glb',
    // Эксклюзив 7-го дня ежедневного подарка (в магазине скинов его нет).
    alik: 'assets/models/chars/hero-alik.glb',
};
const M_MON = {
    walker: ['assets/models/chars/mon-walker-1.glb', 'assets/models/chars/mon-walker-2.glb', 'assets/models/chars/mon-walker-3.glb'],
    runner: ['assets/models/chars/mon-runner-1.glb', 'assets/models/chars/mon-runner-2.glb', 'assets/models/chars/mon-runner-3.glb'],
    crawler: ['assets/models/chars/mon-crawler-1.glb', 'assets/models/chars/mon-crawler-2.glb'],
    brute: ['assets/models/chars/mon-brute-1.glb', 'assets/models/chars/mon-brute-2.glb', 'assets/models/chars/mon-brute-3.glb'],
    bloater: ['assets/models/chars/mon-bloater-1.glb', 'assets/models/chars/mon-bloater-2.glb'],
    skeleton: ['assets/models/chars/mon-skeleton-1.glb', 'assets/models/chars/mon-skeleton-2.glb', 'assets/models/chars/mon-skeleton-3.glb'],
    vampire: ['assets/models/chars/mon-vampire-1.glb', 'assets/models/chars/mon-vampire-2.glb'],
    ghost: ['assets/models/chars/mon-ghost-1.glb', 'assets/models/chars/mon-ghost-2.glb', 'assets/models/chars/mon-ghost-3.glb'],
    mummy: ['assets/models/chars/mon-mummy-1.glb', 'assets/models/chars/mon-mummy-2.glb'],
    cop: ['assets/models/chars/mon-cop-1.glb', 'assets/models/chars/mon-cop-2.glb'],
    soldier: ['assets/models/chars/mon-soldier-1.glb', 'assets/models/chars/mon-soldier-2.glb'],
    fireman: ['assets/models/chars/mon-fireman-1.glb', 'assets/models/chars/mon-fireman-2.glb'],
    clown: ['assets/models/chars/mon-clown-1.glb', 'assets/models/chars/mon-clown-2.glb'],
    medic: ['assets/models/chars/mon-medic-1.glb', 'assets/models/chars/mon-medic-2.glb'],
    hazmat: ['assets/models/chars/mon-hazmat-1.glb', 'assets/models/chars/mon-hazmat-2.glb'],
    rugby: ['assets/models/chars/mon-rugby-1.glb', 'assets/models/chars/mon-rugby-2.glb'],
    prisoner: ['assets/models/chars/mon-prisoner-1.glb', 'assets/models/chars/mon-prisoner-2.glb'],
    miner: ['assets/models/chars/mon-miner-1.glb', 'assets/models/chars/mon-miner-2.glb'],
    werewolf: ['assets/models/chars/mon-werewolf-1.glb', 'assets/models/chars/mon-werewolf-2.glb'],
    demon: ['assets/models/chars/mon-demon-1.glb', 'assets/models/chars/mon-demon-2.glb'],
};
const M_PROP = {
    coin: 'assets/models/props/coin.glb',
    heart: 'assets/models/props/heart.glb',
    jewel: 'assets/models/props/gem.glb',
    chest: 'assets/models/props/chest.glb',
    spring: 'assets/models/props/spring.glb',
    box: 'assets/models/props/wood-box.glb',
    rocket: 'assets/models/props/rocket.glb',
    grenade: 'assets/models/props/grenade.glb',
    mine: 'assets/models/props/mine.glb',
    bomblet: 'assets/models/props/bomblet.glb',
    sticky: 'assets/models/props/sticky.glb',
};
/** @satisfies {Record<string, any>} */
const GameData = {
    // Редкость оружия внутри уровня: слияние двух одинаковых -> следующая.
    RARITY: [
        { id: 'common', color: '#7fd34e', mult: 1, name: { ru: 'ОБЫЧНОЕ', en: 'COMMON' } },
        { id: 'uncommon', color: '#39a8ff', mult: 1.65, name: { ru: 'НЕОБЫЧНОЕ', en: 'UNCOMMON' } },
        { id: 'rare', color: '#b45cff', mult: 2.7, name: { ru: 'РЕДКОЕ', en: 'RARE' } },
        { id: 'epic', color: '#ffb81f', mult: 4.4, name: { ru: 'ЭПИЧЕСКОЕ', en: 'EPIC' } },
        { id: 'legendary', color: '#ff4848', mult: 7.2, name: { ru: 'ЛЕГЕНДАРНОЕ', en: 'LEGENDARY' } },
        { id: 'mythic', color: '#ff3df0', mult: 11.5, name: { ru: 'МИФИЧЕСКОЕ', en: 'MYTHIC' } },
    ],
    LEGENDARY: 4, MYTHIC: 5,

    // Особые способности легендарного (I) и мифического (II, сильнее) оружия — по классу.
    ABILITIES: {
        pistol: { id: 'ricochet', name: { ru: 'Рикошет', en: 'Ricochet' }, desc: { ru: 'Пуля отскакивает в соседнего врага', en: 'Bullets bounce to a nearby enemy' }, d2: { ru: '3 отскока, урон не падает', en: '3 bounces, full damage' } },
        smg: { id: 'explosive', name: { ru: 'Разрывные пули', en: 'Explosive rounds' }, desc: { ru: '20% пуль взрываются', en: '20% of bullets explode' }, d2: { ru: '35% пуль, взрыв шире', en: '35% of bullets, bigger blast' } },
        shotgun: { id: 'burn', name: { ru: 'Зажигательная дробь', en: 'Dragon breath' }, desc: { ru: 'Дробь поджигает врагов', en: 'Pellets set enemies on fire' }, d2: { ru: 'Сильный огонь, горящие взрываются', en: 'Stronger fire, burning foes explode' } },
        rifle: { id: 'crit', name: { ru: 'Хедшот', en: 'Headshot' }, desc: { ru: '25% шанс крита ×3', en: '25% chance of ×3 crit' }, d2: { ru: '40% шанс крита ×4', en: '40% chance of ×4 crit' } },
        heavy: { id: 'spin', name: { ru: 'Раскрутка', en: 'Spin-up' }, desc: { ru: 'Темп растёт до +60% без пауз', en: 'Fire rate ramps up to +60%' }, d2: { ru: 'Темп до +120%, пули пробивают', en: 'Up to +120%, bullets pierce' } },
        energy: { id: 'chain', name: { ru: 'Цепная молния', en: 'Chain lightning' }, desc: { ru: 'Разряд бьёт ещё 2 врагов', en: 'Arcs to 2 more enemies' }, d2: { ru: 'Разряд бьёт ещё 4 врагов', en: 'Arcs to 4 more enemies' } },
        explosive: { id: 'double', name: { ru: 'Двойной заряд', en: 'Double charge' }, desc: { ru: 'Второй взрыв на месте первого', en: 'A second blast follows' }, d2: { ru: 'Ещё два взрыва, радиус больше', en: 'Two more blasts, wider' } },
    },

    // Сложность уровня: выбор на оверлее перед стартом. Числа — Constants (SM_DIFF_*).
    DIFFS: ['normal', 'high', 'hard'],
    difficulty(id) {
        const U = 'undefined';
        if (id === 'high') return { id, color: '#ff9f1c', hp: typeof SM_DIFF_HIGH_HP !== U ? SM_DIFF_HIGH_HP : 1.45, dmg: typeof SM_DIFF_HIGH_DMG !== U ? SM_DIFF_HIGH_DMG : 1.3,
            spawn: typeof SM_DIFF_HIGH_SPAWN !== U ? SM_DIFF_HIGH_SPAWN : 1.2, reward: typeof SM_DIFF_HIGH_REWARD !== U ? SM_DIFF_HIGH_REWARD : 1.7 };
        if (id === 'hard') return { id, color: '#ff3b3b', hp: typeof SM_DIFF_HARD_HP !== U ? SM_DIFF_HARD_HP : 2.1, dmg: typeof SM_DIFF_HARD_DMG !== U ? SM_DIFF_HARD_DMG : 1.7,
            spawn: typeof SM_DIFF_HARD_SPAWN !== U ? SM_DIFF_HARD_SPAWN : 1.4, reward: typeof SM_DIFF_HARD_REWARD !== U ? SM_DIFF_HARD_REWARD : 2.8 };
        return { id: 'normal', color: '#5ad13a', hp: 1, dmg: 1, spawn: 1, reward: 1 };
    },

    // Суперспособности питомцев: по редкости — сильнее и чаще (cd — перезарядка, с).
    PET_ABILITIES: {
        drone: { id: 'volley', icon: 'assets/ui/pet-volley.png', cd: 9, name: { ru: 'Залп', en: 'Volley' }, desc: { ru: 'Очередь из 6 ракет по врагам', en: 'Fires 6 rockets at enemies' } },
        orb: { id: 'shield', icon: 'assets/ui/pet-shield.png', cd: 14, name: { ru: 'Щит', en: 'Shield' }, desc: { ru: 'Щит поглощает урон 5 с', en: 'Shield absorbs damage for 5 s' } },
        bat: { id: 'vampire', icon: 'assets/ui/pet-vampire.png', cd: 10, name: { ru: 'Вампиризм', en: 'Vampirism' }, desc: { ru: 'Кусает 3 врагов и лечит героя', en: 'Bites 3 enemies, heals you' } },
        ufo: { id: 'abduct', icon: 'assets/ui/pet-abduct.png', cd: 12, name: { ru: 'Похищение', en: 'Abduction' }, desc: { ru: 'Луч уносит 3 врагов', en: 'Beams up 3 enemies' } },
        cube: { id: 'freeze', icon: 'assets/ui/pet-freeze.png', cd: 11, name: { ru: 'Ледяной куб', en: 'Ice cube' }, desc: { ru: 'Замораживает врагов вокруг', en: 'Freezes nearby enemies' } },
        star: { id: 'starfall', icon: 'assets/ui/pet-starfall.png', cd: 9, name: { ru: 'Звездопад', en: 'Starfall' }, desc: { ru: '8 звёзд падают на врагов', en: '8 stars fall on enemies' } },
        dragon: { id: 'breath', icon: 'assets/ui/pet-breath.png', cd: 7, name: { ru: 'Драконье пламя', en: 'Dragon fire' }, desc: { ru: 'Огненное дыхание и горящая земля', en: 'Fire breath and burning ground' } },
    },

    // Здания: габарит корпуса и высота крыши (px при scale 1) — js/CityData.js (его пишет
    // tools/gen-city.mjs). Крыши-арены — по ним ходят; фон (bg) — только препятствие для спавна.
    BUILDINGS: Object.assign({}, CITY_DATA.buildings,
        Object.fromEntries(Object.entries(CITY_DATA.bg).map(([k, v]) => [k, Object.assign({ bg: 1 }, v)]))),

    // Звуки: массив — случайный вариант на выстрел (живее очередь); soundRate — высота звука.
    // Огнестрел — живая запись (Gunshot Sounds, OpenGameArt), лазеры и ракеты — Kenney Sci-fi Sounds.
    SFX: {
        pistol: ['assets/sounds/gun-pistol-1.ogg', 'assets/sounds/gun-pistol-2.ogg', 'assets/sounds/gun-pistol-3.ogg'],
        rifle: ['assets/sounds/gun-rifle-1.ogg', 'assets/sounds/gun-rifle-2.ogg', 'assets/sounds/gun-rifle-3.ogg'],
        auto: ['assets/sounds/gun-auto-1.ogg', 'assets/sounds/gun-auto-2.ogg', 'assets/sounds/gun-auto-3.ogg'],
        shotgun: ['assets/sounds/gun-shotgun-1.ogg'],
        laser: ['assets/sounds/laser-1.ogg', 'assets/sounds/laser-2.ogg', 'assets/sounds/laser-3.ogg'],
        rail: ['assets/sounds/railgun.ogg'],
        rocket: ['assets/sounds/rocket-launch.ogg'],
        explosion: ['assets/sounds/explosion-1.ogg', 'assets/sounds/explosion-2.ogg', 'assets/sounds/explosion-3.ogg'],
        explosionBig: ['assets/sounds/explosion-big.ogg'],
        zombieDie: ['assets/sounds/zombie-die-1.ogg', 'assets/sounds/zombie-die-2.ogg', 'assets/sounds/zombie-die-3.ogg', 'assets/sounds/zombie-die-4.ogg',
            'assets/sounds/zombie-die-5.ogg', 'assets/sounds/zombie-die-6.ogg', 'assets/sounds/zombie-die-7.ogg', 'assets/sounds/zombie-die-8.ogg'],
        swingLight: ['assets/sounds/swing-light-1.ogg', 'assets/sounds/swing-light-2.ogg', 'assets/sounds/swing-light-3.ogg'],
        swingHeavy: ['assets/sounds/swing-heavy-1.ogg', 'assets/sounds/swing-heavy-2.ogg', 'assets/sounds/swing-heavy-3.ogg'],
        hitPunch: ['assets/sounds/hit-punch-1.ogg', 'assets/sounds/hit-punch-2.ogg', 'assets/sounds/hit-punch-3.ogg'],
        hitMetal: ['assets/sounds/hit-metal-1.ogg', 'assets/sounds/hit-metal-2.ogg'],
        hitWood: ['assets/sounds/hit-wood-1.ogg', 'assets/sounds/hit-wood-2.ogg'],
        hitSlice: ['assets/sounds/hit-slice-1.ogg', 'assets/sounds/hit-slice-2.ogg'],
        hitThunder: ['assets/sounds/hit-thunder.ogg'],
        crate: ['assets/sounds/hit-crate-1.ogg', 'assets/sounds/hit-crate-2.ogg'],
    },

    // Классы оружия: базовые числа ранга 1. kind — полёт снаряда: '' (пуля), rocket,
    // lob (навесом), homing, mine, sticky; эффект разрыва: cluster, fire, freeze, nuke.
    CLASSES: {
        pistol: { dmg: 16, rate: 2.6, range: 640, speed: 2100, spread: 0.03, pellets: 1, pierce: 0, splash: 0, sound: 'pistol', tracer: 1 },
        smg: { dmg: 7, rate: 9, range: 580, speed: 2200, spread: 0.1, pellets: 1, pierce: 0, splash: 0, sound: 'auto', soundRate: 1.08, tracer: 0.8 },
        shotgun: { dmg: 9, rate: 1.25, range: 460, speed: 1900, spread: 0.34, pellets: 6, pierce: 0, splash: 0, sound: 'shotgun', tracer: 0.8, knock: 60 },
        rifle: { dmg: 38, rate: 1.5, range: 980, speed: 3000, spread: 0.01, pellets: 1, pierce: 3, splash: 0, sound: 'rifle', tracer: 1.4 },
        heavy: { dmg: 6.5, rate: 12, range: 640, speed: 2400, spread: 0.11, pellets: 1, pierce: 0, splash: 0, sound: 'auto', soundRate: 1.28, tracer: 0.9 },
        energy: { dmg: 12, rate: 5, range: 720, speed: 3400, spread: 0.02, pellets: 1, pierce: 5, splash: 0, sound: 'laser', tracer: 1.3, beam: 1 },
        explosive: { dmg: 52, rate: 0.8, range: 780, speed: 1150, spread: 0.02, pellets: 1, pierce: 0, splash: 180, sound: 'rocket', tracer: 1.8, kind: 'rocket', proj: 'rocket' },
    },

    SECTIONS: [],   // заполняет build()
    ITEMS: {},      // id -> предмет
    UPGRADES: [],

    // 20 типов врагов: облики (2–3 модели), масштаб (модели ~240 см -> ~100 px при 0.43),
    // множители. Особенности: crawl — ползёт, burst — лопается и ранит соседей-монстров,
    // zigzag — петляет, fireproof — не горит, heal — лечит соседей, blastproof — держит
    // взрывы, charge — таранит рывком, fly — летит к крыше без стены. tint — множитель цвета.
    ENEMIES: {
        walker: { name: { ru: 'Зомби', en: 'Zombie' }, models: M_MON.walker, scale: 0.43, hp: 1, speed: 150, climb: 190, dmg: 9, coins: 1, tint: [0.72, 0.75, 0.72], from: 1 },
        runner: { name: { ru: 'Бегун', en: 'Runner' }, models: M_MON.runner, scale: 0.41, hp: 0.65, speed: 255, climb: 260, dmg: 7, coins: 1, tint: [0.9, 0.9, 0.9], from: 2 },
        crawler: { name: { ru: 'Ползун', en: 'Crawler' }, models: M_MON.crawler, scale: 0.43, hp: 0.7, speed: 215, climb: 240, dmg: 8, coins: 1, tint: [0.85, 0.85, 0.85], from: 4, crawl: 1 },
        cop: { name: { ru: 'Коп', en: 'Cop' }, models: M_MON.cop, scale: 0.44, hp: 1.6, speed: 170, climb: 200, dmg: 11, coins: 2, tint: [0.92, 0.92, 0.92], from: 6 },
        skeleton: { name: { ru: 'Скелет', en: 'Skeleton' }, models: M_MON.skeleton, scale: 0.44, hp: 0.8, speed: 220, climb: 250, dmg: 8, coins: 1, tint: [1, 1, 1], from: 8 },
        bloater: { name: { ru: 'Толстяк', en: 'Bloater' }, models: M_MON.bloater, scale: 0.55, hp: 2.5, speed: 105, climb: 120, dmg: 14, coins: 3, tint: [1, 1, 1], from: 10, burst: 1 },
        brute: { name: { ru: 'Громила', en: 'Brute' }, models: M_MON.brute, scale: 0.62, hp: 6, speed: 115, climb: 120, dmg: 22, coins: 6, tint: [0.95, 0.95, 0.95], from: 12, knockRes: 0.8 },
        clown: { name: { ru: 'Клоун', en: 'Clown' }, models: M_MON.clown, scale: 0.43, hp: 1.1, speed: 285, climb: 270, dmg: 9, coins: 2, tint: [1, 1, 1], from: 14, zigzag: 1 },
        fireman: { name: { ru: 'Пожарный', en: 'Fireman' }, models: M_MON.fireman, scale: 0.45, hp: 2.4, speed: 160, climb: 190, dmg: 12, coins: 3, tint: [1, 1, 1], from: 16, fireproof: 1 },
        vampire: { name: { ru: 'Вампир', en: 'Vampire' }, models: M_MON.vampire, scale: 0.45, hp: 2.2, speed: 235, climb: 280, dmg: 14, coins: 3, tint: [1, 1, 1], from: 18 },
        prisoner: { name: { ru: 'Зэк', en: 'Convict' }, models: M_MON.prisoner, scale: 0.44, hp: 1.8, speed: 200, climb: 230, dmg: 13, coins: 2, tint: [1, 1, 1], from: 20 },
        medic: { name: { ru: 'Медик', en: 'Medic' }, models: M_MON.medic, scale: 0.44, hp: 1.5, speed: 165, climb: 190, dmg: 8, coins: 3, tint: [1, 1, 1], from: 23, heal: 1 },
        ghost: { name: { ru: 'Призрак', en: 'Ghost' }, models: M_MON.ghost, scale: 0.46, hp: 1.3, speed: 175, climb: 210, dmg: 10, coins: 2, tint: [1, 1, 1.05], from: 26, fly: 1 },
        soldier: { name: { ru: 'Солдат', en: 'Soldier' }, models: M_MON.soldier, scale: 0.45, hp: 3.5, speed: 175, climb: 200, dmg: 15, coins: 4, tint: [1, 1, 1], from: 29 },
        hazmat: { name: { ru: 'Химик', en: 'Hazmat' }, models: M_MON.hazmat, scale: 0.45, hp: 3, speed: 150, climb: 180, dmg: 12, coins: 4, tint: [1, 1, 1], from: 32, blastproof: 1 },
        rugby: { name: { ru: 'Регбист', en: 'Linebacker' }, models: M_MON.rugby, scale: 0.47, hp: 4, speed: 190, climb: 200, dmg: 18, coins: 5, tint: [1, 1, 1], from: 35, knockRes: 0.85, charge: 1 },
        mummy: { name: { ru: 'Мумия', en: 'Mummy' }, models: M_MON.mummy, scale: 0.47, hp: 3.4, speed: 165, climb: 170, dmg: 16, coins: 4, tint: [1, 1, 1], from: 38 },
        miner: { name: { ru: 'Шахтёр', en: 'Miner' }, models: M_MON.miner, scale: 0.45, hp: 3, speed: 170, climb: 260, dmg: 14, coins: 4, tint: [1, 1, 1], from: 41 },
        werewolf: { name: { ru: 'Оборотень', en: 'Werewolf' }, models: M_MON.werewolf, scale: 0.5, hp: 4.5, speed: 290, climb: 320, dmg: 24, coins: 6, tint: [1, 1, 1], from: 45 },
        demon: { name: { ru: 'Бес', en: 'Demon' }, models: M_MON.demon, scale: 0.48, hp: 5.5, speed: 210, climb: 240, dmg: 26, coins: 7, tint: [1, 1, 1], from: 50, fly: 1 },
        boss: { name: { ru: 'Босс', en: 'Boss' }, models: M_MON.brute, scale: 1.25, hp: 70, speed: 125, climb: 110, dmg: 45, coins: 60, tint: [1, 0.62, 0.62], from: 999, boss: 1, knockRes: 0.95 },
        megaboss: { name: { ru: 'Мегабосс', en: 'Mega Boss' }, models: M_MON.demon, scale: 1.3, hp: 150, speed: 150, climb: 140, dmg: 60, coins: 150, tint: [1, 0.85, 1], from: 999, boss: 1, knockRes: 0.97, fly: 1 },
    },

    // Темы по десяткам уровней: небо/туман, солнце, свет неба, тень.
    THEMES: [
        { sky: 0xc9d2da, fog: 0.00021, sun: 0xfff1d8, sunI: 0.78, hemi: 0xd8e6f4, hemiI: 0.55, ground: 0x8f959c, shadow: 0x24364e, el: 58 },  // пасмурное утро
        { sky: 0xe7c7a4, fog: 0.00022, sun: 0xffc27a, sunI: 0.9, hemi: 0xf2d6be, hemiI: 0.45, ground: 0x9a7e6e, shadow: 0x4a2a3e, el: 34 },  // закат
        { sky: 0xa9c9a2, fog: 0.00026, sun: 0xe9ffd0, sunI: 0.7, hemi: 0xcbe8bf, hemiI: 0.55, ground: 0x6f8a62, shadow: 0x1f3a2a, el: 50 },  // ядовитый туман
        { sky: 0x6f7fa6, fog: 0.00024, sun: 0xb9c8ff, sunI: 0.7, hemi: 0x9fb2e6, hemiI: 0.55, ground: 0x4c5572, shadow: 0x151c3a, el: 62 },  // лунная ночь
        { sky: 0xd9d4e8, fog: 0.00019, sun: 0xfff9f0, sunI: 0.85, hemi: 0xe8e4f6, hemiI: 0.5, ground: 0x9a93a8, shadow: 0x302a4e, el: 66 },  // ясный полдень
        { sky: 0xb49ab8, fog: 0.00025, sun: 0xffb9d8, sunI: 0.8, hemi: 0xe6c9e8, hemiI: 0.5, ground: 0x7e6480, shadow: 0x3a1f40, el: 40 },  // сиреневые сумерки
        { sky: 0xbcc8c9, fog: 0.00028, sun: 0xf0f6f2, sunI: 0.72, hemi: 0xd6e2e0, hemiI: 0.6, ground: 0x7d8a88, shadow: 0x223838, el: 52 },  // дождливый день
        { sky: 0xd8b98c, fog: 0.00024, sun: 0xffd996, sunI: 0.88, hemi: 0xf0dcb8, hemiI: 0.48, ground: 0x98815e, shadow: 0x4a3420, el: 45 },  // пыльная буря
        { sky: 0x8aa0b4, fog: 0.00023, sun: 0xdbe8ff, sunI: 0.78, hemi: 0xb8cae0, hemiI: 0.55, ground: 0x5d6f80, shadow: 0x1a2a40, el: 70 },  // холодный рассвет
        { sky: 0xb88a86, fog: 0.00026, sun: 0xff9d7a, sunI: 0.95, hemi: 0xe8b8a8, hemiI: 0.45, ground: 0x8a5a50, shadow: 0x401818, el: 30 },  // кровавая луна
    ],

    MAX_LEVEL: 100,

    // Ежедневный подарок: 7 дней по кругу. Предмет, который уже есть, заменяется монетами.
    // 7-й день — эксклюзивный скин Алика (его нет в магазине скинов).
    DAILY: [
        { coins: 250 }, { item: 'hat-propeller', coins: 400 }, { coins: 500 }, { item: 'pet-bat', coins: 700 },
        { coins: 900 }, { item: 'skin-2', coins: 1000 }, { item: 'hero-alik', coins: 3000, exclusive: 1 },
    ],

    // Параметры уровня n (1..100).
    level(n) {
        n = Math.max(1, Math.min(this.MAX_LEVEL, n | 0));
        const U = 'undefined';
        const killBase = typeof SM_KILL_BASE !== U ? SM_KILL_BASE : 30;
        const killPer = typeof SM_KILL_PER_LEVEL !== U ? SM_KILL_PER_LEVEL : 5;
        const growth = typeof SM_HP_GROWTH !== U ? SM_HP_GROWTH : 1.034;
        const open = Object.entries(this.ENEMIES).filter(([id, e]) => !e.boss && id !== 'walker' && n >= e.from).sort((a, b) => b[1].from - a[1].from).map(([id]) => id);
        let seed = n * 7919 + 17;
        const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
        const roster = ['walker'].concat(open.slice(0, 3));
        const older = open.slice(3);
        while (roster.length < 6 && older.length) roster.push(older.splice(Math.floor(rnd() * older.length), 1)[0]);
        const weights = {};
        roster.forEach((id, i) => { weights[id] = id === 'walker' ? Math.max(2, 6 - n * 0.06) : i === 1 ? 2.6 : i <= 3 ? 2 : 1.4; });
        void open;
        const boss = n % 10 === 0 ? 'megaboss' : n % 5 === 0 ? 'boss' : null;
        const models = [...new Set(roster.concat(boss ? [boss] : []).flatMap(id => this.ENEMIES[id].models))];
        return {
            n,
            map: GAME_MAPS.length ? GAME_MAPS[(n - 1) % GAME_MAPS.length].id : '',
            theme: Math.floor((n - 1) / 10) % this.THEMES.length,
            kills: Math.round(killBase + n * killPer),
            hpMul: (typeof SM_HP_BASE !== U ? SM_HP_BASE : 1.15) * Math.pow(growth, n - 1),
            dmgMul: 1 + (n - 1) * 0.022,
            spawnRate: 1.6 + n * 0.075,
            alive: 34 + n * 1.3,
            weights, boss, roster, models,
            reward: 40 + n * 9,
            coinMul: 1 + Math.floor((n - 1) / 10) * 0.5,
            boxRarity: Math.min(0.5, 0.05 + n * 0.004),
        };
    },

    // Звёзды за уровень: по доле здоровья в конце.
    stars(hpFrac) { return hpFrac >= 0.7 ? 3 : hpFrac >= 0.35 ? 2 : 1; },

    // Урон оружия: класс × ранг × редкость × прокачка.
    weaponStats(itemId, tier) {
        const it = this.ITEMS[itemId];
        if (!it || it.section === 'melee') return null;
        const c = this.CLASSES[it.cls];
        const rank = 1 + (it.rank - 1) * 0.24;
        const tr = Math.max(0, Math.min(this.MYTHIC, tier | 0)), rm = this.RARITY[tr].mult;
        const b = Object.assign({}, c, it.extra || {});
        const ab = tr >= this.LEGENDARY ? this.ABILITIES[it.cls] : null;
        return Object.assign(b, {
            ab: ab ? ab.id : '', abLv: ab ? tr - this.LEGENDARY + 1 : 0,
            pierce: (b.pierce || 0) + (ab && ab.id === 'spin' && tr >= this.MYTHIC ? 2 : 0),
            dmg: b.dmg * rank * rm * (it.dmgMul || 1),
            rate: b.rate * (1 + (it.rank - 1) * 0.035) * (it.rateMul || 1),
            range: b.range * (1 + (it.rank - 1) * 0.02),
        });
    },

    // --- каталог магазина --------------------------------------------------------
    build() {
        const S = [];
        const sec = (id, group, name, items) => { S.push({ id, group, name, items }); return items; };
        const T = (ru, en) => ({ ru, en });
        const tints = [null, [1.25, 1.05, 0.45], [0.7, 0.95, 1.25], [1.2, 0.55, 0.55], [0.75, 1.2, 0.6], [0.6, 0.58, 0.7], [1.15, 0.75, 1.25], [1.1, 1.1, 1.1]];

        const gunList = (cls, models, names) => models.map((m, i) => ({
            id: cls + '-' + (i + 1), cls, rank: i + 1, model: M_GUN[m], tint: i >= 4 ? tints[(i - 3) % tints.length] : null, name: names[i],
        }));
        sec('pistol', 'weapons', T('Пистолеты', 'Pistols'), gunList('pistol', ['p1', 'p2', 'p3', 'p4', 'p1', 'p2', 'p3', 'p4'], [
            T('Малыш', 'Tiny'), T('Кубик', 'Cube'), T('Шмель', 'Bumblebee'), T('Лимонка', 'Lemon'),
            T('Золотой кольт', 'Gold Colt'), T('Ледышка', 'Icicle'), T('Рубин', 'Ruby'), T('Ядовитый', 'Venom')]));
        sec('smg', 'weapons', T('Автоматы', 'SMGs'), gunList('smg', ['s1', 's2', 's3', 's1', 's2', 's3', 's1', 's2'], [
            T('Трещотка', 'Rattler'), T('Шершень', 'Hornet'), T('Молотилка', 'Thresher'), T('Оса', 'Wasp'),
            T('Гадюка', 'Viper'), T('Буря', 'Storm'), T('Пчелиный рой', 'Swarm'), T('Ураган', 'Hurricane')]).map(w => Object.assign(w, { rateMul: 1 + w.rank * 0.05 })));
        sec('shotgun', 'weapons', T('Дробовики', 'Shotguns'), gunList('shotgun', ['sh1', 'sh2', 'sh3', 'sh1', 'sh2', 'sh3', 'sh1', 'sh2'], [
            T('Двустволка', 'Double'), T('Бульдог', 'Bulldog'), T('Гром', 'Thunder'), T('Бизон', 'Bison'),
            T('Дракон', 'Dragon'), T('Мамонт', 'Mammoth'), T('Метель', 'Blizzard'), T('Вулкан', 'Volcano')]).map(w => Object.assign(w, { extra: { pellets: 6 + Math.floor(w.rank / 2) } })));
        sec('rifle', 'weapons', T('Винтовки', 'Rifles'), gunList('rifle', ['r1', 'r2', 'r3', 'r4', 'r1', 'r2', 'r3', 'r4'], [
            T('Разведчик', 'Scout'), T('Игла', 'Needle'), T('Сокол', 'Falcon'), T('Рейнджер', 'Ranger'),
            T('Снайпер', 'Sniper'), T('Призрак', 'Phantom'), T('Орлиный глаз', 'Eagle Eye'), T('Жнец', 'Reaper')]).map(w => Object.assign(w, { extra: { pierce: 2 + Math.floor(w.rank / 2) } })));
        // Тяжёлое: пулемёты, пушка (пробивает и отбрасывает), рельсотрон (прошивает всех).
        const heavyKind = { h1: {}, h2: { rate: 15, dmg: 5.6, spread: 0.13 },
            h3: { rate: 0.9, dmg: 70, pierce: 4, knock: 320, speed: 2000, spread: 0.01, tracer: 2.6, range: 760, sound: 'rifle', soundRate: 0.62 },
            h4: { rate: 0.7, dmg: 95, pierce: 99, speed: 5200, spread: 0, tracer: 2, range: 1250, sound: 'rail', beam: 1 } };
        const heavyModels = ['h1', 'h2', 'h3', 'h4', 'h1', 'h2', 'h3', 'h4'];
        sec('heavy', 'weapons', T('Тяжёлое', 'Heavy'), gunList('heavy', heavyModels, [
            T('Миниган', 'Minigun'), T('Гатлинг', 'Gatling'), T('Пушка', 'Cannon'), T('Рельсотрон', 'Railgun'),
            T('Шредер', 'Shredder'), T('Ураган-М', 'Hurricane-M'), T('Мамонт', 'Mammoth'), T('Гиперрельс', 'Hyper Rail')]).map((w, i) => Object.assign(w, { extra: heavyKind[heavyModels[i]] })));
        sec('energy', 'weapons', T('Энергетическое', 'Energy'), gunList('energy', ['e1', 'e2', 'e3', 'e4', 'e1', 'e2', 'e3', 'e4'], [
            T('Лазер', 'Laser'), T('Плазма', 'Plasma'), T('Искра', 'Spark'), T('Тесла', 'Tesla'),
            T('Фотон', 'Photon'), T('Квазар', 'Quasar'), T('Нейтрон', 'Neutron'), T('Сверхновая', 'Supernova')]));
        // Взрывное: у каждого своя механика снаряда и разрыва.
        const X = (m, name, extra) => ({ model: M_GUN[m], name, extra });
        sec('explosive', 'weapons', T('Взрывное', 'Explosives'), [
            X('xGrenade', T('Гранатомёт', 'Grenade Launcher'), { kind: 'lob', proj: 'grenade', rate: 1.1, speed: 800, splash: 160, dmg: 44, sound: 'shotgun', soundRate: 0.66 }),
            X('xRocket', T('Базука', 'Bazooka'), { kind: 'rocket', proj: 'rocket', splash: 190 }),
            X('xHoming', T('Самонаводка', 'Homing Missiles'), { kind: 'homing', proj: 'rocket', rate: 1.2, speed: 950, splash: 150, dmg: 44 }),
            X('xCluster', T('Кассетник', 'Cluster Bomb'), { kind: 'rocket', proj: 'rocket', burst: 'cluster', splash: 150, rate: 0.7 }),
            X('xMortar', T('Миномёт', 'Mortar'), { kind: 'lob', proj: 'bomblet', arc: 1.35, rate: 0.5, splash: 270, dmg: 88, range: 900, sound: 'shotgun', soundRate: 0.52 }),
            X('xNapalm', T('Напалм', 'Napalm'), { kind: 'lob', proj: 'grenade', burst: 'fire', rate: 0.75, splash: 150, dmg: 30, sound: 'shotgun', soundRate: 0.7 }),
            X('xMines', T('Минёр', 'Mine Layer'), { kind: 'mine', proj: 'mine', rate: 1.1, splash: 170, dmg: 70, sound: ['assets/sounds/mine-drop.ogg'] }),
            X('xFreeze', T('Ледяная граната', 'Frost Grenade'), { kind: 'lob', proj: 'grenade', burst: 'freeze', rate: 0.9, splash: 210, dmg: 26, sound: 'shotgun', soundRate: 0.74 }),
            X('xSticky', T('Липучка', 'Sticky Bomb'), { kind: 'sticky', proj: 'sticky', rate: 1.3, speed: 1500, splash: 140, dmg: 80, sound: ['assets/sounds/sticky.ogg'] }),
            X('xNuke', T('Мини-ядерка', 'Mini Nuke'), { kind: 'rocket', proj: 'rocket', burst: 'nuke', rate: 0.22, speed: 800, splash: 520, dmg: 260, range: 950 }),
        ].map((w, i) => Object.assign(w, { id: 'explosive-' + (i + 1), cls: 'explosive', rank: i + 1, tint: null })));

        sec('melee', 'weapons', T('Ближний бой', 'Melee'), [
            { id: 'melee-1', kind: 'hammer', model: 'assets/models/melee/m-sledge.glb', dmg: 26, radius: 150, cd: 1.1, color: '#c9352b', name: T('Кувалда', 'Sledge') },
            { id: 'melee-2', kind: 'bat', model: 'assets/models/melee/m-bat.glb', dmg: 30, radius: 145, cd: 1.0, color: '#b7834a', name: T('Бита', 'Bat') },
            { id: 'melee-3', kind: 'hammer', model: 'assets/models/melee/m-claw.glb', dmg: 38, radius: 160, cd: 1.1, color: '#6d7c8f', name: T('Стальной молот', 'Steel Hammer') },
            { id: 'melee-4', kind: 'axe', model: 'assets/models/melee/m-axe.glb', dmg: 46, radius: 160, cd: 1.05, color: '#9aa7b3', name: T('Топор', 'Axe') },
            { id: 'melee-5', kind: 'pan', model: 'assets/models/melee/m-pan.glb', dmg: 52, radius: 150, cd: 0.9, color: '#2d2f33', name: T('Сковорода', 'Frying Pan') },
            { id: 'melee-6', kind: 'sword', model: 'assets/models/melee/m-sword.glb', dmg: 62, radius: 175, cd: 0.95, color: '#d8e2ea', name: T('Меч', 'Sword') },
            { id: 'melee-7', kind: 'guitar', model: 'assets/models/melee/m-guitar.glb', dmg: 70, radius: 170, cd: 1.0, color: '#e2452f', name: T('Рок-гитара', 'Rock Guitar') },
            { id: 'melee-8', kind: 'katana', model: 'assets/models/melee/m-katana.glb', dmg: 84, radius: 185, cd: 0.8, color: '#f2f4f8', name: T('Катана', 'Katana') },
            { id: 'melee-9', kind: 'chainsaw', model: 'assets/models/melee/m-chainsaw.glb', dmg: 96, radius: 170, cd: 0.7, color: '#f08a1c', name: T('Бензопила', 'Chainsaw') },
            { id: 'melee-10', kind: 'thunder', model: 'assets/models/melee/m-thunder.glb', dmg: 130, radius: 210, cd: 1.0, color: '#6fd0ff', name: T('Молот грома', 'Thunder Hammer') },
        ]);
        const heroNames = [T('Джек', 'Jack'), T('Макс', 'Max'), T('Тим', 'Tim'), T('Тигр', 'Tiger'), T('Лиза', 'Lisa'), T('Боб', 'Bob'),
            T('Робот', 'Robot'), T('Кибер', 'Cyber'), T('Доктор', 'Doctor'), T('Шериф', 'Sheriff'), T('Лесоруб', 'Lumberjack'), T('Мутант', 'Mutant'),
            T('Охотник', 'Hunter'), T('Сёрфер', 'Surfer'), T('Орк', 'Orc'), T('Пират', 'Pirate'), T('Агент', 'Agent'), T('Ниндзя', 'Ninja')];
        const heroes = 'abcdefghijklmnopqr'.split('').map((c, i) => ({ id: 'hero-' + c, model: M_HERO[c], name: heroNames[i], rarity: i < 6 ? 0 : i < 12 ? 2 : 3 }));
        const brainrot = [
            ['tralalero', T('Тралалеро Тралала', 'Tralalero Tralala')], ['tungtung', T('Тунг Тунг Сахур', 'Tung Tung Sahur')],
            ['bombardiro', T('Бомбардиро Крокодило', 'Bombardiro Crocodilo')], ['ballerina', T('Балерина Капучина', 'Ballerina Cappuccina')],
            ['patapim', T('Брр Брр Патапим', 'Brr Brr Patapim')], ['chimpanzini', T('Шимпанзини Бананини', 'Chimpanzini Bananini')],
            ['lirili', T('Лирили Ларила', 'Lirili Larila')], ['assassino', T('Капучино Ассасино', 'Cappuccino Assassino')],
        ].map(([k, name]) => ({ id: 'hero-' + k, model: M_HERO[k], name, rarity: 4, brainrot: 1 }));
        const alik = { id: 'hero-alik', model: M_HERO.alik, name: T('Алик', 'Alik'), rarity: 5, exclusive: 1 };
        sec('heroes', 'skins', T('Скины', 'Skins'), /** @type {any[]} */ (heroes).concat(brainrot, [alik]));

        sec('hats', 'style', T('Шапки', 'Hats'), [
            ['none', T('Без шапки', 'No hat')], ['cap', T('Кепка', 'Cap')], ['beanie', T('Шапочка', 'Beanie')], ['cowboy', T('Ковбой', 'Cowboy')],
            ['tophat', T('Цилиндр', 'Top Hat')], ['helmet', T('Каска', 'Helmet')], ['party', T('Колпак', 'Party Hat')], ['chef', T('Повар', 'Chef')],
            ['viking', T('Викинг', 'Viking')], ['pirate', T('Треуголка', 'Tricorn')], ['headphones', T('Наушники', 'Headphones')],
            ['propeller', T('Пропеллер', 'Propeller')], ['crown', T('Корона', 'Crown')], ['halo', T('Нимб', 'Halo')],
        ].map(([kind, name]) => ({ id: 'hat-' + kind, kind, name })));

        sec('packs', 'style', T('Рюкзаки', 'Backpacks'), [
            ['#6b7d3a', '#3e4a22', T('Походный', 'Trail')], ['#c0392b', '#7a1f16', T('Красный', 'Red')], ['#2f6fd6', '#1b3f80', T('Синий', 'Blue')],
            ['#4b5320', '#2a2f10', T('Армейский', 'Army')], ['#f1c40f', '#9a7b05', T('Школьный', 'School')], ['#ff66b3', '#a3336c', T('Розовый', 'Pink')],
            ['#222831', '#e84118', T('Тактический', 'Tactical')], ['#ecf0f1', '#95a5a6', T('Космо', 'Cosmo')], ['#ffd700', '#b8860b', T('Золотой', 'Gold')],
            ['#8e44ad', '#2ef2ff', T('Неон', 'Neon')],
        ].map(([a, b, name], i) => ({ id: 'pack-' + (i + 1), color: a, color2: b, style: i, name })));

        sec('arms', 'style', T('Мех-руки', 'Mech Arms'), [
            ['#8c96a3', '#4a525c', T('Сталь', 'Steel')], ['#c7773a', '#6e3a18', T('Медь', 'Copper')], ['#f2c21a', '#8a6a06', T('Золото', 'Gold')],
            ['#2b2b2b', '#e03030', T('Карбон', 'Carbon')], ['#f0f0f0', '#ff4fa3', T('Карамель', 'Candy')], ['#39ff14', '#0b5e02', T('Токсик', 'Toxic')],
            ['#7fd8ff', '#1f6fa8', T('Лёд', 'Ice')], ['#ff5a1f', '#6e1400', T('Лава', 'Lava')],
        ].map(([a, b, name], i) => ({ id: 'arm-' + (i + 1), color: a, color2: b, glow: i >= 5, name })));

        sec('skins', 'style', T('Скины оружия', 'Gun Skins'), [
            [null, 0, T('Заводской', 'Factory')], [[1.3, 1.08, 0.4], 0.12, T('Золото', 'Gold')], [[1.15, 1.15, 1.2], 0.05, T('Хром', 'Chrome')],
            [[1.3, 0.5, 0.9], 0.2, T('Неон', 'Neon')], [[0.6, 1.3, 0.45], 0.2, T('Токсик', 'Toxic')], [[0.7, 1.05, 1.35], 0.15, T('Лёд', 'Ice')],
            [[1.35, 0.55, 0.3], 0.25, T('Лава', 'Lava')], [[0.62, 0.75, 0.45], 0, T('Камуфляж', 'Camo')], [[0.55, 0.4, 0.95], 0.2, T('Галактика', 'Galaxy')],
            [[1.25, 0.8, 1.1], 0.05, T('Конфета', 'Candy')], [[0.35, 0.35, 0.42], 0, T('Тень', 'Shadow')], [[1.2, 0.3, 0.35], 0.12, T('Рубин', 'Ruby')],
            [[0.3, 1.1, 0.6], 0.12, T('Изумруд', 'Emerald')], [[0.35, 0.55, 1.3], 0.12, T('Сапфир', 'Sapphire')], ['rainbow', 0.25, T('Радуга', 'Rainbow')],
            [[1.5, 1.5, 1.6], 0.35, T('Алмаз', 'Diamond')],
        ].map(([tint, glow, name], i) => ({ id: 'skin-' + (i + 1), tint, glow, name })));

        sec('tracers', 'style', T('Трассеры', 'Tracers'), [
            ['#ffe066', 1, T('Классика', 'Classic')], ['#ff4040', 1, T('Красный', 'Red')], ['#40b0ff', 1.1, T('Плазма', 'Plasma')],
            ['#5dff5d', 1, T('Кислота', 'Acid')], ['#ff66d9', 1.1, T('Розовый', 'Pink')], ['#b366ff', 1.1, T('Фиолет', 'Violet')],
            ['#ffffff', 1.2, T('Белый', 'White')], ['#ff8a1f', 1.3, T('Огонь', 'Fire')], ['#ffd700', 1.2, T('Золото', 'Gold')],
            ['#9ff3ff', 1.3, T('Лёд', 'Ice')], ['rainbow', 1.3, T('Радуга', 'Rainbow')], ['#ff2020', 1.8, T('Лазер-МАКС', 'Mega Laser')],
        ].map(([color, size, name], i) => ({ id: 'tracer-' + (i + 1), color, size, name })));

        sec('kills', 'style', T('Эффекты', 'Kill FX'), [
            [['#1d4fd8', '#3d8cff'], T('Синяя кровь', 'Blue Blood')], [['#b3121c', '#e0262e'], T('Красная кровь', 'Red Blood')], [['#58d12a', '#a4ff5a'], T('Слизь', 'Slime')], [['#7fd8ff', '#e8fbff'], T('Лёд', 'Ice')],
            [['#ff4d6d', '#ffd23f', '#3ec1ff', '#7cff5a'], T('Конфетти', 'Confetti')], [['#ffd700', '#fff3a0'], T('Монетки', 'Coins')],
            [['#ff5ab4', '#ffb3de'], T('Сердечки', 'Hearts')], [['#fff27a', '#ffffff'], T('Звёзды', 'Stars')], [['#c8b8ff', '#6b5bd6'], T('Призраки', 'Spirits')],
            [['#ff7b00', '#ffd000', '#ff2d00'], T('Фейерверк', 'Fireworks')], [['#23f0ff', '#1b6bff', '#ffffff'], T('Пиксели', 'Pixels')],
        ].map(([colors, name], i) => ({ id: 'kill-' + (i + 1), colors, name })));

        sec('trails', 'style', T('Следы', 'Trails'), [
            [null, T('Нет', 'None')], [['#b8b0a2', '#8a8378'], T('Пыль', 'Dust')], [['#ff7b00', '#ffd000'], T('Огонь', 'Fire')],
            [['#ff5ab4', '#ffb3de'], T('Сердца', 'Hearts')], [['#fff27a', '#ffffff'], T('Звёзды', 'Stars')], [['#ff4040', '#ffe040', '#40ff70', '#40a0ff'], T('Радуга', 'Rainbow')],
            [['#9fe8ff', '#ffffff'], T('Снег', 'Snow')], [['#6fe36f', '#c8ff80'], T('Листья', 'Leaves')], [['#62b6ff', '#d6f0ff'], T('Пузыри', 'Bubbles')],
            [['#b06bff', '#3cf2ff'], T('Молнии', 'Lightning')],
        ].map(([colors, name], i) => ({ id: 'trail-' + (i + 1), colors, name })));

        sec('pets', 'style', T('Питомцы', 'Pets'), [
            ['none', T('Нет', 'None'), 0], ['drone', T('Дрон', 'Drone'), 6], ['orb', T('Сфера', 'Orb'), 8], ['bat', T('Летучая мышь', 'Bat'), 10],
            ['ufo', T('НЛО', 'UFO'), 13], ['cube', T('Куб', 'Cube Buddy'), 16], ['star', T('Звёздочка', 'Starlet'), 20], ['dragon', T('Дракоша', 'Dragonling'), 26],
        ].map(([kind, name, dps], i) => ({ id: 'pet-' + kind, kind, name, dps, rarity: [0, 0, 1, 2, 3, 3, 4, 5][i], ability: kind === 'none' ? null : this.PET_ABILITIES[/** @type {string} */ (kind)] })));

        // Цена: предмет 0 раздела — бесплатный (выдан), остальные — 45% за монеты,
        // остальные за 1..5 просмотров рекламы. Чередование детерминировано.
        const U = 'undefined';
        const coinShare = typeof SM_SHOP_COIN_SHARE !== U ? SM_SHOP_COIN_SHARE : 0.45;
        // CrazyGames: один ролик — одна награда, покупка не зависит от рекламы: всё за монеты.
        const coinsOnly = typeof GAME_PLATFORM !== U && String(GAME_PLATFORM) === 'crazygames';
        const base = { pistol: 250, smg: 400, shotgun: 450, rifle: 500, heavy: 700, energy: 800, explosive: 750, melee: 300, heroes: 300, hats: 150, packs: 200, arms: 250, skins: 200, tracers: 150, kills: 200, trails: 150, pets: 600 };
        let k = 0;
        this.SECTIONS = S;
        this.ITEMS = {};
        for (const s of S) {
            s.items.forEach((it, i) => {
                it.section = s.id;
                it.index = i;
                if (!it.rank) it.rank = i + 1;
                const f = i / Math.max(1, s.items.length - 1);
                if (it.exclusive) { it.price = { type: 'gift' }; this.ITEMS[it.id] = it; return; }
                if (i === 0 && !['smg', 'shotgun', 'rifle', 'heavy', 'energy', 'explosive'].includes(s.id)) it.price = { type: 'free' };
                else {
                    const coins = Math.floor((k + 1) * coinShare) > Math.floor(k * coinShare);
                    k++;
                    it.price = coins || coinsOnly
                        ? { type: 'coins', value: GameData.nice(base[s.id] * (1 + Math.pow(i, 1.55) * 0.9)) }
                        : { type: 'ads', value: Math.max(1, Math.min(5, 1 + Math.round(f * 4))) };
                }
                if (it.brainrot && it.price.type === 'coins') it.price.value = GameData.nice(15000 + i * 600);
                this.ITEMS[it.id] = it;
            });
        }
        this.UPGRADES = [
            { id: 'hp', icon: 'heart', max: 10, per: 0.14, name: T('Здоровье', 'Health') },
            { id: 'dmg', icon: 'fist', max: 10, per: 0.12, name: T('Урон', 'Damage') },
            { id: 'rate', icon: 'fast', max: 10, per: 0.06, name: T('Скорострельность', 'Fire rate') },
            { id: 'speed', icon: 'run', max: 8, per: 0.05, name: T('Скорость бега', 'Move speed') },
            { id: 'magnet', icon: 'magnet', max: 8, per: 0.2, name: T('Магнит', 'Magnet') },
            { id: 'coins', icon: 'coin', max: 10, per: 0.1, name: T('Больше монет', 'More coins') },
            { id: 'start', icon: 'pack', max: 3, per: 1, name: T('Оружие на старте', 'Starting guns') },
            { id: 'melee', icon: 'hammer', max: 10, per: 0.15, name: T('Сила удара', 'Melee power') },
            { id: 'luck', icon: 'clover', max: 10, per: 0.1, name: T('Везучесть', 'Luck'), note: T('Редкое оружие из оружейных ящиков', 'Rarer guns from weapon crates') },
        ];
    },

    upgradeCost(id, lvl) {
        const mul = id === 'start' ? 6 : 1;
        return this.nice(140 * mul * Math.pow(1.55, lvl));
    },

    // Круглая цена: 1234 -> 1250, 87 -> 90.
    nice(v) {
        const step = v >= 5000 ? 250 : v >= 1000 ? 50 : v >= 200 ? 10 : 5;
        return Math.max(step, Math.round(v / step) * step);
    },

    section(id) { return this.SECTIONS.find(s => s.id === id) || null; },

    // Случайное оружие для ящика: из открытых игроком стволов.
    randomWeapon(owned, rng) {
        const pool = Object.values(this.ITEMS).filter(it => it.cls && owned.includes(it.id));
        const list = pool.length ? pool : [this.ITEMS['pistol-1']];
        return list[Math.floor((rng || Math.random)() * list.length)].id;
    },
};
GameData.build();
