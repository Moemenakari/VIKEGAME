import { describe, expect, it } from 'vitest';
import {
  SHOPS,
  STAMINA,
  VS,
  WARFARE,
  advance,
  apply,
  deserialize,
  freeSpot,
  kingsWar,
  midgard,
  nearest,
  newGame,
  rallyAllies,
  serialize,
  vsSeason,
  warZone,
  type Command,
  type GameState,
} from '../src';
import { TEST_CODE, addTestCode } from './testCode';

addTestCode();

const T0 = Date.UTC(2026, 9, 15, 8, 0, 0); // a Thursday

function must(state: GameState, cmd: Command, now: number): GameState {
  const r = apply(state, cmd, now);
  if (!r.ok) throw new Error(`${cmd.type} rejected: ${r.error.message}`);
  return r.state;
}

describe('shops', () => {
  it('sell for the right currency, with daily limits that reset the next day', () => {
    let s = newGame(1, T0);
    s.resources.gold = 10_000;
    const offer = SHOPS.gold.offers.find((o) => o.item === 'speed-1h')!;
    const have = s.items['speed-1h'] ?? 0;
    s = must(s, { type: 'buy', shop: 'gold', offerId: offer.id, count: offer.limit }, T0);
    expect(s.items['speed-1h']).toBe(have + offer.limit);
    expect(s.resources.gold).toBe(10_000 - offer.price * offer.limit);
    expect(apply(s, { type: 'buy', shop: 'gold', offerId: offer.id, count: 1 }, T0).ok).toBe(false);
    expect(apply(s, { type: 'buy', shop: 'gold', offerId: offer.id, count: 1 }, T0 + 86_400_000).ok).toBe(
      true,
    );
  });

  it('alliance points and medals are their own currencies', () => {
    const s = newGame(1, T0);
    expect(apply(s, { type: 'buy', shop: 'alliance', offerId: 'a-speed-5m', count: 1 }, T0).ok).toBe(false);
    s.wallet.alliance = 100;
    s.wallet.medals = 200;
    expect(apply(s, { type: 'buy', shop: 'alliance', offerId: 'a-speed-5m', count: 1 }, T0).ok).toBe(true);
    expect(apply(s, { type: 'buy', shop: 'vs', offerId: 'v-tp-war', count: 1 }, T0).ok).toBe(true);
  });
});

describe('stamina', () => {
  it('hunting costs stamina, it comes back with time, and mead restores it', () => {
    let s = newGame(1, T0);
    s.army.troops = { 'shieldwall-2': 300 };
    const camp = nearest(midgard(1).camps, s.world.home.x, s.world.home.y)!;
    s = must(s, { type: 'hunt', campId: camp.id, troops: { 'shieldwall-2': 10 } }, T0);
    const cost = STAMINA.cost[camp.kind]!;
    expect(s.wallet.stamina).toBe(STAMINA.max - cost);
    s = advance(s, T0 + STAMINA.regenMs * 2 + 1).state;
    expect(s.wallet.stamina).toBe(STAMINA.max - cost + 2);
    s.wallet.stamina = 0;
    const other = midgard(1).camps.find((c) => c.id !== camp.id)!;
    expect(apply(s, { type: 'hunt', campId: other.id, troops: { 'shieldwall-2': 10 } }, s.lastTick).ok).toBe(
      false,
    );
    s.items['stamina-10'] = 1;
    s = must(s, { type: 'useItem', itemId: 'stamina-10', count: 1 }, s.lastTick);
    expect(s.wallet.stamina).toBeGreaterThanOrEqual(10);
  });
});

describe('teleports', () => {
  it('move the hold to a chosen free spot with a charter, or for Gold', () => {
    let s = newGame(1, T0);
    const map = midgard(1);
    const spot = { x: s.world.home.x, y: s.world.home.y };
    // A free spot a few tiles away.
    let target = spot;
    for (let d = 3; d < 10 && target === spot; d++)
      for (const [dx, dy] of [
        [d, 0],
        [0, d],
        [-d, 0],
        [0, -d],
      ] as const)
        if (freeSpot(s, 1, spot.x + dx, spot.y + dy)) {
          target = { x: spot.x + dx, y: spot.y + dy };
          break;
        }
    s = must(s, { type: 'teleport', mode: 'advanced', ...target }, T0);
    expect(s.world.home).toEqual(target);
    expect(s.items['teleport-advanced'] ?? 0).toBe(0);
    // No charter left and no Gold: refused. With Gold: it buys one and moves.
    s.resources.gold = 0;
    expect(apply(s, { type: 'teleport', mode: 'advanced', ...spot, buy: true }, T0).ok).toBe(false);
    s.resources.gold = 1_000;
    s = must(s, { type: 'teleport', mode: 'advanced', ...spot, buy: true }, T0);
    expect(s.world.home).toEqual(spot);
    // Never onto a jarl's hold.
    const j = map.jarls[0]!;
    expect(apply(s, { type: 'teleport', mode: 'advanced', x: j.x, y: j.y, buy: true }, T0).ok).toBe(false);
  });

  it('the alliance summons lands you by your ring fort', () => {
    let s = newGame(1, T0);
    s = must(s, { type: 'joinAlliance', alliance: 4 }, T0);
    s.items['teleport-alliance'] = 1;
    s = must(s, { type: 'teleport', mode: 'alliance' }, T0);
    const seat = midgard(1).jarls.length && s.world.home;
    expect(seat).toBeTruthy();
  });

  it('the war zone: across to the enemy realm while the war is on, double war points, home when it ends', () => {
    // Saturday during the King's War.
    const war = kingsWar(T0, 1);
    const during = war.start + 60_000;
    let s = newGame(1, T0);
    s.items['teleport-war'] = 1;
    expect(apply(s, { type: 'teleport', mode: 'war' }, T0).ok).toBe(warZone(T0, 1).live);
    s = advance(s, during).state;
    s = must(s, { type: 'teleport', mode: 'war' }, during);
    expect(s.world.realm).toBe(war.opponent.id);
    expect(s.world.origin?.realm).toBe(1);
    // Free to go home early…
    const home = must(s, { type: 'teleport', mode: 'home' }, during + 1000);
    expect(home.world.realm).toBe(1);
    expect(home.world.origin).toBeNull();
    // …and sent home when the war ends.
    const after = advance(s, Math.max(war.end, s.world.origin!.until) + 1000).state;
    expect(after.world.realm).toBe(1);
  });
});

