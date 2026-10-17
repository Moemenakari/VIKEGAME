import {
  ALLIANCES,
  REALMS,
  createRng,
  hashString,
  midgard,
  nextFloat,
  nextInt,
  realmMap,
} from '@jarlheim/sim';
import type { ChatMessage } from '../online/types';
import { getLang, type Lang } from './i18n';

/**
 * The AI jarls talk (owner request): realm and alliance chats get lines from the jarls on
 * the map, a few every few minutes, generated from the time slot (same for everyone at the
 * same moment, no network, no storage). They are always marked as AI in the chat.
 */
export interface BotContext {
  channel: 'realm' | 'alliance';
  realm: number;
  alliance: number | null;
  player: string;
  /** Today's VS theme, already translated. */
  theme: string;
  rival: number | null;
  ahead: boolean;
}

const SLOT_MS = 4 * 60_000;

type Lines = Record<Lang, string[]>;

const REALM: Lines = {
  en: [
    'Wolves at ({x},{y}), level {l}. Easy spoils for anyone close 🐺',
    '[{tag}] is recruiting! Active jarls, come join us.',
    "The King's War is coming on Saturday. Train your shieldwall!",
    'Buried hoard near ({x},{y}). Bring many warriors to carry the silver 💰',
    'Outlaws hit my fields again. Watch your walls.',
    'Tip: archers break the shieldwall, the shieldwall breaks berserkers.',
    'Three wolf packs down this morning. Good hunting!',
    '{king} sits on the Law Rock. Not for long ⚔',
    'Today the VS is about {theme}. Every point counts!',
    'A draugr mound at level {l}. Who has heroes strong enough? 💀',
    'New here? Join an alliance, everything is easier together.',
    'Peace shield up, going to sleep 😴',
    'Lost a whole levy to a bear. Never again 🐻',
    'Bog iron near ({x},{y}) if anyone needs iron for riders.',
    'Hail from {region}!',
    'Skål, everyone! 🍺',
  ],
  ar: [
    'ذئاب عند ({x},{y})، مستوى {l}. غنائم سهلة للقريبين 🐺',
    '[{tag}] يقبل أعضاء جدد! الجارلات النشيطون أهلاً بكم.',
    'حرب الملك يوم السبت. درّبوا جدار الدروع!',
    'كنز مدفون قرب ({x},{y}). خذوا جنوداً كثيرين لحمل الفضة 💰',
    'الخارجون عن القانون هاجموا حقولي مرة أخرى. انتبهوا لأسواركم.',
    'نصيحة: الرماة يكسرون جدار الدروع، وجدار الدروع يكسر البيرسركر.',
    'هزمت ثلاث قطعان ذئاب هذا الصباح. صيد موفق!',
    '{king} يجلس على صخرة القانون. ليس لوقت طويل ⚔',
    'تحدّي اليوم عن {theme}. كل نقطة مهمة!',
    'تلّ دراوغر مستوى {l}. من عنده أبطال أقوياء؟ 💀',
    'جديد هنا؟ انضم إلى تحالف، كل شيء أسهل معاً.',
    'رفعت درع السلام، رايح نام 😴',
    'خسرت فرقة كاملة بسبب دب. أبداً مرة ثانية 🐻',
    'في حديد قرب ({x},{y}) إذا حدا بدو حديد للخيالة.',
    'تحية من {region}!',
    'في صحتكم جميعاً! 🍺',
  ],
  fr: [
    'Des loups en ({x},{y}), niveau {l}. Butin facile pour les voisins 🐺',
    '[{tag}] recrute ! Jarls actifs, rejoignez-nous.',
    'La Guerre du Roi arrive samedi. Entraînez votre mur de boucliers !',
    'Trésor enfoui près de ({x},{y}). Venez nombreux pour porter l’argent 💰',
    'Des hors-la-loi ont encore pillé mes champs. Gardez vos murs.',
    'Astuce : les archers brisent le mur de boucliers, le mur brise les berserkers.',
    'Trois meutes de loups vaincues ce matin. Bonne chasse !',
    '{king} siège sur le Rocher de la Loi. Plus pour longtemps ⚔',
    'Aujourd’hui le VS porte sur : {theme}. Chaque point compte !',
    'Un tertre de draugr niveau {l}. Qui a des héros assez forts ? 💀',
    'Nouveau ? Rejoignez une alliance, tout est plus facile ensemble.',
    'Bouclier de paix levé, je vais dormir 😴',
    'Perdu toute une levée contre un ours. Plus jamais 🐻',
    'Du fer des marais près de ({x},{y}) pour vos cavaliers.',
    'Salut de {region} !',
    'Skål à tous ! 🍺',
  ],
};

