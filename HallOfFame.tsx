import React, { useEffect, useState } from 'react';
import { Crown, Trophy, Wifi, WifiOff, Newspaper, RefreshCw, ExternalLink, Zap, Activity } from 'lucide-react';
import { fetchLeaderboard } from '../services/leaderboardCloud';
import { isCloudConfigured } from '../lib/supabase';
import { defaultCareer, CareerProfile } from '../utils/soloSeasonEngine';

const CAREER_KEY='ballknower_solo_career_v1';
const NEWS_ENDPOINT='https://gpnboygoosrmeydwjpvk.supabase.co/functions/v1/nfl-news-wire';

export const HallOfFame:React.FC=()=>{
 const [rows,setRows]=useState<any[]>([]);
 const [career]=useState<CareerProfile>(()=>{try{return JSON.parse(localStorage.getItem(CAREER_KEY)||'null')||defaultCareer()}catch{return defaultCareer()}});
 const [loading,setLoading]=useState(isCloudConfigured);
 useEffect(()=>{if(!isCloudConfigured)return;fetchLeaderboard().then(setRows).catch(()=>setRows([])).finally(()=>setLoading(false))},[]);
 return <div className="min-h-screen bg-[#090909] text-white px-4 sm:px-8 py-10"><div className="max-w-5xl mx-auto">
  <div className="text-center mb-8"><Crown className="mx-auto text-[#D4AF37]" size={55}/><div className="text-xs text-[#D4AF37] font-black tracking-[.3em] mt-3">BALL KNOWER LEGACY</div><h2 className="text-5xl font-black">HALL OF FAME</h2><p className="text-zinc-400 mt-2">Championships, career wins, perfect seasons, and the highest Ball Knower scores.</p></div>
  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
   <Stat l="Your Titles" v={career.championships}/><Stat l="Career W-L" v={`${career.regularWins}-${career.regularLosses}`}/><Stat l="Playoff Wins" v={career.playoffWins}/><Stat l="Best Record" v={career.bestRecord}/><Stat l="Best BK" v={career.bestScore}/><Stat l="Perfect Seasons" v={career.perfectSeasons}/>
  </div>
  <div className="bg-[#111] border border-white/10">
   <div className="p-4 border-b border-white/10 flex justify-between items-center"><h3 className="font-black text-xl flex gap-2 items-center"><Trophy className="text-[#D4AF37]"/>GLOBAL LEADERBOARD</h3><span className={`text-xs font-black flex gap-1 items-center ${isCloudConfigured?'text-green-400':'text-amber-300'}`}>{isCloudConfigured?<><Wifi size={14}/> ONLINE</>:<><WifiOff size={14}/> CONNECT SUPABASE</>}</span></div>
   {!isCloudConfigured?<div className="p-10 text-center text-zinc-500">Connect the included Supabase backend and completed Solo runs will automatically publish here.</div>:loading?<div className="p-10 text-center text-zinc-500">Loading legends...</div>:rows.length===0?<div className="p-10 text-center text-zinc-500">No published runs yet. Be the first.</div>:
   <div className="divide-y divide-white/5">{rows.map((r,i)=><div key={r.auth_user_id} className="grid grid-cols-[50px_1fr_repeat(3,auto)] gap-4 items-center p-4"><div className="text-xl font-black text-[#D4AF37]">{i===0?'👑':i===1?'🥈':i===2?'🥉':`#${i+1}`}</div><div><div className="font-black">{r.display_name}</div><div className="text-xs text-zinc-500">{r.best_record} best record</div></div><Cell l="RINGS" v={r.championships}/><Cell l="WINS" v={r.career_wins}/><Cell l="BK" v={r.best_ball_knower_score}/></div>)}</div>}
  </div>
  {career.achievements.length>0&&<div className="mt-8 bg-[#111] border border-white/10 p-5"><h3 className="font-black text-[#D4AF37] mb-3">YOUR TROPHY CASE</h3><div className="flex flex-wrap gap-2">{career.achievements.map(a=><span key={a} className="border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-2 text-xs font-black">🏆 {a}</span>)}</div></div>}
 </div></div>
}

