# Jarlheim — Game Design Document

> Working title: **Jarlheim**. *Build your hold. Forge your clan. Claim the High Seat.*
> Genre: 3D mobile 4X strategy / city-builder (portrait).
> Status: **M0 — pre-production.** All numbers are first-pass and live in data
> tables, so they can be tuned without code changes.

---

## 1. Vision

A free, high-quality 3D strategy game for phones, set in an original Norse world.
You grow a small fjord settlement into a mighty hold, recruit legendary heroes,
join a clan, fight the undead **Draugr**, and race other clans for **the High
Seat**, the throne whose holder rules the whole realm and appoints its ministers.

**Portfolio goals:** show clean game architecture, real-time 3D on mobile, and
data-driven design, all playable from a link with no install.

### Pillars
1. **A living diorama.** The hold looks like a hand-crafted toy world: warm light, snow, smoke from chimneys, boats in the fjord.
2. **Always something to do.** Short sessions (2–5 min) are always rewarding. Timers run while you are away.
3. **Together is stronger.** Clans, help requests, rallies and the throne war are the long-term goal.
4. **Fair.** No real-money purchases. Everything is earned by playing.

## 2. Setting & tone

The Long Winter has broken the old kingdoms. The dead walk the ice as **Draugr**,
and the fjords are free land for anyone brave enough to settle them. Each
**realm** (server) has one **High Seat** at its centre. The clan that holds it
crowns a **King or Queen of the North**.

Tone: heroic and warm, not grimdark. The palette is sunset gold, pine green,
ice blue, and ember red for war.

## 3. Resources & currencies

| Resource | Source | Main use |
|---|---|---|
| **Food** | Farms, Fishing Docks, gathering | Training troops, healing, upgrades |
| **Wood** | Lumber Camps, gathering | Construction (all levels) |
| **Iron** | Iron Mines (unlocks at Great Hall 10), gathering | Higher-tier construction, troops T4+, gear |
| **Silver** | Mint (passive tax), quests, events | Research, hero level-ups, clan donations |
| **Runes** ᚱ | Quests, achievements, events, PvE only (**never sold**) | Premium currency: finishing timers, extra builder slot, hero recruitment |
| **Valor** | Clan activities (help, rallies, duels) | Clan Store |
| **Glory** | Fjord Clash, throne war | Season store |

**Storage & protection:** the **Storehouse** protects part of each resource from
plunder. Anything above the safe amount can be raided.

**Offline production:** buildings produce while you are away, up to **8 h**
(capped, then raised by research). This is computed from timestamps; see
ARCHITECTURE §4.

## 4. The Hold (city)

Grid-based layout on a fjord peninsula. Slots unlock by Great Hall level and by
clearing **snowdrifts / ruins** (a small expansion mechanic). Max level per
building = Great Hall level (Great Hall max **30**).

### 4.1 Building list

| Group | Building | Role |
|---|---|---|
| Core | **Great Hall** | Gates every other building's max level; sets builder slots; raises power |
| Core | **Palisade** | City defence; boosts defending troops |
| Core | **Watchtower** | Scouting; warns of incoming attacks |
| Core | **Storehouse** | Protected resources + inventory |
| Economy | **Farm**, **Fishing Dock** | Food |
| Economy | **Lumber Camp** | Wood |
| Economy | **Iron Mine** | Iron |
| Economy | **Mint** | Silver (passive tax) |
| Economy | **Market** | Send resources to clanmates (taxed) |
| Military | **Shield Hall** | Trains *Huscarls* (infantry) |
| Military | **Stables** | Trains *Riders* (cavalry) |
| Military | **Archery Range** | Trains *Archers* (ranged) |
| Military | **Healer's Lodge** | Wounded troops recover here (capacity) |
| Military | **War Camp** | March slots & march size |
| Military | **Forge** | Hero gear crafting |
| Knowledge | **Seer's Hut** | Rune Lore research |
| Knowledge | **Hall of Valhalla** | Hero collection bonuses ("Hall of Glory") |
| Social | **Clan Hall** | Clan help count & help strength; clan reinforcements capacity |
| Social | **Harbor** | Longship voyages (trade runs other players can raid) |

