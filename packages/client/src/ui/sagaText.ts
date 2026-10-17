import { CAMPS, RESOURCE_NAMES } from '@jarlheim/sim';
import { resName, t, type Lang } from './i18n';

/**
 * The sim writes reports in English (it stays language-free); the mail shows them in the
 * player's language (owner request: "they must all be written in Arabic"). Each line is
 * matched against these patterns; names of people and places stay as they are.
 */
type Tr = Record<Exclude<Lang, 'en'>, string>;

/** Things inside a line that have their own translation (camps, ring forts, resources). */
function name(v: string, lang: Lang): string {
  if (lang === 'en') return v;
  const camp = Object.entries(CAMPS).find(([, c]) => c.name.toLowerCase() === v.toLowerCase());
  if (camp) return t(`camp_${camp[0]}`);
  const fort = v.match(/^(.+) Ring Fort$/);
  if (fort) return lang === 'ar' ? `حصن ${fort[1]}` : `Fort de ${fort[1]}`;
  return v;
}

/** "1,200 Food, 300 Timber and 40 Silver" in the player's language. */
function loot(v: string, lang: Lang): string {
  if (lang === 'en') return v;
  const and = lang === 'ar' ? ' و' : ' et ';
  return v
    .split(/, | and /)
    .map((part) => {
      const m = part.match(/^([\d,]+) (.+)$/);
      if (!m) return part;
      const res = Object.entries(RESOURCE_NAMES).find(([, n]) => n === m[2]);
      return `${m[1]} ${res ? resName(res[0] as 'food') : m[2]}`;
    })
    .join(lang === 'ar' ? '، ' : ', ')
    .replace(/, ([^,]*)$/, `${and}$1`);
}

