import { hallLevel, type GameState } from '@jarlheim/sim';
import { useEffect, useState } from 'react';
import { useLang, type Lang } from './i18n';

/**
 * Plain help for new players (owner request): a "?" on every panel that says what it is for,
 * opened by itself the first time until the Great Hall reaches HELP_UNTIL_HALL, and a tip
 * when the same action fails again and again. Hand-written tips, no AI.
 */
export const HELP_UNTIL_HALL = 15;

export type HelpId =
  'heroes' | 'recruit' | 'warband' | 'barrow' | 'sagas' | 'shop' | 'build' | 'building' | 'quests' | 'world';

const HELP: Record<HelpId, Record<Lang, string>> = {
  heroes: {
    en: 'Heroes lead your warriors. Put your best three in the squad (tap a hero, then "Add to squad"): their skills make every battle easier. Level them up with hero scrolls and shards.',
    ar: 'الأبطال يقودون محاربيك. ضع أفضل ثلاثة في الفرقة (اضغط على البطل ثم "أضف للفرقة"): مهاراتهم تسهّل كل معركة. ارفع مستواهم بلفائف وشظايا الأبطال.',
    fr: 'Les héros mènent vos guerriers. Mettez vos trois meilleurs dans l’escouade (touchez un héros, puis « Ajouter »). Montez-les de niveau avec des parchemins et des éclats.',
  },
  recruit: {
    en: 'Recruiting: each draw gives a hero or shards of one. Pay with hero scrolls (from barrows, quests and chests) or Gold. Ten at once is cheaper. A hero you already have turns into shards to level them.',
    ar: 'التجنيد: كل سحبة تعطيك بطلاً أو شظايا منه. ادفع بلفائف الأبطال (من التلال والمهام والصناديق) أو بالذهب. عشرة مرة واحدة أرخص. البطل المكرر يتحول لشظايا ترفع مستواه.',
    fr: 'Recruter : chaque tirage donne un héros ou ses éclats. Payez avec des parchemins (tertres, quêtes, coffres) ou de l’Or. Dix d’un coup coûte moins. Un doublon devient des éclats.',
  },
  warband: {
    en: 'Your warband: train warriors in the Barracks, Stable, Archery Range and more. Shield walls hold, berserkers hit hard, archers shoot from behind, riders are fast. Wounded go to the Healer’s Hut.',
    ar: 'جيشك: درّب المحاربين في الثكنة والإسطبل وميدان الرماية وغيرها. جدار الدروع يصمد، والبيرسيركر يضرب بقوة، والرماة من الخلف، والفرسان سريعون. الجرحى يذهبون لكوخ المعالج.',
    fr: 'Votre troupe : entraînez des guerriers à la Caserne, l’Écurie, le Champ de tir… Les murs de boucliers tiennent, les berserkers frappent fort, les archers tirent de loin, les cavaliers sont rapides.',
  },
  barrow: {
    en: 'The draugr barrow: ten bands of the restless dead, each stronger. Beat one to open the next and win hero scrolls and Gold the first time. Bring your squad of heroes.',
    ar: 'تلّ الدراوغر: عشر مجموعات من الموتى، كل واحدة أقوى. اهزم واحدة لتفتح التالية واربح لفائف أبطال وذهباً أول مرة. خذ فرقة أبطالك معك.',
    fr: 'Le tertre des draugr : dix bandes de morts, chacune plus forte. Battez-en une pour ouvrir la suivante et gagner parchemins et Or la première fois.',
  },
  sagas: {
    en: 'Sagas are your battle reports: who fought, who fell, who was wounded and what you won. Read them to learn which warriors to bring next time.',
    ar: 'الملاحم هي تقارير معاركك: من قاتل ومن سقط ومن جُرح وماذا ربحت. اقرأها لتعرف أي محاربين تأخذ المرة القادمة.',
    fr: 'Les sagas sont vos rapports de bataille : qui a combattu, qui est tombé, ce que vous avez gagné. Lisez-les pour choisir vos guerriers.',
  },
  shop: {
    en: 'Shops: Gold buys speed-ups and chests; alliance points, VS medals and stamina come from playing and buy their own goods. No real money: everything here is earned in the game.',
    ar: 'المتاجر: الذهب يشتري التسريعات والصناديق؛ ونقاط التحالف وميداليات VS والطاقة تأتي من اللعب وتشتري بضائعها. لا مال حقيقي: كل شيء هنا تكسبه باللعب.',
    fr: 'Boutiques : l’Or achète accélérations et coffres ; points d’alliance, médailles VS et endurance se gagnent en jouant. Pas d’argent réel.',
  },
  build: {
    en: 'Building: pick a building, then drag it where you want it (green outline = fine). More buildings open as your Great Hall grows. Farms, woodcutters and mines make resources every hour.',
    ar: 'البناء: اختر مبنى ثم اسحبه للمكان الذي تريده (الإطار الأخضر = مناسب). مبانٍ أكثر تفتح كلما كبرت القاعة الكبرى. المزارع والحطابون والمناجم تنتج الموارد كل ساعة.',
    fr: 'Construire : choisissez un bâtiment puis faites-le glisser (contour vert = bon). D’autres s’ouvrent quand la Grande Salle grandit. Fermes et mines produisent chaque heure.',
  },
  building: {
    en: 'Upgrade a building to make it stronger or produce more. Upgrading takes a builder and some time; use speed-ups from the Bag to finish sooner. Tap "Move" to place it elsewhere.',
    ar: 'طوّر المبنى ليصبح أقوى أو ينتج أكثر. التطوير يحتاج عاملاً ووقتاً؛ استعمل التسريعات من الحقيبة لتنهيه أسرع. اضغط "نقل" لتضعه بمكان آخر.',
    fr: 'Améliorez un bâtiment pour qu’il produise plus. Il faut un bâtisseur et du temps ; les accélérations du Sac aident. « Déplacer » pour le mettre ailleurs.',
  },
  quests: {
    en: 'Quests show what to do next. Main quests lead you step by step; daily quests reset each day. Tap "Go" and the game takes you there; claim the reward when it is done.',
    ar: 'المهام تقول لك ماذا تفعل بعدها. المهام الرئيسية تقودك خطوة خطوة؛ واليومية تتجدد كل يوم. اضغط "اذهب" واللعبة تأخذك، ثم استلم الجائزة.',
    fr: 'Les quêtes disent quoi faire. Les principales vous guident pas à pas ; les quotidiennes reviennent chaque jour. « Aller » vous y emmène.',
  },
  world: {
    en: 'Midgard, the world map. Tap a camp to hunt it, a node to gather from it, a jarl to scout or attack. Tap a marching column: yours to steer or recall, another jarl’s to ambush. Blue = your alliance, red = enemies.',
    ar: 'ميدغارد، خريطة العالم. اضغط مخيماً لتصطاد، أو مورداً لتجمع منه، أو يارلاً لتستطلع أو تهاجم. اضغط رتلاً يمشي: رتلك لتوجهه أو ترجعه، ورتل غيرك لتنصب له كميناً. الأزرق تحالفك والأحمر أعداء.',
    fr: 'Midgard, la carte du monde. Touchez un camp pour chasser, une ressource pour récolter, un jarl pour espionner ou attaquer, une colonne pour la diriger ou lui tendre une embuscade.',
  },
};

