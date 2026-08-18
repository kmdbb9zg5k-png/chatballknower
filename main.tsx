import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {NFL_TEAMS, PLAYERS_DATABASE} from './players';
import {fantasyRequest} from './supabase';
import './index.css';

const ROSTER_URL='https://gpnboygoosrmeydwjpvk.supabase.co/functions/v1/nfl-roster-map?key=ballknower-roster-v1';
const HEADSHOT_URL='https://gpnboygoosrmeydwjpvk.supabase.co/functions/v1/nfl-player-headshot';
const TEAM_CACHE_KEY='ballknower_2026_official_roster_audit_v5';
const TEAM_CACHE_TTL=30*60*1000;

// Solo originally used fictional CPU franchise names. Keep the balanced CPU
// roster engine, but present every opponent as its real NFL counterpart.
const SOLO_TEAM_NAME_MAP:Record<string,string>={
  'Baltimore Blackbirds':'Baltimore Ravens',
  'Buffalo Blizzard':'Buffalo Bills',
  'Miami Waves':'Miami Dolphins',
  'Boston Minutemen':'New England Patriots',
  'Cleveland Hounds':'Cleveland Browns',
  'Cincinnati Kings':'Cincinnati Bengals',
  'Pittsburgh Iron':'Pittsburgh Steelers',
  'Houston Outlaws':'Houston Texans',
  'Indianapolis Racers':'Indianapolis Colts',
  'Jacksonville Storm':'Jacksonville Jaguars',
  'Tennessee Copperheads':'Tennessee Titans',
  'Denver Peaks':'Denver Broncos',
  'Kansas City Monarchs':'Kansas City Chiefs',
  'Las Vegas Aces':'Las Vegas Raiders',
  'Los Angeles Bolts':'Los Angeles Chargers',
  'New York Knights':'New York Giants',
  'Dallas Wranglers':'Dallas Cowboys',
  'Philadelphia Liberty':'Philadelphia Eagles',
  'Washington Generals':'Washington Commanders',
  'Chicago Grizzlies':'Chicago Bears',
  'Detroit Motors':'Detroit Lions',
  'Green Bay Northmen':'Green Bay Packers',
  'Minnesota Valkyries':'Minnesota Vikings',
  'Atlanta Flight':'Atlanta Falcons',
  'Carolina Reapers':'Carolina Panthers',
  'New Orleans Krewe':'New Orleans Saints',
  'Tampa Bay Corsairs':'Tampa Bay Buccaneers',
  'Arizona Scorpions':'Arizona Cardinals',
  'Los Angeles Gold':'Los Angeles Rams',
  'San Francisco Rush':'San Francisco 49ers',
  'Seattle Orcas':'Seattle Seahawks',
};

function replaceSoloTeamNames(value:string){
  let out=value;
  for(const [fictional,real] of Object.entries(SOLO_TEAM_NAME_MAP)){
    if(out.includes(fictional))out=out.split(fictional).join(real);
  }
  return out;
}

function patchSoloTeamNamesInNode(node:Node){
  if(node.nodeType===Node.TEXT_NODE){
    const current=node.nodeValue||'';
    const next=replaceSoloTeamNames(current);
    if(next!==current)node.nodeValue=next;
    return;
  }
  if(node.nodeType!==Node.ELEMENT_NODE)return;
  const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
  let textNode:Node|null;
  while((textNode=walker.nextNode())){
    const current=textNode.nodeValue||'';
    const next=replaceSoloTeamNames(current);
    if(next!==current)textNode.nodeValue=next;
  }
}

function installRealSoloTeamNames(){
  const root=document.getElementById('root');
  if(!root)return;
  patchSoloTeamNamesInNode(root);
  const observer=new MutationObserver(mutations=>{
    for(const mutation of mutations){
      if(mutation.type==='characterData')patchSoloTeamNamesInNode(mutation.target);
      for(const node of Array.from(mutation.addedNodes))patchSoloTeamNamesInNode(node);
    }
  });
  observer.observe(root,{subtree:true,childList:true,characterData:true});
}

