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

export async function fantasyRequest(action: string, payload: Record<string, any> = {}) {
  return fantasyApi(action, payload);
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
              code: p.code,
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

// --- Fantasy draft schedule + alert enhancer for the live compatibility build ---
// The current live Vercel loader cannot discover brand-new UI modules, so this
// small progressive enhancement mounts into League HQ without changing the page
// architecture. The backend remains the source of truth.

declare global {
  interface Window {
    __bkFantasyDraftEnhancer?: boolean;
    __bkFantasyNotificationPoller?: boolean;
  }
}

function draftTimeText(value: string | null | undefined) {
  if (!value) return 'Not scheduled yet';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return 'Not scheduled yet';
  return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function countdownText(value: string | null | undefined) {
  if (!value) return 'WAITING FOR COMMISSIONER';
  const ms = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(ms)) return 'WAITING FOR COMMISSIONER';
  if (ms <= 0) return 'DRAFT TIME';
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (days > 0) return `${days}D ${hours}H ${mins}M`;
  if (hours > 0) return `${hours}H ${mins}M ${secs}S`;
  return `${mins}M ${secs}S`;
}

function fantasyToast(title: string, body = '') {
  if (typeof document === 'undefined') return;
  const old = document.getElementById('bk-fantasy-alert-toast');
  old?.remove();
  const el = document.createElement('div');
  el.id = 'bk-fantasy-alert-toast';
  Object.assign(el.style, {
    position: 'fixed', left: '16px', right: '16px', bottom: '20px', zIndex: '99999',
    background: '#111', border: '1px solid #D4AF37', color: '#fff', padding: '16px',
    boxShadow: '0 16px 45px rgba(0,0,0,.55)', fontFamily: 'inherit',
  });
  el.innerHTML = `<div style="font-size:11px;font-weight:900;letter-spacing:.12em;color:#D4AF37">BALL KNOWER FANTASY</div><div style="font-size:18px;font-weight:900;margin-top:4px">${title}</div>${body ? `<div style="font-size:13px;color:#a1a1aa;margin-top:5px">${body}</div>` : ''}`;
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 8500);
}

async function enableDraftAlerts() {
  try {
    if (!('Notification' in window)) {
      fantasyToast('ADD BALL KNOWER TO YOUR HOME SCREEN', 'On iPhone, install the site to your Home Screen first to enable system draft notifications. In-app alerts will still work.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') fantasyToast('DRAFT ALERTS ENABLED', 'You will see Ball Knower draft alerts while the app is active.');
    else fantasyToast('NOTIFICATIONS NOT ENABLED', 'In-app draft alerts will still appear inside Ball Knower.');
  } catch {
    fantasyToast('DRAFT ALERTS', 'In-app alerts are active. iPhone system notifications require the Home Screen web app.');
  }
}

async function pollFantasyNotifications() {
  try {
    const result = await fantasyApi('notifications', { limit: 12 });
    const unread = (result.notifications || []).filter((n: any) => !n.read_at);
    if (!unread.length) return;
    // Oldest first so a 15-minute alert never overwrites a 1-minute alert.
    unread.reverse();
    for (const n of unread) {
      fantasyToast(String(n.title || 'Fantasy alert'), String(n.body || ''));
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(String(n.title || 'Ball Knower Fantasy'), { body: String(n.body || ''), tag: `bk-${n.id}` });
        }
      } catch {}
    }
    await fantasyApi('mark_notifications_read', { ids: unread.map((n: any) => n.id) });
  } catch {}
}

