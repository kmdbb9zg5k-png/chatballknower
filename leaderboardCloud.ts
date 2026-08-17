import { ensureOnlineSession, isCloudConfigured, supabase } from '../lib/supabase';
import { CareerProfile } from '../utils/soloSeasonEngine';
import { calculateBkRating } from '../soloImmersion';

export interface CareerPublishExtras {
  favoriteTeam?:string;
  bestRoster?:unknown;
  lastRunSummary?:unknown;
}

export async function publishCareer(displayName:string,c:CareerProfile,extras:CareerPublishExtras={}){
 if(!isCloudConfigured||!supabase)return;
 const u=await ensureOnlineSession();
 const payload:any={
  auth_user_id:u.id,
  display_name:displayName||'Ball Knower GM',
  championships:c.championships,
  career_wins:c.regularWins,
  career_losses:c.regularLosses,
  playoff_wins:c.playoffWins,
  best_ball_knower_score:c.bestScore,
  bk_rating:calculateBkRating(c),
  best_record:c.bestRecord,
  perfect_seasons:c.perfectSeasons,
  achievements:c.achievements||[],
  updated_at:new Date().toISOString(),
 };
 if(extras.favoriteTeam!==undefined)payload.favorite_team=extras.favoriteTeam||null;
 if(extras.bestRoster!==undefined)payload.best_roster=extras.bestRoster;
 if(extras.lastRunSummary!==undefined)payload.last_run_summary=extras.lastRunSummary;
 const {error}=await supabase.from('ball_knower_leaderboard').upsert(payload,{onConflict:'auth_user_id'}); if(error)throw error;
}

export async function updateProfileMeta(displayName:string,c:CareerProfile,favoriteTeam:string){
 return publishCareer(displayName,c,{favoriteTeam});
}

export async function fetchLeaderboard(){
 if(!isCloudConfigured||!supabase)return [];
 await ensureOnlineSession();
 const {data,error}=await supabase.from('ball_knower_leaderboard').select('*')
  .order('bk_rating',{ascending:false})
  .order('championships',{ascending:false})
  .order('best_ball_knower_score',{ascending:false})
  .limit(100);
 if(error)throw error; return data||[];
}

export async function fetchMyCloudProfile(){
 if(!isCloudConfigured||!supabase)return null;
 const u=await ensureOnlineSession();
 const {data,error}=await supabase.from('ball_knower_leaderboard').select('*').eq('auth_user_id',u.id).maybeSingle();
 if(error)throw error; return data||null;
}