interface NewsItem { id:string; title:string; summary:string; url:string; source:string; source_type:string; category:string; team:string|null; published_at:string; created_at:string; }
const NEWS_CATEGORIES=[['all','ALL'],['trade','TRADES'],['contract','CONTRACTS'],['signing','SIGNINGS'],['injury','INJURIES'],['camp','CAMP'],['roster','ROSTER'],['retirement','RETIREMENTS'],['news','LATEST']];
const NEWS_TEAMS=['ALL','ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAC','KC','LV','LAC','LAR','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'];

function ago(value:string){
 const diff=Math.max(0,Date.now()-new Date(value).getTime()); const min=Math.floor(diff/60000);
 if(min<1)return 'NOW'; if(min<60)return `${min}M AGO`; const hr=Math.floor(min/60); if(hr<24)return `${hr}H AGO`; return `${Math.floor(hr/24)}D AGO`;
}
function newsTone(category:string){
 if(category==='trade')return 'text-cyan-300 border-cyan-400/30 bg-cyan-400/10';
 if(category==='contract'||category==='signing')return 'text-green-300 border-green-400/30 bg-green-400/10';
 if(category==='injury')return 'text-red-300 border-red-400/30 bg-red-400/10';
 if(category==='camp')return 'text-violet-300 border-violet-400/30 bg-violet-400/10';
 if(category==='retirement')return 'text-orange-300 border-orange-400/30 bg-orange-400/10';
 return 'text-[#D4AF37] border-[#D4AF37]/30 bg-[#D4AF37]/10';
}

