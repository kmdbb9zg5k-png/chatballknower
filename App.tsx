import React, { useState, useEffect } from 'react';
import { BallKnowerProvider, useBallKnower } from './BallKnowerContext';
import { SoundtrackProvider, useSoundtrack } from './SoundtrackContext';
import { Navbar } from './Navbar';
import { HomeDashboard } from './HomeDashboard';
import { LeagueLobby } from './LeagueLobby';
import { DraftRoom } from './DraftRoom';
import { SimulationView } from './SimulationView';
import { AuthModal } from './AuthModal';
import { CreateLeagueModal } from './CreateLeagueModal';
import { JoinLeagueModal } from './JoinLeagueModal';
import { CinematicIntro } from './CinematicIntro';
import { DatabaseVerificationModal } from './DatabaseVerificationModal';
import { SoloMode } from './SoloMode';
import { HallOfFame, NFLNewsPage } from './HallOfFame';
import { PLAYERS_DATABASE } from './players';
import { League } from './types';
import { ensureOnlineSession, supabase } from './lib/supabase';
import {
  CheckCircle2,
  Play,
  Database,
  ChevronRight,
  Trophy,
  Users,
  User,
  DollarSign,
  Brain,
  CalendarDays,
  Shield,
  Plus,
  Settings,
  Radio,
  ArrowRight,
} from 'lucide-react';

const CAP_CACHE_KEY = 'ballknower_2026_cap_hits_v1';
const CAP_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CAP_HITS_URL = 'https://gpnboygoosrmeydwjpvk.supabase.co/functions/v1/nfl-cap-hits?key=ballknower-cap-v1';

function normalizeCapName(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\.?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function applyCapPayload(payload: any) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  if (!rows.length) return 0;

  const alias: Record<string, string> = {
    'matthew stafford': 'matt stafford',
  };

  const byTeamAndName = new Map<string, number>();
  for (const row of rows) {
    const team = String(row?.team || '').toUpperCase();
    const name = normalizeCapName(String(row?.name || ''));
    const capHit = Number(row?.capHit || 0);
    if (team && name && Number.isFinite(capHit) && capHit > 0) {
      byTeamAndName.set(`${team}:${name}`, capHit);
    }
  }

  let updated = 0;
  const updatedAt = String(payload?.updatedAt || new Date().toISOString());
  for (const player of PLAYERS_DATABASE) {
    if (!player.salaryType) player.salaryType = 'estimated';
    if (!player.salarySource) player.salarySource = 'legacy_estimate';
    if (!player.salarySeason) player.salarySeason = 2026;

    const normalized = normalizeCapName(player.name);
    const lookupName = alias[normalized] || normalized;
    const capHit = byTeamAndName.get(`${player.team}:${lookupName}`);
    if (!capHit) continue;

    player.salary = Math.round((capHit / 1_000_000) * 100) / 100;
    player.salaryType = 'cap_hit';
    player.salarySeason = 2026;
    player.salarySource = 'Over The Cap';
    player.salaryLastUpdated = updatedAt;
    updated += 1;
  }

  return updated;
}

