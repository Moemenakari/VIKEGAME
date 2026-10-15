# Reference Analysis — reverse-engineering the genre

> Source: a 20-second screen recording of a commercial 4X mobile strategy game
> (survival / city-builder genre, e.g. *Last Z*, *Last War*).
> **We copy game mechanics only. We do not copy art, characters, names, UI art,
> audio or branding.** Mechanics are not protected by copyright. Assets and
> trademarks are, so everything visual in Jarlheim is original or CC0.

## 1. Screen-by-screen breakdown

| # | Screen in the recording | What it tells us (system) | Jarlheim equivalent |
|---|---|---|---|
| 1 | **City view** (3D, tilted ~45° perspective) with dozens of buildings, floating timers (`02:23:42`), upgrade arrows, idle-builder icons | Construction queue, timers, per-building state badges | **The Hold** (city) — see GDD §4 |
| 2 | **Top bar**: avatar, Power `222,459,650`, Wood `69.2M`, Diamonds `2,726` (+), Gold `1,197` | Power score, soft currencies, premium currency | Power, Food/Wood/Iron/Silver, **Runes** |
| 3 | **Left column**: Builders `4/5`, Research `1/2`, VIP badge `9`, truck icon, 30-day badge | Parallel queues, VIP tier, caravans | Builder queue, Lore queue, Renown tier, **Longship voyages** |
| 4 | **Right column**: Events, `VS` + countdown, crown/ranking, Alliance, Mail, Warehouse | Live-ops events, alliance duel, rankings, inbox, inventory | Event hub, **Clan Duel**, Sagas (rankings), Mail, Storehouse |
| 5 | **Research tree** (node graph, branches unlock downward) | Tech tree with prerequisites | **Rune Lore** trees (Economy / War / Seafaring) |
| 6 | **Rewards popup**: "Heal speed-up 5m ×2", "Training speed-up 1m ×12", Wood 1,000 ×86, Food 1,000 ×18 | Speed-up items by category, resource crates | Same item taxonomy (GDD §9) |
| 7 | **Hero card**: 5 stars, Power `487,215`, +Hero Attack, +Hero Defense, +7.5% Ranged troop damage, "joined Hall of Glory" | Hero rarity/stars, stats, troop-type affinity, collection hall | **Heroes** + **Hall of Valhalla** (GDD §6) |
| 8 | **"Canyon Clash"**: alliance vs alliance, matchmaking phase, countdown, Team 1/Team 2, battle log, rules, rewards | Weekly scheduled clan battleground | **Fjord Clash** (GDD §10.2) |
| 9 | **World map**: alliance members' bases with levels 27–31, member names with `[TAG]` | Shared persistent world, alliance clustering | **The Realm** map (GDD §7) |
| 10 | **Alliance Assembly Point** (flag marker) + squad portraits with timers (`8s`, `7s`) | Rally system: leader sets rally, members join before timer ends | **Rally Horn** / Clan muster point |
| 11 | Bottom bar: **Heroes**, chat ticker (multi-language), **World / HQ** toggle | Primary navigation | Same layout, mirrored for RTL |

Also part of the brief (not visible in the clip, but core to the genre):
**King / President** of the server and **ministers** (War, Industry,
Construction…), each granting kingdom-wide or time-slotted buffs. Jarlheim's
version is **The High Seat** (GDD §11).

## 2. The genre's core loops

```
seconds–minutes : collect → queue (build / research / train / heal) → ask clan for help → spend speed-ups
hours           : march to gather / hunt PvE / join rallies → open rewards → hero upgrades
days            : Great-Hall level-up, clan duel daily theme, event tasks
weeks           : battleground (Fjord Clash), throne war → king & ministers, season rewards
```

## 3. Things the genre does that we deliberately **do not** copy

- Real-money purchases, paywalls, loot boxes sold for money. Runes are earned only.
- Aggressive pop-up offers and fake scarcity. This is a portfolio piece, so the
  focus is on systems and craft.
- Any asset, name, logo, character or UI graphic from the reference.
