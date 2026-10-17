import { describe, expect, it } from 'vitest';
import {
  ALLIANCES,
  MIDGARD,
  NODES,
  VS,
  advance,
  apply,
  campDefenders,
  carryOf,
  deserialize,
  gatherPlan,
  midgard,
  forts,
  nearest,
  newGame,
  serialize,
  tileKey,
  travelMs,
  vsBracket,
  vsResult,
  vsSeason,
  vsStandings,
  type Command,
  type GameState,
} from '../src';

const T0 = Date.UTC(2026, 9, 15, 8, 0, 0);

function must(state: GameState, cmd: Command, now: number): GameState {
  const r = apply(state, cmd, now);
  if (!r.ok) throw new Error(`${cmd.type} rejected: ${r.error.message}`);
  return r.state;
}

describe('Midgard: jarls, camps and nodes', () => {
  it('fills every realm with alliance jarls, free jarls, camps and nodes on separate land tiles', () => {
    for (const realm of [1, 2, 3, 4]) {
      const w = midgard(realm);
      for (let a = 0; a < ALLIANCES.length; a++)
        expect(w.jarls.filter((j) => j.alliance === a).length).toBeGreaterThan(0);
      expect(w.jarls.some((j) => j.alliance === null)).toBe(true);
      expect(w.camps.length).toBeGreaterThan(20);
      expect(w.nodes.length).toBeGreaterThan(20);
      const tiles = [...w.jarls, ...w.camps, ...w.nodes].map((o) => tileKey(o.x, o.y));
      expect(new Set(tiles).size).toBe(tiles.length);
      expect(midgard(realm)).toBe(w); // cached, deterministic
    }
  });

  it('camps grow stronger towards the Law Rock', () => {
    const w = midgard(1);
    const weak = w.camps.reduce((a, b) => (b.level < a.level ? b : a));
    const strong = w.camps.reduce((a, b) => (b.level > a.level ? b : a));
    const size = (c: typeof weak) => campDefenders(c).reduce((n, u) => n + u.count * u.hp, 0);
    expect(size(strong)).toBeGreaterThan(size(weak));
  });
});

