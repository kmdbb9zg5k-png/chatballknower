import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {NFL_TEAMS, PLAYERS_DATABASE} from './players';
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

function renderBallKnower(){
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  installRealSoloTeamNames();
  installMaddenPlayerHeadshots();
}

void syncCurrentTeams().finally(renderBallKnower);