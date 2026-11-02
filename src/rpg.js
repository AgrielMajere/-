import { get as saveGet, commit as saveCommit } from './save.js';
import { PATRONS, RUNES } from './features.js';

// ================= classes =================
export const CLASSES = {
  warrior: { n: 'Воїн', i: '⚔️', d: 'Збалансований боєць із мечем і щитом. Тримає удар, рубає впевнено.', type: 'melee', main: 'str',
    base: { str: 9, agi: 5, int: 2, vit: 9 }, grow: { str: 2, agi: 1, int: 0, vit: 2 }, wpn: 'sword', off: 'shield', look: { top: '#3c4a5c', bottom: '#2b2a2e', cape: '#7a1a1a' },
    atk: ['Attack1H', 'Slash', 'SlashH'], skills: [
      { id: 'power', n: 'Потужний удар', i: '💥', mp: 8, cd: 5, kind: 'melee', mult: 2.3, anim: 'Attack2H' },
      { id: 'cry', n: 'Бойовий клич', i: '📯', mp: 14, cd: 22, kind: 'buff', buff: { atk: .35 }, dur: 12, anim: 'Cheer' },
      { id: 'whirl', n: 'Вихор', i: '🌀', mp: 20, cd: 11, kind: 'aoe', mult: 1.6, radius: 3.6, anim: 'Spin' }] },
  berserker: { n: 'Берсерк', i: '⚒️', d: 'Дворучна сокира, шалений урон, мало захисту. Чим гірше — тим лютіше.', type: 'melee', main: 'str',
    base: { str: 12, agi: 5, int: 1, vit: 8 }, grow: { str: 3, agi: 1, int: 0, vit: 1 }, wpn: 'axe2', look: { top: '#5a2a1e', bottom: '#2a2018', cape: '#3a2a1a' },
    atk: ['Attack2H', 'Slice2H'], skills: [
      { id: 'rage', n: 'Лютий удар', i: '💉', mp: 10, cd: 6, kind: 'melee', mult: 2.8, anim: 'Attack2H' },
      { id: 'blood', n: 'Кровожерність', i: '🍷', mp: 15, cd: 24, kind: 'buff', buff: { leech: .25, atk: .15 }, dur: 12, anim: 'Cheer' },
      { id: 'spin', n: 'Вихор смерті', i: '🌪️', mp: 24, cd: 12, kind: 'aoe', mult: 2.1, radius: 4, anim: 'Spin' }] },
  paladin: { n: 'Паладин', i: '🛡️', d: 'Святий лицар: булава, щит, лікування й божественний захист.', type: 'melee', main: 'str',
    base: { str: 8, agi: 4, int: 5, vit: 10 }, grow: { str: 2, agi: 0, int: 1, vit: 2 }, wpn: 'mace', off: 'kite', look: { top: '#d8d4c8', bottom: '#4a4a52', cape: '#e8e2d0', armor: '#e8e4dc' }, body: 'soldier',
    atk: ['Attack1H', 'Slash'], skills: [
      { id: 'smite', n: 'Святий удар', i: '✨', mp: 10, cd: 5, kind: 'melee', mult: 2.0, holy: true, anim: 'Attack1H' },
      { id: 'aegis', n: 'Божественний щит', i: '🔆', mp: 16, cd: 22, kind: 'buff', buff: { dr: .6 }, dur: 7, anim: 'Block' },
      { id: 'heal', n: 'Лікування', i: '💚', mp: 18, cd: 14, kind: 'heal', heal: .35, anim: 'Raise' }] },
  mage: { n: 'Маг', i: '🔥', d: 'Магія стихій із посоха. Крихкий, але б\'є здалеку й по площі.', type: 'magic', main: 'int', range: 13,
    base: { str: 2, agi: 4, int: 12, vit: 6 }, grow: { str: 0, agi: 1, int: 3, vit: 1 }, wpn: 'staff', look: { top: '#24305a', bottom: '#1e2238', cape: '#24305a', hat: 'wizard', hatColor: '#24305a' },
    atk: ['Cast'], bolt: { color: '#7ad8ff', speed: 22 }, skills: [
      { id: 'fireball', n: 'Вогняна куля', i: '🔥', mp: 12, cd: 4, kind: 'proj', mult: 2.4, aoe: 2.6, color: '#ff7a2a', anim: 'Cast' },
      { id: 'frost', n: 'Крижана стріла', i: '❄️', mp: 10, cd: 6, kind: 'proj', mult: 1.8, slow: .5, color: '#9fe8ff', anim: 'Cast' },
      { id: 'meteor', n: 'Метеор', i: '☄️', mp: 30, cd: 16, kind: 'meteor', mult: 3.6, radius: 4, anim: 'CastLong' }] },
  archer: { n: 'Лучник', i: '🏹', d: 'Стріляє далеко й точно. Залпи, прицільні постріли й спритність.', type: 'ranged', main: 'agi', range: 16,
    base: { str: 4, agi: 12, int: 3, vit: 6 }, grow: { str: 1, agi: 3, int: 0, vit: 1 }, wpn: 'bow', look: { top: '#2f4a2a', bottom: '#3a3226', cape: '#2f3a22' },
    atk: ['Bow'], bolt: { color: '#e8d8b0', arrow: true, speed: 30 }, skills: [
      { id: 'aimed', n: 'Прицільний постріл', i: '🎯', mp: 8, cd: 5, kind: 'proj', mult: 3.0, crit: 1, arrow: true, anim: 'Bow' },
      { id: 'volley', n: 'Залп', i: '🌧️', mp: 16, cd: 10, kind: 'multi', mult: 1.4, count: 4, arrow: true, anim: 'Bow' },
      { id: 'hawk', n: 'Око яструба', i: '🦅', mp: 14, cd: 22, kind: 'buff', buff: { crit: 30, spd: .25 }, dur: 12, anim: 'Cheer' }] },
  rogue: { n: 'Розбійник', i: '🗡️', d: 'Два кинджали, критичні удари, отрута й ривки з тіні.', type: 'melee', main: 'agi',
    base: { str: 6, agi: 12, int: 2, vit: 6 }, grow: { str: 1, agi: 3, int: 0, vit: 1 }, wpn: 'dagger', off: 'dagger', look: { top: '#1e1e22', bottom: '#18181a', cape: '#121214' },
    atk: ['Dual', 'DualStab', 'DualSlice'], skills: [
      { id: 'backstab', n: 'Удар у спину', i: '🔪', mp: 9, cd: 5, kind: 'melee', mult: 2.4, crit: 1, anim: 'DualStab' },
      { id: 'poison', n: 'Отрута', i: '🧪', mp: 12, cd: 9, kind: 'melee', mult: 1.2, dot: { mult: .35, ticks: 6 }, anim: 'Dual' },
      { id: 'shadow', n: 'Тіньовий ривок', i: '🌑', mp: 14, cd: 8, kind: 'dash', mult: 2.0, anim: 'DodgeF' }] },
  cleric: { n: 'Клірик', i: '☀️', d: 'Служитель світла: лікує, благословляє і випалює нежить.', type: 'magic', main: 'int', range: 11,
    base: { str: 4, agi: 4, int: 10, vit: 8 }, grow: { str: 1, agi: 0, int: 2, vit: 2 }, wpn: 'scepter', look: { top: '#e8e2d4', bottom: '#8a7a5a', cape: '#efe8d8' },
    atk: ['Cast'], bolt: { color: '#ffe9a0', speed: 20 }, skills: [
      { id: 'light', n: 'Священне світло', i: '🌟', mp: 10, cd: 4, kind: 'proj', mult: 2.2, holy: true, color: '#fff2b0', anim: 'Cast' },
      { id: 'cure', n: 'Зцілення', i: '💖', mp: 16, cd: 10, kind: 'heal', heal: .5, anim: 'Raise' },
      { id: 'bless', n: 'Благословення', i: '🙏', mp: 18, cd: 24, kind: 'buff', buff: { def: .5, regen: .03 }, dur: 15, anim: 'Raise' }] },
  necro: { n: 'Некромант', i: '💀', d: 'Темна магія: висмоктує життя і підіймає кістяних слуг.', type: 'magic', main: 'int', range: 12,
    base: { str: 3, agi: 4, int: 12, vit: 6 }, grow: { str: 0, agi: 1, int: 3, vit: 1 }, wpn: 'skullstaff', look: { top: '#1a1420', bottom: '#120e16', cape: '#24102e', hat: 'wizard', hatColor: '#140c18' },
    atk: ['Cast'], bolt: { color: '#b46aff', speed: 20 }, skills: [
      { id: 'shadowbolt', n: 'Тіньова стріла', i: '💜', mp: 9, cd: 3.5, kind: 'proj', mult: 2.2, color: '#a050ff', anim: 'Cast' },
      { id: 'drain', n: 'Висмоктування', i: '💉', mp: 14, cd: 8, kind: 'proj', mult: 1.8, drain: .6, color: '#ff3a6a', anim: 'Cast' },
      { id: 'raise', n: 'Підняти скелета', i: '🦴', mp: 28, cd: 30, kind: 'summon', dur: 40, anim: 'CastLong' }] }
};
export const CLASS_ORDER = ['warrior', 'berserker', 'paladin', 'mage', 'archer', 'rogue', 'cleric', 'necro'];

