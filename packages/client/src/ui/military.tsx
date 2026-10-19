import {
  BUILDINGS,
  HEROES,
  DRAUGR_BANDS,
  DRAUGR_UNITS,
  FORMATIONS,
  formationCapacity,
  formations,
  ECONOMY,
  TROOPS,
  TROOP_TIERS,
  apply,
  batchLimit,
  goldToFinish,
  healCost,
  healDurationMs,
  sumCounts,
  trainCost,
  trainDurationMs,
  woundedCapacity,
  type BattleReport,
  type Building,
  type Command,
  type Cost,
  type GameState,
  type ResourceId,
  type UnitType,
} from '@jarlheim/sim';
import { useState } from 'react';
import type { GameStore } from '../game/store';
import { formatAmount, formatDuration } from './format';
import { t, troopName, useLang } from './i18n';
import { reportTitle, sagaLine } from './sagaText';
import { NeedLink } from './NeedLink';
import { ResourceIcon, TroopTypeIcon } from './icons';
import { HelpTip } from './help';

type Run = (cmd: Command, close?: boolean) => void;

/** A row of resource amounts; with `state`, amounts you cannot afford are marked. */
export function CostLine({ cost, state }: { cost: Cost; state?: GameState }) {
  return (
    <span className="cost">
      {(Object.entries(cost) as Array<[ResourceId, number]>).map(([res, n]) => (
        <span key={res} className={state && state.resources[res] < n ? 'short' : ''}>
          <ResourceIcon res={res} size={14} />
          {formatAmount(n)}
        </span>
      ))}
    </span>
  );
}

/** Rough fighting strength, for the "how risky is this?" hint only (the real fight is simulated). */
function strength(stacks: Array<{ atk: number; def: number; hp: number; count: number }>): number {
  return Math.round(stacks.reduce((s, u) => s + u.count * Math.sqrt(u.atk * (u.hp + u.def * 2)), 0));
}

function TimerActions({
  run,
  buildingId,
  left,
  queue,
}: {
  run: Run;
  buildingId: string;
  left: number;
  queue: 'train' | 'heal';
}) {
  return left <= ECONOMY.freeFinishMs ? (
    <button
      className="primary"
      onClick={() => run({ type: 'finishFree', buildingId, queue })}
      data-testid={`${queue}-finish-free`}
      data-hint="finish"
    >
      {t('finishFree')}
    </button>
  ) : (
    <button className="secondary" onClick={() => run({ type: 'finishWithGold', buildingId, queue })}>
      {t('finishGold', { n: goldToFinish(left) })}
    </button>
  );
}

// ---- training -------------------------------------------------------------

