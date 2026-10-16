import { ALLIANCES, type GameState } from '@jarlheim/sim';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalBackend } from '../online/localBackend';
import { SupabaseBackend } from '../online/supabaseBackend';
import {
  REACTIONS,
  allianceChannelId,
  canSendImage,
  realmChannelId,
  type ChatBackend,
  type ChatChannel,
  type ChatMessage,
  type ChatProfile,
  type FriendEntry,
} from '../online/types';
import { errorText, t } from './i18n';

let backend: ChatBackend | null = null;
/** One chat connection for the whole app. `?chat=local` uses the offline stand-in (tests, demos). */
export function chatBackend(): ChatBackend {
  if (!backend) {
    const local = new URLSearchParams(location.search).get('chat') === 'local';
    backend = local ? new LocalBackend() : new SupabaseBackend();
  }
  return backend;
}

type Tab = 'realm' | 'alliance' | 'private' | 'groups' | 'friends';

/**
 * Chat & friends (GDD §19): your realm's chat, your alliance's chat, private
 * messages, groups and friends. Images by VIP level, reactions and roses.
 */
export function ChatPanel({
  state,
  onClose,
  onOpenWorld,
}: {
  state: GameState;
  onClose: () => void;
  onOpenWorld: () => void;
}) {
  const chat = chatBackend();
  const [status, setStatus] = useState<'loading' | 'out' | 'noProfile' | 'ready' | 'offline'>('loading');
  const [me, setMe] = useState<ChatProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('realm');
  const [open, setOpen] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await chat.connect();
      setMe(r.me);
      setStatus(!r.signedIn ? 'out' : r.me ? 'ready' : 'noProfile');
    } catch {
      setStatus('offline');
    }
  }, [chat]);
  useEffect(() => void refresh(), [refresh]);

  // Your alliance chat follows the alliance you joined on the world map.
  useEffect(() => {
    if (status !== 'ready') return;
    chat.joinAllianceChat(state.world.realm, state.world.alliance).catch(() => undefined);
  }, [status, chat, state.world.realm, state.world.alliance]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(errorText((e as Error).message));
    }
  };

  return (
    <section className="card panel chat" data-testid="chat" role="dialog" aria-label={t('chat')}>
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      {status === 'loading' && <p className="muted">…</p>}
      {status === 'offline' && <p className="muted">{t('chatOffline')}</p>}
      {status === 'out' && <SignIn chat={chat} act={act} error={error} />}
      {status === 'noProfile' && (
        <NameForm
          initial={state.profile.name}
          onSave={(n) => act(() => chat.createProfile(n))}
          error={error}
        />
      )}
      {status === 'ready' && me && (
        <>
          <div className="chat-me">
            <strong>{me.name}</strong>
            <span className="vip">VIP {me.vip}</span>
            <button
              className="secondary small"
              onClick={() => act(() => chat.claimDaily())}
              data-testid="vip-daily"
            >
              ⭐ +VIP
            </button>
            <button className="secondary small" onClick={() => act(() => chat.signOut())}>
              ⏻
            </button>
          </div>
          {error && <p className="blocked">{error}</p>}
          {open ? (
            <Conversation chat={chat} me={me} channelId={open} onBack={() => setOpen(null)} />
          ) : (
            <>
              <div className="tabs chat-tabs" role="tablist">
                {(['realm', 'alliance', 'private', 'groups', 'friends'] as const).map((k) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={tab === k}
                    className={tab === k ? 'active' : ''}
                    onClick={() => setTab(k)}
                    data-testid={`chat-${k}`}
                  >
                    {{ realm: '🌍', alliance: '🛡', private: '✉', groups: '👥', friends: '❤' }[k]}
                  </button>
                ))}
              </div>
              {tab === 'realm' && (
                <Conversation chat={chat} me={me} channelId={realmChannelId(state.world.realm)} embedded />
              )}
              {tab === 'alliance' &&
                (state.world.alliance === null ? (
                  <div>
                    <p className="muted">{t('duelJoin')}</p>
                    <button className="primary" onClick={onOpenWorld}>
                      🌍 {t('alliances')}
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="norse">
                      [{ALLIANCES[state.world.alliance]!.tag}] {ALLIANCES[state.world.alliance]!.name}
                    </p>
                    <Conversation
                      chat={chat}
                      me={me}
                      channelId={allianceChannelId(state.world.realm, state.world.alliance)}
                      embedded
                    />
                  </>
                ))}
              {(tab === 'private' || tab === 'groups') && (
                <ChannelList
                  chat={chat}
                  me={me}
                  kind={tab === 'private' ? 'dm' : 'group'}
                  onOpen={setOpen}
                  act={act}
                />
              )}
              {tab === 'friends' && <Friends chat={chat} onOpen={setOpen} act={act} />}
            </>
          )}
        </>
      )}
    </section>
  );
}

