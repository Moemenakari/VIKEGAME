import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cost, DefenceSnapshot } from '@jarlheim/sim';

/** Another player's hold on the world map (one row of the server's `holds` table). */
export interface RealmPlayer {
  id: string;
  name: string;
  realm: number;
  x: number;
  y: number;
  power: number;
  hall: number;
  avatar: number;
  aiAlliance: number | null;
  alliance: { id: string; tag: string; name: string } | null;
  defence: unknown;
  shieldUntil: string | null;
}

export interface PlayerAlliance {
  id: string;
  realm: number;
  tag: string;
  name: string;
  leaderId: string;
  channelId: string;
  members: number;
}

export interface CollectedAttack {
  attackerName: string;
  attackerWon: boolean;
  losses: Record<string, number>;
  loot: Cost;
  at: number;
}

export interface HoldSync {
  power: number;
  hall: number;
  avatar: number;
  aiAlliance: number | null;
  defence: DefenceSnapshot;
  land: string[];
}

/** The online realm: real players, player alliances, PvP and the King's War. */
export interface RealmService {
  userId(): Promise<string | null>;
  claimHome(
    realm: number,
    candidates: Array<[number, number]>,
  ): Promise<{ realm: number; x: number; y: number }>;
  /** One write with everything other players need (never one write per change). */
  sync(hold: HoldSync): Promise<void>;
  /** Every hold of a realm, with names and alliances, in one query. */
  players(realm: number): Promise<RealmPlayer[]>;
  alliances(realm: number): Promise<PlayerAlliance[]>;
  createAlliance(tag: string, name: string): Promise<string>;
  joinAlliance(id: string | null): Promise<void>;
  attack(
    target: string,
    won: boolean,
    losses: Record<string, number>,
    loot: Cost,
    rounds: number,
  ): Promise<void>;
  /** Attacks on you while you were away (each collected once). */
  collect(): Promise<CollectedAttack[]>;
  addWarPoints(points: number): Promise<number>;
  /** Total King's War points per realm for a war week. */
  warScores(week: number): Promise<Record<number, number>>;
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

interface HoldRow {
  user_id: string;
  realm: number;
  x: number;
  y: number;
  power: number;
  hall: number;
  avatar: number;
  ai_alliance: number | null;
  defence: unknown;
  shield_until: string | null;
  profile: { display_name: string } | null;
  alliance: { id: string; tag: string; name: string } | null;
}

export class SupabaseRealm implements RealmService {
  constructor(private readonly sb: SupabaseClient) {}

  async userId(): Promise<string | null> {
    const { data } = await this.sb.auth.getSession();
    return data.session?.user.id ?? null;
  }

  async claimHome(realm: number, candidates: Array<[number, number]>) {
    const { data, error } = await this.sb.rpc('claim_home', { realm, candidates });
    fail(error);
    return data as { realm: number; x: number; y: number };
  }