export function TrainSection({
  state,
  building,
  now,
  run,
}: {
  state: GameState;
  building: Building;
  now: number;
  run: Run;
}) {
  const type = BUILDINGS[building.type].trains!;
  const tiers = Array.from({ length: TROOP_TIERS }, (_, i) => TROOPS[`${type}-${i + 1}`]!);
  const unlocked = tiers.filter((t) => building.level >= t.unlockLevel);
  const [troopId, setTroopId] = useState(unlocked.at(-1)?.id ?? tiers[0]!.id);
  const troop = TROOPS[troopId]!;
  const limit = batchLimit(Math.max(1, building.level));
  const affordable = Math.min(
    limit,
    ...(Object.entries(troop.cost) as Array<[ResourceId, number]>).map(([r, n]) =>
      Math.floor(state.resources[r] / n),
    ),
  );
  const [count, setCount] = useState(Math.max(1, affordable));
  const job = state.training.find((j) => j.buildingId === building.id);

  if (building.level < 1) return null;
  if (job) {
    const left = Math.max(0, job.endsAt - now);
    return (
      <div className="section">
        <h3>{t('training')}</h3>
        <div className="progress">
          <i style={{ width: `${100 * (1 - left / Math.max(1, job.endsAt - job.startedAt))}%` }} />
        </div>
        <p className="stat">
          {t('readyIn', { n: job.count, name: troopName(job.troopId), t: formatDuration(left) })}
        </p>
        <TimerActions run={run} buildingId={building.id} left={left} queue="train" />
      </div>
    );
  }

  const n = Math.max(1, Math.min(count, limit));
  const cmd: Command = { type: 'train', buildingId: building.id, troopId, count: n };
  const check = apply(state, cmd, now);
  return (
    <div className="section">
      <h3>{t('train')}</h3>
      <div className="tiers">
        {tiers.map((t) => (
          <button
            key={t.id}
            className={`tier ${t.id === troopId ? 'active' : ''}`}
            disabled={building.level < t.unlockLevel}
            onClick={() => setTroopId(t.id)}
          >
            <TroopTypeIcon type={t.type} size={16} /> {troopName(t.id, t.name)}
            <small>{building.level < t.unlockLevel ? `🔒 ${t.unlockLevel}` : `T${t.tier}`}</small>
          </button>
        ))}
      </div>
      <p className="muted stats-line">{t('stats', { a: troop.atk, d: troop.def, h: troop.hp })}</p>
      <div className="count-row">
        <input
          type="range"
          min={1}
          max={limit}
          value={n}
          onChange={(e) => setCount(Number(e.target.value))}
          aria-label="How many"
          data-testid="train-count"
        />
        <strong>{n}</strong>
      </div>
      <div className="meta">
        <CostLine cost={trainCost(troopId, n)} state={state} />
        <span className="time">⏱ {formatDuration(trainDurationMs(troopId, n))}</span>
      </div>
      {!check.ok && <NeedLink error={check.error} />}
      <button
        className="primary"
        disabled={!check.ok}
        onClick={() => run(cmd)}
        data-testid="train"
        data-hint="train"
      >
        {t('trainN', { n })} {troopName(troopId)}
      </button>
    </div>
  );
}

// ---- healing --------------------------------------------------------------

export function HealSection({ state, now, run }: { state: GameState; now: number; run: Run }) {
  const wounded = sumCounts(state.army.wounded);
  const cap = woundedCapacity(state);
  if (state.healing) {
    const left = Math.max(0, state.healing.endsAt - now);
    return (
      <div className="section">
        <h3>{t('healing')}</h3>
        <div className="progress">
          <i
            style={{
              width: `${100 * (1 - left / Math.max(1, state.healing.endsAt - state.healing.startedAt))}%`,
            }}
          />
        </div>
        <p className="stat">
          {t('healingIn', { n: sumCounts(state.healing.troops), t: formatDuration(left) })}
        </p>
        <TimerActions run={run} buildingId="healing" left={left} queue="heal" />
      </div>
    );
  }
  return (
    <div className="section">
      <h3>{t('wounded')}</h3>
      <p className="stat">{t('woundedRoom', { n: wounded, c: cap })}</p>
      {wounded > 0 && (
        <>
          <div className="meta">
            <CostLine cost={healCost(state.army.wounded)} state={state} />
            <span className="time">⏱ {formatDuration(healDurationMs(state.army.wounded))}</span>
          </div>
          <button className="primary" onClick={() => run({ type: 'heal' })} data-testid="heal">
            {t('healAll')}
          </button>
        </>
      )}
    </div>
  );
}

// ---- army overview ----------------------------------------------------------

function TroopList({ counts, empty }: { counts: Record<string, number>; empty: string }) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (!entries.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="troop-list">
      {entries.map(([id, n]) => {
        const t = TROOPS[id]!;
        return (
          <li key={id}>
            <TroopTypeIcon type={t.type} size={18} />
            <span>{troopName(id, t.name)}</span>
            <small>T{t.tier}</small>
            <strong>{n}</strong>
          </li>
        );
      })}
    </ul>
  );
}

