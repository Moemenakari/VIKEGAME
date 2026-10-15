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
import { bDesc, bName, errorText, t } from './i18n';
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
      <section className="card panel" data-testid="build-menu" role="dialog" aria-label={t('build')}>
        <button className="close" onClick={onClose} aria-label={t('close')}>
          ×
        </button>
        <h2>{t('build')}</h2>
        <p className="norse">{t('chooseBuild')}</p>
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
                  data-hint={`build-${type}`}
                >
                  <span className="title">
                    {bName(type)} <em>{def.norse}</em>
                  </span>
                  <span className="desc">{blocked ? errorText(blocked) : bDesc(type)}</span>
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
            <span className="time">⏱ {formatDuration(upgradeDurationMs(building.type, next))}</span>
          </div>
          {blocked && <p className="blocked">{errorText(blocked)}</p>}
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
    </section>
  );
}