describe('marches', () => {
  it('gatherers walk out, gather, walk home and bring what they can carry', () => {
    let s = newGame(1, T0);
    s.army.troops = { 'shieldwall-1': 40 };
    const node = nearest(
      midgard(1).nodes.filter((n) => n.kind === 'farm'),
      s.world.home.x,
      s.world.home.y,
    )!;
    const food = s.resources.food;
    s = must(s, { type: 'gather', nodeId: node.id, troops: { 'shieldwall-1': 40 } }, T0);
    expect(s.army.troops['shieldwall-1'] ?? 0).toBe(0);
    const m = s.marches[0]!;
    const plan = gatherPlan(node, { 'shieldwall-1': 40 });
    expect(plan.amount).toBe(Math.min(NODES.farm.perLevel * node.level, carryOf({ 'shieldwall-1': 40 })));
    expect(m.returnAt).toBe(T0 + 2 * travelMs(s, node.x, node.y) + plan.ms);
    // Someone else cannot gather there while it is taken.
    expect(apply(s, { type: 'gather', nodeId: node.id, troops: {} }, T0).ok).toBe(false);
    const r = advance(s, m.returnAt + 1000);
    expect(r.state.marches).toHaveLength(0);
    expect(r.state.army.troops['shieldwall-1']).toBe(40);
    expect(r.state.resources.food).toBeGreaterThanOrEqual(food + plan.amount);
    expect(r.events.some((e) => e.type === 'march.returned' && e.load.food === plan.amount)).toBe(true);
  });

  it('a recalled column comes back early with part of the load', () => {
    let s = newGame(1, T0);
    s.army.troops = { 'archer-1': 30 };
    const node = nearest(midgard(1).nodes, s.world.home.x, s.world.home.y)!;
    s = must(s, { type: 'gather', nodeId: node.id, troops: { 'archer-1': 30 } }, T0);
    const m = s.marches[0]!;
    const mid = m.arriveAt + Math.floor((m.doneAt - m.arriveAt) / 2);
    s = must(s, { type: 'recall', marchId: m.id }, mid);
    const back = s.marches[0]!;
    expect(back.returnAt).toBe(mid + (m.arriveAt - m.startAt));
    const got = Object.values(back.load)[0]!;
    expect(got).toBeGreaterThan(0);
    expect(got).toBeLessThan(gatherPlan(node, { 'archer-1': 30 }).amount);
  });

  it('hunting a weak camp with a strong band wins spoils, items and clears the camp for a while', () => {
    let s = newGame(1, T0);
    s.army.troops = { 'shieldwall-2': 150, 'archer-2': 150, 'berserker-2': 150 };
    const camp = midgard(1).camps.reduce((a, b) => (b.level < a.level ? b : a));
    const bag = s.items['speed-5m'] ?? 0;
    s = must(s, { type: 'hunt', campId: camp.id, troops: { ...s.army.troops } }, T0);
    const m = s.marches[0]!;
    let r = advance(s, m.arriveAt + 1000);
    const report = r.state.reports[0]!;
    expect(report.kind).toBe('hunt');
    expect(report.won).toBe(true);
    expect(r.state.world.cleared[camp.id]).toBe(m.arriveAt + MIDGARD.campRespawnMs);
    expect(apply(r.state, { type: 'hunt', campId: camp.id, troops: {} }, m.arriveAt + 2000).ok).toBe(false);
    r = advance(r.state, m.returnAt + 1000);
    expect(r.state.marches).toHaveLength(0);
    expect(r.events.some((e) => e.type === 'march.returned' && e.kind === 'hunt')).toBe(true);
    expect(Object.keys(report.items ?? {}).length).toBeGreaterThan(0);
    if (camp.kind === 'wolves') expect(r.state.items['speed-5m']).toBe(bag + 1);
  });

  it('attacking a jarl: never your own alliance, loot capped by what survivors carry, then a peace shield', () => {
    let s = newGame(1, T0);
    const w = midgard(1);
    const ally = w.jarls.find((j) => j.alliance !== null)!;
    s = must(s, { type: 'joinAlliance', alliance: ally.alliance }, T0);
    s.army.troops = { 'shieldwall-3': 400, 'archer-3': 400, 'berserker-3': 400, 'siege-1': 50 };
    expect(apply(s, { type: 'attackJarl', jarlId: ally.id, troops: { 'shieldwall-3': 10 } }, T0).ok).toBe(
      false,
    );
    const foe = w.jarls.filter((j) => j.alliance !== ally.alliance).sort((a, b) => a.level - b.level)[0]!;
    s = must(s, { type: 'attackJarl', jarlId: foe.id, troops: { ...s.army.troops } }, T0);
    const m = s.marches[0]!;
    const r = advance(s, m.arriveAt + 1);
    const report = r.state.reports[0]!;
    expect(report.kind).toBe('jarl');
    expect(report.won).toBe(true);
    const carried = Object.values(r.state.marches[0]!.load).reduce((a, b) => a + (b ?? 0), 0);
    expect(carried).toBeLessThanOrEqual(carryOf(r.state.marches[0]!.troops));
    expect(r.state.world.cleared[foe.id]).toBe(m.arriveAt + MIDGARD.jarlShieldMs);
  });

  it('only so many columns march at once, and a jarl tile cannot be conquered as land', () => {
    let s = newGame(1, T0);
    s.army.troops = { 'shieldwall-1': 90 };
    const nodes = [...midgard(1).nodes].sort(
      (a, b) =>
        Math.hypot(a.x - s.world.home.x, a.y - s.world.home.y) -
        Math.hypot(b.x - s.world.home.x, b.y - s.world.home.y),
    );
    s = must(s, { type: 'gather', nodeId: nodes[0]!.id, troops: { 'shieldwall-1': 30 } }, T0);
    s = must(s, { type: 'gather', nodeId: nodes[1]!.id, troops: { 'shieldwall-1': 30 } }, T0);
    const third = apply(s, { type: 'gather', nodeId: nodes[2]!.id, troops: { 'shieldwall-1': 30 } }, T0);
    expect(third.ok).toBe(false);
  });

  it('saves and loads marches; a version-7 save upgrades', () => {
    let s = newGame(1, T0);
    s.army.troops = { 'shieldwall-1': 10 };
    s = must(s, { type: 'gather', nodeId: midgard(1).nodes[0]!.id, troops: { 'shieldwall-1': 10 } }, T0);
    expect(deserialize(serialize(s))).toEqual(s);
    const old = JSON.parse(serialize(newGame(1, T0)));
    old.version = old.state.version = 7;
    delete old.state.marches;
    delete old.state.nextMarchId;
    delete old.state.vs;
    delete old.state.world.cleared;
    const up = deserialize(JSON.stringify(old))!;
    expect(up.marches).toEqual([]);
    expect(up.world.cleared).toEqual({});
  });
});