### 4.2 Construction rules
- **Builders:** 2 at start, a 3rd at Great Hall 5, a 4th at Great Hall 12, plus a **5th** temporary slot bought with Runes (7 days). The video shows `4/5`.
- **Upgrade cost** at level *L*: `cost(L) = base × growth^(L−1)` (growth ≈ 1.32–1.40 per resource).
- **Upgrade time:** `time(L) = t0 × 1.45^(L−1)`, soft-capped by data tables at high levels.
- **Prerequisites:** e.g. Great Hall 8 needs Palisade 7 + Shield Hall 7.
- **Clan help:** each help cuts the remaining time by `max(1%, 60 s)`. The number of helps is set by the Clan Hall level.
- **Free finish:** timers with **≤ 5 min** left can be finished instantly for free (genre convention, good for short sessions).

## 5. Military

### 5.1 Troop types: the counter triangle
```
Huscarls (infantry)  ─beats→  Riders (cavalry)
Riders (cavalry)     ─beats→  Archers (ranged)
Archers (ranged)     ─beats→  Huscarls (infantry)
```
Counter bonus: **+20 % damage** dealt to the countered type.

| Stat | Meaning |
|---|---|
| ATK / DEF / HP | Combat |
| Load | Resources carried home |
| Speed | World-map march speed |
| Power | Contribution to player Power |

Tiers **T1–T10**, unlocked by building level + research. Each tier costs about
1.6× the previous one and is about 1.45× stronger. Upkeep: none in v1, to keep it simple.

### 5.2 Combat resolver (deterministic)
- Up to **10 rounds**. Each round, every stack attacks in priority order: ranged → cavalry → infantry.
- Damage = `ATK × count × modifiers × counter × (1 − DEF/(DEF+K))`.
- Hero skills trigger on rounds or conditions (e.g. "round 3: +25 % archer damage").
- Losses split into **dead / wounded / lightly wounded**. Wounded go to the Healer's Lodge up to its capacity, and the rest die.
- Seeded RNG gives small variance (±5 %) and makes battle **replays** possible.
- Output: a **battle report** (summary + round log) stored in Mail.

## 6. Heroes

- **Rarity:** Rare (blue), Epic (purple), Legendary (gold).
- **Stars:** 0–5 ★, each with 5 sub-steps, raised with **hero shards**.
- **Level:** 1–100, raised with XP tomes + Silver. Capped by Great Hall level.
- **Skills:** 1 *Tactic* (combat, active), 1 *Command* (troop-type passive), 1 *Hold* (economy passive, e.g. +build speed when assigned as governor).
- **Gear:** 4 slots (weapon, armour, helm, charm), crafted at the Forge.
- **Squads:** a march is led by **up to 3 heroes** (raised to 5 later). Heroes give stats to troops of their affinity type.
- **Recruitment:** at the Mead Hall with *Recruit Horns* (earned) or Runes. **Drop rates are shown in the game.**
- **Hall of Valhalla:** each hero at 5★ adds a permanent account-wide bonus, like "joined the Hall of Glory" in the reference.

### Launch roster (original characters)
| Hero | Rarity | Type | Fantasy |
|---|---|---|---|
| **Astrid Ironveil** | Legendary | Infantry | Shieldmaiden. Huge DEF, taunts enemies |
| **Bjorn the Unbroken** | Legendary | Infantry | Berserker. Deals more damage as his troops die |
| **Sigrun Ravenshot** | Legendary | Ranged | Archer. Round-3 volley with +damage |
| **Eirik Stormrider** | Legendary | Cavalry | Raider. Faster marches, first-strike |
| **Ylva the Seer** | Epic | Support | Heals wounded, research-speed governor |
| **Halvard Skald** | Epic | Support | Song buffs squad ATK |
| **Torvald Hammerhand** | Epic | Infantry | Smith. Construction-speed governor |
| **Freydis Wavecaller** | Epic | Cavalry | Longship captain. Voyage bonuses |
| **Kåre Pinewood** | Rare | Ranged | Hunter. Bonus vs Draugr |
| **Runa Frostbraid** | Rare | Cavalry | Scout. Gathering speed |