const LINES: Array<[RegExp, Tr]> = [
  // ---- world map: holds, camps, columns, treasure, scouts ----
  [
    /^Your warriors marched on the hold of (.+)\.$/,
    { ar: 'زحف محاربوك على قلعة {1}.', fr: 'Vos guerriers ont marché sur le fort de {1}.' },
  ],
  [
    /^The palisade fell and the defenders broke\. .*$/,
    {
      ar: 'سقط السور وانكسر المدافعون. حمّل محاربوك ما استطاعوا وعادوا إلى الديار.',
      fr: 'La palissade est tombée et les défenseurs ont cédé. Vos guerriers rentrent chargés.',
    },
  ],
  [
    /^The defenders held the gate, and your warriors fell back\.$/,
    {
      ar: 'صمد المدافعون عند البوابة، فتراجع محاربوك.',
      fr: 'Les défenseurs ont tenu la porte, vos guerriers ont reculé.',
    },
  ],
  [
    /^Your warriors tracked the (.+) across the wilds\.$/,
    {
      ar: 'تعقّب محاربوك {1} عبر البراري.',
      fr: 'Vos guerriers ont traqué {1} à travers les terres sauvages.',
    },
  ],
  [
    /^The fight was hard but short, and the spoils are on their way home\.$/,
    {
      ar: 'كانت المعركة صعبة لكن قصيرة، والغنائم في طريقها إلى الديار.',
      fr: 'Combat dur mais bref : le butin est en route.',
    },
  ],
  [
    /^It was too strong for them, and they fell back\.$/,
    { ar: 'كان أقوى منهم، فتراجعوا.', fr: 'C’était trop fort pour eux, ils ont reculé.' },
  ],
  [
    /^Your warriors found the wreck on the shore and pried open the sea chest\.$/,
    {
      ar: 'وجد محاربوك الحطام على الشاطئ وفتحوا صندوق البحر.',
      fr: 'Vos guerriers ont trouvé l’épave et forcé le coffre.',
    },
  ],
  [
    /^They are hauling the silver home\.$/,
    { ar: 'إنهم ينقلون الفضة إلى الديار.', fr: 'Ils rapportent l’argent.' },
  ],
  [
    /^Your warriors caught the column of (.+) out on the road\.$/,
    {
      ar: 'باغت محاربوك رتل {1} على الطريق.',
      fr: 'Vos guerriers ont surpris la colonne de {1} sur la route.',
    },
  ],
  [
    /^They broke it and drove off with what its carts carried\.$/,
    {
      ar: 'كسروه وأخذوا ما تحمله عرباته.',
      fr: 'Ils l’ont brisée et ont pris ce que portaient ses chariots.',
    },
  ],
  [
    /^The column closed ranks and beat them off\.$/,
    { ar: 'تماسك الرتل وصدّهم.', fr: 'La colonne a serré les rangs et les a repoussés.' },
  ],
  [
    /^Your scouts reached the hold of (.+) unseen\.$/,
    {
      ar: 'وصل كشّافتك إلى قلعة {1} دون أن يراهم أحد.',
      fr: 'Vos éclaireurs ont atteint le fort de {1} sans être vus.',
    },
  ],
  [
    /^Below: the warriors guarding it.*$/,
    {
      ar: 'في الأسفل: المحاربون الذين يحرسونها، وسورها، والمخازن التي يمكنك أخذها، وأبطالها. قارنها بجيشك قبل أن تهاجم.',
      fr: 'Ci-dessous : ses gardes, son mur, les réserves à prendre et ses héros. Comparez avec votre armée avant d’attaquer.',
    },
  ],
  [
    /^Your scouts crept up to the hold of (.+) and counted what they saw\.$/,
    {
      ar: 'تسلّل كشّافتك إلى قلعة {1} وأحصوا ما رأوا.',
      fr: 'Vos éclaireurs se sont glissés jusqu’au fort de {1}.',
    },
  ],
  [
    /^Your watchmen caught scouts of (.+) near your hold\.$/,
    {
      ar: 'أمسك حرّاسك كشّافة {1} قرب قلعتك.',
      fr: 'Vos guetteurs ont surpris des éclaireurs de {1} près de votre fort.',
    },
  ],
  [
    /^They counted your warriors and your stores.*$/,
    {
      ar: 'أحصوا محاربيك ومخازنك ثم انسلّوا. توقّعهم؛ صاروا أعداءك الآن.',
      fr: 'Ils ont compté vos guerriers et vos réserves, puis ont filé. Ce sont vos ennemis.',
    },
  ],
  // ---- land ----
  [
    /^Your warriors marched on free land in (.+), where the local karls stood to meet them\.$/,
    {
      ar: 'زحف محاربوك على أرض حرّة في {1}، حيث وقف الفلاحون المحليون لملاقاتهم.',
      fr: 'Vos guerriers ont marché sur une terre libre en {1}, où les karls locaux les attendaient.',
    },
  ],
  [
    /^Your warriors marched on land held by the (.+) in (.+)\.$/,
    {
      ar: 'زحف محاربوك على أرض يملكها {1} في {2}.',
      fr: 'Vos guerriers ont marché sur une terre tenue par {1} en {2}.',
    },
  ],
  [
    /^When the fighting was done, your banner stood on the hill, and the land was yours\.$/,
    {
      ar: 'حين انتهى القتال، رُفعت رايتك على التل وصارت الأرض لك.',
      fr: 'Le combat fini, votre bannière flottait sur la colline : la terre est à vous.',
    },
  ],
  [
    /^The defenders held, and your warriors fell back to the hold\.$/,
    {
      ar: 'صمد المدافعون، فعاد محاربوك إلى القلعة.',
      fr: 'Les défenseurs ont tenu, vos guerriers sont rentrés.',
    },
  ],
  // ---- players ----
  [
    /^Your warriors sailed against the hold of (.+)\.$/,
    { ar: 'أبحر محاربوك نحو قلعة {1}.', fr: 'Vos guerriers ont fait voile contre le fort de {1}.' },
  ],
  [
    /^Their wall fell, their warriors broke.*$/,
    {
      ar: 'سقط سورهم وانكسر محاربوهم، وعادت سفنك محمّلة بالغنائم.',
      fr: 'Leur mur est tombé, leurs guerriers ont cédé : vos navires rentrent chargés.',
    },
  ],
  [
    /^The defenders held, and your warriors fell back to the ships\.$/,
    {
      ar: 'صمد المدافعون، فتراجع محاربوك إلى السفن.',
      fr: 'Les défenseurs ont tenu, vos guerriers ont regagné les navires.',
    },
  ],
  [
    /^(.+) came against your hold while you were away\.$/,
    { ar: 'هاجم {1} قلعتك أثناء غيابك.', fr: '{1} a attaqué votre fort en votre absence.' },
  ],
  [
    /^They broke through and carried off what they found\.$/,
    { ar: 'اخترقوا الدفاع وحملوا ما وجدوه.', fr: 'Ils ont percé et emporté ce qu’ils ont trouvé.' },
  ],
  [
    /^Your wall and your warriors held them off\.$/,
    { ar: 'صدّهم سورك ومحاربوك.', fr: 'Votre mur et vos guerriers les ont repoussés.' },
  ],
  // ---- sea raids ----
  [
    /^(.+) came out of the sea mist with (\d+) ships\.$/,
    { ar: 'خرج {1} من ضباب البحر بـ {2} سفن.', fr: '{1} est sorti de la brume avec {2} navires.' },
  ],
  [
    /^Your ships met them in the fjord and sent (\d+) keels? to the bottom\.$/,
    {
      ar: 'لاقتهم سفنك في الخليج وأغرقت {1} منها.',
      fr: 'Vos navires les ont affrontés dans le fjord et en ont coulé {1}.',
    },
  ],
  [
    /^Your ships met them in the fjord, but could not stop them\.$/,
    {
      ar: 'لاقتهم سفنك في الخليج لكنها لم توقفهم.',
      fr: 'Vos navires les ont affrontés, sans pouvoir les arrêter.',
    },
  ],
  [
    /^No ships of yours were on the water, and they beached unopposed\.$/,
    {
      ar: 'لم تكن لك سفن في الماء، فرسوا على الشاطئ دون مقاومة.',
      fr: 'Aucun de vos navires n’était à l’eau : ils ont débarqué sans opposition.',
    },
  ],
  [
    /^Not one of them reached the shore alive\.$/,
    { ar: 'لم يصل أحد منهم إلى الشاطئ حيّاً.', fr: 'Pas un n’a atteint le rivage vivant.' },
  ],
  [
    /^There was no wall and no one to hold a shield\. They walked into the hold\.$/,
    {
      ar: 'لم يكن هناك سور ولا من يحمل درعاً. دخلوا القلعة مشياً.',
      fr: 'Ni mur ni bouclier : ils sont entrés dans le fort.',
    },
  ],
  [
    /^They threw themselves at your wall, and the wall held\.$/,
    { ar: 'ارتموا على سورك، وصمد السور.', fr: 'Ils se sont jetés sur votre mur, et le mur a tenu.' },
  ],
  [
    /^Rams and axes broke through your wall\.$/,
    { ar: 'اخترقت الكباش والفؤوس سورك.', fr: 'Béliers et haches ont percé votre mur.' },
  ],
  [
    /^Your shieldwall locked, and the charge broke on it\.$/,
    {
      ar: 'تماسك جدار دروعك، وتحطّم الهجوم عليه.',
      fr: 'Votre mur de boucliers a tenu, la charge s’y est brisée.',
    },
  ],
  [
    /^Arrows fell on them from behind the stakes\.$/,
    { ar: 'انهمرت عليهم السهام من خلف الأوتاد.', fr: 'Les flèches tombaient sur eux de derrière les pieux.' },
  ],
  [
    /^They carried off what they could find and rowed away laughing\. They will be back\.$/,
    {
      ar: 'حملوا ما وجدوه وجذّفوا بعيداً ضاحكين. سيعودون.',
      fr: 'Ils ont emporté ce qu’ils ont pu et sont repartis en riant. Ils reviendront.',
    },
  ],
  [
    /^The raiders fled to their ships\. .*$/,
    {
      ar: 'فرّ الغزاة إلى سفنهم. قلعتك صامدة، وسيذكرها الشعراء.',
      fr: 'Les pillards ont fui vers leurs navires. Votre fort tient, les scaldes s’en souviendront.',
    },
  ],
  // ---- the barrow ----
  [
    /^At dusk the mound split open, and (.+) came out into the snow\.$/,
    {
      ar: 'عند الغسق انشقّ التل، وخرج {1} إلى الثلج.',
      fr: 'Au crépuscule le tertre s’ouvrit, et {1} sortit dans la neige.',
    },
  ],
  [
    /^Cold light burned inside the barrow, and (.+) rose to meet you\.$/,
    {
      ar: 'اشتعل ضوء بارد داخل التل، ونهض {1} لملاقاتك.',
      fr: 'Une lumière froide brûla dans le tertre, et {1} se leva.',
    },
  ],
  [
    /^The dead do not rest easy in that howe\. (.+) stood waiting by the stones\.$/,
    {
      ar: 'الموتى لا يرتاحون في ذلك التل. وقف {1} ينتظر عند الحجارة.',
      fr: 'Les morts ne reposent pas dans ce tertre. {1} attendait près des pierres.',
    },
  ],
  [
    /^Your archers loosed first.*$/,
    {
      ar: 'أطلق رماتك أولاً، فانهمرت السهام على الموتى كالبَرَد.',
      fr: 'Vos archers ont tiré les premiers, les flèches tombaient comme la grêle.',
    },
  ],
  [
    /^Yew bows sang.*$/,
    {
      ar: 'غنّت أقواس الطقسوس، وسقط الصف الأول من الموتى.',
      fr: 'Les arcs d’if ont chanté, le premier rang des morts est tombé.',
    },
  ],
  [
    /^Your shieldwall locked, and the ravagers broke.*$/,
    {
      ar: 'تماسك جدار دروعك، وتحطّم المهاجمون عليه كالموج على الصخر.',
      fr: 'Votre mur de boucliers a tenu, les ravageurs s’y sont brisés.',
    },
  ],
  [
    /^Shield against shield.*$/,
    { ar: 'درعاً إلى درع صمد صفّك، ولم يعبر الموتى.', fr: 'Bouclier contre bouclier, votre ligne a tenu.' },
  ],
  [
    /^Your berserkers ran down the wights.*$/,
    {
      ar: 'طارد البيرسيركر الأشباح قبل أن يشدّوا أقواسهم ثانية.',
      fr: 'Vos berserkers ont fauché les spectres avant qu’ils ne retirent.',
    },
  ],
  [
    /^Howling, the wolf-coats.*$/,
    {
      ar: 'بعواء، انقضّ لابسو جلود الذئاب على الأشباح بين الحجارة.',
      fr: 'Hurlants, les vestes-de-loup ont fondu sur les spectres.',
    },
  ],
  [
    /^Wights loosed black arrows out of the mist\.$/,
    {
      ar: 'أطلقت الأشباح سهاماً سوداء من الضباب.',
      fr: 'Les spectres ont tiré des flèches noires dans la brume.',
    },
  ],
  [
    /^For (\d+) rounds iron rang on bone\.$/,
    { ar: 'لـ {1} جولات رنّ الحديد على العظم.', fr: 'Pendant {1} manches, le fer a sonné sur l’os.' },
  ],
  [
    /^The fight went on until the snow was trampled red\.$/,
    { ar: 'استمر القتال حتى صار الثلج أحمر.', fr: 'Le combat dura jusqu’à ce que la neige soit rouge.' },
  ],
  [
    /^When the mist lifted, (.+) lay still\. The barrow is quiet, for now\.$/,
    {
      ar: 'حين انقشع الضباب، رقد {1} بلا حراك. التل هادئ، الآن.',
      fr: 'Quand la brume se leva, {1} gisait immobile. Le tertre se tait, pour l’instant.',
    },
  ],
  [
    /^At last the dead lay down again, and the howe was silent\.$/,
    {
      ar: 'أخيراً رقد الموتى من جديد، وسكن التل.',
      fr: 'Enfin les morts se recouchèrent, et le tertre se tut.',
    },
  ],
  [
    /^The dead would not fall\..*$/,
    {
      ar: 'لم يسقط الموتى. عاد محاربوك إلى القلعة يحملون جرحاهم.',
      fr: 'Les morts ne tombaient pas. Vos guerriers sont rentrés avec leurs blessés.',
    },
  ],
  [
    /^It was not a day for winning\..*$/,
    {
      ar: 'لم يكن يوم نصر. عاد الناجون في الظلام.',
      fr: 'Ce n’était pas un jour de victoire. Les survivants sont rentrés de nuit.',
    },
  ],
  [
    /^Not one of your warriors was lost\..*$/,
    {
      ar: 'لم تخسر محارباً واحداً. هذا عمل يستحق أغنية.',
      fr: 'Pas un guerrier perdu. Cela mérite un chant.',
    },
  ],
  [
    /^(\d+) of your warriors fell, and (\d+) were carried home wounded\.$/,
    {
      ar: 'سقط {1} من محاربيك، وحُمل {2} جرحى إلى الديار.',
      fr: '{1} de vos guerriers sont tombés, {2} sont rentrés blessés.',
    },
  ],
  [
    /^From the howe you carried home (.+)\.$/,
    { ar: 'حملت من التل إلى الديار: {L1}.', fr: 'Du tertre vous avez rapporté {L1}.' },
  ],
  // ---- notices ----
  [
    /^You swore to stand with the (.+)\.$/,
    { ar: 'أقسمت أن تقف مع {1}.', fr: 'Vous avez juré de vous tenir avec {1}.' },
  ],
  [
    /^Your alliance is blue on the map\..*$/,
    {
      ar: 'تحالفك أزرق على الخريطة. اصطد واجمع واحشد معهم لتكسب نقاط التحالف.',
      fr: 'Votre alliance est bleue sur la carte. Chassez, récoltez et ralliez-vous pour gagner des points.',
    },
  ],
  [
    /^You left the (.+)\. You stand alone now\.$/,
    { ar: 'غادرت {1}. أنت وحدك الآن.', fr: 'Vous avez quitté {1}. Vous êtes seul désormais.' },
  ],
  [
    /^A gift code was redeemed\..*$/,
    {
      ar: 'تم استعمال كود هدية. كل شيء في مخازنك وحقيبتك.',
      fr: 'Un code cadeau a été utilisé. Tout est dans vos réserves et votre Sac.',
    },
  ],
  [
    /^Your alliance won the VS season\.$/,
    { ar: 'فاز تحالفك بموسم VS.', fr: 'Votre alliance a gagné la saison VS.' },
  ],
  [
    /^Your alliance lost the VS season.*$/,
    {
      ar: 'خسر تحالفك موسم VS، لكن كل عمل احتُسب.',
      fr: 'Votre alliance a perdu la saison VS, mais chaque exploit a compté.',
    },
  ],
];

