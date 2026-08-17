import { createClient, SupabaseClient } from '@supabase/supabase-js';

// These are public client credentials. Keep them here because the live Ball Knower
// loader reads this root compatibility file directly from GitHub.
const url = 'https://gpnboygoosrmeydwjpvk.supabase.co';
const key = 'sb_publishable_tgnOH0RUtswLI58isL5Qfw_Pq3xaV9h';
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
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { headers: { 'x-client-info': `ballknower-device/${cloudDeviceId}` } },
    })
  : null;

export async function ensureOnlineSession() {
  if (!supabase) throw new Error('Online multiplayer is not configured yet.');
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user;

  // Fantasy can operate with its private per-device UUID when the user has not
  // signed into Supabase. This avoids the disabled anonymous-signup provider.
  return { id: cloudDeviceId } as any;
}