export function ArmyPanel({
  state,
  now,
  run,
  onClose,
  onBarrow,
}: {
  state: GameState;
  now: number;
  run: Run;
  onClose: () => void;
  onBarrow: () => void;
}) {
  return (
    <section className="card panel" data-testid="army" role="dialog" aria-label={t('warband')}>
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      <h2>{t('warband')}</h2>
      <HelpTip id="warband" state={state} />
      <p className="norse">Lið · {t('warriorsHome', { n: sumCounts(state.army.troops) })}</p>
      <TroopList counts={state.army.troops} empty={t('noWarriors')} />
      <SquadsSection state={state} run={run} />
      <HealSection state={state} now={now} run={run} />
      <button className="primary" onClick={onBarrow} data-testid="to-barrow">
        {t('toBarrow')}
      </button>
    </section>
  );
}

/**
 * The four squads (owner request): each with up to three heroes and its saved warriors.
 * The squad's size grows with its heroes' levels; on the map one tap sends it.
 */
function SquadsSection({ state, run }: { state: GameState; run: Run }) {
  const [open, setOpen] = useState(0);
  const all = formations(state);
  const f = all[open]!;
  const cap = formationCapacity(state, f.heroes);
  const owned = HEROES.filter((h) => state.heroes.owned[h.id]);
  const land = Object.entries(state.army.troops).filter(([id, n]) => n > 0 && TROOPS[id]?.type !== 'ship');
  const save = (heroes: string[], troops: Record<string, number>) =>
    run({ type: 'setFormation', index: open, heroes, troops });
  /** Fill the squad from the warriors at home, a fair share of each kind, up to its size. */
  const fill = (heroes: string[]) => {
    const c = formationCapacity(state, heroes);
    const total = land.reduce((a, [, n]) => a + n, 0);
    const k = total > c ? c / total : 1;
    save(heroes, Object.fromEntries(land.map(([id, n]) => [id, Math.floor(n * k)])));
  };
  const toggle = (id: string) => {
    const heroes = f.heroes.includes(id)
      ? f.heroes.filter((h) => h !== id)
      : [...f.heroes, id].slice(0, FORMATIONS.heroesPer);
    // Keep the warriors if they still fit, otherwise refill to the new size.
    if (sumCounts(f.troops) <= formationCapacity(state, heroes)) save(heroes, f.troops);
    else fill(heroes);
  };
  return (
    <div className="squads" data-testid="squads">
      <h3>⚔ {t('squads')}</h3>
      <p className="muted">{t('squadsHow')}</p>
      <div className="tabs" role="tablist">
        {all.map((q, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={open === i}
            className={open === i ? 'active' : ''}
            onClick={() => setOpen(i)}
            data-testid={`squad-tab-${i + 1}`}
          >
            {i + 1} · {formatAmount(sumCounts(q.troops))}
          </button>
        ))}
      </div>
      <p className="stat">
        👥 {formatAmount(sumCounts(f.troops))} / {formatAmount(cap)} · ⭐ {f.heroes.length}/
        {FORMATIONS.heroesPer}
      </p>
      <div className="hero-chips">
        {owned.map((h) => {
          const other = all.findIndex((q, i) => i !== open && q.heroes.includes(h.id));
          return (
            <button
              key={h.id}
              className={`chip ${f.heroes.includes(h.id) ? 'on' : ''}`}
              onClick={() => toggle(h.id)}
              data-testid={`squad-hero-${h.id}`}
            >
              {h.name.split(' ')[0]} {state.heroes.owned[h.id]!.level}
              {other >= 0 && <small> ({other + 1})</small>}
            </button>
          );
        })}
      </div>
      <p className="stat">
        {Object.entries(f.troops).map(([id, n]) => (
          <span key={id} className="cost">
            <TroopTypeIcon type={TROOPS[id]!.type} size={14} /> {formatAmount(n)}
          </span>
        ))}
      </p>
      <div className="row">
        <button className="primary small" onClick={() => fill(f.heroes)} data-testid="squad-fill">
          {t('squadFill')}
        </button>
        <button className="secondary small" onClick={() => save(f.heroes, {})}>
          {t('squadClear')}
        </button>
      </div>
    </div>
  );
}

