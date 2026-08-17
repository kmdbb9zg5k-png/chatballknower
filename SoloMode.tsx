import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Award, Crown, Play, Plus, RotateCcw, Search, Share2, ShieldAlert, Trash2, Trophy } from 'lucide-react';
import { PLAYERS_DATABASE } from './players';
import { DEFAULT_SALARY_CAP, LeagueMember, Player, ROSTER_REQUIREMENTS } from './types';
import { getDraftPositionGroup, validateRosterShape } from './rosterRules';
import { calculateTeamRatings } from './evaluation';
import { gradeDraft } from './smartDraft';
import { simulateGame } from './simulation';
import { useBallKnower } from './BallKnowerContext';
import { publishCareer } from './leaderboardCloud';
import {
  CareerProfile, InjuryEvent, SoloSettings, SoloWeek, achievementsForRun, buildAwards,
  defaultCareer, generatePlayerLines, makeSoloOpponent, playoffSnapshot, ratingsWithInjuries,
  simulateInjuries, updateCareer
} from './soloSeasonEngine';

type Stage = 'draft' | 'regular' | 'playoffs' | 'finished';
type Group = keyof typeof ROSTER_REQUIREMENTS;
type PlayoffResult = { round:string; opponent:string; you:number; them:number; won:boolean };

const GROUPS:Group[] = ['QB','RB','WR','TE','OL','DL_EDGE','LB','CB','S','K','P'];
const BACKUPS:Record<Group,number> = { QB:1,RB:1,WR:1,TE:1,OL:1,DL_EDGE:1,LB:1,CB:1,S:1,K:0,P:0 };
const TOTALS:Record<Group,number> = GROUPS.reduce((o,g)=>{ o[g]=ROSTER_REQUIREMENTS[g]+BACKUPS[g]; return o; },{} as Record<Group,number>);
const STARTERS = Object.values(ROSTER_REQUIREMENTS).reduce((a,b)=>a+b,0);
const DEPTH = Object.values(BACKUPS).reduce((a,b)=>a+b,0);
const SOLO_SIZE = STARTERS + DEPTH;
const RUN_KEY = 'ballknower_solo_run_v2';
const CAREER_KEY = 'ballknower_solo_career_v2';
const LEGACY_CAREER_KEY = 'ballknower_solo_career_v1';

const label = (g:string) => g === 'DL_EDGE' ? 'DL/EDGE' : g;
const groupOf = (p:Player) => getDraftPositionGroup(p) as Group;
const count = (players:Player[],g:Group) => players.filter(p=>groupOf(p)===g).length;
const totalCount = (starters:Player[],depth:Player[],g:Group) => count(starters,g)+count(depth,g);

function minimumFinishCost(starters:Player[],depth:Player[]) {
  const used = new Set([...starters,...depth].map(p=>p.id));
  let cost = 0;
  for (const g of GROUPS) {
    const need = Math.max(0,TOTALS[g]-totalCount(starters,depth,g));
    if (!need) continue;
    const cheap = PLAYERS_DATABASE.filter(p=>!used.has(p.id)&&groupOf(p)===g).sort((a,b)=>a.salary-b.salary).slice(0,need);
    if (cheap.length < need) return Infinity;
    cost += cheap.reduce((n,p)=>n+p.salary,0);
  }
  return cost;
}

function effectiveLineup(starters:Player[],depth:Player[],injuries:InjuryEvent[]) {
  const out = [...starters];
  const used = new Set<string>();
  for (const injury of injuries.filter(i=>i.weeks>0)) {
    const idx = out.findIndex(p=>p.id===injury.playerId);
    if (idx < 0) continue;
    const g = groupOf(out[idx]);
    const next = depth.filter(p=>groupOf(p)===g&&!used.has(p.id)).sort((a,b)=>b.ovr-a.ovr)[0];
    if (next) { out[idx]=next; used.add(next.id); }
  }
  return out;
}

function smartScore(p:Player,starters:Player[]) {
  const g = groupOf(p);
  const needStarter = count(starters,g) < ROSTER_REQUIREMENTS[g];
  const weight:Record<Group,number> = {QB:1.28,RB:.95,WR:1.12,TE:1.02,OL:1.10,DL_EDGE:1.16,LB:.98,CB:1.12,S:1.01,K:.72,P:.65};
  return p.ovr*weight[g] + Math.min(30,p.ovr/Math.max(.8,p.salary)*1.7) + (needStarter?15:4) - p.salary*.1;
}

