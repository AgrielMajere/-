// =====================================================================================
//  Data for the living-world systems (life.js): materials, fish, gathering nodes,
//  recipes, settlement shops, reputation, achievements, daily errands, NPC dialogues.
// =====================================================================================

// ---------- new materials (merged into RPG.MATERIALS at start) ----------
export const LIFE_MATS = {
  chamomile: { n: 'Цілюща ромашка', i: '🌼', price: 6 }, cornflower: { n: 'Синя волошка', i: '💠', price: 8 }, mushroom: { n: 'Лісовий гриб', i: '🍄', price: 7 },
  mandrake: { n: 'Корінь мандрагори', i: '🥕', price: 22 }, iron: { n: 'Залізна руда', i: '⛰️', price: 10 }, silver: { n: 'Срібна руда', i: '🥈', price: 24 },
  moonstone: { n: 'Місячний камінь', i: '🌙', price: 55 },
  // fish
  roach: { n: 'Плітка', i: '🐟', price: 5 }, perch: { n: 'Окунь', i: '🐠', price: 8 }, carp: { n: 'Короп', i: '🐟', price: 12 }, pike: { n: 'Щука', i: '🐊', price: 20 },
  catfish: { n: 'Сом', i: '🐋', price: 34 }, eel: { n: 'Нічний вугор', i: '🐛', price: 28 }, goldfish: { n: 'Золота рибка', i: '✨', price: 150 }, boot: { n: 'Старий чобіт', i: '🥾', price: 1 }
};
// fish table: [id, weight, needs]  needs: night | rain | rare
export const FISH = [['roach', 34], ['perch', 26], ['carp', 16], ['pike', 9], ['catfish', 5, 'night'], ['eel', 6, 'night'], ['goldfish', .8, 'rare'], ['boot', 5]];

// ---------- gathering nodes ----------
// kind -> look + loot; spots are generated around zones with a fixed seed so every player sees the same world
export const NODE_KINDS = {
  herb: { n: 'Цілющі трави', loot: [['chamomile', 1, 2], ['cornflower', .5, 1], ['mushroom', .25, 1]], color: '#8fe07a', respawn: 240 },
  shroom: { n: 'Грибна галявина', loot: [['mushroom', 1, 2], ['mandrake', .18, 1]], color: '#e0b07a', respawn: 300 },
  iron: { n: 'Рудна жила', loot: [['iron', 1, 2], ['silver', .25, 1]], color: '#c8a070', respawn: 300 },
  silver: { n: 'Срібна жила', loot: [['silver', 1, 2], ['moonstone', .15, 1]], color: '#d8e0f0', respawn: 420 },
  moon: { n: 'Місячний кристал', loot: [['moonstone', 1, 1]], color: '#9ab8ff', respawn: 600 }
};
// zone id -> [[kind, count], ...]
export const NODE_ZONES = {
  meadow: [['herb', 7]], grove: [['herb', 4], ['shroom', 4]], darkwood: [['shroom', 6], ['herb', 3]], heath: [['herb', 4], ['iron', 3]],
  mines: [['iron', 6], ['silver', 4], ['moon', 1]], swamp: [['shroom', 4], ['herb', 3]], lake: [['herb', 3]], ruins: [['silver', 2], ['moon', 1]],
  elves: [['herb', 5]], dwarves: [['iron', 5], ['silver', 3]], beasts: [['herb', 4], ['shroom', 2]], farm: [['herb', 3]]
};