// ---- the barrow ---------------------------------------------------------------

export function BarrowPanel({
  state,
  store,
  onClose,
  onReport,
  onError,
}: {
  state: GameState;
  store: GameStore;
  onClose: () => void;
  onReport: (id: number) => void;
  onError: (m: string) => void;
}) {
  const next = Math.min(state.pve.draugrCleared + 1, DRAUGR_BANDS.length);
  const [level, setLevel] = useState(next);
  const [left, setLeft] = useState<Record<string, boolean>>({});
  const band = DRAUGR_BANDS[level - 1]!;
  const send = Object.fromEntries(Object.entries(state.army.troops).filter(([id]) => !left[id]));
  const ours = strength(Object.entries(send).map(([id, count]) => ({ ...TROOPS[id]!, count })));
  const theirs = strength(Object.entries(band.units).map(([id, count]) => ({ ...DRAUGR_UNITS[id]!, count })));
  const ratio = theirs ? ours / theirs : 0;
  const verdict = ratio >= 1.6 ? 'favourable' : ratio >= 1.1 ? 'even' : ratio > 0 ? 'risky' : 'noneChosen';

  const attack = () => {
    const before = state.nextReportId;
    const err = store.dispatch({ type: 'attackDraugr', level, troops: send });
    if (err) onError(err.message);
    else onReport(before);
  };

  return (
    <section className="card panel" data-testid="barrow" role="dialog" aria-label={t('barrow')}>
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      <h2>{t('barrow')}</h2>
      <HelpTip id="barrow" state={state} />
      <p className="norse">Haugr · {t('barrowSub')}</p>
      <div className="levels">
        {DRAUGR_BANDS.map((b) => (
          <button
            key={b.level}
            className={`level ${b.level === level ? 'active' : ''} ${b.level <= state.pve.draugrCleared ? 'done' : ''}`}
            disabled={b.level > next}
            onClick={() => setLevel(b.level)}
          >
            {b.level <= state.pve.draugrCleared ? '✓' : b.level}
          </button>
        ))}
      </div>
      <h3>{t('level', { n: band.level })}</h3>
      <ul className="troop-list">
        {Object.entries(band.units).map(([id, n]) => {
          const u = DRAUGR_UNITS[id]!;
          return (
            <li key={id}>
              <TroopTypeIcon type={u.type} size={18} />
              <span>{troopName(id, u.name)}</span>
              <strong>{n}</strong>
            </li>
          );
        })}
      </ul>
      <p className="muted">
        {t('reward')}: <CostLine cost={band.reward} />
        {band.level > state.pve.draugrCleared && ` ${t('firstClear')}`}
      </p>
      <h3>{t('send')}</h3>
      <div className="send-list">
        {Object.entries(state.army.troops).map(([id, n]) => (
          <label key={id} className="send-item">
            <input
              type="checkbox"
              checked={!left[id]}
              onChange={() => setLeft({ ...left, [id]: !left[id] })}
            />
            <TroopTypeIcon type={TROOPS[id]!.type} size={16} /> {n} {troopName(id)}
          </label>
        ))}
        {sumCounts(state.army.troops) === 0 && <p className="muted">{t('noneHome')}</p>}
      </div>
      <p className={`verdict ${verdict}`}>
        {t('odds')}: <strong>{t(verdict)}</strong> ·{' '}
        {t('vsLine', { a: formatAmount(ours), b: formatAmount(theirs) })}
      </p>
      <p className="muted">{t('counters')}</p>
      <button
        className="primary"
        disabled={sumCounts(send) === 0}
        onClick={attack}
        data-testid="attack"
        data-hint="attack"
      >
        {t('attack')}
      </button>
    </section>
  );
}

// ---- battle reports --------------------------------------------------------------

