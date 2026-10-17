import {
  PRODUCED_RESOURCES,
  builderSlots,
  currentMainQuest,
  remainingMs,
  storageCap,
  sumCounts,
  totalPower,
  type GameEvent,
  ALLIANCES,
  HEROES,
  placementError,
  suggestSpot,
  type BuildingType,
  type GameState,
  BATTLE_DROPS,
  vsStandings,
  type Cost,
  type ShopId,
} from '@jarlheim/sim';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { GameStore } from '../game/store';
import { Engine } from '../scene/Engine';
import { loadQuality } from '../scene/quality';
import { formatAmount, formatDuration } from './format';
import { routeForDaily, routeForGoal, routeForNeed, type Route } from './guide';
import { NeedContext } from './NeedLink';
import { bName, errorText, goalText, questTitle, resName, t, troopName, useLang } from './i18n';
import {
  ArmyIcon,
  AvatarFace,
  BagIcon,
  BuilderIcon,
  GearIcon,
  GlobeIcon,
  GoldIcon,
  HeroIcon,
  HeroPortrait,
  PowerIcon,
  QuestIcon,
  ResourceIcon,
  SagaIcon,
} from './icons';
import { PlotPanel } from './PlotPanel';
import { WorldMap } from './WorldMap';
import { ShopPanel } from './ShopPanel';
import { RewardBurst, type Burst } from './RewardBurst';
import { botMessages } from './botChat';
import { ChatPanel } from './ChatPanel';
import { HeroesPanel } from './HeroesPanel';
import { useOnline } from './useOnline';
import { ProfilePage } from './ProfilePage';
import { getPrefs, usePrefs } from './prefs';
import { QuestsPanel, Reward, claimableQuests } from './QuestsPanel';
import { ArmyPanel, BarrowPanel, ReportView, ReportsPanel } from './military';
import { failTip } from './help';

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

type Panel =
  | 'quests'
  | 'settings'
  | 'army'
  | 'barrow'
  | 'reports'
  | 'builders'
  | 'profile'
  | 'build'
  | 'world'
  | 'chat'
  | 'heroes'
  | 'bag'
  | 'shop'
  | null;

/** A building being placed (new) or moved (moveId), at a spot measured from the hall. */
interface Placing {
  type: BuildingType;
  level: number;
  moveId?: string;
  x: number;
  z: number;
  rot: number;
}

/** Turns simulation events into short messages for the player. */
function describe(e: GameEvent): string | null {
  switch (e.type) {
    case 'building.completed':
      return e.level === 1
        ? t('readyB', { b: bName(e.building) })
        : t('reachedB', { b: bName(e.building), n: e.level });
    case 'quest.completed':
      return t('questDone', { q: questTitle(e.questId) });
    case 'quests.reset':
      return t('newQuests');
    case 'training.completed':
      return t('trainedT', { n: e.count, t: troopName(e.troopId) });
    case 'healing.completed':
      return t('healedN', { n: e.count });
    case 'raid.spotted':
      return t('raidWarn', { t: formatDuration(Math.max(0, e.landsAt - Date.now())) });
    case 'raid.resolved':
      return e.won ? t('raidBeaten') : t('raidLost');
    default:
      return null;
  }
}

/** What a step won, for the "You won!" burst: spoils home, a victory, a chest, a quest or VS reward. */
function rewardOf(events: GameEvent[], state: GameState): Burst | null {
  const reward: Cost = {};
  const items: Record<string, number> = {};
  let title: string | null = null;
  const add = (r: Cost, i: Record<string, number> = {}, name: string) => {
    for (const [k, v] of Object.entries(r))
      reward[k as keyof Cost] = (reward[k as keyof Cost] ?? 0) + (v ?? 0);
    for (const [k, v] of Object.entries(i)) items[k] = (items[k] ?? 0) + v;
    title ??= name;
  };
  for (const e of events) {
    if (e.type === 'march.returned' && (Object.keys(e.load).length || Object.keys(e.items).length))
      add(e.load, e.items, t('spoilsHome'));
    else if (e.type === 'battle.resolved' && e.won && e.kind !== 'hunt' && e.kind !== 'jarl') {
      const r = state.reports.find((x) => x.id === e.reportId);
      if (r) add(r.reward, r.kind === 'conquest' ? BATTLE_DROPS.landTaken : BATTLE_DROPS.barrow, t('youWon'));
    } else if (e.type === 'pvp.fought' && e.won) add(e.loot, BATTLE_DROPS.pvpWon, t('youWon'));
    else if (e.type === 'chest.opened') add(e.reward, {}, t('chestOpened'));
    else if (e.type === 'quest.claimed') add(e.reward, {}, t('questReward'));
    else if (e.type === 'vs.claimed') add(e.reward, e.items, t('vsClaim'));
  }
  return title && (Object.keys(reward).length || Object.keys(items).length) ? { title, reward, items } : null;
}

