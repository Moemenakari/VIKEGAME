# Decision Log

Every significant decision, with the reason. Status: **✅ Owner-approved** · **🟡 Proposed, awaiting owner** · **🔄 Changed by owner**.

| ID | Decision | Why | Status |
|---|---|---|---|
| D-001 | **Copy mechanics, not assets.** Systems follow the genre reference, but all art, names, characters and UI art are original or CC0 | Mechanics are not copyrightable. Ripped assets risk DMCA takedown and look bad to employers | ✅ |
| D-002 | **Norse / Viking setting**, working title *Jarlheim* | Matches the repo name (VIKEGAME) and looks clearly different from the reference | ✅ |
| D-003 | **TypeScript + Three.js**, React for UI, Vite for build | Playable from a link on any phone, skills employers want, testable in CI | ✅ |
| D-004 | **AI clans first, real online in M10** | Every social system is playable months earlier. The pure sim makes going online a transport change | 🟡 |
| D-005 | Pure, deterministic `sim` package separate from rendering | Tests, replays, AI and a future server all share one code path | 🟡 |
| D-006 | Capacitor for Android, PWA for install-from-browser | Free, and reuses the web build | 🟡 |
| D-007 | CC0 kits + own Blender models; glTF + Meshopt + KTX2 | Free, licence-clean, mobile-friendly | 🟡 |
| D-008 | **v1 is 100 % free. Gold (premium) is earn-only now, sellable later** after the server exists and the legal checklist is done | Owner: "if we succeed like Last Z, people should pay for Gold". Payments need a server wallet to be cheat-proof | 🔄 (was "never sell") |
| D-009 | **English only**: game UI, docs, code. Strings still go in one dictionary | Owner: "all in English" | 🔄 (was AR + EN) |
| D-010 | **Grounded in real Viking history**: sagas, Heimskringla, Eddas, law codes, archaeology. Sources in HISTORY_BIBLE.md | Owner: "base it on the historical books". It also makes the game stand out | ✅ |
| D-011 | **One branch only: `main`.** Commits go straight to `main`, with no feature branches or PRs | Owner: "I want one branch only", then "use main" | ✅ |
| D-012 | Code licence: MIT (assets keep their own licences) | Standard for portfolio projects | 🟡 |
| D-013 | Portrait, 9:19.5 HUD layout following the reference's grammar | Genre players already know it | 🟡 |
| D-014 | **Free and easy**: free tools only; ≤ 3 taps to any action, auto-collect, 5-minute tutorial | Owner: "all free and easy" | ✅ |
| D-015 | **A monster hunt every day** (Thor's Fishing, Fáfnir, Draugr Night, Wolf Hunt, Giant Siege, Hólmganga, Hnefatafl) | Owner: "every day have events, kill fish, kill dragon…" | ✅ |
| D-016 | **Historically accurate troop triangle**: Shieldwall > Berserkers > Archers > Shieldwall, **no cavalry**, plus ships as a second layer | Vikings fought on foot. Ships were their real advantage | 🟡 |
| D-017 | **Real royal offices** (Stallari, Ármaðr, Stafnasmiðr, Lögsögumaðr, Hirðskáld, Merkismaðr) as the King's ministers; the King is chosen at the **Midsummer Thing** | Heimskringla & Íslendingabók. Covers the owner's King + War/Industry/Construction ministers | 🟡 |
| D-018 | **Real saga heroes** (Lagertha, Egil, Harald Hardrada, Hervor, Sigurd…) instead of invented ones | Public-domain medieval figures with built-in stories | 🟡 |
| D-020 | **TypeScript 6.0** (not 7) and exact version pins (`.npmrc save-exact`) | typescript-eslint does not support TS 7 yet; exact pins keep builds reproducible | ✅ (technical) |
| D-021 | **M1 models are procedural** (built in code): terrain, spruces, longhouses, longship | Zero licence risk, tiny download (≈220 KB gzip total JS), and historically shaped (Trelleborg halls, Oseberg ship). CC0 / Blender assets come later where code is not enough | 🟡 |
| D-022 | **The "one trip" rule (no N+1)**: one save record, batched writes, one draw call per building, aggregated events, batched server queries. See ARCHITECTURE §14 | Owner's request, after a video on the N+1 problem (`SELECT … WHERE id IN (…)` instead of 100 queries) | ✅ |
| D-023 | Buildings are capped at the Great Hall level, and Great Hall 3+ needs the Storehouse at one level below | The genre's core gate. It teaches that the Storehouse matters | 🟡 |
| D-024 | **Battles are simultaneous per round** (no phase order) | Tests showed a phase order gave berserkers a free first blow that cancelled the Shieldwall counter. Simultaneous strikes keep the triangle fair | ✅ (technical) |
| D-025 | **First PvE is the Draugr Barrow** next to the hold (10 levels, first-clear Gold) before the world map exists | Lets players fight from M3 on, and the barrow later moves onto the Midgard map (M6) | 🟡 |
| D-026 | **Chat & social** in every channel (Realm, clan, private, groups) with images, emotes, translation and safety tools; **VIP 1–5** unlock chat and comfort perks | Owner request after M3 | ✅ |
| D-027 | Chat goes online **early (M3.6)** on Supabase's free tier, ahead of the full online realm (M10) | Real chat cannot be faked with bots. Accounts and messages are a smaller first online step than a shared world | 🟡 (order to confirm with owner) |
| D-028 | **Visual upgrade pass (M3.5)**: CC0 PBR textures, HDRI light, SSAO/bloom, detailed buildings, villagers | Owner: "more detail, not just colours" | ✅ |
| D-029 | **Surface textures are generated in code** (wood planks and grain, stone, turf, snow, cloth, ground: detail + normal + roughness maps) | The cloud environment blocks Poly Haven, ambientCG and Kenney downloads. Generated textures are original (no licence to track) and need no download. Photo-scanned CC0 textures can be swapped in later if those hosts are allowed | ✅ (technical) |
| D-030 | **HDRI sky light** from Poly Haven (CC0) via the `@pmndrs/assets` npm package, lazy-loaded after the first frame | Real-world light and reflections on every surface for ~150 KB | ✅ (technical) |
| D-019 | No slavery (thralls) and no horned helmets | Ethics, and historical accuracy | 🟡 |
| D-031 | **Graphics always High** (no quality picker); `?quality=low` only for automated tests | Owner: "all graphics High, no Low/Medium" | ✅ |
| D-032 | **Interface in Arabic (RTL), French and English**, switched with one tap on the top bar; the sim stays English and the client translates (`ui/i18n.ts`) | Owner request | ✅ |
| D-033 | **Guide bar + "Go" arrows**: one main quest at a time at the bottom; every quest has an arrow that glides the camera to the right building, opens it and pulses the button to tap | Owner, after the Last Z video: "everything has a link that takes you there" | ✅ |
| D-034 | **Daily chest track** (activity points from daily quests) and **profile pictures**: 3 free, more for earned Gold | Owner request; Gold stays earn-only until M11 | ✅ |
