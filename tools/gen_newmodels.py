import json
M = {m['id']: m for m in json.load(open('/home/claude/work/manifest.json'))}
# id: (group, height-or-length, yaw, note)
P = 3.14159265
S = {
 'mx_akai': ('hero', 1.75, 0, ''), 'mx_arissa': ('hero', 1.72, 0, ''), 'mx_brute': ('hero', 2.0, 0, 'Кремезний голий по пояс боєць.'),
 'mx_ch05': ('hero', 1.85, 0, 'Дуже схожий на Кратоса з God of War — ти просив не брати відомих персонажів; раджу 👎.'),
 'mx_ch09': ('npc', 1.15, 0, 'Мультяшний хлопчик — годиться лише для дитини-NPC (як Тіммі).'),
 'mx_ch30': ('monster', 2.0, 0, 'Безшкірий — чудовисько з оголеними м\'язами.'),
 'mx_demon': ('monster', 2.2, 0, ''), 'mx_dreyar': ('hero', 1.85, 0, ''), 'mx_erika': ('hero', 1.72, 0, ''), 'mx_eve': ('hero', 1.72, 0, ''),
 'mx_ganfaul': ('hero', 1.9, 0, ''), 'mx_goblin': ('monster', 1.15, 0, ''), 'mx_heraklios': ('hero', 1.85, 0, 'Мандрівник у шкіряному плащі й масці.'),
 'mx_kachujin': ('hero', 1.72, 0, ''), 'mx_maria': ('hero', 1.75, 0, ''), 'mx_maria_w': ('hero', 1.75, 0, 'Та сама Марія, але з мечем у руці.'),
 'mx_maw': ('monster', 2.6, 0, ''), 'mx_medea': ('hero', 1.72, 0, 'Одяг трохи сучасний на вигляд.'), 'mx_mutant': ('monster', 2.3, 0, 'У джинсах — для фентезі виглядає недоречно.'),
 'mx_nightshade': ('hero', 1.75, 0, ''), 'mx_paladin': ('hero', 1.9, 0, ''), 'mx_paladin_w': ('hero', 1.9, 0, 'Той самий паладин зі щитом і мечем.'),
 'mx_parasite': ('monster', 1.9, 0, 'У джинсових шортах — сучасний одяг.'), 'mx_peasant_f': ('npc', 1.68, 0, ''), 'mx_peasant_m': ('npc', 1.72, 0, ''),
 'mx_pirate': ('hero', 1.75, 0, 'Стиль трохи «науково-фантастичний».'), 'mx_prisoner': ('npc', 1.8, 0, 'Смугаста тюремна роба — сучасна.'),
 'mx_skelzombie': ('undead', 1.85, 0, ''), 'mx_survivor': ('undead', 1.8, 0, ''), 'mx_uriel': ('hero', 1.95, 0, ''),
 'mx_warzombie': ('undead', 1.85, 0, 'Солдатська форма XX століття — для фентезі недоречно.'), 'mx_zombiegirl': ('undead', 1.7, 0, ''),
 'anime_girl': ('race', 1.6, 0, 'Аніме-дівчина з ріжками; голова завелика — можливо, занадто мультяшна.'),
 'dwarf_adv': ('race', 1.35, 0, 'Мультяшний стиль.'), 'wraith': ('monster', 2.4, 0, 'Своя анімація польоту.'),
 'kobold': ('monster', 1.3, 0, ''), 'kobold2': ('race', 1.4, 0, 'Дівчина-кобольд (ящірка).'), 'rabbitman': ('race', 1.7, 0, 'Мультяшні пропорції — велика голова.'),
 'golem': ('monster', 2.8, 0, ''), 'priest': ('hero', 1.85, 0, 'Поруч стоять меч і книга — вони прив\'язані до моделі.'),
 'lizardman': ('monster', 2.0, 0, 'Своя анімація + наші.'), 'minotaur_s': ('monster', 2.4, 0, 'В оригіналі скелет кривий — може виглядати зламаним.'),
 'werewolf': ('monster', 2.4, 0, '29 власних анімацій атак.'),
 'alpha_wolf': ('animal', 1.9, 0, ''), 'bear': ('animal', 2.2, -P/2, ''), 'cat': ('animal', .7, 0, ''), 'crow': ('animal', .55, 0, ''),
 'dire_wolf': ('animal', 1.9, 0, '13 власних анімацій.'), 'fox': ('animal', .9, 0, 'Анімація «прокидається».'), 'horse': ('animal', 2.4, 0, 'Для кінної їзди.'),
 'rabbit': ('animal', .45, 0, ''), 'wolf': ('animal', 1.6, 0, ''), 'deer': ('animal', 2.0, -P/2, ''),
 'demon_dragon': ('boss', 6.0, 0, 'Політ, біг, спокій — свої анімації.'), 'icy_dragon': ('boss', 6.0, 0, 'Скелет в оригіналі дивний — може не показатись.'),
 'mermaid': ('race', 2.0, 0, 'Своя анімація плавання.'),
 'bishop': ('npc', 2.2, 0, 'Це статуя на постаменті — для міста як прикраса, не рухається.'),
 'bunnygirl': ('race', 1.6, 0, 'Кістки поставлені автоматично.'), 'catboy': ('race', 1.7, 0, 'Пухнастий стиль, трохи мультяшний. Кістки автоматичні.'),
 'chiya': ('race', 1.65, 0, 'Кістки автоматичні.'), 'dark_orc': ('monster', 1.95, 0, 'Кістки автоматичні.'),
 'dark_wraith': ('boss', 3.2, 0, 'Це сценка: вершник на коні разом зі шматком землі. Не рухається.'),
 'druid': ('hero', 1.85, 0, 'Кістки автоматичні.'), 'dwarf': ('race', 1.4, 0, 'Кістки автоматичні.'),
 'foxgirl': ('race', 1.65, 0, 'Аніме-лисиця з дев\'ятьма хвостами. Кістки автоматичні.'), 'gravok': ('boss', 2.4, 0, 'Кістки автоматичні.'),
 'kyra': ('hero', 1.75, 0, 'Кістки автоматичні; довгий одяг може гнутися неприродно.'), 'lich': ('undead', 1.9, 0, 'Кістки автоматичні.'),
 'lich_king': ('boss', 2.4, 0, 'Без текстур (так в оригіналі). Кістки автоматичні.'), 'magma_golem': ('boss', 3.4, 0, 'Кістки автоматичні.'),
 'minotaur_boss': ('boss', 3.0, 0, 'В оригіналі без текстур — я перебудував поверхню й дав колір шкіри. Кістки автоматичні.'),
 'monk': ('hero', 1.8, 0, 'Кістки автоматичні; широкі рукави.'), 'oldwizard': ('hero', 1.8, 0, 'Кістки автоматичні.'),
 'orc_shaman': ('monster', 1.8, 0, 'Кістки автоматичні.'), 'orc_warrior': ('monster', 1.9, 0, 'Кістки автоматичні.'),
 'stone_monster': ('boss', 3.4, 0, 'Кістки автоматичні.'),
 'urukhai': ('monster', 2.0, 0, 'Це сценка: двоє бійців на підставці. Не рухається.'),
 'wolfgirl': ('race', 1.7, 0, 'Увага: кашкет і червона пов\'язка на рукаві схожі на нацистську форму — раджу 👎.')}