## 7. The Realm (world map)

- A square-tile 3D map, **~120 × 120** tiles in v1 (bigger later), made of fjords, forests, mountains and ice.
- **Rings of danger:** outer ring (levels 1–10) → middle → inner → **the High Seat** at the centre.
- **Map entities:**
  - Player holds (yours, clanmates, rivals, AI)
  - **Resource nodes** (farmland, forest, iron vein, silver cache): gather with marches
  - **Draugr bands** (PvE levels 1–30): hunt them for loot and hero XP
  - **Frost Giant** (rally boss): needs a clan rally
  - **Strongholds:** capturable forts that give clan-wide buffs and territory
  - **Clan banners:** extend territory, and give gathering + defence bonuses inside it
- **Marches:** travel time = distance / slowest troop speed × modifiers. Order types: Gather, Attack, Scout, Reinforce, **Rally**, Return.
- **Rally (the "Alliance Assembly Point"):** a leader blows the **Rally Horn** on a target and picks a muster time (1 / 5 / 10 / 30 min). Clanmates send troops to the leader, then everyone marches together.
- **Shield:** a peace shield (item or newcomer protection) blocks attacks.

## 8. Rune Lore (research)

Three trees with prerequisite graphs (node → node, like the reference tech tree):
1. **Economy:** production %, build speed, storage, gathering speed.
2. **War:** ATK/DEF/HP per troop type, tier unlocks, healing, march size.
3. **Seafaring:** march speed, longship voyages, offline cap, scouting.

Plus **Clan Lore** (shared tree, funded by member donations of Silver).

Research slots: 1 at start, 2nd unlocked by Seer's Hut level (the reference shows `1/2`).

## 9. Items & rewards taxonomy

| Item | Variants |
|---|---|
| Speed-ups | General, Build, Research, Train, Heal: 1m, 5m, 15m, 1h, 3h, 8h, 24h |
| Resource crates | Food/Wood/Iron/Silver: 1K, 10K, 100K |
| Hero items | Shards (per hero / universal), XP tomes, gear materials |
| Utility | Peace shield 8h/24h, teleport (random/clan), rename, Recruit Horns |
| Boosts | +production 25 % / 8h, +gathering, +march size |

## 10. Clans (alliances)

- **Size:** up to 100 members. Ranks: **R5 Jarl**, **R4 Thanes**, **R3 Huscarls**, **R2 Karls**, **R1 Newcomers**.
- **Features:** help requests, clan gifts (rewards when members complete tasks), Clan Lore, Clan Store (Valor), territory & strongholds, rallies, clan chat, announcements, recruitment settings.

### 10.1 Clan Duel (the reference's "VS")
Each week a clan is matched with a rival clan of similar power. Each day has a theme, and points come from that theme:

| Day | Theme | Points from |
|---|---|---|
| Mon | Gathering | resources gathered |
| Tue | Building | construction power gained |
| Wed | Lore | research power gained |
| Thu | Heroes | hero XP / stars / recruits |
| Fri | Training | troop power trained |
| Sat | Raid | enemy troops defeated |

The clan that wins more days gets the weekly chest. Personal milestones pay out daily too.

### 10.2 Fjord Clash (the reference's "Canyon Clash")
- Weekly battleground of **20 vs 20** clan members, 60 minutes long.
- **Phases:** Signup → Matchmaking (countdown) → Battle → Results.
- Capture and hold shrines on a separate small map. A central relic gives double points. Wounded troops are returned after the match.
- Rewards: Glory + clan chest.

## 11. The High Seat: King & Ministers

The most important long-term goal of each realm.

- **Throne War:** every **2 weeks** (configurable) the High Seat opens for a 6-hour contest. Clans attack the fortress at the centre, and the clan holding it at the end wins. The winning clan's **Jarl is crowned King/Queen of the North**.
- **King's powers:** appoint ministers, give out the realm's **Royal Gifts**, set the realm announcement, and give **titles of shame** to rivals.

