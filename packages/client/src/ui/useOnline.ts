import { hallLevel, kingsWar, realmMap, totalPower, defenceSnapshot, type GameState } from '@jarlheim/sim';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameStore } from '../game/store';
import { chatBackend, realmService } from '../online';
import type { PlayerAlliance, RealmPlayer } from '../online/realm';

const SYNC_MS = 60_000;

/** Free rim tiles of a realm, nearest to `near` first (the server picks the first one still free). */
function candidates(realm: number, near: { x: number; y: number }): Array<[number, number]> {
  const map = realmMap(realm);
  const c = (map.size - 1) / 2;
  return map.tiles
    .filter(
      (t) =>
        t.owner === null &&
        ['field', 'forest', 'hills'].includes(t.kind) &&
        Math.hypot(t.x - c, t.y - c) > 12,
    )
    .sort((a, b) => Math.hypot(a.x - near.x, a.y - near.y) - Math.hypot(b.x - near.x, b.y - near.y))
    .slice(0, 120)
    .map((t) => [t.x, t.y]);
}

export interface Online {
  /** Signed in with a chat profile: the hold is on the shared map. */
  on: boolean;
  userId: string | null;
  players: RealmPlayer[];
  alliances: PlayerAlliance[];
  /** Your own row (alliance membership, shield). */
  mine: RealmPlayer | null;
  refresh: (realm?: number) => Promise<void>;
  createAlliance: (tag: string, name: string) => Promise<void>;
  joinAlliance: (id: string | null) => Promise<void>;
  warScores: Record<number, number>;
  /** Sync now (e.g. right after signing in). */
  resync: () => Promise<void>;
}

/**
 * Puts the hold on the shared realm once the player is signed in: takes a free tile,
 * syncs one row a minute (and when the page hides), collects attacks made while away,
 * reports your attacks to the server and adds King's War points while the war is on.
 */
export function useOnline(
  store: GameStore,
  onError: (m: string) => void,
  onNews: (m: string) => void,
): Online {
  const [on, setOn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [players, setPlayers] = useState<RealmPlayer[]>([]);
  const [alliances, setAlliances] = useState<PlayerAlliance[]>([]);
  const [warScores, setWarScores] = useState<Record<number, number>>({});
  const homed = useRef(false);
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const newsRef = useRef(onNews);
  newsRef.current = onNews;

  const sync = useCallback(async () => {
    const realm = realmService();
    let me;
    try {
      me = await chatBackend().connect();
    } catch {
      setOn(false);
      return;
    }
    if (!me.signedIn || !me.me) {
      setOn(false);
      return;
    }
    try {
      const s = store.snapshot;
      if (!homed.current) {
        const home = await realm.claimHome(s.world.realm, candidates(s.world.realm, s.world.home));
        if (home.realm !== s.world.realm || home.x !== s.world.home.x || home.y !== s.world.home.y) {
          // Your device knows where you last moved: tell the server, unless that spot is taken
          // (or you are only visiting the war zone), then take the server's spot.
          const moved =
            !s.world.origin &&
            (await realm.moveHome(s.world.realm, s.world.home.x, s.world.home.y).then(
              () => true,
              () => false,
            ));
          if (!moved && !s.world.origin)
            store.dispatch({ type: 'setHome', realm: home.realm, x: home.x, y: home.y });
        }
        homed.current = true;
      }
      const now = store.snapshot;
      await realm.sync(holdFields(now));
      for (const a of await realm.collect()) {
        store.dispatch({ type: 'sufferAttack', ...a });
        newsRef.current(a.attackerName);
      }
      setUserId(await realm.userId());
      setOn(true);
    } catch (e) {
      errorRef.current((e as Error).message);
    }
  }, [store]);

  useEffect(() => {
    void sync();
    const id = setInterval(() => void sync(), SYNC_MS);
    const hide = () => document.hidden && void sync();
    document.addEventListener('visibilitychange', hide);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [sync]);

  // Your attacks go to the server; victories during the King's War add points to your realm.
  useEffect(
    () =>
      store.onEvents((events) => {
        if (!on) return;
        const realm = realmService();
        for (const e of events) {
          // A teleport at home moves the hold on the server too (not the war-zone visit).
          if (e.type === 'teleported' && !store.snapshot.world.origin) {
            const w = store.snapshot.world;
            realm.moveHome(w.realm, w.home.x, w.home.y).catch((err: Error) => errorRef.current(err.message));
          }
          if (e.type === 'pvp.fought') {
            realm
              .attack(e.targetId, e.won, e.defenderLosses, e.loot, 0)
              .catch((err: Error) => errorRef.current(err.message));
          }
          if (
            e.type === 'battle.resolved' &&
            e.won &&
            kingsWar(store.now(), store.snapshot.world.realm).live
          ) {
            realm.addWarPoints(500 + 100 * e.level).catch(() => undefined);
          }
        }
      }),
    [store, on],
  );

  const refresh = useCallback(
    async (realm = store.snapshot.world.realm) => {
      if (!on) return;
      try {
        const service = realmService();
        const week = Math.floor(kingsWar(store.now(), realm).start / (7 * 86_400_000));
        const [p, a, w] = await Promise.all([
          service.players(realm),
          service.alliances(realm),
          service.warScores(week),
        ]);
        setPlayers(p);
        setAlliances(a);
        setWarScores(w);
      } catch (e) {
        errorRef.current((e as Error).message);
      }
    },
    [on, store],
  );

  return {
    on,
    userId,
    players,
    alliances,
    mine: players.find((p) => p.id === userId) ?? null,
    refresh,
    warScores,
    resync: sync,
    createAlliance: async (tag, name) => {
      await realmService().createAlliance(tag, name);
      await refresh();
    },
    joinAlliance: async (id) => {
      await realmService().joinAlliance(id);
      await refresh();
    },
  };
}

function holdFields(s: GameState) {
  return {
    power: totalPower(s),
    hall: hallLevel(s),
    avatar: s.profile.avatar,
    aiAlliance: s.world.alliance,
    defence: defenceSnapshot(s),
    land: s.world.owned,
  };
}