// ---------- crafting ----------
// out: { k:'use'|'mat'|'eq'|'buff', ... }   need: [[matId, qty], ...]   station: alchemy | forge | cook
export const RECIPES = [
  { id: 'r_hp1', n: 'Мале зілля здоров\'я', st: 'alchemy', need: [['chamomile', 2]], out: { k: 'use', id: 'hp1', q: 2 } },
  { id: 'r_hp2', n: 'Зілля здоров\'я', st: 'alchemy', need: [['chamomile', 3], ['mushroom', 1]], out: { k: 'use', id: 'hp2', q: 1 } },
  { id: 'r_hp3', n: 'Велике зілля здоров\'я', st: 'alchemy', need: [['chamomile', 3], ['mandrake', 1], ['jelly', 2]], out: { k: 'use', id: 'hp3', q: 1 } },
  { id: 'r_mp1', n: 'Мале зілля мани', st: 'alchemy', need: [['cornflower', 2]], out: { k: 'use', id: 'mp1', q: 2 } },
  { id: 'r_mp2', n: 'Зілля мани', st: 'alchemy', need: [['cornflower', 3], ['moonstone', 1]], out: { k: 'use', id: 'mp2', q: 2 } },
  { id: 'r_rage', n: 'Відвар люті (+15% шкоди, 5 хв)', st: 'alchemy', need: [['mandrake', 1], ['tusk', 1]], out: { k: 'buff', id: 'rage', dur: 300, buff: { atk: .15 }, i: '🔥' } },
  { id: 'r_skin', n: 'Кам\'яна шкіра (−15% шкоди, 5 хв)', st: 'alchemy', need: [['iron', 2], ['mushroom', 2]], out: { k: 'buff', id: 'skin', dur: 300, buff: { dr: .15 }, i: '⛰️' } },
  { id: 'r_soup', n: 'Рибна юшка (лікує поступово)', st: 'cook', need: [['roach', 2], ['mushroom', 1]], out: { k: 'buff', id: 'soup', dur: 120, regen: .012, i: '🍲' } },
  { id: 'r_pike', n: 'Запечена щука (+10% криту, 5 хв)', st: 'cook', need: [['pike', 1], ['chamomile', 1]], out: { k: 'buff', id: 'pike', dur: 300, buff: { crit: 10 }, i: '🍽️' } },
  { id: 'r_ring', n: 'Срібна обручка', st: 'forge', need: [['silver', 3], ['pearl', 1]], out: { k: 'eq', kind: 'ring', tier: 2, rar: 2 } },
  { id: 'r_amulet', n: 'Місячний амулет', st: 'forge', need: [['moonstone', 2], ['silver', 2]], out: { k: 'eq', kind: 'amulet', tier: 3, rar: 2 } },
  { id: 'r_helm', n: 'Залізний шолом', st: 'forge', need: [['iron', 6], ['hide', 2]], out: { k: 'eq', kind: 'helm', tier: 1, rar: 1 } },
  { id: 'r_armor', n: 'Кольчуга з кряжевого заліза', st: 'forge', need: [['iron', 10], ['silver', 2], ['hide', 3]], out: { k: 'eq', kind: 'armor', tier: 2, rar: 1 } },
  { id: 'r_wpn', n: 'Зброя твого класу з руди', st: 'forge', need: [['iron', 8], ['silver', 3]], out: { k: 'eq', kind: 'weapon', tier: 2, rar: 2 } }
];

// ---------- reputation ----------
export const FACTIONS = { elves: { n: 'Ельфи Лісової Гавані', i: '🧝', zone: 'elves' }, dwarves: { n: 'Гноми Залізного Кряжу', i: '⛏️', zone: 'dwarves' }, beasts: { n: 'Звіролюди Пухнастих Пагорбів', i: '🐾', zone: 'beasts' } };
export const REP_TIERS = [[0, 'Чужинець', 0], [100, 'Знайомий', .05], [300, 'Друг', .1], [700, 'Шанований', .15], [1500, 'Герой народу', .2]];

