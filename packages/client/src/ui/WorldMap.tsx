import {
  ALLIANCES,
  CAMPS,
  NODES,
  REALMS,
  TROOPS,
  WORLD,
  alliancePower,
  armyStrength,
  bordersHold,
  campDefenders,
  carryOf,
  gatherPlan,
  isCleared,
  jarlDefenders,
  kingsWar,
  marchLimit,
  midgard,
  nearest,
  realmMap,
  sumCounts,
  tileAt,
  tileGarrison,
  tileKey,
  tileLimit,
  tileOwner,
  travelMs,
  vsResult,
  vsStandings,
  warZone,
  STAMINA,
  WARFARE,
  freeSpot,
  rallyAllies,
  rallySize,
  teleportGoldPrice,
  type Command,
  type ShopId,
  cleanSnapshot,
  hallLevel,
  type GameState,
  type MapCamp,
  type MapJarl,
  type MapNode,
  type March,
  type Tile,
} from '@jarlheim/sim';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { GameStore } from '../game/store';
import { formatAmount, formatDuration } from './format';
import { t, troopName } from './i18n';
import type { Online } from './useOnline';
import type { RealmPlayer } from '../online/realm';
import { AvatarFace, ResourceIcon, TroopTypeIcon } from './icons';
import { paintBase, paintTerritory } from './worldArt';

/**
 * Midgard: the world map of your realm (server). Alliances and their land, the Law
 * Rock with the King, ring forts, trading towns, the holds of every jarl (yours, your
 * alliance-mates', rivals'), camps to hunt and fields to gather, and your marches.
 * Drawn on one canvas in one pass (no DOM per tile or per object).
 */

/**
 * Colours that say who is who, at every zoom, as in the genre (owner request): your hold
 * white, your alliance blue, the rest of your realm yellow, enemies red (your VS rival,
 * and everyone in the realm you are at war with).
 */
const ME = '#ffffff';
const ALLY = '#3fa0ff';
const NEUTRAL = '#f2c94c';
const ENEMY = '#ff4a3d';

const CAMP_GLYPH = { wolves: '🐺', bear: '🐻', outlaws: '🏕️', draugr: '💀' } as const;
const NODE_GLYPH = { farm: '🌾', wood: '🌲', iron: '⛏️', silver: '💰' } as const;
const MARCH_COLOR = { gather: '#7fe08a', hunt: '#ffb347', attack: '#ff6b5a' } as const;

type Picked =
  | { kind: 'player'; player: RealmPlayer }
  | { kind: 'jarl'; jarl: MapJarl }
  | { kind: 'camp'; camp: MapCamp }
  | { kind: 'node'; node: MapNode }
  | { kind: 'tile'; tile: Tile };

type Layer = 'castles' | 'wilds' | 'resourcesF';