describe('Alliance VS', () => {
  it('seasons last 3 days with three different themes drawn for the season', () => {
    const a = vsSeason(T0);
    expect(new Set(a.themes).size).toBe(3);
    expect(a.end - a.start).toBe(VS.seasonDays * 86_400_000);
    expect(vsSeason(a.end).season).toBe(a.season + 1);
  });

  it('pairs the alliances by rank: 1 v 2, 3 v 4, 5 v 6…', () => {
    const b = vsBracket(1, 42);
    expect(b).toHaveLength(ALLIANCES.length);
    for (let i = 0; i < b.length; i += 2) {
      expect(b[i]!.rival).toBe(i + 1);
      expect(b[i + 1]!.rival).toBe(i);
    }
    expect(b.map((x) => x.rank)).toEqual(b.map((_, i) => i + 1));
  });

  it('earns points for deeds of the day, adds them to your alliance, and pays out after the season', () => {
    const season = vsSeason(T0);
    // Find a day whose theme is build, so starting a construction scores.
    const buildDay = season.themes.indexOf('build');
    const day = buildDay >= 0 ? season.start + buildDay * 86_400_000 + 3_600_000 : null;
    let s = newGame(1, day ?? T0);
    s = must(s, { type: 'joinAlliance', alliance: 3 }, s.lastTick);
    s.resources.food = s.resources.timber = 99_999;
    s = must(s, { type: 'upgrade', buildingId: 'hall' }, s.lastTick);
    if (day) expect(s.vs.points).toBe(VS.points.build.started);
    const st = vsStandings(s, s.lastTick);
    expect(st.mine!.team).toBeGreaterThanOrEqual(st.yours);
    expect(st.players.some((p) => p.you)).toBe(true);
    // After the season ends the reward can be claimed once.
    const later = advance(s, season.end + 1000).state;
    expect(later.vs.season).toBe(season.season + 1);
    expect(vsResult(later)).not.toBeNull();
    const claimed = must(later, { type: 'claimVs' }, season.end + 2000);
    expect(claimed.vs.claimed).toBe(season.season);
    expect(apply(claimed, { type: 'claimVs' }, season.end + 3000).ok).toBe(false);
  });
});

describe('ring forts', () => {
  it('can be attacked by a strong enough army (never your own), and raise a shield when they fall', () => {
    let s = newGame(1, T0);
    const fort = forts(1).find((f) => f.alliance !== 0)!;
    s = must(s, { type: 'joinAlliance', alliance: fort.alliance }, T0);
    s.army.troops = { 'shieldwall-3': 3000, 'archer-3': 3000, 'berserker-3': 3000, 'siege-3': 300 };
    expect(apply(s, { type: 'attackJarl', jarlId: fort.id, troops: { 'siege-3': 1 } }, T0).ok).toBe(false);
    s = must(s, { type: 'joinAlliance', alliance: null }, T0);
    s = must(s, { type: 'attackJarl', jarlId: fort.id, troops: { ...s.army.troops } }, T0);
    const m = s.marches[0]!;
    const r = advance(s, m.arriveAt + 1).state;
    expect(r.reports[0]!.won).toBe(true);
    expect(r.world.cleared[fort.id]).toBeGreaterThan(m.arriveAt);
  });
});
