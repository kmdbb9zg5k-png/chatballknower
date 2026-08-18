import { fantasyRequest } from './supabase';

type FantasyLeague = {
  id?: string;
  code?: string;
  name?: string;
  fantasy_members?: any[];
  fantasy_draft?: {
    id?: string;
    status?: string;
    current_pick?: number;
    current_round?: number;
    current_member_id?: string | null;
    scheduled_at?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
  } | null;
};

let cachedLeagues: FantasyLeague[] = [];
let refreshBusy = false;

function normalizeCode(value: string) {
  return String(value || '').trim().toUpperCase();
}

function getLeagueCodeFromCard(card: HTMLElement) {
  const match = String(card.textContent || '').match(/BKF-[A-Z0-9]{5}/i);
  return normalizeCode(match?.[0] || '');
}

function formatDraftTime(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isDraftLive(draft: FantasyLeague['fantasy_draft']) {
  if (!draft || draft.completed_at || draft.status === 'complete' || draft.status === 'completed') return false;
  if (draft.status === 'in_progress' || draft.status === 'drafting' || draft.started_at) return true;
  if (!draft.scheduled_at) return false;
  const scheduled = new Date(draft.scheduled_at).getTime();
  if (!Number.isFinite(scheduled)) return false;
  // Once the scheduled time arrives, treat the room as live/ready until the
  // backend explicitly completes it. This prevents a scheduled draft from
  // looking dormant just because the first pick has not been advanced yet.
  return scheduled <= Date.now();
}

function getOnClockName(league: FantasyLeague) {
  const id = league.fantasy_draft?.current_member_id;
  if (!id) return '';
  const member = (league.fantasy_members || []).find((m: any) => String(m?.id) === String(id));
  return String(member?.display_name || member?.team_name || '').trim();
}

function ensureStyles() {
  if (document.getElementById('bk-draft-card-enhancer-styles')) return;
  const style = document.createElement('style');
  style.id = 'bk-draft-card-enhancer-styles';
  style.textContent = `
    @keyframes bkDraftPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.38;transform:scale(.82)} }
    @keyframes bkDraftGlow { 0%,100%{box-shadow:0 0 0 rgba(34,197,94,0)} 50%{box-shadow:0 0 28px rgba(34,197,94,.12)} }
    [data-bk-draft-live="1"] { animation: bkDraftGlow 2.2s ease-in-out infinite; }
    .bk-draft-live-dot { animation: bkDraftPulse 1.15s ease-in-out infinite; }
  `;
  document.head.appendChild(style);
}

function findLeagueCards() {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
  return buttons.filter(button => {
    const text = String(button.textContent || '');
    return /BKF-[A-Z0-9]{5}/i.test(text) && /Open League HQ/i.test(text);
  });
}

function removeOldDecoration(card: HTMLElement) {
  card.querySelector('[data-bk-draft-banner]')?.remove();
  card.querySelector('[data-bk-draft-footer]')?.remove();
  card.removeAttribute('data-bk-draft-live');
  card.style.border = '';
  card.style.background = '';
  card.style.boxShadow = '';
  card.style.position = '';
  card.style.overflow = '';
}

function makeBanner(league: FantasyLeague) {
  const draft = league.fantasy_draft;
  const live = isDraftLive(draft);
  const scheduled = draft?.scheduled_at ? new Date(draft.scheduled_at).getTime() : NaN;
  const futureScheduled = Boolean(draft?.scheduled_at && Number.isFinite(scheduled) && scheduled > Date.now());
  const round = Math.max(1, Number(draft?.current_round || 1));
  const pick = Math.max(1, Number(draft?.current_pick || 1));
  const onClock = getOnClockName(league);

  const banner = document.createElement('div');
  banner.dataset.bkDraftBanner = '1';
  Object.assign(banner.style, {
    marginBottom: '14px',
    padding: '11px 12px',
    border: live ? '1px solid rgba(34,197,94,.65)' : futureScheduled ? '1px solid rgba(212,175,55,.45)' : '1px solid rgba(113,113,122,.22)',
    background: live ? 'rgba(34,197,94,.10)' : futureScheduled ? 'rgba(212,175,55,.08)' : 'rgba(63,63,70,.12)',
  });

  if (live) {
    banner.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:8px;color:#22c55e;font-size:11px;font-weight:950;letter-spacing:.16em">
          <span class="bk-draft-live-dot" style="display:inline-block;width:8px;height:8px;border-radius:999px;background:#22c55e;box-shadow:0 0 12px rgba(34,197,94,.75)"></span>
          LIVE DRAFT
        </div>
        <div style="font-size:10px;font-weight:900;color:#fff">ROUND ${round} • PICK ${pick}</div>
      </div>
      <div style="margin-top:6px;font-size:12px;font-weight:800;color:#d4d4d8">${onClock ? `${onClock} is on the clock` : 'Draft room is open now'}</div>
    `;
  } else if (futureScheduled) {
    banner.innerHTML = `
      <div style="font-size:10px;font-weight:950;letter-spacing:.14em;color:#D4AF37">DRAFT SCHEDULED</div>
      <div style="margin-top:5px;font-size:12px;font-weight:850;color:#e4e4e7">${formatDraftTime(draft?.scheduled_at)}</div>
    `;
  } else {
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:7px;font-size:10px;font-weight:900;letter-spacing:.12em;color:#71717a">
        <span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:#3f3f46"></span>
        NOT DRAFTING
      </div>
    `;
  }

  return banner;
}

function decorateCards() {
  if (!cachedLeagues.length) return;
  ensureStyles();
  const cards = findLeagueCards();
  if (!cards.length) return;

  let liveCard: HTMLElement | null = null;

  for (const card of cards) {
    const code = getLeagueCodeFromCard(card);
    const league = cachedLeagues.find(l => normalizeCode(String(l.code || '')) === code);
    if (!league) continue;

    removeOldDecoration(card);
    const live = isDraftLive(league.fantasy_draft);
    card.insertBefore(makeBanner(league), card.firstChild);

    const footer = document.createElement('div');
    footer.dataset.bkDraftFooter = '1';
    Object.assign(footer.style, {
      marginTop: '14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
      fontSize: '11px',
      fontWeight: '900',
    });
    footer.innerHTML = live
      ? '<span style="color:#22c55e">OPEN DRAFT HQ</span><span style="color:#22c55e;font-size:18px">→</span>'
      : '<span style="color:#71717a">OPEN LEAGUE HQ</span><span style="color:#71717a;font-size:16px">→</span>';

    const oldOpen = Array.from(card.querySelectorAll<HTMLElement>('div')).find(el => /Open League HQ/i.test(String(el.textContent || '')) && !el.dataset.bkDraftFooter);
    if (oldOpen) oldOpen.style.display = 'none';
    card.appendChild(footer);

    if (live) {
      card.dataset.bkDraftLive = '1';
      card.style.border = '2px solid rgba(34,197,94,.78)';
      card.style.background = 'radial-gradient(circle at top right, rgba(34,197,94,.12), transparent 42%), #111';
      card.style.boxShadow = '0 0 0 1px rgba(34,197,94,.12), 0 16px 45px rgba(0,0,0,.3)';
      card.style.position = 'relative';
      card.style.overflow = 'hidden';
      liveCard = card;
    } else if (league.fantasy_draft?.scheduled_at) {
      card.style.border = '1px solid rgba(212,175,55,.32)';
    }
  }

  // Keep the live draft first so it can never get lost among duplicate league names.
  if (liveCard?.parentElement && liveCard.parentElement.firstElementChild !== liveCard) {
    liveCard.parentElement.insertBefore(liveCard, liveCard.parentElement.firstElementChild);
  }
}

async function refreshLeagueDraftStates() {
  if (refreshBusy) return;
  refreshBusy = true;
  try {
    const result = await fantasyRequest('list');
    cachedLeagues = Array.isArray(result?.leagues) ? result.leagues : [];
    decorateCards();
  } catch (error) {
    console.warn('Ball Knower live draft card status unavailable', error);
  } finally {
    refreshBusy = false;
  }
}

function start() {
  ensureStyles();
  void refreshLeagueDraftStates();

  const root = document.getElementById('root');
  if (root) {
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        decorateCards();
      });
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  // Keep round/pick/on-clock state current while a manager leaves this page open.
  window.setInterval(() => void refreshLeagueDraftStates(), 10_000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
