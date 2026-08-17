import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {NFL_TEAMS, PLAYERS_DATABASE} from './players';
import './index.css';

const ROSTER_URL='https://gpnboygoosrmeydwjpvk.supabase.co/functions/v1/nfl-roster-map?key=ballknower-roster-v1';
const TEAM_CACHE_KEY='ballknower_2026_team_map_v2';
const TEAM_CACHE_TTL=60*60*1000;

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

function normalizePosition(value:string){
  const p=String(value||'').toUpperCase().trim();
  if(['DE','EDGE'].includes(p)) return 'EDGE';
  if(['OLB','ILB','MLB','LB'].includes(p)) return 'LB';
  if(['FS','SS','S','SAF'].includes(p)) return 'S';
  if(['NT','DT'].includes(p)) return 'DT';
  if(['OG','G'].includes(p)) return 'G';
  if(['OT','T'].includes(p)) return 'OT';
  return p;
}

function applyTeamPayload(payload:any){
  const rows=Array.isArray(payload?.rows)?payload.rows:[];
  if(!rows.length)return 0;

  const byName=new Map<string,any[]>();
  for(const row of rows){
    const name=normalizePlayerName(String(row?.name||''));
    const team=String(row?.team||'').toUpperCase();
    if(!name||!team)continue;
    const bucket=byName.get(name)||[];
    bucket.push(row);
    byName.set(name,bucket);
  }

  let updated=0;
  for(const player of PLAYERS_DATABASE){
    const candidates=byName.get(normalizePlayerName(player.name))||[];
    if(!candidates.length)continue;

    const wantedPosition=normalizePosition(player.position);
    let match=candidates.find(row=>normalizePosition(String(row?.position||''))===wantedPosition);
    if(!match&&candidates.length===1)match=candidates[0];
    if(!match)continue;

    const team=String(match.team||'').toUpperCase();
    const info=NFL_TEAMS.find(t=>t.code===team);
    if(player.team!==team)updated++;
    player.team=team;
    player.teamId=team;
    player.teamAbbreviation=team;
    player.rosterSeason=2026;
    player.rosterLastUpdated=String(payload?.updatedAt||new Date().toISOString());
    if(info){
      player.teamCity=info.city;
      player.teamName=info.name;
      player.conference=info.conference;
      player.division=info.division;
    }
  }
  return updated;
}

async function syncCurrentTeams(){
  try{
    const cachedRaw=localStorage.getItem(TEAM_CACHE_KEY);
    if(cachedRaw){
      const cached=JSON.parse(cachedRaw);
      if(cached?.savedAt&&Date.now()-Number(cached.savedAt)<TEAM_CACHE_TTL&&cached?.payload){
        applyTeamPayload(cached.payload);
        return;
      }
    }
  }catch{}

  try{
    const response=await fetch(ROSTER_URL,{cache:'no-store'});
    if(!response.ok)throw new Error(`Roster sync failed (${response.status})`);
    const payload=await response.json();
    applyTeamPayload(payload);
    try{localStorage.setItem(TEAM_CACHE_KEY,JSON.stringify({savedAt:Date.now(),payload}));}catch{}
  }catch(error){
    console.warn('2026 live team sync unavailable; using bundled teams',error);
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