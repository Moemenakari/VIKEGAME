import { TROOPS, type BuildingType, type MainGoal, type ResourceId } from '@jarlheim/sim';
import { useSyncExternalStore } from 'react';

/**
 * Three languages with a one-tap switch (owner request): Arabic (right-to-left),
 * French and English. Game rules stay in English inside the simulation; every word
 * the player sees comes through here.
 */
export type Lang = 'ar' | 'fr' | 'en';
export const LANGS: Lang[] = ['ar', 'fr', 'en'];
export const LANG_LABEL: Record<Lang, string> = { ar: 'ع', fr: 'FR', en: 'EN' };

const KEY = 'jarlheim.lang';

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'ar' || saved === 'fr' || saved === 'en') return saved;
  } catch {
    // storage blocked
  }
  const nav = (navigator.language || 'en').slice(0, 2);
  return nav === 'ar' ? 'ar' : nav === 'fr' ? 'fr' : 'en';
}

let current: Lang = initial();
const listeners = new Set<() => void>();

function applyDir(): void {
  document.documentElement.lang = current;
  document.documentElement.dir = current === 'ar' ? 'rtl' : 'ltr';
}
applyDir();

export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // storage blocked: the choice lasts for this visit
  }
  applyDir();
  for (const l of listeners) l();
}

export const getLang = (): Lang => current;

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

type Dict = Record<string, string>;