const ALLIANCE: Lines = {
  en: [
    "Morning, everyone! Let's win this VS.",
    "I'm gathering at the old oak wood. Come help!",
    'Our rival in the VS is [{rival}]. Push {theme} today!',
    'Who needs help with their Great Hall?',
    'Rally at our fort at ({x},{y}) before the King’s War.',
    'Welcome {player}! Ask if you need anything.',
    'Hunt the wolves near your hold for easy speed-ups.',
    '{vs}',
    'Train riders: they run down archers and siege crews.',
    'Keep your shield up at night, [{rival}] hits late.',
    'Good fight yesterday, everyone 💪',
    '{player}, nice work today!',
  ],
  ar: [
    'صباح الخير للجميع! يلا نربح هالتحدّي.',
    'عم أجمع من غابة البلوط. تعالوا ساعدوا!',
    'خصمنا في التحدّي [{rival}]. ركّزوا على {theme} اليوم!',
    'مين بدو مساعدة بالقاعة الكبرى؟',
    'التجمّع عند حصننا ({x},{y}) قبل حرب الملك.',
    'أهلاً {player}! اسأل إذا بدك شي.',
    'اصطادوا الذئاب قرب قلعتكم لتربحوا تسريعات سهلة.',
    '{vs}',
    'درّبوا الخيالة: بيهزموا الرماة وآلات الحصار.',
    'خلّوا الدرع مرفوع بالليل، [{rival}] بيهاجموا متأخر.',
    'معركة حلوة مبارح يا جماعة 💪',
    '{player}، شغل ممتاز اليوم!',
  ],
  fr: [
    'Bonjour à tous ! Gagnons ce VS.',
    'Je récolte dans la vieille chênaie. Venez aider !',
    'Notre rival au VS est [{rival}]. Poussez sur {theme} aujourd’hui !',
    'Qui a besoin d’aide pour sa Grande Halle ?',
    'Ralliement au fort ({x},{y}) avant la Guerre du Roi.',
    'Bienvenue {player} ! Demande si tu as besoin.',
    'Chassez les loups près de chez vous pour des accélérations faciles.',
    '{vs}',
    'Entraînez des cavaliers : ils écrasent archers et engins.',
    'Gardez le bouclier la nuit, [{rival}] frappe tard.',
    'Beau combat hier, tout le monde 💪',
    '{player}, beau travail aujourd’hui !',
  ],
};

const VS_LINE: Record<Lang, [string, string]> = {
  en: ["We're ahead in the VS, keep going! 🏆", "We're behind in the VS. Everyone push!"],
  ar: ['نحن متقدّمون في التحدّي، كمّلوا! 🏆', 'نحن متأخرون في التحدّي. الكل يشدّ حيله!'],
  fr: ['On mène au VS, continuez ! 🏆', 'On est derrière au VS. Tout le monde pousse !'],
};

const REPLIES: Record<Lang, { hello: string[]; any: string[] }> = {
  en: {
    hello: ['Hail, {player}! 👋', 'Welcome, {player}!'],
    any: ['Aye!', 'Well said, {player}.', 'Skål! 🍺', 'True.', '😂'],
  },
  ar: {
    hello: ['أهلاً {player}! 👋', 'هلا {player}!'],
    any: ['أكيد!', 'كلام صح يا {player}.', 'في صحتك! 🍺', 'صحيح.', '😂'],
  },
  fr: {
    hello: ['Salut, {player} ! 👋', 'Bienvenue, {player} !'],
    any: ['Oui !', 'Bien dit, {player}.', 'Skål ! 🍺', 'Vrai.', '😂'],
  },
};

const HELLO = /\b(hi|hey|hello|hail|salut|bonjour|salam)\b|مرحب|سلام|اهلا|أهلا|هلا/i;

