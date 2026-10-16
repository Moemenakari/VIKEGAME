import {
  ALLIANCES,
  REALMS,
  TROOPS,
  WORLD,
  allianceDuel,
  armyStrength,
  bordersHold,
  kingsWar,
  realmMap,
  sumCounts,
  tileAt,
  tileGarrison,
  tileKey,
  tileLimit,
  tileOwner,
  cleanSnapshot,
  hallLevel,
  type GameState,
  type Tile,
} from '@jarlheim/sim';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameStore } from '../game/store';
import { formatAmount, formatDuration } from './format';
import { t, troopName } from './i18n';
import type { Online } from './useOnline';
import type { RealmPlayer } from '../online/realm';
import { AvatarFace, ResourceIcon, TroopTypeIcon } from './icons';

/**
 * Midgard: the world map of your realm (server). Alliances and their land, the
 * Law Rock in the middle with the King, trading towns, ring forts, your hold and
 * the land you have taken. Drawn on one canvas in one pass (no DOM per tile).
 */
const KIND_COLOR: Record<string, string> = {
  sea: '#1d4a6e',
  field: '#d9dccf',
  forest: '#7f9a7a',
  hills: '#a29d94',
  town: '#d9dccf',
  fort: '#b8b2a4',
  capital: '#e8d9a8',
};

