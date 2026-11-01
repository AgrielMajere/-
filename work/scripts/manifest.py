import json
M = []
def add(id, src, kind, n, tris=30000, anims=0):
    M.append(dict(id=id, src=src, kind=kind, n=n, tris=tris, anims=anims))
# --- Mixamo (rigged, Mixamo bones) ---
for id, src, n in [
 ('mx_akai','akai_e_espiritu.fbx','Акай (воїн у масці)'), ('mx_arissa','Arissa.fbx','Арісса (найманка)'), ('mx_brute','Brute.fbx','Громило'),
 ('mx_ch05','Ch05_nonPBR.fbx','Персонаж Ch05'), ('mx_ch09','Ch09_nonPBR.fbx','Персонаж Ch09'), ('mx_ch30','Ch30_nonPBR.fbx','Персонаж Ch30'),
 ('mx_demon','Demon T Wiezzorek.fbx','Демон'), ('mx_dreyar','Dreyar By M.Aure.fbx','Дреяр (старий воїн)'), ('mx_erika','Erika Archer.fbx','Еріка (лучниця)'),
 ('mx_eve','Eve By J.Gonzales.fbx','Єва'), ('mx_ganfaul','Ganfaul M Aure.fbx','Ганфаул (чарівник)'), ('mx_goblin','goblin_d_shareyko.fbx','Гоблін'),
 ('mx_heraklios','Heraklios By A. Dizon.fbx','Гераклій (лицар)'), ('mx_kachujin','Kachujin G Rosales.fbx','Качуджин (мечниця)'), ('mx_maria','Maria J J Ong.fbx','Марія (воїтелька)'),
 ('mx_maria_w','Maria WProp J J Ong.fbx','Марія зі зброєю'), ('mx_maw','Maw J Laygo.fbx','Мау (чудовисько)'), ('mx_medea','Medea By M. Arrebola.fbx','Медея (відьма)'),
 ('mx_mutant','Mutant.fbx','Мутант'), ('mx_nightshade','Nightshade J Friedrich.fbx','Найтшейд (вбивця)'), ('mx_paladin','Paladin J Nordstrom.fbx','Паладин'),
 ('mx_paladin_w','Paladin WProp J Nordstrom.fbx','Паладин зі зброєю'), ('mx_parasite','Parasite L Starkie.fbx','Паразит'), ('mx_peasant_f','Peasant Girl.fbx','Селянка'),
 ('mx_peasant_m','Peasant Man.fbx','Селянин'), ('mx_pirate','Pirate By P. Konstantinov.fbx','Пірат'), ('mx_prisoner','Prisoner B Styperek.fbx','В\'язень'),
 ('mx_skelzombie','Skeletonzombie T Avelange.fbx','Скелет-зомбі'), ('mx_survivor','Survivor A Lusth.fbx','Виживальниця'), ('mx_uriel','Uriel A Plotexia.fbx','Уріель (ангел-воїтель)'),
 ('mx_warzombie','Warzombie F Pedroso.fbx','Зомбі-воїн'), ('mx_zombiegirl','Zombiegirl W Kurniawan.fbx','Зомбі-дівчина')]:
    add(id, src, 'mix', n)
# --- rigged humanoids with other skeletons ---
for id, n, a in [('anime_girl','Аніме-дівчина',0),('dwarf_adv','Гном-шукач пригод',1),('wraith','Привид',1),('kobold','Кобольд',1),('kobold2','Кобольд 2',1),
                 ('rabbitman','Зайцелюд',1),('golem','Голем',0),('priest','Жрець',0),('lizardman','Ящеролюд',1),('minotaur_s','Мінотавр',0),('werewolf','Перевертень',1)]:
    add(id, 'sf_'+id+'.glb', 'hum', n, 30000, a)
# --- animals / creatures with their own animations ---
for id, n, t in [('alpha_wolf','Вовк-вожак',30000),('bear','Ведмідь',30000),('cat','Кіт',30000),('crow','Ворона',30000),('dire_wolf','Лютововк',30000),('fox','Лис',30000),
                 ('horse','Кінь',30000),('rabbit','Кролик',30000),('wolf','Вовк',30000),('deer','Олень',30000),('demon_dragon','Демонічний дракон',45000),
                 ('icy_dragon','Крижаний дракон',45000),('mermaid','Русалка',45000)]:
    add(id, 'sf_'+id+'.glb', 'own', n, t, 1)
# --- static (no skeleton) -> auto-rig ---
for id, n, t in [('bishop','Єпископ',30000),('bunnygirl','Дівчина-кролиця',30000),('catboy','Котолюд',30000),('chiya','Чія',30000),('dark_orc','Темний орк',30000),
                 ('dark_wraith','Темний привид (бос)',45000),('druid','Друїд',30000),('dwarf','Гном',30000),('foxgirl','Лисиця-дівчина',30000),('gravok','Гравок (бос)',45000),
                 ('kyra','Кайра',30000),('lich','Ліч',30000),('lich_king','Король-ліч (бос)',45000),('magma_golem','Магмовий голем (бос)',45000),('minotaur_boss','Мінотавр-бос',45000),
                 ('monk','Монах',30000),('oldwizard','Старий чарівник',30000),('orc_shaman','Орк-шаман',30000),('orc_warrior','Орк-воїн',30000),('stone_monster','Кам\'яне чудовисько (бос)',45000),
                 ('urukhai','Урук-хай',30000),('wolfgirl','Вовчиця-дівчина',30000)]:
    add(id, 'sf_'+id+'.glb', 'static', n, t, 0)
json.dump(M, open('/home/claude/work/manifest.json','w'), ensure_ascii=False, indent=0)
print(len(M))