### 11.1 Ministers (buff positions)
The King appoints ministers. Any player in the realm can **request a minister's
blessing**, which puts them in a time-slot queue (e.g. 5 min each). While their
slot is active they get the buff.

| Position | Arabic | Buff to blessed player |
|---|---|---|
| **Marshal of War** | وزير الحرب | +10 % troop training speed, +5 % troop ATK |
| **Master of Industry** | وزير الصناعة | +25 % resource production, +10 % gathering speed |
| **Master of Works** | وزير البناء | +10 % construction speed |
| **Lorekeeper** | وزير العلوم | +10 % research speed |
| **Steward of the Realm** | وزير الداخلية | +10 % healing speed, +5 % march speed |

### 11.2 Titles of shame (debuffs, King-assigned, 1 per target per war)
| Title | Effect |
|---|---|
| **Oathbreaker** | −10 % troop ATK |
| **Coward** | −10 % march speed |
| **Beggar** | −20 % gathering speed |

In **v1 (single-player + AI realm)** the King may be you or an AI clan's Jarl.
AI kings appoint ministers and answer blessing requests based on their
relationship with you (friendly / neutral / hostile).

## 12. Progression & Power

- **Power** = building power + research power + troop power + hero power. It is shown everywhere and used for matchmaking.
- **Great Hall** milestones gate content: GH5 world map unlocks, GH8 clans, GH10 Iron, GH12 4th builder, GH15 rallies lead, GH17 Fjord Clash, GH20 throne war participation, GH25–30 top tiers.
- **Renown tiers** (the reference's VIP): earned with daily login and quests, never bought. They give small QoL bonuses such as free-finish time and an extra queue.

## 13. Live-ops / events (data-driven)
Daily quests, a 7-day newcomer journey, Clan Duel, Fjord Clash, Draugr Hunt (weekend), Frost Giant (clan boss), Throne War. Every event is defined as **data**: schedule, scoring rules, reward tables. No code changes are needed to add a new event of an existing type.

## 14. UX & HUD (portrait, 9:19.5)

Same layout grammar as the reference. **It mirrors automatically for Arabic (RTL).**

```
┌─────────────────────────────────────────┐
│ [avatar] ⚔Power   🍞 🪵 ⛓ 🪙   ᚱRunes [+] │  top bar
│ [Renown]                       [Events]  │
│ [Builders 2/3]                 [Duel VS] │
│ [Lore 1/1]                     [Sagas]   │  side columns
│ [Voyages]                      [Clan]    │
│ [Quests]                       [Mail]    │
│            ~~~ 3D HOLD ~~~              │
│ [chat ticker ...............]            │
│ [Heroes]     [Bag]      [Realm ⇄ Hold]   │  bottom bar
└─────────────────────────────────────────┘
```

- **One-tap interactions:** tap a building to see a radial menu (Upgrade / Info / Speed-up / Help).
- Floating timers and badges above buildings, like the reference.
- Every number is formatted for its locale (`69.2M`, `٦٩٫٢ م` optional), and large values are abbreviated.
- Haptics on collect and complete (Capacitor).

## 15. Art direction
- **Style:** stylized low-poly "toy diorama" with soft PBR, mostly vertex colours plus a small texture atlas.
- **Light:** one warm directional sun with a soft shadow map, a hemisphere fill, a light fog for depth, and snow sparkle.
- **Life:** chimney smoke (GPU particles), a water shader in the fjord, villagers walking on paths (instanced), flags in the wind.
- **Sources:** CC0 kits (KayKit, Kenney, Quaternius, Poly Pizza CC0) plus our own models made in Blender. Every asset is listed in `assets/CREDITS.md` with its licence. See DECISIONS D-007.

## 16. Audio
CC0 / CC-BY music and SFX (each licence checked and credited). Separate volume sliders for music, SFX and ambience. A Nordic ambient theme with drums for war.

## 17. Out of scope for v1
Real-money purchases, real multiplayer (planned for M10), iOS store release
(needs a Mac and a paid Apple account), voice chat.