// ================= ranks =================
export const RANKS = [
  { r: 'F', n: 'Новачок', gp: 0, lvl: 1, c1: '#7a7a80', c2: '#4a4a50' },
  { r: 'E', n: 'Учень', gp: 30, lvl: 3, c1: '#b07a4a', c2: '#6a4a2a' },
  { r: 'D', n: 'Мандрівник', gp: 90, lvl: 6, c1: '#c48a5a', c2: '#7a4a2a' },
  { r: 'C', n: 'Ветеран', gp: 200, lvl: 9, c1: '#d8dce4', c2: '#8a909a' },
  { r: 'B', n: 'Еліта', gp: 380, lvl: 12, c1: '#f2cf6a', c2: '#a8822a' },
  { r: 'A', n: 'Майстер', gp: 650, lvl: 16, c1: '#e6f2ff', c2: '#7aa8d8' },
  { r: 'S', n: 'Легенда', gp: 1000, lvl: 20, c1: '#ff9ae8', c2: '#7a5aff' }
];
export function rankOf(i){ return RANKS[Math.max(0, Math.min(RANKS.length - 1, i))]; }

// ================= items =================
export const RARITY = [
  { n: 'Звичайний', c: '#c8c8c8', m: 1 }, { n: 'Незвичайний', c: '#6ad06a', m: 1.25 }, { n: 'Рідкісний', c: '#5aa8ff', m: 1.55 },
  { n: 'Епічний', c: '#c46aff', m: 1.95 }, { n: 'Легендарний', c: '#ffaa2a', m: 2.5 }
];
// weapon kinds -> classes that can use them
export const WEAPONS = {
  sword: { n: 'меч', i: '🗡️', cls: ['warrior', 'paladin'], tiers: ['Іржавий меч', 'Сталевий меч', 'Лицарський меч', 'Міфриловий клинок', 'Клинок Світанку'] },
  axe2: { n: 'сокира', i: '⚒️', cls: ['berserker'], tiers: ['Лісова сокира', 'Бойова сокира', 'Секира вовка', 'Руйнівниця', 'Сокира Перуна'] },
  mace: { n: 'булава', i: '🔨', cls: ['paladin', 'cleric'], tiers: ['Дубова булава', 'Залізна булава', 'Булава присяги', 'Сонячний моргенштерн', 'Молот Тора'] },
  staff: { n: 'посох', i: '✨', cls: ['mage'], tiers: ['Посох учня', 'Дубовий посох', 'Кришталевий посох', 'Посох архимага', 'Око Одіна'] },
  skullstaff: { n: 'посох', i: '☠️', cls: ['necro'], tiers: ['Кістяний жезл', 'Посох могил', 'Посох жнеця', 'Корона смерті', 'Посох Чорнобога'] },
  bow: { n: 'лук', i: '🏹', cls: ['archer'], tiers: ['Мисливський лук', 'Тисовий лук', 'Ельфійський лук', 'Лук бурі', 'Лук Артеміди'] },
  dagger: { n: 'кинджали', i: '🔪', cls: ['rogue'], tiers: ['Ржаві ножі', 'Сталеві кинджали', 'Тіньові леза', 'Ікла гадюки', 'Кинджали Гермеса'] },
  scepter: { n: 'скіпетр', i: '🔱', cls: ['cleric'], tiers: ['Дерев\'яний символ', 'Срібний скіпетр', 'Скіпетр світла', 'Сонячний жезл', 'Скіпетр Дажбога'] }
};
export const ARMORS = {
  armor: { n: 'Обладунок', i: '🥋', tiers: ['Шкіряна куртка', 'Кольчуга', 'Лицарські лати', 'Міфрилова броня', 'Обладунок героя'] },
  helm: { n: 'Шолом', i: '⛑️', tiers: ['Шкіряний каптур', 'Залізний шолом', 'Шолом вартового', 'Шолом дракона', 'Вінець героя'] },
  shield: { n: 'Щит', i: '🛡️', tiers: ['Дерев\'яний щит', 'Окутий щит', 'Щит лицаря', 'Щит грифона', 'Егіда'] },
  ring: { n: 'Кільце', i: '💍', tiers: ['Мідне кільце', 'Срібне кільце', 'Золоте кільце', 'Кільце мага', 'Перстень долі'] },
  amulet: { n: 'Амулет', i: '📿', tiers: ['Оберіг', 'Амулет вовка', 'Амулет сови', 'Амулет фенікса', 'Сльоза Мокоші'] }
};
export const SLOTS = [['weapon', 'Зброя'], ['shield', 'Щит'], ['helm', 'Шолом'], ['armor', 'Броня'], ['amulet', 'Амулет'], ['ring', 'Кільце']];
export const MATERIALS = {
  jelly: { n: 'Желе слизу', i: '💚', price: 3 }, core: { n: 'Ядро слизу', i: '🔵', price: 12 }, ear: { n: 'Вухо гобліна', i: '👂', price: 6 }, totem: { n: 'Тотем шамана', i: '🎎', price: 15 },
  tusk: { n: 'Ікло орка', i: '🦷', price: 12 }, hide: { n: 'Шкура варга', i: '🐾', price: 9 }, bone: { n: 'Стара кістка', i: '🦴', price: 10 }, soul: { n: 'Уламок душі', i: '💠', price: 40 },
  crown: { n: 'Корона слизів', i: '👑', price: 120 }, banner: { n: 'Прапор вождя', i: '🚩', price: 220 }, phylactery: { n: 'Філактерій', i: '⚱️', price: 400 }, gchief: { n: 'Ніж ватажка', i: '🗡️', price: 90 },
  // dungeon
  venom: { n: 'Отруйне желе', i: '💜', price: 14 }, kscale: { n: 'Луска кобольда', i: '🦎', price: 16 }, kfang: { n: 'Ікло вождя кобольдів', i: '🐲', price: 160 },
  nail: { n: 'Кіготь упиря', i: '⚓', price: 24 }, ecto: { n: 'Ектоплазма', i: '👻', price: 30 }, kseal: { n: 'Печать Кістяного лицаря', i: '🔱', price: 420 },
  dsteel: { n: 'Темна сталь', i: '⚫', price: 42 }, sigil: { n: 'Знак культу Безодні', i: '🔺', price: 38 }, mhorn: { n: 'Ріг Мінотавра', i: '📯', price: 1200 },
  // the wide world
  pelt: { n: 'Шкура вовкулака', i: '🐺', price: 18 }, fang: { n: 'Ікло Сірого Ікла', i: '🦷', price: 260 },
  pearl: { n: 'Річкова перлина', i: '🐚', price: 30 }, vcrown: { n: 'Корона Водяника', i: '🔱', price: 420 },
  badge: { n: 'Бляха розбійника', i: '🏷️', price: 20 }, ravenf: { n: 'Перо Чорного Ворона', i: '🕊️', price: 520 },
  herb: { n: 'Болотяна трава', i: '🌿', price: 16 }, bogscale: { n: 'Луска болотяника', i: '🐊', price: 26 }, mstaff: { n: 'Палиця відьми Мари', i: '✨', price: 680 },
  ore: { n: 'Зоряна руда', i: '💎', price: 60 }, gcore: { n: 'Серце Колоса', i: '🧡', price: 1500 }
};
export const CONSUMABLES = {
  hp1: { n: 'Мале зілля здоров\'я', i: '🧪', heal: 60, price: 15 }, hp2: { n: 'Зілля здоров\'я', i: '❤️', heal: 180, price: 45 }, hp3: { n: 'Велике зілля здоров\'я', i: '💗', heal: 500, price: 120 },
  mp1: { n: 'Мале зілля мани', i: '🔹', mana: 40, price: 15 }, mp2: { n: 'Зілля мани', i: '💙', mana: 120, price: 45 },
  elixir: { n: 'Еліксир Мімира', i: '⚗️', heal: 9999, mana: 9999, price: 0, sparks: 3 }
};

