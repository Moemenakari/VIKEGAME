import { SHOPS, STAMINA, balance, boughtToday, itemDef, type GameState, type ShopId } from '@jarlheim/sim';
import type { GameStore } from '../game/store';
import { formatAmount } from './format';
import { t } from './i18n';
import { ResourceIcon } from './icons';
import { itemName } from './ProfilePage';

const TABS: ShopId[] = ['gold', 'alliance', 'vs', 'energy'];
const TAB_ICON: Record<ShopId, string> = { gold: '🪙', alliance: '⚑', vs: '🏅', energy: '⚡' };
const ITEM_ICON: Record<string, string> = {
  speedup: '⏳',
  chest: '📦',
  heroXp: '📜',
  starShard: '✴',
  teleport: '🌀',
  stamina: '⚡',
};

/** What a shop's currency looks like. */
export function CurrencyIcon({ shop, size = 16 }: { shop: ShopId; size?: number }) {
  const c = SHOPS[shop].currency;
  if (c === 'gold') return <ResourceIcon res="gold" size={size} />;
  if (c === 'silver') return <ResourceIcon res="silver" size={size} />;
  return <span style={{ fontSize: size }}>{c === 'alliance' ? '⚑' : '🏅'}</span>;
}

/**
 * The shops (owner request): Gold, Alliance, VS and Energy. Each says how its currency
 * is earned; every offer has a daily limit. Bought items go to the Bag.
 */
export function ShopPanel({
  store,
  state,
  tab,
  setTab,
  onClose,
  onError,
}: {
  store: GameStore;
  state: GameState;
  tab: ShopId;
  setTab: (s: ShopId) => void;
  onClose: () => void;
  onError: (m: string) => void;
}) {
  const now = store.now();
  const have = balance(state, tab);
  return (
    <section className="card panel shop" data-testid="shop" role="dialog" aria-label={t('shop')}>
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      <h2>🏪 {t('shop')}</h2>
      <div className="tabs" role="tablist">
        {TABS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? 'active' : ''}
            onClick={() => setTab(k)}
            data-testid={`shop-tab-${k}`}
          >
            {TAB_ICON[k]} {t(`shop_${k}`)}
          </button>
        ))}
      </div>
      <p className="shop-balance">
        <CurrencyIcon shop={tab} size={18} /> <b>{formatAmount(have)}</b>
        {tab === 'energy' && (
          <span className="muted">
            {' '}
            · ⚡ {state.wallet.stamina}/{STAMINA.max}
          </span>
        )}
      </p>
      <p className="muted">{t(`shopHow_${tab}`)}</p>
      <ul className="shop-offers">
        {SHOPS[tab].offers.map((o) => {
          const item = itemDef(o.item);
          if (!item) return null;
          const left = o.limit - boughtToday(state, o.id, now);
          return (
            <li key={o.id}>
              <span className="bag-icon">{ITEM_ICON[item.kind]}</span>
              <span className="quest-body">
                <strong>
                  {o.count > 1 && `${o.count}× `}
                  {itemName(item)}
                </strong>
                <small className="muted">
                  {t('shopLeft', { n: left, m: o.limit })} · ×{state.items[o.item] ?? 0}
                </small>
              </span>
              <button
                className="primary small"
                disabled={left <= 0 || have < o.price}
                data-testid={`buy-${o.id}`}
                onClick={() => {
                  const err = store.dispatch({ type: 'buy', shop: tab, offerId: o.id, count: 1 });
                  if (err) onError(err.message);
                }}
              >
                <CurrencyIcon shop={tab} size={14} /> {formatAmount(o.price)}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