STATIC = {'bishop', 'urukhai', 'dark_wraith'}
missing = set(M) - set(S); assert not missing, missing
order = ['hero', 'race', 'npc', 'monster', 'undead', 'boss', 'animal']
out = []
for g in order:
    for i, (gg, h, yaw, note) in S.items():
        if gg != g: continue
        m = M[i]; d = {'id': 'nm_' + i, 'n': m['n'], 'g': g, 'h': h, 'yaw': yaw, 'note': note}
        if i in STATIC: d['static'] = True
        elif m['kind'] == 'own': d['own'] = True; d['fit'] = 'max'
        elif i in ('werewolf', 'dwarf_adv', 'wraith'): d['own'] = True
        out.append(d)
js = '// generated by tools/gen_newmodels.py — models downloaded by the user (Mixamo / Sketchfab), processed for the game\n'
js += "import { BODIES } from './figures.js';\n"
js += "export const GROUPS = [['hero', 'Герої'], ['race', 'Звіролюди й раси'], ['npc', 'Мешканці'], ['monster', 'Монстри'], ['undead', 'Нежить'], ['boss', 'Боси'], ['animal', 'Тварини'], ['old', 'Старі варіанти']];\n"
js += 'export const NEW_MODELS = ' + json.dumps(out, ensure_ascii=False) + ';\n'
js += "NEW_MODELS.forEach(m => { BODIES[m.id] = { file: m.id, height: m.h, yaw: m.yaw || 0, walk: ['x', 'walk'], run: ['s', 'Run'], bbox: true, own: !!m.own, static: !!m.static, fit: m.fit }; });\n"
open('/home/claude/mmo/src/newmodels.js', 'w').write(js)
print(len(out))