function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

function speaker(ctx: BotContext, rng: ReturnType<typeof createRng>) {
  const all = midgard(ctx.realm).jarls;
  const pool = ctx.channel === 'alliance' ? all.filter((j) => j.alliance === ctx.alliance) : all;
  const j = (pool.length ? pool : all)[nextInt(rng, 0, (pool.length ? pool : all).length - 1)]!;
  return {
    id: `bot-${j.id}`,
    name: j.alliance === null ? j.name : `[${ALLIANCES[j.alliance]!.tag}] ${j.name}`,
  };
}

/** The AI jarls' lines in a channel up to `now`: newest last. */
export function botMessages(ctx: BotContext, channelId: string, now: number, count = 10): ChatMessage[] {
  const lang = getLang();
  const lines = (ctx.channel === 'realm' ? REALM : ALLIANCE)[lang];
  const world = midgard(ctx.realm);
  const realm = REALMS.find((r) => r.id === ctx.realm)!;
  const slot = Math.floor(now / SLOT_MS);
  const out: ChatMessage[] = [];
  for (let k = slot - Math.max(8, count * 2); k <= slot; k++) {
    const rng = createRng(hashString(`bot-${ctx.channel}-${ctx.realm}-${ctx.alliance}-${k}`));
    if (nextFloat(rng) < (ctx.channel === 'realm' ? 0.3 : 0.5)) continue; // quiet now and then
    const at = k * SLOT_MS + Math.floor(nextFloat(rng) * SLOT_MS);
    if (at > now) continue;
    const who = speaker(ctx, rng);
    const camp = world.camps[nextInt(rng, 0, world.camps.length - 1)]!;
    const node = world.nodes[nextInt(rng, 0, world.nodes.length - 1)]!;
    const seat = ctx.alliance === null ? null : realmSeat(ctx.realm, ctx.alliance);
    const text = lines[nextInt(rng, 0, lines.length - 1)]!;
    const usesNode = text.includes('💰') || /iron|حديد|fer/i.test(text);
    const body = fill(text, {
      x: seat && ctx.channel === 'alliance' ? seat.x : usesNode ? node.x : camp.x,
      y: seat && ctx.channel === 'alliance' ? seat.y : usesNode ? node.y : camp.y,
      l: camp.level,
      tag: ALLIANCES[nextInt(rng, 0, ALLIANCES.length - 1)]!.tag,
      king: realm.king,
      theme: ctx.theme,
      region: ['Norðrvegr', 'Garðaríki', 'Frankland', 'Írland', 'Ísland'][nextInt(rng, 0, 4)]!,
      rival: ctx.rival === null ? '???' : ALLIANCES[ctx.rival]!.tag,
      player: ctx.player,
      vs: VS_LINE[lang][ctx.ahead ? 0 : 1],
    });
    out.push({
      id: -(k * 4 + (ctx.channel === 'realm' ? 1 : 2)),
      channelId,
      senderId: who.id,
      senderName: who.name,
      senderVip: 0,
      body,
      imageUrl: null,
      replyTo: null,
      createdAt: new Date(at).toISOString(),
      reactions: {},
    });
  }
  return out.slice(-count);
}

/** The alliance's ring fort: its rally point. */
const realmSeat = (realm: number, alliance: number) =>
  realmMap(realm).seats.find((s) => s.alliance === alliance) ?? null;

/** An AI jarl answers when you speak in the realm or alliance chat. */
export function botReply(ctx: BotContext, channelId: string, said: string, now: number): ChatMessage {
  const lang = getLang();
  const rng = createRng(hashString(`reply-${now}-${said}`));
  const r = REPLIES[lang];
  const list = HELLO.test(said) ? r.hello : r.any;
  const who = speaker(ctx, rng);
  return {
    id: -(now % 1_000_000_000) - 3,
    channelId,
    senderId: who.id,
    senderName: who.name,
    senderVip: 0,
    body: fill(list[nextInt(rng, 0, list.length - 1)]!, { player: ctx.player }),
    imageUrl: null,
    replyTo: null,
    createdAt: new Date(now).toISOString(),
    reactions: {},
  };
}

export const isBot = (m: ChatMessage) => m.senderId.startsWith('bot-');
