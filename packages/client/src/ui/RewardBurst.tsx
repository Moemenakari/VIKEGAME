import { itemDef, type Cost } from '@jarlheim/sim';
import { useEffect } from 'react';
import { formatAmount } from './format';
import { ChestIcon, ResourceIcon } from './icons';
import { itemName } from './ProfilePage';

export interface Burst {
  title: string;
  reward: Cost;
  items: Record<string, number>;
}

/**
 * "You won!" (owner request): a 3D golden coin spins up behind light rays, and every
 * resource and item flies out towards you. CSS 3D transforms only (no extra library,
 * no extra draw calls in the scene). It never blocks a tap and fades by itself.
 */
export function RewardBurst({ burst, onDone }: { burst: Burst; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 3200);
    return () => clearTimeout(id);
  }, [burst, onDone]);
  const res = Object.entries(burst.reward).filter(([, v]) => (v ?? 0) > 0) as Array<[keyof Cost, number]>;
  const items = Object.entries(burst.items).filter(([id, n]) => n > 0 && itemDef(id));
  return (
    <div className="burst" role="status" data-testid="reward-burst">
      <div className="burst-stage">
        <div className="burst-rays" />
        <div className="burst-coin">
          <div className="coin-face front">
            <ChestIcon size={64} open glow />
          </div>
          <div className="coin-face back">ᚠ</div>
        </div>
        <h2 className="burst-title">{burst.title}</h2>
        <ul className="burst-items">
          {res.map(([r, v], i) => (
            <li key={r} style={{ animationDelay: `${0.35 + i * 0.12}s` }}>
              <ResourceIcon res={r} size={26} />
              <b>+{formatAmount(v)}</b>
            </li>
          ))}
          {items.map(([id, n], i) => (
            <li key={id} style={{ animationDelay: `${0.35 + (res.length + i) * 0.12}s` }}>
              <ChestIcon size={26} />
              <b>
                {n}× {itemName(itemDef(id)!)}
              </b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