let uid = Date.now()%100000;
export function makeEquip(kind, tier, rarity, cls){
  tier = Math.max(0, Math.min(4, tier)); rarity = Math.max(0, Math.min(4, rarity));
  const R = RARITY[rarity];
  if(WEAPONS[kind]){
    const W = WEAPONS[kind]; const base = [10, 18, 30, 46, 68][tier];
    return { uid: ++uid, k: 'weapon', w: kind, n: W.tiers[tier], i: W.i, tier, rar: rarity, plus: 0, atk: Math.round(base*R.m), bonus: rollBonus(rarity, tier) };
  }
  const A = ARMORS[kind]; const base = { armor: [5, 10, 17, 26, 38], helm: [2, 5, 8, 12, 18], shield: [3, 7, 12, 18, 26], ring: [0, 0, 0, 0, 0], amulet: [0, 0, 0, 0, 0] }[kind][tier];
  const it = { uid: ++uid, k: kind, n: A.tiers[tier], i: A.i, tier, rar: rarity, plus: 0, def: Math.round(base*R.m), bonus: rollBonus(rarity + (kind === 'ring' || kind === 'amulet' ? 1 : 0), tier) };
  return it;
}
function rollBonus(r, tier){
  const b = {}; const keys = ['str', 'agi', 'int', 'vit', 'hp', 'mp', 'crit'];
  for(let i = 0; i < r; i++){ const k = keys[Math.floor(Math.random()*keys.length)]; const v = k === 'hp' ? 15 + tier*15 : k === 'mp' ? 8 + tier*8 : k === 'crit' ? 2 + tier : 1 + tier; b[k] = (b[k] || 0) + v; }
  return b;
}
export function itemValue(it){
  if(it.k === 'mat') return (MATERIALS[it.id].price)*(it.q || 1);
  if(it.k === 'use') return Math.round(CONSUMABLES[it.id].price*.4)*(it.q || 1);
  return Math.round((12 + it.tier*30)*RARITY[it.rar].m*(1 + it.plus*.25));
}
export function itemName(it){ if(it.k === 'mat') return MATERIALS[it.id].n; if(it.k === 'use') return CONSUMABLES[it.id].n; return it.n + (it.plus ? ' +' + it.plus : ''); }
export function itemIcon(it){ if(it.k === 'mat') return MATERIALS[it.id].i; if(it.k === 'use') return CONSUMABLES[it.id].i; return it.i; }
export function itemColor(it){ return it.rar != null ? RARITY[it.rar].c : '#c8c8c8'; }
export const BONUS_N = { str: 'Сила', agi: 'Спритність', int: 'Інтелект', vit: 'Живучість', hp: 'Здоров\'я', mp: 'Мана', crit: 'Крит %' };

