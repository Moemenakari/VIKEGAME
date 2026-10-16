import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';
import type {
  ChatBackend,
  ChatChannel,
  ChatMessage,
  ChatProfile,
  ConnectResult,
  FriendEntry,
  Reaction,
} from './types';
import { USERNAME_RE } from './types';

const IMAGE_BUCKET = 'chat-images';

/** Username accounts use a private, never-mailed address under our own name. */
const emailFor = (username: string) => `${username}@players.jarlheim.game`;
const ONLINE_MS = 2 * 60 * 1000;

interface ProfileRow {
  id: string;
  display_name: string;
  vip_level: number;
  vip_points: number;
  last_seen_at?: string;
}

interface MessageRow {
  id: number;
  channel_id: string;
  sender_id: string;
  body: string;
  image_path: string | null;
  reply_to: number | null;
  created_at: string;
  sender?: { display_name: string; vip_level: number } | null;
  reactions?: Array<{ emoji: Reaction; user_id: string }>;
}

const toProfile = (p: ProfileRow): ChatProfile => ({
  id: p.id,
  name: p.display_name,
  vip: p.vip_level,
  vipPoints: p.vip_points,
});

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/**
 * Real online chat on Supabase (free tier): Auth (anonymous accounts), Postgres with
 * row-level security, Realtime and Storage. Follows the "one trip" rule: a page of
 * messages comes with senders and reactions in ONE query, image links are signed in
 * ONE batch, and unknown senders of live messages are looked up together, not one by one.
 */