const UI: Record<Lang, Dict> = {
  en: {
    close: 'Close',
    longship: 'Longship',
    longshipDesc: 'A fast warship, after the Oseberg and Gokstad finds. Voyages and sea raids come soon.',
    noJobs: 'All builders are free. Tap Go to start building.',
    claimReward: 'Claim reward',
    noPlot: 'No free plot. Upgrade the Great Hall.',
    activity: 'Activity',
    buy: 'Buy',
    free: 'Free',
    lang: 'ع / FR / EN',
    next: 'Next',
    heroesSoon: 'Heroes are coming soon',
    worldSoon: 'The world map is coming soon',
    bagSoon: 'The bag is coming soon',
    barrowLevel: 'Barrow level {n}',
    chest: 'Chest',
    vsLine: '{a} vs {b}',
    gotReward: 'Reward received!',
    renamed: 'Name saved',
    tooShort: '3 to 16 letters',
    build: 'Build',
    chooseBuild: 'Choose what to raise here',
    upgradeTo: 'Upgrade to level {n}',
    level: 'Level {n}',
    beingRaised: 'Being raised',
    perHour: '+{n} / hour',
    storageEach: 'Holds {n} of each resource',
    levelIn: 'Level {n} in {t}',
    finishFree: 'Finish now · Free',
    finishGold: 'Finish now · {n} Gold',
    maxLevel: 'Highest level reached',
    train: 'Train',
    training: 'Training',
    trainN: 'Train {n}',
    stats: 'Attack {a} · Defence {d} · Health {h}',
    readyIn: '{n} × {name} ready in {t}',
    wounded: 'Wounded',
    woundedRoom: '{n} wounded · room for {c}',
    healAll: 'Heal all',
    healing: 'Healing',
    healingIn: '{n} warriors healed in {t}',
    warband: 'Your Warband',
    warriorsHome: '{n} warriors at home',
    noWarriors: 'No warriors yet. Build a Shield Yard and train some.',
    toBarrow: 'March on the Draugr Barrow',
    barrow: 'Draugr Barrow',
    barrowSub: 'The dead walk at night',
    reward: 'Reward',
    firstClear: '+ Gold the first time',
    send: 'Send',
    noneHome: 'No warriors at home.',
    odds: 'Odds',
    favourable: 'Good',
    even: 'Even',
    risky: 'Risky',
    noneChosen: 'Choose warriors',
    counters: 'Shield › Berserker › Archer › Shield',
    attack: 'Attack',
    victory: 'Victory',
    defeat: 'Defeat',
    rounds: 'Level {l} · {r} rounds',
    yourWarriors: 'Your warriors',
    sent: 'Sent',
    fell: 'Fell',
    theDead: 'The dead',
    rose: 'Rose',
    sagas: 'Battle Reports',
    noBattles: 'No battles yet. The barrow waits.',
    quests: 'Quests',
    daily: 'Daily',
    main: 'Main',
    newIn: 'New quests in {t}',
    claim: 'Claim',
    claimed: 'Claimed',
    go: 'Go',
    allDone: 'All main quests done. More soon!',
    builders: 'Builders',
    idle: 'Free',
    profile: 'Profile',
    name: 'Name',
    save: 'Save',
    pictures: 'Pictures',
    settings: 'Settings',
    language: 'Language',
    snow: 'Snowfall',
    on: 'On',
    off: 'Off',
    restart: 'Restart from the beginning',
    restartSure: 'Tap again to erase everything',
    soon: 'Coming soon',
    heroes: 'Heroes',
    bag: 'Bag',
    world: 'World',
    power: 'Power',
    buildPower: 'Buildings',
    armyPower: 'Army',
    heroPower: 'Heroes',
    help: 'Drag to move · Pinch to zoom · Tap to build',
    webgl: 'This browser could not start 3D graphics.',
    away: 'While you were away: {list}',
    readyB: '{b} is ready',
    reachedB: '{b} reached level {n}',
    questDone: 'Quest done: {q}',
    newQuests: 'New daily quests are here',
    trainedT: '{n} {t} are ready',
    healedN: '{n} warriors have healed',
    goalBuild: 'Build {b}',
    goalUpgrade: 'Upgrade {b} to level {n}',
    goalTroops: 'Have {n} warriors',
    goalBarrow: 'Beat Draugr Barrow level {n}',
    plusBuild: '+ Build',
    soonLocked: 'Opens soon',
  },
  ar: {
    close: 'إغلاق',
    longship: 'السفينة الطويلة',
    longshipDesc: 'سفينة حربية سريعة، على طراز سفينتي أوسيبرغ وغوكستاد. الرحلات والغارات البحرية قريباً.',
    noJobs: 'كل العمّال متاحون. اضغط «اذهب» لتبدأ البناء.',
    claimReward: 'استلم الجائزة',
    noPlot: 'لا توجد أرض فارغة. طوّر القاعة الكبرى.',
    activity: 'النشاط',
    buy: 'شراء',
    free: 'مجاني',
    lang: 'ع / FR / EN',
    next: 'التالي',
    heroesSoon: 'الأبطال قريباً',
    worldSoon: 'خريطة العالم قريباً',
    bagSoon: 'الحقيبة قريباً',
    barrowLevel: 'التلّة المستوى {n}',
    chest: 'صندوق',
    vsLine: '{a} ضد {b}',
    gotReward: 'استلمت الجائزة!',
    renamed: 'تم حفظ الاسم',
    tooShort: 'من 3 إلى 16 حرفاً',
    build: 'بناء',
    chooseBuild: 'اختر ما تبنيه هنا',
    upgradeTo: 'تطوير إلى المستوى {n}',
    level: 'المستوى {n}',
    beingRaised: 'قيد البناء',
    perHour: '+{n} / ساعة',
    storageEach: 'يتسع {n} من كل مورد',
    levelIn: 'المستوى {n} بعد {t}',
    finishFree: 'إنهاء الآن · مجاناً',
    finishGold: 'إنهاء الآن · {n} ذهب',
    maxLevel: 'وصل إلى أعلى مستوى',
    train: 'تدريب',
    training: 'قيد التدريب',
    trainN: 'درّب {n}',
    stats: 'هجوم {a} · دفاع {d} · صحة {h}',
    readyIn: '{n} × {name} جاهزون بعد {t}',
    wounded: 'الجرحى',
    woundedRoom: '{n} جريح · المكان يتسع لـ {c}',
    healAll: 'عالج الجميع',
    healing: 'قيد العلاج',
    healingIn: '{n} محارب يُشفى بعد {t}',
    warband: 'جيشك',
    warriorsHome: '{n} محارب في القرية',
    noWarriors: 'لا يوجد جنود بعد. ابنِ ساحة الدروع ودرّب بعضهم.',
    toBarrow: 'سِر إلى تلّة الدراوغر',
    barrow: 'تلّة الدراوغر',
    barrowSub: 'الموتى يمشون في الليل',
    reward: 'الجائزة',
    firstClear: '+ ذهب في أول انتصار',
    send: 'أرسل',
    noneHome: 'لا يوجد جنود في القرية.',
    odds: 'الفرصة',
    favourable: 'جيدة',
    even: 'متعادلة',
    risky: 'خطرة',
    noneChosen: 'اختر جنوداً',
    counters: 'الدروع › الهائجون › الرماة › الدروع',
    attack: 'هجوم',
    victory: 'نصر',
    defeat: 'هزيمة',
    rounds: 'المستوى {l} · {r} جولات',
    yourWarriors: 'جنودك',
    sent: 'أُرسل',
    fell: 'سقط',
    theDead: 'الموتى',
    rose: 'نهض',
    sagas: 'تقارير المعارك',
    noBattles: 'لا معارك بعد. التلّة تنتظر.',
    quests: 'المهام',
    daily: 'يومية',
    main: 'رئيسية',
    newIn: 'مهام جديدة بعد {t}',
    claim: 'استلام',
    claimed: 'تم',
    go: 'اذهب',
    allDone: 'أنهيت كل المهام الرئيسية. المزيد قريباً!',
    builders: 'العمّال',
    idle: 'متاح',
    profile: 'الملف الشخصي',
    name: 'الاسم',
    save: 'حفظ',
    pictures: 'الصور',
    settings: 'الإعدادات',
    language: 'اللغة',
    snow: 'تساقط الثلج',
    on: 'تشغيل',
    off: 'إيقاف',
    restart: 'البدء من جديد',
    restartSure: 'اضغط مرة أخرى لمسح كل شيء',
    soon: 'قريباً',
    heroes: 'الأبطال',
    bag: 'الحقيبة',
    world: 'العالم',
    power: 'القوة',
    buildPower: 'المباني',
    armyPower: 'الجيش',
    heroPower: 'الأبطال',
    help: 'اسحب للتحريك · قرّب بإصبعين · المس للبناء',
    webgl: 'هذا المتصفح لا يستطيع تشغيل الرسوم ثلاثية الأبعاد.',
    away: 'أثناء غيابك: {list}',
    readyB: '{b} جاهز',
    reachedB: '{b} وصل إلى المستوى {n}',
    questDone: 'مهمة مكتملة: {q}',
    newQuests: 'وصلت مهام يومية جديدة',
    trainedT: '{n} {t} جاهزون',
    healedN: '{n} محارب شُفي',
    goalBuild: 'ابنِ {b}',
    goalUpgrade: 'طوّر {b} إلى المستوى {n}',
    goalTroops: 'امتلك {n} محارباً',
    goalBarrow: 'اهزم تلّة الدراوغر المستوى {n}',
    plusBuild: '+ بناء',
    soonLocked: 'يفتح قريباً',
  },
  fr: {
    close: 'Fermer',
    longship: 'Drakkar',
    longshipDesc:
      "Un navire de guerre rapide, d'après les trouvailles d'Oseberg et de Gokstad. Voyages et raids bientôt.",
    noJobs: 'Tous les bâtisseurs sont libres. Touchez Aller pour bâtir.',
    claimReward: 'Prendre la récompense',
    noPlot: 'Aucun terrain libre. Améliorez la Grande Salle.',
    activity: 'Activité',
    buy: 'Acheter',
    free: 'Gratuit',
    lang: 'ع / FR / EN',
    next: 'Ensuite',
    heroesSoon: 'Les héros arrivent bientôt',
    worldSoon: 'La carte du monde arrive bientôt',
    bagSoon: 'Le sac arrive bientôt',
    barrowLevel: 'Tertre niveau {n}',
    chest: 'Coffre',
    vsLine: '{a} contre {b}',
    gotReward: 'Récompense reçue !',
    renamed: 'Nom enregistré',
    tooShort: '3 à 16 lettres',
    build: 'Construire',
    chooseBuild: 'Choisissez quoi bâtir ici',
    upgradeTo: 'Améliorer au niveau {n}',
    level: 'Niveau {n}',
    beingRaised: 'En construction',
    perHour: '+{n} / heure',
    storageEach: 'Contient {n} de chaque ressource',
    levelIn: 'Niveau {n} dans {t}',
    finishFree: 'Terminer · Gratuit',
    finishGold: 'Terminer · {n} Or',
    maxLevel: 'Niveau maximum atteint',
    train: 'Entraîner',
    training: 'Entraînement',
    trainN: 'Entraîner {n}',
    stats: 'Attaque {a} · Défense {d} · Vie {h}',
    readyIn: '{n} × {name} prêts dans {t}',
    wounded: 'Blessés',
    woundedRoom: '{n} blessés · place pour {c}',
    healAll: 'Tout soigner',
    healing: 'Soins',
    healingIn: '{n} guerriers soignés dans {t}',
    warband: 'Votre troupe',
    warriorsHome: '{n} guerriers au village',
    noWarriors: 'Pas encore de guerriers. Construisez une Cour des boucliers.',
    toBarrow: 'Marcher sur le tertre des draugr',
    barrow: 'Tertre des draugr',
    barrowSub: 'Les morts marchent la nuit',
    reward: 'Récompense',
    firstClear: '+ Or la première fois',
    send: 'Envoyer',
    noneHome: 'Aucun guerrier au village.',
    odds: 'Chances',
    favourable: 'Bonnes',
    even: 'Égales',
    risky: 'Risquées',
    noneChosen: 'Choisissez des guerriers',
    counters: 'Bouclier › Berserker › Archer › Bouclier',
    attack: 'Attaquer',
    victory: 'Victoire',
    defeat: 'Défaite',
    rounds: 'Niveau {l} · {r} tours',
    yourWarriors: 'Vos guerriers',
    sent: 'Envoyés',
    fell: 'Tombés',
    theDead: 'Les morts',
    rose: 'Levés',
    sagas: 'Rapports de bataille',
    noBattles: 'Aucune bataille. Le tertre attend.',
    quests: 'Quêtes',
    daily: 'Du jour',
    main: 'Principales',
    newIn: 'Nouvelles quêtes dans {t}',
    claim: 'Prendre',
    claimed: 'Pris',
    go: 'Aller',
    allDone: 'Toutes les quêtes principales sont faites. La suite bientôt !',
    builders: 'Bâtisseurs',
    idle: 'Libre',
    profile: 'Profil',
    name: 'Nom',
    save: 'Enregistrer',
    pictures: 'Portraits',
    settings: 'Réglages',
    language: 'Langue',
    snow: 'Neige',
    on: 'Oui',
    off: 'Non',
    restart: 'Recommencer depuis le début',
    restartSure: 'Touchez encore pour tout effacer',
    soon: 'Bientôt',
    heroes: 'Héros',
    bag: 'Sac',
    world: 'Monde',
    power: 'Puissance',
    buildPower: 'Bâtiments',
    armyPower: 'Armée',
    heroPower: 'Héros',
    help: 'Glisser pour bouger · Pincer pour zoomer · Toucher pour bâtir',
    webgl: 'Ce navigateur ne peut pas afficher la 3D.',
    away: 'Pendant votre absence : {list}',
    readyB: '{b} est prêt',
    reachedB: '{b} atteint le niveau {n}',
    questDone: 'Quête accomplie : {q}',
    newQuests: 'Nouvelles quêtes du jour',
    trainedT: '{n} {t} sont prêts',
    healedN: '{n} guerriers soignés',
    goalBuild: 'Construire {b}',
    goalUpgrade: 'Améliorer {b} au niveau {n}',
    goalTroops: 'Avoir {n} guerriers',
    goalBarrow: 'Vaincre le tertre niveau {n}',
    plusBuild: '+ Bâtir',
    soonLocked: 'Bientôt',
  },
};

