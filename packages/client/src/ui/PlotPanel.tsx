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
  type BuildingType,
  type Command,
  type GameState,
} from '@jarlheim/sim';
import type { GameStore } from '../game/store';
import { formatAmount, formatCost, formatDuration } from './format';
import { ResourceIcon } from './icons';
import { HealSection, TrainSection } from './military';

interface Props {
  store: GameStore;
  state: GameState;
  plotId: string;
  onClose: () => void;
  onError: (message: string) => void;
}

/** Asks the pure sim whether a command would work right now, without changing anything. */
function check(state: GameState, cmd: Command, now: number): string | null {
  const r = apply(state, cmd, now);
  return r.ok ? null : r.error.message;
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

export function PlotPanel({ store, state, plotId, onClose, onError }: Props) {
  const now = store.now();
  const building = state.buildings[plotId];
  const run = (cmd: Command, close = false) => {
    const err = store.dispatch(cmd);
    if (err) onError(err.message);
    else if (close) onClose();
  };

  // ---- an open plot: choose what to build -----------------------------------
  if (!building) {
    const options = BUILDING_TYPES.filter((t) => t !== 'greatHall');
    return (
      <section className="card panel" data-testid="build-menu" role="dialog" aria-label="Build">
        <button className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>Build</h2>
        <p className="norse">Choose what to raise on this plot</p>
        <ul className="build-list">
          {options.map((type: BuildingType) => {
            const def = BUILDINGS[type];
            const cmd: Command = { type: 'build', plotId, building: type };
            const blocked = check(state, cmd, now);
            return (
              <li key={type}>
                <button
                  className="build-option"
                  disabled={blocked !== null}
                  onClick={() => run(cmd, true)}
                  data-testid={`build-${type}`}
                >
                  <span className="title">
                    {def.name} <em>{def.norse}</em>
                  </span>
                  <span className="desc">{blocked ?? def.description}</span>
                  <span className="meta">
                    <Cost cost={upgradeCost(type, 1)} state={state} />
                    <span className="time">⏱ {formatDuration(upgradeDurationMs(type, 1))}</span>
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
    <section className="card panel" data-testid="info-card" role="dialog" aria-label={def.name}>
      <button className="close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <h2>{def.name}</h2>
      <p className="norse">
        {def.norse} · {building.level > 0 ? `Level ${building.level}` : 'Being raised'}
      </p>
      <p>{def.description}</p>
      {def.produces && building.level > 0 && (
        <p className="stat">
          <ResourceIcon res={def.produces.resource} size={14} /> +{formatAmount(rate)} per hour
        </p>
      )}
      {def.trains && building.level > 0 && (
        <TrainSection key={building.id} state={state} building={building} now={now} run={run} />
      )}
      {def.woundedCapacity && building.level > 0 && <HealSection state={state} now={now} run={run} />}
      {def.storage && (
        <p className="stat">Storage for each resource: {formatAmount(storageCap(state).food)}</p>
      )}

      {job && left !== null ? (
        <div className="progress-block">
          <div className="progress">
            <i style={{ width: `${100 * (1 - left / Math.max(1, job.endsAt - job.startedAt))}%` }} />
          </div>
          <p className="stat">
            Level {job.targetLevel} in {formatDuration(left)}
          </p>
          {left <= ECONOMY.freeFinishMs ? (
            <button
              className="primary"
              onClick={() => run({ type: 'finishFree', buildingId: building.id }, true)}
              data-testid="finish-free"
            >
              Finish now · Free
            </button>
          ) : (
            <button
              className="secondary"
              onClick={() => run({ type: 'finishWithGold', buildingId: building.id }, true)}
              data-testid="finish-gold"
            >
              Finish now · {goldToFinish(left)} Gold
            </button>
          )}
        </div>
      ) : building.level >= ECONOMY.maxBuildingLevel ? (
        <p className="soon">Highest level reached</p>
      ) : (
        <div className="upgrade-block">
          <div className="meta">
            <Cost cost={upgradeCost(building.type, next)} state={state} />
            <span className="time">⏱ {formatDuration(upgradeDurationMs(building.type, next))}</span>
          </div>
          {blocked && <p className="blocked">{blocked}</p>}
          <button
            className="primary"
            disabled={blocked !== null}
            onClick={() => run(upgrade, true)}
            data-testid="upgrade"
          >
            Upgrade to level {next}
          </button>
        </div>
      )}
    </section>
  );
}