const GOT_IT: Record<Lang, string> = { en: 'Got it', ar: 'فهمت', fr: 'Compris' };

const SEEN_KEY = 'jarlheim.help';

function seen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function markSeen(id: HelpId): void {
  try {
    const s = seen();
    s.add(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s]));
  } catch {
    // Private mode: the tip simply shows again next time.
  }
}

/** The "?" of a panel: what it does, opened by itself the first time for new players. */
export function HelpTip({ id, state, auto = true }: { id: HelpId; state: GameState; auto?: boolean }) {
  const lang = useLang();
  const fresh = hallLevel(state) <= HELP_UNTIL_HALL && !seen().has(id);
  // Over a full-screen map an open box would cover the controls: there the "?" glows instead.
  const [open, setOpen] = useState(() => auto && fresh);
  useEffect(() => {
    if (open) markSeen(id);
  }, [open, id]);
  return (
    <>
      <button
        className={`help-btn ${fresh && !open ? 'glow' : ''}`}
        aria-label="?"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        data-testid={`help-${id}`}
      >
        ?
      </button>
      {open && (
        <div className="help-box" data-testid="help-box">
          <p>💡 {HELP[id][lang]}</p>
          <button className="link" onClick={() => setOpen(false)}>
            {GOT_IT[lang]}
          </button>
        </div>
      )}
    </>
  );
}