export const NFLNewsPage:React.FC=()=>{
 const [items,setItems]=useState<NewsItem[]>([]); const [category,setCategory]=useState('all'); const [team,setTeam]=useState('ALL');
 const [loading,setLoading]=useState(true); const [refreshing,setRefreshing]=useState(false); const [lastUpdated,setLastUpdated]=useState(''); const [error,setError]=useState('');
 const load=async(force=false)=>{try{force?setRefreshing(true):setLoading(true);setError('');if(force)await fetch(`${NEWS_ENDPOINT}?refresh=1`,{cache:'no-store'});const r=await fetch(`${NEWS_ENDPOINT}?limit=120`,{cache:'no-store'});if(!r.ok)throw new Error('NFL Wire unavailable');const data=await r.json();setItems(Array.isArray(data.items)?data.items:[]);setLastUpdated(data.updatedAt||new Date().toISOString())}catch(e:any){setError(e?.message||'Could not load NFL Wire')}finally{setLoading(false);setRefreshing(false)}};
 useEffect(()=>{void load(false);const timer=window.setInterval(()=>void load(false),60000);return()=>window.clearInterval(timer)},[]);
 const filtered=items.filter(x=>(category==='all'||x.category===category)&&(team==='ALL'||x.team===team));
 const lead=filtered[0]; const rest=filtered.slice(1); const trades=items.filter(x=>x.category==='trade').length; const transactions=items.filter(x=>['trade','contract','signing','roster'].includes(x.category)).length;
 return <div className="min-h-screen bg-[#090909] text-white pb-16">
  <section className="border-b border-white/5 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,.13),transparent_38%)]">
   <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
     <div><div className="inline-flex items-center gap-2 text-[10px] font-black tracking-[.25em] text-green-400"><span className="h-2 w-2 rounded-full bg-green-400 animate-pulse"/>LIVE • 24/7 NFL FEED</div><h2 className="font-display text-5xl sm:text-7xl font-black mt-2">NFL <span className="text-[#D4AF37]">WIRE.</span></h2><p className="text-zinc-400 max-w-2xl mt-2">Trades. Contracts. Signings. Injuries. Camp buzz. One clean feed built for Ball Knowers.</p></div>
     <button onClick={()=>void load(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-3 text-xs font-black text-[#D4AF37] disabled:opacity-50"><RefreshCw size={15} className={refreshing?'animate-spin':''}/>{refreshing?'CHECKING...':'CHECK NOW'}</button>
    </div>
    <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-7 max-w-xl"><NewsStat l="LIVE ITEMS" v={items.length}/><NewsStat l="TRANSACTIONS" v={transactions}/><NewsStat l="TRADES" v={trades}/></div>
   </div>
  </section>
  <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-6">
   <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/10 pb-5">
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">{NEWS_CATEGORIES.map(([v,l])=><button key={v} onClick={()=>setCategory(v)} className={`shrink-0 px-3 py-2 text-[10px] font-black tracking-wider border ${category===v?'bg-[#D4AF37] text-black border-[#D4AF37]':'bg-[#111] text-zinc-400 border-white/10'}`}>{l}</button>)}</div>
    <select value={team} onChange={e=>setTeam(e.target.value)} className="bg-[#111] border border-white/10 px-3 py-2 text-xs font-black text-white"><option value="ALL">ALL 32 TEAMS</option>{NEWS_TEAMS.slice(1).map(t=><option key={t} value={t}>{t}</option>)}</select>
   </div>
   <div className="flex items-center justify-between py-4 text-[9px] font-black tracking-widest text-zinc-600"><span>OFFICIAL NFL SOURCES • AUTO-REFRESH EVERY 5 MIN</span><span>{lastUpdated?`VIEW REFRESHED ${ago(lastUpdated)}`:''}</span></div>
   {error&&<div className="border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
   {loading?<div className="py-24 text-center text-zinc-500"><RefreshCw className="mx-auto animate-spin mb-3"/>Loading NFL Wire...</div>:filtered.length===0?<div className="py-24 text-center text-zinc-500">No stories match those filters yet.</div>:<>
    {lead&&<a href={lead.url} target="_blank" rel="noreferrer" className="block border border-[#D4AF37]/25 bg-[#111] p-5 sm:p-7 hover:border-[#D4AF37]/60 transition-colors"><div className="flex flex-wrap items-center gap-2 mb-4"><span className="inline-flex items-center gap-1 text-[9px] font-black text-[#D4AF37]"><Zap size={12}/>TOP OF THE WIRE</span><span className={`border px-2 py-1 text-[9px] font-black ${newsTone(lead.category)}`}>{lead.category.toUpperCase()}</span>{lead.team&&<span className="border border-white/10 px-2 py-1 text-[9px] font-black text-zinc-300">{lead.team}</span>}</div><h3 className="font-display text-3xl sm:text-5xl font-black leading-tight">{lead.title}</h3><p className="text-sm text-zinc-500 mt-3">{lead.summary}</p><div className="mt-5 flex items-center justify-between text-[10px] font-black text-zinc-500"><span>{lead.source} • {ago(lead.created_at||lead.published_at)}</span><span className="text-[#D4AF37] flex items-center gap-1">READ SOURCE <ExternalLink size={12}/></span></div></a>}
    <div className="grid lg:grid-cols-2 gap-3 mt-4">{rest.map(x=><a key={x.id} href={x.url} target="_blank" rel="noreferrer" className="group bg-[#111] border border-white/10 p-4 sm:p-5 hover:border-[#D4AF37]/40 transition-colors"><div className="flex items-center justify-between gap-3 mb-3"><div className="flex items-center gap-2"><span className={`border px-2 py-1 text-[8px] font-black ${newsTone(x.category)}`}>{x.category.toUpperCase()}</span>{x.team&&<span className="text-[9px] font-black text-zinc-500">{x.team}</span>}</div><span className="text-[9px] font-black text-zinc-600">{ago(x.created_at||x.published_at)}</span></div><h4 className="font-display text-xl sm:text-2xl font-black leading-tight group-hover:text-[#D4AF37] transition-colors">{x.title}</h4><div className="mt-4 flex items-center justify-between text-[9px] font-black text-zinc-600"><span className="flex items-center gap-1"><Activity size={11}/>{x.source}</span><ExternalLink size={12}/></div></a>)}</div>
   </>}
  </div>
 </div>
}

const Stat=({l,v}:{l:string,v:any})=><div className="bg-[#121212] border border-white/10 p-3"><div className="text-[9px] text-zinc-500 font-black">{l}</div><div className="text-xl font-black">{v}</div></div>;
const Cell=({l,v}:{l:string,v:any})=><div className="text-right min-w-[55px]"><div className="text-[8px] text-zinc-600 font-black">{l}</div><div className="font-black">{v}</div></div>;
const NewsStat=({l,v}:{l:string,v:any})=><div className="bg-[#111] border border-white/10 p-3"><div className="text-[8px] text-zinc-600 font-black tracking-widest">{l}</div><div className="text-xl font-black mt-1">{v}</div></div>;