export function WorldMap({
  store,
  state,
  onClose,
  onError,
  onReport,
  online,
  onSignIn,
}: {
  store: GameStore;
  state: GameState;
  onClose: () => void;
  onError: (m: string) => void;
  onReport: (id: number) => void;
  online: Online;
  onSignIn: () => void;
}) {
  const [realmId, setRealmId] = useState(state.world.realm);
  const { refresh } = online;
  useEffect(() => void refresh(realmId), [refresh, realmId]);
  const others = online.players.filter((p) => p.realm === realmId && p.id !== online.userId);
  const map = useMemo(() => realmMap(realmId), [realmId]);
  const mine = realmId === state.world.realm;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState(() => {
    // Start between your hold and the Law Rock, so both are in sight.
    const c = (realmMap(state.world.realm).size - 1) / 2 + 0.5;
    return { x: (state.world.home.x + 0.5 + c) / 2, y: (state.world.home.y + 0.5 + c) / 2, scale: 15 };
  });
  const [picked, setPicked] = useState<Tile | null>(null);
  const [sheet, setSheet] = useState<'alliances' | 'events' | null>(null);
  const [sending, setSending] = useState(false);
  const now = store.now();

  // Draw everything in one pass.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = KIND_COLOR.sea!;
    ctx.fillRect(0, 0, w, h);
    const s = view.scale;
    const ox = w / 2 - view.x * s;
    const oy = h / 2 - view.y * s;
    const owned = new Set(mine ? state.world.owned : []);
    for (const tile of map.tiles) {
      const px = ox + tile.x * s;
      const py = oy + tile.y * s;
      if (px < -s || py < -s || px > w || py > h) continue;
      ctx.fillStyle = KIND_COLOR[tile.kind]!;
      ctx.fillRect(px, py, s + 0.5, s + 0.5);
      const owner = mine ? tileOwner(state, tile) : tile.owner;
      if (owner !== null && tile.kind !== 'sea') {
        ctx.fillStyle = owner === -1 ? 'rgba(255, 214, 119, 0.55)' : hexA(ALLIANCES[owner]!.color, 0.42);
        ctx.fillRect(px, py, s + 0.5, s + 0.5);
      }
      if (owned.has(tileKey(tile.x, tile.y))) {
        ctx.strokeStyle = '#ffd677';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, s - 2, s - 2);
      }
      if (s >= 16 && tile.kind === 'forest') {
        ctx.fillStyle = '#3f5e3a';
        ctx.beginPath();
        ctx.moveTo(px + s * 0.5, py + s * 0.2);
        ctx.lineTo(px + s * 0.75, py + s * 0.75);
        ctx.lineTo(px + s * 0.25, py + s * 0.75);
        ctx.fill();
      }
      if (s >= 16 && tile.kind === 'hills') {
        ctx.fillStyle = '#7c776f';
        ctx.beginPath();
        ctx.moveTo(px + s * 0.15, py + s * 0.8);
        ctx.lineTo(px + s * 0.45, py + s * 0.3);
        ctx.lineTo(px + s * 0.75, py + s * 0.8);
        ctx.fill();
      }
    }
    // Grid lines, faintly, when zoomed in.
    if (s >= 20) {
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= map.size; i++) {
        ctx.moveTo(ox + i * s, oy);
        ctx.lineTo(ox + i * s, oy + map.size * s);
        ctx.moveTo(ox, oy + i * s);
        ctx.lineTo(ox + map.size * s, oy + i * s);
      }
      ctx.stroke();
    }
    const icon = (x: number, y: number, glyph: string, size: number) => {
      ctx.font = `${size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, ox + (x + 0.5) * s, oy + (y + 0.5) * s);
    };
    const label = (x: number, y: number, text: string, color = '#fff') => {
      ctx.font = `700 ${Math.max(10, s * 0.42)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(text, ox + (x + 0.5) * s, oy + (y + 1.35) * s);
      ctx.fillStyle = color;
      ctx.fillText(text, ox + (x + 0.5) * s, oy + (y + 1.35) * s);
    };
    const c = (map.size - 1) / 2;
    icon(c, c, '👑', s * 1.6);
    label(c, c + 0.6, `${t('lawRock')} · ${map.realm.king}`, '#ffd677');
    for (const seat of map.seats) {
      icon(seat.x, seat.y, '🏰', s * 0.95);
      label(seat.x, seat.y, `[${ALLIANCES[seat.alliance]!.tag}]`, ALLIANCES[seat.alliance]!.color);
    }
    for (const town of map.towns) {
      icon(town.x, town.y, '⚖️', s * 0.8);
      label(town.x, town.y, town.name);
    }
    for (const p of others) {
      icon(p.x, p.y, '🏠', s * 0.9);
      label(p.x, p.y, p.alliance ? `[${p.alliance.tag}] ${p.name}` : p.name, '#bfe9ff');
    }
    if (mine) {
      icon(state.world.home.x, state.world.home.y, '🛖', s * 1.05);
      label(state.world.home.x, state.world.home.y, state.profile.name, '#ffd677');
    }
    if (picked) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.strokeRect(ox + picked.x * s, oy + picked.y * s, s, s);
    }
  }, [map, view, state, mine, picked, others]);

  // Pan with one finger, pinch or wheel to zoom, tap to pick a tile.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const clampScale = (v: number) => Math.min(48, Math.max(8, v));
  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    press.current = pointers.current.size === 1 ? { x: e.clientX, y: e.clientY, moved: false } : null;
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 8)
      press.current.moved = true;
    if (pointers.current.size === 1) {
      setView((v) => ({
        ...v,
        x: v.x - (e.clientX - prev.x) / v.scale,
        y: v.y - (e.clientY - prev.y) / v.scale,
      }));
    } else if (pointers.current.size === 2) {
      const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (before > 0) setView((v) => ({ ...v, scale: clampScale((v.scale * after) / before) }));
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onUp = (e: React.PointerEvent) => {
    const p = press.current;
    pointers.current.delete(e.pointerId);
    press.current = null;
    if (!p || p.moved) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = Math.floor(view.x + (e.clientX - rect.left - rect.width / 2) / view.scale);
    const y = Math.floor(view.y + (e.clientY - rect.top - rect.height / 2) / view.scale);
    const tile = tileAt(map, x, y);
    setPicked(tile ?? null);
    setSending(false);
  };

  const war = kingsWar(now, state.world.realm);
  const duel = allianceDuel(state, now);
  const alliancePower = (i: number) =>
    map.tiles.filter((x) => x.owner === i).length * 9_500 + i * 3_100 + 41_000;

  return (
    <section
      className="world"
      data-testid="world-map"
      data-players={others.length}
      role="dialog"
      aria-label={t('world')}
    >
      <canvas
        ref={canvasRef}
        className="world-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={(e) => setView((v) => ({ ...v, scale: clampScale(v.scale * Math.exp(-e.deltaY * 0.0015)) }))}
      />
      <header className="world-top">
        <div className="realm-tabs" role="tablist">
          {REALMS.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={r.id === realmId}
              className={r.id === realmId ? 'active' : ''}
              onClick={() => {
                setRealmId(r.id);
                setPicked(null);
              }}
              data-testid={`realm-${r.id}`}
            >
              #{r.id} {r.name}
              {r.id === state.world.realm && ' ★'}
            </button>
          ))}
        </div>
      </header>
      <aside className="world-side">
        <button
          className="round"
          onClick={() => setSheet(sheet === 'alliances' ? null : 'alliances')}
          aria-label={t('alliances')}
          data-testid="alliances-button"
        >
          🛡
        </button>
        <button
          className="round"
          onClick={() => setSheet(sheet === 'events' ? null : 'events')}
          aria-label={t('events')}
          data-testid="events-button"
        >
          ⚔{war.live && <span className="badge-dot">!</span>}
        </button>
        <button
          className="round"
          onClick={() => {
            setRealmId(state.world.realm);
            setView((v) => ({ ...v, x: state.world.home.x + 0.5, y: state.world.home.y + 0.5 }));
          }}
          aria-label={t('myHold')}
        >
          <AvatarFace id={state.profile.avatar} size={30} />
        </button>
      </aside>

      {sheet === 'alliances' && (
        <div className="card panel world-sheet" data-testid="alliances">
          <button className="close" onClick={() => setSheet(null)} aria-label={t('close')}>
            ×
          </button>
          <h2>{t('alliances')}</h2>
          <p className="norse">
            👑 {map.realm.king} · [{ALLIANCES[map.realm.kingAlliance]!.tag}]
          </p>
          <PlayerAlliances online={online} mine={mine} onSignIn={onSignIn} onError={onError} />
          <h3>🤖 {t('aiAlliances')}</h3>
          <ul className="alliance-list">
            {ALLIANCES.map((a, i) => (
              <li key={a.tag}>
                <span className="swatch" style={{ background: a.color }} />
                <span className="quest-body">
                  <strong>
                    [{a.tag}] {a.name}
                  </strong>
                  <span className="muted">
                    ⚔ {formatAmount(alliancePower(i))} · {map.tiles.filter((x) => x.owner === i).length} 🗺
                    {i === map.realm.kingAlliance && ' · 👑'}
                  </span>
                </span>
                {mine &&
                  (state.world.alliance === i ? (
                    <button
                      className="secondary small"
                      onClick={() => store.dispatch({ type: 'joinAlliance', alliance: null })}
                    >
                      {t('leave')}
                    </button>
                  ) : (
                    <button
                      className="primary small"
                      data-testid={`join-${a.tag}`}
                      onClick={() => store.dispatch({ type: 'joinAlliance', alliance: i })}
                    >
                      {t('join')}
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sheet === 'events' && (
        <div className="card panel world-sheet" data-testid="events">
          <button className="close" onClick={() => setSheet(null)} aria-label={t('close')}>
            ×
          </button>
          <h2>{t('events')}</h2>
          <h3>👑 {t('kingsWar')}</h3>
          <p className="stat">
            #{state.world.realm} {REALMS.find((r) => r.id === state.world.realm)!.name} ⚔ #{war.opponent.id}{' '}
            {war.opponent.name}
          </p>
          <p className={war.live ? 'stat warn-text' : 'muted'}>
            {war.live
              ? t('warLive', { t: formatDuration(war.end - now) })
              : t('warIn', { t: formatDuration(war.start - now) })}
          </p>
          {online.on && (
            <div className="duel" data-testid="war-score">
              <span>
                #{state.world.realm} <b>{formatAmount(online.warScores[state.world.realm] ?? 0)}</b>
              </span>
              <span>VS</span>
              <span>
                <b>{formatAmount(online.warScores[war.opponent.id] ?? 0)}</b> #{war.opponent.id}
              </span>
            </div>
          )}
          <p className="muted">{t('kingsWarHow')}</p>
          <h3>🛡 {t('duel')}</h3>
          {duel.rival === null ? (
            <p className="muted">{t('duelJoin')}</p>
          ) : (
            <>
              <p className="muted">{t(`duel_${duel.theme}`)}</p>
              <div className="duel">
                <span>
                  [{ALLIANCES[state.world.alliance!]!.tag}] <b>{formatAmount(duel.team)}</b>
                </span>
                <span>VS</span>
                <span>
                  <b>{formatAmount(duel.enemy)}</b> [{ALLIANCES[duel.rival]!.tag}]
                </span>
              </div>
              <p className="stat">⭐ {t('duelYours', { n: formatAmount(duel.yours) })}</p>
            </>
          )}
        </div>
      )}

      {picked && !sheet && others.some((p) => p.x === picked.x && p.y === picked.y) && (
        <PlayerCard
          store={store}
          state={state}
          player={others.find((p) => p.x === picked.x && p.y === picked.y)!}
          online={online}
          onError={onError}
          onReport={onReport}
          onClose={() => setPicked(null)}
        />
      )}
      {picked && !sheet && !others.some((p) => p.x === picked.x && p.y === picked.y) && (
        <TileCard
          store={store}
          state={state}
          tile={picked}
          mine={mine}
          sending={sending}
          setSending={setSending}
          onError={onError}
          onReport={onReport}
          onClose={() => setPicked(null)}
        />
      )}

      <button className="world-home" onClick={onClose} aria-label={t('myHold')} data-testid="world-home">
        🛖
      </button>
    </section>
  );
}

function TileCard({
  store,
  state,
  tile,
  mine,
  sending,
  setSending,
  onError,
  onReport,
  onClose,
}: {
  store: GameStore;
  state: GameState;
  tile: Tile;
  mine: boolean;
  sending: boolean;
  setSending: (v: boolean) => void;
  onError: (m: string) => void;
  onReport: (id: number) => void;
  onClose: () => void;
}) {
  const owner = mine ? tileOwner(state, tile) : tile.owner;
  const yieldOf = WORLD.tileYield[tile.kind];
  const land = Object.fromEntries(
    Object.entries(state.army.troops).filter(([id, n]) => n > 0 && TROOPS[id]?.type !== 'ship'),
  );
  const [left, setLeft] = useState<Record<string, boolean>>({});
  const send = Object.fromEntries(Object.entries(land).filter(([id]) => !left[id]));
  const ours = armyStrength(Object.entries(send).map(([id, count]) => ({ ...TROOPS[id]!, count })));
  const theirs = armyStrength(tileGarrison(tile, owner === -1 ? null : owner));
  const canTry =
    mine &&
    owner !== -1 &&
    tile.kind !== 'sea' &&
    tile.kind !== 'capital' &&
    tile.kind !== 'fort' &&
    !(owner !== null && owner === state.world.alliance) &&
    bordersHold(state, tile.x, tile.y);
  const full = state.world.owned.length + 1 >= tileLimit(hallLevel(state));
  const kindName = t(`tile_${tile.kind}`);
  return (
    <div className="card panel world-sheet" data-testid="tile-card">
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      <h2>
        {kindName} · {t('level', { n: tile.level })}
      </h2>
      <p className="norse">
        {tile.region} ({tile.x}, {tile.y}) ·{' '}
        {owner === -1
          ? t('yours')
          : owner === null
            ? t('freeLand')
            : `[${ALLIANCES[owner]!.tag}] ${ALLIANCES[owner]!.name}`}
      </p>
      {yieldOf && (
        <p className="stat">
          {Object.entries(yieldOf).map(([r, v]) => (
            <span key={r} className="cost">
              <ResourceIcon res={r as 'food'} size={14} /> +{v * tile.level}/h
            </span>
          ))}
        </p>
      )}
      {tile.kind === 'capital' && <p>{t('capitalHow')}</p>}
      {tile.kind === 'fort' && <p>{t('fortHow')}</p>}
      {canTry && !sending && (
        <button className="primary" disabled={full} onClick={() => setSending(true)} data-testid="conquer">
          ⚔ {full ? t('landFull') : t('conquer')}
        </button>
      )}
      {mine &&
        !canTry &&
        owner !== -1 &&
        tile.kind !== 'sea' &&
        tile.kind !== 'capital' &&
        tile.kind !== 'fort' && <p className="muted">{t('notBorder')}</p>}
      {sending && (
        <>
          <p className="muted">
            {t('garrison')}:{' '}
            {tileGarrison(tile, owner === -1 ? null : owner).map((g) => (
              <span key={g.key} className="cost">
                <TroopTypeIcon type={g.type} size={14} /> {g.count}
              </span>
            ))}
          </p>
          <div className="send-list">
            {Object.entries(land).map(([id, n]) => (
              <label key={id} className="send-item">
                <input
                  type="checkbox"
                  checked={!left[id]}
                  onChange={() => setLeft({ ...left, [id]: !left[id] })}
                />
                <TroopTypeIcon type={TROOPS[id]!.type} size={16} /> {n} {troopName(id)}
              </label>
            ))}
            {sumCounts(land) === 0 && <p className="muted">{t('noneHome')}</p>}
          </div>
          <p
            className={`verdict ${ours >= theirs * 1.6 ? 'favourable' : ours >= theirs * 1.1 ? 'even' : 'risky'}`}
          >
            {t('odds')}:{' '}
            <strong>
              {t(ours >= theirs * 1.6 ? 'favourable' : ours >= theirs * 1.1 ? 'even' : 'risky')}
            </strong>{' '}
            · {t('vsLine', { a: formatAmount(ours), b: formatAmount(theirs) })}
          </p>
          <button
            className="primary"
            disabled={sumCounts(send) === 0}
            data-testid="march"
            onClick={() => {
              const before = state.nextReportId;
              const err = store.dispatch({ type: 'conquerTile', x: tile.x, y: tile.y, troops: send });
              if (err) onError(err.message);
              else {
                setSending(false);
                onReport(before);
              }
            }}
          >
            ⚔ {t('march')}
          </button>
        </>
      )}
    </div>
  );
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Player alliances of the realm: found one (Great Hall 5) or join one; each has its own chat. */
function PlayerAlliances({
  online,
  mine,
  onSignIn,
  onError,
}: {
  online: Online;
  mine: boolean;
  onSignIn: () => void;
  onError: (m: string) => void;
}) {
  const [tag, setTag] = useState('');
  const [name, setName] = useState('');
  if (!online.on) {
    return (
      <div className="online-hint">
        <p className="muted">{t('onlineHint')}</p>
        <button className="primary" onClick={onSignIn} data-testid="online-sign-in">
          🌐 {t('signIn')}
        </button>
      </div>
    );
  }
  const myAlliance = online.mine?.alliance?.id ?? null;
  return (
    <>
      <h3>🌐 {t('playerAlliances')}</h3>
      <ul className="alliance-list" data-testid="player-alliances">
        {online.alliances.map((a) => (
          <li key={a.id}>
            <span className="swatch" style={{ background: '#ffd677' }} />
            <span className="quest-body">
              <strong>
                [{a.tag}] {a.name}
              </strong>
              <span className="muted">👥 {a.members}</span>
            </span>
            {mine &&
              (myAlliance === a.id ? (
                <button
                  className="secondary small"
                  onClick={() => online.joinAlliance(null).catch((e: Error) => onError(e.message))}
                >
                  {t('leave')}
                </button>
              ) : (
                <button
                  className="primary small"
                  onClick={() => online.joinAlliance(a.id).catch((e: Error) => onError(e.message))}
                >
                  {t('join')}
                </button>
              ))}
          </li>
        ))}
        {online.alliances.length === 0 && <p className="muted">{t('noPlayerAlliances')}</p>}
      </ul>
      {mine && !myAlliance && (
        <form
          className="new-alliance"
          onSubmit={(e) => {
            e.preventDefault();
            online.createAlliance(tag, name).catch((err: Error) => onError(err.message));
          }}
        >
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase().slice(0, 3))}
            placeholder="TAG"
            data-testid="alliance-tag"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('allianceName')}
            maxLength={30}
            data-testid="alliance-name"
          />
          <button
            className="primary small"
            type="submit"
            disabled={tag.length !== 3 || name.length < 3}
            data-testid="alliance-create"
          >
            {t('create')}
          </button>
        </form>
      )}
    </>
  );
}

/** Another player's hold: who they are, and an attack against their last synced defence. */
function PlayerCard({
  store,
  state,
  player,
  online,
  onError,
  onReport,
  onClose,
}: {
  store: GameStore;
  state: GameState;
  player: RealmPlayer;
  online: Online;
  onError: (m: string) => void;
  onReport: (id: number) => void;
  onClose: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [left, setLeft] = useState<Record<string, boolean>>({});
  const snapshot = cleanSnapshot(player.defence);
  const land = Object.fromEntries(
    Object.entries(state.army.troops).filter(([id, n]) => n > 0 && TROOPS[id]?.type !== 'ship'),
  );
  const send = Object.fromEntries(Object.entries(land).filter(([id]) => !left[id]));
  const ours = armyStrength(Object.entries(send).map(([id, count]) => ({ ...TROOPS[id]!, count })));
  const theirs =
    armyStrength(Object.entries(snapshot.troops).map(([id, count]) => ({ ...TROOPS[id]!, count }))) +
    armyStrength(snapshot.walls.map((w) => ({ ...w, count: 1 })));
  const shielded = !!player.shieldUntil && Date.parse(player.shieldUntil) > store.now();
  const ally = !!player.alliance && player.alliance.id === online.mine?.alliance?.id;
  return (
    <div className="card panel world-sheet" data-testid="player-card">
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      <div className="hero-head">
        <AvatarFace id={player.avatar} size={56} />
        <div>
          <h2>{player.name}</h2>
          <p className="norse">
            {player.alliance ? `[${player.alliance.tag}] ${player.alliance.name}` : t('noAlliance')} · ⚔{' '}
            {formatAmount(player.power)}
          </p>
        </div>
      </div>
      {shielded && <p className="stat">🛡 {t('shielded')}</p>}
      {!online.on || ally || shielded ? null : !sending ? (
        <button className="primary" onClick={() => setSending(true)} data-testid="attack-player">
          ⚔ {t('attack')}
        </button>
      ) : (
        <>
          <div className="send-list">
            {Object.entries(land).map(([id, n]) => (
              <label key={id} className="send-item">
                <input
                  type="checkbox"
                  checked={!left[id]}
                  onChange={() => setLeft({ ...left, [id]: !left[id] })}
                />
                <TroopTypeIcon type={TROOPS[id]!.type} size={16} /> {n} {troopName(id)}
              </label>
            ))}
            {sumCounts(land) === 0 && <p className="muted">{t('noneHome')}</p>}
          </div>
          <p
            className={`verdict ${ours >= theirs * 1.6 ? 'favourable' : ours >= theirs * 1.1 ? 'even' : 'risky'}`}
          >
            {t('odds')}:{' '}
            <strong>
              {t(ours >= theirs * 1.6 ? 'favourable' : ours >= theirs * 1.1 ? 'even' : 'risky')}
            </strong>{' '}
            · {t('vsLine', { a: formatAmount(ours), b: formatAmount(theirs) })}
          </p>
          <button
            className="primary"
            disabled={sumCounts(send) === 0}
            data-testid="march-player"
            onClick={() => {
              const before = state.nextReportId;
              const err = store.dispatch({
                type: 'attackPlayer',
                targetId: player.id,
                targetName: player.name,
                snapshot,
                troops: send,
              });
              if (err) onError(err.message);
              else onReport(before);
            }}
          >
            ⚔ {t('march')}
          </button>
        </>
      )}
    </div>
  );
}
