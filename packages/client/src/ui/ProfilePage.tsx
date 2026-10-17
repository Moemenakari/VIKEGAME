import {
  AVATARS,
  BUILDINGS,
  HEROES,
  ITEMS,
  heroPower,
  homeRealm,
  remainingMs,
  totalPower,
  troopPower,
  type GameState,
  type ItemDef,
  type ItemTarget,
} from '@jarlheim/sim';
import { useEffect, useState } from 'react';
import type { GameStore } from '../game/store';
import { chatBackend } from '../online';
import type { TicketTopic } from '../online/types';
import { formatAmount, formatDuration } from './format';
import { LANGS, bName, errorText, setLang, t, troopName, useLang } from './i18n';
import { AvatarFace, GoldIcon, ResourceIcon } from './icons';
import { setPref, usePrefs } from './prefs';

export type ProfileTab = 'profile' | 'bag' | 'settings';
type Run = (cmd: Parameters<GameStore['dispatch']>[0]) => boolean;

/**
 * Everything about you in one place (owner request, like the genre): who you are and
 * your deeds, your Bag, and the settings for the account, the game and support.
 */
export function ProfilePage({
  store,
  state,
  tab,
  setTab,
  run,
  toast,
  online,
  onClose,
  onSignIn,
  onRestart,
}: {
  store: GameStore;
  state: GameState;
  tab: ProfileTab;
  setTab: (t: ProfileTab) => void;
  run: Run;
  toast: (m: string) => void;
  online: { on: boolean; userId: string | null; allianceName: string | null };
  onClose: () => void;
  onSignIn: () => void;
  onRestart: () => void;
}) {
  return (
    <section
      className="card panel profile-page"
      data-testid="profile"
      role="dialog"
      aria-label={t('profile')}
    >
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      <div className="tabs" role="tablist">
        {(['profile', 'bag', 'settings'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? 'active' : ''}
            onClick={() => setTab(k)}
            data-testid={`profile-tab-${k}`}
          >
            {{ profile: `👤 ${t('profile')}`, bag: `🎒 ${t('bag')}`, settings: `⚙ ${t('settings')}` }[k]}
          </button>
        ))}
      </div>
      {tab === 'profile' && <ProfileTabView state={state} run={run} toast={toast} online={online} />}
      {tab === 'bag' && <BagView store={store} state={state} run={run} toast={toast} />}
      {tab === 'settings' && (
        <SettingsView
          state={state}
          online={online}
          toast={toast}
          run={run}
          onSignIn={onSignIn}
          onRestart={onRestart}
        />
      )}
    </section>
  );
}

/** A short player id for support and friends (the online id when signed in). */
function playerId(state: GameState, userId: string | null): string {
  return userId
    ? userId.slice(0, 8).toUpperCase()
    : `OFF-${(state.seed % 100000).toString().padStart(5, '0')}`;
}

async function copy(text: string, toast: (m: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    toast(t('copied'));
  } catch {
    toast(text);
  }
}

