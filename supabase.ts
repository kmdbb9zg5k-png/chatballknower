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

// --- Fantasy progressive enhancers for the live compatibility build ---
// These mount into the existing League HQ so the live loader never needs a new route/module.

declare global {
  interface Window {
    __bkFantasyDraftEnhancer?: boolean;
    __bkFantasyNotificationPoller?: boolean;
    __bkFantasyLeagueLiveEnhancer?: boolean;
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

// ---------------------- LEAGUE LIVE ----------------------

type LeagueLiveModule = 'feed' | 'sunday' | 'trades' | 'assistant' | 'report' | 'history' | 'receipts';

function escapeHtml(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function shortTime(value: any) {
  const d = new Date(String(value || ''));
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function points(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(1) : '0.0';
}

function moduleTitle(module: LeagueLiveModule) {
  return ({ feed:'LEAGUE FEED', sunday:'SUNDAY LIVE', trades:'TRADE CENTER', assistant:'WHAT SHOULD I DO?', report:'LEAGUE REPORTER', history:'LEAGUE HISTORY', receipts:'RECEIPTS' } as Record<LeagueLiveModule,string>)[module];
}

function emptyState(title: string, text: string) {
  return `<div style="border:1px dashed #2b2b2b;background:#0c0c0c;padding:28px 18px;text-align:center"><div style="font-size:19px;font-weight:900;color:white">${escapeHtml(title)}</div><div style="font-size:13px;line-height:1.6;color:#71717a;margin-top:7px">${escapeHtml(text)}</div></div>`;
}

function leagueLiveShell(module: LeagueLiveModule, league: any) {
  return `
    <div style="position:sticky;top:0;z-index:2;background:rgba(9,9,9,.97);border-bottom:1px solid rgba(212,175,55,.25);padding:18px 18px 14px;backdrop-filter:blur(12px)">
      <div style="max-width:980px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div><div style="font-size:9px;font-weight:900;letter-spacing:.2em;color:#22c55e">${escapeHtml(league?.name || 'BALL KNOWER FANTASY')}</div><div style="font-size:27px;font-weight:950;color:white;margin-top:2px">${moduleTitle(module)}</div></div>
        <button id="bk-live-close" style="height:45px;width:45px;border:1px solid #333;background:#171717;color:white;font-size:25px">×</button>
      </div>
    </div>
    <div id="bk-live-content" style="max-width:980px;margin:auto;padding:18px 16px 70px;color:white">Loading…</div>`;
}

async function renderLeagueLive(module: LeagueLiveModule, league: any, overlay: HTMLElement) {
  overlay.innerHTML = leagueLiveShell(module, league);
  overlay.querySelector('#bk-live-close')?.addEventListener('click', () => { overlay.style.display = 'none'; });
  const content = overlay.querySelector('#bk-live-content') as HTMLElement | null;
  if (!content) return;

  try {
    const data = await fantasyApi('league_live', { leagueId: league.id });
    const me = data.me || {};
    const members = data.members || [];

    if (module === 'feed') {
      const posts = data.feed || [];
      content.innerHTML = `
        <div style="border:1px solid rgba(212,175,55,.28);background:#111;padding:15px;margin-bottom:14px">
          <div style="font-size:10px;font-weight:900;color:#D4AF37;letter-spacing:.16em">POST TO THE LEAGUE</div>
          <textarea id="bk-feed-text" maxlength="800" placeholder="Talk your talk…" style="width:100%;min-height:82px;margin-top:10px;background:#090909;border:1px solid #2c2c2c;color:white;padding:12px;font:inherit;resize:vertical"></textarea>
          <button id="bk-feed-post" style="width:100%;margin-top:9px;background:#D4AF37;color:black;border:0;padding:13px;font-weight:950">POST</button>
        </div>
        <div style="display:grid;gap:9px">${posts.length ? posts.map((p:any) => `<div style="border:1px solid #242424;background:#111;padding:14px"><div style="display:flex;justify-content:space-between;gap:12px"><b style="font-size:12px">${escapeHtml(p.member?.display_name || (p.post_type === 'system' ? 'BALL KNOWER' : 'Manager'))}</b><span style="font-size:10px;color:#52525b">${escapeHtml(shortTime(p.created_at))}</span></div><div style="font-size:14px;line-height:1.55;color:${p.post_type==='system'?'#D4AF37':'#d4d4d8'};margin-top:6px">${escapeHtml(p.body)}</div></div>`).join('') : emptyState('NO POSTS YET', 'Be the first manager to start the league conversation.')}</div>`;
      content.querySelector('#bk-feed-post')?.addEventListener('click', async () => {
        const input = content.querySelector('#bk-feed-text') as HTMLTextAreaElement | null;
        const text = input?.value.trim() || '';
        if (!text) return;
        const btn = content.querySelector('#bk-feed-post') as HTMLButtonElement | null;
        if (btn) { btn.disabled = true; btn.textContent = 'POSTING…'; }
        try { await fantasyApi('post_feed', { leagueId: league.id, text }); await renderLeagueLive('feed', league, overlay); }
        catch (e:any) { fantasyToast('COULD NOT POST', e?.message || 'Try again.'); if (btn) { btn.disabled = false; btn.textContent = 'POST'; } }
      });
      return;
    }

    if (module === 'sunday') {
      const matchups = data.matchups || [];
      content.innerHTML = `<div style="font-size:11px;color:#71717a;margin-bottom:12px">WEEK ${escapeHtml(data.week)} • Live matchup scores, remaining projections and win probability live here.</div><div style="display:grid;gap:12px">${matchups.length ? matchups.map((m:any) => `<div style="border:1px solid #292929;background:#111;padding:16px"><div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center"><div><div style="font-size:12px;color:#a1a1aa">${escapeHtml(m.home_member?.team_name || m.home_member?.display_name || 'HOME')}</div><div style="font-size:31px;font-weight:950">${points(m.home_points)}</div><div style="font-size:11px;color:#D4AF37">${escapeHtml(m.home_win_pct)}% WIN</div></div><div style="font-size:12px;color:#52525b;font-weight:900">VS</div><div style="text-align:right"><div style="font-size:12px;color:#a1a1aa">${escapeHtml(m.away_member?.team_name || m.away_member?.display_name || 'AWAY')}</div><div style="font-size:31px;font-weight:950">${points(m.away_points)}</div><div style="font-size:11px;color:#D4AF37">${escapeHtml(m.away_win_pct)}% WIN</div></div></div><div style="height:5px;background:#1f1f1f;margin-top:13px"><div style="height:100%;background:#D4AF37;width:${Math.max(0,Math.min(100,Number(m.home_win_pct||50)))}%"></div></div><div style="font-size:10px;color:#52525b;margin-top:8px">Projected: ${points(m.home_projected)} – ${points(m.away_projected)} • ${escapeHtml(String(m.status || 'scheduled').toUpperCase())}</div></div>`).join('') : emptyState('SUNDAY LIVE IS READY', 'Matchups will appear here when the fantasy schedule is generated. During games this becomes the live command center.')}</div>`;
      return;
    }

    if (module === 'trades') {
      const tx = data.transactions || [];
      const pendingForMe = tx.filter((t:any) => t.status === 'pending' && t.counterparty_member_id === me.id);
      content.innerHTML = `
        ${data.roster?.length ? `<div style="border:1px solid rgba(212,175,55,.25);background:#111;padding:14px;margin-bottom:12px"><div style="font-size:10px;font-weight:900;color:#D4AF37">YOUR TRADE ASSETS</div><div style="font-size:13px;color:#a1a1aa;margin-top:6px">${data.roster.length} rostered players are available to the trade engine.</div></div>` : emptyState('TRADE CENTER UNLOCKS AFTER THE DRAFT', 'Once managers have rosters, trade offers, counters, accept/reject actions and completed trades all live here.')}
        ${pendingForMe.map((t:any)=>`<div style="border:1px solid #D4AF37;background:rgba(212,175,55,.06);padding:15px;margin-top:10px"><div style="font-size:10px;color:#D4AF37;font-weight:900">NEW TRADE OFFER</div><div style="font-size:18px;font-weight:900;margin-top:4px">${escapeHtml(t.actor?.display_name || 'Manager')} → You</div><div style="font-size:12px;color:#a1a1aa;margin-top:5px">${escapeHtml(t.payload?.note || 'Review the offer.')}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><button data-trade="${escapeHtml(t.id)}" data-decision="accepted" style="background:#D4AF37;color:black;border:0;padding:12px;font-weight:900">ACCEPT</button><button data-trade="${escapeHtml(t.id)}" data-decision="rejected" style="background:#171717;color:white;border:1px solid #333;padding:12px;font-weight:900">REJECT</button></div></div>`).join('')}
        <div style="margin-top:14px"><div style="font-size:10px;font-weight:900;color:#D4AF37;margin-bottom:8px">TRADE HISTORY</div>${tx.length ? tx.map((t:any)=>`<div style="border-bottom:1px solid #222;padding:11px 2px"><div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:12px">${escapeHtml(t.actor?.display_name || 'Manager')} ↔ ${escapeHtml(t.counterparty?.display_name || 'Manager')}</b><span style="font-size:10px;color:${t.status==='accepted'?'#22c55e':'#71717a'}">${escapeHtml(String(t.status||'pending').toUpperCase())}</span></div><div style="font-size:11px;color:#52525b;margin-top:3px">${escapeHtml(t.payload?.note || shortTime(t.created_at))}</div></div>`).join('') : '<div style="font-size:13px;color:#52525b">No trade activity yet.</div>'}</div>`;
      content.querySelectorAll('[data-trade]').forEach(node => node.addEventListener('click', async () => {
        const el = node as HTMLElement;
        try { await fantasyApi('trade_update', { leagueId: league.id, transactionId: el.dataset.trade, decision: el.dataset.decision }); fantasyToast('TRADE UPDATED'); await renderLeagueLive('trades', league, overlay); }
        catch (e:any) { fantasyToast('TRADE ERROR', e?.message || 'Try again.'); }
      }));
      return;
    }

    if (module === 'assistant') {
      content.innerHTML = '<div style="color:#71717a">Analyzing your league…</div>';
      const result = await fantasyApi('assistant', { leagueId: league.id });
      const suggestions = result.suggestions || [];
      content.innerHTML = `<div style="border:1px solid rgba(212,175,55,.3);background:#111;padding:16px;margin-bottom:12px"><div style="font-size:10px;color:#D4AF37;font-weight:900;letter-spacing:.16em">ONE BUTTON. THREE MOVES.</div><div style="font-size:13px;color:#a1a1aa;margin-top:6px">Ball Knower reads your roster, record, FAAB and matchup state and gives you the next three priorities.</div></div><div style="display:grid;gap:10px">${suggestions.map((s:any,i:number)=>`<div style="border:1px solid #282828;background:#111;padding:16px"><div style="display:flex;justify-content:space-between;gap:10px"><span style="font-size:10px;font-weight:900;color:#D4AF37">0${i+1} • ${escapeHtml(s.type)}</span><span style="font-size:9px;font-weight:900;color:${s.priority==='HIGH'?'#22c55e':'#71717a'}">${escapeHtml(s.priority)}</span></div><div style="font-size:20px;font-weight:950;margin-top:5px">${escapeHtml(s.title)}</div><div style="font-size:13px;line-height:1.55;color:#a1a1aa;margin-top:6px">${escapeHtml(s.text)}</div></div>`).join('')}</div>`;
      return;
    }

    if (module === 'report') {
      content.innerHTML = '<div style="color:#71717a">Writing this week’s report…</div>';
      const result = await fantasyApi('generate_report', { leagueId: league.id, week: data.week || 1 });
      const r = result.report || {};
      const rankings = Array.isArray(r.power_rankings) ? r.power_rankings : [];
      content.innerHTML = `<div style="border:1px solid rgba(212,175,55,.35);background:#111;padding:18px"><div style="font-size:10px;color:#D4AF37;font-weight:900">WEEK ${escapeHtml(r.week || data.week || 1)} • BALL KNOWER REPORT</div><div style="font-size:28px;font-weight:950;line-height:1.05;margin-top:7px">${escapeHtml(r.headline || 'LEAGUE REPORT')}</div><div style="font-size:14px;line-height:1.6;color:#a1a1aa;margin-top:9px">${escapeHtml(r.summary || '')}</div></div><div style="margin-top:14px"><div style="font-size:10px;color:#D4AF37;font-weight:900;margin-bottom:8px">POWER RANKINGS</div>${rankings.length ? rankings.map((x:any)=>`<div style="display:grid;grid-template-columns:35px 1fr auto;align-items:center;border-bottom:1px solid #222;padding:10px 4px"><b style="color:#D4AF37">#${escapeHtml(x.rank)}</b><div><div style="font-size:13px;font-weight:900">${escapeHtml(x.team || x.name)}</div><div style="font-size:10px;color:#52525b">${escapeHtml(x.name)}</div></div><div style="font-size:12px;font-weight:900">${escapeHtml(x.record)}</div></div>`).join('') : '<div style="font-size:13px;color:#52525b">Rankings populate as results arrive.</div>'}</div>`;
      return;
    }

    if (module === 'history') {
      const history = data.history || [];
      const standings = [...members].sort((a:any,b:any)=>(Number(b.wins||0)-Number(a.wins||0))||(Number(b.points_for||0)-Number(a.points_for||0)));
      content.innerHTML = `<div style="border:1px solid #292929;background:#111;padding:16px"><div style="font-size:10px;color:#D4AF37;font-weight:900">CURRENT LEAGUE RECORD BOOK</div>${standings.map((m:any,i:number)=>`<div style="display:grid;grid-template-columns:30px 1fr auto;gap:8px;padding:10px 0;border-bottom:1px solid #222"><span style="color:#71717a">${i+1}</span><div><b style="font-size:13px">${escapeHtml(m.team_name || m.display_name)}</b><div style="font-size:10px;color:#52525b">${escapeHtml(m.display_name)}</div></div><div style="font-size:12px;font-weight:900">${escapeHtml(m.wins||0)}-${escapeHtml(m.losses||0)}</div></div>`).join('')}</div><div style="margin-top:14px"><div style="font-size:10px;color:#D4AF37;font-weight:900;margin-bottom:8px">PAST SEASONS</div>${history.length ? history.map((h:any)=>`<div style="border:1px solid #262626;background:#0e0e0e;padding:14px;margin-bottom:8px"><div style="font-size:20px;font-weight:950">${escapeHtml(h.season)} SEASON</div><div style="font-size:12px;color:#71717a;margin-top:4px">Permanent standings, draft board and awards snapshot saved.</div></div>`).join('') : emptyState('THE HISTORY STARTS HERE', 'Champions, draft boards, records and season snapshots will live here permanently.')}</div>${me.role==='commissioner'?'<button id="bk-history-save" style="width:100%;margin-top:12px;background:#D4AF37;color:black;border:0;padding:13px;font-weight:950">SAVE CURRENT SEASON SNAPSHOT</button>':''}`;
      content.querySelector('#bk-history-save')?.addEventListener('click', async () => {
        try { await fantasyApi('snapshot_history', { leagueId: league.id }); fantasyToast('LEAGUE HISTORY SAVED'); await renderLeagueLive('history', league, overlay); }
        catch (e:any) { fantasyToast('COULD NOT SAVE HISTORY', e?.message || 'Try again.'); }
      });
      return;
    }

    if (module === 'receipts') {
      const receipts = data.receipts || [];
      content.innerHTML = `<div style="border:1px solid rgba(212,175,55,.28);background:#111;padding:15px"><div style="font-size:10px;color:#D4AF37;font-weight:900">PUT IT ON THE RECORD</div><textarea id="bk-receipt-text" maxlength="300" placeholder="Example: My team wins this league." style="width:100%;min-height:78px;margin-top:9px;background:#090909;border:1px solid #2c2c2c;color:white;padding:12px;font:inherit"></textarea><button id="bk-receipt-save" style="width:100%;margin-top:8px;background:#D4AF37;color:black;border:0;padding:13px;font-weight:950">SAVE RECEIPT</button></div><div style="display:grid;gap:9px;margin-top:12px">${receipts.length ? receipts.map((r:any)=>`<div style="border:1px solid #292929;background:#111;padding:14px"><div style="display:flex;justify-content:space-between;gap:10px"><b style="font-size:12px">${escapeHtml(r.member?.display_name || 'Manager')}</b><span style="font-size:9px;font-weight:900;color:${r.status==='hit'?'#22c55e':r.status==='miss'?'#ef4444':'#D4AF37'}">${escapeHtml(String(r.status||'open').toUpperCase())}</span></div><div style="font-size:16px;font-weight:850;line-height:1.45;margin-top:7px">“${escapeHtml(r.take_text)}”</div><div style="font-size:10px;color:#52525b;margin-top:7px">${escapeHtml(shortTime(r.created_at))}</div>${me.role==='commissioner'&&r.status==='open'?`<div style="display:flex;gap:7px;margin-top:10px"><button data-receipt="${escapeHtml(r.id)}" data-status="hit" style="flex:1;border:1px solid #22c55e;background:rgba(34,197,94,.08);color:#22c55e;padding:9px;font-weight:900">HIT</button><button data-receipt="${escapeHtml(r.id)}" data-status="miss" style="flex:1;border:1px solid #ef4444;background:rgba(239,68,68,.08);color:#ef4444;padding:9px;font-weight:900">MISS</button></div>`:''}</div>`).join('') : emptyState('NO RECEIPTS YET', 'Save a preseason take, bold prediction or trash-talk promise. Ball Knower keeps it.')}</div>`;
      content.querySelector('#bk-receipt-save')?.addEventListener('click', async () => {
        const input = content.querySelector('#bk-receipt-text') as HTMLTextAreaElement | null;
        const take = input?.value.trim() || '';
        if (!take) return;
        try { await fantasyApi('add_receipt', { leagueId: league.id, take }); fantasyToast('RECEIPT SAVED', 'It is officially on the record.'); await renderLeagueLive('receipts', league, overlay); }
        catch (e:any) { fantasyToast('COULD NOT SAVE RECEIPT', e?.message || 'Try again.'); }
      });
      content.querySelectorAll('[data-receipt]').forEach(node => node.addEventListener('click', async () => {
        const el = node as HTMLElement;
        try { await fantasyApi('resolve_receipt', { leagueId: league.id, receiptId: el.dataset.receipt, status: el.dataset.status }); await renderLeagueLive('receipts', league, overlay); }
        catch (e:any) { fantasyToast('RECEIPT ERROR', e?.message || 'Try again.'); }
      }));
      return;
    }
  } catch (error:any) {
    content.innerHTML = emptyState('COULD NOT LOAD THIS MODULE', error?.message || 'Try again.');
  }
}

async function mountLeagueLive() {
  if (typeof document === 'undefined') return;
  const labels = Array.from(document.querySelectorAll('div')) as HTMLElement[];
  const label = labels.find(el => (el.textContent || '').trim().startsWith('LEAGUE HQ • BKF-'));
  if (!label) return;
  const section = label.closest('section') as HTMLElement | null;
  if (!section || section.querySelector('#bk-league-live-panel')) return;
  const code = (label.textContent || '').match(/BKF-[A-Z0-9]{5}/i)?.[0]?.toUpperCase();
  if (!code) return;

  try {
    const listed = await fantasyApi('list');
    const league = (listed.leagues || []).find((l:any)=>String(l.code).toUpperCase()===code);
    if (!league) return;

    const panel = document.createElement('div');
    panel.id = 'bk-league-live-panel';
    Object.assign(panel.style, { marginTop:'18px', border:'1px solid #292929', background:'#0b0b0b', padding:'15px' });
    panel.innerHTML = `<div style="display:flex;align-items:end;justify-content:space-between;gap:10px;margin-bottom:10px"><div><div style="font-size:10px;color:#22c55e;font-weight:900;letter-spacing:.18em">LEAGUE LIVE</div><div style="font-size:18px;font-weight:950;margin-top:2px">EVERYTHING THAT HAPPENS IN YOUR LEAGUE.</div></div><span style="font-size:9px;color:#52525b">LIVE HQ</span></div><div style="display:flex;gap:7px;overflow-x:auto;padding-bottom:2px">${[
      ['feed','💬','FEED'],['sunday','📺','SUNDAY LIVE'],['trades','🤝','TRADES'],['assistant','🧠','WHAT DO I DO?'],['report','🎤','REPORT'],['history','🏆','HISTORY'],['receipts','🧾','RECEIPTS']
    ].map(([id,icon,text])=>`<button data-bk-live="${id}" style="flex:0 0 auto;border:1px solid #333;background:#141414;color:white;padding:10px 11px;font-weight:900;font-size:10px;white-space:nowrap">${icon} ${text}</button>`).join('')}</div>`;
    section.appendChild(panel);

    let overlay = document.getElementById('bk-league-live-overlay') as HTMLElement | null;
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'bk-league-live-overlay';
      Object.assign(overlay.style, { display:'none', position:'fixed', inset:'0', zIndex:'100000', overflowY:'auto', background:'#090909', fontFamily:'inherit' });
      document.body.appendChild(overlay);
    }

    panel.querySelectorAll('[data-bk-live]').forEach(node => node.addEventListener('click', () => {
      const module = (node as HTMLElement).dataset.bkLive as LeagueLiveModule;
      if (!overlay) return;
      overlay.style.display = 'block';
      void renderLeagueLive(module, league, overlay);
    }));
  } catch {}
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (!window.__bkFantasyDraftEnhancer) {
    window.__bkFantasyDraftEnhancer = true;
    const observer = new MutationObserver(() => { void mountDraftScheduler(); void mountLeagueLive(); });
    const start = () => {
      observer.observe(document.documentElement, { childList: true, subtree: true });
      void mountDraftScheduler();
      void mountLeagueLive();
      window.setInterval(() => { void mountDraftScheduler(); void mountLeagueLive(); }, 4000);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
  if (!window.__bkFantasyLeagueLiveEnhancer) window.__bkFantasyLeagueLiveEnhancer = true;
  if (!window.__bkFantasyNotificationPoller) {
    window.__bkFantasyNotificationPoller = true;
    window.setTimeout(() => void pollFantasyNotifications(), 1500);
    window.setInterval(() => void pollFantasyNotifications(), 20000);
  }
}
