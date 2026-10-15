# Jarlheim — Technical Architecture

> Stack: **TypeScript + Three.js + React (UI) + Vite**, packaged for Android with
> **Capacitor**, deployed as a playable web build on **GitHub Pages**. Every
> tool is free and open source. Exact versions are pinned in M1 (`package.json` + lockfile).

## 1. Guiding principles

1. **The simulation is pure.** Game rules live in `packages/sim`. That package has no DOM, no Three.js, no `Date.now()` and no `Math.random()`. It is a plain TypeScript library that runs the same way in a browser, in Node tests, and later on a server.
2. **Commands in, events out.** Every player action is a serialisable JSON **command**. The sim validates it, applies it, and emits **events**. This one rule gives us undo-free correctness, unit tests, replays, AI players, and a later move to an authoritative server.
3. **Time is an input.** `now` is always passed in. All timers store an absolute `endsAt`. Offline progress is just `advance(state, now)`.
4. **Data-driven balance.** Buildings, troops, heroes, research and events are typed data tables, so designers tune numbers without touching logic.
5. **The renderer is a view.** Three.js reads state snapshots and plays animations. It never decides game outcomes.
6. **Mobile first.** Performance budgets are written down (§7) and checked in CI.

## 2. Repository layout (target, created in M1)

```
VIKEGAME/
├─ packages/
│  ├─ sim/                 # pure game logic (no rendering)
│  │  ├─ src/data/         # balance tables: buildings.ts, troops.ts, heroes.ts, lore.ts, events.ts
│  │  ├─ src/systems/      # economy, construction, research, training, healing,
│  │  │                    # combat, heroes, marches, clans, duel, throne
│  │  ├─ src/commands/     # command types + validators + reducers
│  │  ├─ src/ai/           # bot players & AI clans (use the same commands as humans)
│  │  ├─ src/rng.ts        # seeded PRNG
│  │  └─ test/             # Vitest unit + property tests
│  └─ client/              # the game app
│     ├─ src/scene/        # Three.js: renderer, camera rig, hold/, realm/, fx/, assets/
│     ├─ src/ui/           # React HUD & panels (English UI, strings in one dictionary)
│     ├─ src/store/        # bridges sim state → UI (Zustand)
│     ├─ src/platform/     # save (IndexedDB), haptics, Capacitor glue
│     └─ e2e/              # Playwright smoke tests (mobile viewport)
├─ assets/                 # source models (.blend/.glb), CREDITS.md
├─ docs/                   # GDD, architecture, roadmap, decisions
└─ .github/workflows/      # CI + Pages deploy
```

npm workspaces (built into npm, no extra tool).

## 3. The sim: commands, state, events

```ts
// shape only — final code in M2
type Command =
  | { type: 'build.upgrade'; buildingId: string }
  | { type: 'build.speedup'; buildingId: string; itemId: string; qty: number }
  | { type: 'train.start'; troop: TroopId; count: number }
  | { type: 'march.send'; kind: 'gather' | 'attack' | 'rally' | ...; target: TileId; squad: SquadSpec }
  | { type: 'clan.help'; requestId: string }
  | { type: 'throne.requestBlessing'; position: MinisterId }
  // ...

interface Sim {
  apply(state: GameState, cmd: Command, now: number): Result<{ state: GameState; events: GameEvent[] }, RuleError>;
  advance(state: GameState, now: number): { state: GameState; events: GameEvent[] }; // resolves timers, production, marches, AI turns
}
```

- **Immutable updates** (structural sharing with Immer) make snapshots cheap and history easy to debug.
- **Errors are values** (`Result`), not exceptions. The UI shows the reason, for example "Not enough Wood".
- **Events** (`building.completed`, `battle.resolved`, `clan.helpReceived`…) drive UI toasts, sounds and animations.

## 4. Time & offline progress

- The client clock is injected (`Clock` interface). Tests use a fake clock, and the M10 server uses server time.
- Production is computed lazily as `rate × elapsed`, capped by storage and the offline cap. Nothing ticks every frame.
- `advance()` processes due timers **in chronological order**. For example, a farm upgrade that finished 3 h ago starts producing at its new rate from that moment, not from now.
- Anti-cheat for single-player is not a goal. The server version makes the server clock authoritative.

## 5. Randomness

The seeded PRNG (`mulberry32`/`xoshiro128**`) is stored in state. Combat, AI and
loot draw from it, so the same seed + same commands give the same game. This
powers replays, tests and bug reports ("send me your save").

## 6. Rendering (Three.js)

