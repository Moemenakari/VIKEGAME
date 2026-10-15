import {
  BUILDINGS,
  DAILY_QUESTS,
  PRODUCED_RESOURCES,
  RESOURCE_NAMES,
  builderSlots,
  storageCap,
  totalPower,
  type GameEvent,
  type GameState,
} from '@jarlheim/sim';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { GameStore } from '../game/store';
import { Engine } from '../scene/Engine';
import { loadQuality, saveQualityAndReload, type QualityTier } from '../scene/quality';
import { formatAmount } from './format';
import { GoldIcon, PowerIcon, ResourceIcon } from './icons';
import { PlotPanel } from './PlotPanel';
import { QuestsPanel, claimableQuests } from './QuestsPanel';

declare global {
  interface Window {
    __jarlheim?: {
      ready: boolean;
      frames: () => number;
      screenPositionOf: (id: string) => { x: number; y: number };
      state: () => GameState;
    };
  }
}

const realClock = { now: () => Date.now() };

/** Turns simulation events into short messages for the player. */
function describe(e: GameEvent): string | null {
  switch (e.type) {
    case 'building.completed':
      return e.level === 1
        ? `${BUILDINGS[e.building].name} is ready`
        : `${BUILDINGS[e.building].name} reached level ${e.level}`;
    case 'quest.completed': {
      const q = DAILY_QUESTS.find((d) => d.id === e.questId);
      return q ? `Quest done: ${q.title}. Claim your reward!` : null;
    }
    case 'quests.reset':
      return 'New daily quests are here';
    default:
      return null;
  }
}

function offlineSummary(events: GameEvent[]): string | null {
  const produced = events.find((e) => e.type === 'resources.produced');
  if (!produced || produced.type !== 'resources.produced') return null;
  const parts = PRODUCED_RESOURCES.filter((r) => (produced.amounts[r] ?? 0) >= 1).map(
    (r) => `+${formatAmount(produced.amounts[r] ?? 0)} ${RESOURCE_NAMES[r]}`,
  );
  return parts.length ? `While you were away: ${parts.join(', ')}` : null;
}

export function App() {
  const [store, setStore] = useState<GameStore | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let loaded: GameStore | null = null;
    GameStore.load(realClock).then(({ store, offline }) => {
      if (!alive) return;
      loaded = store;
      store.start();
      setStore(store);
      const summary = offlineSummary(offline);
      if (summary) setToast(summary);
    });
    return () => {
      alive = false;
      loaded?.stop();
    };
  }, []);

  return store ? <Game store={store} toast={toast} setToast={setToast} /> : <Splash visible />;
}

function Splash({ visible }: { visible: boolean }) {
  return (
    <div className={`splash ${visible ? '' : 'hidden'}`} aria-hidden={!visible}>
      <div className="logo">JARLHEIM</div>
      <div className="runes">ᛁᛅᚱᛚᚼᛅᛁᛘ</div>
    </div>
  );
}