export function WorldMap({
  store,
  state,
  onClose,
  onError,
  onReport,
  online,
  onSignIn,
  onOpenShop,
}: {
  store: GameStore;
  state: GameState;
  onClose: () => void;
  onError: (m: string) => void;
  onReport: (id: number) => void;
  online: Online;
  onSignIn: () => void;
  onOpenShop: (tab: ShopId) => void;
}) {
  const [realmId, setRealmId] = useState(state.world.realm);
  /** The cloud screen while your hold moves (as in the genre). */
  const [clouds, setClouds] = useState<string | null>(null);
  const { refresh } = online;
  useEffect(() => void refresh(realmId), [refresh, realmId]);
  const others = online.players.filter((p) => p.realm === realmId && p.id !== online.userId);
  const map = useMemo(() => realmMap(realmId), [realmId]);
  const world = useMemo(() => midgard(realmId), [realmId]);
  const base = useMemo(() => paintBase(map), [map]);
  const mine = realmId === state.world.realm;
  const ownedKey = mine ? state.world.owned.join(';') : '';
  const territory = useMemo(
    () =>
      paintTerritory(map, base, (x, y) => {
        const tile = tileAt(map, x, y)!;
        return mine ? tileOwner(state, tile) : tile.owner;
      }),
    [map, base, ownedKey],
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState(() => {
    // Start between your hold and the Law Rock, so both are in sight.
    const c = (realmMap(state.world.realm).size - 1) / 2 + 0.5;
    return { x: (state.world.home.x + 0.5 + c) / 2, y: (state.world.home.y + 0.5 + c) / 2, scale: 18 };
  });
  const [picked, setPicked] = useState<Picked | null>(null);
  const [sheet, setSheet] = useState<'alliances' | 'events' | 'vs' | 'find' | null>(null);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({
    castles: true,
    wilds: true,
    resourcesF: true,
  });
  // Marches move: redraw once a second (one draw per second, not per frame).
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const now = store.now();
  const myPlayerAlliance = online.mine?.alliance?.id ?? null;

  const homeRealm = state.world.origin?.realm ?? state.world.realm;
  const zone = warZone(now, homeRealm);
  const enemyRealm = zone.live && realmId === zone.enemy.id;
  const vsRival = useMemo(
    () => vsStandings(state, now).mine?.rival ?? null,
    [state.vs, state.world.alliance],
  );
  /** Who a hold belongs to, as a colour: your alliance, an enemy, or neutral. */
  const relation = (alliance: number | null) =>
    enemyRealm
      ? ENEMY
      : alliance !== null && alliance === state.world.alliance
        ? ALLY
        : alliance !== null && alliance === vsRival
          ? ENEMY
          : NEUTRAL;
  const jarlColor = relation;
  const playerColor = (p: RealmPlayer) =>
    enemyRealm
      ? ENEMY
      : (p.alliance && p.alliance.id === myPlayerAlliance) ||
          (!p.alliance && p.aiAlliance !== null && p.aiAlliance === state.world.alliance)
        ? ALLY
        : !p.alliance && p.aiAlliance !== null && p.aiAlliance === vsRival
          ? ENEMY
          : NEUTRAL;
  const homeKey = tileKey(state.world.home.x, state.world.home.y);
  const playerAt = useMemo(() => new Map(others.map((p) => [tileKey(p.x, p.y), p])), [others]);

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
    ctx.fillStyle = '#123a5c';
    ctx.fillRect(0, 0, w, h);
    // Zoomed all the way out, the whole realm fits on the screen.
    const fit = Math.min(w, h) / map.size;
    if (view.scale < fit - 0.01) {
      setView((v) => ({ ...v, scale: fit }));
      return;
    }
    const s = view.scale;
    // Never pan past the edge of the map into empty sea.
    const clampAxis = (c: number, span: number) => {
      const half = span / 2 / s;
      return map.size * s <= span ? map.size / 2 : Math.min(map.size - half, Math.max(half, c));
    };
    const vx = clampAxis(view.x, w);
    const vy = clampAxis(view.y, h);
    if (vx !== view.x || vy !== view.y) {
      setView((v) => ({ ...v, x: vx, y: vy }));
      return;
    }
    const ox = w / 2 - vx * s;
    const oy = h / 2 - vy * s;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(base, ox, oy, map.size * s, map.size * s);
    ctx.drawImage(territory, ox, oy, map.size * s, map.size * s);
    const fog = ctx.createRadialGradient(
      ox + (map.size * s) / 2,
      oy + (map.size * s) / 2,
      map.size * s * 0.42,
      ox + (map.size * s) / 2,
      oy + (map.size * s) / 2,
      map.size * s * 0.62,
    );
    fog.addColorStop(0, 'rgba(18,58,92,0)');
    fog.addColorStop(1, 'rgba(18,58,92,0.85)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, w, h);

    const px = (x: number) => ox + (x + 0.5) * s;
    const py = (y: number) => oy + (y + 0.5) * s;
    const onScreen = (x: number, y: number) => px(x) > -s && px(x) < w + s && py(y) > -s && py(y) < h + s;
    const far = s < 13;
    // Rivals' names only close up, so labels never pile on top of each other.
    const near = s >= 36;
    const icon = (x: number, y: number, glyph: string, size: number) => {
      ctx.font = `${size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, px(x), py(y));
    };
    const label = (x: number, y: number, text: string, color = '#fff', dy = 0.85) => {
      ctx.font = `700 ${Math.min(14, Math.max(10, s * 0.4))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(text, px(x), py(y) + dy * s);
      ctx.fillStyle = color;
      ctx.fillText(text, px(x), py(y) + dy * s);
    };
    const dot = (x: number, y: number, r: number, color: string) => {
      ctx.beginPath();
      ctx.arc(px(x), py(y), r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.stroke();
    };
    /** A hold: a coloured ring (who it belongs to) under a castle. Zoomed out: a coloured dot. */
    const hold = (x: number, y: number, color: string, glyph: string, scale = 1) => {
      if (far) return dot(x, y, Math.max(3, s * 0.32) * scale, color);
      ctx.beginPath();
      ctx.arc(px(x), py(y), s * 0.48 * scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
      ctx.lineWidth = Math.max(2, s * 0.09);
      ctx.strokeStyle = color;
      ctx.stroke();
      icon(x, y, glyph, s * 0.72 * scale);
    };
    const badge = (x: number, y: number, n: number) => {
      const bx = px(x) + s * 0.38;
      const by = py(y) - s * 0.36;
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(6, s * 0.2), 0, Math.PI * 2);
      ctx.fillStyle = '#2a1d0c';
      ctx.fill();
      ctx.strokeStyle = '#d9b25a';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = `700 ${Math.max(8, s * 0.24)}px system-ui, sans-serif`;
      ctx.fillStyle = '#ffe9b0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), bx, by + 0.5);
    };

    const c = (map.size - 1) / 2;
    icon(c, c, '👑', Math.max(16, s * 1.6));
    label(c, c, `${t('lawRock')} · ${map.realm.king}`, ME, 1.3);

    // Resources and camps first (under the castles).
    if (!far && layers.resourcesF) {
      for (const n of world.nodes) {
        if (!onScreen(n.x, n.y) || (mine && tileKey(n.x, n.y) === homeKey)) continue;
        ctx.globalAlpha = mine && isCleared(state, n.id, now) ? 0.35 : 1;
        icon(n.x, n.y, NODE_GLYPH[n.kind], s * 0.62);
        ctx.globalAlpha = 1;
        if (s >= 20) badge(n.x, n.y, n.level);
      }
    }
    if (!far && layers.wilds) {
      for (const cp of world.camps) {
        if (
          !onScreen(cp.x, cp.y) ||
          (mine && (isCleared(state, cp.id, now) || tileKey(cp.x, cp.y) === homeKey))
        )
          continue;
        icon(cp.x, cp.y, CAMP_GLYPH[cp.kind], s * 0.66);
        if (s >= 20) badge(cp.x, cp.y, cp.level);
      }
    }
    for (const town of map.towns) {
      if (!onScreen(town.x, town.y)) continue;
      icon(town.x, town.y, '⚖️', Math.max(10, s * 0.75));
      if (s >= 14) label(town.x, town.y, town.name);
    }
    if (layers.castles) {
      for (const j of world.jarls) {
        if (!onScreen(j.x, j.y) || (mine && tileKey(j.x, j.y) === homeKey) || playerAt.has(tileKey(j.x, j.y)))
          continue;
        const color = jarlColor(j.alliance);
        hold(j.x, j.y, color, '🏠');
        if (!far && mine && isCleared(state, j.id, now)) {
          ctx.beginPath();
          ctx.arc(px(j.x), py(j.y), s * 0.6, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(140,200,255,0.9)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        if (s >= 20) badge(j.x, j.y, j.level);
        if (near || (s >= 18 && color === ALLY))
          label(j.x, j.y, j.alliance === null ? j.name : `[${ALLIANCES[j.alliance]!.tag}] ${j.name}`, color);
      }
      for (const p of others) {
        if (!onScreen(p.x, p.y)) continue;
        const color = playerColor(p);
        hold(p.x, p.y, color, '🏯', 1.1);
        if (s >= 16) label(p.x, p.y, p.alliance ? `[${p.alliance.tag}] ${p.name}` : p.name, color);
      }
    }
    for (const seat of map.seats) {
      const a = ALLIANCES[seat.alliance]!;
      if (!onScreen(seat.x, seat.y)) continue;
      hold(seat.x, seat.y, relation(seat.alliance), '🏰', far ? 1.6 : 1.25);
      label(seat.x, seat.y, `[${a.tag}]`, relation(seat.alliance), far ? 0.9 : 1);
    }

    // Your marches: a dashed road and a moving column.
    if (mine) {
      for (const m of state.marches) {
        const hx = px(state.world.home.x);
        const hy = py(state.world.home.y);
        const tx = px(m.x);
        const ty = py(m.y);
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = MARCH_COLOR[m.kind];
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
        const f =
          now < m.arriveAt
            ? (now - m.startAt) / Math.max(1, m.arriveAt - m.startAt)
            : now < m.doneAt
              ? 1
              : 1 - (now - m.doneAt) / Math.max(1, m.returnAt - m.doneAt);
        const k = Math.max(0, Math.min(1, f));
        ctx.font = `${Math.max(14, s * 0.7)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(m.kind === 'gather' ? '🛒' : '⚔️', hx + (tx - hx) * k, hy + (ty - hy) * k);
      }
      const hx = state.world.home.x;
      const hy = state.world.home.y;
      if (far) dot(hx, hy, Math.max(5, s * 0.5), ME);
      else hold(hx, hy, ME, '🛖', 1.25);
      label(hx, hy, state.profile.name, ME, far ? 0.9 : 1);
    }
    if (picked) {
      const at =
        picked.kind === 'player'
          ? picked.player
          : picked.kind === 'jarl'
            ? picked.jarl
            : picked.kind === 'camp'
              ? picked.camp
              : picked.kind === 'node'
                ? picked.node
                : picked.tile;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.strokeRect(ox + at.x * s, oy + at.y * s, s, s);
    }
  });

  // Pan with one finger, pinch or wheel to zoom, tap to pick.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const minScale = () => {
    const el = canvasRef.current;
    return el ? Math.min(el.clientWidth, el.clientHeight) / map.size : 7;
  };
  const clampScale = (v: number) => Math.min(48, Math.max(minScale(), v));
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
    pick(x, y);
  };
  /** What stands on a tile: a player, a jarl, a camp, a node, or the land itself. */
  const pick = (x: number, y: number) => {
    const key = tileKey(x, y);
    const player = playerAt.get(key);
    const thing = world.at.get(key);
    const tile = tileAt(map, x, y);
    setSheet(null);
    if (player) setPicked({ kind: 'player', player });
    else if (thing && !(mine && key === homeKey)) {
      if (thing.id.startsWith('j')) setPicked({ kind: 'jarl', jarl: thing as MapJarl });
      else if (thing.id.startsWith('c'))
        setPicked(
          mine && isCleared(state, thing.id, now) && tile
            ? { kind: 'tile', tile }
            : { kind: 'camp', camp: thing as MapCamp },
        );
      else setPicked({ kind: 'node', node: thing as MapNode });
    } else setPicked(tile ? { kind: 'tile', tile } : null);
  };
  const centre = (x: number, y: number, scale?: number) =>
    setView((v) => ({ x: x + 0.5, y: y + 0.5, scale: scale ?? Math.max(v.scale, 22) }));

  /** Moves your hold (any teleport), behind the clouds, and shows where you landed. */
  const move = (cmd: Extract<Command, { type: 'teleport' }>, text: string) => {
    const err = store.dispatch(cmd);
    if (err) return onError(err.message);
    const w = store.snapshot.world;
    setPicked(null);
    setSheet(null);
    setClouds(text);
    setTimeout(() => setClouds(null), 1400);
    setRealmId(w.realm);
    setView((v) => ({ x: w.home.x + 0.5, y: w.home.y + 0.5, scale: Math.max(v.scale, 22) }));
  };
  const war = kingsWar(now, state.world.realm);
  const vsResultNow = mine ? vsResult(state) : null;
  const targetName = (m: March) => {
    const o = world.jarls.find((q) => q.id === m.target);
    if (o) return o.name;
    const cp = world.camps.find((q) => q.id === m.target);
    if (cp) return t(`camp_${cp.kind}`);
    const n = world.nodes.find((q) => q.id === m.target);
    return n ? t(`node_${n.kind}`) : '';
  };

  return (
    <section
      className="world"
      data-testid="world-map"
      data-players={others.length}
      data-jarls={world.jarls.length}
      role="dialog"
      aria-label={t('world')}
    >
      <canvas
        ref={canvasRef}
        className="world-canvas"
        data-testid="world-canvas"
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
        <div className="layer-chips">
          {(['castles', 'wilds', 'resourcesF'] as const).map((k) => (
            <button
              key={k}
              className={layers[k] ? 'on' : ''}
              aria-pressed={layers[k]}
              onClick={() => setLayers({ ...layers, [k]: !layers[k] })}
              data-testid={`layer-${k}`}
            >
              {{ castles: '🏰', wilds: '🐺', resourcesF: '🌾' }[k]} {t(k)}
            </button>
          ))}
          <button onClick={() => setView((v) => ({ ...v, scale: minScale() }))} data-testid="zoom-all">
            🗺 {t('zoomAll')}
          </button>
        </div>
        <div className="world-wallet">
          <button onClick={() => onOpenShop('energy')} data-testid="stamina">
            ⚡ {state.wallet.stamina}/{STAMINA.max}
          </button>
          <button onClick={() => onOpenShop('gold')}>
            <ResourceIcon res="gold" size={14} /> {formatAmount(state.resources.gold)}
          </button>
          <span className="legend">
            <i style={{ background: ALLY }} /> {t('legendAlly')} <i style={{ background: NEUTRAL }} />{' '}
            {t('legendNeutral')} <i style={{ background: ENEMY }} /> {t('legendEnemy')}
          </span>
        </div>
        {state.world.origin && (
          <div className="war-banner" data-testid="war-banner">
            ⚔{' '}
            {t('inWarZone', {
              n: state.world.realm,
              t: formatDuration(Math.max(0, state.world.origin.until - now)),
            })}
            <button
              className="secondary small"
              data-testid="go-home"
              onClick={() => move({ type: 'teleport', mode: 'home' }, t('movingHome'))}
            >
              🛖 {t('goHome')}
            </button>
          </div>
        )}
      </header>
      <aside className="world-side">
        {mine && (
          <button
            className="round"
            onClick={() => setSheet(sheet === 'find' ? null : 'find')}
            aria-label={t('find')}
            data-testid="find-button"
          >
            🔍
          </button>
        )}
        <button
          className="round"
          onClick={() => setSheet(sheet === 'alliances' ? null : 'alliances')}
          aria-label={t('alliances')}
          data-testid="alliances-button"
        >
          🛡
        </button>
        <button
          className="round vs-button"
          onClick={() => setSheet(sheet === 'vs' ? null : 'vs')}
          aria-label={t('vs')}
          data-testid="vs-button"
        >
          VS{vsResultNow && <span className="badge-dot">!</span>}
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
            centre(state.world.home.x, state.world.home.y);
          }}
          aria-label={t('myHold')}
        >
          <AvatarFace id={state.profile.avatar} size={30} />
        </button>
      </aside>

      {mine && state.marches.length > 0 && !picked && !sheet && (
        <ul className="world-marches" data-testid="marches">
          {state.marches.map((m) => {
            const rallyEnds = m.allies ? m.startAt + WARFARE.rallyWaitMs : 0;
            const phase =
              now < rallyEnds
                ? 'm_rally'
                : now < m.arriveAt
                  ? 'm_out'
                  : now < m.doneAt && m.kind === 'gather'
                    ? 'm_gathering'
                    : 'm_back';
            const left =
              now < rallyEnds
                ? rallyEnds - now
                : now < m.arriveAt
                  ? m.arriveAt - now
                  : now < m.doneAt
                    ? m.doneAt - now
                    : m.returnAt - now;
            return (
              <li key={m.id}>
                <button className="link" onClick={() => centre(m.x, m.y)}>
                  {m.kind === 'gather' ? '🛒' : m.allies ? '⚑' : '⚔️'} {targetName(m)}
                </button>
                <span className="muted">
                  {t(phase)} · {formatDuration(Math.max(0, left))}
                </span>
                {now < m.doneAt && (
                  <button
                    className="secondary small"
                    onClick={() => {
                      const err = store.dispatch({ type: 'recall', marchId: m.id });
                      if (err) onError(err.message);
                    }}
                  >
                    ↩ {t('recall')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {sheet === 'alliances' && (
        <div className="card panel world-sheet" data-testid="alliances">
          <button className="close" onClick={() => setSheet(null)} aria-label={t('close')}>
            ×
          </button>
          <h2>{t('alliances')}</h2>
          <p className="norse">
            👑 {map.realm.king} · [{ALLIANCES[map.realm.kingAlliance]!.tag}]
          </p>
          {mine && state.world.alliance !== null && (
            <>
              <h3>
                🤝 {t('members')} · [{ALLIANCES[state.world.alliance]!.tag}]
              </h3>
              <ul className="alliance-list" data-testid="members">
                {world.jarls
                  .filter((j) => j.alliance === state.world.alliance)
                  .map((j) => (
                    <li key={j.id}>
                      <AvatarFace id={j.avatar} size={28} />
                      <span className="quest-body">
                        <strong>{j.name}</strong>
                        <span className="muted">
                          {t('jarlLevel', { n: j.level })} · ⚔ {formatAmount(j.power)}
                        </span>
                      </span>
                      <button
                        className="secondary small"
                        aria-label="📍"
                        onClick={() => {
                          centre(j.x, j.y, 26);
                          pick(j.x, j.y);
                        }}
                      >
                        📍
                      </button>
                    </li>
                  ))}
              </ul>
            </>
          )}
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
                    ⚔ {formatAmount(alliancePower(realmId, i))} ·{' '}
                    {t('holds', { n: world.jarls.filter((j) => j.alliance === i).length })}
                    {i === map.realm.kingAlliance && ' · 👑'}
                  </span>
                </span>
                <button
                  className="secondary small"
                  aria-label="📍"
                  onClick={() => {
                    const seat = map.seats.find((q) => q.alliance === i)!;
                    setSheet(null);
                    centre(seat.x, seat.y, 18);
                  }}
                >
                  📍
                </button>
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

      {sheet === 'find' && (
        <div className="card panel world-sheet" data-testid="find">
          <button className="close" onClick={() => setSheet(null)} aria-label={t('close')}>
            ×
          </button>
          <h2>🔍 {t('find')}</h2>
          <p className="muted">{t('findHow')}</p>
          <div className="find-grid">
            <button
              className="secondary"
              data-testid="find-jarl"
              onClick={() => {
                // The nearest hold that is not your alliance's and not under a peace shield.
                const j = nearest(
                  world.jarls.filter(
                    (q) =>
                      (q.alliance === null || q.alliance !== state.world.alliance) &&
                      !isCleared(state, q.id, now) &&
                      tileKey(q.x, q.y) !== homeKey,
                  ),
                  state.world.home.x,
                  state.world.home.y,
                );
                if (!j) return onError(t('findNone'));
                centre(j.x, j.y, 26);
                pick(j.x, j.y);
              }}
            >
              <span className="emoji-icon">🏠</span>
              {t('findJarl')}
            </button>
            {(
              [
                ...(Object.keys(CAMP_GLYPH) as Array<keyof typeof CAMP_GLYPH>).map((k) => ['c', k] as const),
                ...(Object.keys(NODE_GLYPH) as Array<keyof typeof NODE_GLYPH>).map((k) => ['n', k] as const),
              ] as const
            ).map(([group, kind]) => (
              <button
                key={kind}
                className="secondary"
                data-testid={`find-${kind}`}
                onClick={() => {
                  // The nearest one that is there now, so the march is short.
                  const list = (group === 'c' ? world.camps : world.nodes).filter(
                    (o) =>
                      o.kind === kind &&
                      !isCleared(state, o.id, now) &&
                      tileKey(o.x, o.y) !== homeKey &&
                      !state.marches.some((m) => m.target === o.id),
                  );
                  const o = nearest(list, state.world.home.x, state.world.home.y);
                  if (!o) return onError(t('findNone'));
                  centre(o.x, o.y, 26);
                  pick(o.x, o.y);
                }}
              >
                <span className="emoji-icon">
                  {group === 'c'
                    ? CAMP_GLYPH[kind as keyof typeof CAMP_GLYPH]
                    : NODE_GLYPH[kind as keyof typeof NODE_GLYPH]}
                </span>
                {t(group === 'c' ? `camp_${kind}` : `node_${kind}`)}
              </button>
            ))}
          </div>
          <h3>🌀 {t('teleports')}</h3>
          <div className="find-grid">
            <button
              className="secondary"
              data-testid="tp-random"
              onClick={() => move({ type: 'teleport', mode: 'random', buy: true }, t('moving'))}
            >
              🎲 {t('item_teleport-random')} ×{state.items['teleport-random'] ?? 0}
            </button>
            <button
              className="secondary"
              data-testid="tp-alliance"
              disabled={state.world.alliance === null}
              onClick={() => move({ type: 'teleport', mode: 'alliance' }, t('moving'))}
            >
              ⚑ {t('item_teleport-alliance')} ×{state.items['teleport-alliance'] ?? 0}
            </button>
          </div>
          <p className="muted">{t('teleportHow')}</p>
        </div>
      )}

      {sheet === 'vs' && (
        <VsSheet store={store} state={state} onClose={() => setSheet(null)} onError={onError} />
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
          <h3>⚔ {t('warZone')}</h3>
          {state.world.origin ? (
            <p className="stat">
              {t('inWarZone', {
                n: state.world.realm,
                t: formatDuration(Math.max(0, state.world.origin.until - now)),
              })}
            </p>
          ) : zone.live ? (
            <button
              className="primary"
              data-testid="tp-war"
              onClick={() =>
                move({ type: 'teleport', mode: 'war', buy: true }, t('movingWar', { n: zone.enemy.id }))
              }
            >
              🌀 {t('goWarZone', { n: zone.enemy.id })} · ×{state.items['teleport-war'] ?? 0}
            </button>
          ) : (
            <p className="muted">{t('warZoneClosed')}</p>
          )}
          <p className="muted">{t('warZoneHow')}</p>
          <button className="primary" onClick={() => setSheet('vs')}>
            VS · {t('vs')}
          </button>
        </div>
      )}

      {picked && !sheet && (
        <PickCard
          picked={picked}
          store={store}
          state={state}
          mine={mine}
          online={online}
          now={now}
          onError={onError}
          onReport={onReport}
          onMove={move}
          onClose={() => setPicked(null)}
        />
      )}

      {clouds && (
        <div className="clouds" data-testid="clouds">
          <p>{clouds}</p>
        </div>
      )}

      <button className="world-home" onClick={onClose} aria-label={t('myHold')} data-testid="world-home">
        🛖
      </button>
    </section>
  );
}

function PickCard({
  picked,
  store,
  state,
  mine,
  online,
  now,
  onError,
  onReport,
  onMove,
  onClose,
}: {
  picked: Picked;
  store: GameStore;
  state: GameState;
  mine: boolean;
  online: Online;
  now: number;
  onError: (m: string) => void;
  onReport: (id: number) => void;
  onMove: (cmd: Extract<Command, { type: 'teleport' }>, text: string) => void;
  onClose: () => void;
}) {
  switch (picked.kind) {
    case 'player':
      return (
        <PlayerCard
          store={store}
          state={state}
          player={picked.player}
          online={online}
          onError={onError}
          onReport={onReport}
          onClose={onClose}
        />
      );
    case 'tile':
      return (
        <TileCard
          key={tileKey(picked.tile.x, picked.tile.y)}
          store={store}
          state={state}
          tile={picked.tile}
          mine={mine}
          onError={onError}
          onReport={onReport}
          onMove={onMove}
          onClose={onClose}
        />
      );
    default:
      return (
        <MapTargetCard
          key={
            picked.kind === 'jarl' ? picked.jarl.id : picked.kind === 'camp' ? picked.camp.id : picked.node.id
          }
          picked={picked}
          store={store}
          state={state}
          mine={mine}
          now={now}
          onError={onError}
          onReport={onReport}
          onClose={onClose}
        />
      );
  }
}

/** Choose which warriors go, see the odds, and march. Shared by every attack and gathering. */
function TroopPicker({
  state,
  theirs,
  action,
  testId,
  info,
  onSend,
  allies,
}: {
  state: GameState;
  /** Strength of the defenders, or null when there is no battle (gathering). */
  theirs: number | null;
  /** Alliance-mates' warriors marching with yours (a rally). */
  allies?: Record<string, number> | undefined;
  action: string;
  testId: string;
  info?: (send: Record<string, number>) => ReactNode;
  onSend: (send: Record<string, number>) => void;
}) {
  const land = Object.fromEntries(
    Object.entries(state.army.troops).filter(([id, n]) => n > 0 && TROOPS[id]?.type !== 'ship'),
  );
  const [left, setLeft] = useState<Record<string, boolean>>({});
  const send = Object.fromEntries(Object.entries(land).filter(([id]) => !left[id]));
  const ours = armyStrength(
    Object.entries(send)
      .concat(Object.entries(allies ?? {}))
      .map(([id, count]) => ({ ...TROOPS[id]!, count })),
  );
  const verdict =
    theirs === null ? null : ours >= theirs * 1.6 ? 'favourable' : ours >= theirs * 1.1 ? 'even' : 'risky';
  return (
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
      {verdict && theirs !== null && (
        <p className={`verdict ${verdict}`}>
          {t('odds')}: <strong>{t(verdict)}</strong> ·{' '}
          {t('vsLine', { a: formatAmount(ours), b: formatAmount(theirs) })}
        </p>
      )}
      {info?.(send)}
      <button
        className="primary"
        disabled={sumCounts(send) === 0}
        data-testid={testId}
        onClick={() => onSend(send)}
      >
        {action}
      </button>
    </>
  );
}

/** A jarl's hold, a camp or a node: what it is, and a march to it. */
function MapTargetCard({
  picked,
  store,
  state,
  mine,
  now,
  onError,
  onReport,
  onClose,
}: {
  picked: Extract<Picked, { kind: 'jarl' | 'camp' | 'node' }>;
  store: GameStore;
  state: GameState;
  mine: boolean;
  now: number;
  onError: (m: string) => void;
  onReport: (id: number) => void;
  onClose: () => void;
}) {
  const [sending, setSending] = useState<false | 'attack' | 'rally'>(false);
  const o = picked.kind === 'jarl' ? picked.jarl : picked.kind === 'camp' ? picked.camp : picked.node;
  const march = mine ? state.marches.find((m) => m.target === o.id) : undefined;
  const until = state.world.cleared[o.id] ?? 0;
  const gone = mine && until > now;
  const travel = mine ? travelMs(state, o.x, o.y) : 0;
  const marchInfo = (
    <p className="muted">
      {t('marchTime', { t: formatDuration(travel) })} ·{' '}
      {t('columns', { a: state.marches.length, b: marchLimit(state) })}
    </p>
  );
  const dispatch = (cmd: Parameters<GameStore['dispatch']>[0]) => {
    const err = store.dispatch(cmd);
    if (err) onError(err.message);
    else onClose();
  };
  let head: ReactNode;
  let body: ReactNode = null;
  if (picked.kind === 'jarl') {
    const j = picked.jarl;
    const ally = mine && j.alliance !== null && j.alliance === state.world.alliance;
    head = (
      <div className="hero-head">
        <AvatarFace id={j.avatar} size={56} />
        <div>
          <h2>{j.name}</h2>
          <p className="norse">
            {j.alliance === null
              ? t('freeJarl')
              : `[${ALLIANCES[j.alliance]!.tag}] ${ALLIANCES[j.alliance]!.name}`}
          </p>
          <p className="stat">
            {t('jarlLevel', { n: j.level })} · ⚔ {formatAmount(j.power)}
            {ally && <span className="tag-ally"> 🤝 {t('allyJarl')}</span>}
          </p>
        </div>
      </div>
    );
    const scoutCost = WARFARE.scoutSilverPerLevel * j.level;
    const scout = mine && !ally && (
      <button
        className="secondary"
        data-testid="scout"
        onClick={() => {
          const before = state.nextReportId;
          const err = store.dispatch({ type: 'scout', jarlId: j.id });
          if (err) return onError(err.message);
          onClose();
          onReport(before);
        }}
      >
        👁 {t('scout')} · <ResourceIcon res="silver" size={13} /> {scoutCost}
      </button>
    );
    const slots = rallySize(state);
    if (gone)
      body = (
        <>
          <p className="stat">🛡 {t('shieldFor', { t: formatDuration(until - now) })}</p>
          <div className="card-actions">{scout}</div>
        </>
      );
    else if (mine && !ally && !march)
      body = !sending ? (
        <div className="card-actions">
          {scout}
          <button className="primary" onClick={() => setSending('attack')} data-testid="attack-jarl">
            ⚔ {t('attackHold')}
          </button>
          <button
            className="primary"
            disabled={slots === 0}
            onClick={() => setSending('rally')}
            data-testid="rally"
          >
            ⚑ {t('rally')} ({slots}/{WARFARE.rallySlots})
          </button>
        </div>
      ) : (
        <TroopPicker
          state={state}
          theirs={armyStrength(jarlDefenders(j))}
          allies={sending === 'rally' ? (rallyAllies(state) ?? {}) : undefined}
          action={sending === 'rally' ? `⚑ ${t('rally')}` : `⚔ ${t('march')}`}
          testId={sending === 'rally' ? 'march-rally' : 'march-jarl'}
          info={() => (
            <>
              {sending === 'rally' && (
                <p className="muted">{t('rallyHow', { n: slots, t: formatDuration(WARFARE.rallyWaitMs) })}</p>
              )}
              {marchInfo}
            </>
          )}
          onSend={(troops) =>
            dispatch(
              sending === 'rally'
                ? { type: 'rally', jarlId: j.id, troops }
                : { type: 'attackJarl', jarlId: j.id, troops },
            )
          }
        />
      );
  } else if (picked.kind === 'camp') {
    const cp = picked.camp;
    const def = CAMPS[cp.kind];
    const defenders = campDefenders(cp);
    head = (
      <>
        <h2>
          {CAMP_GLYPH[cp.kind]} {t(`camp_${cp.kind}`)} · {t('level', { n: cp.level })}
        </h2>
        <p className="muted">
          {t('garrison')}:{' '}
          {defenders.map((g) => (
            <span key={g.key} className="cost">
              <TroopTypeIcon type={g.type} size={14} /> {g.count}
            </span>
          ))}
        </p>
        <p className="stat">
          {t('spoils')}:{' '}
          {Object.entries(def.reward).map(([r, v]) => (
            <span key={r} className="cost">
              <ResourceIcon res={r as 'food'} size={14} /> {formatAmount((v ?? 0) * cp.level)}
            </span>
          ))}{' '}
          🎁
        </p>
      </>
    );
    if (gone) body = <p className="muted">{t('campGone', { t: formatDuration(until - now) })}</p>;
    else if (mine && !march)
      body = !sending ? (
        <button className="primary" onClick={() => setSending('attack')} data-testid="hunt">
          ⚔ {t('hunt')}
        </button>
      ) : (
        <TroopPicker
          state={state}
          theirs={armyStrength(defenders)}
          action={`⚔ ${t('march')}`}
          testId="march-hunt"
          info={() => (
            <>
              <p className="muted">
                ⚡ {t('staminaCost', { n: STAMINA.cost[cp.kind] ?? 10, h: state.wallet.stamina })}
              </p>
              {marchInfo}
            </>
          )}
          onSend={(troops) => dispatch({ type: 'hunt', campId: cp.id, troops })}
        />
      );
  } else {
    const n = picked.node;
    const def = NODES[n.kind];
    head = (
      <>
        <h2>
          {NODE_GLYPH[n.kind]} {t(`node_${n.kind}`)} · {t('level', { n: n.level })}
        </h2>
        <p className="stat">
          <span className="cost">
            <ResourceIcon res={def.res} size={14} /> {formatAmount(def.perLevel * n.level)}
          </span>{' '}
          · +{formatAmount(def.perHour)}/h
        </p>
      </>
    );
    if (gone && !march) body = <p className="muted">{t('nodeTaken', { t: formatDuration(until - now) })}</p>;
    else if (mine && !march)
      body = !sending ? (
        <button className="primary" onClick={() => setSending('attack')} data-testid="gather">
          🛒 {t('gather')}
        </button>
      ) : (
        <TroopPicker
          state={state}
          theirs={null}
          action={`🛒 ${t('gather')}`}
          testId="march-gather"
          info={(send) => {
            const plan = gatherPlan(n, send);
            return (
              <>
                <p className="muted">
                  {t('gatherPlan', {
                    n: formatAmount(plan.amount),
                    t: formatDuration(plan.ms + 2 * travel),
                  })}{' '}
                  · {t('carry')} {formatAmount(carryOf(send))}
                </p>
                {marchInfo}
              </>
            );
          }}
          onSend={(troops) => dispatch({ type: 'gather', nodeId: n.id, troops })}
        />
      );
  }
  return (
    <div className="card panel world-sheet" data-testid="target-card">
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      {head}
      <p className="norse">
        ({o.x}, {o.y})
      </p>
      {march && (
        <p className="stat">
          {t('onTheWay')}{' '}
          {now < march.doneAt && (
            <button
              className="secondary small"
              onClick={() => dispatch({ type: 'recall', marchId: march.id })}
            >
              ↩ {t('recall')}
            </button>
          )}
        </p>
      )}
      {body}
    </div>
  );
}

function TileCard({
  store,
  state,
  tile,
  mine,
  onError,
  onReport,
  onMove,
  onClose,
}: {
  store: GameStore;
  state: GameState;
  tile: Tile;
  mine: boolean;
  onError: (m: string) => void;
  onReport: (id: number) => void;
  onMove: (cmd: Extract<Command, { type: 'teleport' }>, text: string) => void;
  onClose: () => void;
}) {
  const [sending, setSending] = useState(false);
  const owner = mine ? tileOwner(state, tile) : tile.owner;
  const yieldOf = WORLD.tileYield[tile.kind];
  const canTry =
    mine &&
    owner !== -1 &&
    tile.kind !== 'sea' &&
    tile.kind !== 'capital' &&
    tile.kind !== 'fort' &&
    !(owner !== null && owner === state.world.alliance) &&
    bordersHold(state, tile.x, tile.y);
  const full = state.world.owned.length + 1 >= tileLimit(hallLevel(state));
  const garrison = tileGarrison(tile, owner === -1 ? null : owner);
  return (
    <div className="card panel world-sheet" data-testid="tile-card">
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      <h2>
        {t(`tile_${tile.kind}`)} · {t('level', { n: tile.level })}
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
      {mine && freeSpot(state, state.world.realm, tile.x, tile.y) && !sending && (
        <button
          className="secondary"
          data-testid="move-here"
          onClick={() =>
            onMove({ type: 'teleport', mode: 'advanced', x: tile.x, y: tile.y, buy: true }, t('moving'))
          }
        >
          🌀 {t('moveHere')} ·{' '}
          {(state.items['teleport-advanced'] ?? 0) > 0 ? (
            `×${state.items['teleport-advanced']}`
          ) : (
            <>
              <ResourceIcon res="gold" size={13} /> {teleportGoldPrice('advanced')}
            </>
          )}
        </button>
      )}
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
            {garrison.map((g) => (
              <span key={g.key} className="cost">
                <TroopTypeIcon type={g.type} size={14} /> {g.count}
              </span>
            ))}
          </p>
          <TroopPicker
            state={state}
            theirs={armyStrength(garrison)}
            action={`⚔ ${t('march')}`}
            testId="march"
            onSend={(send) => {
              const before = state.nextReportId;
              const err = store.dispatch({ type: 'conquerTile', x: tile.x, y: tile.y, troops: send });
              if (err) onError(err.message);
              else {
                setSending(false);
                onReport(before);
              }
            }}
          />
        </>
      )}
    </div>
  );
}

/** The Alliance VS: this season's themes, your match, every match (1 v 2, 3 v 4…) and the top jarls. */
function VsSheet({
  store,
  state,
  onClose,
  onError,
}: {
  store: GameStore;
  state: GameState;
  onClose: () => void;
  onError: (m: string) => void;
}) {
  const now = store.now();
  const vs = vsStandings(state, now);
  const result = vsResult(state);
  const tag = (a: number) => (
    <span style={{ color: a === state.world.alliance ? ALLY : ALLIANCES[a]!.color }}>
      [{ALLIANCES[a]!.tag}]
    </span>
  );
  return (
    <div className="card panel world-sheet" data-testid="vs">
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      <h2>⚔ {t('vs')}</h2>
      <p className="muted">{t('vsSeason', { n: vs.season, t: formatDuration(vs.end - now) })}</p>
      {result && (
        <div className={`vs-result ${result.won ? 'won' : ''}`}>
          <p className="stat">
            {result.alliance === null
              ? `⭐ ${formatAmount(result.points)}`
              : result.won
                ? `🏆 ${t('vsWon', { n: result.season })}`
                : t('vsLost', { n: result.season })}
          </p>
          <button
            className="primary"
            data-testid="vs-claim"
            onClick={() => {
              const err = store.dispatch({ type: 'claimVs' });
              if (err) onError(err.message);
            }}
          >
            🎁 {t('vsClaim')}
          </button>
        </div>
      )}
      <ol className="vs-days">
        {vs.themes.map((th, i) => (
          <li key={th} className={i === vs.day ? 'today' : ''}>
            <strong>
              {t('vsDay', { n: i + 1 })} · {t(`vsTheme_${th}`)}
              {i === vs.day && ` · ${t('vsToday')}`}
            </strong>
            {i === vs.day && <span className="muted">{t(`vsHow_${th}`)}</span>}
          </li>
        ))}
      </ol>
      <h3>{t('vsMatch')}</h3>
      {vs.mine ? (
        <div className="duel" data-testid="vs-match">
          <span>
            #{vs.mine.rank} {tag(vs.mine.alliance)} <b>{formatAmount(vs.mine.team)}</b>
          </span>
          <span>VS</span>
          <span>
            <b>{formatAmount(vs.mine.enemy)}</b> {tag(vs.mine.rival)}
          </span>
        </div>
      ) : (
        <p className="muted">{t('vsJoin')}</p>
      )}
      <p className="stat">⭐ {t('vsYourRank', { n: vs.myRank, p: formatAmount(vs.yours) })}</p>
      <h3>{t('vsBracket')}</h3>
      <ul className="vs-bracket">
        {vs.pairs.map((p) => (
          <li
            key={p.a}
            className={p.a === state.world.alliance || p.b === state.world.alliance ? 'mine' : ''}
          >
            <span>
              #{p.rankA} {tag(p.a)} <b>{formatAmount(p.scoreA)}</b>
            </span>
            <span className="muted">VS</span>
            <span>
              <b>{formatAmount(p.scoreB)}</b> {tag(p.b)} #{p.rankB}
            </span>
          </li>
        ))}
      </ul>
      <h3>{t('vsPlayers')}</h3>
      <ol className="vs-players" data-testid="vs-players">
        {vs.players.slice(0, 10).map((p, i) => (
          <li key={p.id} className={p.you ? 'you' : ''}>
            <span className="rank">{i + 1}</span>
            <span className="quest-body">
              {p.alliance !== null && tag(p.alliance)} {p.name}
            </span>
            <b>{formatAmount(p.points)}</b>
          </li>
        ))}
      </ol>
      <p className="muted">{t('vsHow')}</p>
    </div>
  );
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
  const snapshot = cleanSnapshot(player.defence);
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
        <TroopPicker
          state={state}
          theirs={theirs}
          action={`⚔ ${t('march')}`}
          testId="march-player"
          onSend={(send) => {
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
        />
      )}
    </div>
  );
}
