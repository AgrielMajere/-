// =====================================================================================
//  Roster: the downloaded models the player approved in the Lab, put into the world
//  by their roles (comments from the Lab): monsters & bosses, animals, statues,
//  townsfolk and adventurers, the cat companion.
// =====================================================================================
import * as RPG from './rpg.js';
import { ZONES, CITY2 } from './world.js';
import './newmodels.js';

export const ROSTER_ON = true;   // switched on after the roster is checked in-game
const Z = id => ZONES.find(z => z.id === id);
const M = RPG.MONSTERS;
const fig = (body, height) => ({ body, height });

// ---------- new looks for existing monsters ----------
if(ROSTER_ON){
M.goblin_chief.fig = fig('nm_mx_goblin', 1.6);          // «бос однієї з локацій гоблінів»
M.orc.fig = fig('nm_orc_warrior', 2.05);
M.orc_brute.fig = fig('nm_dark_orc', 2.2);
if(M.kobold) M.kobold.fig = fig('nm_kobold', 1.3);
M.titan.fig = fig('nm_stone_monster', 11);               // кам'яний велетень Кам'яних Висей
}

// ---------- new monsters ----------
const base = (o) => Object.assign({ def: 4, spd: 2.4, aggro: 10, range: 1.8, gold: [3, 10], atk_anim: ['Attack1H', 'Slash'], drops: [], eq: .08, gp: 2, respawn: 120 }, o);
const NEW = {
  deer_inf: base({ n: 'Заражений олень', lvl: [2, 4], hp: 45, atk: 7, def: 2, spd: 2.6, aggro: 8, xp: 12, fig: fig('nm_deer', 2.0), drops: [['hide', .4, 1]] }),
  forest_wolf: base({ n: 'Лісовий вовк', lvl: [6, 8], hp: 140, atk: 16, spd: 3.6, aggro: 0, xp: 30, fig: fig('nm_wolf', 1.6), drops: [['pelt', .35, 1], ['hide', .4, 1]] }),
  alpha_wolf_f: base({ n: 'Вовк-вожак', lvl: [10, 10], hp: 420, atk: 26, def: 8, spd: 3.8, aggro: 0, xp: 90, fig: fig('nm_alpha_wolf', 1.9), drops: [['pelt', 1, 2], ['fang', .05, 1]], eq: .3 }),
  ghost_wolf: base({ n: 'Примарний вовк', lvl: [12, 14], hp: 300, atk: 30, def: 10, spd: 3.9, aggro: 13, xp: 95, undead: true, fig: fig('nm_dire_wolf', 1.9), drops: [['ecto', .4, 1], ['pelt', .4, 1]], eq: .12 }),
  bear: base({ n: 'Бурий ведмідь', lvl: [9, 11], hp: 520, atk: 30, def: 12, spd: 2.8, aggro: 0, range: 2.2, xp: 110, fig: fig('nm_bear', 2.2), drops: [['hide', 1, 2]], eq: .15 }),
  rabbit: base({ n: 'Кролик', lvl: [1, 1], hp: 8, atk: 1, def: 0, spd: 3.2, aggro: 0, xp: 2, gold: [0, 1], fig: fig('nm_rabbit', .45), drops: [['hide', .15, 1]], eq: 0 }),
  fox: base({ n: 'Лис', lvl: [2, 2], hp: 20, atk: 3, def: 0, spd: 3.4, aggro: 0, xp: 4, gold: [0, 2], fig: fig('nm_fox', .9), drops: [['hide', .3, 1]], eq: 0 }),
  crow: base({ n: 'Ворона', lvl: [1, 2], hp: 10, atk: 2, def: 0, spd: 3, aggro: 0, xp: 3, gold: [0, 1], fig: fig('nm_crow', .55), drops: [], eq: 0 }),
  hobgoblin: base({ n: 'Хобгоблін', lvl: [7, 9], hp: 190, atk: 22, def: 7, aggro: 13, range: 10, ranged: { color: '#c86aff', speed: 15 }, xp: 50, fig: fig('nm_orc_shaman', 1.8), drops: [['totem', .5, 1], ['ear', .5, 1]], eq: .15, atk_anim: ['Cast'] }),
  zombie: base({ n: 'Зомбі-в\'язень', lvl: [14, 16], hp: 380, atk: 30, def: 10, spd: 1.6, xp: 90, undead: true, fig: fig('nm_mx_prisoner', 1.8), drops: [['bone', .5, 1], ['herb', .3, 1]] }),
  zombie_s: base({ n: 'Зомбі-волоцюга', lvl: [14, 16], hp: 400, atk: 28, def: 11, spd: 1.6, xp: 92, undead: true, fig: fig('nm_mx_survivor', 1.8), drops: [['bone', .5, 1], ['badge', .3, 1]] }),
  zombie_g: base({ n: 'Зомбі-утопленниця', lvl: [14, 16], hp: 360, atk: 31, def: 9, spd: 1.7, xp: 90, undead: true, fig: fig('nm_mx_zombiegirl', 1.7), drops: [['bone', .5, 1], ['pearl', .1, 1]] }),
  ghoul: base({ n: 'Гуль', lvl: [16, 18], hp: 520, atk: 38, def: 12, spd: 3.2, aggro: 14, xp: 130, undead: true, fig: fig('nm_mx_ch30', 2.0), drops: [['nail', .5, 1], ['ecto', .3, 1]], eq: .15 }),
  golem: base({ n: 'Кам\'яний голем', lvl: [28, 30], hp: 2400, atk: 90, def: 40, spd: 1.8, range: 2.6, xp: 600, fig: fig('nm_golem', 2.8), drops: [['ore', .6, 2], ['iron', .8, 3]], eq: .2, eqRar: 2 }),
  // bosses (roles from the Lab comments)
  demon_s: base({ n: 'Малий демон', boss: true, lvl: [16, 16], hp: 4200, atk: 55, def: 16, spd: 2.8, aggro: 13, range: 2.2, xp: 900, gold: [150, 240], fig: fig('nm_mx_demon', 2.3), drops: [['soul', 1, 2], ['sigil', 1, 2]], eq: 1, eqRar: 2, gp: 40, respawn: 300, enrage: .35 }),
  wendigo: base({ n: 'Вендіго', boss: true, lvl: [18, 18], hp: 5200, atk: 62, def: 18, spd: 3.4, aggro: 14, range: 2.2, xp: 1200, gold: [180, 280], undead: true, fig: fig('nm_mx_warzombie', 2.3), drops: [['pelt', 1, 3], ['soul', 1, 2]], eq: 1, eqRar: 2, gp: 50, respawn: 360, enrage: .35 }),
  sorcerer: base({ n: 'Чаклунка Найтшейд', boss: true, lvl: [20, 20], hp: 4800, atk: 70, def: 14, spd: 2.4, aggro: 16, range: 12, ranged: { color: '#b46aff', speed: 18 }, xp: 1400, gold: [200, 300], fig: fig('nm_mx_nightshade', 1.9), atk_anim: ['Cast', 'CastLong'], drops: [['soul', 1, 2], ['mstaff', .2, 1]], eq: 1, eqRar: 3, gp: 55, respawn: 360 }),
  alien: base({ n: 'Прибулець', boss: true, lvl: [18, 18], hp: 5600, atk: 60, def: 16, spd: 3.6, aggro: 14, range: 2.4, xp: 1300, gold: [180, 280], fig: fig('nm_wraith', 2.6), drops: [['ecto', 1, 3], ['moonstone', .6, 1]], eq: 1, eqRar: 2, gp: 50, respawn: 360 }),
  parasite: base({ n: 'Паразит', boss: true, lvl: [20, 20], hp: 6200, atk: 66, def: 18, spd: 2.6, aggro: 14, range: 2.2, xp: 1500, gold: [220, 320], undead: true, fig: fig('nm_mx_parasite', 2.2), drops: [['venom', 1, 3], ['soul', 1, 2]], eq: 1, eqRar: 3, gp: 60, respawn: 420 }),
  skel_mutant: base({ n: 'Кістяний мутант', boss: true, lvl: [24, 24], hp: 9000, atk: 82, def: 24, spd: 2.6, aggro: 15, range: 2.4, xp: 2200, gold: [300, 420], undead: true, fig: fig('nm_mx_skelzombie', 2.5), drops: [['bone', 1, 5], ['soul', 1, 3]], eq: 1, eqRar: 3, gp: 70, respawn: 480, enrage: .3 }),
  maw: base({ n: 'Пащека', boss: true, lvl: [26, 26], hp: 11000, atk: 95, def: 26, spd: 2.8, aggro: 15, range: 3, xp: 2800, gold: [350, 500], fig: fig('nm_mx_maw', 3.0), drops: [['soul', 1, 4], ['gcore', .1, 1]], eq: 1, eqRar: 3, gp: 80, respawn: 540, enrage: .3, slam: { r: 7, tele: 1.3, cd: 9, mult: 1.8 } }),
  mutant: base({ n: 'Мутант-велетень', boss: true, lvl: [32, 32], hp: 26000, atk: 130, def: 34, spd: 2.6, aggro: 16, range: 3.2, xp: 6000, gold: [800, 1200], fig: fig('nm_mx_mutant', 3.6), drops: [['gcore', .5, 1], ['soul', 1, 5]], eq: 1, eqRar: 3, gp: 150, respawn: 600, enrage: .3, adds: { at: .6, type: 'ghoul' }, slam: { r: 9, tele: 1.4, cd: 8, mult: 2 } }),
  gravok: base({ n: 'Гравок, Генерал Повелителя Темряви', boss: true, lvl: [36, 36], hp: 34000, atk: 150, def: 42, spd: 2.8, aggro: 16, range: 2.8, xp: 9000, gold: [1200, 1800], fig: fig('nm_gravok', 2.6), atk_anim: ['Attack2H', 'Slice2H', 'Spin'], drops: [['dsteel', 1, 4], ['soul', 1, 5]], eq: 1, eqRar: 4, gp: 220, respawn: 720, enrage: .3, charge: { len: 16, w: 3, tele: 1, cd: 10, mult: 2 } }),
  dragon: base({ n: 'Демонічний Змій', boss: true, calamity: true, lvl: [48, 48], hp: 140000, atk: 250, def: 60, spd: 3.4, aggro: 0, range: 5, xp: 55000, gold: [7000, 10000], fig: fig('nm_demon_dragon', 9), drops: [['gcore', 1, 2], ['soul', 1, 10]], eq: 1, eqRar: 4, gp: 1200, respawn: 900, enrage: .3, slam: { r: 14, tele: 1.6, cd: 8, mult: 2.2 } })
};
Object.entries(NEW).forEach(([k, v]) => { if(!M[k]) M[k] = v; });