| Concern | Approach |
|---|---|
| Camera | Perspective, low FOV (~30°) for a near-isometric look like the reference. Pitch ~50°, clamped zoom & pan bounds |
| Input | Pointer events: one-finger pan, pinch zoom, tap selects (raycast against cheap proxy colliders, not full meshes), long-press for move mode |
| Scenes | `HoldScene` and `RealmScene` share one `WebGLRenderer`. Switching is a camera fly + crossfade |
| Assets | glTF 2.0 / `.glb`, Meshopt-compressed geometry, KTX2 (Basis) textures, loaded per scene with a progress bar |
| Batching | `InstancedMesh` for trees, rocks, villagers and map tiles. Static props are merged per material |
| Lighting | 1 directional sun + hemisphere fill. Shadows only for the city (1 cascade, 2048 on high / 1024 on low). Static shadows are baked into vertex AO where possible |
| Water | Custom lightweight shader (scrolling normals + depth tint), no reflections on low tier |
| FX | GPU particle system (smoke, sparks, snow); floating timers are DOM overlays positioned from 3D anchors |
| Battery | **Render on demand**: when nothing animates and no input happens for 2 s, drop to 0–10 FPS. Pause when the tab is hidden |
| Quality tiers | Low / Medium / High, auto-picked from a first-frame benchmark + `devicePixelRatio`. DPR is capped at 2 |

Future: Three.js `WebGPURenderer` where available, with WebGL2 as the fallback.

## 7. Performance budgets (mid-range Android, 2021-class)

| Metric | Budget |
|---|---|
| Frame rate | 60 FPS target, 30 FPS floor on Low |
| Draw calls (city, full zoom-out) | ≤ 120 |
| Triangles on screen | ≤ 250k (High), ≤ 120k (Low) |
| Texture memory | ≤ 128 MB |
| Initial download (gzip) | ≤ 8 MB before first playable frame. More assets are lazy-loaded |
| JS bundle (gzip) | ≤ 600 KB for app code, Three.js included |
| Time to interactive | ≤ 4 s on 4G |

The CI build fails if the bundle-size budget is exceeded.

## 8. UI layer

- **React** DOM overlay above the canvas: crisp text and accessibility.
- **Language:** the game is **English only**. All UI strings still live in one `en.json` dictionary (no hard-coded text), so another language could be added later.
- **State:** a Zustand store holds the latest sim snapshot. Components subscribe to small slices so React never re-renders on every frame.
- **Design system:** a small set of tokens (colours, radii, spacing) + components (Panel, Tabs, ResourcePill, TimerBadge, HeroCard, Button).

## 9. Persistence

- **IndexedDB** (via `idb-keyval`) autosaves after every command (debounced) and on `visibilitychange`.
- **Versioned save schema** with a migration chain (`v1 → v2 → …`), validated with **Zod** on load.
- Export/import the save as a file (handy for bug reports and for moving devices).

## 10. AI realm (v1 multiplayer stand-in)

- About 60 bot players in 6–8 AI clans live in the same `GameState`. They use the **same commands** as the human player.
- They are cheap: bots act in coarse "turns" during `advance()`, using utility scoring (build if idle, gather when full, rally when strong).
- AI clans take part in Clan Duel scoring, Fjord Clash, the daily hunts and the Midsummer Thing, and an AI King appoints the royal offices.
- The point is that every social system is built and tested now, so going online later (M10) is a transport change, not a redesign.

## 11. Path to real online play (M10)

```
client ──commands──▶ server (Node + Colyseus, runs packages/sim) ──state patches──▶ clients
                              │
                              └──▶ Postgres (Supabase free tier) for accounts, clans, saves, Gold wallet ledger
```
The server becomes authoritative: it runs the same sim, owns the clock and RNG,
and validates commands. It also owns the **Gold wallet**, which is required before any
purchases (see MONETIZATION.md). Free hosting options are evaluated at M10.

## 12. Mobile packaging

- **Web / PWA:** installable from the browser (manifest + service worker for offline assets).
- **Android:** Capacitor wraps the same build into an APK/AAB. CI builds a debug APK as a downloadable artifact.
- **iOS:** possible with Capacitor, but it needs macOS + Xcode and a paid Apple developer account. Out of scope for v1.

## 13. Quality & tooling

| Tool | Purpose |
|---|---|
| TypeScript `strict` | Types everywhere, no `any` in `sim` |
| ESLint + Prettier | Lint / format |
| Vitest | Sim unit tests + property tests (e.g. "resources never go negative", "power is monotonic for upgrades") |
| Playwright | Mobile-viewport smoke test: loads, taps a building, starts an upgrade, takes a screenshot |
| GitHub Actions | typecheck → lint → test → build → size check → deploy Pages (on `main`) → APK artifact |

## 14. Coding conventions
- Sim functions are pure and small. One file per system. Data tables are `as const` + `satisfies` schemas.
- No magic numbers in systems: they come from `data/`.
- Every new rule gets a test in `packages/sim/test`.
- Commit messages: imperative, scoped (`sim: add healing queue`, `client: pinch zoom`).
