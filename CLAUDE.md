# CLAUDE.md — working rules for this repo

## Branch rule (owner's explicit request)
- **One branch only: `main`.** Commit and push directly to `main`. Never create other branches or pull requests.

## Project
Jarlheim: a free, easy-to-play 3D mobile 4X strategy game set in the real Viking Age.
Read `docs/GDD.md`, `docs/HISTORY_BIBLE.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`
and `docs/DECISIONS.md` before changing anything.

## Non-negotiables
- **Everything is in English:** UI, docs, code, commits.
- **History first:** every name, office, festival, hero or creature must trace back to a source in `docs/HISTORY_BIBLE.md`. Write our own text and never paste modern translations.
- `packages/sim` stays pure: no DOM, no Three.js, no `Date.now()`, no `Math.random()`. Time and RNG are injected.
- Every player action is a serialisable command. Every new rule gets a Vitest test.
- Balance numbers and events live in `packages/sim/src/data`, never inline in systems.
- No asset from the reference game. Every imported asset needs a verified licence (CC0 preferred) and an entry in `assets/CREDITS.md`.
- **Free and easy:** only free tools and services. Any player action must be reachable in ≤ 3 taps.
- No real payments until M11 (see `docs/MONETIZATION.md`). Gold is earn-only until then.
- Record significant decisions in `docs/DECISIONS.md`.

## Commands
- `npm run dev`: start the game locally
- `npm run check`: typecheck, lint, format check, unit tests, build, bundle-size budget (run before every push)
- `npm run e2e`: Playwright smoke test on a phone viewport. In the cloud container use
  `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run e2e`
- `npm run format`: auto-format
