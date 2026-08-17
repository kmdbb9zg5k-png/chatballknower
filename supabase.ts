import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Public client configuration used by the live compatibility loader.
const url = 'https://gpnboygoosrmeydwjpvk.supabase.co';
const key = 'sb_publishable_tgnOH0RUtswLI58isL5Qfw_Pq3xaV9h';
const FANTASY_API = `${url}/functions/v1/fantasy-api`;
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

const realSupabase = isCloudConfigured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

async function fantasyApi(action: string, payload: Record<string, any> = {}) {
  const response = await fetch(FANTASY_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, deviceId: cloudDeviceId, ...payload }),
  });
  let data: any = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data?.error || `Fantasy cloud failed (${response.status})`);
  return data || {};
}

function ok(data: any = null) { return { data, error: null }; }
function fail(error: any) { return { data: null, error: error instanceof Error ? error : new Error(String(error || 'Fantasy cloud failed')) }; }

function fantasyLeagueBuilder(mode: 'select' | 'insert' = 'select', insertPayload?: any) {
  let leagueId = '';
  const builder: any = {
    select() { return builder; },
    eq(field: string, value: any) { if (field === 'id') leagueId = String(value || ''); return builder; },
    async order() {
      try {
        const result = await fantasyApi('list');
        return ok(result.leagues || []);
      } catch (error) { return fail(error); }
    },
    async single() {
      try {
        if (mode === 'insert') {
          const p = insertPayload || {};
          const result = await fantasyApi('create', {
            league: {
              name: p.name,
              teamCount: p.team_count,
              format: p.format,
              draftType: p.draft_type,
              scoring: p.scoring_format,
              waiver: p.waiver_type,
              playoffTeams: p.playoff_teams,
              combine: p.ball_knower_combine,
            },
            displayName: 'Commissioner',
          });
          return ok(result.league || null);
        }
        if (!leagueId) return fail(new Error('Fantasy league ID missing.'));
        const result = await fantasyApi('get', { leagueId });
        return ok(result.league || null);
      } catch (error) { return fail(error); }
    },
  };
  return builder;
}

function fantasyFrom(table: string) {
  if (table === 'fantasy_leagues') {
    return {
      select() { return fantasyLeagueBuilder('select'); },
      insert(payload: any) { return fantasyLeagueBuilder('insert', payload); },
    } as any;
  }

  // The Fantasy API creates the commissioner membership, draft shell and scoring
  // row atomically with the league. The current UI still performs these legacy
  // follow-up inserts, so acknowledge them without issuing duplicate writes.
  if (table === 'fantasy_members' || table === 'fantasy_drafts' || table === 'fantasy_scoring_rules') {
    return {
      async insert(_payload: any) { return ok(null); },
    } as any;
  }

  return realSupabase!.from(table);
}

const fantasyAwareClient: any = realSupabase
  ? new Proxy(realSupabase as any, {
      get(target, prop, receiver) {
        if (prop === 'from') return (table: string) => table.startsWith('fantasy_') ? fantasyFrom(table) : target.from(table);
        if (prop === 'rpc') return async (fn: string, args: any = {}) => {
          if (fn === 'join_fantasy_league_by_code') {
            try {
              const result = await fantasyApi('join', {
                code: args?.p_code,
                displayName: args?.p_display_name || 'Ball Knower',
              });
              return ok(result.league?.id || null);
            } catch (error) { return fail(error); }
          }
          return target.rpc(fn, args);
        };
        return Reflect.get(target, prop, receiver);
      },
    })
  : null;

export const supabase: SupabaseClient | null = fantasyAwareClient as SupabaseClient | null;

export async function ensureOnlineSession() {
  if (!realSupabase) throw new Error('Online multiplayer is not configured yet.');
  try {
    const { data } = await realSupabase.auth.getSession();
    if (data.session?.user) return data.session.user;
  } catch {}
  return { id: cloudDeviceId } as any;
}