function SignIn({
  chat,
  act,
  error,
}: {
  chat: ChatBackend;
  act: (fn: () => Promise<unknown>) => Promise<void>;
  error: string | null;
}) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  return (
    <div className="sign-in" data-testid="sign-in">
      <h2>{t('account')}</h2>
      <p className="muted">{t('accountWhy')}</p>
      <button className="google" onClick={() => act(() => chat.signInGoogle())} data-testid="google">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5 5 0 01-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8z"
          />
          <path
            fill="#34A853"
            d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.6H2.1v2.8A11 11 0 0012 23z"
          />
          <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 010-4.2V7.1H2.1a11 11 0 000 9.8z" />
          <path
            fill="#EA4335"
            d="M12 5.4c1.6 0 3 .6 4.1 1.6l3.1-3.1A11 11 0 002.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"
          />
        </svg>
        {t('google')}
      </button>
      <form
        className="pw-form"
        onSubmit={(e) => {
          e.preventDefault();
          void act(() => (mode === 'up' ? chat.signUp(user, pass) : chat.signIn(user, pass)));
        }}
      >
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder={t('username')}
          autoComplete="username"
          data-testid="username"
        />
        <input
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          type="password"
          placeholder={t('password')}
          autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
          data-testid="password"
        />
        <button className="primary" type="submit" data-testid="pw-submit">
          {mode === 'up' ? t('signUp') : t('signIn')}
        </button>
      </form>
      <button className="link" onClick={() => setMode(mode === 'up' ? 'in' : 'up')} data-testid="pw-mode">
        {mode === 'up' ? t('haveAccount') : t('newAccount')}
      </button>
      <button className="secondary" onClick={() => act(() => chat.playAsGuest())} data-testid="guest">
        {t('guest')}
      </button>
      {error && <p className="blocked">{error}</p>}
    </div>
  );
}

function NameForm({
  initial,
  onSave,
  error,
}: {
  initial: string;
  onSave: (n: string) => void;
  error: string | null;
}) {
  const [name, setName] = useState(initial);
  return (
    <form
      className="sign-in"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(name.trim());
      }}
    >
      <h2>{t('chatName')}</h2>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} data-testid="chat-name" />
      <button className="primary" type="submit" data-testid="chat-name-save">
        ✓
      </button>
      {error && <p className="blocked">{error}</p>}
    </form>
  );
}