// ---------- settlement shops ----------
// unique goods; rep: tier index needed. eq goods carry fixed bonuses
export const SHOPS = {
  elves: { n: 'Лавка Аеліона · Лісова Гавань', faction: 'elves', goods: [
    { n: 'Ельфійський лук Світанку', i: '🏹', kind: 'bow', tier: 2, rar: 2, bonus: { agi: 8, crit: 4 }, price: 520, rep: 1 },
    { n: 'Плащ лісового слідопита', i: '🧥', kind: 'armor', tier: 2, rar: 2, bonus: { agi: 6 }, price: 480, rep: 1 },
    { n: 'Лук Сріблястого Місяця', i: '🌙', kind: 'bow', tier: 3, rar: 3, bonus: { agi: 14, crit: 8 }, price: 1600, rep: 3 },
    { n: 'Посох зі Світлого Ясена', i: '✨', kind: 'staff', tier: 3, rar: 3, bonus: { int: 14, mp: 60 }, price: 1600, rep: 3 },
    { mat: 'cornflower', q: 5, price: 45 }, { mat: 'chamomile', q: 5, price: 32 } ] },
  dwarves: { n: 'Кузня Двадіна · Залізний Кряж', faction: 'dwarves', goods: [
    { n: 'Сокира з гномської сталі', i: '⚒️', kind: 'axe2', tier: 2, rar: 2, bonus: { str: 8 }, price: 560, rep: 1 },
    { n: 'Гномський щит-брама', i: '🛡️', kind: 'shield', tier: 2, rar: 2, bonus: { vit: 8, hp: 80 }, price: 520, rep: 1 },
    { n: 'Лати Залізнобородих', i: '🎽', kind: 'armor', tier: 3, rar: 3, bonus: { vit: 14, hp: 160 }, price: 1700, rep: 3 },
    { n: 'Молот Предків', i: '🔨', kind: 'mace', tier: 3, rar: 3, bonus: { str: 12, vit: 6 }, price: 1700, rep: 3 },
    { mat: 'iron', q: 5, price: 60 }, { mat: 'silver', q: 2, price: 70 } ] },
  beasts: { n: 'Міняйло Фіра · Пухнасті Пагорби', faction: 'beasts', goods: [
    { n: 'Хутряна куртка зграї', i: '🧶', kind: 'armor', tier: 2, rar: 2, bonus: { vit: 6, agi: 4 }, price: 460, rep: 1 },
    { n: 'Кігті вовкулака', i: '🐾', kind: 'dagger', tier: 2, rar: 2, bonus: { agi: 8, crit: 5 }, price: 520, rep: 1 },
    { n: 'Амулет Зграї', i: '🐺', kind: 'amulet', tier: 3, rar: 3, bonus: { str: 6, agi: 6, vit: 6 }, price: 1500, rep: 3 },
    { n: 'Хутряний каптур', i: '🦊', kind: 'helm', tier: 2, rar: 2, bonus: { vit: 5, agi: 3 }, price: 380, rep: 2 },
    { mat: 'mushroom', q: 5, price: 40 }, { mat: 'hide', q: 2, price: 30 } ] },
  fishing: { n: 'Рибачка Ганна · Поріччя', goods: [
    { use: 'hp1', price: 14 }, { mat: 'roach', q: 3, price: 18 }, { mat: 'mushroom', q: 2, price: 16 },
    { n: 'Вудка з ліщини', i: '🎣', kind: 'rod', rod: 1, price: 120 }, { n: 'Вудка майстра', i: '🎣', kind: 'rod', rod: 2, price: 650 } ] }
};

