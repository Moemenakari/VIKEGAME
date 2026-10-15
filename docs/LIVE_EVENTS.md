# Live Events — something to hunt every day

Every event is **data**: a schedule, scoring rules, and reward tables in
`packages/sim/src/data/events/`. Adding a new event of an existing type needs no new code.
All events can be played for free, and all of them give **Gold** as a reward.

## 1. Weekly hunt calendar

| Day | Event | Source | How it plays | Top rewards |
|---|---|---|---|---|
| **Mon** | **Thor's Fishing** | *Hymiskviða*, *Gylfaginning*; the *hafgufa* from *Konungs skuggsjá* | **Solo:** a quick fishing mini-game. Bait your line, then tap and hold against the pull to land **giant fish** (cod → halibut → hafgufa). **Clan:** together, haul up **Jörmungandr, the World Serpent**, using an ox-head bait; every member's catch adds to the pull bar | Food, Gold, Thor's hammer pendant (cosmetic) |
| **Tue** | **Dragon Hunt: Fáfnir** | *Völsunga saga* | World boss in a cave on the map. **Rally** it with your clan. Damage dealt fills your share of the **dragon's hoard**. Sigurd Fáfnisbane deals +50 % damage | Gold, hero shards, cursed-ring cosmetic |
| **Wed** | **Draugr Night** | *Grettis saga*, *Eyrbyggja saga* | Tower defence at your own hold: waves of draugr rise from the barrows at night. Place heroes on the Ring Fort; **Glámr** is the final wave. Grettir +40 % | Silver, speed-ups, Gold |
| **Thu** | **Wolf Hunt: Sköll & Hati** | *Gylfaginning*, *Grímnismál* | The wolves that chase the sun and moon come down to Midgard. Hunt wolf packs on the map. If the server kills enough, **everyone gets a "Sun Saved" production buff** for 24 h | Timber, Iron, server buff |
| **Fri** | **Giant Siege** | *Prose Edda* (frost giants) | **Frost giants** march on the clan's ring forts. Defend with reinforcements, then counter-rally the **Jötunn King** | Iron, Gold, clan gifts |
| **Sat** | **Hólmganga** | Saga duels on an island | 1 v 1 hero-squad duels in a small ring, with automatic matchmaking by power. 5 free duels a day | Fame, Gold, hero XP |
| **Sun** | **Hnefatafl & the Feast** | Viking board game, *veizla* | A relaxed day: Hnefatafl puzzles, then a clan feast where everyone who joins gets a buff. Weekly results are shown | Silver, Saga Horns |

Every day also has: **daily quests** (5 quick tasks), the **daily Hnefatafl puzzle**,
and the **Clan Duel** theme (GDD §16).

## 2. Weekly and monthly events
| Event | Frequency | Summary |
|---|---|---|
| **Fjord Clash** | Weekly | 20 v 20 clan battleground, 60 min |
| **Clan Duel** | Weekly (Mon–Sat) | Matched clan rivalry with daily themes |
| **Silver Road Rush** | Every 2 weeks | Double voyage rewards, and heavier raiding on the routes |
| **Ragnarök** | Monthly, weekend | The whole server faces **all the monsters at once**: Fenrir, Jörmungandr and Surtr's fire giants. Server-wide progress bar with 3 reward tiers. The biggest Gold payout of the month |

## 3. Seasonal festivals (from the Norse calendar)
| Festival | When | Event |
|---|---|---|
| **Winter Nights** (*Vetrnætr*) | Start of each Winter week | The season turns. Draugr grow stronger, and a harvest-feast bonus applies |
| **Yule** (*Jól*) | 12 days, around late December | Daily Yule gifts, Yule-goat hunt, special hall decorations |
| **Midsummer Thing** | End of each 4-week season | Seizing the Law Rock → the King is crowned → royal offices (GDD §10) |
| **Dísablót** | Late winter | Shieldmaiden heroes get bonus recruitment rates (odds shown) |

## 4. Newcomer journey (first 7 days)
Day 1 *Landnám* (pillars + fire loop) → Day 2 first draugr barrow → Day 3 join a clan →
Day 4 first ship → Day 5 first rally (Fáfnir's hatchling) → Day 6 first Silver Road voyage →
Day 7 raise your first runestone. Each day gives a guaranteed hero or Gold.

## 5. Build order
Events are built in this order, matching ROADMAP milestones: daily quests (M2) → **Draugr Barrows** PvE
(M3: ten levels of draugr bands beside your hold, the first battles) → Draugr Night (tower defence, M7) →
Thor's Fishing solo (M4) → Wolf Hunt & Fáfnir rally (M6/M7) → Giant Siege, Hólmganga, Clan Duel (M7) →
Midsummer Thing (M8) → Ragnarök & festivals (M9).
