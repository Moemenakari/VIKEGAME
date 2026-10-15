import { DAILY_QUESTS, type Cost, type GameState, type ResourceId } from '@jarlheim/sim';
import type { GameStore } from '../game/store';
import { formatAmount, formatDuration } from './format';
import { ResourceIcon } from './icons';

export function claimableQuests(state: GameState): number {
  return DAILY_QUESTS.filter(
    (q) => (state.quests.progress[q.id] ?? 0) >= q.target && !state.quests.claimed.includes(q.id),
  ).length;
}

function Reward({ reward }: { reward: Cost }) {
  return (
    <span className="cost">
      {(Object.entries(reward) as Array<[ResourceId, number]>).map(([res, n]) => (
        <span key={res}>
          <ResourceIcon res={res} size={14} />
          {formatAmount(n)}
        </span>
      ))}
    </span>
  );
}

export function QuestsPanel({
  store,
  state,
  onClose,
  onError,
}: {
  store: GameStore;
  state: GameState;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const msToReset = 86_400_000 - (store.now() % 86_400_000);
  return (
    <section className="card panel" data-testid="quests" role="dialog" aria-label="Daily quests">
      <button className="close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <h2>Daily Quests</h2>
      <p className="norse">New quests in {formatDuration(msToReset)}</p>
      <ul className="quest-list">
        {DAILY_QUESTS.map((q) => {
          const progress = Math.min(q.target, state.quests.progress[q.id] ?? 0);
          const done = progress >= q.target;
          const claimed = state.quests.claimed.includes(q.id);
          return (
            <li key={q.id} className={claimed ? 'claimed' : ''}>
              <div className="quest-head">
                <span>{q.title}</span>
                <Reward reward={q.reward} />
              </div>
              <div className="progress">
                <i style={{ width: `${(100 * progress) / q.target}%` }} />
              </div>
              <div className="quest-foot">
                <span className="muted">
                  {formatAmount(progress)} / {formatAmount(q.target)}
                </span>
                {claimed ? (
                  <span className="muted">Claimed ✓</span>
                ) : (
                  <button
                    className="primary small"
                    disabled={!done}
                    data-testid={`claim-${q.id}`}
                    onClick={() => {
                      const err = store.dispatch({ type: 'claimQuest', questId: q.id });
                      if (err) onError(err.message);
                    }}
                  >
                    Claim
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
