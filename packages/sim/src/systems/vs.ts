import { ALLIANCES } from '../data/world';
import { VS, VS_THEMES, type VsTheme } from '../data/vs';
import { TROOPS } from '../data/troops';
import type { Cost } from '../data/resources';
import type { GameEvent } from '../events';
import { createRng, hashString, nextFloat } from '../rng';
import type { GameState } from '../state';
import { addItems } from './items';
import { itemDef } from '../data/items';
import { EARN } from '../data/shops';
import { alliancePower, midgard } from './midgard';

const DAY = 86_400_000;
const SEASON = VS.seasonDays * DAY;

/** The VS season at `now`: its number, today's theme and when it ends. */
export function vsSeason(now: number) {
  const season = Math.floor((now - VS.epoch) / SEASON);
  const start = VS.epoch + season * SEASON;
  const day = Math.min(VS.seasonDays - 1, Math.floor((now - start) / DAY));
  // Three different themes, drawn at random for each season.
  const rng = createRng(hashString(`vs-themes-${season}`));
  const pool: VsTheme[] = [...VS_THEMES];
  const themes: VsTheme[] = [];
  while (themes.length < VS.seasonDays)
    themes.push(pool.splice(Math.floor(nextFloat(rng) * pool.length), 1)[0]!);
  return {
    season,
    start,
    end: start + SEASON,
    day,
    themes,
    theme: themes[day]!,
    progress: (now - start) / SEASON,
  };
}

/** Starts a new season when the old one is over, keeping the old points for the reward. */
export function rollVs(state: GameState, now: number): void {
  const { season } = vsSeason(now);
  if (state.vs.season === season) return;
  if (state.vs.season >= 0)
    state.vs.last = { season: state.vs.season, points: state.vs.points, alliance: state.world.alliance };
  state.vs.season = season;
  state.vs.points = 0;
}

/** VS points a step's events earn under today's theme. */
export function vsPoints(events: GameEvent[], theme: VsTheme, warZone = false): number {
  const p = VS.points;
  let n = 0;
  for (const e of events) {
    switch (theme) {
      case 'build':
        if (e.type === 'construction.started') n += p.build.started;
        if (e.type === 'item.used' && e.queue === 'build') n += p.speedupPerMinute * speedMinutes(e);
        if (e.type === 'building.completed') n += p.build.completedPerLevel * e.level;
        break;
      case 'train':
        if (e.type === 'training.completed') n += p.train.perTier * e.count * (TROOPS[e.troopId]?.tier ?? 1);
        if (e.type === 'item.used' && e.queue === 'train') n += p.speedupPerMinute * speedMinutes(e);
        break;
      case 'gather':
        if (e.type === 'march.returned' && e.kind === 'gather')
          for (const [r, v] of Object.entries(e.load))
            n += (p.gather[r as keyof typeof p.gather] ?? 0) * (v ?? 0);
        break;
      case 'hunt':
        if (e.type === 'battle.resolved' && e.won && (e.kind === 'hunt' || e.kind === 'draugr'))
          n += p.hunt.perLevel * e.level;
        break;
      case 'war':
        if (e.type === 'battle.resolved' && e.won && (e.kind === 'jarl' || e.kind === 'conquest'))
          n += (p.war.win + p.war.perLevel * e.level) * (warZone && e.kind === 'jarl' ? p.war.warZone : 1);
        if (e.type === 'pvp.fought' && e.won) n += p.war.win * 2;
        if (e.type === 'raid.resolved' && e.won) n += p.war.win;
        break;
      case 'heroes':
        if (e.type === 'heroes.recruited') n += p.heroes.recruit * e.heroes.length;
        if (e.type === 'item.used' && e.itemId === 'hero-scroll') n += p.heroes.scroll * e.count;
        if (e.type === 'item.used' && e.itemId === 'star-shard') n += p.heroes.shard * e.count;
        break;
    }
  }
  return Math.round(n);
}

/** Minutes of speed-up in an item.used event. */
function speedMinutes(e: Extract<GameEvent, { type: 'item.used' }>): number {
  const def = itemDef(e.itemId);
  return def?.kind === 'speedup' ? def.minutes * e.count : 0;
}

export function trackVs(state: GameState, events: GameEvent[], now: number): void {
  rollVs(state, now);
  const before = state.vs.points;
  state.vs.points += vsPoints(events, vsSeason(now).theme, !!state.world.origin);
  // A VS medal for every 100 points, to spend in the VS shop.
  state.wallet.medals +=
    Math.floor(state.vs.points / EARN.vsPointsPerMedal) - Math.floor(before / EARN.vsPointsPerMedal);
}