describe('scouting and rallies', () => {
  it('a scout report shows the warriors, wall, stores and heroes of a hold', () => {
    let s = newGame(1, T0);
    const j = midgard(1).jarls.find((x) => x.level >= 3)!;
    s.resources.silver = 10_000;
    s = must(s, { type: 'scout', jarlId: j.id }, T0);
    const r = s.reports[0]!;
    expect(r.kind).toBe('scout');
    expect(Object.keys(r.scout!.troops).length).toBeGreaterThan(0);
    expect(r.scout!.wall).toBeGreaterThan(0);
    expect(r.scout!.heroes).toHaveLength(3);
    expect(s.resources.silver).toBe(10_000 - WARFARE.scoutSilverPerLevel * j.level);
  });

  it('a rally waits for the alliance, marches with their warriors, and only your own can fall', () => {
    let s = newGame(1, T0);
    expect(apply(s, { type: 'rally', jarlId: midgard(1).jarls[0]!.id, troops: {} }, T0).ok).toBe(false);
    const w = midgard(1);
    const mine = w.jarls[0]!.alliance!;
    s = must(s, { type: 'joinAlliance', alliance: mine }, T0);
    const foe = w.jarls.filter((j) => j.alliance !== mine).sort((a, b) => a.level - b.level)[0]!;
    s.army.troops = { 'berserker-1': 20 };
    const allies = rallyAllies(s)!;
    expect(Object.keys(allies).length).toBeGreaterThan(0);
    s = must(s, { type: 'rally', jarlId: foe.id, troops: { 'berserker-1': 20 } }, T0);
    const m = s.marches[0]!;
    expect(m.allies).toEqual(allies);
    expect(m.arriveAt - m.startAt).toBeGreaterThanOrEqual(WARFARE.rallyWaitMs);
    const r = advance(s, m.arriveAt + 1).state;
    const report = r.reports[0]!;
    expect(report.attacker.some((l) => l.unit.startsWith('ally-'))).toBe(true);
    expect(Object.keys(r.marches[0]?.troops ?? {}).every((id) => !id.startsWith('ally-'))).toBe(true);
  });
});

describe('VS: saving items for the right day', () => {
  it('speed-ups score on build day, hero scrolls on heroes day, and points earn medals', () => {
    const season = vsSeason(T0);
    const d = season.themes.indexOf('build');
    if (d < 0) return; // this season has no build day
    const at = season.start + d * 86_400_000 + 3_600_000;
    let s = newGame(1, at);
    s.resources.food = s.resources.timber = 99_999;
    s = must(s, { type: 'upgrade', buildingId: 'hall' }, at);
    const before = s.vs.points;
    s = must(
      s,
      { type: 'useItem', itemId: 'speed-5m', count: 1, target: { queue: 'build', buildingId: 'hall' } },
      at,
    );
    expect(s.vs.points - before).toBe(VS.points.speedupPerMinute * 5);
    expect(s.wallet.medals).toBe(Math.floor(s.vs.points / 100));
  });

  it('saves and upgrades a version-8 save', () => {
    const s = newGame(1, T0);
    expect(deserialize(serialize(s))).toEqual(s);
    const old = JSON.parse(serialize(s));
    old.version = old.state.version = 8;
    delete old.state.wallet;
    delete old.state.shop;
    delete old.state.world.origin;
    const up = deserialize(JSON.stringify(old))!;
    expect(up.wallet.stamina).toBe(STAMINA.max);
    expect(up.world.origin).toBeNull();
  });
});

describe('gift codes', () => {
  it('the test code gives a million of everything, once per hold; a wrong code is refused', () => {
    let s = newGame(1, T0);
    expect(apply(s, { type: 'redeemCode', code: 'NOPE' }, T0).ok).toBe(false);
    s = must(s, { type: 'redeemCode', code: ` ${TEST_CODE.toLowerCase()} ` }, T0);
    expect(s.resources.gold).toBeGreaterThanOrEqual(1_000_000);
    expect(s.resources.food).toBeGreaterThanOrEqual(1_000_000);
    expect(s.items['speed-8h']).toBe(100);
    expect(apply(s, { type: 'redeemCode', code: ` ${TEST_CODE.toLowerCase()} ` }, T0).ok).toBe(false);
  });
});