// ---------- achievements ----------
// c(L, P) -> progress number; goal; reward
export const ACHIEVEMENTS = [
  { id: 'kill1', n: 'Перша кров', d: 'Перемогти будь-якого монстра', c: (L, P) => tot(P.kills), goal: 1, gold: 20 },
  { id: 'kill100', n: 'Мисливець', d: 'Перемогти 100 монстрів', c: (L, P) => tot(P.kills), goal: 100, gold: 300 },
  { id: 'kill500', n: 'Гроза Диких земель', d: 'Перемогти 500 монстрів', c: (L, P) => tot(P.kills), goal: 500, gold: 1200, sparks: 5 },
  { id: 'boss1', n: 'Боссобій', d: 'Перемогти будь-якого боса', c: (L, P) => tot(P.bosses), goal: 1, gold: 150 },
  { id: 'boss5', n: 'Легенда Гільдії', d: 'Перемогти 5 різних босів', c: (L, P) => Object.keys(P.bosses || {}).length, goal: 5, gold: 1500, sparks: 10 },
  { id: 'lvl10', n: 'Досвідчений', d: 'Досягти 10 рівня', c: (L, P) => P.lvl, goal: 10, gold: 200 },
  { id: 'lvl25', n: 'Ветеран', d: 'Досягти 25 рівня', c: (L, P) => P.lvl, goal: 25, gold: 1000, sparks: 5 },
  { id: 'rich', n: 'Скарбничий', d: 'Мати 5000 золотих', c: (L, P) => P.gold, goal: 5000, sparks: 3 },
  { id: 'fish1', n: 'Перший улов', d: 'Впіймати рибу', c: L => L.fish, goal: 1, gold: 15 },
  { id: 'fish50', n: 'Рибалка Остапового рівня', d: 'Впіймати 50 риб', c: L => L.fish, goal: 50, gold: 400 },
  { id: 'goldfish', n: 'Три бажання', d: 'Впіймати золоту рибку', c: L => L.goldfish || 0, goal: 1, sparks: 5 },
  { id: 'herb30', n: 'Травниця', d: 'Зібрати 30 рослин', c: L => L.herbs, goal: 30, gold: 200 },
  { id: 'ore30', n: 'Рудокоп', d: 'Добути 30 руди', c: L => L.ores, goal: 30, gold: 250 },
  { id: 'craft10', n: 'Майстер на всі руки', d: 'Створити 10 речей', c: L => L.crafted, goal: 10, gold: 250 },
  { id: 'roll50', n: 'Акробат', d: 'Ухилитися перекатом 50 разів', c: L => L.rolls, goal: 50, gold: 120 },
  { id: 'perfect', n: 'Залізна стіна', d: 'Ідеально заблокувати 20 ударів', c: L => L.perfect, goal: 20, gold: 250 },
  { id: 'daily10', n: 'Надійний', d: 'Виконати 10 щоденних доручень', c: L => L.dailyDone || 0, goal: 10, gold: 500, sparks: 3 },
  { id: 'moon', n: 'Під кривавим місяцем', d: 'Перемогти 10 монстрів під час Кривавого місяця', c: L => L.moonKills || 0, goal: 10, gold: 300 },
  { id: 'raid', n: 'Захисник Вербівки', d: 'Відбити набіг на хутір', c: L => L.raids || 0, goal: 1, gold: 300 },
  { id: 'friend', n: 'Друг ельфів', d: 'Стати Другом ельфів', c: L => L.rep.elves, goal: 300, gold: 200 },
  { id: 'friend2', n: 'Побратим гномів', d: 'Стати Другом гномів', c: L => L.rep.dwarves, goal: 300, gold: 200 },
  { id: 'friend3', n: 'Свій у зграї', d: 'Стати Другом звіролюдей', c: L => L.rep.beasts, goal: 300, gold: 200 },
  { id: 'party', n: 'Разом сильніші', d: 'Перемогти 20 монстрів у загоні', c: L => L.partyKills || 0, goal: 20, gold: 300 },
  { id: 'swim', n: 'Мокрий до нитки', d: 'Пропливти 200 метрів', c: L => Math.floor(L.swum || 0), goal: 200, gold: 100 },
  { id: 'ride', n: 'Вершник', d: 'Проїхати верхи 3 км', c: L => Math.floor(L.ridden || 0), goal: 3000, gold: 200 },
  { id: 'inside', n: 'Завсідник', d: 'Побувати в таверні, тронній залі та гномському царстві', c: L => Object.keys(L.visited || {}).length, goal: 3, gold: 200 },
  { id: 'talk', n: 'Душа компанії', d: 'Поговорити з 10 різними мешканцями', c: L => Object.keys(L.talked || {}).length, goal: 10, gold: 150 },
  { id: 'beast25', n: 'Дослідник', d: 'Відкрити 25 записів бестіарію', c: (L, P) => Object.keys(P.kills || {}).length, goal: 25, gold: 600, sparks: 5 }
];
function tot(o){ let s = 0; for(const k in (o || {})) s += o[k]; return s; }

