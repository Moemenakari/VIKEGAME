# Jarlheim — Roadmap

Every milestone ends with something **playable at a public link**. No milestone
is "just code". All work is committed directly to `main`, the only branch (see CLAUDE.md).

| # | Milestone | Playable result ("demo") | Done when |
|---|---|---|---|
| **M0** ✅ | **Foundations** | — | GDD, architecture, roadmap and decisions are approved by the owner |
| **M1** ✅ | Tech skeleton | A 3D snowy fjord peninsula you can pan / pinch-zoom on a phone, at a GitHub Pages URL | Monorepo, Vite, Three.js scene, camera rig, quality tiers, CI (typecheck/lint/test/build), Pages deploy, bundle budget |
| **M2** | The Hold | Place & upgrade buildings, resources tick, builder queue, timers, offline progress, save/load | `sim`: economy + construction + time + save migrations, with tests. Client: HUD, building menu, floating timers, daily quests |
| **M3** | Military | Train 3 troop types, heal wounded, fight a test battle with a report | Combat resolver (deterministic), training/healing queues, battle report UI |
| **M4** | Heroes | Recruit saga heroes, level, star-up, equip; squads of 3; Thor's Fishing (solo) | Hero data + skills, hero screens with 3D hero viewer, fishing mini-game |
| **M5** | The 16 Runes | Research trees with a graph UI, runestones, Hnefatafl puzzle | Research system + node-graph panel, runestone transliteration |
| **M6** | Midgard | 3D world map: ships & sea routes, gather, Draugr barrows, Wolf Hunt, Silver Road voyages, fire-carry land claim | Map gen (seeded), land/sea marches, PvE, voyages, map ↔ hold transition |
| **M7** | Clans (AI) | Join an AI clan: help, ring-gifts, feasts, feuds & wergild, War Horn rallies on Fáfnir and the frost giants, Clan Duel, Hólmganga | AI players & clans, rally system, duel scoring, weekly hunt calendar |
| **M8** | Midsummer Thing | Seize the Law Rock vs AI clans, become King, appoint the royal offices, request blessings, sentence outlaws | Thing event, office blessing queue, sentences, summer/winter seasons |
| **M9** | Polish & release v1 | Landnám tutorial, audio, VFX, Ragnarök & festivals, Android APK | First-session tutorial, perf pass on real device, APK in GitHub Releases |
| **M10** | Online | Real players in a shared realm | Node + Colyseus server running `sim`, accounts, server-side Gold wallet, persistence on a free tier |
| **M11** | Store (if the game succeeds) | Buy Gold, Jarl's Pass, cosmetics | Google Play Billing, receipt validation, legal checklist. See MONETIZATION.md |

## Working rhythm
1. Before each milestone: a short plan in the PR description with the exact tasks.
2. During: small commits on the one branch, CI green on every push.
3. After: a demo link, screenshots / GIF in the README, and the decisions log updated.
