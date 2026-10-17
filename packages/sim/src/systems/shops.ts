import { SHOPS, STAMINA, type ShopId } from '../data/shops';
import type { GameEvent } from '../events';
import { dayIndex, type GameState } from '../state';
import { addItems } from './items';

/** Stamina comes back one point at a time, up to the cap (items can push it above). */
export function regenStamina(state: GameState, now: number): void {
  const w = state.wallet;
  if (w.stamina >= STAMINA.max) {
    w.staminaAt = now;
    return;
  }
  const points = Math.floor((now - w.staminaAt) / STAMINA.regenMs);
  if (points <= 0) return;
  w.stamina = Math.min(STAMINA.max, w.stamina + points);
  w.staminaAt = w.stamina >= STAMINA.max ? now : w.staminaAt + points * STAMINA.regenMs;
}

/** What you hold of a shop's currency. */
export function balance(state: GameState, shop: ShopId): number {
  switch (SHOPS[shop].currency) {
    case 'gold':
      return state.resources.gold;
    case 'silver':
      return state.resources.silver;
    case 'alliance':
      return state.wallet.alliance;
    case 'medals':
      return state.wallet.medals;
  }
}

/** Bought today, so far. */
export function boughtToday(state: GameState, offerId: string, now: number): number {
  return state.shop.day === dayIndex(now) ? (state.shop.bought[offerId] ?? 0) : 0;
}

/** Buys `count` of an offer. Returns an error message, or null. */
export function buy(
  state: GameState,
  shop: ShopId,
  offerId: string,
  count: number,
  now: number,
  events: GameEvent[],
): string | null {
  const def = SHOPS[shop];
  const offer = def?.offers.find((o) => o.id === offerId);
  if (!offer) return 'No such offer';
  if (!Number.isInteger(count) || count < 1) return 'Choose how many to buy';
  if (state.shop.day !== dayIndex(now)) state.shop = { day: dayIndex(now), bought: {} };
  if ((state.shop.bought[offerId] ?? 0) + count > offer.limit) return 'Sold out for today';
  const price = offer.price * count;
  if (balance(state, shop) < price) return 'Not enough to pay';
  switch (def.currency) {
    case 'gold':
      state.resources.gold -= price;
      break;
    case 'silver':
      state.resources.silver -= price;
      break;
    case 'alliance':
      state.wallet.alliance -= price;
      break;
    case 'medals':
      state.wallet.medals -= price;
      break;
  }
  state.shop.bought[offerId] = (state.shop.bought[offerId] ?? 0) + count;
  addItems(state, { [offer.item]: offer.count * count });
  events.push({ type: 'shop.bought', shop, item: offer.item, count: offer.count * count });
  return null;
}
