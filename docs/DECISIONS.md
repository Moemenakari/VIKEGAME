# Decision Log

Every significant decision, with the reason. Status: **✅ Owner-approved** · **🟡 Proposed by Claude, awaiting owner**.

| ID | Decision | Why | Status |
|---|---|---|---|
| D-001 | **Copy mechanics, not assets.** Systems follow the genre reference, but all art, names, characters and UI art are original or CC0 | Mechanics are not copyrightable. Ripped assets risk DMCA takedown of the repo and look bad to employers | ✅ |
| D-002 | **Norse / Viking setting**, working title *Jarlheim* | Matches the repo name (VIKEGAME), looks clearly different from the reference, and Draugr (Norse undead) fill the "zombie" PvE role | ✅ |
| D-003 | **TypeScript + Three.js**, React for UI, Vite for build | Playable from a link on any phone (the best way to show a portfolio), skills employers ask for, and fully testable in CI | ✅ |
| D-004 | **Single-player realm with AI clans first; real online in M10** | Every social system (clans, rallies, duel, throne, ministers) gets built and playable months earlier. Because the sim is pure and command-based, going online later is a transport change, not a rewrite | 🟡 (owner asked for clarification, explained in `docs/ar/OVERVIEW.md` §5) |
| D-005 | **Pure, deterministic sim package** separate from rendering | Testability, replays, AI uses the same code paths, and the same code can run on a server later | 🟡 |
| D-006 | **Capacitor** for Android; PWA for install-from-browser | Free, reuses the web build 1:1. iOS needs a Mac and a paid account, so it is deferred | 🟡 |
| D-007 | **Art pipeline:** CC0 kits (KayKit, Kenney, Quaternius, Poly Pizza CC0) + our own Blender models, glTF + Meshopt + KTX2 | Free, licence-clean, mobile-friendly. Each asset's licence is checked before import and logged in `assets/CREDITS.md` | 🟡 |
| D-008 | **No real-money purchases**; Runes are earned only, recruitment rates are shown | Avoids payment and loot-box legal complexity, and keeps the portfolio focus on engineering | 🟡 |
| D-009 | **Arabic + English from day one**, RTL-mirrored HUD | The owner's audience is Arabic-speaking. Building RTL in from the start is much cheaper than retrofitting it | 🟡 |
| D-010 | **Docs and code in English**; an Arabic overview is maintained for the owner | English is the norm on GitHub and for international recruiters | 🟡 |
| D-011 | **One branch only:** `moe/vibrant-gauss-pydqu8` | The owner explicitly asked for a single branch controlled by Claude | ✅ |
| D-012 | **Code licence: MIT** (assets keep their own licences) | Standard for portfolio projects, so employers can read and reuse the code | 🟡 (licence file added only after owner confirms) |
| D-013 | Portrait orientation, 9:19.5 HUD layout mirroring the reference's grammar | Players of the genre already know this layout | 🟡 |