/** Translate a UI key, filling {placeholders}. */
export function t(key: string, vars: Record<string, string | number> = {}): string {
  const text = UI[current][key] ?? UI.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

const RESOURCE: Record<Lang, Record<ResourceId, string>> = {
  en: { food: 'Food', timber: 'Timber', iron: 'Iron', silver: 'Silver', gold: 'Gold' },
  ar: { food: 'قمح', timber: 'خشب', iron: 'حديد', silver: 'فضة', gold: 'ذهب' },
  fr: { food: 'Blé', timber: 'Bois', iron: 'Fer', silver: 'Argent', gold: 'Or' },
};
export const resName = (r: ResourceId) => RESOURCE[current][r];

const BUILDING: Record<Lang, Record<BuildingType, [string, string]>> = {
  en: {
    greatHall: [
      'Great Hall',
      'The heart of your hold. Every other building can only grow as high as this one.',
    ],
    farmstead: ['Farm', 'Barley fields. Makes Wheat for your people and warriors.'],
    fishRacks: ['Fish Racks', 'Cod dried in the wind. Makes more food.'],
    woodcutter: ["Woodcutter's Camp", 'Oak and pine. Makes Timber, which every building needs.'],
    smelter: ['Iron Smelter', 'Iron from bog ore. Needed for strong buildings and weapons.'],
    market: ['Market', 'Traders pay taxes in Silver.'],
    storehouse: ['Storehouse', 'Holds more of everything. The Great Hall needs it to grow.'],
    shieldYard: ['Shield Yard', 'Trains the Shieldwall. Strong against Berserkers.'],
    bowyerRange: ['Archery Range', 'Trains Archers. Strong against the Shieldwall.'],
    wolfLodge: ['Wolf Lodge', 'Trains Berserkers. Strong against Archers.'],
    healersHouse: ["Healer's House", 'Wounded warriors heal here instead of dying.'],
  },
  ar: {
    greatHall: ['القاعة الكبرى', 'قلب قريتك. لا يستطيع أي مبنى أن يتجاوز مستواها.'],
    farmstead: ['المزرعة', 'حقول شعير. تنتج القمح لأهلك وجنودك.'],
    fishRacks: ['رفوف السمك', 'سمك مجفّف في الريح. تنتج طعاماً إضافياً.'],
    woodcutter: ['معسكر الحطّابين', 'بلوط وصنوبر. ينتج الخشب الذي يحتاجه كل مبنى.'],
    smelter: ['مصهر الحديد', 'حديد من خام المستنقعات. للمباني القوية والأسلحة.'],
    market: ['السوق', 'التجّار يدفعون الضرائب فضّة.'],
    storehouse: ['المخزن', 'يتسع لموارد أكثر. القاعة الكبرى تحتاجه لتكبر.'],
    shieldYard: ['ساحة الدروع', 'تدرّب جدار الدروع. قوي ضد الهائجين.'],
    bowyerRange: ['ميدان الرماية', 'يدرّب الرماة. أقوياء ضد جدار الدروع.'],
    wolfLodge: ['نُزل الذئاب', 'يدرّب المحاربين الهائجين. أقوياء ضد الرماة.'],
    healersHouse: ['بيت المعالج', 'الجرحى يُشفون هنا بدل أن يموتوا.'],
  },
  fr: {
    greatHall: ['Grande Salle', 'Le cœur du village. Aucun bâtiment ne peut la dépasser.'],
    farmstead: ['Ferme', 'Champs d’orge. Produit le blé du village et des guerriers.'],
    fishRacks: ['Séchoir à poisson', 'Morue séchée au vent. Plus de nourriture.'],
    woodcutter: ['Camp de bûcherons', 'Chêne et pin. Produit le bois dont tout bâtiment a besoin.'],
    smelter: ['Fonderie', 'Fer tiré des tourbières. Pour bâtiments et armes solides.'],
    market: ['Marché', 'Les marchands paient l’impôt en argent.'],
    storehouse: ['Entrepôt', 'Stocke davantage. La Grande Salle en a besoin.'],
    shieldYard: ['Cour des boucliers', 'Entraîne le mur de boucliers. Fort contre les berserkers.'],
    bowyerRange: ['Champ de tir', 'Entraîne les archers. Forts contre le mur de boucliers.'],
    wolfLodge: ['Loge des loups', 'Entraîne les berserkers. Forts contre les archers.'],
    healersHouse: ['Maison du guérisseur', 'Les blessés y guérissent au lieu de mourir.'],
  },
};
export const bName = (b: BuildingType) => BUILDING[current][b][0];
export const bDesc = (b: BuildingType) => BUILDING[current][b][1];

const TROOP: Record<Lang, Record<string, string>> = {
  en: {
    'shieldwall-1': 'Farmer Levy',
    'shieldwall-2': 'Shieldman',
    'shieldwall-3': 'Húskarl',
    'berserker-1': 'Raider',
    'berserker-2': 'Berserker',
    'berserker-3': 'Wolf Warrior',
    'archer-1': 'Hunter',
    'archer-2': 'Bowman',
    'archer-3': 'Yew Archer',
    shambler: 'Barrow Shambler',
    ravager: 'Grave Ravager',
    wight: 'Mound Wight',
  },
  ar: {
    'shieldwall-1': 'مجنّد فلّاح',
    'shieldwall-2': 'حامل الدرع',
    'shieldwall-3': 'حارس الزعيم',
    'berserker-1': 'مُغير',
    'berserker-2': 'محارب هائج',
    'berserker-3': 'محارب الذئب',
    'archer-1': 'صيّاد',
    'archer-2': 'رامٍ',
    'archer-3': 'رامي الطقسوس',
    shambler: 'متخبّط القبور',
    ravager: 'ناهش القبور',
    wight: 'شبح التلّة',
  },
  fr: {
    'shieldwall-1': 'Levée paysanne',
    'shieldwall-2': 'Porte-bouclier',
    'shieldwall-3': 'Húskarl',
    'berserker-1': 'Pillard',
    'berserker-2': 'Berserker',
    'berserker-3': 'Guerrier-loup',
    'archer-1': 'Chasseur',
    'archer-2': 'Archer',
    'archer-3': "Archer d'if",
    shambler: 'Rôdeur des tombes',
    ravager: 'Ravageur',
    wight: 'Spectre du tertre',
  },
};
export const troopName = (id: string, fallback = id) => TROOP[current][id] ?? fallback;

const QUEST: Record<Lang, Record<string, string>> = {
  en: {
    'start-3': 'Start 3 constructions',
    'complete-2': 'Finish 2 upgrades',
    'food-2000': 'Produce 2,000 Wheat',
    'timber-2000': 'Produce 2,000 Timber',
    'free-finish': 'Use a free finish',
    'train-30': 'Train 30 warriors',
    'win-battle': 'Win a battle at the barrow',
  },
  ar: {
    'start-3': 'ابدأ 3 عمليات بناء',
    'complete-2': 'أكمل تطويرين',
    'food-2000': 'أنتج 2,000 قمح',
    'timber-2000': 'أنتج 2,000 خشب',
    'free-finish': 'استعمل الإنهاء المجاني',
    'train-30': 'درّب 30 محارباً',
    'win-battle': 'انتصر في معركة عند التلّة',
  },
  fr: {
    'start-3': 'Lancer 3 constructions',
    'complete-2': 'Terminer 2 améliorations',
    'food-2000': 'Produire 2 000 blé',
    'timber-2000': 'Produire 2 000 bois',
    'free-finish': 'Utiliser une fin gratuite',
    'train-30': 'Entraîner 30 guerriers',
    'win-battle': 'Gagner une bataille au tertre',
  },
};
export const questTitle = (id: string) => QUEST[current][id] ?? id;

export function goalText(goal: MainGoal): string {
  switch (goal.kind) {
    case 'building':
      return goal.level <= 1
        ? t('goalBuild', { b: bName(goal.building) })
        : t('goalUpgrade', { b: bName(goal.building), n: goal.level });
    case 'troops':
      return t('goalTroops', { n: goal.count });
    case 'barrow':
      return t('goalBarrow', { n: goal.level });
  }
}

/** Rule messages from the simulation, translated by pattern. */
const ERRORS: Array<[RegExp, Record<Lang, string>]> = [
  [
    /^All builders are busy$/,
    { en: 'All builders are busy', ar: 'كل العمّال مشغولون', fr: 'Tous les bâtisseurs sont occupés' },
  ],
  [/^Not enough (\w+)$/, { en: 'Not enough {1}', ar: 'لا يكفي {1}', fr: 'Pas assez de {1}' }],
  [
    /^Upgrade the Great Hall to level (\d+) first$/,
    {
      en: 'Upgrade the Great Hall to level {1} first',
      ar: 'طوّر القاعة الكبرى إلى المستوى {1} أولاً',
      fr: 'Améliorez d’abord la Grande Salle au niveau {1}',
    },
  ],
  [
    /^Needs (.+) level (\d+)$/,
    { en: 'Needs {1} level {2}', ar: 'يحتاج {1} المستوى {2}', fr: 'Nécessite {1} niveau {2}' },
  ],
  [
    /^(.+) unlocks at Great Hall (\d+)$/,
    {
      en: '{1} opens at Great Hall {2}',
      ar: '{1} يفتح عند القاعة الكبرى {2}',
      fr: '{1} s’ouvre à la Grande Salle {2}',
    },
  ],
  [
    /^This plot opens at Great Hall (\d+)$/,
    { en: 'Opens at Great Hall {1}', ar: 'يفتح عند القاعة الكبرى {1}', fr: 'S’ouvre à la Grande Salle {1}' },
  ],
  [
    /^Your hold can have (\d+) × (.+)$/,
    { en: 'You can have only {1} × {2}', ar: 'مسموح فقط {1} × {2}', fr: 'Maximum {1} × {2}' },
  ],
  [
    /^Already under construction$/,
    { en: 'Already being built', ar: 'قيد البناء أصلاً', fr: 'Déjà en construction' },
  ],
  [
    /^Already training a batch$/,
    { en: 'Already training', ar: 'التدريب جارٍ أصلاً', fr: 'Entraînement déjà en cours' },
  ],
  [
    /^At most (\d+) per batch at this level$/,
    { en: 'At most {1} at this level', ar: 'الحد الأقصى {1} في هذا المستوى', fr: 'Au plus {1} à ce niveau' },
  ],
  [/^Quest not finished yet$/, { en: 'Not finished yet', ar: 'لم تكتمل بعد', fr: 'Pas encore terminé' }],
  [
    /^Free finish unlocks in the last 5 minutes$/,
    {
      en: 'Free in the last 5 minutes',
      ar: 'مجاني في آخر 5 دقائق',
      fr: 'Gratuit dans les 5 dernières minutes',
    },
  ],
  [
    /^Defeat level (\d+) first$/,
    { en: 'Beat level {1} first', ar: 'اهزم المستوى {1} أولاً', fr: 'Battez d’abord le niveau {1}' },
  ],
  [
    /^Not enough troops at home$/,
    { en: 'Not enough warriors at home', ar: 'لا يوجد جنود كافون في القرية', fr: 'Pas assez de guerriers' },
  ],
  [/^No one is wounded$/, { en: 'No one is wounded', ar: 'لا يوجد جرحى', fr: 'Aucun blessé' }],
  [/^Already claimed$/, { en: 'Already claimed', ar: 'تم الاستلام سابقاً', fr: 'Déjà pris' }],
  [
    /^Already at the highest level$/,
    { en: 'Highest level reached', ar: 'وصل إلى أعلى مستوى', fr: 'Niveau maximum atteint' },
  ],
  [
    /^Choose warriors to send$/,
    { en: 'Choose warriors to send', ar: 'اختر جنوداً لإرسالهم', fr: 'Choisissez des guerriers' },
  ],
  [
    /^Unlock this picture first$/,
    { en: 'Unlock this picture first', ar: 'افتح هذه الصورة أولاً', fr: "Débloquez d'abord ce portrait" },
  ],
  [
    /^The healers are already at work$/,
    {
      en: 'The healers are already at work',
      ar: 'المعالجون يعملون الآن',
      fr: 'Les guérisseurs sont déjà au travail',
    },
  ],
  [
    /^(.+) is still being raised$/,
    { en: '{1} is still being built', ar: '{1} ما زال قيد البناء', fr: '{1} est encore en construction' },
  ],
  [
    /^(.+) needs (.+) level (\d+)$/,
    { en: '{1} needs {2} level {3}', ar: '{1} يحتاج {2} المستوى {3}', fr: '{1} nécessite {2} niveau {3}' },
  ],
  [
    /^Names are 3 to 16 letters$/,
    { en: 'Names are 3 to 16 letters', ar: 'الاسم من 3 إلى 16 حرفاً', fr: 'Le nom fait 3 à 16 lettres' },
  ],
];

const RES_EN: Record<string, ResourceId> = {
  Food: 'food',
  Timber: 'timber',
  Iron: 'iron',
  Silver: 'silver',
  Gold: 'gold',
};
const B_EN: Record<string, BuildingType> = {
  'Great Hall': 'greatHall',
  Farmstead: 'farmstead',
  'Fish Racks': 'fishRacks',
  "Woodcutter's Camp": 'woodcutter',
  'Bog-iron Smelter': 'smelter',
  Market: 'market',
  Storehouse: 'storehouse',
  'Shield Yard': 'shieldYard',
  "Bowyer's Range": 'bowyerRange',
  'Wolf-skin Lodge': 'wolfLodge',
  "Healer's House": 'healersHouse',
};

export function errorText(message: string): string {
  for (const [re, tr] of ERRORS) {
    const m = message.match(re);
    if (m) {
      return tr[current].replace(/\{(\d)\}/g, (_, i: string) => {
        const v = m[Number(i)] ?? '';
        if (RES_EN[v]) return resName(RES_EN[v]);
        if (B_EN[v]) return bName(B_EN[v]);
        const troop = Object.values(TROOPS).find((x) => x.name === v);
        if (troop) return troopName(troop.id, v);
        return v;
      });
    }
  }
  return message;
}