function Conversation({
  chat,
  me,
  channelId,
  embedded,
  onBack,
}: {
  chat: ChatBackend;
  me: ChatProfile;
  channelId: string;
  embedded?: boolean;
  onBack?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<ChatChannel['kind']>('realm');
  const list = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    chat
      .messages(channelId)
      .then((m) => alive && setMessages(m))
      .catch((e: Error) => setError(errorText(e.message)));
    chat
      .channels()
      .then((cs) => alive && setKind(cs.find((c) => c.id === channelId)?.kind ?? 'realm'))
      .catch(() => undefined);
    const off = chat.subscribe(channelId, (m) => setMessages((all) => [...all, m]));
    void chat.markRead(channelId);
    return () => {
      alive = false;
      off();
    };
  }, [chat, channelId]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages]);

  const send = async (image?: Blob) => {
    if (!text.trim() && !image) return;
    setError(null);
    try {
      await chat.send(channelId, text.trim(), image);
      setText('');
    } catch (e) {
      setError(errorText((e as Error).message));
    }
  };
  const react = async (m: ChatMessage, emoji: (typeof REACTIONS)[number]) => {
    const on = !(m.reactions[emoji] ?? []).includes(me.id);
    await chat.react(m.id, emoji, on).catch(() => undefined);
    setMessages((all) =>
      all.map((x) =>
        x.id !== m.id
          ? x
          : {
              ...x,
              reactions: {
                ...x.reactions,
                [emoji]: on
                  ? [...(x.reactions[emoji] ?? []), me.id]
                  : (x.reactions[emoji] ?? []).filter((u) => u !== me.id),
              },
            },
      ),
    );
  };

  return (
    <div className={`conversation ${embedded ? 'embedded' : ''}`} data-testid="conversation">
      {onBack && (
        <button className="link" onClick={onBack}>
          ← {t('back')}
        </button>
      )}
      <div className="messages" ref={list}>
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.senderId === me.id ? 'mine' : ''}`}>
            <span className="who">
              {m.senderName}
              {m.senderVip > 0 && <span className="vip">VIP {m.senderVip}</span>}
            </span>
            {m.body && <p>{m.body}</p>}
            {m.imageUrl && <img src={m.imageUrl} alt="" loading="lazy" />}
            <span className="reacts">
              {REACTIONS.slice(0, 3).map((e) => (
                <button key={e} onClick={() => void react(m, e)} data-testid={`react-${e}`}>
                  {e}
                  {(m.reactions[e]?.length ?? 0) > 0 && <small>{m.reactions[e]!.length}</small>}
                </button>
              ))}
            </span>
          </div>
        ))}
        {messages.length === 0 && <p className="muted">{t('noMessages')}</p>}
      </div>
      {error && <p className="blocked">{error}</p>}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {canSendImage(me.vip, kind) && (
          <>
            <button
              type="button"
              className="secondary small"
              onClick={() => file.current?.click()}
              aria-label="📷"
            >
              📷
            </button>
            <input
              ref={file}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void send(f);
                e.target.value = '';
              }}
            />
          </>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder={t('message')}
          data-testid="chat-input"
        />
        <button className="primary small" type="submit" data-testid="chat-send">
          ➤
        </button>
      </form>
    </div>
  );
}

function ChannelList({
  chat,
  me,
  kind,
  onOpen,
  act,
}: {
  chat: ChatBackend;
  me: ChatProfile;
  kind: 'dm' | 'group';
  onOpen: (id: string) => void;
  act: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [name, setName] = useState('');
  const [pick, setPick] = useState<string[]>([]);
  useEffect(() => {
    chat.channels().then(
      (cs) => setChannels(cs.filter((c) => c.kind === kind)),
      () => undefined,
    );
    if (kind === 'group') chat.friends().then(setFriends, () => undefined);
  }, [chat, kind]);
  return (
    <div>
      <ul className="channel-list">
        {channels.map((c) => (
          <li key={c.id}>
            <button className="report-item" onClick={() => onOpen(c.id)}>
              <span>{kind === 'dm' ? '✉' : '👥'}</span>
              <span>
                <strong>{c.title}</strong>
                <small className="muted"> {c.lastBody ?? ''}</small>
              </span>
              {c.unread > 0 && <span className="badge-dot static">{c.unread}</span>}
            </button>
          </li>
        ))}
        {channels.length === 0 && <p className="muted">{kind === 'dm' ? t('noDms') : t('noGroups')}</p>}
      </ul>
      {kind === 'group' && (
        <div className="section">
          <h3>{t('newGroup')}</h3>
          {me.vip < 1 && <p className="muted">{t('groupVip')}</p>}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('groupName')}
            maxLength={40}
          />
          <div className="send-list">
            {friends
              .filter((f) => f.status === 'friend')
              .map((f) => (
                <label key={f.id} className="send-item">
                  <input
                    type="checkbox"
                    checked={pick.includes(f.id)}
                    onChange={() =>
                      setPick(pick.includes(f.id) ? pick.filter((x) => x !== f.id) : [...pick, f.id])
                    }
                  />
                  {f.name}
                </label>
              ))}
          </div>
          <button
            className="primary"
            disabled={!name.trim()}
            onClick={() =>
              act(async () => {
                const id = await chat.createGroup(name.trim(), pick);
                onOpen(id);
              })
            }
          >
            👥 {t('create')}
          </button>
        </div>
      )}
    </div>
  );
}

function Friends({
  chat,
  onOpen,
  act,
}: {
  chat: ChatBackend;
  onOpen: (id: string) => void;
  act: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<ChatProfile[]>([]);
  const load = useCallback(() => chat.friends().then(setFriends, () => undefined), [chat]);
  useEffect(() => void load(), [load]);
  return (
    <div data-testid="friends">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          chat.search(e.target.value).then(setFound, () => undefined);
        }}
        placeholder={t('searchPlayers')}
        data-testid="friend-search"
      />
      {found.length > 0 && (
        <ul className="channel-list">
          {found.map((p) => (
            <li key={p.id} className="friend">
              <span>{p.name}</span>
              <button className="primary small" onClick={() => act(() => chat.addFriend(p.id).then(load))}>
                + {t('addFriend')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <ul className="channel-list">
        {friends.map((f) => (
          <li key={f.id} className="friend">
            <span>
              <i className={`dot ${f.online ? 'on' : ''}`} /> {f.name}
              {f.vip > 0 && <span className="vip">VIP {f.vip}</span>}
            </span>
            {f.status === 'incoming' && (
              <button
                className="primary small"
                onClick={() => act(() => chat.respondFriend(f.id, true).then(load))}
              >
                ✓ {t('accept')}
              </button>
            )}
            {f.status === 'outgoing' && <small className="muted">{t('pending')}</small>}
            {f.status === 'friend' && (
              <button
                className="secondary small"
                data-testid={`dm-${f.name}`}
                onClick={() =>
                  act(async () => {
                    onOpen(await chat.openDm(f.id));
                  })
                }
              >
                ✉
              </button>
            )}
          </li>
        ))}
        {friends.length === 0 && <p className="muted">{t('noFriends')}</p>}
      </ul>
    </div>
  );
}
