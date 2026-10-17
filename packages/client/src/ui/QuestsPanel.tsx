import {
  DAILY_CHESTS,
  DAILY_QUESTS,
  MAIN_QUESTS,
  activityPoints,
  currentMainQuest,
  type Cost,
  type GameState,
  type ResourceId,
} from '@jarlheim/sim';
import type { GameStore } from '../game/store';
import { formatAmount, formatDuration } from './format';
import { goalText, questTitle, t } from './i18n';
import { ChestIcon, ResourceIcon } from './icons';
import { HelpTip } from './help';

export function claimableQuests(state: GameState): number {
  const points = activityPoints(state);
  const daily = DAILY_QUESTS.filter(
    (q) => (state.quests.progress[q.id] ?? 0) >= q.target && !state.quests.claimed.includes(q.id),
  ).length;
  const chests = DAILY_CHESTS.filter((c, i) => points >= c.points && !state.quests.chests.includes(i)).length;
  return daily + chests + (currentMainQuest(state)?.done ? 1 : 0);
}

export function Reward({ reward }: { reward: Cost }) {
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

/** The activity track: claimed daily quests fill it and open chests along the way. */
function ChestTrack({
  store,
  state,
  onError,
}: {
  store: GameStore;
  state: GameState;
  onError: (m: string) => void;
}) {
  const points = activityPoints(state);
  const max = DAILY_CHESTS.at(-1)!.points;
  return (
    <div className="chest-track" data-testid="chest-track">
      <div className="chest-points">
        <strong>{points}</strong>
        <small>{t('activity')}</small>
      </div>
      <div className="chest-line">
        <i style={{ width: `${Math.min(100, (100 * points) / max)}%` }} />
        {DAILY_CHESTS.map((c, i) => {
          const claimed = state.quests.chests.includes(i);
          const ready = points >= c.points && !claimed;
          return (
            <button
              key={c.points}
              className={`chest ${ready ? 'ready' : ''}`}
              style={{ insetInlineStart: `${(100 * c.points) / max}%` }}
              aria-label={`${t('chest')} ${c.points}`}
              data-testid={`chest-${i}`}
              onClick={() => {
                if (!ready) return onError(`${c.points} ${t('activity')}`);
                const err = store.dispatch({ type: 'claimQuestChest', index: i });
                if (err) onError(err.message);
              }}
            >
              <ChestIcon size={30} open={claimed} glow={ready} />
              <small>{c.points}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function QuestsPanel({
  store,
  state,
  tab,
  setTab,
  onClose,
  onError,
  onGoDaily,
  onGoMain,
}: {
  store: GameStore;
  state: GameState;
  tab: 'daily' | 'main';
  setTab: (tab: 'daily' | 'main') => void;
  onClose: () => void;
  onError: (message: string) => void;
  onGoDaily: (questId: string) => void;
  onGoMain: () => void;
}) {
  const msToReset = 86_400_000 - (store.now() % 86_400_000);
  const main = currentMainQuest(state);
  const run = (cmd: Parameters<GameStore['dispatch']>[0]) => {
    const err = store.dispatch(cmd);
    if (err) onError(err.message);
  };
  return (
    <section className="card panel quests" data-testid="quests" role="dialog" aria-label={t('quests')}>
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      <HelpTip id="quests" state={state} />
      <div className="tabs" role="tablist">
        {(['daily', 'main'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? 'active' : ''}
            onClick={() => setTab(k)}
            data-testid={`tab-${k}`}
          >
            {t(k)}
          </button>
        ))}
      </div>

      {tab === 'daily' ? (
        <>
          <ChestTrack store={store} state={state} onError={onError} />
          <p className="norse">⏱ {t('newIn', { t: formatDuration(msToReset) })}</p>
          <ul className="quest-list">
            {DAILY_QUESTS.map((q) => {
              const progress = Math.min(q.target, state.quests.progress[q.id] ?? 0);
              const done = progress >= q.target;
              const claimed = state.quests.claimed.includes(q.id);
              return (
                <li key={q.id} className={claimed ? 'claimed' : done ? 'ready' : ''}>
                  <div className="quest-body">
                    <div className="quest-head">
                      <span>{questTitle(q.id)}</span>
                      <Reward reward={q.reward} />
                    </div>
                    <div className="progress">
                      <i style={{ width: `${(100 * progress) / q.target}%` }} />
                    </div>
                    <span className="muted">
                      {formatAmount(progress)} / {formatAmount(q.target)}
                    </span>
                  </div>
                  {claimed ? (
                    <span className="tick">✓</span>
                  ) : done ? (
                    <button
                      className="primary small"
                      data-testid={`claim-${q.id}`}
                      onClick={() => run({ type: 'claimQuest', questId: q.id })}
                    >
                      {t('claim')}
                    </button>
                  ) : (
                    <button
                      className="go"
                      aria-label={t('go')}
                      data-testid={`go-${q.id}`}
                      onClick={() => onGoDaily(q.id)}
                    >
                      ➜
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <ul className="quest-list">
          {main ? (
            <li className={main.done ? 'ready' : ''}>
              <div className="quest-body">
                <div className="quest-head">
                  <span>{goalText(main.quest.goal)}</span>
                  <Reward reward={main.quest.reward} />
                </div>
              </div>
              {main.done ? (
                <button
                  className="primary small"
                  data-testid="claim-main"
                  onClick={() => run({ type: 'claimMainQuest' })}
                >
                  {t('claim')}
                </button>
              ) : (
                <button className="go" aria-label={t('go')} data-testid="go-main" onClick={onGoMain}>
                  ➜
                </button>
              )}
            </li>
          ) : (
            <p className="muted">{t('allDone')}</p>
          )}
          {MAIN_QUESTS.slice(state.mainQuest + 1, state.mainQuest + 4).map((q) => (
            <li key={q.id} className="upcoming">
              <div className="quest-body">
                <div className="quest-head">
                  <span>{goalText(q.goal)}</span>
                  <Reward reward={q.reward} />
                </div>
              </div>
              <span className="tick">🔒</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
