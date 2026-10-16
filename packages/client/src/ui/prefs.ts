import { useSyncExternalStore } from 'react';

/** Small per-device settings (notifications, snow), kept in localStorage. */
export interface Prefs {
  snow: boolean;
  notifyBuild: boolean;
  notifyRaid: boolean;
  notifyChat: boolean;
  notifyQuest: boolean;
}

const KEY = 'jarlheim.prefs';
const DEFAULTS: Prefs = {
  snow: true,
  notifyBuild: true,
  notifyRaid: true,
  notifyChat: true,
  notifyQuest: true,
};

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
    // The old snow setting lived under its own key.
    if (localStorage.getItem('jarlheim.snow') === 'off' && raw.snow === undefined) raw.snow = false;
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

let current = load();
const listeners = new Set<() => void>();

export const getPrefs = (): Prefs => current;

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  current = { ...current, [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // storage blocked: the choice lasts for this visit
  }
  for (const l of listeners) l();
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