async function mountDraftScheduler() {
  if (typeof document === 'undefined') return;
  const labels = Array.from(document.querySelectorAll('div')) as HTMLElement[];
  const label = labels.find(el => (el.textContent || '').trim().startsWith('LEAGUE HQ • BKF-'));
  if (!label) return;
  const section = label.closest('section') as HTMLElement | null;
  if (!section || section.querySelector('#bk-draft-schedule-panel')) return;
  const match = (label.textContent || '').match(/BKF-[A-Z0-9]{5}/i);
  const code = match?.[0]?.toUpperCase();
  if (!code) return;

  try {
    const listed = await fantasyApi('list');
    const league = (listed.leagues || []).find((l: any) => String(l.code).toUpperCase() === code);
    if (!league) return;
    const me = (league.fantasy_members || []).find((m: any) => String(m.user_id) === cloudDeviceId);
    const isCommissioner = me?.role === 'commissioner';
    const scheduled = league.fantasy_draft?.scheduled_at || '';

    const panel = document.createElement('div');
    panel.id = 'bk-draft-schedule-panel';
    Object.assign(panel.style, { marginTop: '20px', border: '1px solid rgba(212,175,55,.35)', background: '#0b0b0b', padding: '18px' });
    panel.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <div style="font-size:10px;font-weight:900;letter-spacing:.18em;color:#D4AF37">DRAFT SCHEDULE</div>
          <div id="bk-draft-time-label" style="font-size:20px;font-weight:900;margin-top:5px">${draftTimeText(scheduled)}</div>
          <div id="bk-draft-countdown" style="font-size:12px;font-weight:900;color:#22c55e;margin-top:5px;letter-spacing:.08em">${countdownText(scheduled)}</div>
        </div>
        <button id="bk-enable-draft-alerts" style="border:1px solid rgba(212,175,55,.45);background:rgba(212,175,55,.08);color:#D4AF37;padding:11px 13px;font-weight:900;font-size:11px">🔔 ENABLE DRAFT ALERTS</button>
      </div>
      <div style="font-size:12px;color:#71717a;margin-top:10px">Automatic alerts: <b style="color:#d4d4d8">15 minutes before</b> • <b style="color:#d4d4d8">1 minute before</b> • <b style="color:#d4d4d8">when you're on the clock</b></div>
      ${isCommissioner ? `<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;margin-top:14px"><input id="bk-draft-datetime" type="datetime-local" style="min-width:0;background:#171717;border:1px solid #333;color:white;padding:12px;font:inherit"/><button id="bk-save-draft-time" style="background:#D4AF37;color:black;border:0;padding:12px 16px;font-weight:900">SET DRAFT TIME</button></div>` : `<div style="font-size:12px;color:#71717a;margin-top:14px">The commissioner controls the draft start time.</div>`}
    `;
    section.appendChild(panel);

    panel.querySelector('#bk-enable-draft-alerts')?.addEventListener('click', () => void enableDraftAlerts());

    const countdown = panel.querySelector('#bk-draft-countdown') as HTMLElement | null;
    const updateCountdown = () => { if (countdown) countdown.textContent = countdownText(league.fantasy_draft?.scheduled_at); };
    window.setInterval(updateCountdown, 1000);

    if (isCommissioner) {
      const input = panel.querySelector('#bk-draft-datetime') as HTMLInputElement | null;
      if (input && scheduled) {
        const d = new Date(scheduled);
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        input.value = local;
      }
      panel.querySelector('#bk-save-draft-time')?.addEventListener('click', async () => {
        if (!input?.value) return fantasyToast('CHOOSE A DRAFT TIME');
        const button = panel.querySelector('#bk-save-draft-time') as HTMLButtonElement | null;
        if (button) { button.disabled = true; button.textContent = 'SAVING…'; }
        try {
          const scheduledAt = new Date(input.value).toISOString();
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
          const result = await fantasyApi('schedule_draft', { leagueId: league.id, scheduledAt, timezone });
          league.fantasy_draft = { ...(league.fantasy_draft || {}), ...(result.draft || {}) };
          const timeLabel = panel.querySelector('#bk-draft-time-label') as HTMLElement | null;
          if (timeLabel) timeLabel.textContent = draftTimeText(result.draft?.scheduled_at);
          updateCountdown();
          fantasyToast('DRAFT TIME SET', `${draftTimeText(result.draft?.scheduled_at)}. Everyone in the league has been alerted.`);
        } catch (error: any) {
          fantasyToast('COULD NOT SET DRAFT TIME', error?.message || 'Try again.');
        } finally {
          if (button) { button.disabled = false; button.textContent = 'SET DRAFT TIME'; }
        }
      });
    }
  } catch {}
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (!window.__bkFantasyDraftEnhancer) {
    window.__bkFantasyDraftEnhancer = true;
    const observer = new MutationObserver(() => void mountDraftScheduler());
    const start = () => {
      observer.observe(document.documentElement, { childList: true, subtree: true });
      void mountDraftScheduler();
      window.setInterval(() => void mountDraftScheduler(), 4000);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
  if (!window.__bkFantasyNotificationPoller) {
    window.__bkFantasyNotificationPoller = true;
    window.setTimeout(() => void pollFantasyNotifications(), 1500);
    window.setInterval(() => void pollFantasyNotifications(), 20000);
  }
}
