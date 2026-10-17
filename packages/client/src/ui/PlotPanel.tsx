import {
  BUILDINGS,
  BUILDING_TYPES,
  ECONOMY,
  apply,
  goldToFinish,
  productionPerHour,
  remainingMs,
  storageCap,
  upgradeCost,
  upgradeDurationMs,
  suggestSpot,
  protectedAmount,
  wallStrength,
  type BuildingType,
  type Command,
  type GameState,
  type RuleError,
} from '@jarlheim/sim';
import { useContext } from 'react';
import type { GameStore } from '../game/store';
import { NeedContext, NeedLink } from './NeedLink';
import { formatAmount, formatCost, formatDuration } from './format';
import { bDesc, bName, errorText, t } from './i18n';
import { ResourceIcon } from './icons';
import { HealSection, TrainSection } from './military';

interface Props {
  store: GameStore;
  state: GameState;
  /** A building id, or null for the build menu. */
  plotId: string | null;
  onClose: () => void;
  onError: (message: string) => void;
  /** Build menu: the player picked a type to place. */
  onChoose: (type: BuildingType) => void;
  /** Building panel: pick the building up to move it. */
  onMove: (id: string) => void;
}

/** Asks the pure sim whether a command would work right now, without changing anything. */
function check(state: GameState, cmd: Command, now: number): RuleError | null {
  const r = apply(state, cmd, now);
  return r.ok ? null : r.error;
}

function Cost({ cost, state }: { cost: ReturnType<typeof upgradeCost>; state: GameState }) {
  return (
    <span className="cost">
      {formatCost(cost).map(({ res, text }) => (
        <span key={res} className={state.resources[res] < (cost[res] ?? 0) ? 'short' : ''}>
          <ResourceIcon res={res} size={14} />
          {text.split(' ')[0]}
        </span>
      ))}
    </span>
  );
}