  async sync(hold: HoldSync): Promise<void> {
    const id = await this.userId();
    if (!id) return;
    const { error } = await this.sb
      .from('holds')
      .update({
        power: Math.floor(hold.power),
        hall: hold.hall,
        avatar: hold.avatar,
        ai_alliance: hold.aiAlliance,
        defence: hold.defence,
        land: hold.land,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', id);
    fail(error);
  }

  async players(realm: number): Promise<RealmPlayer[]> {
    const { data, error } = await this.sb
      .from('holds')
      .select(
        'user_id, realm, x, y, power, hall, avatar, ai_alliance, defence, shield_until, profile:profiles!holds_user_id_fkey(display_name), alliance:alliances!holds_alliance_id_fkey(id, tag, name)',
      )
      .eq('realm', realm)
      .limit(1000);
    fail(error);
    return (data as unknown as HoldRow[]).map((r) => ({
      id: r.user_id,
      name: r.profile?.display_name ?? '?',
      realm: r.realm,
      x: r.x,
      y: r.y,
      power: r.power,
      hall: r.hall,
      avatar: r.avatar,
      aiAlliance: r.ai_alliance,
      alliance: r.alliance,
      defence: r.defence,
      shieldUntil: r.shield_until,
    }));
  }

  async alliances(realm: number): Promise<PlayerAlliance[]> {
    const { data, error } = await this.sb
      .from('alliances')
      .select('id, realm, tag, name, leader_id, channel_id, holds(count)')
      .eq('realm', realm)
      .order('created_at');
    fail(error);
    return (data as Array<Record<string, unknown>>).map((a) => ({
      id: a.id as string,
      realm: a.realm as number,
      tag: a.tag as string,
      name: a.name as string,
      leaderId: a.leader_id as string,
      channelId: a.channel_id as string,
      members: ((a.holds as Array<{ count: number }>)[0]?.count as number) ?? 0,
    }));
  }

  async createAlliance(tag: string, name: string): Promise<string> {
    const { data, error } = await this.sb.rpc('create_alliance', { tag, name });
    fail(error);
    return data as string;
  }

  async joinAlliance(id: string | null): Promise<void> {
    fail((await this.sb.rpc('join_alliance', { alliance: id })).error);
  }

  async attack(target: string, won: boolean, losses: Record<string, number>, loot: Cost, rounds: number) {
    fail(
      (
        await this.sb.rpc('attack_hold', {
          target,
          attacker_won: won,
          defender_losses: losses,
          loot,
          report: { rounds },
        })
      ).error,
    );
  }

  async collect(): Promise<CollectedAttack[]> {
    const { data, error } = await this.sb.rpc('collect_pvp');
    fail(error);
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    if (!rows.length) return [];
    // Attacker names in ONE query for all reports (no N+1).
    const ids = [...new Set(rows.map((r) => r.attacker_id as string))];
    const { data: people } = await this.sb.from('profiles').select('id, display_name').in('id', ids);
    const names = new Map((people ?? []).map((p) => [p.id as string, p.display_name as string]));
    return rows.map((r) => ({
      attackerName: names.get(r.attacker_id as string) ?? '?',
      attackerWon: r.attacker_won as boolean,
      losses: r.defender_losses as Record<string, number>,
      loot: r.loot as Cost,
      at: Date.parse(r.created_at as string),
    }));
  }

  async addWarPoints(points: number): Promise<number> {
    const { data, error } = await this.sb.rpc('add_war_points', {
      points: Math.min(5000, Math.max(1, Math.round(points))),
    });
    fail(error);
    return data as number;
  }

  async warScores(week: number): Promise<Record<number, number>> {
    const { data, error } = await this.sb.from('war_scores').select('realm, points').eq('week', week);
    fail(error);
    return Object.fromEntries((data ?? []).map((r) => [r.realm as number, Number(r.points)]));
  }
}

/** An offline stand-in with a few neighbours, for tests and demos (`?chat=local`). */
export class LocalRealm implements RealmService {
  private home: { realm: number; x: number; y: number } | null = null;
  private allianceList: PlayerAlliance[] = [
    {
      id: 'al-1',
      realm: 1,
      tag: 'RVN',
      name: 'Ravens of Odin',
      leaderId: 'npc-ylva',
      channelId: 'al-1-chat',
      members: 12,
    },
  ];
  private sent: Array<{ target: string; won: boolean }> = [];

  async userId() {
    return 'me';
  }

  async claimHome(realm: number, candidates: Array<[number, number]>) {
    const [x, y] = candidates[0] ?? [0, 0];
    this.home ??= { realm, x, y };
    return this.home;
  }

  async sync(): Promise<void> {}

  async players(realm: number): Promise<RealmPlayer[]> {
    const h = this.home ?? { realm, x: 20, y: 20 };
    const near = (dx: number, dy: number) => ({
      x: Math.max(0, Math.min(40, h.x + dx)),
      y: Math.max(0, Math.min(40, h.y + dy)),
    });
    const weak = {
      troops: { 'shieldwall-1': 8, 'archer-1': 5 },
      walls: [],
      heroes: { owned: {}, squad: [] },
      lootable: { food: 3_000, timber: 2_000 },
    };
    return [
      {
        id: 'npc-ketil',
        name: 'Ketil',
        realm,
        ...near(2, 1),
        power: 900,
        hall: 3,
        avatar: 1,
        aiAlliance: null,
        alliance: null,
        defence: weak,
        shieldUntil: null,
      },
      {
        id: 'npc-sigrun',
        name: 'Sigrun',
        realm,
        ...near(-2, 2),
        power: 4_200,
        hall: 6,
        avatar: 3,
        aiAlliance: null,
        alliance: { id: 'al-1', tag: 'RVN', name: 'Ravens of Odin' },
        defence: { ...weak, troops: { 'shieldwall-2': 120, 'archer-2': 90 } },
        shieldUntil: null,
      },
    ];
  }

  async alliances(realm: number) {
    return this.allianceList.filter((a) => a.realm === realm);
  }

  async createAlliance(tag: string, name: string) {
    const id = `al-${this.allianceList.length + 1}`;
    this.allianceList.push({
      id,
      realm: this.home?.realm ?? 1,
      tag: tag.toUpperCase(),
      name,
      leaderId: 'me',
      channelId: `${id}-chat`,
      members: 1,
    });
    return id;
  }

  async joinAlliance(): Promise<void> {}

  async attack(target: string, won: boolean) {
    this.sent.push({ target, won });
  }

  async collect(): Promise<CollectedAttack[]> {
    return [];
  }

  async addWarPoints(points: number) {
    return points;
  }

  async warScores() {
    return {};
  }
}
