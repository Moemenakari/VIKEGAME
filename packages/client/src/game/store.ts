import {
  advance,
  apply,
  deserialize,
  newGame,
  serialize,
  type Clock,
  type Command,
  type GameEvent,
  type GameState,
  type RuleError,
} from '@jarlheim/sim';
import { clearSave, createDebouncedSaver, loadSaveText, writeSaveText } from './persistence';

export const WORLD_SEED = 20260930;

type Listener = () => void;
type EventListener = (events: GameEvent[]) => void;

/**
 * The client's single source of truth. It holds the current GameState, sends
 * every player action through the pure sim (`apply`), moves time forward once a
 * second (`advance`), and saves the whole state in one batched write.
 */
export class GameStore {
  private state: GameState;
  private listeners = new Set<Listener>();
  private eventListeners = new Set<EventListener>();
  private saver = createDebouncedSaver(() => void writeSaveText(serialize(this.state)));
  private timer: ReturnType<typeof setInterval> | null = null;

  private constructor(
    initial: GameState,
    private readonly clock: Clock,
  ) {
    this.state = initial;
  }

  /** Loads the saved hold (one read) or starts a new one, then catches up on offline time. */
  static async load(clock: Clock): Promise<{ store: GameStore; offline: GameEvent[] }> {
    const text = await loadSaveText();
    const saved = text ? deserialize(text) : null;
    const store = new GameStore(saved ?? newGame(WORLD_SEED, clock.now()), clock);
    const { state, events } = advance(store.state, clock.now());
    store.state = state;
    store.saver.request();
    return { store, offline: events };
  }

  get snapshot(): GameState {
    return this.state;
  }

  now(): number {
    return this.clock.now();
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): GameState => this.state;

  onEvents(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  dispatch(cmd: Command): RuleError | null {
    const result = apply(this.state, cmd, this.clock.now());
    if (!result.ok) return result.error;
    this.commit(result.state, result.events);
    return null;
  }

  /** Starts the one-second heartbeat that keeps resources and timers moving. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const { state, events } = advance(this.state, this.clock.now());
      this.commit(
        state,
        events,
        events.some((e) => e.type !== 'resources.produced'),
      );
    }, 1000);
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.saver.flush);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.saver.flush);
    this.saver.flush();
  }

  async reset(): Promise<void> {
    await clearSave();
    this.commit(newGame(WORLD_SEED, this.clock.now()), []);
  }

  private onHide = (): void => {
    if (document.hidden) this.saver.flush();
  };

  private commit(state: GameState, events: GameEvent[], save = true): void {
    this.state = state;
    if (save) this.saver.request();
    for (const l of this.listeners) l();
    if (events.length) for (const l of this.eventListeners) l(events);
  }
}
