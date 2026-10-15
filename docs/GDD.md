# Jarlheim — Game Design Document (v2)

> *"Cattle die, kinsmen die, the self dies the same; but fame never dies for the one who earns it."*
> — paraphrase of *Hávamál* 76–77
>
> **Genre:** 3D mobile 4X strategy / city-builder (portrait), free to play.
> **World:** the real Viking Age (c. 793–1066) as the sagas tell it, history and legend side by side.
> Every historical element is sourced in [HISTORY_BIBLE.md](HISTORY_BIBLE.md).
> Numbers are first-pass and live in data tables.

---

## 1. Vision & pillars

You are a settler who has just arrived on a wild shore. You grow a farmstead into a
jarl's hold, recruit saga heroes, sail the Silver Road from Dublin to Baghdad,
hunt dragons and sea serpents, and ride to the **Midsummer Thing**. There the
clan that holds the **Law Rock** crowns its jarl **King of the North**.

1. **Easy to play.** One thumb, ≤ 3 taps to any action, auto-collect, a 5-minute tutorial. You never need a spreadsheet.
2. **Free.** Free to download, free to finish. Everything is earnable by playing (see MONETIZATION.md for the future store).
3. **A living saga.** Real history, real names, real laws, turned into game mechanics. Players learn something by playing.
4. **Something every day.** A new monster hunt every day of the week (LIVE_EVENTS.md).
5. **Together is stronger.** Clans, feasts, feuds, rallies and the Thing are the long-term goal.

## 2. How a game starts: *Landnám* (land-taking)
Source: *Landnámabók*.

1. **The pillars.** Your ship reaches the coast. You throw your **high-seat pillars** overboard, and the waves carry them to one of three shores (fjord, plain, forest), each with a small production bonus. Your hold is founded where they land. This is a one-tap, cinematic spawn choice.
2. **Carrying the fire.** Territory expands the historical way: you **circle land carrying fire within one day**. In the game you drag a loop with your finger around nearby tiles. The loop must be finished before a timer runs out, and the timer grows with research. The land inside becomes yours: more building plots and resource tiles. It is easy to learn, and there is nothing else like it in the genre.

## 3. Currencies & resources (kept to 4 + 2)

| Resource | Historical flavour | Produced by | Used for |
|---|---|---|---|
| **Food** | Barley & stockfish | Farmstead, Fish Racks | Troops, healing, feasts |
| **Timber** | Oak & pine | Woodcutter's Camp | All building, ships |
| **Iron** | **Bog iron** smelted from bog ore | Bog-iron Smelter (unlocks at Hall 8) | Weapons, high-level buildings, ship rivets |
| **Silver** | **Hacksilver** valued by weight, Arab dirhams | Market tax, Silver Road voyages, raids | Research, heroes, clan gifts |
| **Gold** ★ premium | Gold **arm-rings**: the lord is "the ring-giver" | Free from events, quests and achievements. **Later also sold** (MONETIZATION.md) | Finish timers, hero recruitment, cosmetics, 5th builder |
| **Fame** (*orðstírr*) | What a Viking lived for | Victories, feasts, runestones, events | Season ranking, Thing votes, titles |

**Items:** speed-ups (general / build / rune / train / heal, from 1 min to 24 h), resource crates, hero shards and XP, Saga Horns, peace shields, relocation.

Auto-collect: production flows straight into storage (no tapping a hundred icons).
Offline production is capped at 8 h at first, raised by research.

## 4. The Hold

Grid layout on the peninsula you claimed. Every building's max level = Great Hall level (max **30**).

