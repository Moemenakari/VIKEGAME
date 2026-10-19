/** The chat & social contract the UI talks to (GDD §19–20). */

export const REALM_CHANNEL_ID = '00000000-0000-0000-0000-000000000001';

/** Each realm (server) has its own chat: realms 1–4. */
export const realmChannelId = (realm: number) => `00000000-0000-0000-0000-00000000000${realm}`;

/** One alliance chat per alliance per realm (see supabase/migrations/…_0004). */
export const allianceChannelId = (realm: number, alliance: number) =>
  `00000000-0000-0000-00${String(realm).padStart(2, '0')}-0000000000${String(alliance + 1).padStart(2, '0')}`;

export type TicketTopic = 'bug' | 'account' | 'payment' | 'player' | 'idea' | 'other';

/** Usernames for username + password accounts. */
export const USERNAME_RE = /^[a-z0-9_]{3,16}$/;

export const REACTIONS = ['🌹', '❤️', '👍', '⚔️', '🛡️', '😂', '🔥'] as const;
export type Reaction = (typeof REACTIONS)[number];

export interface ChatProfile {
  id: string;
  name: string;
  vip: number;
  vipPoints: number;
  /** Public player ID (sign in with it instead of the name). */
  playerNo?: number;
}

/** What a player who lost their account remembers, for customer service to match. */
export interface RecoveryRequest {
  name: string;
  playerNo: number | null;
  realm: number | null;
  alliance: string;
  lastAttacker: string;
  contact: string;
  note: string;
  /** Answers to the security questions (compared by customer service, kept only as hashes). */
  pet: string;
  phone: string;
  food: string;
}

export type ChannelKind = 'realm' | 'clan' | 'group' | 'dm';

export interface ChatChannel {
  id: string;
  kind: ChannelKind;
  title: string;
  ownerId: string | null;
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
}

export interface ChatMessage {
  id: number;
  channelId: string;
  senderId: string;
  senderName: string;
  senderVip: number;
  body: string;
  imageUrl: string | null;
  replyTo: number | null;
  createdAt: string;
  /** emoji → ids of the players who reacted. */
  reactions: Partial<Record<Reaction, string[]>>;
}

export interface FriendEntry {
  id: string;
  name: string;
  vip: number;
  online: boolean;
  status: 'friend' | 'incoming' | 'outgoing';
}

export interface ConnectResult {
  /** Signed in (Google, username + password, or guest)? */
  signedIn: boolean;
  /** The chat profile, once created. */
  me: ChatProfile | null;
}

/** Everything the chat UI needs. Errors are thrown as Error with a player-friendly message. */
export interface ChatBackend {
  readonly kind: 'supabase' | 'local';
  connect(): Promise<ConnectResult>;
  /** Google sign-in: leaves the page and comes back signed in. */
  signInGoogle(): Promise<void>;
  /** Username + password account (the name becomes your chat name). */
  signUp(username: string, password: string): Promise<ChatProfile>;
  /** Sign in with the account name or the player ID. */
  signIn(nameOrId: string, password: string): Promise<ConnectResult>;
  /** Forgot the name or password: ask customer service (works signed out). */
  requestRecovery(req: RecoveryRequest): Promise<void>;
  /** Security questions for recovery: your pet's name, the phone you use, your favourite food. */
  setSecurityAnswers(pet: string, phone: string, food: string): Promise<void>;
  /** Change the password: the old one first, then the new one. */
  changePassword(oldPassword: string, newPassword: string): Promise<void>;
  /** Play first, sign up later. */
  playAsGuest(): Promise<ConnectResult>;
  signOut(): Promise<void>;
  /** Likes and roses your messages received, and how many you sent. */
  socialStats(): Promise<{ likes: number; roses: number; messages: number }>;
  /** Customer service: open a ticket (answered in the game later). */
  openTicket(topic: TicketTopic, body: string, meta: Record<string, string>): Promise<void>;
  /** Deletes the account and everything online tied to it. */
  deleteAccount(): Promise<void>;
  /** Puts you in your alliance's chat (or takes you out with null). */
  joinAllianceChat(realm: number, alliance: number | null): Promise<void>;
  createProfile(name: string): Promise<ChatProfile>;
  claimDaily(): Promise<ChatProfile>;
  channels(): Promise<ChatChannel[]>;
  messages(channelId: string): Promise<ChatMessage[]>;
  /** Live updates for one channel. Returns an unsubscribe function. */
  subscribe(channelId: string, onMessage: (m: ChatMessage) => void): () => void;
  send(channelId: string, body: string, image?: Blob, replyTo?: number): Promise<void>;
  react(messageId: number, emoji: Reaction, on: boolean): Promise<void>;
  report(messageId: number, reason: string): Promise<void>;
  block(userId: string): Promise<void>;
  friends(): Promise<FriendEntry[]>;
  search(query: string): Promise<ChatProfile[]>;
  addFriend(userId: string): Promise<'pending' | 'accepted'>;
  respondFriend(userId: string, accept: boolean): Promise<void>;
  removeFriend(userId: string): Promise<void>;
  openDm(userId: string): Promise<string>;
  createGroup(name: string, memberIds: string[]): Promise<string>;
  leave(channelId: string): Promise<void>;
  markRead(channelId: string): Promise<void>;
}

/** VIP perks shown in the UI. The server enforces the real limits (supabase/migrations). */
export const VIP_PERKS = [
  { level: 0, points: 0, perks: 'Realm chat, private messages, friends' },
  { level: 1, points: 30, perks: 'Norse emote pack · 1 group chat (10 members)' },
  { level: 2, points: 100, perks: 'Send images to friends, groups and clan · 2 groups (20)' },
  { level: 3, points: 300, perks: 'Gold name in Realm chat · sticker pack · 3 groups (30)' },
  { level: 4, points: 700, perks: 'Images in Realm chat · avatar frame · 5 groups (50)' },
  { level: 5, points: 1500, perks: 'Custom chat bubble · VIP lounge · 8 groups (100)' },
] as const;

export const canSendImage = (vip: number, kind: ChannelKind) => (kind === 'realm' ? vip >= 4 : vip >= 2);