export function sagaLine(line: string, lang: Lang): string {
  if (lang === 'en') return line;
  for (const [re, tr] of LINES) {
    const m = line.match(re);
    if (m)
      return tr[lang]
        .replace(/\{L(\d)\}/g, (_, i: string) => loot(m[Number(i)] ?? '', lang))
        .replace(/\{(\d)\}/g, (_, i: string) => name(m[Number(i)] ?? '', lang));
  }
  return line;
}

const HEADS: Record<string, Tr> = {
  Victory: { ar: 'نصر', fr: 'Victoire' },
  Defeat: { ar: 'هزيمة', fr: 'Défaite' },
  'Victory at the Barrow': { ar: 'نصر في التل', fr: 'Victoire au tertre' },
  'Defeat at the Barrow': { ar: 'هزيمة في التل', fr: 'Défaite au tertre' },
  Scouted: { ar: 'استطلاع', fr: 'Espionné' },
  'Spied on': { ar: 'تم التجسس عليك', fr: 'Espionné par' },
  'Land taken': { ar: 'أرض مأخوذة', fr: 'Terre prise' },
  'Driven back': { ar: 'صُددت', fr: 'Repoussé' },
  'Hold raided': { ar: 'قلعتك نُهبت', fr: 'Fort pillé' },
  'Attack beaten': { ar: 'هجوم مصدود', fr: 'Attaque repoussée' },
  'Raid lost': { ar: 'غارة خاسرة', fr: 'Raid perdu' },
  'Raid beaten': { ar: 'غارة مصدودة', fr: 'Raid repoussé' },
  Joined: { ar: 'انضممت', fr: 'Rejoint' },
  Left: { ar: 'غادرت', fr: 'Quitté' },
  Gift: { ar: 'هدية', fr: 'Cadeau' },
  'VS reward': { ar: 'جائزة VS', fr: 'Récompense VS' },
};

/** "Victory · Wolf Pack" → its two halves, translated. */
export function reportTitle(title: string, lang: Lang): { head: string; name: string } {
  const [head = '', rest = ''] = title.split(' · ');
  const column = rest.endsWith(' (column)');
  let n = column ? rest.slice(0, -' (column)'.length) : rest;
  const tag = n.match(/^(\[[A-Z]+\] )(.*)$/);
  n = tag ? `${tag[1]}${name(tag[2]!, lang)}` : name(n, lang);
  if (lang !== 'en') {
    n = n
      .replace(/^Gift code$/, lang === 'ar' ? 'كود هدية' : 'Code cadeau')
      .replace(/^Season (\d+)$/, lang === 'ar' ? 'الموسم $1' : 'Saison $1');
  }
  if (column) n += ` · ${t('column')}`;
  return { head: lang === 'en' ? head : (HEADS[head]?.[lang] ?? head), name: n };
}