| Building | Old Norse | Role |
|---|---|---|
| **Great Hall** | *skáli* | HQ. The **High Seat** inside sets everything's cap. Hosts **Feasts** (§9.2) |
| **Ring Fort** | Trelleborg-style | Wall. Defence bonus |
| **Beacon Cairn** | *viti* | Watchtower. Warns of incoming attacks (Hákon the Good's beacon chain) |
| **Storehouse** | *útibúr* | Protects resources from raids |
| **Farmstead** / **Fish Racks** | *bær* / *hjallr* | Food |
| **Woodcutter's Camp** | | Timber |
| **Bog-iron Smelter** | | Iron |
| **Market** | *kaupangr* | Silver tax. Send resources to clanmates |
| **Shield Yard** | | Trains **Shieldwall** troops |
| **Bowyer's Range** | | Trains **Archers** (yew bows) |
| **Wolf-skin Lodge** | *úlfheðnar* | Trains **Berserkers** |
| **Boathouse & Shipyard** | *naust* | Builds **ships** (§5.2) |
| **Weaving House** | *dyngja* | Woollen sails: speeds up the Shipyard |
| **Smithy** | | Hero gear |
| **Healer's House** | | Wounded troops recover here |
| **Rune Carver's Hut** | | Research (§7) |
| **Skald's Hearth** | | Recruit heroes by hearing their sagas (§6) |
| **Runestone Field** | | Achievements carved in stone, each a permanent bonus (§9.4) |
| **Thing Mound** | *þing* | Clan centre: helps, clan law, votes |

**Builders:** 2 → 3 (Hall 5) → 4 (Hall 12) → +1 temporary (Gold, 7 days).
**Costs:** `base × growth^(L−1)`. **Times:** `t0 × 1.45^(L−1)`. Finishing is free with ≤ 5 min left. Each clan help takes `max(1 %, 60 s)` off a timer.

## 5. War

### 5.1 Land troops: the historical triangle
The Vikings fought on foot. Horses carried them to battle, but they did not fight
from horseback. So instead of the genre's "cavalry", our triangle is:

```
   SHIELDWALL (skjaldborg)  ──breaks──▶  BERSERKERS     (a wild charge shatters on locked shields)
   BERSERKERS (úlfheðnar)   ──breaks──▶  ARCHERS        (they run the archers down)
   ARCHERS (yew bows)       ──breaks──▶  SHIELDWALL     (arrows wear down the slow wall from range)
```
+20 % damage against the countered type. Tiers T1–T10, from the **Bóndi levy**
(free farmer with spear and shield) up to **Hirð champions**.

### 5.2 Ships: a second layer of strategy
From the Skuldelev wrecks and the sagas:

| Ship | Role |
|---|---|
| **Snekkja** | Fast raider. Small crew, quick sea marches |
| **Skeið** | Big warship. Large crew, sea combat bonus |
| **Knarr** | Cargo ship for Silver Road voyages, carries the most |
| **Drakkar** (dragon-ship) | Flagship. Rally leaders only. +morale aura, like Olaf's *Long Serpent* |

On the world map, **sea routes are faster than land routes** when you own
ships. Pathing picks the best route automatically, so it stays easy.

### 5.3 Combat resolver
Deterministic, up to 10 rounds, in the order archers → berserkers → shieldwall.
Hero skills trigger by round. Losses split into dead / wounded / lightly wounded,
and the Healer's House saves the wounded. A seeded RNG (±5 %) makes **battle replays** possible.
The report reads like a **saga**: an auto-generated short story of the battle,
written in saga style alongside the numbers ("Then Astrid's shieldwall held, and the berserkers broke upon it…").

## 6. Heroes: real saga figures
Historical and legendary people from the sagas and chronicles, all long in the
public domain. Rarity Rare / Epic / Legendary, 0–5 ★, level 1–100, 3 skills, 4 gear slots, **squads of 3**.
Recruit at the **Skald's Hearth** with *Saga Horns* (earned) or Gold. **Odds are always shown**, with a pity counter.

| Hero | Rarity | Troop | Signature skill | Source |
|---|---|---|---|---|
| **Lagertha** | Legendary | Shieldwall | *Shield-maiden's Stand*: the wall takes −30 % damage for 2 rounds | Gesta Danorum IX |
| **Harald Hardrada** | Legendary | Shieldwall | *Varangian Oath*: rally leader, +march size | Heimskringla |
| **Egil Skallagrímsson** | Legendary | Berserker | *Níðstang*: curses the enemy squad, −ATK | Egils saga |
| **Hervor** | Legendary | Berserker | *Tyrfing*: huge damage, but each strike costs her own HP | Hervarar saga |
| **Einar Thambarskelfir** | Legendary | Archer | *The Bow That Broke*: a single devastating shot in round 3 | Heimskringla (Svolder) |
| **Sigurd Fáfnisbane** | Legendary | Berserker | *Dragon-slayer*: +50 % damage vs **dragons** | Völsunga saga |
| **Grettir the Strong** | Epic | Shieldwall | *Bane of Glámr*: +40 % damage vs **draugr** | Grettis saga |
| **Olaf Tryggvason** | Epic | Ships | *Long Serpent*: +sea combat for the flagship | Heimskringla |
| **Freydís Eiríksdóttir** | Epic | Berserker | *Fearless*: more damage when her squad is losing | Vínland sagas |
| **Leif Erikson** | Epic | Archer | *Far-sailer*: +voyage speed, finds new lands | Saga of the Greenlanders |
| **Aud the Deep-Minded** | Epic | Governor | *Land-taker*: +production, bigger fire-carry loop | Landnámabók, Laxdæla |
| **Gunnhild, Mother of Kings** | Epic | Support | *Seiðr*: slows enemy healing | Heimskringla, Egils saga |
| **Ahmad ibn Faḍlān** | Rare (special) | Support | *Chronicler of the Rūs*: +research speed, reveals enemy squads when scouting | Risāla (922) |
| **Thorfinn Karlsefni** | Rare | Archer | *Vínland Settler*: +gathering in far lands | Erik the Red's saga |
| **Bóndi Ketil** (original) | Rare | Shieldwall | Starter hero, a farmer-soldier who grows with you | — |

**Portrait style:** illustrated, historically dressed (no horned helmets), stylised to match the diorama.

## 7. Research: the 16 runes
Research is built on the **16 runes of the Younger Futhark**. Each rune is a small tree
themed on its traditional meaning from the rune poems. You carve runes at the Rune Carver's Hut.

| Rune | Meaning | Tree |
|---|---|---|
| ᚠ **fé** | wealth | Silver & market |
| ᚢ **úr** | slag / iron ("slag comes from bad iron") | Iron & smithing |
| ᚦ **þurs** | giant | PvE: giants & monsters |
| ᚬ **áss** | god / mouth (poetry) | Skalds, fame, heroes |
| ᚱ **reið** | ride / journey | March speed |
| ᚴ **kaun** | sore / wound | Healing |
| ᚼ **hagall** | hail | Siege & wall-breaking |
| ᚾ **nauðr** | need | Defence when outnumbered |
| ᛁ **íss** | ice | Winter season bonuses |
| ᛅ **ár** | good year / harvest | Food |
| ᛋ **sól** | sun | Summer season bonuses, build speed |
| ᛏ **Týr** | the war god | Troop attack |
| ᛒ **björk** | birch (growth) | Construction |
| ᛘ **maðr** | man | Troop HP & capacity |
| ᛚ **lögr** | water / sea | Ships & sea routes |
| ᛦ **ýr** | yew (bows) | Archers |

## 8. The world map: Midgard
A stylised map of the real Viking world, compressed so all of it fits in one realm (~120 × 120 tiles in v1):

```
          Grænland      Ísland                 Norðrvegr (Norway)     Garðaríki (Rus)
 Vínland ·····························  [ LÖGBERG — Law Rock ]  ····· (river route) ····· Miklagarðr
          Írland/Dyflin   Orkneyjar        Danmörk / Hedeby                         ···· Serkland
```
- **Danger rises toward the centre.** The **Lögberg** island in the middle is the throne objective.
- **Map content:** player holds, resource tiles, **draugr barrows**, troll caves, **ring forts** (clan-capturable strongholds, Trelleborg design), trading towns (Hedeby, Birka, Dyflin, Miklagarðr) and the sea.
- **Marches:** gather, attack, scout, reinforce, **rally**. Sea or land routing is automatic.
- **Rally = the War Horn.** The leader sounds the horn and sets a 1, 5, 10 or 30-minute timer. Clanmates join, then everyone sails together.

## 9. Society: clans, feuds, feasts

### 9.1 Clans (*félag*, sworn brotherhoods like the Jomsvikings)
Up to 100 members. Ranks: **Jarl (R5) · Hersir (R4) · Húskarl (R3) · Karl (R2) · Newcomer (R1)**.
Each clan writes up to **3 "Jomsviking laws"**, chosen from a list (e.g. "no attacking members' friends", "must join 1 rally a day"). These are shown to applicants, and members who keep them get a small bonus.
Features: help, ring-gifts, clan research, territory, ring forts, rallies, chat.

### 9.2 Feasts (*veizla*) and ring-giving
A Jarl or player hosts a **Feast** in the Great Hall by spending Food. Guests who
join (tap the invite) get a buff for 1 h. The host gains **Fame**, and a **skald**
NPC composes a 2-line verse about the host, shareable as an image. Clan gifts
are framed as the Jarl **giving rings**.

### 9.3 Feud & wergild (*Njáls saga*, *Grágás*)
- If someone attacks you, you get a **Feud** on them for 24 h: +10 % damage against them, and revenge earns double Fame.
- The attacker can end the feud by paying **wergild** (Silver) to the victim. Both gain a little Fame for honour.
- Clan Jarls can settle feuds between clans at the Thing Mound. This makes PvP less toxic: you can pay to end a feud.

### 9.4 Runestones (achievements)
Big deeds are carved on runestones in your **Runestone Field**: "**[YourName] raised this stone to mark the victory over Fáfnir**." Your player name is **transliterated into real Younger Futhark runes**. Each stone gives a permanent account bonus, and you can share the image.

### 9.5 Níðstang (curse pole)
A rare item (from Egil's saga). Raise it on a rival's border: −5 % production and morale for them for 8 h.
Limited to 1 per day, and the target can burn it down by sending troops.

## 10. The Midsummer Thing: King & royal offices
The Althing met every **midsummer** at the **Law Rock**. Our server season (4 weeks) ends with it.

1. **Seizing the Law Rock (6 h):** clans fight to hold the Lögberg island. The clan holding it at the end wins.
2. **Acclamation:** the winning clan's Jarl is acclaimed **King (or Queen) of the North** until the next Thing.
3. **The King appoints the royal offices.** These are real offices from Heimskringla and the Icelandic laws. Any player can **request the office's blessing** and get a timed buff from a queue:

| Office (game name) | Historical role | Blessing |
|---|---|---|
| **Stallari** — Marshal of War | The king's marshal | +10 % training speed, +5 % troop ATK |
| **Ármaðr** — Royal Steward (Industry) | Managed the king's estates | +25 % production, +10 % gathering |
| **Stafnasmiðr** — Master Shipwright (Construction) | Builder of the *Long Serpent* | +10 % build speed, +15 % ship building |
| **Lögsögumaðr** — Lawspeaker (Knowledge) | Recited the law at the Law Rock | +10 % research speed |
| **Hirðskáld** — Court Skald | Poet of the king's retinue | +20 % Fame gained |
| **Merkismaðr** — Standard-bearer | Carried the king's banner | +5 % march speed, +5 % rally size |

4. **Punishments** (the King can give each one to a limited number of players, for the next 3 days):

| Sentence | Historical meaning | Effect |
|---|---|---|
| **Níðingr** | The worst insult: a man without honour | −10 % troop ATK |
| **Lesser Outlawry** (*fjörbaugsgarðr*) | 3-year exile in the old law | −10 % march speed, cannot join rallies |
| **Full Outlawry** (*skógarmaðr*) | Outside the law | Peace shield disabled. Only for players who broke a server rule voted by the Thing |

## 11. Seasons: summer raiding, winter halls
The Norse year had two halves. The realm alternates **Summer week ↔ Winter week**:
- **Summer** (raiding season): sea routes open everywhere, +march speed, the Silver Road pays more.
- **Winter** (hall season): northern seas freeze (land routes only), +build and research speed, **draugr grow stronger at night**, feasts give double buffs.
Festivals: **Winter Nights** (season turn), **Yule** (12-day event), **Midsummer Thing** (King). See LIVE_EVENTS.md.

## 12. The Silver Road (trade voyages)
The genre's truck runs become **knarr voyages** along real routes: Dyflin, Hedeby,
Birka, Garðaríki, Miklagarðr and **Serkland** (Arab lands, the source of the
dirhams in Norse hoards). Longer voyages pay more and carry more risk: other
players can **raid** them, and you can assign clanmates as escorts.

## 13. Daily events & monster hunts
**Something new to kill every day.** Full calendar in [LIVE_EVENTS.md](LIVE_EVENTS.md). In short:
Mon **Thor's Fishing** (giant fish & the sea serpent) · Tue **Dragon Hunt** (Fáfnir) · Wed **Draugr Night** ·
Thu **Wolf Hunt** (Sköll & Hati) · Fri **Giant Siege** (frost giants) · Sat **Hólmganga** (duels) · Sun **Hnefatafl & Feast**.

## 14. Mini-game: Hnefatafl
The Vikings' real board game (the king escapes to a corner while the attackers try to
capture him). A daily puzzle gives a small reward, and you can challenge clanmates.
It is cheap to build (2D board in the UI) and shows real culture.

## 15. Progression & Power
**Power** = buildings + research + troops + heroes (strength, used for matchmaking).
**Fame** = season prestige (ranking, Thing). **Hall milestones:** Hall 5 world map, 7 clans, 8 iron, 10 ships, 12 4th builder, 15 lead rallies, 17 Fjord Clash, 20 the Thing, 25–30 top tiers.
**Hirð rank** (the genre's VIP): earned with daily logins and quests. Gives QoL perks (longer free-finish, an extra queue).

## 16. Clan competitions
- **Clan Duel (VS)**, weekly matched rival with a daily theme: Mon Gathering · Tue Building · Wed Runes · Thu Heroes · Fri Training · Sat Raiding.
- **Fjord Clash**, weekly 20 v 20 battleground (60 min): hold shrines and the central relic.

## 17. UX / HUD (portrait)
```
┌─────────────────────────────────────────┐
│ [avatar] ⚔Power  🍞 🪵 ⛓ ⚖Silver   ●Gold [+]│
│ [Hirð]                      [Today's Hunt]│
│ [Builders 2/3]                [Duel VS]   │
│ [Runes 1/1]                   [Sagas]     │
│ [Voyages]                     [Clan]      │
│ [Quests]                      [Mail]      │
│            ~~~ 3D HOLD ~~~                │
│ [chat ...................]                │
│ [Heroes]     [Bag]      [Midgard ⇄ Hold]  │
└─────────────────────────────────────────┘
```
English UI. Tap a building for a radial menu (Upgrade / Info / Speed-up / Help). Recommended next actions glow.

## 18. Art & audio
- **Style:** stylised low-poly "living diorama", historically grounded: turf-roofed longhouses, Oseberg-style carved prows, Gjermundbu helmets, Jelling-style runestones, Urnes-style knotwork on UI frames.
- **Life:** hearth smoke, the auroras of winter, waves, flags, villagers, sheep.
- **Assets:** CC0 kits (KayKit, Kenney, Quaternius, Poly Pizza CC0) plus our own Blender models. Each one is listed in `assets/CREDITS.md`.
- **Audio:** CC0 ambience, drums and horn calls for war, lyre and tagelharpa-style themes.

## 19. Out of scope for v1
Real payments (planned, see MONETIZATION.md), real-time multiplayer (M10), iOS store, voice chat.