// ================= monsters =================
// fig: figure spec; drops: [id, chance, qty]; eq: chance of equipment drop
export const MONSTERS = {
  slime: { n: 'Слиз', lvl: [1, 3], hp: 26, atk: 5, def: 1, spd: 1.5, aggro: 7, range: 1.3, xp: 9, gold: [1, 4], slime: { color: '#5ad06a', size: .7 }, drops: [['jelly', .65, 1], ['core', .06, 1]], eq: .05, gp: 1 },
  slime_b: { n: 'Синій слиз', lvl: [3, 5], hp: 48, atk: 8, def: 2, spd: 1.6, aggro: 8, range: 1.4, xp: 16, gold: [2, 7], slime: { color: '#4a9aff', size: .9 }, drops: [['jelly', .7, 2], ['core', .15, 1]], eq: .07, gp: 1 },
  king_slime: { n: 'Король слизів', boss: true, lvl: [7, 7], hp: 1050, atk: 23, def: 6, spd: 1.4, aggro: 11, range: 2.4, xp: 180, gold: [60, 90], slime: { color: '#3a7aff', size: 2.6, crown: '#e2b552' }, drops: [['crown', 1, 1], ['core', 1, 4]], eq: 1, eqRar: 2, gp: 25, respawn: 120 },
  goblin: { n: 'Гоблін', lvl: [4, 7], hp: 70, atk: 11, def: 4, spd: 2.6, aggro: 10, range: 1.6, xp: 22, gold: [3, 10], fig: { body: 'man', height: 1.18, look: { skin: '#6f8f3a', eyes: '#ffd23a', hat: false, beard: false, top: '#5a4a30', bottom: '#3a2e22', shoes: '#2a2018' }, gear: { right: { type: 'dagger' }, ears: true } }, atk_anim: ['Stab', 'Slash'], drops: [['ear', .55, 1]], eq: .08, gp: 2 },
  goblin_sh: { n: 'Гоблін-шаман', lvl: [5, 8], hp: 55, atk: 15, def: 3, spd: 2.2, aggro: 13, range: 10, ranged: { color: '#7aff5a', speed: 16 }, xp: 28, gold: [5, 12], fig: { body: 'man', height: 1.12, look: { skin: '#5f7f3a', eyes: '#ff7a2a', hat: false, top: '#3a2a4a', bottom: '#2a1e2a' }, gear: { right: { type: 'staff', skull: true, color: '#7aff5a' }, ears: true } }, atk_anim: ['Cast'], drops: [['ear', .5, 1], ['totem', .25, 1]], eq: .1, gp: 2 },
  goblin_chief: { n: 'Ватажок гоблінів', boss: true, lvl: [10, 10], hp: 1700, atk: 32, def: 9, spd: 2.8, aggro: 12, range: 1.9, xp: 320, gold: [90, 140], fig: { body: 'man', height: 1.5, width: 1.15, look: { skin: '#557a2a', eyes: '#ff3a1a', hat: '#3a2a1a', top: '#2a1a12', bottom: '#1a1410' }, gear: { right: { type: 'sword', len: .7 }, left: { type: 'shield' }, ears: true, cape: '#5a1a1a' } }, atk_anim: ['Attack1H', 'Slash'], drops: [['gchief', 1, 1], ['ear', 1, 3]], eq: 1, eqRar: 2, gp: 35, respawn: 150 },
  orc: { n: 'Орк', lvl: [8, 11], hp: 170, atk: 20, def: 9, spd: 2.4, aggro: 11, range: 2.0, xp: 48, gold: [8, 20], fig: { body: 'man', height: 2.05, width: 1.25, look: { skin: '#4f6a3a', hat: false, top: '#3a2a1a', bottom: '#2a2018', eyes: '#ff4a1a' }, gear: { right: { type: 'axe' }, tusks: true } }, atk_anim: ['Attack1H', 'Slash'], drops: [['tusk', .5, 1], ['hide', .35, 1]], eq: .1, gp: 3 },
  orc_brute: { n: 'Орк-берсерк', lvl: [10, 13], hp: 230, atk: 26, def: 8, spd: 2.6, aggro: 11, range: 2.2, xp: 66, gold: [12, 26], fig: { body: 'man', height: 2.2, width: 1.32, look: { skin: '#5a5a32', hat: false, beard: false, top: '#2a1a12', bottom: '#2a2018', eyes: '#ff2a0a' }, gear: { right: { type: 'axe', two: true }, tusks: true } }, atk_anim: ['Attack2H', 'Slice2H'], drops: [['tusk', .6, 1], ['hide', .4, 1]], eq: .12, gp: 4 },
  orc_chief: { n: 'Вождь орків', boss: true, lvl: [15, 15], hp: 3400, atk: 50, def: 16, spd: 2.5, aggro: 13, range: 2.6, xp: 700, gold: [180, 260], fig: { body: 'soldier', height: 2.6, width: 1.15, look: { armor: '#5a3a2a', visor: '#ff3a1a' }, gear: { right: { type: 'axe', two: true }, cape: '#5a1010', aura: '#ff3a1a' } }, atk_anim: ['Attack2H', 'Spin', 'Slice2H'], drops: [['banner', 1, 1], ['tusk', 1, 4]], eq: 1, eqRar: 3, gp: 60, respawn: 180 },
  skeleton: { n: 'Скелет-воїн', lvl: [12, 15], hp: 260, atk: 30, def: 14, spd: 2.2, aggro: 12, range: 1.9, xp: 80, gold: [14, 30], undead: true, fig: { body: 'bones', look: { eyes: '#ff5a2a' }, gear: { right: { type: 'sword', mat: null }, left: { type: 'shield' } } }, atk_anim: ['Attack1H', 'Slash', 'Stab'], drops: [['bone', .6, 1], ['soul', .08, 1]], eq: .14, gp: 5 },
  skeleton_ar: { n: 'Скелет-лучник', lvl: [12, 16], hp: 190, atk: 34, def: 10, spd: 2.2, aggro: 15, range: 13, ranged: { color: '#e8d8b0', arrow: true, speed: 26 }, xp: 86, gold: [14, 32], undead: true, fig: { body: 'bones', look: { eyes: '#5ad8ff' }, gear: { left: { type: 'bow' } } }, atk_anim: ['Bow'], drops: [['bone', .6, 1], ['soul', .1, 1]], eq: .14, gp: 5 },
  // ---------- Вовчі пагорби ----------
  wolfling: { n: 'Вовкулак', lvl: [7, 10], hp: 200, atk: 19, def: 6, spd: 3.5, aggro: 12, range: 1.6, xp: 40, gold: [5, 13], fig: { body: 'man', height: 1.9, look: { skin: '#6a5a4c', eyes: '#ffcc33', hat: false, beard: false, top: '#2a2018', bottom: '#241c14', hair: '#3a3028', shoes: '#1a140e' }, gear: { beast: { kind: 'wolf', color: '#4a4038', inner: '#8a6a5a', tip: '#6a5e54' } } }, atk_anim: ['Punch', 'Kick', 'Slash'], drops: [['pelt', .55, 1]], eq: .09, gp: 3, respawn: 60 },
  wolf_alpha: { n: 'Вожак Сіре Ікло', boss: true, lvl: [12, 12], hp: 3300, atk: 40, def: 12, spd: 3.6, aggro: 15, range: 2.2, xp: 560, gold: [100, 160], fig: { body: 'man', height: 2.55, width: 1.32, look: { skin: '#7a7068', eyes: '#ff3a1a', hat: false, beard: false, top: '#1a1612', bottom: '#1a1612', hair: '#9a9590' }, gear: { beast: { kind: 'wolf', color: '#8a8580', inner: '#b8a8a0', tip: '#d8d4d0' }, aura: '#c8c0b0', cape: '#3a3028' } }, atk_anim: ['Punch', 'Kick', 'Slash'],
    charge: { len: 13, w: 2.4, tele: .9, cd: 9, mult: 2.0 }, enrage: .35, drops: [['fang', 1, 1], ['pelt', 1, 3]], eq: 1, eqRar: 2, gp: 45, respawn: 200 },
  // ---------- Тихе озеро ----------
  drowner: { n: 'Утопець', lvl: [9, 12], hp: 250, atk: 23, def: 8, spd: 2.5, aggro: 10, range: 1.7, xp: 52, gold: [6, 16], undead: true, fig: { body: 'man', height: 1.82, look: { skin: '#7a9a8e', eyes: '#bfffea', hat: false, beard: false, top: '#3a4a44', bottom: '#2a3430', hair: '#2a3a30', shoes: '#1a2420' } }, atk_anim: ['Punch', 'Kick'], drops: [['pearl', .3, 1]], eq: .1, gp: 4, respawn: 70 },
  rusalka: { n: 'Русалка', lvl: [10, 13], hp: 190, atk: 27, def: 6, spd: 2.6, aggro: 14, range: 11, ranged: { color: '#7affff', speed: 17 }, xp: 60, gold: [8, 18], fig: { body: 'woman', height: 1.7, look: { eyes: '#7affff' }, gear: { aura: '#5affe0' } }, atk_anim: ['Cast'], drops: [['pearl', .45, 1]], eq: .1, gp: 4, respawn: 70 },
  vodyanyk: { n: 'Водяник', boss: true, lvl: [14, 14], hp: 4800, atk: 50, def: 15, spd: 2.3, aggro: 15, range: 2.6, xp: 820, gold: [160, 240], undead: true, fig: { body: 'man', height: 2.5, width: 1.38, look: { skin: '#4a7a6e', eyes: '#aaffee', hat: false, top: '#1e3a34', bottom: '#183028', hair: '#2a4a3a' }, gear: { right: { type: 'staff', color: '#5affff' }, aura: '#3affd0', crown: '#9ad8c8', cape: '#1e3a34' } }, atk_anim: ['Attack2H', 'Cast', 'Slash'],
    slam: { r: 5.0, tele: 1.25, cd: 8, mult: 1.7 }, adds: { at: .55, type: 'drowner' }, enrage: .3, drops: [['vcrown', 1, 1], ['pearl', 1, 3]], eq: 1, eqRar: 2, gp: 70, respawn: 240 },
  // ---------- Темний ліс ----------
  bandit: { n: 'Лісовий розбійник', lvl: [11, 14], hp: 310, atk: 30, def: 11, spd: 2.8, aggro: 12, range: 1.8, xp: 70, gold: [12, 28], fig: { body: 'man', height: 1.8, look: { top: '#2a2a22', bottom: '#1e1c18', hat: '#1a1a14', shoes: '#141210' }, gear: { right: { type: 'sword' }, cape: '#2a2a20' } }, atk_anim: ['Attack1H', 'Slash', 'Stab'], drops: [['badge', .5, 1]], eq: .13, gp: 5, respawn: 80 },
  bandit_ar: { n: 'Розбійник-лучник', lvl: [11, 14], hp: 230, atk: 33, def: 8, spd: 2.7, aggro: 15, range: 13, ranged: { color: '#e8d8b0', arrow: true, speed: 28 }, xp: 74, gold: [12, 30], fig: { body: 'man', height: 1.78, look: { top: '#3a3a26', bottom: '#2a2620', hat: '#2a2a1a', shoes: '#141210' }, gear: { left: { type: 'bow' }, cape: '#2f3a22' } }, atk_anim: ['Bow'], drops: [['badge', .5, 1]], eq: .13, gp: 5, respawn: 80 },
  raven: { n: 'Отаман Чорний Ворон', boss: true, lvl: [16, 16], hp: 6200, atk: 58, def: 20, spd: 2.8, aggro: 15, range: 2.4, xp: 1250, gold: [250, 380], fig: { body: 'soldier', height: 2.3, width: 1.12, look: { armor: '#18181c', visor: '#ff2a1a' }, gear: { right: { type: 'greatsword' }, cape: '#0a0a0e', aura: '#5a2a8a' } }, atk_anim: ['Attack1H', 'SlashH', 'Slash'],
    slam: { r: 4.4, tele: 1.15, cd: 9, mult: 1.6 }, charge: { len: 14, w: 2.4, tele: .95, cd: 10, mult: 2.1 }, enrage: .35, adds: { at: .5, type: 'bandit' }, drops: [['ravenf', 1, 1], ['badge', 1, 3]], eq: 1, eqRar: 3, gp: 95, respawn: 260 },
  // ---------- Гниле болото ----------
  lizard: { n: 'Ящір-болотяник', lvl: [14, 17], hp: 400, atk: 38, def: 14, spd: 2.7, aggro: 12, range: 1.9, xp: 100, gold: [16, 34], fig: { body: 'man', height: 1.95, width: 1.08, look: { skin: '#4a6a2a', eyes: '#ffd23a', hat: false, beard: false, top: '#3a4a22', bottom: '#2a3418', hair: '#2a3a18', shoes: '#1a2410' }, gear: { right: { type: 'mace' }, beast: { kind: 'cat', ears: false, color: '#3e5a22', tip: '#6a8a3a' } } }, atk_anim: ['Attack1H', 'Slash'], drops: [['bogscale', .5, 1], ['herb', .4, 1]], eq: .14, gp: 6, respawn: 90 },
  bogslime: { n: 'Болотяний слиз', lvl: [14, 16], hp: 330, atk: 34, def: 10, spd: 1.8, aggro: 9, range: 1.8, xp: 92, gold: [12, 28], slime: { color: '#6a7a2a', size: 1.35 }, drops: [['herb', .6, 1], ['jelly', .6, 2]], eq: .1, gp: 5, respawn: 90 },
  witch: { n: 'Болотяна відьма Мара', boss: true, lvl: [19, 19], hp: 7400, atk: 66, def: 18, spd: 2.3, aggro: 16, range: 12, ranged: { color: '#9aff5a', speed: 17 }, xp: 1700, gold: [300, 450], fig: { body: 'woman', height: 1.85, look: { eyes: '#9aff5a' }, gear: { right: { type: 'staff', skull: true, color: '#9aff5a' }, robe: '#24321a', hat: 'wizard', hatColor: '#1a2410', aura: '#7aff3a' } }, atk_anim: ['Cast', 'CastLong'],
    slam: { r: 5.2, tele: 1.4, cd: 10, mult: 1.6 }, adds: { at: .6, type: 'bogslime' }, enrage: .3, drops: [['mstaff', 1, 1], ['herb', 1, 4]], eq: 1, eqRar: 3, gp: 120, respawn: 280 },
  // ---------- Покинуті шахти ----------
  golem: { n: 'Кам\'яний страж', lvl: [22, 25], hp: 950, atk: 70, def: 30, spd: 2.0, aggro: 11, range: 2.3, xp: 280, gold: [40, 80], fig: { body: 'soldier', height: 2.7, width: 1.35, look: { armor: '#6a6560', visor: '#ff8a2a' }, gear: { right: { type: 'mace', gold: false } } }, atk_anim: ['Attack2H', 'Attack1H'], drops: [['ore', .45, 1]], eq: .18, gp: 9, respawn: 120 },
  minerghost: { n: 'Привид шахтаря', lvl: [22, 26], hp: 620, atk: 74, def: 16, spd: 2.4, aggro: 14, range: 12, ranged: { color: '#ffb85a', speed: 18 }, undead: true, xp: 270, gold: [40, 80], fig: { body: 'bones', height: 1.85, look: { eyes: '#ffb85a' }, gear: { robe: '#2a2622', aura: '#ffb85a', right: { type: 'mace' } } }, atk_anim: ['Cast'], drops: [['ore', .4, 1], ['soul', .15, 1]], eq: .18, gp: 9, respawn: 120 },
  // ---- Calamities and their subjects (passive until provoked; attacking one wakes the whole horde) ----
  titan: { n: 'Гірський Титан Ірмунд', boss: true, calamity: true, lvl: [50, 50], hp: 160000, atk: 260, def: 70, spd: 2.4, aggro: 0, range: 4.6, xp: 60000, gold: [8000, 12000], fig: { body: 'soldier', height: 11, width: 1.5, look: { armor: '#5d5951', visor: '#7ad8ff' }, gear: { right: { type: 'axe', two: true }, aura: '#7ad8ff', cape: '#2a3440' } }, atk_anim: ['Attack2H', 'Slice2H', 'Spin'],
    slam: { r: 13, tele: 1.7, cd: 8, mult: 2.2 }, charge: { len: 30, w: 6, tele: 1.3, cd: 13, mult: 2.4 }, enrage: .3, adds: { at: .5, type: 'titan_guard' }, drops: [['gcore', 1, 3], ['ore', 1, 10], ['vcrown', 1, 1]], eq: 1, eqRar: 4, gp: 1500, respawn: 900 },
  titan_guard: { n: 'Варта Титана', lvl: [38, 42], hp: 5200, atk: 150, def: 50, spd: 2.4, aggro: 0, range: 2.6, xp: 1600, gold: [160, 260], fig: { body: 'soldier', height: 3.4, width: 1.35, look: { armor: '#6a665e', visor: '#7ad8ff' }, gear: { right: { type: 'mace' }, left: { type: 'shield', kite: true } } }, atk_anim: ['Attack2H', 'Attack1H'], drops: [['ore', .6, 2], ['gcore', .08, 1]], eq: .25, eqRar: 3, gp: 30, respawn: 240 },
  stone_giant: { n: 'Скельний велетень', lvl: [40, 44], hp: 7600, atk: 170, def: 56, spd: 2.2, aggro: 0, range: 3.2, xp: 2200, gold: [200, 320], fig: { body: 'soldier', height: 4.6, width: 1.55, look: { armor: '#57534c', visor: '#ffaa3a' }, gear: { right: { type: 'axe', two: true } } }, atk_anim: ['Attack2H', 'Slice2H'], slam: { r: 5.5, tele: 1.2, cd: 9, mult: 1.8 }, drops: [['ore', 1, 3], ['gcore', .12, 1]], eq: .3, eqRar: 3, gp: 40, respawn: 300 },
  fenrir: { n: 'Фенрір, Пожирач Місяця', boss: true, calamity: true, lvl: [45, 45], hp: 120000, atk: 230, def: 52, spd: 4.4, aggro: 0, range: 3.8, xp: 48000, gold: [6000, 9000], fig: { body: 'man', height: 8, width: 1.45, look: { skin: '#3a3a44', eyes: '#9ad8ff', hat: false, beard: false, top: '#141418', bottom: '#141418', hair: '#c8ccd8' }, gear: { beast: { kind: 'wolf', color: '#4a4a58', inner: '#9a9aa8', tip: '#e8ecf4' }, aura: '#9ad8ff', cape: '#1a1c24' } }, atk_anim: ['Punch', 'Kick', 'Slash'],
    slam: { r: 10, tele: 1.4, cd: 7, mult: 2.0 }, charge: { len: 36, w: 5, tele: 1.0, cd: 10, mult: 2.3 }, enrage: .35, adds: { at: .5, type: 'moonwolf' }, drops: [['fang', 1, 8], ['pelt', 1, 8], ['badge', 1, 1]], eq: 1, eqRar: 4, gp: 1300, respawn: 900 },
  moonwolf: { n: 'Місячний вовкулака', lvl: [34, 38], hp: 3200, atk: 120, def: 32, spd: 4.0, aggro: 0, range: 2.2, xp: 1100, gold: [120, 200], fig: { body: 'man', height: 2.3, width: 1.2, look: { skin: '#5a5a66', eyes: '#9ad8ff', hat: false, beard: false, top: '#1a1a22', bottom: '#1a1a22', hair: '#b8bcc8' }, gear: { beast: { kind: 'wolf', color: '#8a8c98', inner: '#c8c8d0', tip: '#eef0f6' } } }, atk_anim: ['Punch', 'Kick', 'Slash'], drops: [['pelt', .6, 2], ['fang', .5, 2]], eq: .2, eqRar: 3, gp: 25, respawn: 200 },
  moon_alpha: { n: 'Срібний вожак', lvl: [38, 40], hp: 5400, atk: 140, def: 38, spd: 4.2, aggro: 0, range: 2.4, xp: 1900, gold: [200, 300], fig: { body: 'man', height: 2.9, width: 1.3, look: { skin: '#4a4a56', eyes: '#cfefff', hat: false, beard: false, top: '#14141a', bottom: '#14141a', hair: '#dfe2ea' }, gear: { beast: { kind: 'wolf', color: '#a8acb8', inner: '#d8d8e0', tip: '#ffffff' }, aura: '#cfefff' } }, atk_anim: ['Punch', 'Kick', 'Slash'], charge: { len: 14, w: 2.4, tele: .8, cd: 9, mult: 1.8 }, drops: [['pelt', 1, 2], ['fang', 1, 2]], eq: .3, eqRar: 3, gp: 40, respawn: 260 },
  slime_mother: { n: 'Праматір Слизів', boss: true, calamity: true, lvl: [40, 40], hp: 90000, atk: 200, def: 40, spd: 1.7, aggro: 0, range: 7, xp: 36000, gold: [5000, 7500], slime: { color: '#7a3aff', size: 9, crown: '#e2b552' }, slam: { r: 12, tele: 1.6, cd: 7, mult: 2.0 }, enrage: .3, adds: { at: .6, type: 'slime_royal' }, drops: [['core', 1, 12], ['crown', 1, 2]], eq: 1, eqRar: 4, gp: 1000, respawn: 900 },
  slime_royal: { n: 'Королівський слиз', lvl: [30, 34], hp: 2600, atk: 100, def: 24, spd: 2.2, aggro: 0, range: 2.4, xp: 800, gold: [80, 140], slime: { color: '#9a5aff', size: 1.7 }, drops: [['core', .8, 2]], eq: .15, eqRar: 3, gp: 18, respawn: 180 },
  slime_knight: { n: 'Слиз-лицар', lvl: [33, 36], hp: 3800, atk: 120, def: 34, spd: 2.0, aggro: 0, range: 2.8, xp: 1100, gold: [120, 200], slime: { color: '#5a2aaf', size: 2.3, crown: '#c0c0d0' }, drops: [['core', 1, 2], ['crown', .05, 1]], eq: .22, eqRar: 3, gp: 25, respawn: 220 },
  colossus: { n: 'Гранітний Колос', boss: true, lvl: [28, 28], hp: 24000, atk: 96, def: 34, spd: 2.4, aggro: 18, range: 3.0, xp: 6200, gold: [900, 1300], fig: { body: 'soldier', height: 3.8, width: 1.45, look: { armor: '#7a756e', visor: '#ffaa3a' }, gear: { right: { type: 'axe', two: true }, aura: '#ff8a2a' } }, atk_anim: ['Attack2H', 'Slice2H', 'Spin'],
    slam: { r: 6.0, tele: 1.3, cd: 7, mult: 1.9 }, charge: { len: 16, w: 3.0, tele: 1.0, cd: 11, mult: 2.2 }, enrage: .35, adds: { at: .5, type: 'golem' }, drops: [['gcore', 1, 1], ['ore', 1, 4]], eq: 1, eqRar: 4, gp: 320, respawn: 480 },
  // ---------- Підземелля Авантюристів ----------
  slime_p: { n: 'Отруйний слиз', lvl: [6, 8], hp: 130, atk: 15, def: 4, spd: 1.7, aggro: 8, range: 1.5, xp: 32, gold: [4, 10], slime: { color: '#a05aff', size: 1.05 }, drops: [['venom', .6, 1], ['core', .12, 1]], eq: .07, gp: 2, respawn: 90 },
  kobold: { n: 'Кобольд', lvl: [7, 9], hp: 150, atk: 17, def: 6, spd: 2.8, aggro: 10, range: 1.5, xp: 40, gold: [5, 14], fig: { body: 'man', height: 1.08, width: 1.08, look: { skin: '#9a5a32', eyes: '#ffcf3a', hat: false, beard: false, top: '#4a3a2a', bottom: '#2e241a', shoes: '#1a120c', hair: '#2a1a10' }, gear: { right: { type: 'mace' }, ears: true, tusks: true } }, atk_anim: ['Attack1H', 'Slash'], drops: [['kscale', .5, 1]], eq: .1, gp: 3, respawn: 90 },
  kobold_sl: { n: 'Кобольд-пращник', lvl: [7, 10], hp: 110, atk: 21, def: 4, spd: 2.6, aggro: 13, range: 11, ranged: { color: '#d8c8a0', speed: 19 }, xp: 44, gold: [6, 15], fig: { body: 'man', height: 1.02, look: { skin: '#a8683a', eyes: '#ffe05a', hat: false, beard: false, top: '#3a4a2a', bottom: '#2e241a', shoes: '#1a120c', hair: '#2a1a10' }, gear: { right: { type: 'dagger' }, ears: true } }, atk_anim: ['Throw', 'Cast'], drops: [['kscale', .45, 1]], eq: .1, gp: 3, respawn: 90 },
  kobold_chief: { n: 'Вождь кобольдів Гракх', boss: true, lvl: [11, 11], hp: 2600, atk: 36, def: 10, spd: 2.6, aggro: 12, range: 2.1, xp: 480, gold: [90, 140], fig: { body: 'man', height: 1.55, width: 1.32, look: { skin: '#8a4a2a', eyes: '#ff5a1a', hat: false, beard: false, top: '#3a1a10', bottom: '#2a1a12', hair: '#1a0e08' }, gear: { right: { type: 'axe', two: true }, ears: true, tusks: true, cape: '#5a1a0a', crown: '#b08a3a' } }, atk_anim: ['Attack2H', 'Slice2H'],
    slam: { r: 4.2, tele: 1.3, cd: 9, mult: 1.6 }, drops: [['kfang', 1, 1], ['kscale', 1, 3]], eq: 1, eqRar: 2, gp: 40, respawn: 210 },
  ghoul: { n: 'Упир', lvl: [13, 16], hp: 340, atk: 34, def: 12, spd: 3.1, aggro: 12, range: 1.7, xp: 98, gold: [16, 34], undead: true, fig: { body: 'man', height: 1.78, look: { skin: '#8a9a8e', eyes: '#ff2a2a', hat: false, beard: false, top: '#2a2a26', bottom: '#1e1c1a', shoes: '#141210', hair: '#3a3a36' }, gear: {} }, atk_anim: ['Punch', 'Kick'], drops: [['nail', .5, 1], ['soul', .07, 1]], eq: .14, gp: 5, respawn: 100 },
  wraith: { n: 'Привид склепу', lvl: [14, 16], hp: 240, atk: 38, def: 8, spd: 2.4, aggro: 14, range: 12, ranged: { color: '#8affff', speed: 16 }, xp: 104, gold: [16, 36], undead: true, fig: { body: 'bones', height: 1.9, look: { eyes: '#8affff' }, gear: { robe: '#1a2a3a', aura: '#4ad8ff', hat: 'wizard', hatColor: '#0e1820' } }, atk_anim: ['Cast'], drops: [['ecto', .45, 1], ['soul', .12, 1]], eq: .14, gp: 5, respawn: 100 },
  bone_knight: { n: 'Кістяний лицар Морен', boss: true, lvl: [17, 17], hp: 6400, atk: 58, def: 22, spd: 2.3, aggro: 14, range: 2.4, xp: 1400, gold: [260, 380], undead: true, summons: true, fig: { body: 'bones', height: 2.5, width: 1.15, look: { eyes: '#ff3a2a' }, gear: { right: { type: 'greatsword' }, left: { type: 'shield' }, crown: '#6a6a72', aura: '#ff3a2a', cape: '#2a0a0a' } }, atk_anim: ['Attack1H', 'SlashH', 'Slash'],
    slam: { r: 4.6, tele: 1.2, cd: 8, mult: 1.7 }, drops: [['kseal', 1, 1], ['soul', 1, 2]], eq: 1, eqRar: 3, gp: 90, respawn: 240 },
  dark_knight: { n: 'Темний лицар', lvl: [19, 21], hp: 560, atk: 54, def: 22, spd: 2.5, aggro: 12, range: 2.1, xp: 180, gold: [30, 60], fig: { body: 'soldier', height: 2.0, look: { armor: '#24242c', visor: '#ff2a1a' }, gear: { right: { type: 'sword' }, left: { type: 'shield' }, cape: '#2a0a10' } }, atk_anim: ['Attack1H', 'Slash', 'SlashH'], drops: [['dsteel', .45, 1]], eq: .16, gp: 7, respawn: 110 },
  cultist: { n: 'Культист Безодні', lvl: [19, 21], hp: 380, atk: 60, def: 12, spd: 2.4, aggro: 14, range: 12, ranged: { color: '#ff5a1a', speed: 18 }, xp: 176, gold: [30, 62], fig: { body: 'man', height: 1.8, look: { top: '#3a0a0a', bottom: '#1a0a0a', skin: '#c8a890', eyes: '#ff6a1a', hat: false, beard: false }, gear: { right: { type: 'staff', skull: true, color: '#ff5a1a' }, robe: '#3a0808', hat: 'wizard', hatColor: '#2a0606' } }, atk_anim: ['Cast', 'CastLong'], drops: [['sigil', .45, 1], ['soul', .1, 1]], eq: .16, gp: 7, respawn: 110 },
  minotaur_w: { n: 'Мінотавр-воїн', lvl: [20, 22], hp: 760, atk: 62, def: 18, spd: 2.7, aggro: 12, range: 2.3, xp: 230, gold: [36, 70], fig: { body: 'man', height: 2.35, width: 1.3, look: { skin: '#5a3a28', eyes: '#ff4a1a', hat: false, beard: false, top: '#3a2414', bottom: '#2a1a10', hair: '#1a100a' }, gear: { right: { type: 'axe', two: true }, horns: '#e8dcc0' } }, atk_anim: ['Attack2H', 'Slice2H'], drops: [['dsteel', .4, 1], ['hide', .5, 2]], eq: .18, gp: 8, respawn: 120 },
  minotaur: { n: 'Астерій, Мінотавр Глибин', boss: true, lvl: [24, 24], hp: 15000, atk: 80, def: 26, spd: 2.8, aggro: 18, range: 2.9, xp: 4600, gold: [700, 1000], chest: true, fig: { body: 'soldier', height: 3.3, width: 1.3, look: { armor: '#4a2a1a', visor: '#ff4a1a' }, gear: { right: { type: 'axe', two: true }, horns: '#e8dcc0', cape: '#4a0a08', aura: '#ff4a1a' } }, atk_anim: ['Attack2H', 'Slice2H', 'Spin'],
    slam: { r: 5.6, tele: 1.25, cd: 7, mult: 1.9 }, charge: { len: 15, w: 2.8, tele: 1.0, cd: 11, mult: 2.3 }, enrage: .35, adds: { at: .55, type: 'minotaur_w' }, drops: [['mhorn', 1, 1], ['soul', 1, 4], ['dsteel', 1, 3]], eq: 1, eqRar: 4, gp: 300, respawn: 420 },
  lich: { n: 'Лич', boss: true, lvl: [20, 20], hp: 5600, atk: 66, def: 20, spd: 2.0, aggro: 16, range: 12, ranged: { color: '#5aff8a', speed: 18 }, summons: true, xp: 1400, gold: [320, 480], undead: true, fig: { body: 'bones', height: 2.3, look: { eyes: '#5aff8a' }, gear: { right: { type: 'staff', skull: true, color: '#5aff8a' }, robe: '#2a1a3a', crown: '#8a8a9a', aura: '#3aff7a' } }, atk_anim: ['Cast', 'CastLong'], drops: [['phylactery', 1, 1], ['soul', 1, 3]], eq: 1, eqRar: 4, gp: 120, respawn: 240 }
};

