// @ts-nocheck
// PikabuPacks.js — наборы за рубли в сборке Пикабу Игр (js/PikabuShop.js). Цены и названия товаров — в Студии
// (каталог CSV: coins_s 19 ₽, coins_m 49 ₽, coins_l 99 ₽, starter 29 ₽, no_ads 59 ₽), здесь — что игрок получает.
// Монеты — GameState.addCoins (сохраняет и шлёт событие для счётчика), оружие набора — GameState.s.owned.
PikabuShop.setup({
    colors: ['#ff6d00', '#7c4dff'],
    ready: () => !!(typeof GameState !== 'undefined' && GameState.s && Array.isArray(GameState.s.owned) && typeof GameUI !== 'undefined' && GameUI.screen),
    visible: () => GameUI.screen === 'menu' || GameUI.screen === 'shop' || GameUI.screen === 'levels',
    persist: () => GameState.save(true),
    button: { corner: 'tr', x: 12, y: 74 },
    packs: [
        { id: 'coins_s', type: 'consumable', icon: '🪙', name: 'Горсть монет', desc: '3 000 монет на оружие, героев и питомцев', grant: () => GameState.addCoins(3000) },
        { id: 'coins_m', type: 'consumable', icon: '💰', name: 'Мешок монет', desc: '10 000 монет', grant: () => GameState.addCoins(10000) },
        { id: 'coins_l', type: 'consumable', icon: '🏆', name: 'Сундук монет', desc: '25 000 монет — хватит на самое мощное оружие', best: true, grant: () => GameState.addCoins(25000) },
        {
            id: 'starter', type: 'non_consumable', icon: '💥', name: 'Арсенал выжившего', best: 'Один раз',
            desc: '5 000 монет, гиперрельс, мини-ядерка и молот грома',
            grant: () => GameState.addCoins(5000),
            apply: () => {
                let n = 0;
                for (const id of ['heavy-8', 'explosive-10', 'melee-10']) if (!GameState.owns(id)) { GameState.s.owned.push(id); n++; }
                if (n) { GameState.save(true); window.dispatchEvent(new CustomEvent('sm-coins')); }
            },
        },
        { id: 'no_ads', type: 'non_consumable', icon: '🚫', name: 'Без рекламы', desc: 'Убирает межстраничную рекламу навсегда. Награды за рекламу остаются', noAds: true },
    ],
});
