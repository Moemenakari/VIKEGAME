# CLAUDE.md — working rules for this repo

## Branch rule (owner's explicit request)
- Work **only** on branch `moe/vibrant-gauss-pydqu8`. Never create other branches. Keep one open PR from it.

## Project
Jarlheim: a 3D mobile 4X strategy game (Norse setting). Read `docs/GDD.md`,
`docs/ARCHITECTURE.md`, `docs/ROADMAP.md` and `docs/DECISIONS.md` before changing anything.

## Non-negotiables
- `packages/sim` stays pure: no DOM, no Three.js, no `Date.now()`, no `Math.random()`. Time and RNG are injected.
- Every player action is a serialisable command. Every new rule gets a Vitest test.
- Balance numbers live in `packages/sim/src/data`, never inline in systems.
- No asset from the reference game. Every imported asset must have a verified licence (CC0 preferred) and an entry in `assets/CREDITS.md`.
- UI strings go through i18n (`ar` + `en`). Use CSS logical properties so RTL works.
- Record significant decisions in `docs/DECISIONS.md`, and update `docs/ar/OVERVIEW.md` when they affect the owner.

## Communication
The owner speaks Arabic. Explain plans and creative decisions to them in Arabic.
Code, commits and docs are in English.

## Commands
Added in M1 (`npm run dev | build | test | lint | typecheck`).
