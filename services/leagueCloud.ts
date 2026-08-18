import { League, LeagueMember, Player, TeamRatings, SeasonResult } from '../types';
import { ensureOnlineSession, isCloudConfigured, supabase } from '../lib/supabase';

type UserLike = { id:string; name:string; avatarUrl?:string };

const LEGACY_SEED_ID = 'league-ballers-2026';
const LEAGUE_STORAGE_KEY = 'ballknower_leagues_v1';

const leagueFromRows = (row:any, members:any[]):League => ({
  id: row.id,
  code: row.code,
  name: row.name,
  maxMembers: row.max_members,
  salaryCap: Number(row.salary_cap),
  commissionerId: row.commissioner_auth_id,
  commissionerName: row.commissioner_name,
  status: row.status,
  members: members.map(memberFromRow),
  seasonResult: row.season_result || undefined,
  createdAt: row.created_at,
  settings: row.settings || undefined,
});

const memberFromRow = (m:any):LeagueMember => ({
  id:m.id,
  userId:m.auth_user_id || m.app_user_id || m.id,
  userName:m.user_name,
  userAvatar:m.user_avatar || undefined,
  isCommissioner:Boolean(m.is_commissioner),
  isAi:Boolean(m.is_ai),
  aiArchetype:m.ai_archetype || undefined,
  status:m.status,
  roster:m.roster || undefined,
  teamRatings:m.team_ratings || undefined,
  submittedAt:m.submitted_at || undefined,
});

function readLegacySeed(authId?: string): League | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(LEAGUE_STORAGE_KEY) || '[]');
    const seed = Array.isArray(parsed) ? parsed.find((l:any) => l?.id === LEGACY_SEED_ID) : null;
    if (!seed) return null;
    if (!authId) return seed as League;
    const members = Array.isArray(seed.members) ? [...seed.members] : [];
    const commishIndex = Math.max(0, members.findIndex((m:any) => m?.isCommissioner));
    if (members[commishIndex]) members[commishIndex] = { ...members[commishIndex], userId: authId };
    return { ...seed, commissionerId: authId, members } as League;
  } catch {
    return null;
  }
}

