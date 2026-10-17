import type {
  ChatBackend,
  ChatChannel,
  ChatMessage,
  ChatProfile,
  ConnectResult,
  FriendEntry,
  Reaction,
  RecoveryRequest,
} from './types';
import { REALM_CHANNEL_ID, USERNAME_RE, allianceChannelId, canSendImage } from './types';

/**
 * An in-memory stand-in for the chat server, used by the automated tests and by
 * `?chat=local` demos where the real server cannot be reached. It follows the same
 * rules the server enforces (VIP limits, friends-only groups) so the UI behaves alike.
 */
export class LocalBackend implements ChatBackend {
  readonly kind = 'local' as const;
  private me: ChatProfile | null = null;
  private nextId = 100;
  private listeners = new Map<string, Set<(m: ChatMessage) => void>>();
  private people: ChatProfile[] = [
    { id: 'npc-sigrun', name: 'Sigrun', vip: 3, vipPoints: 320 },
    { id: 'npc-ketil', name: 'Ketil', vip: 0, vipPoints: 10 },
    { id: 'npc-ylva', name: 'Ylva', vip: 5, vipPoints: 1600 },
  ];
  private links: Array<{ other: string; status: FriendEntry['status'] }> = [
    { other: 'npc-sigrun', status: 'friend' },
    { other: 'npc-ketil', status: 'incoming' },
  ];
  private chans: ChatChannel[] = [
    {
      id: REALM_CHANNEL_ID,
      kind: 'realm',
      title: 'Realm of Jarlheim',
      ownerId: null,
      lastBody: null,
      lastAt: null,
      unread: 0,
    },
  ];
  private log: ChatMessage[] = [];

  constructor() {
    const t = Date.now() - 5 * 60_000;
    this.push(REALM_CHANNEL_ID, 'npc-ylva', 'Hail, settlers! The barrow on the shore is stirring again.', t);
    this.push(REALM_CHANNEL_ID, 'npc-sigrun', 'Bring archers. Wights hate yew.', t + 60_000);
  }

  private profile(id: string): ChatProfile {
    return (
      (id === this.me?.id ? this.me : this.people.find((p) => p.id === id)) ?? {
        id,
        name: '?',
        vip: 0,
        vipPoints: 0,
      }
    );
  }

  private push(
    channelId: string,
    senderId: string,
    body: string,
    at = Date.now(),
    imageUrl: string | null = null,
  ) {
    const p = this.profile(senderId);
    const m: ChatMessage = {
      id: this.nextId++,
      channelId,
      senderId,
      senderName: p.name,
      senderVip: p.vip,
      body,
      imageUrl,
      replyTo: null,
      createdAt: new Date(at).toISOString(),
      reactions: {},
    };
    this.log.push(m);
    const ch = this.chans.find((c) => c.id === channelId);
    if (ch) {
      ch.lastBody = body || '📷 Image';
      ch.lastAt = m.createdAt;
    }
    for (const l of this.listeners.get(channelId) ?? []) l(structuredClone(m));
    return m;
  }

  private signedIn = false;

  async connect(): Promise<ConnectResult> {
    return { signedIn: this.signedIn, me: this.me };
  }

  async signInGoogle(): Promise<void> {
    this.signedIn = true;
  }

  async signUp(username: string, password: string): Promise<ChatProfile> {
    if (!USERNAME_RE.test(username.trim().toLowerCase()))
      throw new Error('Usernames are 3 to 16 letters, numbers or _');
    if (password.length < 6) throw new Error('Passwords need at least 6 characters');
    this.signedIn = true;
    return this.createProfile(username.trim());
  }

  async signIn(): Promise<ConnectResult> {
    this.signedIn = true;
    return this.connect();
  }

  async playAsGuest(): Promise<ConnectResult> {
    this.signedIn = true;
    return this.connect();
  }

  async signOut(): Promise<void> {
    this.signedIn = false;
    this.me = null;
  }

  tickets: Array<{ topic: string; body: string }> = [];
  recoveries: RecoveryRequest[] = [];

  async requestRecovery(r: RecoveryRequest): Promise<void> {
    this.recoveries.push(r);
  }

  async socialStats() {
    const mine = this.log.filter((m) => m.senderId === this.me?.id);
    const count = (e: string) =>
      mine.reduce(
        (n, m) => n + (m.reactions[e as Reaction]?.filter((u) => u !== this.me?.id).length ?? 0),
        0,
      );
    return { likes: count('👍') + count('❤️'), roses: count('🌹'), messages: mine.length };
  }

  async openTicket(topic: string, body: string): Promise<void> {
    if (body.trim().length < 5) throw new Error('Tell us a little more (5 letters at least)');
    this.tickets.push({ topic, body });
  }

  async deleteAccount(): Promise<void> {
    await this.signOut();
  }

  async joinAllianceChat(realm: number, alliance: number | null): Promise<void> {
    this.chans = this.chans.filter((c) => c.kind !== 'clan');
    if (alliance === null) return;
    const id = allianceChannelId(realm, alliance);
    this.chans.push({
      id,
      kind: 'clan',
      title: 'Alliance',
      ownerId: null,
      lastBody: null,
      lastAt: null,
      unread: 0,
    });
    if (!this.log.some((m) => m.channelId === id))
      this.push(id, 'npc-sigrun', 'Welcome to the alliance! Help each other and we win the VS.');
  }