// ================= quests =================
export const QUEST_POOL = [
  { id: 'q_slime', rank: 0, n: 'Нашестя слизів', d: 'Фермери скаржаться на слизів біля брами.', type: 'kill', target: ['slime', 'slime_b'], need: 6, gold: 25, xp: 40, gp: 6 },
  { id: 'q_jelly', rank: 0, n: 'Желе для алхіміка', d: 'Алхімік просить желе слизу для зілля.', type: 'collect', item: 'jelly', need: 5, gold: 30, xp: 35, gp: 6 },
  { id: 'q_core', rank: 1, n: 'Сяйні ядра', d: 'Зберіть ядра синіх слизів для ліхтарів міста.', type: 'collect', item: 'core', need: 2, gold: 60, xp: 70, gp: 10 },
  { id: 'q_king', rank: 1, n: 'Король лугу', d: 'Велетенський слиз у короні тероризує луг. Переможіть його.', type: 'kill', target: ['king_slime'], need: 1, gold: 120, xp: 200, gp: 22 },
  { id: 'q_gob', rank: 1, n: 'Гоблінські набіги', d: 'Гобліни грабують торговців на лісовій дорозі.', type: 'kill', target: ['goblin', 'goblin_sh'], need: 8, gold: 70, xp: 120, gp: 12 },
  { id: 'q_ears', rank: 2, n: 'Трофеї для старости', d: 'Принесіть вуха гоблінів як доказ.', type: 'collect', item: 'ear', need: 6, gold: 80, xp: 120, gp: 14 },
  { id: 'q_shaman', rank: 2, n: 'Темні тотеми', d: 'Шамани ставлять прокляті тотеми. Зберіть три.', type: 'collect', item: 'totem', need: 3, gold: 110, xp: 160, gp: 16 },
  { id: 'q_gchief', rank: 2, n: 'Голова ватажка', d: 'Ватажок гоблінів збирає армію в гаю. Зупиніть його.', type: 'kill', target: ['goblin_chief'], need: 1, gold: 200, xp: 380, gp: 34 },
  { id: 'q_orc', rank: 3, n: 'Орча загроза', d: 'Орки з табору нападають на патрулі.', type: 'kill', target: ['orc', 'orc_brute'], need: 8, gold: 160, xp: 300, gp: 24 },
  { id: 'q_tusk', rank: 3, n: 'Ікла для коваля', d: 'Коваль Назар робить з орочих іклів руків\'я.', type: 'collect', item: 'tusk', need: 5, gold: 150, xp: 260, gp: 22 },
  { id: 'q_ochief', rank: 4, n: 'Вождь орків', d: 'Повалити вождя — і табір розбіжиться.', type: 'kill', target: ['orc_chief'], need: 1, gold: 420, xp: 900, gp: 60 },
  { id: 'q_skel', rank: 4, n: 'Неспокійні мертві', d: 'У руїнах піднялися скелети. Поверніть їх у землю.', type: 'kill', target: ['skeleton', 'skeleton_ar'], need: 10, gold: 300, xp: 700, gp: 45 },
  { id: 'q_soul', rank: 5, n: 'Уламки душ', d: 'Гільдмайстер хоче вивчити уламки душ.', type: 'collect', item: 'soul', need: 4, gold: 380, xp: 800, gp: 55 },
  { id: 'q_dkob', rank: 2, n: 'Нора кобольдів', d: 'На I ярусі Підземелля кобольди розплодилися. Проріджіть їх.', type: 'kill', target: ['kobold', 'kobold_sl'], need: 8, gold: 150, xp: 280, gp: 20 },
  { id: 'q_dscale', rank: 2, n: 'Луска для броньовика', d: 'Броньовик Гільдії шиє обладунки з луски кобольдів.', type: 'collect', item: 'kscale', need: 5, gold: 140, xp: 240, gp: 18 },
  { id: 'q_dkchief', rank: 2, n: 'Вождь у печерах', d: 'Вождь кобольдів Гракх тримає I ярус. Здолайте його.', type: 'kill', target: ['kobold_chief'], need: 1, gold: 280, xp: 560, gp: 38 },
  { id: 'q_dghoul', rank: 3, n: 'Упирі склепів', d: 'II ярус кишить упирями й привидами.', type: 'kill', target: ['ghoul', 'wraith'], need: 8, gold: 320, xp: 760, gp: 42 },
  { id: 'q_dknight', rank: 4, n: 'Присяга Морена', d: 'Кістяний лицар Морен досі охороняє склепи. Звільніть його душу.', type: 'kill', target: ['bone_knight'], need: 1, gold: 650, xp: 1700, gp: 85 },
  { id: 'q_dcult', rank: 4, n: 'Культ Безодні', d: 'На III ярусі культисти й темні лицарі служать Мінотавру.', type: 'kill', target: ['cultist', 'dark_knight'], need: 10, gold: 700, xp: 2400, gp: 90 },
  { id: 'q_dboss', rank: 5, n: 'Серце лабіринту', d: 'Астерій, Мінотавр Глибин, чекає на дні Підземелля. Це найважча битва Гільдії.', type: 'kill', target: ['minotaur'], need: 1, gold: 2200, xp: 6500, gp: 280 },
  // guild contracts for the new lands
  { id: 'q_wolves', rank: 1, n: 'Нічне виття', d: 'На Вовчих пагорбах розплодилися вовкулаки.', type: 'kill', target: ['wolfling'], need: 8, gold: 110, xp: 200, gp: 14 },
  { id: 'q_drown', rank: 2, n: 'Мертві води', d: 'З Тихого озера виходять утопці. Очистьте береги.', type: 'kill', target: ['drowner', 'rusalka'], need: 8, gold: 160, xp: 320, gp: 20 },
  { id: 'q_bandits', rank: 3, n: 'Розбій на дорогах', d: 'Розбійники з Темного лісу грабують каравани.', type: 'kill', target: ['bandit', 'bandit_ar'], need: 10, gold: 240, xp: 520, gp: 32 },
  { id: 'q_swamp', rank: 4, n: 'Болотяна чума', d: 'Ящери з Гнилого болота виходять на дороги.', type: 'kill', target: ['lizard', 'bogslime'], need: 10, gold: 380, xp: 900, gp: 48 },
  { id: 'q_golems', rank: 5, n: 'Варта шахт', d: 'Кам\'яні стражі не пускають гномів у Покинуті шахти.', type: 'kill', target: ['golem', 'minerghost'], need: 8, gold: 700, xp: 2600, gp: 90 },
  // side quests from people of the world (giver = npc id; turned in to the same person)
  { id: 's_wolves', giver: 'farmer', n: 'Овечий страх', d: 'Вовкулаки щоночі ріжуть моїх овець. Відженіть шістьох.', type: 'kill', target: ['wolfling'], need: 6, gold: 90, xp: 180, gp: 6 },
  { id: 's_pelts', giver: 'farmer', n: 'Тепла зима', d: 'Принесіть чотири шкури вовкулаків — пошию кожухи дітям.', type: 'collect', item: 'pelt', need: 4, gold: 110, xp: 200, gp: 6 },
  { id: 's_alpha', giver: 'farmer', n: 'Сіре Ікло', d: 'Ватажок зграї — велетень із сивою гривою. Поки він живий, зграя не піде.', type: 'kill', target: ['wolf_alpha'], need: 1, gold: 260, xp: 600, gp: 18 },
  { id: 's_parcel', giver: 'fox', n: 'Лисяча посилка', d: 'Віднесіть мішечок прянощів фермерові Петру на Хутір Вербівка. І не заглядайте всередину!', type: 'talk', to: 'farmer', need: 1, gold: 60, xp: 120, gp: 4 },
  { id: 's_drown', giver: 'fisher', n: 'Спокійна вода', d: 'Утопці лякають рибу. Вгамуйте шістьох — і я знову закину сіті.', type: 'kill', target: ['drowner'], need: 6, gold: 130, xp: 260, gp: 8 },
  { id: 's_pearls', giver: 'fisher', n: 'Перли для нареченої', d: 'Три річкові перлини — і моя Ганна скаже «так».', type: 'collect', item: 'pearl', need: 3, gold: 160, xp: 300, gp: 8 },
  { id: 's_vodyanyk', giver: 'fisher', n: 'Господар озера', d: 'На острові живе Водяник. Ходіть бродом зі сходу — по камінню.', type: 'kill', target: ['vodyanyk'], need: 1, gold: 380, xp: 900, gp: 22 },
  { id: 's_bandits', giver: 'cat', n: 'Котячі лапи', d: 'Розбійники вкрали мою улюблену фляжку. Розженіть вісьмох — може, знайдеться.', type: 'kill', target: ['bandit', 'bandit_ar'], need: 8, gold: 200, xp: 420, gp: 10 },
  { id: 's_raven', giver: 'cat', n: 'Чорне перо', d: 'Отаман Чорний Ворон носить шолом із пір\'ям. Принесіть мені одне.', type: 'kill', target: ['raven'], need: 1, gold: 520, xp: 1300, gp: 26 },
  { id: 's_lake', giver: 'wolf', n: 'Слід до води', d: 'Перевірте, чи справді на Тихому озері співають уночі. Дійдіть до берега.', type: 'visit', zone: 'lake', need: 1, gold: 70, xp: 140, gp: 4 },
  { id: 's_scales', giver: 'wolf', n: 'Луска на щит', d: 'Мені потрібні чотири луски болотяників для нового щита.', type: 'collect', item: 'bogscale', need: 4, gold: 260, xp: 640, gp: 12 },
  { id: 's_herbs', giver: 'bunny', n: 'Трав\'яний чай', d: 'Принесіть п\'ять пучків болотяної трави — для чаю від кашлю.', type: 'collect', item: 'herb', need: 5, gold: 180, xp: 420, gp: 8 },
  { id: 's_mines', giver: 'hermit', n: 'Шепіт гір', d: 'Дійдіть до Покинутих шахт і подивіться, хто там прокинувся.', type: 'visit', zone: 'mines', need: 1, gold: 120, xp: 300, gp: 6 },
  { id: 's_witch', giver: 'hermit', n: 'Мара з болота', d: 'Відьма Мара отруює воду в болоті. Покладіть цьому край.', type: 'kill', target: ['witch'], need: 1, gold: 700, xp: 1900, gp: 30 },
  { id: 's_colossus', giver: 'hermit', n: 'Серце гори', d: 'Гранітний Колос спить у шахтах. Розбудіть — і переможіть.', type: 'kill', target: ['colossus'], need: 1, gold: 1500, xp: 6500, gp: 60 },
  { id: 's_scout_titan', giver: 'herald', n: 'Розвідка Кам\'яних Висей', d: 'Король хоче знати, чи досі спить Титан Ірмунд. Дійдіть до Кам\'яних Висей — і НЕ чіпайте його.', type: 'visit', zone: 'titan', need: 1, gold: 400, xp: 1500, gp: 15 },
  { id: 's_scout_fenrir', giver: 'herald', n: 'Сивий степ', d: 'Перевірте, де нині кочує зграя Фенріра. Дивіться здалеку.', type: 'visit', zone: 'fenrir', need: 1, gold: 400, xp: 1500, gp: 15 },
  { id: 's_scout_slimes', giver: 'herald', n: 'Драглисті топі', d: 'Пройдіться краєм Драглистих топей і подивіться, як розрослася Праматір.', type: 'visit', zone: 'slimes', need: 1, gold: 400, xp: 1500, gp: 15 },
  { id: 's_kill_titan', giver: 'herald', n: 'Королівський указ: Титан', d: 'Лише для найсильніших загонів. Переможіть Гірського Титана Ірмунда — і корона вас не забуде.', type: 'kill', target: ['titan'], need: 1, gold: 20000, xp: 80000, gp: 300 },
  { id: 's_kill_fenrir', giver: 'elfelder', n: 'Пожирач Місяця', d: 'Фенрір колись зжер наш місяць-близнюк. Коли будете готові — покладіть цьому край. Беріть друзів.', type: 'kill', target: ['fenrir'], need: 1, gold: 15000, xp: 64000, gp: 260 },
  { id: 's_elf_herbs', giver: 'elfelder', n: 'Трави для Криниці', d: 'Принесіть вісім пучків болотяної трави — Місячна Криниця слабшає.', type: 'collect', item: 'herb', need: 8, gold: 420, xp: 1200, gp: 12 },
  { id: 's_elf_moon', giver: 'elfelder', n: 'Місячні вовки', d: 'Срібні вовкулаки підходять до лісу. Переможіть п\'ятьох — але пам\'ятайте: зачепите одного — прийде вся зграя.', type: 'kill', target: ['moonwolf', 'moon_alpha'], need: 5, gold: 1400, xp: 7000, gp: 40 },
  { id: 's_dwarf_ore', giver: 'dwarfking', n: 'Руда для Кряжу', d: 'Наші копальні під Титаном. Принесіть десять шматків руди з Покинутих шахт.', type: 'collect', item: 'ore', need: 10, gold: 900, xp: 2600, gp: 20 },
  { id: 's_dwarf_guard', giver: 'dwarfking', n: 'Варта Титана', d: 'Розбийте трьох із варти Титана. Обережно: прокинеться весь Висей.', type: 'kill', target: ['titan_guard', 'stone_giant'], need: 3, gold: 1600, xp: 7500, gp: 45 },
  { id: 's_beast_pelts', giver: 'beastchief', n: 'Шкури на зиму', d: 'Принесіть шість вовчих шкур — малеча мерзне.', type: 'collect', item: 'pelt', need: 6, gold: 380, xp: 1000, gp: 10 },
  { id: 's_beast_mother', giver: 'beastchief', n: 'Праматір', d: 'Праматір Слизів ковтнула наше старе село. Помстіться за нього — коли будете дуже сильні.', type: 'kill', target: ['slime_mother'], need: 1, gold: 12000, xp: 52000, gp: 220 },
  { id: 's_fish_kid', giver: 'fishkid', n: 'Мрія Івася', d: 'Івась хоче хоч одним оком побачити Сонцеград. Розкажіть йому — тобто спершу дійдіть туди самі.', type: 'visit', zone: 'sun', need: 1, gold: 120, xp: 300, gp: 5 },
  { id: 'q_lich', rank: 5, n: 'Пан руїн', d: 'Лич править руїнами. Знищіть його філактерій.', type: 'kill', target: ['lich'], need: 1, gold: 900, xp: 2200, gp: 140 }
];

