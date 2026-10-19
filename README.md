# ⚔️ Jarlheim

> *"Cattle die, kinsmen die… but fame never dies for the one who earns it."* (after *Hávamál*)

**A free, easy-to-play 3D mobile strategy game (4X) set in the real Viking Age.**
Grow a jarl's hold on a snowy fjord, raise an army, recruit saga heroes, march across a living
3D world map, join an alliance and fight for your realm, all in the browser on a phone.

> **Challenge #10:** a full mobile 4X game, designed and engineered with **Claude Code**,
> using only free tools and services.

### ▶️ Play it now: **https://jarlheim.vercel.app** (mirror: https://moemenakari.github.io/VIKEGAME/)

Works on any phone browser. Play as a guest, or create an account for chat and the online realm.
English, Arabic (right-to-left) and French.

![The hold, the world map close up, the whole realm, and the game in Arabic](docs/screenshots/today-overview.jpg)

![A battle report, saga heroes, the Alliance VS and the shops](docs/screenshots/today-features.jpg)

---

## 🎮 What you can play today

**Your hold**
- Place and move buildings freely on your land (farms, woodcutters, mines, barracks, stable, shipyard, walls, the Thing Mound…), upgrade them with up to 10 builders, and earn resources even while offline.
- Train shieldwalls, berserkers, archers, riders, war bears, siege engines and longships; every unit counters another.
- Clear the ten levels of the **Draugr Barrow**; every battle is told as a short saga.
- Sea raiders attack after Great Hall 3: a beacon warns you, your **harbour** decides which ships sail out, and your walls and warriors hold the rest.

**Heroes**
- 15 real saga figures (Lagertha, Egil Skallagrímsson, Harald Hardrada, Leif Erikson…), recruited with earned horns or Gold, with odds shown and pity guarantees.
- **Four squads**: each led by up to three heroes; stronger heroes lead more warriors, and one tap sends a squad on the map.

**Midgard, the world map (Three.js)**
- A real 3D map drawn on the GPU: coasts, forests, snow and moving waves stay sharp at every zoom.
- AI jarls' holds, wolf packs, bears, outlaw camps, draugr mounds, shipwreck treasure and resource fields.
- Your columns really march (riders, carts, siege rams, longships at sea). Tap one to **steer it anywhere**, chain attacks, or call it home; **ambush** other jarls' columns on the road.
- Scout, attack, rally with your alliance, teleport, and cross to the enemy realm in the King's War.
- Colours that tell you everything: your alliance blue, neutral grey, foes red (whoever spied on you, attacked you, or you marked).

**Alliances and events**
- Ten saga alliances per realm, an **Alliance VS** every 3 days (ranked 1 v 2, 3 v 4…), a top-players ranking, the Saturday **King's War** between realms.
- The Thing Mound: alliance help on every build and a daily alliance gift.
- Shops (Gold, Alliance, VS, Energy) where everything is earned in play. There are no real payments.

**Online**
- Accounts with a public player ID (sign in with the name or the ID), recovery by security questions, password change.
- Realm, alliance, private and group chat with reactions and roses, friends, and AI jarls who talk (always tagged AI).
- Real players share each realm: your hold, your power and PvP attacks are synced through Supabase.

**Made to be easy**
- A guide bar that never ends (always one next step), daily quests one tap away, a "?" on every screen, and hand-written tips when an action fails twice.
- Mail with Battles / Scouts / News tabs and "read all".

## 🧱 How it is built
- **`packages/sim`**: the whole game as pure, deterministic TypeScript (no DOM, no clock, seeded RNG). Every player action is a serialisable command; saves are versioned and migrated. 130+ Vitest tests.
- **`packages/client`**: React 19 + Three.js. One draw call per kind of object on the map (instanced meshes), a GPU ground shader, a 2D fallback for phones without WebGL.
- **Online**: Supabase (Postgres with row-level security, Auth, Realtime, Storage), with every write going through checked SQL functions.
- **Quality gates** on every push: typecheck, lint, format, unit tests, build, a 600 KB bundle budget, and Playwright smoke tests on a phone-sized screen.

**Tech stack (all free):** TypeScript · React · Three.js · Vite · Vitest · Playwright · Supabase · Vercel · GitHub Actions

## 🚀 Run it yourself
Requires [Node.js 22+](https://nodejs.org).
```bash
npm install
npm run dev        # the game at http://localhost:5173 (also reachable from your phone on the same Wi-Fi)
npm run check      # typecheck + lint + format + unit tests + build + bundle-size budget
npm run e2e        # phone-sized browser smoke test with screenshots
```

## 🗺️ What is planned next
The 16-rune research tree, the Silver Road voyages, monster events (Fáfnir, the World Serpent, Ragnarök),
the Midsummer Thing with royal offices, real players' columns visible on the map, server-checked battles,
Google sign-in, sound, and an Android app. See the [Roadmap](docs/ROADMAP.md).

## 📚 Documentation
| Doc | What's inside |
|---|---|
| [Game Design](docs/GDD.md) | Every system of the game |
| [History Bible](docs/HISTORY_BIBLE.md) | The sagas, chronicles, laws and archaeology behind every name and feature |
| [Architecture](docs/ARCHITECTURE.md) | Pure deterministic sim + Three.js renderer, offline progress, performance budgets |
| [Decision Log](docs/DECISIONS.md) | Every key decision and why |
| [Roadmap](docs/ROADMAP.md) | Milestones M0 → M11 |
| [Live Events](docs/LIVE_EVENTS.md) · [Monetization](docs/MONETIZATION.md) | Event calendar; a fair store only if the game succeeds |
| [Privacy](docs/PRIVACY.md) · [Terms](docs/TERMS.md) | What the game keeps, and the rules |

## 🎨 Originality
Mechanics follow mobile 4X genre conventions. Art and UI are original (models are built in code)
or CC0, credited in [`assets/CREDITS.md`](assets/CREDITS.md). Historical figures and stories come from
public-domain medieval sources, retold in our own words.

## © Licence
© 2026 Moemen Akari. All rights reserved: see [LICENSE](LICENSE). The code is public to read and learn from; please ask before reusing any of it.