  async createProfile(name: string): Promise<ChatProfile> {
    if (this.people.some((p) => p.name.toLowerCase() === name.toLowerCase()))
      throw new Error('That name is taken');
    this.me = { id: 'me', name, vip: 0, vipPoints: 0 };
    return this.me;
  }

  async claimDaily(): Promise<ChatProfile> {
    if (!this.me) throw new Error('No profile');
    this.me = { ...this.me, vipPoints: this.me.vipPoints + 10 };
    return this.me;
  }

  async channels(): Promise<ChatChannel[]> {
    return this.chans.map((c) => ({ ...c }));
  }

  async messages(channelId: string): Promise<ChatMessage[]> {
    // Copies, like rows from a real server: the UI never shares objects with the store.
    return this.log.filter((m) => m.channelId === channelId).map((m) => structuredClone(m));
  }

  subscribe(channelId: string, onMessage: (m: ChatMessage) => void): () => void {
    const set = this.listeners.get(channelId) ?? new Set();
    set.add(onMessage);
    this.listeners.set(channelId, set);
    return () => set.delete(onMessage);
  }

  async send(channelId: string, body: string, image?: Blob): Promise<void> {
    const ch = this.chans.find((c) => c.id === channelId) ?? { kind: 'clan' as const };
    if (image && !canSendImage(this.me!.vip, ch.kind))
      throw new Error('Your VIP level cannot send that here');
    this.push(
      channelId,
      this.me!.id,
      body.replace(/\b(shit|fuck)\b/gi, (w) => '*'.repeat(w.length)),
      Date.now(),
      image ? URL.createObjectURL(image) : null,
    );
    // A friend answers in private chats, so the demo feels alive.
    if (ch.kind === 'dm')
      setTimeout(() => this.push(channelId, 'npc-sigrun', 'Aye! See you at the Thing.'), 600);
  }

  async react(messageId: number, emoji: Reaction, on: boolean): Promise<void> {
    const m = this.log.find((x) => x.id === messageId);
    if (!m) return;
    const list = (m.reactions[emoji] ??= []);
    if (on && !list.includes(this.me!.id)) list.push(this.me!.id);
    if (!on) m.reactions[emoji] = list.filter((u) => u !== this.me!.id);
  }

  async report(): Promise<void> {}

  async block(userId: string): Promise<void> {
    this.links = this.links.filter((l) => l.other !== userId);
  }

  async friends(): Promise<FriendEntry[]> {
    return this.links.map((l) => {
      const p = this.profile(l.other);
      return { id: p.id, name: p.name, vip: p.vip, online: p.id !== 'npc-ketil', status: l.status };
    });
  }

  async search(query: string): Promise<ChatProfile[]> {
    const q = query.trim().toLowerCase();
    return q.length < 2 ? [] : this.people.filter((p) => p.name.toLowerCase().startsWith(q));
  }

  async addFriend(userId: string): Promise<'pending' | 'accepted'> {
    const link = this.links.find((l) => l.other === userId);
    if (link?.status === 'incoming') {
      link.status = 'friend';
      return 'accepted';
    }
    if (!link) this.links.push({ other: userId, status: 'outgoing' });
    return 'pending';
  }

  async respondFriend(userId: string, accept: boolean): Promise<void> {
    if (accept) this.links = this.links.map((l) => (l.other === userId ? { ...l, status: 'friend' } : l));
    else this.links = this.links.filter((l) => l.other !== userId);
  }

  async removeFriend(userId: string): Promise<void> {
    this.links = this.links.filter((l) => l.other !== userId);
  }

  async openDm(userId: string): Promise<string> {
    const id = `dm-${userId}`;
    if (!this.chans.some((c) => c.id === id)) {
      this.chans.push({
        id,
        kind: 'dm',
        title: this.profile(userId).name,
        ownerId: null,
        lastBody: null,
        lastAt: null,
        unread: 0,
      });
    }
    return id;
  }

  async createGroup(name: string, memberIds: string[]): Promise<string> {
    const limits = [0, 1, 2, 3, 5, 8];
    const owned = this.chans.filter((c) => c.kind === 'group' && c.ownerId === this.me!.id).length;
    if (limits[this.me!.vip] === 0) throw new Error('Reach VIP 1 to create group chats');
    if (owned >= limits[this.me!.vip]!)
      throw new Error(`Your VIP level allows ${limits[this.me!.vip]} group chats`);
    const id = `group-${this.nextId++}`;
    this.chans.push({
      id,
      kind: 'group',
      title: name,
      ownerId: this.me!.id,
      lastBody: null,
      lastAt: null,
      unread: 0,
    });
    void memberIds;
    return id;
  }

  async leave(channelId: string): Promise<void> {
    this.chans = this.chans.filter((c) => c.id !== channelId || c.kind === 'realm');
  }

  async markRead(): Promise<void> {}

  /** Test helper: pretend the server granted VIP. */
  setVip(level: number): void {
    if (this.me) this.me = { ...this.me, vip: level };
  }
}
