# Jarlheim — Roadmap

Every milestone ends with something **playable at a public link**. No milestone
is "just code". Work happens on a single branch (see CLAUDE.md).

| # | Milestone | Playable result ("demo") | Done when |
|---|---|---|---|
| **M0** | **Foundations** (this PR) | — | GDD, architecture, roadmap and decisions are approved by the owner |
| **M1** | Tech skeleton | A 3D snowy fjord peninsula you can pan / pinch-zoom on a phone, at a GitHub Pages URL | Monorepo, Vite, Three.js scene, camera rig, quality tiers, CI (typecheck/lint/test/build), Pages deploy, bundle budget |
| **M2** | The Hold | Place & upgrade buildings, resources tick, builder queue, timers, offline progress, save/load | `sim`: economy + construction + time + save migrations, with tests. Client: HUD, building menu, floating timers, AR/EN + RTL |
| **M3** | Military | Train 3 troop types, heal wounded, fight a test battle with a report | Combat resolver (deterministic), training/healing queues, battle report UI |
| **M4** | Heroes | Recruit, level, star-up, equip; squads with 3 heroes; Hall of Valhalla | Hero data + skills, hero screens with 3D hero viewer |
| **M5** | Rune Lore | Research trees with a graph UI | Research system + node-graph panel |
| **M6** | The Realm | 3D world map: march to gather, hunt Draugr, scout | Map gen (seeded), marches, PvE, gathering, map ↔ hold transition |
| **M7** | Clans (AI) | Join an AI clan: help, gifts, rallies on a Frost Giant, Clan Duel week | AI players & clans, rally system, duel scoring |
| **M8** | The High Seat | Throne War vs AI clans, become King, appoint ministers, request blessings | Throne war event, minister queue, titles |
| **M9** | Polish & release v1 | Tutorial, audio, VFX, Android APK, store-ready screenshots | First-session tutorial, perf pass on real device, APK in GitHub Releases |
| **M10** | Online (optional) | Real players in a shared realm | Node + Colyseus server running `sim`, accounts, persistence on a free tier |

## Working rhythm
1. Before each milestone: a short plan in the PR description with the exact tasks.
2. During: small commits on the one branch, CI green on every push.
3. After: a demo link, screenshots / GIF in the README, and the decisions log updated.