// ---------- daily errands ----------
// type kill: target monster types; gather: mat ids; fish; visit zone; deliver: talk to npc
export const DAILY_POOL = [
  { id: 'd_slime', n: 'Розчистити Луг', d: 'Перемогти 8 слизів', type: 'kill', target: ['slime', 'slime_b'], need: 8, gold: 60, xp: 80, lvl: 1 },
  { id: 'd_gob', n: 'Гоблінська напасть', d: 'Перемогти 8 гоблінів', type: 'kill', target: ['goblin', 'goblin_sh'], need: 8, gold: 120, xp: 200, lvl: 4 },
  { id: 'd_wolf', n: 'Вовки біля хутора', d: 'Перемогти 6 вовкулаків', type: 'kill', target: ['wolfling'], need: 6, gold: 160, xp: 300, lvl: 7, rep: ['beasts', 25] },
  { id: 'd_orc', n: 'Розвідка табору', d: 'Перемогти 6 орків', type: 'kill', target: ['orc', 'orc_brute'], need: 6, gold: 220, xp: 420, lvl: 8 },
  { id: 'd_skel', n: 'Спокій мертвим', d: 'Перемогти 6 скелетів', type: 'kill', target: ['skeleton', 'skeleton_ar'], need: 6, gold: 280, xp: 600, lvl: 12 },
  { id: 'd_herb', n: 'Трави для Оранти', d: 'Зібрати 6 цілющих ромашок', type: 'gather', item: 'chamomile', need: 6, gold: 70, xp: 90, lvl: 1, rep: ['elves', 20] },
  { id: 'd_shroom', n: 'Гриби для таверни', d: 'Зібрати 5 грибів', type: 'gather', item: 'mushroom', need: 5, gold: 70, xp: 90, lvl: 1 },
  { id: 'd_ore', n: 'Руда для Назара', d: 'Добути 6 залізної руди', type: 'gather', item: 'iron', need: 6, gold: 110, xp: 150, lvl: 3, rep: ['dwarves', 25] },
  { id: 'd_fish', n: 'Улов для Ганни', d: 'Впіймати 5 риб', type: 'fish', need: 5, gold: 80, xp: 100, lvl: 1 },
  { id: 'd_pike', n: 'Царська щука', d: 'Впіймати щуку', type: 'fishid', item: 'pike', need: 1, gold: 150, xp: 160, lvl: 1 },
  { id: 'd_elf', n: 'Вісті для ельфів', d: 'Дійти до Лісової Гавані', type: 'visit', zone: 'elves', need: 1, gold: 120, xp: 180, lvl: 5, rep: ['elves', 40] },
  { id: 'd_dwarf', n: 'Лист Тану Бруні', d: 'Дійти до Залізного Кряжу', type: 'visit', zone: 'dwarves', need: 1, gold: 120, xp: 180, lvl: 5, rep: ['dwarves', 40] },
  { id: 'd_beast', n: 'Подарунок зграї', d: 'Дійти до Пухнастих Пагорбів', type: 'visit', zone: 'beasts', need: 1, gold: 120, xp: 180, lvl: 5, rep: ['beasts', 40] },
  { id: 'd_craft', n: 'Ремісниче замовлення', d: 'Створити 2 речі', type: 'craft', need: 2, gold: 90, xp: 120, lvl: 1 }
];

