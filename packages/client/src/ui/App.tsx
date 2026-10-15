import { useEffect, useRef, useState } from 'react';
import { Engine } from '../scene/Engine';
import type { PickId } from '../scene/hold/HoldScene';
import { loadQuality, saveQualityAndReload, type QualityTier } from '../scene/quality';
import { FoodIcon, GoldIcon, IronIcon, PowerIcon, SilverIcon, TimberIcon } from './icons';

/** What the info card says when you tap something. Text is ours; history in docs/HISTORY_BIBLE.md. */
const INFO: Record<PickId, { title: string; norse: string; body: string; soon: string }> = {
  'great-hall': {
    title: 'Great Hall',
    norse: 'Skáli · Level 1',
    body: 'The heart of your hold. The High Seat inside sets how far every other building can grow.',
    soon: 'Upgrades arrive in M2',
  },
  longship: {
    title: 'Snekkja',
    norse: 'Longship · at anchor',
    body: 'A fast clinker-built warship, after the Oseberg and Gokstad finds. Sea routes are quicker than land.',
    soon: 'Silver Road voyages arrive in M6',
  },
};

/** Preview numbers until the economy lands in M2. */
const PREVIEW_RESOURCES = [
  { key: 'food', icon: <FoodIcon />, value: '5.0K' },
  { key: 'timber', icon: <TimberIcon />, value: '5.0K' },
  { key: 'iron', icon: <IronIcon />, value: '—' },
  { key: 'silver', icon: <SilverIcon />, value: '200' },
];

declare global {
  interface Window {
    __jarlheim?: {
      ready: boolean;
      frames: () => number;
      screenPositionOf: (id: PickId) => { x: number; y: number };
    };
  }
}

export function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [quality] = useState(loadQuality);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<PickId | null>(null);
  const [fps, setFps] = useState(0);
  const [showHelp, setShowHelp] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let engine: Engine;
    try {
      engine = new Engine(stage, quality, {
        onSelect: (id) => {
          setSelected(id);
          setShowHelp(false);
        },
        onFirstFrame: () => setReady(true),
        onFps: setFps,
      });
    } catch (err) {
      console.error(err);
      setToast('Your browser could not start 3D graphics (WebGL).');
      return;
    }
    engine.start();
    window.__jarlheim = {
      get ready() {
        return engine.frameCount > 0;
      },
      frames: () => engine.frameCount,
      screenPositionOf: (id) => engine.screenPositionOf(id),
    };
    const hideHelp = setTimeout(() => setShowHelp(false), 7000);
    return () => {
      clearTimeout(hideHelp);
      engine.dispose();
      delete window.__jarlheim;
    };
  }, [quality]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const info = selected ? INFO[selected] : null;
  const soon = (what: string) => () => setToast(`${what} arrive in a later milestone`);

  return (
    <div className="app">
      <div className="stage" ref={stageRef} data-testid="stage" />

      <header className="topbar">
        <div className="avatar" aria-label="Your jarl">
          ᛃ
        </div>
        <div className="power" title="Power">
          <PowerIcon size={16} />
          <span>1,250</span>
        </div>
        <div className="gold" title="Gold (earned by playing)">
          <GoldIcon size={16} />
          <span>100</span>
        </div>
      </header>
      <div className="resources" data-testid="resources">
        {PREVIEW_RESOURCES.map((r) => (
          <div className="pill" key={r.key} title={r.key}>
            {r.icon}
            <span>{r.value}</span>
          </div>
        ))}
      </div>

      {info && (
        <section className="card" data-testid="info-card" role="dialog" aria-label={info.title}>
          <button className="close" onClick={() => setSelected(null)} aria-label="Close">
            ×
          </button>
          <h2>{info.title}</h2>
          <p className="norse">{info.norse}</p>
          <p>{info.body}</p>
          <p className="soon">{info.soon}</p>
        </section>
      )}

      {showHelp && ready && (
        <div className="help">Drag to move · Pinch to zoom · Twist to turn · Tap a building</div>
      )}
      {toast && <div className="toast">{toast}</div>}

      <nav className="bottombar">
        <button onClick={soon('Heroes')}>Heroes</button>
        <button onClick={soon('Items')}>Bag</button>
        <button onClick={soon('The world map and voyages')}>Midgard</button>
        <button className="icon" onClick={() => setSettingsOpen((v) => !v)} aria-label="Settings">
          ⚙
        </button>
      </nav>

      {settingsOpen && (
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
          <p className="muted">{Math.round(fps)} fps · M1 tech preview</p>
        </section>
      )}

      <div className={`splash ${ready ? 'hidden' : ''}`} aria-hidden={ready}>
        <div className="logo">JARLHEIM</div>
        <div className="runes">ᛁᛅᚱᛚᚼᛅᛁᛘ</div>
      </div>
      <div className="badge">M1 · preview</div>
    </div>
  );
}