export const SoloMode:React.FC = () => {
  const { currentUser } = useBallKnower();
  const [stage,setStage] = useState<Stage>('draft');
  const [roster,setRoster] = useState<Player[]>([]);
  const [bench,setBench] = useState<Player[]>([]);
  const [weeks,setWeeks] = useState<SoloWeek[]>([]);
  const [injuries,setInjuries] = useState<InjuryEvent[]>([]);
  const [playoffs,setPlayoffs] = useState<PlayoffResult[]>([]);
  const [query,setQuery] = useState('');
  const [position,setPosition] = useState('ALL');
  const [message,setMessage] = useState('');
  const [settings,setSettings] = useState<SoloSettings>({difficulty:'pro',injuries:'normal'});
  const [career,setCareer] = useState<CareerProfile>(()=>{
    try {
      const raw = localStorage.getItem(CAREER_KEY) || localStorage.getItem(LEGACY_CAREER_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      return saved ? {...defaultCareer(),...saved,achievements:Array.isArray(saved.achievements)?saved.achievements:[]} : defaultCareer();
    } catch { return defaultCareer(); }
  });

  useEffect(()=>{
    try {
      const raw=localStorage.getItem(RUN_KEY); if(!raw) return;
      const r=JSON.parse(raw);
      if(!['regular','playoffs'].includes(r?.stage)||!Array.isArray(r.roster)||r.roster.length!==STARTERS||!Array.isArray(r.bench)||r.bench.length!==DEPTH){ localStorage.removeItem(RUN_KEY); return; }
      setStage(r.stage); setRoster(r.roster); setBench(r.bench); setWeeks(Array.isArray(r.weeks)?r.weeks:[]);
      setInjuries(Array.isArray(r.injuries)?r.injuries:[]); setPlayoffs(Array.isArray(r.playoffs)?r.playoffs:[]);
      if(r.settings) setSettings(r.settings); setMessage('Restored your Solo season.');
    } catch { localStorage.removeItem(RUN_KEY); }
  },[]);

  useEffect(()=>{
    if(stage!=='regular'&&stage!=='playoffs') return;
    try { localStorage.setItem(RUN_KEY,JSON.stringify({stage,roster,bench,weeks,injuries,playoffs,settings})); } catch {}
  },[stage,roster,bench,weeks,injuries,playoffs,settings]);

  useEffect(()=>{ if(stage==='finished') window.scrollTo({top:0,behavior:'smooth'}); },[stage]);

  const selected = useMemo(()=>[...roster,...bench],[roster,bench]);
  const spent = useMemo(()=>selected.reduce((n,p)=>n+p.salary,0),[selected]);
  const remaining = DEFAULT_SALARY_CAP-spent;
  const ratings = useMemo(()=>calculateTeamRatings(roster),[roster]);
  const grade = useMemo(()=>gradeDraft(roster,DEFAULT_SALARY_CAP),[roster]);
  const depthOvr = bench.length ? Math.round(bench.reduce((n,p)=>n+p.ovr,0)/bench.length) : 0;
  const starterErrors = validateRosterShape(roster);
  const depthErrors = GROUPS.filter(g=>count(bench,g)!==BACKUPS[g]);
  const valid = roster.length===STARTERS && bench.length===DEPTH && !starterErrors.length && !depthErrors.length && spent<=DEFAULT_SALARY_CAP;
  const wins = weeks.filter(w=>w.won).length;
  const losses = weeks.length-wins;
  const active = injuries.filter(i=>i.weeks>0);
  const allLines = weeks.flatMap(w=>Array.isArray(w.playerLines)?w.playerLines:[]);
  const awards = buildAwards(allLines);
  const injuryHistory = weeks.flatMap(w=>Array.isArray(w.injuries)?w.injuries:[]);
  const totals = weeks.reduce((a,w)=>{ const home=w.game.homeMemberId==='solo-user'; a.pf+=home?w.game.homeScore:w.game.awayScore; a.pa+=home?w.game.awayScore:w.game.homeScore; return a; },{pf:0,pa:0});
  const leaders = useMemo(()=>{
    const m=new Map<string,{name:string,pos:string,score:number}>();
    allLines.forEach(l=>{ const x=m.get(l.playerId)||{name:l.name,pos:l.position,score:0}; x.score+=l.fantasyScore; m.set(l.playerId,x); });
    return [...m.values()].sort((a,b)=>b.score-a.score).slice(0,5);
  },[weeks]);

  const available = useMemo(()=>PLAYERS_DATABASE.filter(p=>{
    if(selected.some(x=>x.id===p.id)) return false;
    const g=groupOf(p); if(!GROUPS.includes(g)||totalCount(roster,bench,g)>=TOTALS[g]) return false;
    if(query&&!`${p.name} ${p.team} ${p.position}`.toLowerCase().includes(query.toLowerCase())) return false;
    return position==='ALL'||g===position||p.position===position;
  }).sort((a,b)=>b.ovr-a.ovr).slice(0,180),[selected,roster,bench,query,position]);

  const add = (p:Player) => {
    const g=groupOf(p);
    if(totalCount(roster,bench,g)>=TOTALS[g]) return setMessage(`${label(g)} is full.`);
    if(p.salary>remaining) return setMessage('That player puts you over the cap.');
    const isStarter=count(roster,g)<ROSTER_REQUIREMENTS[g];
    const nr=isStarter?[...roster,p]:roster, nb=isStarter?bench:[...bench,p];
    if(minimumFinishCost(nr,nb)>remaining-p.salary+.001) return setMessage('That pick leaves too little cap to finish all 29 roster spots.');
    isStarter?setRoster(nr):setBench(nb); setMessage(`${p.name} added as ${isStarter?'a starter':'required depth'}.`);
  };

  const remove = (p:Player,depth:boolean) => {
    if(depth){ setBench(b=>b.filter(x=>x.id!==p.id)); return; }
    const g=groupOf(p); const promote=bench.filter(x=>groupOf(x)===g).sort((a,b)=>b.ovr-a.ovr)[0];
    if(promote){ setRoster(r=>r.map(x=>x.id===p.id?promote:x)); setBench(b=>b.filter(x=>x.id!==promote.id)); setMessage(`${promote.name} promoted.`); }
    else setRoster(r=>r.filter(x=>x.id!==p.id));
  };

  const autoDraft = () => {
    let s:Player[]=[], d:Player[]=[];
    for(let pick=0;pick<50&&s.length+d.length<SOLO_SIZE;pick++){
      const chosen=new Set([...s,...d].map(p=>p.id)); const spentNow=[...s,...d].reduce((n,p)=>n+p.salary,0); const capLeft=DEFAULT_SALARY_CAP-spentNow;
      const legal=PLAYERS_DATABASE.filter(p=>{
        if(chosen.has(p.id)||p.salary>capLeft) return false;
        const g=groupOf(p); if(!GROUPS.includes(g)||totalCount(s,d,g)>=TOTALS[g]) return false;
        const isStarter=count(s,g)<ROSTER_REQUIREMENTS[g]; const ns=isStarter?[...s,p]:s, nd=isStarter?d:[...d,p];
        return minimumFinishCost(ns,nd)<=capLeft-p.salary+.001;
      });
      const p=legal.sort((a,b)=>smartScore(b,s)-smartScore(a,s))[0]; if(!p) break;
      const g=groupOf(p); count(s,g)<ROSTER_REQUIREMENTS[g]?s.push(p):d.push(p);
    }
    setRoster([...s]); setBench([...d]); setMessage(s.length+d.length===SOLO_SIZE?'Smart 29-man roster built. Change anything you want or start the season.':'Could not finish a legal 29-man roster under the cap.');
  };

  const start = () => {
    if(!valid) return setMessage(starterErrors[0]||`Still need required depth at ${depthErrors.map(label).join(', ')}.`);
    setWeeks([]); setInjuries([]); setPlayoffs([]); setStage('regular'); setMessage('Week 1 ready. Backups automatically step in when starters get hurt.');
  };

  const playWeek = () => {
    const week=weeks.length+1; if(week>17) return;
    const lineup=effectiveLineup(roster,bench,active); const myRatings=ratingsWithInjuries(roster,active,bench);
    const me:LeagueMember={id:'solo-user',userId:'solo-user',userName:'YOU',isCommissioner:true,status:'ready',roster:lineup,teamRatings:myRatings};
    const opp=makeSoloOpponent(week,settings.difficulty); const home=week%2===1; const game=home?simulateGame(week,me,opp):simulateGame(week,opp,me);
    const won=game.winnerId==='solo-user', nw=wins+(won?1:0), nl=losses+(won?0:1), snap=playoffSnapshot(nw,nl,week);
    const newInjuries=simulateInjuries(roster,week,settings.injuries,active); const playerLines=generatePlayerLines(lineup,game,home,week);
    setWeeks(w=>[...w,{week,opponent:opp.userName,game,won,playerLines,injuries:newInjuries,playoffSeed:snap.seed,playoffOdds:snap.odds,record:`${nw}-${nl}`}]);
    setInjuries(old=>[...old.map(i=>({...i,weeks:Math.max(0,i.weeks-1)})),...newInjuries]);
    const you=home?game.homeScore:game.awayScore, them=home?game.awayScore:game.homeScore;
    setMessage(`${won?'WIN':'LOSS'} ${you}-${them}.${newInjuries.length?` ${newInjuries[0].playerName} injured — next man up.`:''}`);
  };

  const finish = (champ:boolean,playoffWins:number,text:string) => {
    const ach=achievementsForRun(wins,losses,champ,grade.score,roster); const next=updateCareer(career,wins,losses,champ,playoffWins,grade.score,ach);
    setCareer(next); try{localStorage.setItem(CAREER_KEY,JSON.stringify(next));localStorage.removeItem(RUN_KEY);}catch{}
    void publishCareer(currentUser?.name||'Ball Knower GM',next).catch(()=>{}); setMessage(text); setStage('finished');
  };

  const enterPlayoffs = () => {
    const diff=totals.pf-totals.pa; if(wins<9||(wins===9&&diff<0)) return finish(false,0,`Season over at ${wins}-${losses}. You missed the playoffs.`);
    setStage('playoffs'); setMessage(`Playoff berth clinched. Projected #${weeks.at(-1)?.playoffSeed||7} seed.`);
  };

  const round = playoffs.length===0?'WILD CARD':playoffs.length===1?'DIVISIONAL':playoffs.length===2?'CONFERENCE':playoffs.length===3?'SUPER BOWL':null;
  const playRound = () => {
    if(!round) return; const idx=playoffs.length; const lineup=effectiveLineup(roster,bench,active); const opp=makeSoloOpponent(30+idx,settings.difficulty);
    const me:LeagueMember={id:'solo-user',userId:'solo-user',userName:'YOU',isCommissioner:true,status:'ready',roster:lineup,teamRatings:ratingsWithInjuries(roster,active,bench)};
    const home=idx%2===0, game=home?simulateGame(18+idx,me,opp):simulateGame(18+idx,opp,me); const you=home?game.homeScore:game.awayScore, them=home?game.awayScore:game.homeScore, won=game.winnerId==='solo-user';
    const next=[...playoffs,{round,opponent:opp.userName,you,them,won}]; setPlayoffs(next);
    const newInjuries=simulateInjuries(roster,18+idx,settings.injuries,active); setInjuries(old=>[...old.map(i=>({...i,weeks:Math.max(0,i.weeks-1)})),...newInjuries]);
    if(!won) finish(false,next.filter(x=>x.won).length,`${round}: ${you}-${them}. Your run ends here.`);
    else if(round==='SUPER BOWL') finish(true,4,`WORLD CHAMPION — Super Bowl LXI, ${you}-${them}.`);
    else setMessage(`${round} WIN ${you}-${them}. Keep going.`);
  };

  const reset = () => { setStage('draft');setRoster([]);setBench([]);setWeeks([]);setInjuries([]);setPlayoffs([]);setMessage('');try{localStorage.removeItem(RUN_KEY)}catch{} };
  const champion=playoffs.some(x=>x.round==='SUPER BOWL'&&x.won)||message.includes('WORLD CHAMPION');
  const share=async()=>{ const text=`BALL KNOWER SOLO\n${wins}-${losses} • ${ratings.overall} OVR • Depth ${depthOvr} • ${grade.letter} draft\n${champion?'SUPER BOWL CHAMPION 🏆':''}`; try{navigator.share?await navigator.share({title:'Ball Knower',text}):await navigator.clipboard.writeText(text)}catch{} };

  return <div className="min-h-screen bg-[#090909] text-white px-4 sm:px-8 py-7"><div className="mx-auto max-w-7xl">
    <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-7">
      <div><div className="text-[#D4AF37] text-xs font-black tracking-[.3em]">SOLO FRANCHISE</div><h2 className="text-4xl sm:text-6xl font-black leading-none mt-2">BUILD DEPTH. <span className="text-[#D4AF37]">WIN IT ALL.</span></h2><p className="text-zinc-400 mt-3">20 starters + 9 required backups. Survive 17 games, injuries and the playoffs.</p></div>
      <div className="flex gap-2"><button onClick={share} className="border border-white/10 px-4 py-2 bg-[#151515]"><Share2 className="inline mr-2" size={16}/>Share</button><button onClick={reset} className="border border-white/10 px-4 py-2 bg-[#151515]"><RotateCcw className="inline mr-2" size={16}/>New Run</button></div>
    </header>
    {message&&<div className="mb-5 border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#E7C95F] px-4 py-3 font-bold">{message}</div>}
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6"><Stat label="Career Runs" value={`${career.runs}`}/><Stat label="Titles" value={`${career.championships}`}/><Stat label="Career W-L" value={`${career.regularWins}-${career.regularLosses}`}/><Stat label="Playoff Wins" value={`${career.playoffWins}`}/><Stat label="Best Record" value={career.bestRecord}/><Stat label="Best BK" value={`${career.bestScore}`}/></div>

    {stage==='draft'&&<>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5"><Stat label="Cap Left" value={`$${remaining.toFixed(1)}M`}/><Stat label="Roster" value={`${selected.length}/${SOLO_SIZE}`}/><Stat label="Team OVR" value={`${ratings.overall}`}/><Stat label="Depth OVR" value={depthOvr?`${depthOvr}`:'—'}/><Stat label="Draft" value={`${grade.letter} • ${grade.score}`}/></div>
      <div className="grid sm:grid-cols-2 gap-4 bg-[#111] border border-white/10 p-4 mb-5"><Select label="DIFFICULTY" value={settings.difficulty} onChange={v=>setSettings({...settings,difficulty:v as any})} options={[["rookie","Rookie"],["pro","Pro"],["all_pro","All-Pro"],["all_madden","All-Madden"]]}/><Select label="INJURIES" value={settings.injuries} onChange={v=>setSettings({...settings,injuries:v as any})} options={[["off","Off"],["normal","Normal"],["chaos","Chaos"]]}/></div>
      <div className="bg-[#101010] border border-[#D4AF37]/25 p-4 mb-5"><div className="text-[10px] text-[#D4AF37] font-black tracking-[.2em] mb-3">29-MAN ROSTER REQUIREMENTS</div><div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-11 gap-2">{GROUPS.map(g=>{const n=totalCount(roster,bench,g),need=TOTALS[g];return <div key={g} className={`border p-2 text-center ${n===need?'border-green-500/30 bg-green-500/5':'border-white/10'}`}><div className="text-[10px] text-zinc-500 font-black">{label(g)}</div><div className={n===need?'text-green-400 font-black':'font-black'}>{n}/{need}</div></div>})}</div><div className="text-xs text-zinc-500 mt-3">2 QB • 2 RB • 3 WR • 2 TE • 5 OL • 4 DL/EDGE • 3 LB • 3 CB • 3 S • K • P</div></div>
      <div className="flex flex-wrap gap-2 mb-4">{['ALL',...GROUPS].map(g=><button key={g} onClick={()=>setPosition(g)} className={`px-3 py-2 text-xs font-black border ${position===g?'border-[#D4AF37] text-[#D4AF37]':'border-white/10 text-zinc-400'}`}>{label(g)}</button>)}</div>
      <div className="grid lg:grid-cols-[1.45fr_.85fr] gap-6"><div><div className="flex flex-col sm:flex-row gap-2 mb-3"><div className="flex-1 flex items-center gap-2 bg-[#151515] border border-white/10 px-3"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search players..." className="w-full bg-transparent py-3 outline-none"/></div><button onClick={autoDraft} className="px-5 py-3 bg-[#D4AF37] text-black font-black">SMART AUTO-DRAFT 29</button></div><div className="space-y-2 max-h-[720px] overflow-y-auto">{available.map(p=>{const g=groupOf(p), starter=count(roster,g)<ROSTER_REQUIREMENTS[g]; return <div key={p.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center bg-[#121212] border border-white/5 p-3"><div><b>{p.name}</b><div className="text-xs text-zinc-500">{p.team} • {p.position} • <span className={starter?'text-white':'text-[#D4AF37]'}>{starter?'STARTER':'DEPTH'}</span></div></div><b>{p.ovr}</b><span className="text-[#D4AF37] text-sm">${p.salary.toFixed(2)}M</span><button onClick={()=>add(p)} className="p-2 border border-[#D4AF37]/40 text-[#D4AF37]"><Plus size={16}/></button></div>})}</div></div>
        <aside className="bg-[#111] border border-white/10 p-4 h-fit lg:sticky lg:top-24"><h3 className="text-xl font-black">DEPTH CHART <span className="text-zinc-500 text-sm">{selected.length}/{SOLO_SIZE}</span></h3><p className="text-xs text-zinc-500 mt-1 mb-4">Backups are mandatory and automatically replace injured starters.</p><Roster title="STARTERS" players={roster} target={STARTERS} onRemove={p=>remove(p,false)}/><div className="border-t border-white/10 mt-4 pt-4"><Roster title="BACKUPS" players={bench} target={DEPTH} onRemove={p=>remove(p,true)}/></div><button disabled={!valid} onClick={start} className="mt-5 w-full py-4 bg-[#D4AF37] disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black"><Play className="inline mr-2" size={17}/>START SEASON</button></aside>
      </div>
    </>}

    {stage==='regular'&&<div className="grid lg:grid-cols-[1.4fr_.7fr] gap-6"><main><div className="grid grid-cols-4 gap-2 mb-4"><Stat label="Record" value={`${wins}-${losses}`}/><Stat label="Week" value={`${weeks.length}/17`}/><Stat label="Seed" value={`#${weeks.at(-1)?.playoffSeed||'—'}`}/><Stat label="Odds" value={`${weeks.at(-1)?.playoffOdds||50}%`}/></div>{weeks.length<17?<GameDay week={weeks.length+1} opponent={makeSoloOpponent(weeks.length+1,settings.difficulty).userName} ratings={ratingsWithInjuries(roster,active,bench)} injuries={active} depth={bench} onPlay={playWeek}/>:<button onClick={enterPlayoffs} className="w-full py-5 bg-[#D4AF37] text-black font-black text-xl">FINISH REGULAR SEASON</button>}<div className="mt-6"><h3 className="font-black mb-3">GAME LOG</h3><WeekLog weeks={weeks}/></div></main><aside className="space-y-5"><Panel title="INJURY REPORT" icon={<ShieldAlert size={18}/>}>{active.length?active.map(i=>{const starter=roster.find(p=>p.id===i.playerId);const replacement=starter?bench.filter(p=>groupOf(p)===groupOf(starter)).sort((a,b)=>b.ovr-a.ovr)[0]:null;return <div key={i.playerId} className="py-2 border-b border-white/5"><b>{i.playerName}</b><div className="text-xs text-zinc-500">{i.severity} • {i.weeks} game(s) left</div>{replacement&&<div className="text-xs text-[#D4AF37]">Next up: {replacement.name} ({replacement.ovr})</div>}</div>}):<p className="text-zinc-500 text-sm">Healthy roster.</p>}</Panel><Panel title="TEAM LEADERS" icon={<Activity size={18}/>}>{leaders.length?leaders.map((l,i)=><div key={l.name} className="flex justify-between py-2 border-b border-white/5"><span>{i+1}. {l.name}</span><b>{l.score.toFixed(1)}</b></div>):<p className="text-zinc-500 text-sm">Stats start after Week 1.</p>}</Panel></aside></div>}

    {stage==='playoffs'&&<div className="max-w-4xl mx-auto"><div className="text-center mb-7"><Trophy className="mx-auto text-[#D4AF37]" size={60}/><div className="text-[#D4AF37] text-xs font-black tracking-[.3em] mt-3">THE GAUNTLET</div><h3 className="text-5xl font-black">PLAYOFFS</h3></div><div className="grid md:grid-cols-4 gap-3">{['WILD CARD','DIVISIONAL','CONFERENCE','SUPER BOWL'].map((r,i)=>{const x=playoffs[i];return <div key={r} className={`p-4 border ${round===r?'border-[#D4AF37] bg-[#D4AF37]/10':'border-white/10 bg-[#111]'}`}><div className="text-[10px] text-[#D4AF37] font-black">{r}</div>{x?<><b>{x.won?'WIN':'LOSS'} {x.you}-{x.them}</b><div className="text-xs text-zinc-500">{x.opponent}</div></>:<div className="text-zinc-600 mt-2">TBD</div>}</div>})}</div>{active.length>0&&<div className="mt-4 border border-red-500/20 p-4 text-red-300 text-sm">Injured: {active.map(i=>i.playerName).join(', ')}. Backups are in.</div>}{round&&<button onClick={playRound} className="mt-6 w-full py-5 bg-[#D4AF37] text-black font-black text-xl">PLAY {round}</button>}</div>}

    {stage==='finished'&&<div className="max-w-6xl mx-auto"><div className={`text-center border p-8 ${champion?'border-[#D4AF37]/60 bg-[#D4AF37]/5':'border-white/10 bg-[#111]'}`}><Crown className={champion?'mx-auto text-[#D4AF37]':'mx-auto text-zinc-500'} size={70}/><div className="text-[#D4AF37] text-xs font-black tracking-[.3em] mt-3">SEASON WRAP-UP</div><h3 className="text-4xl sm:text-6xl font-black">{champion?'SUPER BOWL CHAMPION':'RUN COMPLETE'}</h3><p className="text-zinc-300 mt-3">{message}</p><div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-7"><Stat label="Record" value={`${wins}-${losses}`}/><Stat label="Points" value={`${totals.pf}-${totals.pa}`}/><Stat label="Team OVR" value={`${ratings.overall}`}/><Stat label="Depth OVR" value={`${depthOvr}`}/><Stat label="Draft" value={grade.letter}/><Stat label="BK Score" value={`${grade.score}`}/></div></div><div className="grid lg:grid-cols-3 gap-6 mt-6"><div className="lg:col-span-2"><Panel title="SEASON AWARDS" icon={<Award size={18}/>}>{awards.map(a=><div key={a.award} className="bg-[#181818] p-4 mb-2"><div className="text-[10px] text-[#D4AF37] font-black">{a.award}</div><b>{a.winner}</b></div>)}</Panel></div><Panel title="ACHIEVEMENTS" icon={<Trophy size={18}/>}>{achievementsForRun(wins,losses,champion,grade.score,roster).map(a=><div key={a} className="py-2 border-b border-white/5">🏆 {a}</div>)}</Panel></div><div className="grid lg:grid-cols-[1.35fr_.65fr] gap-6 mt-6"><Panel title="FULL GAME LOG" icon={<Activity size={18}/>}><WeekLog weeks={weeks}/>{playoffs.map(x=><div key={x.round} className="flex justify-between py-2 border-b border-white/5"><span>{x.won?'W':'L'} • {x.round} vs {x.opponent}</span><b>{x.you}-{x.them}</b></div>)}</Panel><div className="space-y-6"><Panel title="INJURY HISTORY" icon={<ShieldAlert size={18}/>}>{injuryHistory.length?injuryHistory.map(i=><div key={`${i.playerId}-${i.week}`} className="py-2 border-b border-white/5"><b>{i.playerName}</b><div className="text-xs text-zinc-500">Week {i.week} • {i.severity} • {i.weeks} game(s)</div></div>):<p className="text-zinc-500 text-sm">No injuries.</p>}</Panel><Panel title="TOP PERFORMERS" icon={<Activity size={18}/>}>{leaders.map((l,i)=><div key={l.name} className="flex justify-between py-2"><span>{i+1}. {l.name}</span><b>{l.score.toFixed(1)}</b></div>)}</Panel></div></div><div className="grid sm:grid-cols-2 gap-3 mt-6"><button onClick={share} className="py-4 border border-[#D4AF37] text-[#D4AF37] font-black"><Share2 className="inline mr-2"/>SHARE</button><button onClick={reset} className="py-4 bg-[#D4AF37] text-black font-black"><RotateCcw className="inline mr-2"/>RUN IT BACK</button></div></div>}
  </div></div>;
};

const Stat=({label,value}:{label:string,value:string})=><div className="bg-[#121212] border border-white/10 p-3 sm:p-4"><div className="text-[10px] text-zinc-500 font-black tracking-widest">{label}</div><div className="text-xl sm:text-2xl font-black mt-1">{value}</div></div>;
const Panel=({title,icon,children}:{title:string,icon:React.ReactNode,children:React.ReactNode})=><div className="bg-[#111] border border-white/10 p-4"><h4 className="flex items-center gap-2 text-[#D4AF37] font-black mb-3">{icon}{title}</h4>{children}</div>;
const Select=({label:lbl,value,onChange,options}:{label:string,value:string,onChange:(v:string)=>void,options:string[][]})=><label className="text-xs font-black">{lbl}<select value={value} onChange={e=>onChange(e.target.value)} className="mt-2 block w-full bg-[#181818] border border-white/10 p-3">{options.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>;
const Roster=({title,players,target,onRemove}:{title:string,players:Player[],target:number,onRemove:(p:Player)=>void})=><div><div className="flex justify-between text-[10px] font-black text-[#D4AF37] mb-2"><span>{title}</span><span>{players.length}/{target}</span></div><div className="space-y-1 max-h-[250px] overflow-y-auto">{players.map(p=><div key={p.id} className="flex justify-between bg-[#181818] px-3 py-2"><span className="truncate"><b>{p.position}</b> {p.name} <small className="text-zinc-600">{p.ovr}</small></span><button onClick={()=>onRemove(p)}><Trash2 size={15}/></button></div>)}</div></div>;
const GameDay=({week,opponent,ratings,injuries,depth,onPlay}:{week:number,opponent:string,ratings:any,injuries:InjuryEvent[],depth:Player[],onPlay:()=>void})=><div className="bg-[#111] border border-[#D4AF37]/30 p-6 text-center"><div className="text-[#D4AF37] text-xs font-black tracking-[.25em]">WEEK {week}</div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mt-5"><div><div className="text-3xl font-black">YOU</div><div className="text-zinc-500">{ratings.overall} OVR</div></div><b className="text-zinc-600">VS</b><div><div className="text-xl font-black">{opponent}</div><div className="text-zinc-500">CPU</div></div></div><p className="text-sm text-zinc-400 mt-5">{injuries.length?`${injuries.length} starter(s) out — your ${depth.length}-man backup unit is active.`:'Healthy entering kickoff.'}</p><button onClick={onPlay} className="mt-5 w-full py-4 bg-[#D4AF37] text-black font-black"><Play className="inline mr-2"/>SIMULATE WEEK {week}</button></div>;
const WeekLog=({weeks}:{weeks:SoloWeek[]})=><div className="space-y-2">{[...weeks].reverse().map(w=>{const home=w.game.homeMemberId==='solo-user',you=home?w.game.homeScore:w.game.awayScore,them=home?w.game.awayScore:w.game.homeScore;return <details key={w.week} className="bg-[#121212] border border-white/10 p-4"><summary className="cursor-pointer flex justify-between gap-3"><span><b className={w.won?'text-green-400':'text-red-400'}>{w.won?'W':'L'}</b> • Week {w.week} vs {w.opponent}</span><b>{you}-{them}</b></summary>{w.injuries?.length>0&&<div className="text-xs text-red-300 mt-2">Injury: {w.injuries.map(i=>i.playerName).join(', ')}</div>}<div className="grid sm:grid-cols-2 gap-2 mt-3">{(w.playerLines||[]).slice(0,10).map(l=><div key={`${w.week}-${l.playerId}`} className="bg-[#181818] p-2 text-xs"><b>{l.name}</b> <span className="text-zinc-500">{l.position}</span><div className="text-zinc-300">{l.passYds!=null&&`${l.passYds} PASS • ${l.passTD} TD`} {l.rushYds!=null&&`${l.rushYds} RUSH`} {l.recYds!=null&&`${l.receptions} REC • ${l.recYds} YDS`} {l.sacks!=null&&`${l.tackles} TKL • ${l.sacks} SACK • ${l.picks} INT`} {l.fgMade!=null&&`${l.fgMade}/${l.fgAtt} FG`}</div></div>)}</div></details>})}</div>;