function normalizePlayerName(value:string){
  return String(value||'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\.?\b/g,' ')
    .replace(/[^a-z0-9]+/g,' ')
    .trim()
    .replace(/\s+/g,' ');
}

function headshotUrl(player:any){
  const params=new URLSearchParams({
    name:String(player?.name||''),
    team:String(player?.team||''),
    position:String(player?.position||''),
  });
  return `${HEADSHOT_URL}?${params.toString()}`;
}

function initialsFallback(name:string){
  const initials=String(name||'BK').trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'BK';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="140"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#242424"/><stop offset="1" stop-color="#0d0d0d"/></linearGradient></defs><rect width="120" height="140" rx="12" fill="url(#g)"/><rect x="2" y="2" width="116" height="136" rx="10" fill="none" stroke="#D4AF37" stroke-width="3"/><text x="60" y="84" text-anchor="middle" fill="#D4AF37" font-family="Arial" font-weight="900" font-size="38">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createPlayerHeadshot(player:any,width:number,height:number){
  const img=document.createElement('img');
  img.dataset.bkPlayerHeadshot='1';
  img.src=headshotUrl(player);
  img.alt=`${player.name} headshot`;
  img.loading='lazy';
  img.decoding='async';
  img.width=width;
  img.height=height;
  img.style.width=`${width}px`;
  img.style.height=`${height}px`;
  img.style.objectFit='cover';
  img.style.objectPosition='center top';
  img.style.flex='0 0 auto';
  img.style.borderRadius='8px';
  img.style.border='1px solid rgba(212,175,55,.35)';
  img.style.background='linear-gradient(180deg,#222,#0d0d0d)';
  img.style.boxShadow='inset 0 -12px 24px rgba(0,0,0,.28)';
  img.onerror=()=>{
    img.onerror=null;
    img.src=initialsFallback(player.name);
  };
  return img;
}

function installMaddenPlayerHeadshots(){
  const root=document.getElementById('root');
  if(!root)return;

  const byId=new Map<string,any>();
  const byName=new Map<string,any[]>();
  for(const player of PLAYERS_DATABASE){
    byId.set(String(player.id),player);
    const key=normalizePlayerName(player.name);
    const bucket=byName.get(key)||[];
    bucket.push(player);
    byName.set(key,bucket);
  }

  const chooseByText=(name:string,text:string)=>{
    const options=byName.get(normalizePlayerName(name))||[];
    if(options.length<=1)return options[0];
    const upper=String(text||'').toUpperCase();
    return options.find(p=>upper.includes(String(p.team||'').toUpperCase())&&upper.includes(String(p.position||'').toUpperCase()))||options[0];
  };

  const enhance=()=>{
    // Main Scout Market / Draft Board cards already expose a permanent player id.
    for(const card of Array.from(root.querySelectorAll<HTMLElement>('[id^="player-card-"]'))){
      if(card.dataset.bkHeadshotReady==='1')continue;
      const playerId=card.id.slice('player-card-'.length);
      const player=byId.get(playerId);
      if(!player)continue;
      const info=card.firstElementChild as HTMLElement|null;
      const image=createPlayerHeadshot(player,64,74);
      card.insertBefore(image,card.firstChild);
      card.style.columnGap='11px';
      if(info)info.style.flex='1 1 auto';
      card.dataset.bkHeadshotReady='1';
    }

    // Solo draft cards use the player's visible name instead of an id.
    for(const button of Array.from(root.querySelectorAll<HTMLButtonElement>('button'))){
      if(button.dataset.bkHeadshotReady==='1')continue;
      const nameNode=button.querySelector('b.block.truncate');
      if(!nameNode)continue;
      const name=String(nameNode.textContent||'').trim();
      const player=chooseByText(name,button.textContent||'');
      if(!player)continue;
      const image=createPlayerHeadshot(player,56,64);
      button.insertBefore(image,button.firstChild);
      button.style.gridTemplateColumns='56px minmax(0,1fr) auto auto auto';
      button.style.columnGap='10px';
      button.dataset.bkHeadshotReady='1';
    }
  };

  let queued=false;
  const queueEnhance=()=>{
    if(queued)return;
    queued=true;
    window.requestAnimationFrame(()=>{
      queued=false;
      enhance();
    });
  };

  enhance();
  const observer=new MutationObserver(queueEnhance);
  observer.observe(root,{subtree:true,childList:true});
}

function positionFamily(value:string){
  const p=String(value||'').toUpperCase().trim();
  if(['HB','FB','RB'].includes(p))return 'RB';
  if(['T','OT','LT','RT','G','OG','LG','RG','C','OL'].includes(p))return 'OL';
  if(['DE','EDGE','DT','NT','DL','DL_EDGE'].includes(p))return 'DL_EDGE';
  if(['OLB','ILB','MLB','LB'].includes(p))return 'LB';
  if(['CB','DB','FS','SS','S','SAF'].includes(p))return 'DB';
  return p;
}

function identity(name:string,position:string){
  return `${normalizePlayerName(name)}|${positionFamily(position)}`;
}

function apply2026RatingOverrides(){
  const overrides:Record<string,number>={
    'tyreek hill':92,
  };
  for(const player of PLAYERS_DATABASE){
    const rating=overrides[normalizePlayerName(player.name)];
    if(!rating)continue;
    player.ovr=rating;
    player.overallRating=rating;
    player.overall=rating;
    player.ratingSeason=2026;
    player.ratingSource='EA SPORTS Madden NFL 27';
    player.ratingStatus='VERIFIED';
  }
}

function applyRosterAudit(payload:any){
  const rows=Array.isArray(payload?.rows)?payload.rows:[];
  const retiredRows=Array.isArray(payload?.retired)?payload.retired:[];
  const aliases=Array.isArray(payload?.aliases)?payload.aliases:[];
  if(!rows.length)return {updated:0,freeAgents:0,removed:0,renamed:0};

  const byName=new Map<string,any[]>();
  for(const row of rows){
    const name=normalizePlayerName(String(row?.name||''));
    if(!name)continue;
    const bucket=byName.get(name)||[];
    bucket.push(row);
    byName.set(name,bucket);
  }

  const aliasByIdentity=new Map<string,string>();
  for(const row of aliases){
    const key=identity(String(row?.alias||''),String(row?.position||''));
    const current=String(row?.current||'').trim();
    if(key&&current)aliasByIdentity.set(key,current);
  }

  const retiredIds=new Set(retiredRows.map((row:any)=>identity(String(row?.name||''),String(row?.position||''))));
  const retiredNames=new Map<string,any[]>();
  for(const row of retiredRows){
    const key=normalizePlayerName(String(row?.name||''));
    const bucket=retiredNames.get(key)||[];
    bucket.push(row);
    retiredNames.set(key,bucket);
  }

  let updated=0,freeAgents=0,removed=0,renamed=0;
  for(let i=PLAYERS_DATABASE.length-1;i>=0;i--){
    const player=PLAYERS_DATABASE[i];
    const family=positionFamily(player.position);
    const originalName=player.name;
    const canonicalName=aliasByIdentity.get(identity(originalName,player.position))||originalName;
    const nameKey=normalizePlayerName(canonicalName);
    const candidates=byName.get(nameKey)||[];
    let match=candidates.find(row=>positionFamily(String(row?.position||''))===family);
    if(!match&&candidates.length===1)match=candidates[0];

    if(canonicalName!==originalName){
      player.name=canonicalName;
      renamed++;
    }

    if(match){
      const team=String(match.team||'').toUpperCase();
      const info=NFL_TEAMS.find(t=>t.code===team);
      if(player.team!==team)updated++;
      player.team=team;
      player.teamId=team;
      player.teamAbbreviation=team;
      player.active=true;
      player.rosterSeason=2026;
      player.rosterLastUpdated=String(payload?.updatedAt||new Date().toISOString());
      if(info){
        player.teamCity=info.city;
        player.teamName=info.name;
        player.conference=info.conference;
        player.division=info.division;
      }
      continue;
    }

    const retiredNameKey=normalizePlayerName(canonicalName);
    const retiredForName=retiredNames.get(retiredNameKey)||[];
    const isRetired=retiredIds.has(identity(canonicalName,player.position)) ||
      (retiredForName.length===1 && positionFamily(String(retiredForName[0]?.position||''))===family);
    if(isRetired){
      PLAYERS_DATABASE.splice(i,1);
      removed++;
      continue;
    }

    // Not on any of the 32 CURRENT NFL rosters and not retired = free agent.
    if(player.team!=='FA')updated++;
    player.team='FA';
    player.teamId='FA';
    player.teamAbbreviation='FA';
    player.teamCity='Free Agent';
    player.teamName='Free Agent';
    player.conference='';
    player.division='';
    player.active=true;
    player.rosterSeason=2026;
    player.rosterLastUpdated=String(payload?.updatedAt||new Date().toISOString());
    freeAgents++;
  }

  apply2026RatingOverrides();
  return {updated,freeAgents,removed,renamed};
}

async function syncCurrentTeams(){
  try{
    const cachedRaw=localStorage.getItem(TEAM_CACHE_KEY);
    if(cachedRaw){
      const cached=JSON.parse(cachedRaw);
      if(cached?.savedAt&&Date.now()-Number(cached.savedAt)<TEAM_CACHE_TTL&&cached?.payload){
        const result=applyRosterAudit(cached.payload);
        console.info('Ball Knower official roster audit (cache)',result);
        return;
      }
    }
  }catch{}

  try{
    const response=await fetch(ROSTER_URL,{cache:'no-store'});
    if(!response.ok)throw new Error(`Roster audit failed (${response.status})`);
    const payload=await response.json();
    const result=applyRosterAudit(payload);
    console.info('Ball Knower official roster audit',result);
    try{localStorage.setItem(TEAM_CACHE_KEY,JSON.stringify({savedAt:Date.now(),payload}));}catch{}
  }catch(error){
    console.warn('2026 official roster audit unavailable; using bundled teams',error);
    apply2026RatingOverrides();
  }
}

type FantasyLeagueDraftState={
  code?:string;
  fantasy_members?:any[];
  fantasy_draft?:{
    status?:string;
    current_pick?:number;
    current_round?:number;
    current_member_id?:string|null;
    scheduled_at?:string|null;
    started_at?:string|null;
    completed_at?:string|null;
  }|null;
};

let fantasyDraftLeagueCache:FantasyLeagueDraftState[]=[];
let fantasyDraftRefreshBusy=false;

function normalizeFantasyCode(value:string){return String(value||'').trim().toUpperCase();}
function fantasyDraftIsLive(draft:FantasyLeagueDraftState['fantasy_draft']){
  if(!draft||draft.completed_at||['complete','completed'].includes(String(draft.status||'')))return false;
  if(['in_progress','drafting'].includes(String(draft.status||''))||draft.started_at)return true;
  if(!draft.scheduled_at)return false;
  const scheduled=new Date(draft.scheduled_at).getTime();
  return Number.isFinite(scheduled)&&scheduled<=Date.now();
}
function fantasyDraftTime(value?:string|null){
  if(!value)return'';
  const d=new Date(value);if(!Number.isFinite(d.getTime()))return'';
  return d.toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}
function fantasyDraftOnClockName(league:FantasyLeagueDraftState){
  const id=league.fantasy_draft?.current_member_id;if(!id)return'';
  const member=(league.fantasy_members||[]).find((m:any)=>String(m?.id)===String(id));
  return String(member?.display_name||member?.team_name||'').trim();
}
function installFantasyDraftCardStyles(){
  if(document.getElementById('bk-live-draft-card-style'))return;
  const style=document.createElement('style');style.id='bk-live-draft-card-style';
  style.textContent='@keyframes bkDraftPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.82)}}@keyframes bkDraftGlow{0%,100%{box-shadow:0 0 0 rgba(34,197,94,0)}50%{box-shadow:0 0 30px rgba(34,197,94,.14)}}[data-bk-draft-live="1"]{animation:bkDraftGlow 2.2s ease-in-out infinite}.bk-draft-live-dot{animation:bkDraftPulse 1.15s ease-in-out infinite}';
  document.head.appendChild(style);
}
function fantasyLeagueCards(){
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter(button=>{
    const text=String(button.textContent||'');
    return /BKF-[A-Z0-9]{5}/i.test(text)&&/Open League HQ/i.test(text);
  });
}
function decorateFantasyDraftCards(){
  if(!fantasyDraftLeagueCache.length)return;
  installFantasyDraftCardStyles();
  const cards=fantasyLeagueCards();if(!cards.length)return;
  let liveCard:HTMLElement|null=null;
  for(const card of cards){
    const code=normalizeFantasyCode(String(card.textContent||'').match(/BKF-[A-Z0-9]{5}/i)?.[0]||'');
    const league=fantasyDraftLeagueCache.find(l=>normalizeFantasyCode(String(l.code||''))===code);if(!league)continue;
    const draft=league.fantasy_draft;
    const live=fantasyDraftIsLive(draft);
    const scheduledMs=draft?.scheduled_at?new Date(draft.scheduled_at).getTime():NaN;
    const future=Boolean(draft?.scheduled_at&&Number.isFinite(scheduledMs)&&scheduledMs>Date.now());
    const round=Math.max(1,Number(draft?.current_round||1));
    const pick=Math.max(1,Number(draft?.current_pick||1));
    const onClock=fantasyDraftOnClockName(league);
    const signature=[live,future,draft?.status||'',draft?.scheduled_at||'',round,pick,draft?.current_member_id||''].join('|');
    if(card.dataset.bkDraftSignature===signature){if(live)liveCard=card;continue;}
    card.dataset.bkDraftSignature=signature;
    card.querySelector('[data-bk-draft-banner]')?.remove();
    card.querySelector('[data-bk-draft-footer]')?.remove();
    card.removeAttribute('data-bk-draft-live');
    card.style.border='';card.style.background='';card.style.boxShadow='';card.style.position='';card.style.overflow='';
    const banner=document.createElement('div');banner.dataset.bkDraftBanner='1';
    Object.assign(banner.style,{marginBottom:'14px',padding:'11px 12px',border:live?'1px solid rgba(34,197,94,.7)':future?'1px solid rgba(212,175,55,.5)':'1px solid rgba(113,113,122,.22)',background:live?'rgba(34,197,94,.10)':future?'rgba(212,175,55,.08)':'rgba(63,63,70,.10)'});
    if(live)banner.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><div style="display:flex;align-items:center;gap:8px;color:#22c55e;font-size:11px;font-weight:950;letter-spacing:.16em"><span class="bk-draft-live-dot" style="display:inline-block;width:8px;height:8px;border-radius:999px;background:#22c55e;box-shadow:0 0 12px rgba(34,197,94,.75)"></span>LIVE DRAFT</div><div style="font-size:10px;font-weight:900;color:#fff">ROUND ${round} • PICK ${pick}</div></div><div style="margin-top:6px;font-size:12px;font-weight:800;color:#d4d4d8">${onClock?`${onClock} is on the clock`:'Draft room is open now'}</div>`;
    else if(future)banner.innerHTML=`<div style="font-size:10px;font-weight:950;letter-spacing:.14em;color:#D4AF37">DRAFT SCHEDULED</div><div style="margin-top:5px;font-size:12px;font-weight:850;color:#e4e4e7">${fantasyDraftTime(draft?.scheduled_at)}</div>`;
    else banner.innerHTML='<div style="display:flex;align-items:center;gap:7px;font-size:10px;font-weight:900;letter-spacing:.12em;color:#71717a"><span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:#3f3f46"></span>NOT DRAFTING</div>';
    card.insertBefore(banner,card.firstChild);
    const oldOpen=Array.from(card.querySelectorAll<HTMLElement>('div')).find(el=>/Open League HQ/i.test(String(el.textContent||''))&&!el.dataset.bkDraftFooter);if(oldOpen)oldOpen.style.display='none';
    const footer=document.createElement('div');footer.dataset.bkDraftFooter='1';Object.assign(footer.style,{marginTop:'14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px',fontSize:'11px',fontWeight:'900'});
    footer.innerHTML=live?'<span style="color:#22c55e">OPEN DRAFT HQ</span><span style="color:#22c55e;font-size:18px">→</span>':'<span style="color:#71717a">OPEN LEAGUE HQ</span><span style="color:#71717a;font-size:16px">→</span>';
    card.appendChild(footer);
    if(live){card.dataset.bkDraftLive='1';card.style.border='2px solid rgba(34,197,94,.8)';card.style.background='radial-gradient(circle at top right,rgba(34,197,94,.13),transparent 44%),#111';card.style.boxShadow='0 0 0 1px rgba(34,197,94,.12),0 16px 45px rgba(0,0,0,.3)';card.style.position='relative';card.style.overflow='hidden';liveCard=card;}
    else if(future)card.style.border='1px solid rgba(212,175,55,.35)';
  }
  if(liveCard?.parentElement&&liveCard.parentElement.firstElementChild!==liveCard)liveCard.parentElement.insertBefore(liveCard,liveCard.parentElement.firstElementChild);
}
async function refreshFantasyDraftCards(){
  if(fantasyDraftRefreshBusy)return;fantasyDraftRefreshBusy=true;
  try{const result=await fantasyRequest('list');fantasyDraftLeagueCache=Array.isArray(result?.leagues)?result.leagues:[];decorateFantasyDraftCards();}
  catch(error){console.warn('Fantasy live draft card status unavailable',error);}finally{fantasyDraftRefreshBusy=false;}
}
function installFantasyDraftCardStatus(){
  installFantasyDraftCardStyles();void refreshFantasyDraftCards();
  const root=document.getElementById('root');if(root){let queued=false;const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorateFantasyDraftCards();});});observer.observe(root,{childList:true,subtree:true});}
  window.setInterval(()=>void refreshFantasyDraftCards(),10000);
}

function renderBallKnower(){
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  installRealSoloTeamNames();
  installMaddenPlayerHeadshots();
  installFantasyDraftCardStatus();
}

void syncCurrentTeams().finally(renderBallKnower);