async function hydrate2026CapHits() {
  try {
    const cachedRaw = localStorage.getItem(CAP_CACHE_KEY);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached?.savedAt && Date.now() - Number(cached.savedAt) < CAP_CACHE_TTL_MS && cached?.payload) {
        const count = applyCapPayload(cached.payload);
        if (count > 0) return count;
      }
    }
  } catch (error) {
    console.warn('Ball Knower cap cache read failed', error);
  }

  const response = await fetch(CAP_HITS_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Cap sync failed (${response.status})`);
  const payload = await response.json();
  const count = applyCapPayload(payload);

  try {
    localStorage.setItem(CAP_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), payload }));
  } catch (error) {
    console.warn('Ball Knower cap cache write failed', error);
  }

  return count;
}

function WelcomeScreen({ onEnter }: { onEnter: () => void }) {
  const categories = [
    {
      icon: Users,
      eyebrow: 'MAIN MODE',
      title: 'Fantasy Football',
      text: 'Run a real league from draft night through the championship.',
      features: ['Create & Join', 'Draft Room', 'Live Scoring', 'Waivers', 'Trades', 'Playoffs'],
      featured: true,
    },
    {
      icon: Shield,
      eyebrow: 'SIGNATURE MODE',
      title: 'Draft Order Challenge',
      text: 'Everyone gets the same player pool and cap. Prove who deserves Pick #1.',
      features: ['$301.2M Cap', 'Same Players', 'Team Build', 'Simulation', 'Earn Your Pick'],
    },
    {
      icon: Play,
      eyebrow: 'SOLO MODE',
      title: 'Solo Franchise',
      text: 'Build 29, manage a full season and see if your roster can win a ring.',
      features: ['29-Man Roster', 'Salary Cap', 'Injuries', 'Trades', '17 Games', 'Playoffs'],
    },
    {
      icon: DollarSign,
      eyebrow: 'ODDS LAB',
      title: 'Sportsbook',
      text: 'Compare lines and build parlays without placing wagers inside Ball Knower.',
      features: ['Best Lines', 'Player Props', 'Line Movement', 'Parlay Lab', 'Payout Math'],
    },
    {
      icon: Radio,
      eyebrow: '24/7 FEED',
      title: 'NFL Wire',
      text: 'One clean football news feed built around roster-impacting information.',
      features: ['Trades', 'Signings', 'Injuries', 'Camp News', 'Roster Moves'],
    },
    {
      icon: Trophy,
      eyebrow: 'YOUR LEGACY',
      title: 'Profile & Extras',
      text: 'Your Ball Knower identity follows you across every mode and league.',
      features: ['BK Rating', 'League History', 'Achievements', 'Player Headshots', 'Soundtrack'],
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070707] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.14),transparent_42%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.35em] text-[#D4AF37]">BALL KNOWER</div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">Fantasy • Football IQ • News • Odds</div>
          </div>
          <div className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-[#D4AF37]">2026</div>
        </div>

        <div className="mx-auto mt-8 max-w-4xl text-center sm:mt-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#D4AF37]">🏈 Everything Football</div>
          <h1 className="font-display text-5xl font-black uppercase leading-[0.88] tracking-tighter sm:text-7xl lg:text-8xl">
            ONE APP.<br /><span className="text-[#D4AF37]">EVERY WAY TO KNOW BALL.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-6 text-zinc-400 sm:text-base">
            Fantasy football, the Ball Knower Challenge, Solo Franchise, NFL news, sportsbook comparisons and your football legacy — all connected in one place.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(({ icon: Icon, eyebrow, title, text, features, featured }) => (
            <div
              key={title}
              className={`rounded-[28px] border p-5 sm:p-6 ${featured ? 'border-[#D4AF37]/55 bg-[#D4AF37]/[0.07] shadow-[0_0_35px_rgba(212,175,55,0.08)]' : 'border-white/10 bg-[#101010]'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${featured ? 'border-[#D4AF37]/50 bg-[#D4AF37]/15' : 'border-white/10 bg-white/[0.035]'}`}>
                  <Icon className="h-5 w-5 text-[#D4AF37]" />
                </div>
                <div className={`rounded-full px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] ${featured ? 'bg-[#D4AF37] text-black' : 'border border-white/10 text-zinc-500'}`}>
                  {eyebrow}
                </div>
              </div>

              <h2 className="mt-5 font-display text-2xl font-black uppercase leading-none tracking-tight text-white">{title}</h2>
              <p className="mt-2 min-h-[40px] text-xs font-medium leading-5 text-zinc-500">{text}</p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {features.map(feature => (
                  <span key={feature} className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.08em] text-zinc-400">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-8 w-full max-w-xl pb-4 text-center">
          <button onClick={onEnter} className="group flex w-full items-center justify-center gap-3 rounded-full bg-[#D4AF37] px-8 py-5 text-sm font-black uppercase tracking-[0.18em] text-black shadow-[0_0_40px_rgba(212,175,55,0.15)] transition-all hover:scale-[1.01] hover:bg-[#E7C75B]">
            Enter Ball Knower <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </button>
          <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600">Pick a mode. Build your legacy. Prove you know ball.</p>
        </div>
      </div>
    </div>
  );
}

function FantasyHub() {
  const { currentUser } = useBallKnower();
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<any | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [form, setForm] = useState({ name: 'Sunday Gridiron Fantasy League', teamCount: 10, format: 'redraft', draftType: 'snake', scoring: 'ppr', waiver: 'faab', playoffTeams: 6, combine: true });

  const loadLeagues = async () => {
    if (!supabase) { setMessage('Fantasy cloud is not configured.'); setLoading(false); return; }
    try {
      await ensureOnlineSession();
      const { data, error } = await supabase.from('fantasy_leagues').select('*, fantasy_members(id,display_name,team_name,role,draft_slot)').order('created_at', { ascending: false });
      if (error) throw error;
      setLeagues(data || []);
      if (selectedLeague) setSelectedLeague((data || []).find((x:any) => x.id === selectedLeague.id) || null);
    } catch (error:any) {
      setMessage(error?.message || 'Could not load fantasy leagues.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadLeagues(); }, []);

  const createFantasyLeague = async () => {
    if (!supabase) return setMessage('Fantasy cloud is not configured.');
    const name = form.name.trim();
    if (!name) return setMessage('Give your fantasy league a name.');
    setLoading(true); setMessage('');
    try {
      const user = await ensureOnlineSession();
      const code = `BKF-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
      const { data: league, error } = await supabase.from('fantasy_leagues').insert({
        code,
        name,
        commissioner_id: user.id,
        format: form.format,
        draft_type: form.draftType,
        scoring_format: form.scoring,
        waiver_type: form.waiver,
        team_count: form.teamCount,
        playoff_teams: Math.min(form.playoffTeams, form.teamCount),
        ball_knower_combine: form.combine,
        status: form.combine ? 'combine' : 'setup',
        settings: { lineup: ['QB','RB','RB','WR','WR','TE','FLEX','K','DEF','BN','BN','BN','BN','BN','BN'], trade_deadline_week: 12, faab_budget: 100 },
      }).select().single();
      if (error) throw error;
      const displayName = currentUser?.name || 'Commissioner';
      const { error: memberError } = await supabase.from('fantasy_members').insert({ league_id: league.id, user_id: user.id, display_name: displayName, team_name: `${displayName}'s Team`, role: 'commissioner' });
      if (memberError) throw memberError;
      await supabase.from('fantasy_drafts').insert({ league_id: league.id, pick_seconds: 90 });
      if (form.scoring === 'ppr') await supabase.from('fantasy_scoring_rules').insert({ league_id: league.id });
      else if (form.scoring === 'half_ppr') await supabase.from('fantasy_scoring_rules').insert({ league_id: league.id, rules: { pass_yd:.04, pass_td:4, interception:-2, rush_yd:.1, rush_td:6, reception:.5, rec_yd:.1, rec_td:6, fumble_lost:-2 } });
      else if (form.scoring === 'standard') await supabase.from('fantasy_scoring_rules').insert({ league_id: league.id, rules: { pass_yd:.04, pass_td:4, interception:-2, rush_yd:.1, rush_td:6, reception:0, rec_yd:.1, rec_td:6, fumble_lost:-2 } });
      setCreateOpen(false);
      setMessage(`Fantasy league created. Invite code: ${code}`);
      await loadLeagues();
      setSelectedLeague({ ...league, fantasy_members: [{ id:'me', display_name:displayName, team_name:`${displayName}'s Team`, role:'commissioner' }] });
    } catch (error:any) {
      setMessage(error?.message || 'Could not create fantasy league.');
    } finally { setLoading(false); }
  };

  const joinFantasyLeague = async () => {
    if (!supabase) return setMessage('Fantasy cloud is not configured.');
    if (!joinCode.trim()) return setMessage('Enter the fantasy league code.');
    setLoading(true); setMessage('');
    try {
      await ensureOnlineSession();
      const { data, error } = await supabase.rpc('join_fantasy_league_by_code', { p_code: joinCode.trim().toUpperCase(), p_display_name: currentUser?.name || 'Ball Knower' });
      if (error) throw error;
      setJoinOpen(false); setJoinCode('');
      setMessage('You joined the fantasy league.');
      await loadLeagues();
      if (data) {
        const { data: league } = await supabase.from('fantasy_leagues').select('*, fantasy_members(id,display_name,team_name,role,draft_slot)').eq('id', data).single();
        if (league) setSelectedLeague(league);
      }
    } catch (error:any) {
      setMessage(error?.message || 'Could not join that fantasy league.');
    } finally { setLoading(false); }
  };

  const stageIndex = (status:string) => status === 'combine' ? 0 : status === 'setup' ? 0 : status === 'draft' ? 1 : status === 'regular_season' ? 2 : status === 'playoffs' ? 3 : status === 'complete' ? 4 : 0;

  return <div className="min-h-screen bg-[#090909] text-white px-4 sm:px-8 py-7">
    <div className="mx-auto max-w-7xl">
      <section className="relative overflow-hidden border border-[#D4AF37]/25 bg-[#111] p-6 sm:p-9 mb-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,.14),transparent_45%)]" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.28em] text-green-400"><Radio size={14}/> NEW • BALL KNOWER FANTASY</div>
          <h2 className="mt-3 text-4xl sm:text-6xl font-black uppercase leading-[.92]">PROVE IT. DRAFT IT.<br/><span className="text-[#D4AF37]">RUN THE LEAGUE.</span></h2>
          <p className="mt-4 max-w-3xl text-sm sm:text-base leading-6 text-zinc-400">Your Ball Knower competition can determine the real fantasy draft order, then the same league continues into the draft, weekly matchups, waivers, trades and playoffs.</p>
          <div className="mt-6 grid sm:grid-cols-2 gap-3 max-w-xl">
            <button onClick={()=>{setCreateOpen(!createOpen);setJoinOpen(false)}} className="flex items-center justify-center gap-2 bg-[#D4AF37] text-black py-4 font-black uppercase tracking-wider"><Plus size={17}/> Create Fantasy League</button>
            <button onClick={()=>{setJoinOpen(!joinOpen);setCreateOpen(false)}} className="flex items-center justify-center gap-2 border border-white/15 bg-[#181818] py-4 font-black uppercase tracking-wider"><Users size={17}/> Join With Code</button>
          </div>
        </div>
      </section>

      {message && <div className="mb-5 border border-[#D4AF37]/30 bg-[#D4AF37]/5 px-4 py-3 text-sm font-bold text-[#E7C95F]">{message}</div>}

      {createOpen && <section className="mb-6 border border-white/10 bg-[#111] p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-5"><Settings className="text-[#D4AF37]"/><div><div className="text-xs font-black text-[#D4AF37] tracking-widest">CREATE LEAGUE</div><h3 className="text-2xl font-black">Commissioner Setup</h3></div></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <FantasyField label="LEAGUE NAME"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full bg-[#181818] border border-white/10 p-3 outline-none focus:border-[#D4AF37]"/></FantasyField>
          <FantasyField label="TEAMS"><select value={form.teamCount} onChange={e=>setForm({...form,teamCount:Number(e.target.value)})} className="w-full bg-[#181818] border border-white/10 p-3">{[6,8,10,12,14,16].map(n=><option key={n} value={n}>{n} teams</option>)}</select></FantasyField>
          <FantasyField label="FORMAT"><select value={form.format} onChange={e=>setForm({...form,format:e.target.value})} className="w-full bg-[#181818] border border-white/10 p-3"><option value="redraft">Redraft</option><option value="keeper">Keeper</option><option value="dynasty">Dynasty</option><option value="best_ball">Best Ball</option></select></FantasyField>
          <FantasyField label="DRAFT"><select value={form.draftType} onChange={e=>setForm({...form,draftType:e.target.value})} className="w-full bg-[#181818] border border-white/10 p-3"><option value="snake">Snake Draft</option><option value="linear">Linear Draft</option><option value="salary_cap">Salary Cap Draft</option></select></FantasyField>
          <FantasyField label="SCORING"><select value={form.scoring} onChange={e=>setForm({...form,scoring:e.target.value})} className="w-full bg-[#181818] border border-white/10 p-3"><option value="ppr">Full PPR</option><option value="half_ppr">Half PPR</option><option value="standard">Standard</option><option value="custom">Custom</option></select></FantasyField>
          <FantasyField label="WAIVERS"><select value={form.waiver} onChange={e=>setForm({...form,waiver:e.target.value})} className="w-full bg-[#181818] border border-white/10 p-3"><option value="faab">FAAB</option><option value="rolling">Rolling Priority</option><option value="reverse_standings">Reverse Standings</option><option value="none">Free Agents</option></select></FantasyField>
        </div>
        <label className="mt-4 flex items-center gap-3 border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-4 cursor-pointer"><input type="checkbox" checked={form.combine} onChange={e=>setForm({...form,combine:e.target.checked})}/><div><b className="text-[#D4AF37]">Use the Ball Knower Combine</b><div className="text-xs text-zinc-500">Managers compete in Ball Knower first. Final standings automatically become the real fantasy draft order.</div></div></label>
        <button disabled={loading} onClick={createFantasyLeague} className="mt-5 w-full sm:w-auto bg-[#D4AF37] disabled:opacity-50 text-black px-7 py-4 font-black uppercase tracking-wider">{loading?'CREATING…':'CREATE LEAGUE & GET CODE'}</button>
      </section>}

      {joinOpen && <section className="mb-6 border border-white/10 bg-[#111] p-5 sm:p-6"><div className="text-xs font-black text-[#D4AF37] tracking-widest">JOIN FANTASY LEAGUE</div><h3 className="text-2xl font-black mt-1">Enter the commissioner code.</h3><div className="mt-4 flex flex-col sm:flex-row gap-2 max-w-xl"><input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="BKF-XXXXX" className="flex-1 bg-[#181818] border border-white/10 p-4 font-mono font-black uppercase outline-none focus:border-[#D4AF37]"/><button disabled={loading} onClick={joinFantasyLeague} className="bg-[#D4AF37] text-black px-6 py-4 font-black">JOIN</button></div></section>}

      <section className="grid grid-cols-4 gap-2 mb-7">
        {[['01','COMBINE','Earn order'],['02','DRAFT','Build roster'],['03','SEASON','Live scoring'],['04','PLAYOFFS','Win it all']].map(([n,t,d])=><div key={n} className="border border-white/10 bg-[#111] p-3 sm:p-4"><div className="text-[9px] text-[#D4AF37] font-black">{n}</div><div className="text-[10px] sm:text-sm font-black mt-1">{t}</div><div className="hidden sm:block text-[10px] text-zinc-600 mt-1">{d}</div></div>)}
      </section>

      {selectedLeague && <section className="mb-7 border border-[#D4AF37]/30 bg-[#111] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"><div><div className="text-[10px] text-[#D4AF37] font-black tracking-widest">LEAGUE HQ • {selectedLeague.code}</div><h3 className="text-3xl font-black mt-1">{selectedLeague.name}</h3><p className="text-sm text-zinc-500 mt-1">{(selectedLeague.fantasy_members||[]).length}/{selectedLeague.team_count} managers • {String(selectedLeague.scoring_format).replace('_',' ').toUpperCase()} • {String(selectedLeague.draft_type).replace('_',' ').toUpperCase()}</p></div><button onClick={()=>setSelectedLeague(null)} className="border border-white/10 px-3 py-2 text-xs font-black">CLOSE</button></div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mt-5">
          {['COMBINE','DRAFT ROOM','MATCHUPS','WAIVERS','TRADES','COMMISSIONER'].map((x,i)=><div key={x} className={`p-3 border ${i===stageIndex(selectedLeague.status)?'border-[#D4AF37] bg-[#D4AF37]/10':'border-white/10 bg-[#151515]'}`}><div className="text-[9px] text-zinc-600">{i===stageIndex(selectedLeague.status)?'CURRENT':'MODULE'}</div><b className={i===stageIndex(selectedLeague.status)?'text-[#D4AF37]':''}>{x}</b></div>)}
        </div>
        <div className="mt-5 grid sm:grid-cols-2 gap-3"><div className="border border-white/10 p-4"><div className="text-[9px] text-zinc-600 font-black tracking-widest">MANAGERS</div>{(selectedLeague.fantasy_members||[]).map((m:any)=><div key={m.id} className="flex justify-between py-2 border-b border-white/5 text-sm"><span>{m.display_name}</span><span className="text-zinc-500">{m.role==='commissioner'?'COMMISH':m.draft_slot?`PICK ${m.draft_slot}`:'JOINED'}</span></div>)}</div><div className="border border-white/10 p-4"><div className="text-[9px] text-zinc-600 font-black tracking-widest">NEXT BUILD</div><h4 className="font-black text-xl mt-1">Live Draft War Room</h4><p className="text-xs text-zinc-500 mt-2">Timer, queue, auto-pick, Madden-style player cards, draft board and the Ball Knower-earned draft order.</p></div></div>
      </section>}

      <section>
        <div className="flex items-end justify-between gap-4 mb-3"><div><div className="text-[10px] text-[#D4AF37] font-black tracking-widest">YOUR FANTASY LEAGUES</div><h3 className="text-2xl font-black">League Command Center</h3></div><button onClick={()=>void loadLeagues()} className="text-xs border border-white/10 px-3 py-2">REFRESH</button></div>
        {loading && leagues.length===0 ? <div className="border border-white/10 bg-[#111] p-8 text-zinc-500">Loading fantasy leagues…</div> : leagues.length===0 ? <div className="border border-white/10 bg-[#111] p-8 text-center"><Shield className="mx-auto text-zinc-700" size={42}/><h4 className="font-black text-xl mt-3">No fantasy leagues yet.</h4><p className="text-sm text-zinc-500 mt-1">Create the first one and Ball Knower generates the invite code.</p></div> : <div className="grid md:grid-cols-2 gap-3">{leagues.map((league:any)=><button key={league.id} onClick={()=>setSelectedLeague(league)} className="text-left border border-white/10 bg-[#111] p-5 hover:border-[#D4AF37]/50"><div className="flex justify-between gap-3"><div><div className="text-[10px] font-black text-[#D4AF37]">{league.code}</div><h4 className="text-xl font-black mt-1">{league.name}</h4></div><span className="h-fit border border-green-500/25 bg-green-500/5 text-green-400 px-2 py-1 text-[9px] font-black uppercase">{String(league.status).replace('_',' ')}</span></div><div className="grid grid-cols-3 gap-2 mt-4 text-center"><FantasyMini label="MANAGERS" value={`${(league.fantasy_members||[]).length}/${league.team_count}`}/><FantasyMini label="SCORING" value={String(league.scoring_format).replace('_',' ').toUpperCase()}/><FantasyMini label="DRAFT" value={String(league.draft_type).replace('_',' ').toUpperCase()}/></div><div className="mt-4 text-xs text-zinc-500 flex items-center gap-1">Open League HQ <ArrowRight size={13}/></div></button>)}</div>}
      </section>
    </div>
  </div>;
}