/** This season's alliances in rank order (strength, shuffled a little each season), paired 1v2, 3v4… */
export function vsBracket(realmId: number, season: number) {
  const ranked = ALLIANCES.map((_, a) => {
    const rng = createRng(hashString(`vs-rank-${realmId}-${season}-${a}`));
    return { alliance: a, power: alliancePower(realmId, a), roll: 0.85 + nextFloat(rng) * 0.3 };
  }).sort((x, y) => y.power * y.roll - x.power * x.roll || x.alliance - y.alliance);
  const max = Math.max(...ranked.map((r) => r.power));
  const total = (a: number, power: number) => {
    const rng = createRng(hashString(`vs-total-${realmId}-${season}-${a}`));
    return (
      VS.allianceBase *
      (0.6 + 0.6 * (power / max)) *
      (1 - VS.allianceSpread / 2 + nextFloat(rng) * VS.allianceSpread)
    );
  };
  return ranked.map((r, i) => ({
    rank: i + 1,
    alliance: r.alliance,
    power: r.power,
    /** Index in `ranked` of the alliance it fights. */
    rival: i % 2 === 0 ? (i + 1 < ranked.length ? i + 1 : i - 1) : i - 1,
    total: total(r.alliance, r.power),
  }));
}

/** Scores now: AI alliances grow through the season; your alliance adds your points. */
export function vsStandings(state: GameState, now: number) {
  const s = vsSeason(now);
  const realm = state.world.realm;
  const bracket = vsBracket(realm, s.season);
  const mine = state.world.alliance;
  const yours = state.vs.season === s.season ? state.vs.points : 0;
  const score = (i: number) => {
    const b = bracket[i]!;
    return Math.round(b.total * s.progress) + (b.alliance === mine ? yours : 0);
  };
  const pairs: Array<{ a: number; b: number; scoreA: number; scoreB: number; rankA: number; rankB: number }> =
    [];
  for (let i = 0; i < bracket.length; i += 2) {
    const j = Math.min(i + 1, bracket.length - 1);
    pairs.push({
      a: bracket[i]!.alliance,
      b: bracket[j]!.alliance,
      scoreA: score(i),
      scoreB: score(j),
      rankA: i + 1,
      rankB: j + 1,
    });
  }
  const myIndex = bracket.findIndex((b) => b.alliance === mine);
  const players = midgard(realm)
    .jarls.map((j) => {
      const rng = createRng(hashString(`vs-jarl-${realm}-${s.season}-${j.id}`));
      return {
        id: j.id,
        name: j.name,
        alliance: j.alliance,
        points: Math.round(VS.jarlPerLevel * j.level * (0.4 + nextFloat(rng) * 1.2) * s.progress),
        you: false,
      };
    })
    .concat([{ id: 'you', name: state.profile.name, alliance: mine, points: yours, you: true }])
    .sort((a, b) => b.points - a.points);
  return {
    ...s,
    yours,
    bracket,
    pairs,
    players,
    myRank: players.findIndex((p) => p.you) + 1,
    mine:
      myIndex < 0
        ? null
        : {
            alliance: mine!,
            rank: myIndex + 1,
            rival: bracket[bracket[myIndex]!.rival]!.alliance,
            team: score(myIndex),
            enemy: score(bracket[myIndex]!.rival),
          },
  };
}

/** The result of the season before, and what it pays out. */
export function vsResult(state: GameState) {
  const last = state.vs.last;
  if (!last || last.season <= state.vs.claimed) return null;
  const items: Record<string, number> = {};
  const reward: Cost = {};
  let won = false;
  let rival: number | null = null;
  let team = 0;
  let enemy = 0;
  if (last.alliance !== null) {
    const bracket = vsBracket(state.world.realm, last.season);
    const i = bracket.findIndex((b) => b.alliance === last.alliance);
    if (i >= 0) {
      team = Math.round(bracket[i]!.total) + last.points;
      enemy = Math.round(bracket[bracket[i]!.rival]!.total);
      rival = bracket[bracket[i]!.rival]!.alliance;
      won = team > enemy;
      const r = won ? VS.rewards.win : VS.rewards.lose;
      Object.assign(items, r.items);
      reward.gold = r.gold;
    }
  }
  for (const tier of VS.rewards.tiers)
    if (last.points >= tier.points)
      for (const [id, n] of Object.entries(tier.items)) items[id] = (items[id] ?? 0) + n;
  return {
    season: last.season,
    points: last.points,
    alliance: last.alliance,
    rival,
    team,
    enemy,
    won,
    items,
    reward,
  };
}

/** Claims the season-end reward. Returns an error message, or null. */
export function claimVs(state: GameState, events: GameEvent[]): string | null {
  const r = vsResult(state);
  if (!r) return 'No VS reward to claim';
  addItems(state, r.items);
  if (r.reward.gold) state.resources.gold += r.reward.gold;
  if (r.alliance !== null) state.wallet.medals += r.won ? EARN.medalsWin : EARN.medalsLose;
  state.vs.claimed = r.season;
  events.push({ type: 'vs.claimed', won: r.won, items: r.items, reward: r.reward });
  return null;
}
