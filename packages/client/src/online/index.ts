import { LocalBackend } from './localBackend';
import { LocalRealm, SupabaseRealm, type RealmService } from './realm';
import { SupabaseBackend } from './supabaseBackend';
import type { ChatBackend } from './types';

/** `?chat=local` runs everything online against offline stand-ins (tests, demos). */
const local = () => new URLSearchParams(location.search).get('chat') === 'local';

let chat: ChatBackend | null = null;
let realm: RealmService | null = null;

/** One connection for the whole app (chat and realm share the same session). */
export function chatBackend(): ChatBackend {
  chat ??= local() ? new LocalBackend() : new SupabaseBackend();
  return chat;
}

export function realmService(): RealmService {
  if (!realm) {
    const c = chatBackend();
    realm = c instanceof SupabaseBackend ? new SupabaseRealm(c.client) : new LocalRealm();
  }
  return realm;
}