/** Why an action keeps failing, and what to do about it (shown after the same failure twice). */
const TIPS: Array<[RegExp, Record<Lang, string>]> = [
  [
    /^Not enough (stamina)/i,
    {
      en: 'Hunting costs stamina. It refills by itself over time; the Energy shop sells more. Treasure chests cost none.',
      ar: 'الصيد يكلّف طاقة. تمتلئ وحدها مع الوقت، ومتجر الطاقة يبيع المزيد. صناديق الكنز لا تكلّف شيئاً.',
      fr: 'La chasse coûte de l’endurance. Elle remonte seule ; la boutique d’Énergie en vend. Les coffres n’en coûtent pas.',
    },
  ],
  [
    /^Not enough/i,
    {
      en: 'You are short of resources. Build or upgrade producers (farms, woodcutters, mines), hunt camps and pick up treasure on the map, or open chests in the Bag.',
      ar: 'ينقصك موارد. ابنِ أو طوّر المنتجين (مزارع، حطابين، مناجم)، واصطد المخيمات واجمع الكنوز على الخريطة، أو افتح الصناديق في الحقيبة.',
      fr: 'Il vous manque des ressources. Améliorez fermes, scieries et mines, chassez sur la carte, ramassez des trésors ou ouvrez des coffres.',
    },
  ],
  [
    /builders are busy/i,
    {
      en: 'Every builder is at work. Wait for one to finish, use a speed-up from the Bag, or upgrade the Builders’ Lodge: it gives more builders, up to 10.',
      ar: 'كل العمال مشغولون. انتظر حتى ينتهي أحدهم، أو استعمل تسريعاً من الحقيبة، أو طوّر نُزل البنّائين: يعطيك عمالاً أكثر حتى 10.',
      fr: 'Tous les bâtisseurs travaillent. Attendez, utilisez une accélération, ou améliorez la Loge : jusqu’à 10 bâtisseurs.',
    },
  ],
  [
    /Great Hall/i,
    {
      en: 'This needs a bigger Great Hall. Upgrading the Great Hall is always the main road forward: it opens new buildings, troops and land.',
      ar: 'هذا يحتاج قاعة كبرى أعلى. تطوير القاعة الكبرى هو الطريق الأساسي دائماً: يفتح مباني وجنوداً وأرضاً جديدة.',
      fr: 'Il faut une Grande Salle plus haute. C’est toujours la voie principale : elle ouvre bâtiments, troupes et terres.',
    },
  ],
  [
    /^Needs .+ level/i,
    {
      en: 'Upgrade the building it names first: tap it in your hold and press Upgrade.',
      ar: 'طوّر المبنى المذكور أولاً: اضغط عليه في قلعتك ثم "تطوير".',
      fr: 'Améliorez d’abord le bâtiment indiqué : touchez-le puis « Améliorer ».',
    },
  ],
  [
    /march columns/i,
    {
      en: 'All your columns are out. Wait for one to come home or recall it (tap it on the map). The Great Hall gives more columns as it grows.',
      ar: 'كل أرتالك في الخارج. انتظر عودة واحد أو أرجعه (اضغط عليه على الخريطة). القاعة الكبرى تعطيك أرتالاً أكثر كلما كبرت.',
      fr: 'Toutes vos colonnes sont sorties. Attendez ou rappelez-en une. La Grande Salle en donne plus.',
    },
  ],
  [
    /troops|warriors/i,
    {
      en: 'You have no warriors free to send. Train them in the Barracks, Stable or Archery Range, and heal the wounded at the Healer’s Hut.',
      ar: 'لا يوجد محاربون متاحون. درّبهم في الثكنة أو الإسطبل أو ميدان الرماية، وعالج الجرحى في كوخ المعالج.',
      fr: 'Aucun guerrier disponible. Entraînez-en à la Caserne, l’Écurie ou au Champ de tir, et soignez les blessés.',
    },
  ],
  [
    /close|occupied|overlap|outside|room|space/i,
    {
      en: 'Buildings need room around them. Drag it to an open spot until the outline turns green, or move another building first.',
      ar: 'المباني تحتاج مساحة حولها. اسحبه لمكان فارغ حتى يصبح الإطار أخضر، أو انقل مبنى آخر أولاً.',
      fr: 'Les bâtiments ont besoin de place. Glissez-le jusqu’à ce que le contour soit vert, ou déplacez-en un autre.',
    },
  ],
  [
    /shield|Nothing is left|broken/i,
    {
      en: 'That target is resting and will come back later. Pick another one on the map.',
      ar: 'هذا الهدف مرتاح وسيعود لاحقاً. اختر هدفاً آخر على الخريطة.',
      fr: 'Cette cible se repose et reviendra. Choisissez-en une autre.',
    },
  ],
];

const fails = new Map<string, { n: number; at: number }>();

/** Counts failures; on the second same failure within 90 seconds, returns a tip for it. */
export function failTip(message: string, lang: Lang, now: number): string | null {
  const f = fails.get(message);
  const n = f && now - f.at < 90_000 ? f.n + 1 : 1;
  fails.set(message, { n, at: now });
  if (n < 2) return null;
  fails.delete(message);
  const hit = TIPS.find(([re]) => re.test(message));
  return hit
    ? hit[1][lang]
    : {
        en: 'That did not work. Read the message above, and tap ? on the panel to see how it works.',
        ar: 'لم ينجح هذا. اقرأ الرسالة، واضغط ؟ على اللوحة لترى كيف تعمل.',
        fr: 'Ça n’a pas marché. Lisez le message et touchez ? sur le panneau.',
      }[lang];
}