function offlineSummary(events: GameEvent[]): string | null {
  const produced = events.find((e) => e.type === 'resources.produced');
  if (!produced || produced.type !== 'resources.produced') return null;
  const parts = PRODUCED_RESOURCES.filter((r) => (produced.amounts[r] ?? 0) >= 1).map(
    (r) => `+${formatAmount(produced.amounts[r] ?? 0)} ${resName(r)}`,
  );
  return parts.length ? t('away', { list: parts.join(', ') }) : null;
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
  const lang = useLang();
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [quality] = useState(loadQuality);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [questTab, setQuestTab] = useState<'daily' | 'main'>('daily');
  const [reportId, setReportId] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const prefs = usePrefs();
  const [placing, setPlacing] = useState<Placing | null>(null);
  const [burst, setBurst] = useState<Burst | null>(null);
  const [shopTab, setShopTab] = useState<ShopId>('gold');
  const endBurst = useCallback(() => setBurst(null), []);

  const select = useCallback((id: string | null) => {
    setReportId(null);
    setHint(null);
    if (id === 'barrow') {
      setSelected(null);
      setPanel('barrow');
      engineRef.current?.setSelected(null);
      return;
    }
    setSelected(id);
    setPanel(null);
    engineRef.current?.setSelected(id);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let engine: Engine;
    try {
      engine = new Engine(stage, quality, {
        onSelect: select,
        onFirstFrame: () => setReady(true),
        onPlace: (x, z) => setPlacing((p) => (p ? { ...p, x, z } : p)),
      });
    } catch (err) {
      console.error(err);
      setToast(t('webgl'));
      return;
    }
    engineRef.current = engine;
    engine.setSnow(getPrefs().snow);
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
    return () => {
      unsubscribe();
      engine.dispose();
      engineRef.current = null;
      delete window.__jarlheim;
    };
  }, [quality, select, setToast, store]);

  // First visit: offer an account (Google, username + password, or guest) once.
  useEffect(() => {
    if (!ready || navigator.webdriver) return;
    try {
      if (localStorage.getItem('jarlheim.welcomed')) return;
      localStorage.setItem('jarlheim.welcomed', '1');
    } catch {
      return;
    }
    setPanel('chat');
  }, [ready]);

  useEffect(() => engineRef.current?.setSnow(prefs.snow), [prefs.snow]);

  // Labels in the 3D scene follow the language too.
  useEffect(() => {
    engineRef.current?.sync(store.snapshot, store.now());
  }, [lang, store]);

  // Event messages (one combined toast per step, not one per event).
  useEffect(
    () =>
      store.onEvents((events) => {
        const p = getPrefs();
        const wanted = events.filter((e) =>
          e.type === 'building.completed'
            ? p.notifyBuild
            : e.type === 'raid.spotted' || e.type === 'raid.resolved'
              ? p.notifyRaid
              : e.type === 'quest.completed' || e.type === 'quests.reset'
                ? p.notifyQuest
                : true,
        );
        const lines = wanted.map(describe).filter((x): x is string => x !== null);
        if (lines.length) setToast(lines.join(' · '));
        const won = rewardOf(events, store.snapshot);
        if (won) setBurst(won);
      }),
    [setToast, store],
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast, setToast]);

  // The "Go" highlight: the target button pulses until it is tapped.
  useEffect(() => {
    if (!hint) return;
    const el = document.querySelector<HTMLElement>(`[data-hint="${hint}"]`);
    if (!el) return;
    el.classList.add('pulse');
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const done = () => setHint(null);
    el.addEventListener('click', done);
    return () => {
      el.classList.remove('pulse');
      el.removeEventListener('click', done);
    };
  }, [hint, selected, panel]);

  // Placing a building: show the ghost, keep it where the finger puts it, colour it by the rules.
  const placingKey = placing ? `${placing.type}|${placing.moveId ?? ''}` : '';
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !placingKey) return;
    const p = placingRef.current!;
    engine.startPlacement(p.type, p.level, store.snapshot, p.moveId);
    return () => engine.endPlacement();
  }, [placingKey, store]);
  const placingRef = useRef(placing);
  placingRef.current = placing;
  const placeError = placing
    ? placementError(state, placing.type, placing.x, placing.z, placing.moveId)
    : null;
  useEffect(() => {
    if (placing) engineRef.current?.setPlacement(placing.x, placing.z, placing.rot, !placeError);
  }, [placing, placeError]);

  const startPlacing = (type: BuildingType) => {
    const spot = suggestSpot(state, type) ?? { x: 0, z: 12 };
    setPanel(null);
    setSelected(null);
    engineRef.current?.setSelected(null);
    setPlacing({ type, level: 1, ...spot, rot: Math.atan2(-spot.x, -spot.z) });
    engineRef.current?.focusSpot(spot.x, spot.z);
  };
  const startMoving = (id: string) => {
    const b = state.buildings[id];
    if (!b) return;
    setSelected(null);
    engineRef.current?.setSelected(null);
    setPlacing({ type: b.type, level: b.level, moveId: id, x: b.x, z: b.z, rot: b.rot });
  };
  const confirmPlacing = () => {
    if (!placing) return;
    const ok = placing.moveId
      ? run({ type: 'move', buildingId: placing.moveId, x: placing.x, z: placing.z, rot: placing.rot })
      : run({ type: 'build', building: placing.type, x: placing.x, z: placing.z, rot: placing.rot });
    if (ok) setPlacing(null);
  };

  const [tip, setTip] = useState<string | null>(null);
  const onError = (message: string) => {
    setToast(errorText(message));
    const next = failTip(message, lang, Date.now());
    if (next) setTip(next);
  };
  useEffect(() => {
    if (!tip) return;
    const id = setTimeout(() => setTip(null), 9000);
    return () => clearTimeout(id);
  }, [tip]);
  const online = useOnline(store, onError, (name) => setToast(t('attackedBy', { n: name })));
  const playerAlliance = online.mine?.alliance
    ? online.alliances.find((x) => x.id === online.mine!.alliance!.id)
    : undefined;
  const run = (cmd: Parameters<GameStore['dispatch']>[0]) => {
    const err = store.dispatch(cmd);
    if (err) onError(err.message);
    return !err;
  };
  const openPanel = (p: Panel) => {
    setSelected(null);
    setReportId(null);
    setHint(null);
    engineRef.current?.setSelected(null);
    setPanel(panel === p ? null : p);
  };
  const openReport = (id: number) => {
    setPanel(null);
    setSelected(null);
    setReportId(id);
    store.dispatch({ type: 'readReport', reportId: id });
  };

  /** Follows a quest arrow: glide to the place, open it, and make the right button pulse. */
  const go = (route: Route | null) => {
    if (!route) return setToast(t('noPlot'));
    setPlacing(null);
    if (route.target === 'build' || route.target === 'builders' || route.target === 'quests') {
      setSelected(null);
      engineRef.current?.setSelected(null);
      setReportId(null);
      setPanel(route.target === 'build' ? 'build' : route.target === 'builders' ? 'builders' : 'quests');
    } else if (route.target === 'barrow') {
      engineRef.current?.focusOn('barrow');
      select('barrow');
    } else {
      engineRef.current?.focusOn(route.target);
      select(route.target);
    }
    setHint(route.hint);
  };

  const caps = storageCap(state);
  const busy = state.queue.length;
  const slots = builderSlots(state);
  const claimable = claimableQuests(state);
  const main = currentMainQuest(state);
  const report = reportId !== null ? state.reports.find((r) => r.id === reportId) : undefined;
  // The latest line of realm chat, refreshed every half minute.
  const [chatTick, setChatTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setChatTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const chatLine = useMemo(() => {
    const now = Date.now();
    const vs = vsStandings(store.snapshot, now);
    return (
      botMessages(
        {
          channel: 'realm',
          realm: state.world.realm,
          alliance: state.world.alliance,
          player: state.profile.name,
          theme: t(`vsTheme_${vs.theme}`),
          rival: vs.mine?.rival ?? null,
          ahead: !!vs.mine && vs.mine.team >= vs.mine.enemy,
        },
        'strip',
        now,
        1,
      )[0] ?? null
    );
  }, [chatTick, lang, state.world.realm, state.world.alliance, state.profile.name]);
  const unread = state.reports.filter((r) => !r.read).length;
  const warriors = sumCounts(state.army.troops);
  const power = totalPower(state);

  return (
    <NeedContext.Provider value={(need) => go(routeForNeed(state, need, store.now()))}>
      <div className="app">
        <div className="stage" ref={stageRef} data-testid="stage" />

        {/* ---- top bar: who you are, how strong, what you have ---- */}
        <header className="topbar">
          <button className="me" onClick={() => openPanel('profile')} data-testid="profile-button">
            <span className="avatar">
              <AvatarFace id={state.profile.avatar} size={44} />
            </span>
            <span className="me-text">
              <strong className="me-name">{state.profile.name}</strong>
              <span className="power" data-testid="power-chip">
                <PowerIcon size={13} />
                <span data-testid="power">{power.toLocaleString('en-US')}</span>
              </span>
            </span>
          </button>
          <div className="gold" title={resName('gold')}>
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
                title={`${resName(r)}: ${Math.floor(state.resources[r])} / ${caps[r]}`}
              >
                <ResourceIcon res={r} size={15} />
                <span data-testid={`res-${r}`}>{formatAmount(state.resources[r])}</span>
              </div>
            );
          })}
        </div>

        {/* ---- left: round buttons ---- */}
        <aside className="sidebar">
          <button
            className={`round ${busy < slots ? 'idle' : ''}`}
            onClick={() => openPanel('builders')}
            aria-label={t('builders')}
            data-testid="builders"
          >
            <BuilderIcon />
            <small>
              {busy}/{slots}
            </small>
          </button>
          <button
            className="round"
            onClick={() => openPanel('army')}
            aria-label={t('warband')}
            data-testid="army-button"
          >
            <ArmyIcon />
            <small>{warriors}</small>
            {sumCounts(state.army.wounded) > 0 && <span className="badge-dot warn">+</span>}
          </button>
          <button
            className="round"
            onClick={() => openPanel('reports')}
            aria-label={t('mail')}
            data-testid="reports-button"
          >
            <SagaIcon />
            {unread > 0 && <span className="badge-dot">{unread}</span>}
          </button>
          <button
            className="round"
            onClick={() => openPanel('quests')}
            aria-label={t('quests')}
            data-testid="quests-button"
          >
            <QuestIcon />
            {claimable > 0 && <span className="badge-dot">{claimable}</span>}
          </button>
        </aside>

        {/* ---- right: heroes as small round portraits ---- */}
        <aside className="heroes">
          {[0, 1, 2].map((i) => {
            const h = HEROES.find((x) => x.id === state.heroes.squad[i]);
            return (
              <button
                key={i}
                className={`hero ${h ? '' : 'locked'}`}
                onClick={() => openPanel('heroes')}
                aria-label={h?.name ?? t('heroes')}
                data-testid={`side-hero-${i}`}
              >
                {h ? <HeroPortrait look={h.look} rarity={h.rarity} size={38} /> : <HeroIcon size={20} />}
              </button>
            );
          })}
          <button
            className="hero shop-button"
            onClick={() => openPanel('shop')}
            aria-label={t('shop')}
            data-testid="shop-button"
          >
            🏪
          </button>
        </aside>

        {((selected && selected !== 'longship') || panel === 'build') && !placing && (
          <PlotPanel
            store={store}
            state={state}
            plotId={panel === 'build' ? null : selected}
            onClose={() => (panel === 'build' ? setPanel(null) : select(null))}
            onError={onError}
            onChoose={startPlacing}
            onMove={startMoving}
          />
        )}
        {placing && (
          <div className="place-bar" data-testid="place-bar">
            <p className={placeError ? 'bad' : ''}>
              {bName(placing.type)} · {placeError ? errorText(placeError) : t('dragHint')}
            </p>
            <div className="place-buttons">
              <button onClick={() => setPlacing(null)} aria-label={t('cancel')} data-testid="place-cancel">
                ✕
              </button>
              <button
                onClick={() => setPlacing({ ...placing, rot: placing.rot + Math.PI / 4 })}
                aria-label={t('rotate')}
                data-testid="place-rotate"
              >
                ⟳
              </button>
              <button
                className="ok"
                disabled={!!placeError}
                onClick={confirmPlacing}
                aria-label={t('place')}
                data-testid="place-ok"
              >
                ✓
              </button>
            </div>
          </div>
        )}
        {state.raid.incoming && !placing && (
          <button
            className="raid-banner"
            data-testid="raid-banner"
            onClick={() => {
              const wall = Object.values(state.buildings).find(
                (b) => b.type === 'palisade' || b.type === 'rampart',
              );
              if (wall) go({ target: wall.id, hint: 'call-raid' });
              else openPanel('army');
            }}
          >
            {t('raidWarn', { t: formatDuration(Math.max(0, state.raid.incoming.landsAt - store.now())) })}
          </button>
        )}
        {selected === 'longship' && (
          <section className="card panel" data-testid="info-card" role="dialog" aria-label={t('longship')}>
            <button className="close" onClick={() => select(null)} aria-label={t('close')}>
              ×
            </button>
            <h2>{t('longship')}</h2>
            <p className="norse">Snekkja</p>
            <p>{t('longshipDesc')}</p>
          </section>
        )}
        {panel === 'army' && (
          <ArmyPanel
            state={state}
            now={store.now()}
            run={(cmd) => void run(cmd)}
            onClose={() => setPanel(null)}
            onBarrow={() => setPanel('barrow')}
          />
        )}
        {panel === 'barrow' && (
          <BarrowPanel
            state={state}
            store={store}
            onClose={() => setPanel(null)}
            onReport={openReport}
            onError={onError}
          />
        )}
        {panel === 'reports' && (
          <ReportsPanel
            state={state}
            onOpen={openReport}
            onReadAll={() => run({ type: 'readAllReports' })}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'shop' && (
          <ShopPanel
            store={store}
            state={state}
            tab={shopTab}
            setTab={setShopTab}
            onClose={() => setPanel(null)}
            onError={onError}
          />
        )}
        {panel === 'heroes' && (
          <HeroesPanel store={store} state={state} onClose={() => setPanel(null)} onError={onError} />
        )}
        {panel === 'chat' && (
          <ChatPanel
            state={state}
            onClose={() => setPanel(null)}
            onOpenWorld={() => setPanel('world')}
            onSignedIn={() => void online.resync()}
            playerAlliance={
              playerAlliance
                ? {
                    channelId: playerAlliance.channelId,
                    label: `[${playerAlliance.tag}] ${playerAlliance.name}`,
                  }
                : null
            }
          />
        )}
        {panel === 'world' && (
          <WorldMap
            store={store}
            state={state}
            onClose={() => setPanel(null)}
            onError={onError}
            onReport={(id) => {
              setReportId(id);
              store.dispatch({ type: 'readReport', reportId: id });
            }}
            online={online}
            onSignIn={() => setPanel('chat')}
            onOpenShop={(tab) => {
              setShopTab(tab);
              setPanel('shop');
            }}
          />
        )}
        {report && <ReportView report={report} onClose={() => setReportId(null)} />}
        {panel === 'quests' && (
          <QuestsPanel
            store={store}
            state={state}
            tab={questTab}
            setTab={setQuestTab}
            onClose={() => setPanel(null)}
            onError={onError}
            onGoDaily={(id) => go(routeForDaily(state, id, store.now()))}
            onGoMain={() => main && go(routeForGoal(state, main.quest.goal, store.now()))}
          />
        )}
        {panel === 'builders' && (
          <BuildersPanel
            state={state}
            now={store.now()}
            slots={slots}
            onClose={() => setPanel(null)}
            onOpen={(plot) => go({ target: plot, hint: 'finish' })}
            onGoBuild={() => go(main ? routeForGoal(state, main.quest.goal, store.now()) : null)}
          />
        )}
        {(panel === 'profile' || panel === 'settings' || panel === 'bag') && (
          <ProfilePage
            store={store}
            state={state}
            tab={panel === 'bag' ? 'bag' : panel === 'settings' ? 'settings' : 'profile'}
            setTab={(k) => setPanel(k)}
            run={run}
            toast={setToast}
            online={{
              on: online.on,
              userId: online.userId,
              allianceName: online.mine?.alliance
                ? `[${online.mine.alliance.tag}] ${online.mine.alliance.name}`
                : state.world.alliance !== null
                  ? `[${ALLIANCES[state.world.alliance]!.tag}]`
                  : null,
            }}
            onClose={() => setPanel(null)}
            onSignIn={() => setPanel('chat')}
            onRestart={() => {
              void store.reset();
              select(null);
              setPanel(null);
            }}
          />
        )}

        {burst && <RewardBurst burst={burst} onDone={endBurst} />}

        {/* The realm chat in one line: the AI jarls (and players) talk while you play. */}
        {chatLine && !selected && !panel && !report && !placing && (
          <button className="chat-strip" onClick={() => openPanel('chat')} data-testid="chat-strip">
            💬 <b>{chatLine.senderName}</b> {chatLine.body}
          </button>
        )}

        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}

        {tip && (
          <div className="fail-tip card" role="status" data-testid="fail-tip">
            <p>💡 {tip}</p>
            <button className="link" onClick={() => setTip(null)}>
              ✓
            </button>
          </div>
        )}

        {/* ---- the guide bar: always one clear next step ---- */}
        {main && !selected && !panel && !report && !placing && (
          <div className={`guide ${main.done ? 'ready' : ''}`} data-testid="guide">
            <button
              className="guide-text"
              onClick={() => {
                setQuestTab('main');
                openPanel('quests');
              }}
            >
              <QuestIcon size={22} />
              <span>{goalText(main.quest.goal)}</span>
              <Reward reward={main.quest.reward} />
            </button>
            {main.done ? (
              <button
                className="guide-go claim"
                data-testid="guide-claim"
                onClick={() => {
                  if (run({ type: 'claimMainQuest' })) setToast(t('gotReward'));
                }}
              >
                {t('claim')}
              </button>
            ) : (
              <button
                className="guide-go"
                data-testid="guide-go"
                aria-label={t('go')}
                onClick={() => go(routeForGoal(state, main.quest.goal, store.now()))}
              >
                ➜
              </button>
            )}
          </div>
        )}

        <nav className="bottombar">
          <button onClick={() => openPanel('build')} aria-label={t('build')} data-testid="build-button">
            <BuilderIcon size={26} />
          </button>
          <button onClick={() => openPanel('heroes')} aria-label={t('heroes')} data-testid="heroes-button">
            <HeroIcon size={26} />
          </button>
          <button onClick={() => openPanel('bag')} aria-label={t('bag')} data-testid="bag-button">
            <BagIcon size={26} />
          </button>
          <button
            onClick={() => openPanel('settings')}
            aria-label={t('settings')}
            data-testid="settings-button"
          >
            <GearIcon size={24} />
          </button>
          <button onClick={() => openPanel('chat')} aria-label={t('chat')} data-testid="chat-button">
            <span className="emoji-icon">💬</span>
          </button>
          <button
            className="globe"
            onClick={() => openPanel('world')}
            aria-label={t('world')}
            data-testid="globe"
          >
            <GlobeIcon size={40} />
          </button>
        </nav>

        <Splash visible={!ready} />
      </div>
    </NeedContext.Provider>
  );
}