function ProfileTabView({
  state,
  run,
  toast,
  online,
}: {
  state: GameState;
  run: Run;
  toast: (m: string) => void;
  online: { on: boolean; userId: string | null; allianceName: string | null };
}) {
  const [name, setName] = useState(state.profile.name);
  const [social, setSocial] = useState<{ likes: number; roses: number; messages: number } | null>(null);
  useEffect(() => {
    if (!online.on) return;
    chatBackend()
      .socialStats()
      .then(setSocial, () => undefined);
  }, [online.on]);
  const power = totalPower(state);
  const army = troopPower(state);
  const heroes = heroPower(state);
  const realm = homeRealm(state);
  const id = playerId(state, online.userId);
  const stats: Array<[string, string, string]> = [
    ['⚔', t('power'), power.toLocaleString('en-US')],
    ['🏠', t('buildPower'), formatAmount(power - army - heroes)],
    ['🛡', t('armyPower'), formatAmount(army)],
    ['✦', t('heroPower'), formatAmount(heroes)],
    ['💀', t('kills'), formatAmount(state.stats.kills)],
    [
      '🏆',
      t('battlesWon'),
      `${state.stats.battlesWon} / ${state.stats.battlesWon + state.stats.battlesLost}`,
    ],
    ['🔥', t('raidsBeaten'), String(state.stats.raidsBeaten)],
    ['🗺', t('landHeld'), String(state.world.owned.length + 1)],
    ['🦸', t('heroes'), `${Object.keys(state.heroes.owned).length}/${HEROES.length}`],
    ['🏛', t('buildingsCount'), String(Object.keys(state.buildings).length)],
    ['👍', t('likes'), social ? String(social.likes) : '—'],
    ['🌹', t('roses'), social ? String(social.roses) : '—'],
  ];
  return (
    <div data-testid="profile-main">
      <div className="profile-head">
        <AvatarFace id={state.profile.avatar} size={72} />
        <div className="profile-id">
          <form
            className="name-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (run({ type: 'setName', name })) toast(t('renamed'));
            }}
          >
            <input
              value={name}
              maxLength={16}
              onChange={(e) => setName(e.target.value)}
              aria-label={t('name')}
              data-testid="name-input"
            />
            <button className="primary small" type="submit" data-testid="name-save">
              ✓
            </button>
          </form>
          <button className="id-chip" onClick={() => void copy(id, toast)} data-testid="copy-id">
            ID {id} ⧉
          </button>
          <p className="muted">
            🌍 #{realm.id} {realm.name} · 👑 {realm.king}
            {online.allianceName ? ` · 🛡 ${online.allianceName}` : ''}
          </p>
        </div>
      </div>
      <dl className="profile-stats">
        {stats.map(([icon, label, value], i) => (
          <div key={label} data-testid={i === 0 ? 'profile-power' : i === 4 ? 'profile-kills' : undefined}>
            <dt>
              {icon} {label}
            </dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <h3>{t('pictures')}</h3>
      <div className="avatar-grid">
        {AVATARS.map((a) => {
          const owned = state.profile.owned.includes(a.id);
          const current = state.profile.avatar === a.id;
          return (
            <button
              key={a.id}
              className={`avatar-pick ${current ? 'active' : ''} ${owned ? '' : 'locked'}`}
              data-testid={`avatar-${a.id}`}
              onClick={() =>
                owned ? run({ type: 'setAvatar', avatar: a.id }) : run({ type: 'buyAvatar', avatar: a.id })
              }
            >
              <AvatarFace id={a.id} size={56} />
              <small>
                {owned ? (
                  current ? (
                    '✓'
                  ) : (
                    t('free')
                  )
                ) : (
                  <>
                    <GoldIcon size={12} /> {a.cost}
                  </>
                )}
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const ITEM_ICON: Record<ItemDef['kind'], string> = {
  speedup: '⏳',
  chest: '📦',
  heroXp: '📜',
  starShard: '✴',
  teleport: '🌀',
  stamina: '⚡',
};

function BagView({
  store,
  state,
  run,
  toast,
}: {
  store: GameStore;
  state: GameState;
  run: Run;
  toast: (m: string) => void;
}) {
  const [using, setUsing] = useState<string | null>(null);
  const now = store.now();
  const timers = [
    ...state.queue.map((j) => ({
      key: `b-${j.buildingId}`,
      label: `${bName(state.buildings[j.buildingId]?.type ?? 'greatHall')} → ${j.targetLevel}`,
      left: remainingMs(state, j.buildingId, now) ?? 0,
      target: { queue: 'build' as const, buildingId: j.buildingId },
    })),
    ...state.training.map((j) => ({
      key: `t-${j.buildingId}`,
      label: `${j.count} × ${troopName(j.troopId)}`,
      left: Math.max(0, j.endsAt - now),
      target: { queue: 'train' as const, buildingId: j.buildingId },
    })),
    ...(state.healing
      ? [
          {
            key: 'heal',
            label: t('healing'),
            left: Math.max(0, state.healing.endsAt - now),
            target: { queue: 'heal' as const, buildingId: 'healing' },
          },
        ]
      : []),
  ];
  const items = ITEMS.filter((i) => (state.items[i.id] ?? 0) > 0);
  const use = (item: ItemDef, target?: ItemTarget) => {
    if (
      run(
        target
          ? { type: 'useItem', itemId: item.id, count: 1, target }
          : { type: 'useItem', itemId: item.id, count: 1 },
      )
    ) {
      toast(`${itemName(item)} ✓`);
      setUsing(null);
    }
  };
  return (
    <div data-testid="bag">
      <h3>{t('resources')}</h3>
      <div className="bag-resources">
        {(['food', 'timber', 'iron', 'silver', 'gold'] as const).map((r) => (
          <span key={r}>
            <ResourceIcon res={r} size={18} /> {formatAmount(state.resources[r])}
          </span>
        ))}
        <span>📯 {state.heroes.horns}</span>
      </div>
      <h3>{t('items')}</h3>
      {items.length === 0 && <p className="muted">{t('bagEmpty')}</p>}
      <ul className="bag-items">
        {items.map((item) => (
          <li key={item.id}>
            <span className="bag-icon">{ITEM_ICON[item.kind]}</span>
            <span className="quest-body">
              <strong>{itemName(item)}</strong>
              <small className="muted">{itemText(item)}</small>
            </span>
            <b className="bag-count">×{state.items[item.id]}</b>
            {item.kind !== 'teleport' && (
              <button
                className="primary small"
                data-testid={`use-${item.id}`}
                onClick={() =>
                  item.kind === 'chest' || item.kind === 'stamina'
                    ? use(item)
                    : setUsing(using === item.id ? null : item.id)
                }
              >
                {t('use')}
              </button>
            )}
            {using === item.id && item.kind === 'speedup' && (
              <div className="use-targets">
                {timers.length === 0 && <p className="muted">{t('noTimers')}</p>}
                {timers.map((tm) => (
                  <button
                    key={tm.key}
                    className="secondary small"
                    onClick={() => use(item, tm.target)}
                    data-testid={`use-on-${tm.key}`}
                  >
                    {tm.label} · ⏱ {formatDuration(tm.left)}
                  </button>
                ))}
              </div>
            )}
            {using === item.id && (item.kind === 'heroXp' || item.kind === 'starShard') && (
              <div className="use-targets">
                {HEROES.filter((h) => state.heroes.owned[h.id]).map((h) => (
                  <button key={h.id} className="secondary small" onClick={() => use(item, { heroId: h.id })}>
                    {h.name.split(',')[0]} · Lv {state.heroes.owned[h.id]!.level} ·{' '}
                    {'★'.repeat(state.heroes.owned[h.id]!.stars)}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="muted">{t('bagHow')}</p>
    </div>
  );
}

export function itemName(item: ItemDef): string {
  return t(`item_${item.id}`);
}

function itemText(item: ItemDef): string {
  switch (item.kind) {
    case 'speedup':
      return t('item_speed', { n: item.minutes >= 60 ? `${item.minutes / 60}h` : `${item.minutes}m` });
    case 'chest':
      return Object.entries(item.contents)
        .map(([r, n]) => `+${formatAmount(n)} ${t(`res_${r}`)}`)
        .join(' · ');
    case 'heroXp':
      return t('item_heroXp');
    case 'starShard':
      return t('item_star');
    case 'teleport':
      return t(`item_tp_${item.mode}`);
    case 'stamina':
      return t('item_stamina', { n: item.amount });
  }
}

const TOPICS: TicketTopic[] = ['bug', 'account', 'player', 'idea', 'other'];

function SettingsView({
  state,
  online,
  toast,
  run,
  onSignIn,
  onRestart,
}: {
  state: GameState;
  online: { on: boolean; userId: string | null };
  toast: (m: string) => void;
  run: Run;
  onSignIn: () => void;
  onRestart: () => void;
}) {
  const lang = useLang();
  const [code, setCode] = useState('');
  const prefs = usePrefs();
  const [sureReset, setSureReset] = useState(false);
  const [sureDelete, setSureDelete] = useState(false);
  const [topic, setTopic] = useState<TicketTopic>('bug');
  const [body, setBody] = useState('');
  const [legal, setLegal] = useState<'privacy' | 'terms' | null>(null);
  const id = playerId(state, online.userId);
  const toggle = (
    key: 'snow' | 'notifyBuild' | 'notifyRaid' | 'notifyChat' | 'notifyQuest',
    label: string,
  ) => (
    <div className="setting-row" key={key}>
      <span>{label}</span>
      <button
        className={`switch ${prefs[key] ? 'on' : ''}`}
        role="switch"
        aria-checked={prefs[key]}
        onClick={() => setPref(key, !prefs[key])}
        data-testid={`pref-${key}`}
      >
        <i />
      </button>
    </div>
  );
  return (
    <div className="settings-page" data-testid="settings">
      <h3>👤 {t('account')}</h3>
      <div className="setting-row">
        <span>{online.on ? `🌐 ${t('online')}` : `📴 ${t('offlineAccount')}`}</span>
        {!online.on && (
          <button className="primary small" onClick={onSignIn} data-testid="settings-sign-in">
            {t('signIn')}
          </button>
        )}
      </div>
      <form
        className="setting-row gift-code"
        onSubmit={(e) => {
          e.preventDefault();
          if (run({ type: 'redeemCode', code })) setCode('');
        }}
      >
        <span>🎟 {t('giftCode')}</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="XXXX-XXXX"
          maxLength={32}
          data-testid="gift-code"
        />
        <button className="primary small" type="submit" disabled={!code.trim()} data-testid="gift-redeem">
          {t('redeem')}
        </button>
      </form>
      <div className="setting-row">
        <span>ID {id}</span>
        <button className="secondary small" onClick={() => void copy(id, toast)}>
          ⧉ {t('copyId')}
        </button>
      </div>
      {online.on && (
        <div className="setting-row">
          <span>{t('signOut')}</span>
          <button
            className="secondary small"
            onClick={() =>
              void chatBackend()
                .signOut()
                .then(() => toast(t('signedOut')))
            }
          >
            ⏻
          </button>
        </div>
      )}

      <h3>⚙ {t('general')}</h3>
      <div className="segmented">
        {LANGS.map((l) => (
          <button
            key={l}
            className={l === lang ? 'active' : ''}
            onClick={() => setLang(l)}
            data-testid={`lang-${l}`}
          >
            {l === 'ar' ? 'العربية' : l === 'fr' ? 'Français' : 'English'}
          </button>
        ))}
      </div>
      {toggle('snow', `❄ ${t('snow')}`)}

      <h3>🔔 {t('notifications')}</h3>
      {toggle('notifyBuild', t('notifyBuild'))}
      {toggle('notifyRaid', t('notifyRaid'))}
      {toggle('notifyChat', t('notifyChat'))}
      {toggle('notifyQuest', t('notifyQuest'))}

      <h3>💬 {t('support')}</h3>
      {online.on ? (
        <form
          className="support-form"
          onSubmit={(e) => {
            e.preventDefault();
            chatBackend()
              .openTicket(topic, body.trim(), {
                id,
                lang,
                ua: navigator.userAgent.slice(0, 120),
                version: 'M4',
              })
              .then(
                () => {
                  setBody('');
                  toast(t('ticketSent'));
                },
                (err: Error) => toast(errorText(err.message)),
              );
          }}
        >
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value as TicketTopic)}
            data-testid="ticket-topic"
          >
            {TOPICS.map((k) => (
              <option key={k} value={k}>
                {t(`topic_${k}`)}
              </option>
            ))}
          </select>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder={t('ticketPlaceholder')}
            data-testid="ticket-body"
          />
          <button
            className="primary small"
            type="submit"
            disabled={body.trim().length < 5}
            data-testid="ticket-send"
          >
            {t('send')}
          </button>
        </form>
      ) : (
        <p className="muted">{t('supportSignIn')}</p>
      )}

      <h3>📜 {t('legal')}</h3>
      <div className="setting-row">
        <button
          className="link"
          onClick={() => setLegal(legal === 'privacy' ? null : 'privacy')}
          data-testid="privacy"
        >
          {t('privacy')}
        </button>
        <button
          className="link"
          onClick={() => setLegal(legal === 'terms' ? null : 'terms')}
          data-testid="terms"
        >
          {t('terms')}
        </button>
      </div>
      {legal && (
        <div className="legal-text">
          {(legal === 'privacy' ? PRIVACY : TERMS).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      <h3>⚠ {t('danger')}</h3>
      <button
        className={`danger ${sureReset ? 'armed' : ''}`}
        onClick={() => (sureReset ? onRestart() : setSureReset(true))}
        data-testid="restart"
      >
        {sureReset ? t('restartSure') : t('deleteCharacter')}
      </button>
      {online.on && (
        <button
          className={`danger ${sureDelete ? 'armed' : ''}`}
          onClick={() =>
            sureDelete
              ? void chatBackend()
                  .deleteAccount()
                  .then(() => {
                    toast(t('accountDeleted'));
                    onRestart();
                  })
              : setSureDelete(true)
          }
          data-testid="delete-account"
        >
          {sureDelete ? t('deleteAccountSure') : t('deleteAccount')}
        </button>
      )}
      <p className="muted">
        Jarlheim · M4 · {Object.keys(BUILDINGS).length} {t('buildingsCount')}
      </p>
    </div>
  );
}

/** Short, plain policies (English; the full text lives in docs/PRIVACY.md and docs/TERMS.md). */
const PRIVACY = [
  'Jarlheim is a free game. Your hold is saved on your own device.',
  'If you sign in, we keep only what the game needs: your player name, your hold on the realm map, your chat messages, friends and support tickets. Google sign-in shares your Google account id with us, never your password.',
  'We do not sell data and we show no ads. Chat is moderated: reported messages may be read by the team.',
  'You can delete your account at any time in Settings; this removes your online data.',
];

const TERMS = [
  'Play fair: no cheating, bots, abuse, hate or scams. Respect other players in chat.',
  'Gold is earned by playing. There are no payments in this version.',
  'Accounts that break these rules may be muted or removed.',
  'The game is provided as it is, while it is being built. Things may change or reset.',
];