// ---------- dialogues ----------
// node: { t: text, a: [ { t, go?, fx? } ] }  fx: { rep:[f,n], gold, item:{k,id,q}, open:'shop'|'forge'|'tavern'|'guild', hint, mark }
// 'end' closes. each npc dialog starts at node 's'.
export const DIALOGS = {
  receptionist: { s: { t: 'Вітаю в Гільдії авантюристів! Чим можу допомогти?', a: [
      { t: 'Розкажи про ранги.', go: 'ranks' }, { t: 'Де заробити перші гроші?', go: 'money' }, { t: 'Відкрий мені Гільдію.', fx: { open: 'guild' } }, { t: 'Бувай.', go: 'end' }] },
    ranks: { t: 'Від F до S. Виконуйте завдання з дошки — і ранг росте. Вищий ранг відкриває кращі товари й глибші яруси Підземелля.', a: [{ t: 'Зрозуміло.', go: 's' }] },
    money: { t: 'Слизи на Лугу за Південною брамою — найпростіший заробіток. А ще Рибачка Ганна купує рибу, а Оранта платить за трави. Щодня з\'являються нові доручення — гляньте в книзі пригод 📖.', a: [{ t: 'Дякую!', go: 's' }] } },
  master: { s: { t: 'Гм. Ще один охочий до слави?', a: [{ t: 'Я хочу стати сильнішим.', go: 'tip' }, { t: 'Що за чутки про Мінотавра?', go: 'mino' }, { t: 'Піду.', go: 'end' }] },
    tip: { t: 'Сила — це не лише удар. Навчіться ухилятися перекатом (R) і тримати блок (F). Ідеальний блок у першу мить удару зводить шкоду нанівець.', a: [{ t: 'Спробую.', go: 'end' }] },
    mino: { t: 'Астерій чатує на дні Підземелля. Ніхто з тих, хто пішов сам, не повернувся. Беріть загін.', a: [{ t: 'Збиру друзів.', go: 'end' }] } },
  merchant: { s: { t: 'Найкращі товари у місті! Хоча… у гномів сталь міцніша, а в ельфів луки влучніші — не кажіть їм, що я так сказав.', a: [{ t: 'Покажи товар.', fx: { open: 'shop' } }, { t: 'Де найкраща зброя?', go: 'where' }, { t: 'Бувай.', go: 'end' }] },
    where: { t: 'У кожного народу своя крамниця: гномська сталь на Кряжі, ельфійські луки в Гавані, хутра в Пагорбах. Але без репутації вас там і на поріг не пустять до кращого.', a: [{ t: 'Як заслужити репутацію?', go: 'rep' }, { t: 'Ясно.', go: 'end' }] },
    rep: { t: 'Допомагайте їм. Доручення, торгівля, захист їхніх земель від монстрів — усе рахується.', a: [{ t: 'Дякую.', go: 'end' }] } },
  smith: { s: { t: 'Кує той, хто приносить руду. Маєш руду?', a: [{ t: 'Відкрий кузню.', fx: { open: 'forge' } }, { t: 'Де взяти руду?', go: 'ore' }, { t: 'Іншим разом.', go: 'end' }] },
    ore: { t: 'Рудні жили блищать на Вовчих пагорбах і в Покинутих шахтах. Торкнися жили — і довбай. А з руди тут, за верстатом ⚗️, зробиш і шолом, і кольчугу.', a: [{ t: 'Піду копати.', go: 'end' }] } },
  priest: { s: { t: 'Світло з вами, мандрівнику.', a: [{ t: 'Прошу зцілення.', fx: { open: 'temple' } }, { t: 'Вам потрібна допомога?', go: 'help' }, { t: 'Мир вам.', go: 'end' }] },
    help: { t: 'Мені бракує цілющої ромашки для хворих. Принесете п\'ять — віддячу.', a: [{ t: 'Ось вони. (віддати 5 🌼)', fx: { give: ['chamomile', 5], gold: 60, rep: ['elves', 10], say: 'Дякую! Хай Світло береже вас.' } }, { t: 'Пошукаю.', go: 'end' }] } },
  elder: { s: { t: 'Я пам\'ятаю, як це місто було хутором. А ви звідки, мандрівнику?', a: [{ t: 'Я прокинувся тут без пам\'яті.', go: 'isekai' }, { t: 'З далеких країв.', go: 'far' }, { t: 'Мені час.', go: 'end' }] },
    isekai: { t: 'Таких, як ви, тут звуть «прийшлими». Кажуть, Шлях сам обирає, кого покликати. Можливо, ваша доля — Мінотавр. Або щось більше.', a: [{ t: 'Що більше?', go: 'calam' }, { t: 'Цікаво…', go: 'end' }] },
    far: { t: 'Тоді ласкаво просимо. Тут кожен починає з нуля.', a: [{ t: 'Дякую.', go: 'end' }] },
    calam: { t: 'Три Катастрофи: Титан у Кам\'яних Висях, Фенрір у Сивому степу і Королева Слизів у Драглистих топях. Їх ще ніхто не здолав.', a: [{ t: 'Я стану першим.', fx: { say: 'Ха! Мені подобається ваш запал.' } }, { t: 'Страшно…', go: 'end' }] } },
  farmer: { s: { t: 'Ох, добре, що ви тут. Гобліни щоночі під\'їдають мій город, а коли кривавий місяць — то й набіги бувають!', a: [{ t: 'Коли наступний набіг?', go: 'raid' }, { t: 'Чим допомогти?', go: 'help' }, { t: 'Тримайтеся.', go: 'end' }] },
    raid: { t: 'Хто ж їх знає… Коли трапиться — вся околиця почує ріг. Приходьте тоді, будь ласка!', a: [{ t: 'Прийду.', fx: { rep: ['beasts', 5], say: 'Дякую, ви справжній захисник!' } }] },
    help: { t: 'Принесіть грибів з Гаю — зварю юшку для всіх оборонців. І вам дам.', a: [{ t: 'Ось гриби. (віддати 3 🍄)', fx: { give: ['mushroom', 3], item: { k: 'use', id: 'hp2', q: 2 }, say: 'Дякую! Тримайте зілля на дорогу.' } }, { t: 'Пізніше.', go: 'end' }] } },
  fisher: { s: { t: 'Тихо… рибу налякаєте.', a: [{ t: 'Навчи мене рибалити.', go: 'how' }, { t: 'Що тут ловиться?', go: 'fish' }, { t: 'Вибачте.', go: 'end' }] },
    how: { t: 'Підійди до води — з\'явиться кнопка 🎣. Закинь і чекай. Коли поплавок смикнеться й засвітиться — тисни одразу! Пізно — і риба зірветься.', a: [{ t: 'А краща вудка?', go: 'rod' }, { t: 'Зрозумів.', go: 'end' }] },
    rod: { t: 'Ганна продає вудки. З доброю вудкою клює швидше і частіше трапляється щука.', a: [{ t: 'Дякую.', go: 'end' }] },
    fish: { t: 'Плітка, окунь, короп. Щука — на світанку. Сом і вугор — лише вночі. А кажуть, у дощ хтось бачив золоту рибку…', a: [{ t: 'Золоту?!', fx: { say: 'Тсс! Не кажіть нікому.' } }] } },
  hermit: { s: { t: 'Велес бачить тебе, мандрівнику. Що шукаєш?', a: [{ t: 'Мудрості.', go: 'wis' }, { t: 'Сили.', go: 'pow' }, { t: 'Нічого.', go: 'end' }] },
    wis: { t: 'Тоді слухай: місяць, що червоніє, робить звірів лютими, але й щедрими. Хто не боїться ночі — збирає найкращу здобич.', a: [{ t: 'Дякую, волхве.', fx: { rep: ['elves', 5] } }] },
    pow: { t: 'Сила без мудрості — як сокира без топорища. Принеси місячний камінь — і я поблагословлю тебе.', a: [{ t: 'Ось камінь. (віддати 🌙)', fx: { give: ['moonstone', 1], buff: { id: 'veles', dur: 900, buff: { atk: .1, dr: .1 }, i: '🌿', n: 'Благословення Велеса' }, say: 'Хай Велес веде твою руку.' } }, { t: 'Пошукаю.', go: 'end' }] } },
  elfelder: { s: { t: 'Людина в Гавані… Рідкісний гість. Що привело тебе?', a: [{ t: 'Хочу дружити з ельфами.', go: 'friend' }, { t: 'Покажіть ваші товари.', fx: { shop: 'elves' } }, { t: 'Лише проходжу.', go: 'end' }] },
    friend: { t: 'Дружба ельфів заслуговується роками. Або справами. Ліс страждає від гоблінів та вовкулаків — захищай його, і ми запам\'ятаємо.', a: [{ t: 'Обіцяю.', fx: { rep: ['elves', 15], say: 'Слова — лише вітер. Але приємний.' } }] } },
  elfshop: { s: { t: 'Луки з серцевини дуба, тятиви з павутини світлячок.', a: [{ t: 'Покажи.', fx: { shop: 'elves' } }, { t: 'Пізніше.', go: 'end' }] } },
  dwarfking: { s: { t: 'Ха! Людина на Кряжі! Пиво будеш?', a: [{ t: 'Буду!', go: 'beer' }, { t: 'Мені потрібна гномська сталь.', fx: { shop: 'dwarves' } }, { t: 'Я лише подивитись.', go: 'end' }] },
    beer: { t: 'От це по-нашому! Заходь до Зали Предків під горою — там пиво ще краще. Тільки орків не приводь.', a: [{ t: 'За Кряж! (+репутація)', fx: { rep: ['dwarves', 15], say: 'За Кряж!' } }] } },
  dwarfsmith: { s: { t: 'Гномська заточка — найкраща у світі. Що кувати?', a: [{ t: 'Відкрий кузню.', fx: { open: 'forge' } }, { t: 'Гномські товари.', fx: { shop: 'dwarves' } }, { t: 'Нічого.', go: 'end' }] } },
  beastchief: { s: { t: 'Р-р-р. Чую запах людини. Говори.', a: [{ t: 'Я прийшов з миром.', go: 'peace' }, { t: 'Що маєте на обмін?', fx: { shop: 'beasts' } }, { t: 'Йду.', go: 'end' }] },
    peace: { t: 'Мир — це добре. Але зграя поважає силу. Здолай Вожака Сіре Ікло — і будеш нам братом.', a: [{ t: 'Здолаю.', fx: { rep: ['beasts', 10], say: 'Побачимо, людино.' } }] } },
  beastshop: { s: { t: 'Хутра, кігті, амулети — усе чесно виміняне!', a: [{ t: 'Покажи.', fx: { shop: 'beasts' } }, { t: 'Пізніше.', go: 'end' }] } },
  fishwife: { s: { t: 'Риба свіжа, сьогоднішня! Чи може продаєте?', a: [{ t: 'Покажи товар.', fx: { shop: 'fishing' } }, { t: 'Продати рибу.', fx: { sellFish: true } }, { t: 'Бувайте.', go: 'end' }] } },
  bard: { s: { t: 'Заспівати баладу?', a: [{ t: 'Про Титана!', go: 'titan' }, { t: 'Про кохання.', go: 'love' }, { t: 'Іншим разом.', go: 'end' }] },
    titan: { t: '«Встав Титан із каменю, гори в нім — кістки… Хто піде до Висей, не поверне ні руки…» Ну як?', a: [{ t: 'Моторошно! (дати 5 💰)', fx: { gold: -5, say: 'Щедрий слухач!' } }, { t: 'Краще про кохання.', go: 'love' }] },
    love: { t: '«Ельфійка співала над тихим ставком, а гном їй приносив руду…» Ну, далі сумно.', a: [{ t: 'Гарно.', go: 'end' }] } }
};