function Game({
  store,
  toast,
  setToast,
}: {
  store: GameStore;
  toast: string | null;
  setToast: (t: string | null) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [quality] = useState(loadQuality);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<'quests' | 'settings' | null>(null);
  const [fps, setFps] = useState(0);
  const [showHelp, setShowHelp] = useState(true);

  const select = useCallback((id: string | null) => {
    setSelected(id);
    setPanel(null);
    engineRef.current?.setSelected(id);
    setShowHelp(false);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let engine: Engine;
    try {
      engine = new Engine(stage, quality, {
        onSelect: select,
        onFirstFrame: () => setReady(true),
        onFps: setFps,
      });
    } catch (err) {
      console.error(err);
      setToast('Your browser could not start 3D graphics (WebGL).');
      return;
    }
    engineRef.current = engine;
    engine.sync(store.snapshot, store.now());
    engine.start();
    const unsubscribe = store.subscribe(() => engine.sync(store.snapshot, store.now()));
    window.__jarlheim = {
      get ready() {
        return engine.frameCount > 0;
      },
      frames: () => engine.frameCount,
      screenPositionOf: (id) => engine.screenPositionOf(id),
      state: () => store.snapshot,
    };
    const hideHelp = setTimeout(() => setShowHelp(false), 8000);
    return () => {
      clearTimeout(hideHelp);
      unsubscribe();
      engine.dispose();
      engineRef.current = null;
      delete window.__jarlheim;
    };
  }, [quality, select, setToast, store]);

  // Event messages (one combined toast per step, not one per event).
  useEffect(
    () =>
      store.onEvents((events) => {
        const lines = events.map(describe).filter((x): x is string => x !== null);
        if (lines.length) setToast(lines.join(' · '));
      }),
    [setToast, store],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast, setToast]);

  const caps = storageCap(state);
  const busy = state.queue.length;
  const slots = builderSlots(state);
  const claimable = claimableQuests(state);
  const onError = (message: string) => setToast(message);

  return (
    <div className="app">
      <div className="stage" ref={stageRef} data-testid="stage" />

      <header className="topbar">
        <div className="avatar" aria-label="Your jarl">
          ᛃ
        </div>
        <div className="power" title="Power">
          <PowerIcon size={16} />
          <span data-testid="power">{totalPower(state).toLocaleString('en-US')}</span>
        </div>
        <div className="gold" title="Gold (earned by playing)">
          <GoldIcon size={16} />
          <span data-testid="gold">{formatAmount(state.resources.gold)}</span>
        </div>
      </header>
      <div className="resources" data-testid="resources">
        {PRODUCED_RESOURCES.map((r) => {
          const full = state.resources[r] >= caps[r];
          return (
            <div
              className={`pill ${full ? 'full' : ''}`}
              key={r}
              title={`${RESOURCE_NAMES[r]}: ${Math.floor(state.resources[r])} / ${caps[r]}`}
            >
              <ResourceIcon res={r} />
              <span data-testid={`res-${r}`}>{formatAmount(state.resources[r])}</span>
            </div>
          );
        })}
      </div>

      <aside className="sidebar">
        <div
          className={`side-chip ${busy < slots ? 'idle' : ''}`}
          title="Builders at work"
          data-testid="builders"
        >
          <span className="glyph">⚒</span>
          {busy}/{slots}
        </div>
        <button
          className="side-chip"
          onClick={() => {
            setSelected(null);
            engineRef.current?.setSelected(null);
            setPanel(panel === 'quests' ? null : 'quests');
          }}
          data-testid="quests-button"
        >
          <span className="glyph">ᛟ</span>Quests
          {claimable > 0 && <span className="badge-dot">{claimable}</span>}
        </button>
      </aside>

      {selected && selected !== 'longship' && (
        <PlotPanel
          store={store}
          state={state}
          plotId={selected}
          onClose={() => select(null)}
          onError={onError}
        />
      )}
      {selected === 'longship' && (
        <section className="card panel" data-testid="info-card" role="dialog" aria-label="Snekkja">
          <button className="close" onClick={() => select(null)} aria-label="Close">
            ×
          </button>
          <h2>Snekkja</h2>
          <p className="norse">Longship · at anchor</p>
          <p>
            A fast clinker-built warship, after the Oseberg and Gokstad finds. Sea routes are quicker than
            land.
          </p>
          <p className="soon">Silver Road voyages arrive in M6</p>
        </section>
      )}
      {panel === 'quests' && (
        <QuestsPanel store={store} state={state} onClose={() => setPanel(null)} onError={onError} />
      )}

      {showHelp && ready && !selected && !panel && (
        <div className="help">Drag to move · Pinch to zoom · Tap a plot to build</div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <nav className="bottombar">
        <button onClick={() => setToast('Heroes arrive in M4')}>Heroes</button>
        <button onClick={() => setToast('Items arrive in a later milestone')}>Bag</button>
        <button onClick={() => setToast('The world map arrives in M6')}>Midgard</button>
        <button
          className="icon"
          onClick={() => setPanel(panel === 'settings' ? null : 'settings')}
          aria-label="Settings"
        >
          ⚙
        </button>
      </nav>

      {panel === 'settings' && (
        <section className="settings" data-testid="settings">
          <h3>Graphics</h3>
          <div className="segmented">
            {(['low', 'medium', 'high'] as QualityTier[]).map((tier) => (
              <button
                key={tier}
                className={tier === quality.tier ? 'active' : ''}
                onClick={() => tier !== quality.tier && saveQualityAndReload(tier)}
              >
                {tier}
              </button>
            ))}
          </div>
          <h3 className="spaced">Your hold</h3>
          <button
            className="danger"
            onClick={() => {
              if (confirm('Start a new hold? Your current progress will be lost.')) {
                void store.reset();
                select(null);
              }
            }}
          >
            Start a new hold
          </button>
          <p className="muted">{Math.round(fps)} fps · M2 preview · saved on this device</p>
        </section>
      )}

      <Splash visible={!ready} />
      <div className="badge">M2 · preview</div>
    </div>
  );
}