const TYPE_ORDER: UnitType[] = [
  'wall',
  'ship',
  'shieldwall',
  'bear',
  'berserker',
  'cavalry',
  'archer',
  'siege',
];

export function ReportView({ report, onClose }: { report: BattleReport; onClose: () => void }) {
  const lang = useLang();
  if (report.scout) return <ScoutView report={report} onClose={onClose} />;
  if (report.kind === 'notice') return <NoticeView report={report} onClose={onClose} />;
  const tt = reportTitle(report.title, lang);
  return (
    <section className="card panel report" data-testid="report" role="dialog" aria-label={report.title}>
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      <p className={`banner ${report.won ? 'won' : 'lost'}`}>{tt.head}</p>
      <h2>{tt.name}</h2>
      <p className="norse">
        {report.kind === 'raid'
          ? `⚔ ${t('raids')} #${report.level}`
          : t('rounds', { l: report.level, r: report.rounds })}
      </p>
      <div className="saga">
        {report.saga.map((line, i) => (
          <p key={i}>{sagaLine(line, lang)}</p>
        ))}
      </div>
      {report.loot && Object.keys(report.loot).length > 0 && (
        <p className="stat warn-text">
          {t('loot')}: <CostLine cost={report.loot} />
        </p>
      )}
      {(report.kind === 'hunt' || report.kind === 'jarl') && Object.keys(report.reward).length > 0 && (
        <p className="stat">
          {t('spoils')}: <CostLine cost={report.reward} />{' '}
          {Object.keys(report.items ?? {}).length > 0 && '🎁'}
        </p>
      )}
      {report.kind === 'raid' && Object.keys(report.reward).length > 0 && (
        <p className="stat">
          {t('salvage')}: <CostLine cost={report.reward} />
        </p>
      )}
      <table className="losses">
        <thead>
          <tr>
            <th>{t('yourWarriors')}</th>
            <th>{t('sent')}</th>
            <th>{t('fell')}</th>
            <th>{t('wounded')}</th>
          </tr>
        </thead>
        <tbody>
          {[...report.attacker]
            .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))
            .map((l) => (
              <tr key={l.unit}>
                <td>
                  <TroopTypeIcon type={l.type} size={14} /> {troopName(l.unit, l.name)}
                </td>
                <td>{l.start}</td>
                <td>{l.dead}</td>
                <td>{l.wounded}</td>
              </tr>
            ))}
        </tbody>
        <thead>
          <tr>
            <th>{t('theDead')}</th>
            <th>{t('rose')}</th>
            <th>{t('fell')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {report.defender.map((l) => (
            <tr key={l.unit}>
              <td>
                <TroopTypeIcon type={l.type} size={14} /> {troopName(l.unit, l.name)}
              </td>
              <td>{l.start}</td>
              <td>{l.dead}</td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Which tab of the mail a report belongs to. */
const MAIL_TAB = (r: BattleReport): 'battles' | 'scouts' | 'system' =>
  r.kind === 'notice' ? 'system' : r.kind === 'scout' || r.kind === 'spied' ? 'scouts' : 'battles';

const MAIL_ICON: Record<BattleReport['kind'], string> = {
  draugr: '💀',
  raid: '⛵',
  conquest: '🚩',
  pvp: '⚔️',
  hunt: '🐺',
  jarl: '🏰',
  scout: '👁',
  spied: '🕵️',
  notice: '📜',
};

/** The mail (owner request): battles, scouts and notices in tabs, and "read all" in one tap. */
export function ReportsPanel({
  state,
  onOpen,
  onReadAll,
  onClose,
}: {
  state: GameState;
  onOpen: (id: number) => void;
  onReadAll: () => void;
  onClose: () => void;
}) {
  const lang = useLang();
  const [tab, setTab] = useState<'all' | 'battles' | 'scouts' | 'system'>('all');
  const shown = state.reports.filter((r) => tab === 'all' || MAIL_TAB(r) === tab);
  const unread = (k: typeof tab) =>
    state.reports.filter((r) => !r.read && (k === 'all' || MAIL_TAB(r) === k)).length;
  return (
    <section className="card panel" data-testid="reports" role="dialog" aria-label={t('mail')}>
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      <h2>📬 {t('mail')}</h2>
      <HelpTip id="sagas" state={state} />
      <div className="tabs" role="tablist">
        {(['all', 'battles', 'scouts', 'system'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? 'active' : ''}
            onClick={() => setTab(k)}
            data-testid={`mail-${k}`}
          >
            {t(`mail_${k}`)}
            {unread(k) > 0 && <span className="badge-dot">{unread(k)}</span>}
          </button>
        ))}
      </div>
      {unread('all') > 0 && (
        <button className="secondary small" onClick={onReadAll} data-testid="read-all">
          ✓ {t('readAll')}
        </button>
      )}
      {shown.length === 0 && <p className="muted">{t('noMail')}</p>}
      <ul className="report-list">
        {shown.map((r) => {
          const tt = reportTitle(r.title, lang);
          return (
            <li key={r.id}>
              <button className={`report-item ${r.read ? '' : 'unread'}`} onClick={() => onOpen(r.id)}>
                <span>{MAIL_ICON[r.kind]}</span>
                <span className={r.kind === 'notice' || r.kind === 'scout' ? '' : r.won ? 'won' : 'lost'}>
                  {tt.head}
                </span>
                <span>{tt.name}</span>
                {r.level > 0 && <small>{t('level', { n: r.level })}</small>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A notice in the mail: what happened and what came with it. */
function NoticeView({ report, onClose }: { report: BattleReport; onClose: () => void }) {
  const lang = useLang();
  const tt = reportTitle(report.title, lang);
  return (
    <section className="card panel report" data-testid="report" role="dialog" aria-label={tt.name}>
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      <p className="banner won">📜 {tt.head}</p>
      <h2>{tt.name}</h2>
      <div className="saga">
        {report.saga.map((line, i) => (
          <p key={i}>{sagaLine(line, lang)}</p>
        ))}
      </div>
      {Object.keys(report.reward).length > 0 && (
        <p className="stat">
          🎁 <CostLine cost={report.reward} />
        </p>
      )}
    </section>
  );
}

/** What scouts saw in a hold: its warriors, wall, stores and heroes (owner request). */
function ScoutView({ report, onClose }: { report: BattleReport; onClose: () => void }) {
  const sc = report.scout!;
  const lang = useLang();
  const tt = reportTitle(report.title, lang);
  return (
    <section className="card panel report" data-testid="report" role="dialog" aria-label={report.title}>
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      <p className="banner won">👁 {t('scoutReport')}</p>
      <h2>{tt.name}</h2>
      <p className="norse">
        {t('jarlLevel', { n: report.level })} · ⚔ {formatAmount(sc.power)}
      </p>
      <div className="saga">
        {report.saga.map((line, i) => (
          <p key={i}>{sagaLine(line, lang)}</p>
        ))}
      </div>
      <h3>{t('garrison')}</h3>
      <p className="stat" data-testid="scout-troops">
        {Object.entries(sc.troops).map(([id, n]) => (
          <span key={id} className="cost">
            <TroopTypeIcon type={TROOPS[id]?.type ?? 'shieldwall'} size={14} /> {formatAmount(n)}{' '}
            {troopName(id)}
          </span>
        ))}
      </p>
      {sc.wall > 0 && <p className="stat">🧱 {t('wallPower', { n: formatAmount(sc.wall) })}</p>}
      <h3>{t('stores')}</h3>
      <p className="stat">
        <CostLine cost={sc.stores} />
      </p>
      <h3>{t('heroes')}</h3>
      <p className="stat">
        {sc.heroes.map((h) => (
          <span key={h.id} className="cost">
            {HEROES.find((x) => x.id === h.id)?.name.split(',')[0]} · Lv {h.level}
          </span>
        ))}
      </p>
    </section>
  );
}