export function PlotPanel({ store, state, plotId, onClose, onError, onChoose, onMove }: Props) {
  const now = store.now();
  const goNeed = useContext(NeedContext);
  const building = plotId ? state.buildings[plotId] : undefined;
  const run = (cmd: Command, close = false) => {
    const err = store.dispatch(cmd);
    if (err) onError(err.message);
    else if (close) onClose();
  };

  // ---- the build menu: choose what to raise, then place it -----------------
  if (!building) {
    const options = BUILDING_TYPES.filter((t) => t !== 'greatHall');
    return (
      <section className="card panel" data-testid="build-menu" role="dialog" aria-label={t('build')}>
        <button className="close" onClick={onClose} aria-label={t('close')}>
          ×
        </button>
        <h2>{t('build')}</h2>
        <p className="norse">{t('chooseBuild')}</p>
        <ul className="build-list">
          {options.map((type: BuildingType) => {
            const def = BUILDINGS[type];
            const spot = suggestSpot(state, type);
            const cmd: Command = { type: 'build', building: type, ...(spot ?? { x: 0, z: 0 }) };
            // Where it goes is chosen by hand in the next step, so a crowded hold never blocks
            // the menu; only real rules do (Great Hall level, builders, resources, limits).
            const err = check(state, cmd, now);
            const blocked: RuleError | null = err && err.code !== 'OCCUPIED' ? err : null;
            return (
              <li key={type}>
                <button
                  className={`build-option ${blocked ? 'blocked-option' : ''}`}
                  disabled={blocked !== null && !blocked.need}
                  onClick={() => (blocked?.need ? goNeed(blocked.need) : onChoose(type))}
                  data-testid={`build-${type}`}
                  data-hint={`build-${type}`}
                >
                  <span className="title">
                    {bName(type)} <em>{def.norse}</em>
                  </span>
                  <span className={`desc ${blocked ? 'need' : ''}`}>
                    {blocked ? `${errorText(blocked.message)}${blocked.need ? ' ➜' : ''}` : bDesc(type)}
                  </span>
                  <span className="meta">
                    <Cost cost={upgradeCost(type, 1)} state={state} />
                    <span className="time">⏱ {formatDuration(upgradeDurationMs(type, 1, state))}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  // ---- an existing building -----------------------------------------------
  const def = BUILDINGS[building.type];
  const left = remainingMs(state, building.id, now);
  const job = state.queue.find((j) => j.buildingId === building.id);
  const next = building.level + 1;
  const upgrade: Command = { type: 'upgrade', buildingId: building.id };
  const blocked = left === null ? check(state, upgrade, now) : null;
  const rate = def.produces
    ? productionPerHour({ ...state, buildings: { [building.id]: building } })[def.produces.resource]
    : 0;

  return (
    <section className="card panel" data-testid="info-card" role="dialog" aria-label={bName(building.type)}>
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      <h2>{bName(building.type)}</h2>
      <p className="norse">
        {def.norse} · {building.level > 0 ? t('level', { n: building.level }) : t('beingRaised')}
      </p>
      <p>{bDesc(building.type)}</p>
      {def.produces && building.level > 0 && (
        <p className="stat">
          <ResourceIcon res={def.produces.resource} size={14} /> {t('perHour', { n: formatAmount(rate) })}
        </p>
      )}
      {def.trains && building.level > 0 && (
        <TrainSection key={building.id} state={state} building={building} now={now} run={run} />
      )}
      {def.woundedCapacity && building.level > 0 && <HealSection state={state} now={now} run={run} />}
      {def.storage && <p className="stat">{t('storageEach', { n: formatAmount(storageCap(state).food) })}</p>}
      {def.protect && building.level > 0 && (
        <p className="stat">🔒 {t('hidden', { n: formatAmount(protectedAmount(state)) })}</p>
      )}
      {def.wall && building.level > 0 && (
        <RaidSection state={state} now={now} onCall={() => run({ type: 'callRaid' })} />
      )}

      {job && left !== null ? (
        <div className="progress-block">
          <div className="progress">
            <i style={{ width: `${100 * (1 - left / Math.max(1, job.endsAt - job.startedAt))}%` }} />
          </div>
          <p className="stat">{t('levelIn', { n: job.targetLevel, t: formatDuration(left) })}</p>
          {left <= ECONOMY.freeFinishMs ? (
            <button
              className="primary"
              onClick={() => run({ type: 'finishFree', buildingId: building.id }, true)}
              data-testid="finish-free"
              data-hint="finish"
            >
              {t('finishFree')}
            </button>
          ) : (
            <button
              className="secondary"
              onClick={() => run({ type: 'finishWithGold', buildingId: building.id }, true)}
              data-testid="finish-gold"
              data-hint="finish"
            >
              {t('finishGold', { n: goldToFinish(left) })}
            </button>
          )}
        </div>
      ) : building.level >= ECONOMY.maxBuildingLevel ? (
        <p className="soon">{t('maxLevel')}</p>
      ) : (
        <div className="upgrade-block">
          <div className="meta">
            <Cost cost={upgradeCost(building.type, next)} state={state} />
            <span className="time">⏱ {formatDuration(upgradeDurationMs(building.type, next, state))}</span>
          </div>
          {blocked && <NeedLink error={blocked} />}
          <button
            className="primary"
            disabled={blocked !== null}
            onClick={() => run(upgrade, true)}
            data-testid="upgrade"
            data-hint="upgrade"
          >
            {t('upgradeTo', { n: next })}
          </button>
        </div>
      )}
      {building.id !== 'hall' && (
        <button className="secondary" onClick={() => onMove(building.id)} data-testid="move">
          ✥ {t('move')}
        </button>
      )}
    </section>
  );
}

/** The watch on the wall: when the next raiders come, and a beacon to call them now (practice). */
export function RaidSection({ state, now, onCall }: { state: GameState; now: number; onCall: () => void }) {
  const incoming = state.raid.incoming;
  return (
    <div className="section">
      <h3>⚔ {t('raids')}</h3>
      <p className="stat">🛡 {t('wallPower', { n: formatAmount(wallStrength(state)) })}</p>
      {incoming ? (
        <p className="stat warn-text">
          ⚠ {t('raidIn', { t: formatDuration(Math.max(0, incoming.landsAt - now)) })}
        </p>
      ) : state.raid.nextAt ? (
        <p className="stat">⏱ {t('nextRaid', { t: formatDuration(Math.max(0, state.raid.nextAt - now)) })}</p>
      ) : (
        <p className="muted">{t('raidsLater')}</p>
      )}
      <button className="secondary" disabled={!!incoming} onClick={onCall} data-testid="call-raid">
        🔥 {t('callRaid')}
      </button>
    </div>
  );
}
