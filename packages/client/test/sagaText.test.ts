import { beforeAll, describe, expect, it } from 'vitest';
import { advance, apply, midgard, newGame, MIDGARD, type Command, type GameState } from '@jarlheim/sim';

// i18n touches the page on import: give it a bare one.
const g = globalThis as Record<string, unknown>;
g.document ??= { documentElement: {} };
g.navigator ??= { language: 'ar' };

let sagaLine: typeof import('../src/ui/sagaText').sagaLine;
let reportTitle: typeof import('../src/ui/sagaText').reportTitle;
beforeAll(async () => {
  ({ sagaLine, reportTitle } = await import('../src/ui/sagaText'));
});

const T0 = Date.UTC(2026, 9, 15, 8);
const must = (s: GameState, cmd: Command, now: number) => {
  const r = apply(s, cmd, now);
  if (!r.ok) throw new Error(r.error.message);
  return r.state;
};

describe('reports in Arabic', () => {
  it('every line the sim writes for hunts, treasure, jarls, scouts, spies, the barrow and notices is translated', () => {
    let s = newGame(1, T0);
    s.resources.silver = 100_000;
    s.army.troops = { 'shieldwall-3': 500, 'archer-3': 500, 'berserker-3': 500 };
    const w = midgard(1);
    const camp = w.camps.find((c) => c.kind === 'wolves')!;
    const chest = w.camps.find((c) => c.kind === 'treasure')!;
    const jarl = w.jarls.find((j) => j.alliance !== null)!;
    s = must(s, { type: 'hunt', campId: camp.id, troops: { 'shieldwall-3': 100 } }, T0);
    s = must(s, { type: 'hunt', campId: chest.id, troops: { 'archer-3': 50 } }, T0);
    s = must(s, { type: 'scout', jarlId: jarl.id }, T0);
    s = must(s, { type: 'attackDraugr', level: 1, troops: { 'berserker-3': 300 } }, T0);
    s = must(s, { type: 'joinAlliance', alliance: (jarl.alliance! + 1) % 10 }, T0);
    s = must(s, { type: 'redeemCode', code: 'SKAL-MILLION' }, T0);
    const hall = Object.values(s.buildings).find((b) => b.type === 'greatHall')!;
    hall.level = MIDGARD.spyFromHall;
    s = advance(s, T0 + 1000).state;
    s = advance(s, T0 + 2000 + MIDGARD.spyEveryMs).state;
    const kinds = new Set(s.reports.map((r) => r.kind));
    for (const k of ['hunt', 'scout', 'spied', 'notice', 'draugr']) expect(kinds.has(k as never)).toBe(true);
    const missed: string[] = [];
    for (const r of s.reports) {
      for (const line of r.saga) if (sagaLine(line, 'ar') === line) missed.push(line);
      const tt = reportTitle(r.title, 'ar');
      if (/[A-Za-z]{4,}/.test(tt.head)) missed.push(r.title);
    }
    expect(missed).toEqual([]);
  });
});
