import type { Need, RuleError } from '@jarlheim/sim';
import { createContext, useContext } from 'react';
import { errorText } from './i18n';

/** Opens whatever unblocks a need (set by the App, used by every panel). */
export const NeedContext = createContext<(need: Need) => void>(() => undefined);

/**
 * A red "you can't yet" line that is also a link: tap it and the game takes you to the
 * building or resource that blocks you (owner request: "put an arrow that takes me there").
 */
export function NeedLink({ error }: { error: Pick<RuleError, 'message' | 'need'> }) {
  const go = useContext(NeedContext);
  if (!error.need) return <p className="blocked">{errorText(error.message)}</p>;
  const need = error.need;
  return (
    <button className="need-link" onClick={() => go(need)} data-testid="need-link">
      <span>{errorText(error.message)}</span>
      <b>➜</b>
    </button>
  );
}
