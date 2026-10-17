import { REALMS } from '../data/world';
import { SHOPS } from '../data/shops';
import type { TeleportMode } from '../data/items';
import type { GameEvent } from '../events';
import { createRng, hashString, nextInt } from '../rng';
import type { GameState } from '../state';
import { midgard } from './midgard';
import { vsSeason } from './vs';
import { kingsWar, realmMap, tileAt, tileKey } from './world';

/**
 * Moving your hold (owner request, as in the genre): a random free spot, a spot you
 * choose, next to your alliance's ring fort, or across to the realm you are at war with
 * (the King's War on Saturday, or a VS war day). From the war zone you go home for free,
 * and you are sent home when the war ends.
 */

/** Is the war on, which realm is the enemy, and until when? */
export function warZone(now: number, realmId: number) {
  const war = kingsWar(now, realmId);
  const vs = vsSeason(now);
  const vsWarDay = vs.theme === 'war';
  const dayEnd = vs.start + (vs.day + 1) * 86_400_000;
  const live = war.live || vsWarDay;
  return {
    live,
    enemy: war.opponent,
    until: war.live ? war.end : vsWarDay ? dayEnd : null,
    reason: war.live ? ('kingsWar' as const) : vsWarDay ? ('vs' as const) : null,
  };
}

/** Can a hold stand on (x, y) in this realm? Free, dry land with nothing on it. */
export function freeSpot(state: GameState, realmId: number, x: number, y: number): boolean {
  const t = tileAt(realmMap(realmId), x, y);
  if (!t || !(t.kind === 'field' || t.kind === 'forest' || t.kind === 'hills')) return false;
  if (midgard(realmId).at.has(tileKey(x, y))) return false;
  if (realmId === state.world.realm && state.world.owned.includes(tileKey(x, y))) return false;
  return true;
}

/** The free spot nearest to (x, y), searching outwards ring by ring. */
function nearestFree(state: GameState, realmId: number, x: number, y: number) {
  for (let r = 1; r < 12; r++)
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (freeSpot(state, realmId, x + dx, y + dy)) return { x: x + dx, y: y + dy };
      }
  return null;
}

function randomFree(state: GameState, realmId: number, seed: string) {
  const map = realmMap(realmId);
  const rng = createRng(hashString(seed));
  for (let i = 0; i < 400; i++) {
    const t = map.tiles[nextInt(rng, 0, map.tiles.length - 1)]!;
    const c = (map.size - 1) / 2;
    if (Math.hypot(t.x - c, t.y - c) > 4 && freeSpot(state, realmId, t.x, t.y)) return { x: t.x, y: t.y };
  }
  return null;
}

const TELEPORT_ITEM: Record<TeleportMode, string> = {
  random: 'teleport-random',
  advanced: 'teleport-advanced',
  alliance: 'teleport-alliance',
  war: 'teleport-war',
};

/** Gold price of a teleport item, for "buy and move" in one tap. */
export function teleportGoldPrice(mode: TeleportMode): number | null {
  return SHOPS.gold.offers.find((o) => o.item === TELEPORT_ITEM[mode])?.price ?? null;
}

/** Moves your hold. Returns an error message, or null. */
export function teleport(
  state: GameState,
  mode: TeleportMode | 'home',
  target: { x: number; y: number } | undefined,
  buyWithGold: boolean,
  now: number,
  events: GameEvent[],
): string | null {
  if (state.marches.length) return 'Wait for your marches to come home first';
  const w = state.world;
  if (mode === 'home') {
    if (!w.origin) return 'You are already home';
    goHome(state);
    events.push({ type: 'teleported', mode: 'home', realm: w.realm });
    return null;
  }
  let realm = w.realm;
  let spot: { x: number; y: number } | null = null;
  switch (mode) {
    case 'advanced':
      if (!target || !freeSpot(state, realm, target.x, target.y)) return 'You cannot move there';
      spot = target;
      break;
    case 'random':
      spot = randomFree(state, realm, `tp-${state.seed}-${now}`);
      break;
    case 'alliance': {
      if (w.alliance === null) return 'Join an alliance first';
      const seat = realmMap(realm).seats.find((s) => s.alliance === w.alliance);
      spot = seat ? nearestFree(state, realm, seat.x, seat.y) : null;
      break;
    }
    case 'war': {
      if (w.origin) return 'You are already in the war zone';
      const zone = warZone(now, realm);
      if (!zone.live || zone.until === null) return 'The war zone opens during the war';
      realm = zone.enemy.id;
      spot =
        target && freeSpot(state, realm, target.x, target.y)
          ? target
          : randomFree(state, realm, `war-${state.seed}-${now}`);
      if (spot) {
        w.origin = {
          realm: w.realm,
          home: { ...w.home },
          owned: w.owned,
          cleared: w.cleared,
          until: zone.until,
        };
        w.owned = [];
        w.cleared = {};
      }
      break;
    }
  }
  if (!spot) return 'You cannot move there';
  const item = TELEPORT_ITEM[mode];
  if ((state.items[item] ?? 0) > 0) {
    state.items[item]! -= 1;
    if (state.items[item] === 0) delete state.items[item];
  } else {
    const price = teleportGoldPrice(mode);
    if (!buyWithGold || price === null || state.resources.gold < price) {
      if (mode === 'war' && w.origin) goHome(state);
      return 'Not enough Gold';
    }
    state.resources.gold -= price;
  }
  w.realm = realm;
  w.home = spot;
  events.push({ type: 'teleported', mode, realm });
  return null;
}

function goHome(state: GameState): void {
  const w = state.world;
  const o = w.origin;
  if (!o) return;
  w.realm = o.realm;
  w.home = o.home;
  w.owned = o.owned;
  w.cleared = o.cleared;
  w.origin = null;
}

/** When the war ends you are sent home (once your marches are back). */
export function advanceWarZone(state: GameState, now: number, events: GameEvent[]): void {
  const o = state.world.origin;
  if (!o || now < o.until || state.marches.length) return;
  goHome(state);
  events.push({ type: 'teleported', mode: 'home', realm: state.world.realm });
}

export const realmName = (id: number) => REALMS.find((r) => r.id === id)?.name ?? '';
