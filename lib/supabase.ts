import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const DEVICE_KEY = 'ballknower_cloud_device_v1';

function makeUuid() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function getCloudDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const created = makeUuid();
    localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    return makeUuid();
  }
}

const cloudDeviceId = getCloudDeviceId();

export const isCloudConfigured = Boolean(url && key && !url.includes('YOUR_PROJECT'));

export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { headers: { 'x-ball-knower-device': cloudDeviceId } },
    })
  : null;

export async function ensureOnlineSession() {
  if (!supabase) throw new Error('Online multiplayer is not configured yet.');
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user;

  // Prefer a real Supabase session when Anonymous Sign-Ins are enabled.
  // Ball Knower also supports a private per-device UUID so cloud leagues still
  // work when that Supabase Auth provider is disabled.
  try {
    const { data: signed } = await supabase.auth.signInAnonymously();
    if (signed.user) return signed.user;
  } catch {}

  return { id: cloudDeviceId } as any;
}
