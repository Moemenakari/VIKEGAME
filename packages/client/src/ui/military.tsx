import {
  BUILDINGS,
  DRAUGR_BANDS,
  DRAUGR_UNITS,
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
  type TroopType,
} from '@jarlheim/sim';
import { useState } from 'react';
import type { GameStore } from '../game/store';
import { formatAmount, formatDuration } from './format';
import { ResourceIcon, TroopTypeIcon } from './icons';

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
    >
      Finish now · Free
    </button>
  ) : (
    <button className="secondary" onClick={() => run({ type: 'finishWithGold', buildingId, queue })}>
      Finish now · {goldToFinish(left)} Gold
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
        <h3>Training</h3>
        <div className="progress">
          <i style={{ width: `${100 * (1 - left / Math.max(1, job.endsAt - job.startedAt))}%` }} />
        </div>
        <p className="stat">
          {job.count} × {TROOPS[job.troopId]!.name} in {formatDuration(left)}
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
      <h3>Train</h3>
      <div className="tiers">
        {tiers.map((t) => (
          <button
            key={t.id}
            className={`tier ${t.id === troopId ? 'active' : ''}`}
            disabled={building.level < t.unlockLevel}
            onClick={() => setTroopId(t.id)}
          >
            <TroopTypeIcon type={t.type} size={16} /> {t.name}
            <small>{building.level < t.unlockLevel ? `Level ${t.unlockLevel}` : `T${t.tier}`}</small>
          </button>
        ))}
      </div>
      <p className="muted stats-line">
        Attack {troop.atk} · Defence {troop.def} · Health {troop.hp}
      </p>
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
      {!check.ok && <p className="blocked">{check.error.message}</p>}
      <button className="primary" disabled={!check.ok} onClick={() => run(cmd)} data-testid="train">
        Train {n} {troop.name}
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
        <h3>Healing</h3>
        <div className="progress">
          <i
            style={{
              width: `${100 * (1 - left / Math.max(1, state.healing.endsAt - state.healing.startedAt))}%`,
            }}
          />
        </div>
        <p className="stat">
          {sumCounts(state.healing.troops)} warriors back on their feet in {formatDuration(left)}
        </p>
        <TimerActions run={run} buildingId="healing" left={left} queue="heal" />
      </div>
    );
  }
  return (
    <div className="section">
      <h3>Wounded</h3>
      <p className="stat">
        {wounded} wounded · room for {cap}
      </p>
      {wounded > 0 && (
        <>
          <div className="meta">
            <CostLine cost={healCost(state.army.wounded)} state={state} />
            <span className="time">⏱ {formatDuration(healDurationMs(state.army.wounded))}</span>
          </div>
          <button className="primary" onClick={() => run({ type: 'heal' })} data-testid="heal">
            Heal all
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
            <span>{t.name}</span>
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
    <section className="card panel" data-testid="army" role="dialog" aria-label="Army">
      <button className="close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <h2>Your Warband</h2>
      <p className="norse">Lið · {sumCounts(state.army.troops)} warriors at home</p>
      <TroopList counts={state.army.troops} empty="No warriors yet. Build a Shield Yard and train some." />
      <HealSection state={state} now={now} run={run} />
      <button className="primary" onClick={onBarrow} data-testid="to-barrow">
        March on the Draugr Barrow
      </button>
    </section>
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
  const verdict =
    ratio >= 1.6 ? 'Favourable' : ratio >= 1.1 ? 'Even' : ratio > 0 ? 'Risky' : 'No warriors chosen';

  const attack = () => {
    const before = state.nextReportId;
    const err = store.dispatch({ type: 'attackDraugr', level, troops: send });
    if (err) onError(err.message);
    else onReport(before);
  };

  return (
    <section className="card panel" data-testid="barrow" role="dialog" aria-label="Draugr Barrow">
      <button className="close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <h2>The Draugr Barrow</h2>
      <p className="norse">Haugr · the dead walk at night</p>
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
      <h3>
        Level {band.level} · {band.name}
      </h3>
      <ul className="troop-list">
        {Object.entries(band.units).map(([id, n]) => {
          const u = DRAUGR_UNITS[id]!;
          return (
            <li key={id}>
              <TroopTypeIcon type={u.type} size={18} />
              <span>{u.name}</span>
              <small>{u.type}</small>
              <strong>{n}</strong>
            </li>
          );
        })}
      </ul>
      <p className="muted">
        Reward: <CostLine cost={band.reward} />
        {band.level > state.pve.draugrCleared && ' + first-clear Gold'}
      </p>
      <h3>Send</h3>
      <div className="send-list">
        {Object.entries(state.army.troops).map(([id, n]) => (
          <label key={id} className="send-item">
            <input
              type="checkbox"
              checked={!left[id]}
              onChange={() => setLeft({ ...left, [id]: !left[id] })}
            />
            <TroopTypeIcon type={TROOPS[id]!.type} size={16} /> {n} {TROOPS[id]!.name}
          </label>
        ))}
        {sumCounts(state.army.troops) === 0 && <p className="muted">No warriors at home.</p>}
      </div>
      <p className={`verdict ${verdict.toLowerCase().replace(/\s+/g, '-')}`}>
        Odds: <strong>{verdict}</strong> · {formatAmount(ours)} vs {formatAmount(theirs)}
      </p>
      <p className="muted">Counters win battles: Shieldwall › Berserkers › Archers › Shieldwall.</p>
      <button className="primary" disabled={sumCounts(send) === 0} onClick={attack} data-testid="attack">
        Attack
      </button>
    </section>
  );
}

// ---- battle reports --------------------------------------------------------------

const TYPE_ORDER: TroopType[] = ['shieldwall', 'berserker', 'archer'];

export function ReportView({ report, onClose }: { report: BattleReport; onClose: () => void }) {
  return (
    <section className="card panel report" data-testid="report" role="dialog" aria-label={report.title}>
      <button className="close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <p className={`banner ${report.won ? 'won' : 'lost'}`}>{report.won ? 'Victory' : 'Defeat'}</p>
      <h2>{report.title.split(' · ')[1]}</h2>
      <p className="norse">
        Barrow level {report.level} · {report.rounds} rounds
      </p>
      <div className="saga">
        {report.saga.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      <table className="losses">
        <thead>
          <tr>
            <th>Your warriors</th>
            <th>Sent</th>
            <th>Fell</th>
            <th>Wounded</th>
          </tr>
        </thead>
        <tbody>
          {[...report.attacker]
            .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))
            .map((l) => (
              <tr key={l.unit}>
                <td>
                  <TroopTypeIcon type={l.type} size={14} /> {l.name}
                </td>
                <td>{l.start}</td>
                <td>{l.dead}</td>
                <td>{l.wounded}</td>
              </tr>
            ))}
        </tbody>
        <thead>
          <tr>
            <th>The dead</th>
            <th>Rose</th>
            <th>Fell</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {report.defender.map((l) => (
            <tr key={l.unit}>
              <td>
                <TroopTypeIcon type={l.type} size={14} /> {l.name}
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

export function ReportsPanel({
  state,
  onOpen,
  onClose,
}: {
  state: GameState;
  onOpen: (id: number) => void;
  onClose: () => void;
}) {
  return (
    <section className="card panel" data-testid="reports" role="dialog" aria-label="Sagas">
      <button className="close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <h2>Sagas</h2>
      <p className="norse">Your battle reports</p>
      {state.reports.length === 0 && <p className="muted">No battles yet. The barrow waits.</p>}
      <ul className="report-list">
        {state.reports.map((r) => (
          <li key={r.id}>
            <button className={`report-item ${r.read ? '' : 'unread'}`} onClick={() => onOpen(r.id)}>
              <span className={r.won ? 'won' : 'lost'}>{r.won ? 'Victory' : 'Defeat'}</span>
              <span>{r.title.split(' · ')[1]}</span>
              <small>Level {r.level}</small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