function BuildersPanel({
  state,
  now,
  slots,
  onClose,
  onOpen,
  onGoBuild,
}: {
  state: GameState;
  now: number;
  slots: number;
  onClose: () => void;
  onOpen: (plot: string) => void;
  onGoBuild: () => void;
}) {
  const free = Math.max(0, slots - state.queue.length);
  return (
    <section className="card panel" data-testid="builders-panel" role="dialog" aria-label={t('builders')}>
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      <h2>{t('builders')}</h2>
      <ul className="builder-list">
        {state.queue.map((job) => {
          const b = state.buildings[job.buildingId];
          const left = remainingMs(state, job.buildingId, now) ?? 0;
          return (
            <li key={job.buildingId}>
              <BuilderIcon size={26} />
              <div className="quest-body">
                <span>{b ? `${bName(b.type)} → ${job.targetLevel}` : ''}</span>
                <div className="progress">
                  <i style={{ width: `${100 * (1 - left / Math.max(1, job.endsAt - job.startedAt))}%` }} />
                </div>
                <span className="muted">⏱ {formatDuration(left)}</span>
              </div>
              <button
                className="go"
                aria-label={t('go')}
                data-hint="builder-go"
                onClick={() => onOpen(job.buildingId)}
              >
                ➜
              </button>
            </li>
          );
        })}
        {Array.from({ length: free }, (_, i) => (
          <li key={`free-${i}`} className="ready">
            <BuilderIcon size={26} />
            <div className="quest-body">
              <span>{t('idle')}</span>
            </div>
            <button className="go" aria-label={t('go')} onClick={onGoBuild}>
              ➜
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