// ---------- spawns (deterministic: everyone gets the same list) ----------
export function rosterSpawns(spawns){
  if(!ROSTER_ON) return;
  let seed = 4242; const R = () => { seed = (seed*16807) % 2147483647; return (seed - 1)/2147483646; };
  const ring = (zid, type, n, r0, r1, extra) => { const Zn = Z(zid); if(!Zn) return; for(let i = 0; i < n; i++){ const a = R()*6.283, d = (r0 + R()*(r1 - r0))*Zn.r; spawns.push(Object.assign({ type, x: Zn.x + Math.cos(a)*d, z: Zn.z + Math.sin(a)*d, wander: 6 }, extra || {})); } };
  const at = (zid, type, dx, dz, extra) => { const Zn = Z(zid); if(Zn) spawns.push(Object.assign({ type, x: Zn.x + dx, z: Zn.z + dz, wander: 3 }, extra || {})); };
  ring('meadow', 'deer_inf', 3, .5, .9); ring('grove', 'deer_inf', 2, .6, .95);
  ring('meadow', 'rabbit', 3, .5, 1, { passive: true }); ring('farm', 'rabbit', 2, .5, .95, { passive: true }); ring('farm', 'fox', 1, .6, .9, { passive: true, wander: 0 }); ring('grove', 'fox', 1, .7, 1, { passive: true, wander: 0 });   // the fox only has a lying/waking-up clip: it rests in place
  ring('ruins', 'crow', 2, .6, 1, { passive: true });
  ring('darkwood', 'forest_wolf', 4, .3, .8, { passive: true }); at('darkwood', 'alpha_wolf_f', 18, -10, { passive: true }); ring('darkwood', 'bear', 2, .4, .85, { passive: true });
  ring('heath', 'ghost_wolf', 3, .3, .8); ring('grove', 'hobgoblin', 2, .5, .85);
  ring('swamp', 'zombie', 2, .3, .8); ring('swamp', 'zombie_s', 2, .3, .8); ring('swamp', 'zombie_g', 2, .3, .8); ring('swamp', 'ghoul', 2, .4, .8);
  ring('mines', 'golem', 2, .4, .8);
  at('ruins', 'demon_s', -20, -18); at('heath', 'wendigo', 22, -24); at('darkwood', 'sorcerer', -30, 26); at('swamp', 'alien', 26, -18);
  at('swamp', 'parasite', -24, 22); at('swamp', 'skel_mutant', 6, 30); at('darkwood', 'maw', 34, 30); at('mines', 'mutant', 22, 18); at('mines', 'gravok', -18, -20);
  at('titan', 'dragon', -60, 55, { wander: 6 });
}