const FantasyField = ({label,children}:{label:string;children:React.ReactNode}) => <label><div className="mb-2 text-[9px] font-black tracking-widest text-zinc-500">{label}</div>{children}</label>;
const FantasyMini = ({label,value}:{label:string;value:string}) => <div className="bg-[#0b0b0b] border border-white/5 p-2"><div className="text-[8px] text-zinc-600 font-black">{label}</div><div className="text-xs font-black mt-1 truncate">{value}</div></div>;

function BallKnowerApp() {
  const { activeLeague, setActiveLeagueId, toastMessage, joinLeague } = useBallKnower();
  const { setIntroActive } = useSoundtrack();

  const [currentTab, setCurrentTab] = useState<'home' | 'solo' | 'news' | 'fantasy' | 'legacy' | 'lobby' | 'draft' | 'simulation'>('home');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreateLeagueOpen, setIsCreateLeagueOpen] = useState(false);
  const [isJoinLeagueOpen, setIsJoinLeagueOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [isIntroOpen, setIsIntroOpen] = useState<boolean>(true);
  const [showWelcome, setShowWelcome] = useState(true);
  const [, setCapDataVersion] = useState(0);

  useEffect(() => {
    setIntroActive(isIntroOpen);
  }, [isIntroOpen, setIntroActive]);

  useEffect(() => {
    let cancelled = false;
    hydrate2026CapHits()
      .then((updated) => {
        if (!cancelled && updated > 0) setCapDataVersion(v => v + 1);
      })
      .catch(error => console.warn('2026 cap-hit sync unavailable; using cached/estimated values', error));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const joinCode = params.get('join');
      if (joinCode) {
        joinLeague(joinCode).then(res => {
          if (res.success && res.league) {
            setShowWelcome(false);
            setCurrentTab('lobby');
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSelectLeague = (league: League, tab: 'lobby' | 'draft' | 'simulation') => {
    setActiveLeagueId(league.id);
    setCurrentTab(tab);
  };

  const handleLeagueCreated = (league: League) => {
    setActiveLeagueId(league.id);
    setCurrentTab('lobby');
  };

  const handleLeagueJoined = (league: League) => {
    setActiveLeagueId(league.id);
    setCurrentTab('lobby');
  };

  return (
    <>
      <CinematicIntro isOpen={isIntroOpen} onClose={() => setIsIntroOpen(false)} />

      {!isIntroOpen && showWelcome ? (
        <WelcomeScreen onEnter={() => setShowWelcome(false)} />
      ) : !isIntroOpen ? (
        <div className="min-h-screen bg-[#0A0A0A] text-white font-sans antialiased selection:bg-[#D4AF37]/30 selection:text-[#D4AF37] flex flex-col justify-between">
          <Navbar
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenCreateLeague={() => setIsCreateLeagueOpen(true)}
            onOpenJoinLeague={() => setIsJoinLeagueOpen(true)}
            onOpenIntro={() => {
              setShowWelcome(true);
              setIsIntroOpen(true);
            }}
            onOpenDatabaseModal={() => setIsDatabaseModalOpen(true)}
          />

          <main className="w-full flex-1">
            {currentTab === 'home' && <HomeDashboard onOpenCreateLeague={() => setIsCreateLeagueOpen(true)} onOpenJoinLeague={() => setIsJoinLeagueOpen(true)} onSelectLeague={handleSelectLeague} />}
            {currentTab === 'solo' && <SoloMode />}
            {currentTab === 'news' && <NFLNewsPage />}
            {currentTab === 'fantasy' && <FantasyHub />}
            {currentTab === 'legacy' && <HallOfFame />}
            {currentTab === 'lobby' && activeLeague && <LeagueLobby league={activeLeague} onGoToDraft={() => setCurrentTab('draft')} onGoToSimulation={() => setCurrentTab('simulation')} />}
            {currentTab === 'draft' && <DraftRoom onBackToLobby={() => setCurrentTab(activeLeague ? 'lobby' : 'home')} onSubmitSuccess={() => setCurrentTab(activeLeague ? 'lobby' : 'home')} />}
            {currentTab === 'simulation' && activeLeague && <SimulationView league={activeLeague} onBackToLobby={() => setCurrentTab('lobby')} />}
          </main>

          <footer className="border-t border-white/5 bg-[#080808] px-6 sm:px-8 py-4 text-[10px] uppercase font-bold tracking-widest text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[#D4AF37]">PROVE YOU KNOW BALL.</span>
              <span>© 2026 BALL KNOWER NFL CAP ENGINE</span>
              <button onClick={() => { setShowWelcome(true); setIsIntroOpen(true); }} className="flex items-center gap-1 text-[#D4AF37] hover:text-white transition-colors cursor-pointer border-b border-[#D4AF37]/30">
                <Play className="h-2.5 w-2.5 fill-[#D4AF37]" /><span>Replay Intro Video</span>
              </button>
              <button onClick={() => setIsDatabaseModalOpen(true)} className="flex items-center gap-1 text-[#00FF00] hover:text-white transition-colors cursor-pointer border-b border-[#00FF00]/30">
                <Database className="h-2.5 w-2.5 text-[#00FF00]" /><span>32/32 Rosters Verified (2026 Season)</span>
              </button>
            </div>
            <div className="flex items-center gap-4 text-zinc-600 font-mono-numbers">
              <span>NFL SEASON: <span className="text-[#D4AF37]">2026</span></span>
              <span>STATUS: <span className="text-[#00FF00]">ACTIVE</span></span>
              <span>SOLO + DRAFT ORDER + FANTASY</span>
              <span>V1.0 GAME BUILD</span>
            </div>
          </footer>

          <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
          <CreateLeagueModal isOpen={isCreateLeagueOpen} onClose={() => setIsCreateLeagueOpen(false)} onLeagueCreated={handleLeagueCreated} />
          <JoinLeagueModal isOpen={isJoinLeagueOpen} onClose={() => setIsJoinLeagueOpen(false)} onLeagueJoined={handleLeagueJoined} />
          <DatabaseVerificationModal isOpen={isDatabaseModalOpen} onClose={() => setIsDatabaseModalOpen(false)} />

          {toastMessage && (
            <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-md border border-[#D4AF37]/50 bg-[#121212] px-4 py-3 text-xs font-bold text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200">
              <CheckCircle2 className="h-4 w-4 text-[#D4AF37] shrink-0" /><span>{toastMessage}</span>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

export default function App() {
  return (
    <SoundtrackProvider>
      <BallKnowerProvider>
        <BallKnowerApp />
      </BallKnowerProvider>
    </SoundtrackProvider>
  );
}