export class SupabaseBackend implements ChatBackend {
  readonly kind = 'supabase' as const;
  private sb: SupabaseClient;
  private me: ChatProfile | null = null;
  private names = new Map<string, { name: string; vip: number }>();
  private pending = new Map<string, Array<() => void>>();
  private lookupTimer: ReturnType<typeof setTimeout> | null = null;
  private presence: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }

  async connect(): Promise<ConnectResult> {
    const { data } = await this.sb.auth.getSession();
    if (!data.session) return { signedIn: false, me: null };
    const uid = data.session.user.id;
    const { data: row, error } = await this.sb
      .from('profiles')
      .select('id, display_name, vip_level, vip_points')
      .eq('id', uid)
      .maybeSingle();
    fail(error);
    this.me = row ? toProfile(row as ProfileRow) : null;
    if (this.me) this.startPresence();
    return { signedIn: true, me: this.me };
  }

  async signInGoogle(): Promise<void> {
    const { error } = await this.sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname },
    });
    if (error)
      throw new Error(
        /provider is not enabled/i.test(error.message)
          ? 'Google sign-in is not switched on yet'
          : error.message,
      );
  }

  async signUp(username: string, password: string): Promise<ChatProfile> {
    const name = username.trim().toLowerCase();
    if (!USERNAME_RE.test(name)) throw new Error('Usernames are 3 to 16 letters, numbers or _');
    if (password.length < 6) throw new Error('Passwords need at least 6 characters');
    const { data, error } = await this.sb.auth.signUp({ email: emailFor(name), password });
    if (error) throw new Error(/registered/i.test(error.message) ? 'That name is taken' : error.message);
    if (!data.session)
      throw new Error('Account created, but the server asks for an email check (switch it off in Supabase)');
    return this.createProfile(username.trim());
  }

  async signIn(username: string, password: string): Promise<ConnectResult> {
    const { error } = await this.sb.auth.signInWithPassword({
      email: emailFor(username.trim().toLowerCase()),
      password,
    });
    if (error) throw new Error('Wrong username or password');
    return this.connect();
  }

  async playAsGuest(): Promise<ConnectResult> {
    const res = await this.sb.auth.signInAnonymously();
    if (res.error) {
      throw new Error(
        /anonymous/i.test(res.error.message)
          ? 'Guest play is not switched on yet'
          : `Could not sign in: ${res.error.message}`,
      );
    }
    return this.connect();
  }

  async signOut(): Promise<void> {
    if (this.presence) clearInterval(this.presence);
    this.presence = null;
    this.me = null;
    await this.sb.auth.signOut();
  }

  async joinAllianceChat(realm: number, alliance: number | null): Promise<void> {
    fail((await this.sb.rpc('join_alliance_chat', { realm, alliance })).error);
  }

  async createProfile(name: string): Promise<ChatProfile> {
    const { data } = await this.sb.auth.getSession();
    const { error } = await this.sb
      .from('profiles')
      .insert({ id: data.session!.user.id, display_name: name });
    if (error) throw new Error(error.code === '23505' ? 'That name is taken' : error.message);
    const res = await this.connect();
    return res.me!;
  }

  async claimDaily(): Promise<ChatProfile> {
    const { data, error } = await this.sb.rpc('claim_daily_login');
    fail(error);
    this.me = toProfile(data as ProfileRow);
    return this.me;
  }

  async channels(): Promise<ChatChannel[]> {
    const { data, error } = await this.sb.rpc('my_channels');
    fail(error);
    return (data as Array<Record<string, unknown>>).map((c) => ({
      id: c.id as string,
      kind: c.kind as ChatChannel['kind'],
      title: (c.kind === 'dm' ? (c.other_name as string) : (c.name as string)) ?? 'Chat',
      ownerId: (c.owner_id as string | null) ?? null,
      lastBody: (c.last_body as string | null) ?? null,
      lastAt: (c.last_at as string | null) ?? null,
      unread: (c.unread as number) ?? 0,
    }));
  }

  async messages(channelId: string): Promise<ChatMessage[]> {
    // One query: messages + sender names + reactions (no N+1).
    const { data, error } = await this.sb
      .from('messages')
      .select(
        'id, channel_id, sender_id, body, image_path, reply_to, created_at, sender:profiles!messages_sender_id_fkey(display_name, vip_level), reactions(emoji, user_id)',
      )
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(60);
    fail(error);
    const rows = (data as unknown as MessageRow[]).reverse();
    for (const r of rows)
      if (r.sender) this.names.set(r.sender_id, { name: r.sender.display_name, vip: r.sender.vip_level });
    const urls = await this.signImages(rows.map((r) => r.image_path).filter((p): p is string => !!p));
    return rows.map((r) => this.toMessage(r, urls));
  }

  subscribe(channelId: string, onMessage: (m: ChatMessage) => void): () => void {
    const channel = this.sb
      .channel(`chat:${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const row = payload.new as MessageRow;
          void this.withSender(row.sender_id).then(async () => {
            const urls = await this.signImages(row.image_path ? [row.image_path] : []);
            onMessage(this.toMessage(row, urls));
          });
        },
      )
      .subscribe();
    return () => void this.sb.removeChannel(channel);
  }

  async send(channelId: string, body: string, image?: Blob, replyTo?: number): Promise<void> {
    let imagePath: string | null = null;
    if (image) {
      const { data } = await this.sb.auth.getSession();
      imagePath = `${channelId}/${data.session!.user.id}/${crypto.randomUUID()}.webp`;
      const up = await this.sb.storage
        .from(IMAGE_BUCKET)
        .upload(imagePath, image, { contentType: image.type });
      if (up.error) throw new Error(up.error.message);
    }
    const { error } = await this.sb
      .from('messages')
      .insert({ channel_id: channelId, body, image_path: imagePath, reply_to: replyTo ?? null });
    if (error)
      throw new Error(
        /row-level security/.test(error.message) ? 'Your VIP level cannot send that here' : error.message,
      );
  }

  async react(messageId: number, emoji: Reaction, on: boolean): Promise<void> {
    const res = on
      ? await this.sb.from('reactions').insert({ message_id: messageId, emoji })
      : await this.sb
          .from('reactions')
          .delete()
          .match({ message_id: messageId, emoji, user_id: this.me?.id });
    fail(res.error);
  }

  async report(messageId: number, reason: string): Promise<void> {
    fail((await this.sb.from('reports').insert({ message_id: messageId, reason })).error);
  }

  async block(userId: string): Promise<void> {
    fail((await this.sb.from('blocks').insert({ blocked_id: userId })).error);
  }

  async friends(): Promise<FriendEntry[]> {
    // One query for every link with both players' profiles embedded.
    const { data, error } = await this.sb
      .from('friend_requests')
      .select(
        'from_id, to_id, status, from:profiles!friend_requests_from_id_fkey(id, display_name, vip_level, vip_points, last_seen_at), to:profiles!friend_requests_to_id_fkey(id, display_name, vip_level, vip_points, last_seen_at)',
      );
    fail(error);
    const me = this.me?.id;
    return (
      data as unknown as Array<{ from_id: string; status: string; from: ProfileRow; to: ProfileRow }>
    ).map((l) => {
      const mine = l.from_id === me;
      const other = mine ? l.to : l.from;
      return {
        id: other.id,
        name: other.display_name,
        vip: other.vip_level,
        online: !!other.last_seen_at && Date.now() - Date.parse(other.last_seen_at) < ONLINE_MS,
        status: l.status === 'accepted' ? 'friend' : mine ? 'outgoing' : 'incoming',
      };
    });
  }

  async search(query: string): Promise<ChatProfile[]> {
    const q = query.trim().replace(/[%_]/g, '');
    if (q.length < 2) return [];
    const { data, error } = await this.sb
      .from('profiles')
      .select('id, display_name, vip_level, vip_points')
      .ilike('display_name', `${q}%`)
      .neq('id', this.me?.id ?? '')
      .limit(20);
    fail(error);
    return (data as ProfileRow[]).map(toProfile);
  }

  async addFriend(userId: string): Promise<'pending' | 'accepted'> {
    const { data, error } = await this.sb.rpc('send_friend_request', { target: userId });
    fail(error);
    return data as 'pending' | 'accepted';
  }

  async respondFriend(userId: string, accept: boolean): Promise<void> {
    fail((await this.sb.rpc('respond_friend_request', { requester: userId, accept })).error);
  }

  async removeFriend(userId: string): Promise<void> {
    fail((await this.sb.rpc('remove_friend', { other: userId })).error);
  }

  async openDm(userId: string): Promise<string> {
    const { data, error } = await this.sb.rpc('open_dm', { other: userId });
    fail(error);
    return data as string;
  }

  async createGroup(name: string, memberIds: string[]): Promise<string> {
    const { data, error } = await this.sb.rpc('create_group', { group_name: name, member_ids: memberIds });
    fail(error);
    return data as string;
  }

  async leave(channelId: string): Promise<void> {
    fail((await this.sb.rpc('leave_channel', { cid: channelId })).error);
  }

  async markRead(channelId: string): Promise<void> {
    if (!this.me) return;
    await this.sb
      .from('channel_members')
      .update({ last_read_at: new Date().toISOString() })
      .match({ channel_id: channelId, user_id: this.me.id });
  }

  // ---- helpers ---------------------------------------------------------------------

  private startPresence(): void {
    if (this.presence) return;
    void this.sb.rpc('touch_presence');
    this.presence = setInterval(() => void this.sb.rpc('touch_presence'), 60_000);
  }

  /** Signs many image paths in ONE request. */
  private async signImages(paths: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (!paths.length) return out;
    const { data } = await this.sb.storage.from(IMAGE_BUCKET).createSignedUrls(paths, 3600);
    for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
    return out;
  }

  /**
   * Waits until a sender's name is known. Unknown senders arriving close together are
   * fetched in one batched query (DataLoader-style), never one query per message.
   */
  private withSender(id: string): Promise<void> {
    if (this.names.has(id)) return Promise.resolve();
    return new Promise((resolve) => {
      const waiting = this.pending.get(id) ?? [];
      waiting.push(resolve);
      this.pending.set(id, waiting);
      if (this.lookupTimer) return;
      this.lookupTimer = setTimeout(async () => {
        this.lookupTimer = null;
        const ids = [...this.pending.keys()];
        const callbacks = [...this.pending.values()].flat();
        this.pending.clear();
        const { data } = await this.sb.from('profiles').select('id, display_name, vip_level').in('id', ids);
        for (const p of (data ?? []) as ProfileRow[])
          this.names.set(p.id, { name: p.display_name, vip: p.vip_level });
        for (const cb of callbacks) cb();
      }, 80);
    });
  }

  private toMessage(r: MessageRow, urls: Map<string, string>): ChatMessage {
    const sender = this.names.get(r.sender_id);
    const reactions: ChatMessage['reactions'] = {};
    for (const x of r.reactions ?? []) (reactions[x.emoji] ??= []).push(x.user_id);
    return {
      id: r.id,
      channelId: r.channel_id,
      senderId: r.sender_id,
      senderName: sender?.name ?? 'Unknown',
      senderVip: sender?.vip ?? 0,
      body: r.body,
      imageUrl: r.image_path ? (urls.get(r.image_path) ?? null) : null,
      replyTo: r.reply_to,
      createdAt: r.created_at,
      reactions,
    };
  }
}