function writeLegacySeed(seed: League) {
  if (typeof localStorage === 'undefined') return;
  try {
    const parsed = JSON.parse(localStorage.getItem(LEAGUE_STORAGE_KEY) || '[]');
    const leagues = Array.isArray(parsed) ? parsed : [];
    const next = [seed, ...leagues.filter((l:any) => l?.id !== LEGACY_SEED_ID)];
    localStorage.setItem(LEAGUE_STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

async function fetchMembers(leagueIds:string[]) {
  if (!supabase || leagueIds.length===0) return [];
  const { data,error }=await supabase.from('ball_knower_league_members').select('*').in('league_id',leagueIds);
  if(error) throw error;
  return data || [];
}

export async function loadMyCloudLeagues():Promise<League[]> {
  if(!isCloudConfigured || !supabase) return [];
  const user=await ensureOnlineSession();
  const {data:mine,error:mineError}=await supabase.from('ball_knower_league_members')
    .select('league_id').eq('auth_user_id',user.id);
  if(mineError) throw mineError;
  const ids=[...new Set((mine||[]).map((x:any)=>x.league_id))] as string[];
  const seed = readLegacySeed(user.id);
  if(!ids.length) return seed ? [seed] : [];
  const {data:rows,error}=await supabase.from('ball_knower_leagues').select('*').in('id',ids).order('created_at',{ascending:false});
  if(error) throw error;
  const members=await fetchMembers(ids);
  const cloud = (rows||[]).map((r:any)=>leagueFromRows(r,members.filter((m:any)=>m.league_id===r.id)));
  return seed ? [...cloud.filter(l => l.id !== LEGACY_SEED_ID), seed] : cloud;
}

export async function fetchCloudLeague(id:string):Promise<League|null> {
  if(!supabase) return null;
  const auth = await ensureOnlineSession();
  if (id === LEGACY_SEED_ID) return readLegacySeed(auth.id);
  const {data:row,error}=await supabase.from('ball_knower_leagues').select('*').eq('id',id).maybeSingle();
  if(error) throw error;
  if(!row) return null;
  const members=await fetchMembers([id]);
  return leagueFromRows(row,members);
}

function code() {
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out='BK-';
  for(let i=0;i<6;i++) out+=alphabet[Math.floor(Math.random()*alphabet.length)];
  return out;
}

export async function createCloudLeague(name:string,maxMembers:number,salaryCap:number,user:UserLike):Promise<League> {
  if(!supabase) throw new Error('Online multiplayer is not configured.');
  const auth=await ensureOnlineSession();
  const id=crypto.randomUUID();
  let created:any=null;
  for(let tries=0;tries<5;tries++){
    const payload={
      id, code:code(), name:name.trim()||'Ball Knower League',
      max_members:maxMembers, salary_cap:salaryCap,
      commissioner_auth_id:auth.id, commissioner_name:user.name, status:'drafting'
    };
    const {data,error}=await supabase.from('ball_knower_leagues').insert(payload).select().single();
    if(!error){created=data;break;}
    if(error.code!=='23505') throw error;
  }
  if(!created) throw new Error('Could not generate a unique league code.');

  const member={
    id:`member-${auth.id}-${Date.now()}`, league_id:id, auth_user_id:auth.id, app_user_id:auth.id,
    user_name:user.name, user_avatar:user.avatarUrl||null, is_commissioner:true, is_ai:false, status:'building'
  };
  const {error:memberError}=await supabase.from('ball_knower_league_members').insert(member);
  if(memberError) throw memberError;
  return leagueFromRows(created,[member]);
}

export async function joinCloudLeague(inviteCode:string,user:UserLike):Promise<League> {
  if(!supabase) throw new Error('Online multiplayer is not configured.');
  const auth=await ensureOnlineSession();
  const clean=inviteCode.trim().toUpperCase();

  const {data:row,error}=await supabase.from('ball_knower_leagues').select('*').eq('code',clean).maybeSingle();
  if(error) throw error;
  if(!row) throw new Error('League code not found. Check the code and try again.');

  const {data:existing,error:existingError}=await supabase.from('ball_knower_league_members')
    .select('*').eq('league_id',row.id).eq('auth_user_id',auth.id).maybeSingle();
  if(existingError) throw existingError;

  if(!existing){
    const member={
      id:`member-${auth.id}-${Date.now()}`, league_id:row.id, auth_user_id:auth.id, app_user_id:auth.id,
      user_name:user.name, user_avatar:user.avatarUrl||null, is_commissioner:false, is_ai:false, status:'building'
    };
    const {error:insertError}=await supabase.from('ball_knower_league_members').insert(member);
    if(insertError) {
      if(insertError.message?.toLowerCase().includes('full')) throw new Error('This league is full.');
      throw insertError;
    }
  }
  const members=await fetchMembers([row.id]);
  return leagueFromRows(row,members);
}

export async function saveMyCloudRoster(leagueId:string, roster:Player[], ratings:TeamRatings) {
  if(!supabase) return;
  const auth=await ensureOnlineSession();
  if (leagueId === LEGACY_SEED_ID) {
    const seed = readLegacySeed(auth.id);
    if (!seed) return;
    const submittedAt = new Date().toISOString();
    const members = seed.members.map(m => m.isCommissioner || m.userId === auth.id
      ? { ...m, userId: auth.id, status: 'ready' as const, roster, teamRatings: ratings, submittedAt }
      : m);
    writeLegacySeed({ ...seed, commissionerId: auth.id, members });
    return;
  }
  const {error}=await supabase.from('ball_knower_league_members').update({
    status:'ready', roster, team_ratings:ratings, submitted_at:new Date().toISOString()
  }).eq('league_id',leagueId).eq('auth_user_id',auth.id);
  if(error) throw error;
}

export async function updateCloudLeague(leagueId:string, patch:{
  salaryCap?:number; status?:string; seasonResult?:SeasonResult|null; settings?:any;
}) {
  if(!supabase) return;
  const auth = await ensureOnlineSession();
  if (leagueId === LEGACY_SEED_ID) {
    const seed = readLegacySeed(auth.id);
    if (!seed) return;
    const next: League = {
      ...seed,
      ...(patch.salaryCap !== undefined ? { salaryCap: patch.salaryCap } : {}),
      ...(patch.status !== undefined ? { status: patch.status as any } : {}),
      ...(patch.seasonResult !== undefined ? { seasonResult: patch.seasonResult || undefined } : {}),
      ...(patch.settings !== undefined ? { settings: patch.settings } : {}),
    };
    writeLegacySeed(next);
    return;
  }
  const data:any={};
  if(patch.salaryCap!==undefined) data.salary_cap=patch.salaryCap;
  if(patch.status!==undefined) data.status=patch.status;
  if(patch.seasonResult!==undefined) data.season_result=patch.seasonResult;
  if(patch.settings!==undefined) data.settings=patch.settings;
  const {error}=await supabase.from('ball_knower_leagues').update(data).eq('id',leagueId);
  if(error) throw error;
}

export async function upsertAiCloudMembers(leagueId:string, members:LeagueMember[]) {
  if(!supabase || !members.length) return;
  const auth = await ensureOnlineSession();
  if (leagueId === LEGACY_SEED_ID) {
    const seed = readLegacySeed(auth.id);
    if (!seed) return;
    const ids = new Set(members.map(m => m.id));
    writeLegacySeed({ ...seed, members: [...seed.members.filter(m => !ids.has(m.id)), ...members] });
    return;
  }
  const rows=members.map(m=>({
    id:m.id, league_id:leagueId, auth_user_id:null, app_user_id:m.userId,
    user_name:m.userName, user_avatar:m.userAvatar||null, is_commissioner:false, is_ai:true,
    ai_archetype:m.aiArchetype||null, status:m.status, roster:m.roster||null,
    team_ratings:m.teamRatings||null, submitted_at:m.submittedAt||null
  }));
  const {error}=await supabase.from('ball_knower_league_members').upsert(rows,{onConflict:'id'});
  if(error) throw error;
}

export async function deleteCloudMember(leagueId:string,memberId:string) {
  if(!supabase) return;
  const auth = await ensureOnlineSession();
  if (leagueId === LEGACY_SEED_ID) {
    const seed = readLegacySeed(auth.id);
    if (seed) writeLegacySeed({ ...seed, members: seed.members.filter(m => m.id !== memberId) });
    return;
  }
  const {error}=await supabase.from('ball_knower_league_members').delete().eq('league_id',leagueId).eq('id',memberId);
  if(error) throw error;
}

export function subscribeToCloudLeague(leagueId:string,onChange:()=>void) {
  if(!supabase || leagueId === LEGACY_SEED_ID) return ()=>{};
  const channel=supabase.channel(`ball-knower-${leagueId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'ball_knower_leagues',filter:`id=eq.${leagueId}`},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'ball_knower_league_members',filter:`league_id=eq.${leagueId}`},onChange)
    .subscribe();
  return ()=>{ supabase.removeChannel(channel); };
}