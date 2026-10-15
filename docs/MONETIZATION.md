# Monetization Plan — "if Jarlheim succeeds, people can pay for Gold"

> **Today: the game is 100 % free, with no payments at all.** This document is the
> plan for **later**. It is written now so the economy is designed with a store
> in mind, which keeps us from a painful redesign once the game succeeds.
> Rules, fees and laws change, so verify everything below with Google/Apple and a
> lawyer before launching any payment.

## 1. When we turn payments on (stage gates)
Payments come only after **all** of these are true:
1. **Online server is live (M10).** Paid currency must live on a server, never only on the phone, or anyone could edit their save and give themselves Gold. The server owns the wallet and validates every store receipt.
2. **The game is fun for free.** First targets (to tune with real data): Day-1 retention ≥ 35 %, Day-7 ≥ 12 %, a stable daily-active-user base.
3. **The legal checklist (§6) is done.**

## 2. The premium currency: Gold
- Gold already exists in v1 and is **earned free** from daily hunts, quests, achievements and the Thing.
- Later it can also be **bought**. Bought Gold and earned Gold are the same currency, so free players are never locked out of anything.
- Gold sinks: finishing timers, hero recruitment, the 5th builder, cosmetics, extra Hólmganga duels, rename and relocation.

## 3. What we would sell (in priority order)
| Product | What it is | Why |
|---|---|---|
| **Jarl's Pass** (season pass) | A free track plus a paid track of rewards for each 4-week season | The best value for players, and the most common product in successful games |
| **Ring of Plenty** (monthly card) | Pay once and get Gold every day for 30 days | Cheap, and rewards logging in daily |
| **Gold packs** | 5–6 price tiers, with a first-purchase double bonus | Simple and expected by players |
| **Cosmetics** | Hall skins, dragon-ship sails, clan banners, hero outfits, runestone styles | Pure style, no power advantage. The fairest kind of product |
| **Starter pack** | A one-time, low-price bundle | Turns a player into a first-time buyer |
| **Growth Fund** | Pay once, then get Gold at each Great Hall milestone | Rewards long-term players |
| **Rewarded ads** (optional) | Watch an ad to get a small speed-up, with a daily cap | Earns money from players who never pay |

## 4. Fairness rules (our promises)
- Everything that affects power can also be **earned by playing**. Paying makes it faster; nothing is pay-only.
- **Recruitment odds are always published**, with a pity counter. Paid random recruitment is disabled in countries that ban it (§6).
- No fake countdowns, no "only 1 left" lies, and no pop-up spam (at most one offer per session).
- Spending limits and parental controls for minors, following the store age rating.

## 5. Technical plan
| Piece | Plan |
|---|---|
| Purchases on Android | **Google Play Billing**, through a Capacitor in-app-purchase plugin |
| Purchases on iOS | **Apple In-App Purchase** (when an iOS build exists) |
| Purchases on the web build | Not at first. Possibly a web store later |
| Wallet | A server-side ledger: every Gold change is recorded with a reason (purchase / reward / spend). The client only shows it |
| Receipt validation | The server verifies each receipt with Google/Apple before adding Gold. It handles refunds by removing the Gold |
| Anti-fraud | Rate limits, duplicate-receipt checks, alerts on unusual activity |
| Analytics | Retention (D1/D7/D30), conversion %, average revenue per daily user, LTV. Privacy-respecting and opt-in where the law requires it |

## 6. Legal & store checklist (verify before launch)
- **Store fees:** Google and Apple each have a reduced commission (about 15 %) for small developers below a yearly revenue threshold. Check the current terms.
- **Store rules:** digital goods inside apps must use the store's own billing system. Random rewards (loot boxes) must show their odds.
- **Loot-box laws:** some countries (for example Belgium) restrict paid random rewards. Disable paid recruitment there and sell direct hero bundles instead.
- **Consumer law:** EU rules on digital content (withdrawal rights), clear prices, and taxes (stores usually collect VAT).
- **Privacy:** GDPR / local privacy laws, a privacy policy, and a data-deletion request flow.
- **Age rating:** IARC questionnaire on Google Play. Answer honestly about in-app purchases and random items.
- **Company & payout:** a developer account in your name or your company's, a bank account, and a tax form for store payouts.

## 7. Roadmap fit
- **M2–M9:** Gold is earn-only. Gold sinks and reward tables are tuned so a store can be added later without breaking the balance.
- **M10:** server wallet + authoritative economy.
- **M11 (new):** store, Jarl's Pass and cosmetics, behind a feature flag, tested with a small region first.