// ---------- statues & static figures ----------
export const STATUES = [
  { body: 'nm_bishop', h: 2.6, place: 'shrine', dx: -8, dz: 6, yaw: 2.4, name: 'Загадкова статуя' },
  { body: 'nm_lich_king', h: 2.8, building: 'temple', side: -1, yaw: 0 },
  { body: 'nm_lich_king', h: 2.8, building: 'temple', side: 1, yaw: 0 },
  { body: 'nm_minotaur_boss', h: 3.4, building: 'arena', side: -1.6, yaw: 0 },
  { body: 'nm_mermaid', h: 2.0, place: 'lake', dx: -10, dz: -4, yaw: .8, name: 'Русалка' }
];

// ---------- townsfolk & adventurers ----------
const T = (id, body, h, name, lines, where) => Object.assign({ id, body, height: h, name, lines }, where);
const town = r => ({ area: [0, 0, r || 30] }), cap = r => ({ area: [CITY2.x, CITY2.z, r || 45] });
export function rosterNpcs(){
  if(!ROSTER_ON) return [];
  const ZB = Z('beasts'), ZD = Z('dwarves'), ZS = Z('shrine');
  return [
    T('r_akai', 'nm_mx_akai', 1.75, 'Слідопитка Акай', ['Тіні — мій дім.', 'На Вовчих пагорбах з\'явились примарні вовки. Будь обережний.'], town(26)),
    T('r_arissa', 'nm_mx_arissa', 1.72, 'Найманка Арісса', ['Плати — і я піду з тобою хоч до Мінотавра.', 'Чула, у болоті бачили щось нелюдське.'], town(28)),
    T('r_brute', 'nm_mx_brute', 2.0, 'Здоровань Бойко', ['Хто тут найсильніший? Я!', 'Ведмідь у Темному лісі мене подряпав. Ха!'], town(24)),
    T('r_ch05', 'nm_mx_ch05', 1.85, 'Ветеран Северин', ['Я бачив Катастрофу на власні очі.', 'Навчися блокувати. Це рятує життя.'], town(22)),
    T('r_dreyar', 'nm_mx_dreyar', 1.85, 'Лицар Дреяр', ['Честь — понад усе.', 'Генерал Гравок збирає військо в шахтах.'], cap(40)),
    T('r_erika', 'nm_mx_erika', 1.72, 'Лучниця Еріка', ['Стріла летить туди, куди дивиться серце.', 'Ельфи продають чудові луки. Але спершу — заслужи їхню повагу.'], town(30)),
    T('r_eve', 'nm_mx_eve', 1.72, 'Мандрівниця Єва', ['Я обійшла пів світу. Наступна — Сонцеград!'], cap(45)),
    T('r_ganfaul', 'nm_mx_ganfaul', 1.9, 'Мечник Ганфаул', ['Мій меч пам\'ятає тисячу битв.', 'Пащека в Темному лісі… навіть я тікав.'], town(26)),
    T('r_heraklios', 'nm_mx_heraklios', 1.85, 'Мандрівний лікар Гераклій', ['Зомбі на болоті — це не прокляття. Це хвороба.', 'Хтось ставить там досліди…'], town(30)),
    T('r_kachujin', 'nm_mx_kachujin', 1.72, 'Мечниця Качуджин', ['Швидкість — це сила.'], cap(40)),
    T('r_maria', 'nm_mx_maria', 1.75, 'Воїтелька Марія', ['Сонцеград не впаде, поки я жива!'], cap(42)),
    T('r_maria2', 'nm_mx_maria_w', 1.75, 'Варта Сонцеграда Марічка', ['Проходьте, мандрівнику.'], cap(36)),
    T('r_medea', 'nm_mx_medea', 1.72, 'Відьма Медея', ['Зілля, привороти, прокляття — дорого.', 'Не довіряй Чаклунці з Темного лісу.'], town(28)),
    T('r_paladin', 'nm_mx_paladin', 1.9, 'Паладин Остромир', ['Світло веде мене.', 'Нежить на болоті росте. Треба діяти.'], cap(44)),
    T('r_uriel', 'nm_mx_uriel', 1.95, 'Уріель Золотий', ['Я служу королю й світлу.'], cap(30)),
    T('r_monk', 'nm_monk', 1.8, 'Монах Тихомир', ['Тиша — найкраща відповідь.'], { at: [ZS.x + 6, ZS.z + 4], face: 3.6 }),
    T('r_peasant_f', 'nm_mx_peasant_f', 1.66, 'Селянка Оксана', ['Купіть яблучка!', 'Коли кривавий місяць — гобліни лізуть на хутір.'], town(32)),
    T('r_peasant_m', 'nm_mx_peasant_m', 1.7, 'Селянин Панас', ['Ох, спина болить…', 'Дощ буде — риба клюватиме!'], town(32)),
    T('r_peasant_m2', 'nm_mx_peasant_m', 1.7, 'Дід Іван', ['У мої часи вовки були менші.'], cap(50)),
    T('r_chiya', 'nm_chiya', 1.65, 'Чія з Пагорбів', ['Ти пахнеш містом!', 'Вожак зграї — мій дядько.'], { at: [ZB.x + 5, ZB.z - 3], face: 2.4 }),
    T('r_rabbitman', 'nm_rabbitman', 1.7, 'Зайцелюд Тупотун', ['Тупу-тупу! Я найшвидший у Пагорбах!'], { at: [ZB.x + 2, ZB.z + 7], face: 3.0 }),
    T('r_kobold2', 'nm_kobold2', 1.4, 'Кобольдиха Ліска', ['Я не така, як ті кобольди в підземеллі!'], { at: [ZB.x - 6, ZB.z + 4], face: 1.2 }),
    T('r_dwarf', 'nm_dwarf', 1.4, 'Гном-вартовий Барін', ['Залізний Кряж стоїть тисячу років!'], { area: [ZD.x, ZD.z, 16] }),
    T('r_cursed', 'nm_dark_wraith', 3.2, 'Проклятий мечник', ['…Я не ворог тобі. Прокляття тримає мене тут.', 'Колись мене зрадив той, кому я вірив найбільше.', 'Може, колись ти допоможеш мені звільнитися.'], { at: [ZS.x - 14, ZS.z - 8], face: .6, stat: false, statue: true })
  ];
}
// existing NPCs that get a new body
export const NPC_BODIES = { merchant: ['nm_oldwizard', 1.8], merchant2: ['nm_oldwizard', 1.8], stroller1: ['nm_mx_peasant_m', 1.7], cz1: ['nm_mx_peasant_f', 1.66] };
export function patchNpcs(list){ if(!ROSTER_ON) return list; list.forEach(d => { const b = NPC_BODIES[d.id]; if(b){ d.body = b[0]; d.height = b[1]; d.gear = {}; d.look = {}; } }); return list; }