// ================= state & formulas =================
export function xpNeed(l){ return Math.round(45*Math.pow(l, 1.65)); }
export function state(){
  const S = saveGet();
  if(!S.rpg) S.rpg = { reg: false, cls: null, lvl: 1, xp: 0, gold: 40, gp: 0, rank: 0, hp: -1, mp: -1, inv: [], eq: {}, quests: [], done: {}, kills: {}, pots: { hp1: 3, mp1: 2 }, id: Math.floor(100000 + Math.random()*899999), deaths: 0, bosses: {} };
  if(!S.rpg.dun) S.rpg.dun = { max: 0, chest: false, clears: 0 };
  return S.rpg;
}
let saveT = null;
export function save(){ clearTimeout(saveT); saveT = setTimeout(() => saveCommit(), 600); }
export function saveNow(){ clearTimeout(saveT); saveCommit(); }

export function derived(P, appStats){
  const C = CLASSES[P.cls] || CLASSES.warrior;
  const st = {}; ['str', 'agi', 'int', 'vit'].forEach(k => st[k] = C.base[k] + C.grow[k]*(P.lvl - 1));
  // real-life training from the host app gives a small bonus
  (appStats || []).forEach(s => { const map = { 'Сила': 'str', 'Інтелект': 'int', 'Живучість': 'vit', 'Духовна сила': 'agi' }; const k = map[s.label]; if(k) st[k] += Math.min(10, Math.floor((s.value || 0)/3)); });
  let wAtk = 4, def = 0, hp = 0, mp = 0, crit = 0;
  Object.values(P.eq || {}).forEach(it => { if(!it) return; const pm = 1 + (it.plus || 0)*.1; if(it.atk) wAtk += it.atk*pm; if(it.def) def += it.def*pm; Object.entries(it.bonus || {}).forEach(([k, v]) => { if(st[k] != null) st[k] += v; else if(k === 'hp') hp += v; else if(k === 'mp') mp += v; else if(k === 'crit') crit += v; }); });
  const S = saveGet(); const pt = S.patron; const today = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
  const rune = S.rune && S.rune.date === today ? S.rune.id : null;
  const mods = { dmg: 1, dr: 0, xp: 1, gold: 1, loot: 1, spd: 1, crit: 0, regen: 0 };
  if(pt === 'perun' || pt === 'thor') st.str += 3; if(pt === 'veles' || pt === 'athena' || pt === 'odin') st.int += 3; if(pt === 'mokosh') st.vit += 3; if(pt === 'dazhbog' || pt === 'hermes') st.agi += 3;
  if(rune === 'fehu') mods.loot = 1.3; if(rune === 'uruz') mods.dmg = 1.12; if(rune === 'thurisaz') mods.dr = .12; if(rune === 'ansuz') mods.xp = 1.2; if(rune === 'raido') mods.spd = 1.12; if(rune === 'kenaz') mods.crit = 8; if(rune === 'gebo') mods.gold = 1.3; if(rune === 'wunjo') mods.regen = .01;
  const main = C.type === 'melee' ? (C.main === 'agi' ? st.agi*1.5 + st.str*.6 : st.str*1.7) : C.type === 'ranged' ? st.agi*1.7 : st.int*1.9;
  return { st, maxHp: Math.round(70 + st.vit*11 + P.lvl*9 + hp), maxMp: Math.round(30 + st.int*6 + P.lvl*3 + mp), atk: Math.round((wAtk + main + P.lvl*1.5)*mods.dmg), def: Math.round(def + st.vit*.7), crit: Math.min(75, 5 + st.agi*.35 + crit + mods.crit), mods, rune, C };
}
export function dmgCalc(atk, def, mult){ const raw = atk*mult; return Math.max(1, Math.round((raw*raw/(raw + def*1.4))*(.9 + Math.random()*.2))); }
export function monsterStats(def, lvl){ const k = 1 + (lvl - def.lvl[0])*.16; return { hp: Math.round(def.hp*k), atk: Math.round(def.atk*k), def: Math.round(def.def*k) }; }
export function rarityRoll(bonus){ const r = Math.random()/(bonus || 1); return r < .01 ? 4 : r < .05 ? 3 : r < .16 ? 2 : r < .42 ? 1 : 0; }
export function addItem(P, it){
  if(it.k === 'mat' || it.k === 'use'){ const ex = P.inv.find(x => x.k === it.k && x.id === it.id); if(ex){ ex.q = (ex.q || 1) + (it.q || 1); return ex; } }
  if(P.inv.length >= 40) return null;
  P.inv.push(it); return it;
}
export function countItem(P, id){ return P.inv.filter(x => x.k === 'mat' && x.id === id).reduce((a, x) => a + (x.q || 1), 0); }
export function takeItem(P, id, n){ for(const x of P.inv){ if(x.k === 'mat' && x.id === id){ const t = Math.min(n, x.q || 1); x.q = (x.q || 1) - t; n -= t; if(n <= 0) break; } } P.inv = P.inv.filter(x => !(x.k === 'mat' && (x.q || 0) <= 0)); }
export { PATRONS, RUNES };

export function questDone(P, a, Q){ if(!Q) return false; if(Q.type === 'kill') return a.prog >= Q.need; if(Q.type === 'collect') return countItem(P, Q.item) >= Q.need; return a.prog >= 1; }
