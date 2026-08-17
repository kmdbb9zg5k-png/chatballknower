import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {NFL_TEAMS, PLAYERS_DATABASE} from './players';
import './index.css';

const ROSTER_URL='https://gpnboygoosrmeydwjpvk.supabase.co/functions/v1/nfl-roster-map?key=ballknower-roster-v1';
const TEAM_CACHE_KEY='ballknower_2026_official_roster_audit_v5';
const TEAM_CACHE_TTL=30*60*1000;

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
}

void syncCurrentTeams().finally(renderBallKnower);