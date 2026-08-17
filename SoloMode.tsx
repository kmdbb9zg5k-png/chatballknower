import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, Award, BarChart3, ChevronDown, CircleHelp, Crown, Flame, Play, Plus,
  RotateCcw, Search, Share2, ShieldAlert, Sparkles, Trash2, Trophy,
  ArrowRightLeft, TrendingUp
} from 'lucide-react';
import { PLAYERS_DATABASE } from './players';
import { DEFAULT_SALARY_CAP, LeagueMember, Player, ROSTER_REQUIREMENTS } from './types';
import { getDraftPositionGroup, validateRosterShape } from './rosterRules';
import { calculateTeamRatings } from './evaluation';
import { gradeDraft } from './smartDraft';
import { simulateGame } from './simulation';
import { useBallKnower } from './BallKnowerContext';
import { publishCareer } from './leaderboardCloud';
import {
  CareerProfile, InjuryEvent, SoloSettings, SoloWeek, Storyline, SoloTradeOffer,
  achievementsForRun, aggregateSeasonStats, applyChemistry, buildAwards, buildLeagueLeaders,
  buildMvpRace, buildShareCardSvg, buildStoryline, buildTradeOffer, calculateBkRating,
  calculateChemistry, defaultCareer, generatePlayerLines, makeSoloOpponent, playoffSnapshot,
  ratingsWithInjuries, simulateInjuries, updateCareer
} from './soloSeasonEngine';

type Stage='draft'|'regular'|'playoffs'|'finished';
type Group=keyof typeof ROSTER_REQUIREMENTS;
type PlayoffResult={round:string;opponent:string;you:number;them:number;won:boolean};

const GROUPS:Group[]=['QB','RB','WR','TE','OL','DL_EDGE','LB','CB','S','K','P'];
const BACKUPS:Record<Group,number>={QB:1,RB:1,WR:1,TE:1,OL:1,DL_EDGE:1,LB:1,CB:1,S:1,K:0,P:0};
const TOTALS:Record<Group,number>=GROUPS.reduce((o,g)=>{o[g]=ROSTER_REQUIREMENTS[g]+BACKUPS[g];return o;},{} as Record<Group,number>);
const STARTERS=Object.values(ROSTER_REQUIREMENTS).reduce((a,b)=>a+b,0);
const DEPTH=Object.values(BACKUPS).reduce((a,b)=>a+b,0);
const SOLO_SIZE=STARTERS+DEPTH;
const RUN_KEY='ballknower_solo_run_v4';
const CAREER_KEY='ballknower_solo_career_v2';
const LEGACY_CAREER_KEY='ballknower_solo_career_v1';
const HEADSHOT_ENDPOINT='https://gpnboygoosrmeydwjpvk.supabase.co/functions/v1/nfl-player-headshot';

const label=(g:string)=>g==='DL_EDGE'?'DL/EDGE':g;
const groupOf=(p:Player)=>getDraftPositionGroup(p) as Group;
const count=(players:Player[],g:Group)=>players.filter(p=>groupOf(p)===g).length;
const totalCount=(starters:Player[],depth:Player[],g:Group)=>count(starters,g)+count(depth,g);

function minimumFinishCost(starters:Player[],depth:Player[]){
  const used=new Set([...starters,...depth].map(p=>p.id));let cost=0;
  for(const g of GROUPS){
    const need=Math.max(0,TOTALS[g]-totalCount(starters,depth,g));if(!need)continue;
    const cheap=PLAYERS_DATABASE.filter(p=>!used.has(p.id)&&groupOf(p)===g&&Number.isFinite(Number(p.salary))).sort((a,b)=>a.salary-b.salary).slice(0,need);
    if(cheap.length<need)return Infinity;cost+=cheap.reduce((n,p)=>n+p.salary,0);
  }
  return cost;
}

function effectiveLineup(starters:Player[],depth:Player[],injuries:InjuryEvent[]){
  const out=[...starters];const used=new Set<string>();
  for(const injury of injuries.filter(i=>i.weeks>0)){
    const idx=out.findIndex(p=>p.id===injury.playerId);if(idx<0)continue;
    const g=groupOf(out[idx]);const next=depth.filter(p=>groupOf(p)===g&&!used.has(p.id)).sort((a,b)=>b.ovr-a.ovr)[0];
    if(next){out[idx]=next;used.add(next.id);}
  }
  return out;
}

function smartScore(p:Player){
  const g=groupOf(p);const weight:Record<Group,number>={QB:1.28,RB:.95,WR:1.12,TE:1.02,OL:1.10,DL_EDGE:1.16,LB:.98,CB:1.12,S:1.01,K:.72,P:.65};
  return p.ovr*weight[g]+Math.min(30,p.ovr/Math.max(.8,p.salary)*1.7)-p.salary*.1;
}

export const SoloMode:React.FC=()=>{
  const {currentUser}=useBallKnower();
  const [stage,setStage]=useState<Stage>('draft');
  const [roster,setRoster]=useState<Player[]>([]);const [bench,setBench]=useState<Player[]>([]);
  const [weeks,setWeeks]=useState<SoloWeek[]>([]);const [injuries,setInjuries]=useState<InjuryEvent[]>([]);
  const [playoffs,setPlayoffs]=useState<PlayoffResult[]>([]);const [storylines,setStorylines]=useState<Storyline[]>([]);
  const [tradeOffer,setTradeOffer]=useState<SoloTradeOffer|null>(null);
  const [query,setQuery]=useState('');const [position,setPosition]=useState('ALL');const [message,setMessage]=useState('');
  const [showAdvanced,setShowAdvanced]=useState(false);const [showTeam,setShowTeam]=useState(false);
  const [settings,setSettings]=useState<SoloSettings>({difficulty:'pro',injuries:'normal'});
  const [career,setCareer]=useState<CareerProfile>(()=>{try{const raw=localStorage.getItem(CAREER_KEY)||localStorage.getItem(LEGACY_CAREER_KEY);const saved=raw?JSON.parse(raw):null;return saved?{...defaultCareer(),...saved,achievements:Array.isArray(saved.achievements)?saved.achievements:[]}:defaultCareer();}catch{return defaultCareer();}});

  useEffect(()=>{try{const raw=localStorage.getItem(RUN_KEY);if(!raw)return;const r=JSON.parse(raw);if(!['regular','playoffs'].includes(r?.stage)||!Array.isArray(r.roster)||r.roster.length!==STARTERS||!Array.isArray(r.bench)||r.bench.length!==DEPTH){localStorage.removeItem(RUN_KEY);return;}setStage(r.stage);setRoster(r.roster);setBench(r.bench);setWeeks(Array.isArray(r.weeks)?r.weeks:[]);setInjuries(Array.isArray(r.injuries)?r.injuries:[]);setPlayoffs(Array.isArray(r.playoffs)?r.playoffs:[]);setStorylines(Array.isArray(r.storylines)?r.storylines:[]);setTradeOffer(r.tradeOffer||null);if(r.settings)setSettings(r.settings);setMessage('Your season was restored.');}catch{localStorage.removeItem(RUN_KEY);}},[]);
  useEffect(()=>{if(stage!=='regular'&&stage!=='playoffs')return;try{localStorage.setItem(RUN_KEY,JSON.stringify({stage,roster,bench,weeks,injuries,playoffs,storylines,tradeOffer,settings}));}catch{}},[stage,roster,bench,weeks,injuries,playoffs,storylines,tradeOffer,settings]);
  useEffect(()=>{if(stage==='finished')window.scrollTo({top:0,behavior:'smooth'});},[stage]);

  const selected=useMemo(()=>[...roster,...bench],[roster,bench]);
  const spent=useMemo(()=>selected.reduce((n,p)=>n+Number(p.salary||0),0),[selected]);
  const remaining=DEFAULT_SALARY_CAP-spent;
  const baseRatings=useMemo(()=>calculateTeamRatings(roster),[roster]);
  const chemistry=useMemo(()=>calculateChemistry(roster,bench),[roster,bench]);
  const ratings=useMemo(()=>applyChemistry(baseRatings,chemistry),[baseRatings,chemistry]);
  const grade=useMemo(()=>gradeDraft(roster,DEFAULT_SALARY_CAP),[roster]);
  const depthOvr=bench.length?Math.round(bench.reduce((n,p)=>n+p.ovr,0)/bench.length):0;
  const starterErrors=validateRosterShape(roster);const depthErrors=GROUPS.filter(g=>count(bench,g)!==BACKUPS[g]);
  const valid=roster.length===STARTERS&&bench.length===DEPTH&&!starterErrors.length&&!depthErrors.length&&spent<=DEFAULT_SALARY_CAP;
  const nextNeed=GROUPS.find(g=>totalCount(roster,bench,g)<TOTALS[g]);
  const wins=weeks.filter(w=>w.won).length,losses=weeks.length-wins;
  const active=injuries.filter(i=>i.weeks>0);
  const allLines=weeks.flatMap(w=>Array.isArray(w.playerLines)?w.playerLines:[]);
  const seasonStats=useMemo(()=>aggregateSeasonStats(allLines),[weeks]);
  const awards=buildAwards(allLines);const injuryHistory=weeks.flatMap(w=>Array.isArray(w.injuries)?w.injuries:[]);
  const totals=weeks.reduce((a,w)=>{const home=w.game.homeMemberId==='solo-user';a.pf+=home?w.game.homeScore:w.game.awayScore;a.pa+=home?w.game.awayScore:w.game.homeScore;return a;},{pf:0,pa:0});
  const leagueLeaders=useMemo(()=>buildLeagueLeaders(seasonStats,weeks.length),[seasonStats,weeks.length]);
  const mvpRace=useMemo(()=>buildMvpRace(seasonStats,weeks.length),[seasonStats,weeks.length]);
  const latestStory=storylines[0];const careerRating=calculateBkRating(career);

  const available=useMemo(()=>PLAYERS_DATABASE.filter(p=>{
    if(selected.some(x=>x.id===p.id))return false;const g=groupOf(p);
    if(!GROUPS.includes(g)||totalCount(roster,bench,g)>=TOTALS[g])return false;
    if(query&&!`${p.name} ${p.team} ${p.position}`.toLowerCase().includes(query.toLowerCase()))return false;
    return position==='ALL'||g===position||p.position===position;
  }).sort((a,b)=>b.ovr-a.ovr).slice(0,180),[selected,roster,bench,query,position]);

  const add=(p:Player)=>{
    const g=groupOf(p);
    if(totalCount(roster,bench,g)>=TOTALS[g])return setMessage(`${label(g)} is already full.`);
    if(p.salary>remaining)return setMessage('Too expensive — that player puts you over the cap.');
    const isStarter=count(roster,g)<ROSTER_REQUIREMENTS[g];const nr=isStarter?[...roster,p]:roster,nb=isStarter?bench:[...bench,p];
    if(minimumFinishCost(nr,nb)>remaining-p.salary+.001)return setMessage('Too expensive — this pick would leave you unable to fill all 29 spots.');
    isStarter?setRoster(nr):setBench(nb);setMessage(`${p.name} added. ${SOLO_SIZE-selected.length-1} spots left.`);
  };

  const remove=(p:Player,depth:boolean)=>{
    if(depth){setBench(b=>b.filter(x=>x.id!==p.id));return;}
    const g=groupOf(p);const promote=bench.filter(x=>groupOf(x)===g).sort((a,b)=>b.ovr-a.ovr)[0];
    if(promote){setRoster(r=>r.map(x=>x.id===p.id?promote:x));setBench(b=>b.filter(x=>x.id!==promote.id));setMessage(`${promote.name} moved into the starting lineup.`);}else setRoster(r=>r.filter(x=>x.id!==p.id));
  };

  const autoDraft=()=>{try{
    const pools={} as Record<Group,Player[]>;const picked={} as Record<Group,Player[]>;GROUPS.forEach(g=>{pools[g]=[];picked[g]=[];});
    for(const p of PLAYERS_DATABASE){const g=groupOf(p),salary=Number(p.salary);if(!GROUPS.includes(g)||!Number.isFinite(salary)||salary<0||!Number.isFinite(Number(p.ovr)))continue;pools[g].push(p);}
    let total=0;
    for(const g of GROUPS){pools[g].sort((a,b)=>a.salary-b.salary||b.ovr-a.ovr);if(pools[g].length<TOTALS[g])throw new Error(`Not enough ${label(g)} players.`);picked[g]=pools[g].slice(0,TOTALS[g]);total+=picked[g].reduce((n,p)=>n+p.salary,0);}
    if(total>DEFAULT_SALARY_CAP)throw new Error('A legal 29-man roster cannot currently fit under the cap.');
    const candidatePools={} as Record<Group,Player[]>;for(const g of GROUPS)candidatePools[g]=[...pools[g]].sort((a,b)=>smartScore(b)-smartScore(a)).slice(0,55);
    for(let round=0;round<60;round++){
      const chosen=new Set(GROUPS.flatMap(g=>picked[g]).map(p=>p.id));const capLeft=DEFAULT_SALARY_CAP-total;let best:{g:Group;slot:number;p:Player;delta:number;score:number}|null=null;
      for(const g of GROUPS){for(let slot=0;slot<picked[g].length;slot++){const old=picked[g][slot],oldValue=smartScore(old);for(const p of candidatePools[g]){if(chosen.has(p.id))continue;const delta=p.salary-old.salary;if(delta>capLeft+.001)continue;const gain=smartScore(p)-oldValue;if(gain<=.01)continue;const score=gain*5+gain/Math.max(.25,delta>0?delta:.25);if(!best||score>best.score)best={g,slot,p,delta,score};}}}
      if(!best)break;picked[best.g][best.slot]=best.p;total+=best.delta;
    }
    const s:Player[]=[],d:Player[]=[];for(const g of GROUPS){const gp=[...picked[g]].sort((a,b)=>b.ovr-a.ovr||a.salary-b.salary);s.push(...gp.slice(0,ROSTER_REQUIREMENTS[g]));d.push(...gp.slice(ROSTER_REQUIREMENTS[g]));}
    if(s.length!==STARTERS||d.length!==DEPTH)throw new Error('Auto-draft could not finish the roster.');
    setRoster(s);setBench(d);setShowTeam(true);setMessage(`Team built. You have $${Math.max(0,DEFAULT_SALARY_CAP-total).toFixed(1)}M left — review it or start the season.`);
  }catch(error){console.error('Solo auto-draft failed',error);setMessage(error instanceof Error?error.message:'Auto-draft failed.');}};

  const start=()=>{
    if(!valid)return setMessage(starterErrors[0]||`You still need ${depthErrors.map(label).join(', ')} depth.`);
    setWeeks([]);setInjuries([]);setPlayoffs([]);setStorylines([]);setTradeOffer(null);setStage('regular');setMessage('Week 1 is ready. Tap Simulate Week when you are ready.');window.scrollTo({top:0,behavior:'smooth'});
  };

  const playWeek=()=>{
    if(tradeOffer)return setMessage('Handle the trade offer before the next game.');const week=weeks.length+1;if(week>17)return;
    const lineup=effectiveLineup(roster,bench,active);const myRatings=applyChemistry(ratingsWithInjuries(roster,active,bench),chemistry);
    const me:LeagueMember={id:'solo-user',userId:'solo-user',userName:'YOU',isCommissioner:true,status:'ready',roster:lineup,teamRatings:myRatings};
    const opp=makeSoloOpponent(week,settings.difficulty);const home=week%2===1;const game=home?simulateGame(week,me,opp):simulateGame(week,opp,me);
    const won=game.winnerId==='solo-user',nw=wins+(won?1:0),nl=losses+(won?0:1),snap=playoffSnapshot(nw,nl,week);
    const newInjuries=simulateInjuries(roster,week,settings.injuries,active);const playerLines=generatePlayerLines(lineup,game,home,week);const nextRecord=`${nw}-${nl}`;
    const story=buildStoryline(week,game,home,playerLines,newInjuries,nextRecord,chemistry.score);
    setWeeks(w=>[...w,{week,opponent:opp.userName,game,won,playerLines,injuries:newInjuries,playoffSeed:snap.seed,playoffOdds:snap.odds,record:nextRecord}]);
    setInjuries(old=>[...old.map(i=>({...i,weeks:Math.max(0,i.weeks-1)})),...newInjuries]);setStorylines(s=>[story,...s].slice(0,25));
    const offer=buildTradeOffer(roster,bench,week,remaining);if(offer)setTradeOffer(offer);
    const you=home?game.homeScore:game.awayScore,them=home?game.awayScore:game.homeScore;setMessage(`${won?'WIN':'LOSS'} ${you}-${them}. ${offer?'You also have a trade offer.':''}`);
  };

  const acceptTrade=()=>{if(!tradeOffer)return;const {incoming,outgoing}=tradeOffer;const inStarters=roster.some(p=>p.id===outgoing.id);if(inStarters)setRoster(r=>r.map(p=>p.id===outgoing.id?incoming:p));else setBench(b=>b.map(p=>p.id===outgoing.id?incoming:p));setInjuries(x=>x.filter(i=>i.playerId!==outgoing.id));setStorylines(s=>[{id:`trade-story-${tradeOffer.id}`,week:weeks.length,tag:'TRADE ALERT',headline:`Ball Knower acquires ${incoming.name}`,deck:`${outgoing.name} heads out in a one-for-one ${label(groupOf(incoming))} swap. Net cap change: ${tradeOffer.capDelta>=0?'+':''}$${tradeOffer.capDelta.toFixed(2)}M.`,tone:'gold'},...s]);setMessage(`Trade accepted: ${incoming.name} is in.`);setTradeOffer(null);};
  const declineTrade=()=>{if(!tradeOffer)return;setMessage(`Trade declined. ${tradeOffer.outgoing.name} stays.`);setTradeOffer(null);};

  const finish=(champ:boolean,playoffWins:number,text:string)=>{
    const ach=achievementsForRun(wins,losses,champ,grade.score,roster);const next=updateCareer(career,wins,losses,champ,playoffWins,grade.score,ach);setCareer(next);
    try{localStorage.setItem(CAREER_KEY,JSON.stringify(next));localStorage.removeItem(RUN_KEY);}catch{}
    const top=seasonStats[0];void publishCareer(currentUser?.name||'Ball Knower GM',next,{bestRoster:[...roster,...bench].map(p=>({id:p.id,name:p.name,team:p.team,position:p.position,ovr:p.ovr,salary:p.salary})),lastRunSummary:{record:`${wins}-${losses}`,champion:champ,overall:ratings.overall,chemistry:chemistry.score,draftGrade:grade.letter,bkScore:grade.score,topPlayer:top?.name||null,finishedAt:new Date().toISOString()}}).catch(()=>{});
    setMessage(text);setStage('finished');
  };

  const enterPlayoffs=()=>{const diff=totals.pf-totals.pa;if(wins<9||(wins===9&&diff<0))return finish(false,0,`Season over at ${wins}-${losses}. You missed the playoffs.`);setStage('playoffs');setMessage(`You made the playoffs as the projected #${weeks.at(-1)?.playoffSeed||7} seed.`);window.scrollTo({top:0,behavior:'smooth'});};
  const round=playoffs.length===0?'WILD CARD':playoffs.length===1?'DIVISIONAL':playoffs.length===2?'CONFERENCE':playoffs.length===3?'SUPER BOWL':null;
  const playRound=()=>{if(!round)return;const idx=playoffs.length,lineup=effectiveLineup(roster,bench,active),opp=makeSoloOpponent(30+idx,settings.difficulty);const me:LeagueMember={id:'solo-user',userId:'solo-user',userName:'YOU',isCommissioner:true,status:'ready',roster:lineup,teamRatings:applyChemistry(ratingsWithInjuries(roster,active,bench),chemistry)};const home=idx%2===0,game=home?simulateGame(18+idx,me,opp):simulateGame(18+idx,opp,me),you=home?game.homeScore:game.awayScore,them=home?game.awayScore:game.homeScore,won=game.winnerId==='solo-user';const next=[...playoffs,{round,opponent:opp.userName,you,them,won}];setPlayoffs(next);const newInjuries=simulateInjuries(roster,18+idx,settings.injuries,active);setInjuries(old=>[...old.map(i=>({...i,weeks:Math.max(0,i.weeks-1)})),...newInjuries]);if(!won)finish(false,next.filter(x=>x.won).length,`${round}: ${you}-${them}. Your run ends here.`);else if(round==='SUPER BOWL')finish(true,4,`WORLD CHAMPION — Super Bowl LXI, ${you}-${them}.`);else setMessage(`${round} WIN ${you}-${them}. One step closer.`);};

  const reset=()=>{setStage('draft');setRoster([]);setBench([]);setWeeks([]);setInjuries([]);setPlayoffs([]);setStorylines([]);setTradeOffer(null);setMessage('');setShowAdvanced(false);setShowTeam(false);try{localStorage.removeItem(RUN_KEY);}catch{}window.scrollTo({top:0,behavior:'smooth'});};
  const champion=playoffs.some(x=>x.round==='SUPER BOWL'&&x.won)||message.includes('WORLD CHAMPION');
  const share=async()=>{const text=`BALL KNOWER\n${wins}-${losses} • ${ratings.overall} OVR • ${chemistry.score} Chemistry • ${grade.letter} Draft • BK ${grade.score}\n${champion?'SUPER BOWL CHAMPION 🏆':''}`;const svg=buildShareCardSvg({name:currentUser?.name||'Ball Knower GM',record:`${wins}-${losses}`,champion,ovr:ratings.overall,chemistry:chemistry.score,bkScore:grade.score,capLeft:remaining,topPlayer:seasonStats[0]?.name});try{const blob=new Blob([svg],{type:'image/svg+xml'});const file=new File([blob],'ball-knower-season.svg',{type:'image/svg+xml'});if(navigator.share&&(navigator as any).canShare?.({files:[file]})){await navigator.share({title:'Ball Knower',text,files:[file]});return;}if(navigator.share){await navigator.share({title:'Ball Knower',text});return;}await navigator.clipboard.writeText(text);}catch{try{await navigator.clipboard.writeText(text);}catch{}}};

  return <div className="min-h-screen bg-[#090909] text-white px-4 sm:px-8 py-6"><div className="mx-auto max-w-7xl">
    <header className="flex items-end justify-between gap-4 mb-5"><div><div className="text-[#D4AF37] text-[10px] font-black tracking-[.28em]">SOLO FRANCHISE</div><h2 className="text-3xl sm:text-5xl font-black leading-none mt-1">BUILD A TEAM. <span className="text-[#D4AF37]">SEE IF IT WINS.</span></h2></div>{stage!=='finished'&&<button onClick={reset} className="shrink-0 border border-white/10 px-3 py-2 bg-[#151515] text-xs font-black"><RotateCcw className="inline mr-1" size={14}/>NEW RUN</button>}</header>

    <StepBar stage={stage}/>
    {message&&<div className="mb-4 border border-[#D4AF37]/25 bg-[#D4AF37]/8 text-[#E7C95F] px-4 py-3 text-sm font-bold">{message}</div>}

    {stage==='draft'&&<>
      <section className="bg-[#111] border border-[#D4AF37]/25 p-4 sm:p-5 mb-4">
        <div className="flex gap-3 items-start"><CircleHelp className="text-[#D4AF37] shrink-0 mt-0.5" size={22}/><div><div className="text-[10px] text-[#D4AF37] font-black tracking-[.2em]">STEP 1 — DRAFT 29 PLAYERS</div><h3 className="text-xl sm:text-2xl font-black mt-1">Tap + next to players you want.</h3><p className="text-sm text-zinc-400 mt-1">Stay under <b className="text-white">$301.2M</b>. We automatically put your first players at each position into the starting lineup, then fill the backups. When you reach <b className="text-white">29/29</b>, Start Season unlocks.</p></div></div>
        <div className="mt-4 h-2 bg-black/50 overflow-hidden"><div className="h-full bg-[#D4AF37] transition-all" style={{width:`${Math.min(100,selected.length/SOLO_SIZE*100)}%`}}/></div>
      </section>

      <div className="grid grid-cols-3 gap-2 mb-4"><SimpleStat label="PLAYERS" value={`${selected.length}/29`}/><SimpleStat label="CAP LEFT" value={`$${remaining.toFixed(1)}M`}/><SimpleStat label="NEXT NEED" value={nextNeed?`${label(nextNeed)} ${totalCount(roster,bench,nextNeed)}/${TOTALS[nextNeed]}`:'DONE'}/></div>

      <button onClick={()=>setShowTeam(!showTeam)} className="w-full mb-3 flex items-center justify-between bg-[#111] border border-white/10 px-4 py-3 text-left"><span><b>YOUR TEAM</b><span className="ml-2 text-zinc-500 text-sm">{selected.length}/29</span></span><ChevronDown size={18} className={`transition-transform ${showTeam?'rotate-180':''}`}/></button>
      {showTeam&&<div className="grid md:grid-cols-2 gap-3 mb-4"><Roster title="STARTERS" players={roster} target={STARTERS} onRemove={p=>remove(p,false)}/><Roster title="BACKUPS" players={bench} target={DEPTH} onRemove={p=>remove(p,true)}/></div>}

      <button onClick={()=>setShowAdvanced(!showAdvanced)} className="w-full mb-4 flex items-center justify-between border border-white/10 px-4 py-3 text-left text-sm text-zinc-400"><span>More info & settings <span className="text-zinc-600">(optional)</span></span><ChevronDown size={17} className={`transition-transform ${showAdvanced?'rotate-180':''}`}/></button>
      {showAdvanced&&<div className="bg-[#111] border border-white/10 p-4 mb-4 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3"><Select label="DIFFICULTY" value={settings.difficulty} onChange={v=>setSettings({...settings,difficulty:v as any})} options={[["rookie","Rookie"],["pro","Pro"],["all_pro","All-Pro"],["all_madden","All-Madden"]]}/><Select label="INJURIES" value={settings.injuries} onChange={v=>setSettings({...settings,injuries:v as any})} options={[["off","Off"],["normal","Normal"],["chaos","Chaos"]]}/></div>
        <div><div className="text-[10px] text-[#D4AF37] font-black tracking-widest mb-2">WHY 29?</div><p className="text-xs text-zinc-500">20 starters + 9 required backups. Your backups automatically replace injured starters.</p><div className="flex flex-wrap gap-1.5 mt-2">{GROUPS.map(g=><span key={g} className="text-[10px] border border-white/10 px-2 py-1 text-zinc-400">{label(g)} {totalCount(roster,bench,g)}/{TOTALS[g]}</span>)}</div></div>
        <ChemistryPanel chemistry={chemistry} compact/>
      </div>}

      <div className="flex flex-wrap gap-2 mb-3">{['ALL',...GROUPS].map(g=><button key={g} onClick={()=>setPosition(g)} className={`px-3 py-2 text-xs font-black border ${position===g?'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]':'border-white/10 text-zinc-400'}`}>{label(g)}</button>)}</div>
      <div className="flex gap-2 mb-3"><div className="flex-1 flex items-center gap-2 bg-[#151515] border border-white/10 px-3"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search players..." className="w-full bg-transparent py-3 outline-none"/></div><button onClick={autoDraft} className="hidden sm:block px-4 border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-black">BUILD FOR ME</button></div>
      <button onClick={autoDraft} className="sm:hidden w-full mb-3 py-3 border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-black">BUILD A TEAM FOR ME</button>

      <div className="space-y-2 max-h-[760px] overflow-y-auto mb-4">{available.map(p=>{const g=groupOf(p),starter=count(roster,g)<ROSTER_REQUIREMENTS[g];return <button key={p.id} onClick={()=>add(p)} className="w-full text-left grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center bg-[#121212] border border-white/5 p-3 active:bg-[#1b1b1b]"><div className="min-w-0"><b className="block truncate">{p.name}</b><div className="text-xs text-zinc-500">{p.team} • {p.position} • {starter?'Starter':'Backup'}</div></div><b>{p.ovr}</b><span className="text-[#D4AF37] text-sm">${p.salary.toFixed(2)}M</span><span className="p-2 border border-[#D4AF37]/40 text-[#D4AF37]"><Plus size={16}/></span></button>})}</div>

      <div className="sticky bottom-3 z-20 bg-[#090909]/95 backdrop-blur border border-white/10 p-3 shadow-2xl"><div className="flex items-center justify-between mb-2 text-xs"><span className="text-zinc-400">{valid?'Your team is ready.':'Finish all 29 spots to continue.'}</span><b className={valid?'text-green-400':'text-zinc-500'}>{selected.length}/29</b></div><button disabled={!valid} onClick={start} className="w-full py-4 bg-[#D4AF37] disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black"><Play className="inline mr-2" size={17}/>{valid?'START THE 17-GAME SEASON':'START SEASON'}</button></div>
    </>}

    {stage==='regular'&&<div className="space-y-4">
      <section className="bg-[#111] border border-[#D4AF37]/25 p-4"><div className="text-[10px] text-[#D4AF37] font-black tracking-[.2em]">STEP 2 — PLAY 17 GAMES</div><h3 className="text-2xl font-black mt-1">One button per week. We handle the rest.</h3><p className="text-sm text-zinc-500 mt-1">Injuries trigger backups automatically. Trade offers only appear when you actually have one.</p></section>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2"><SimpleStat label="RECORD" value={`${wins}-${losses}`}/><SimpleStat label="WEEK" value={`${weeks.length}/17`}/><SimpleStat label="TEAM OVR" value={`${ratings.overall}`}/><SimpleStat label="CAP SPACE" value={`$${remaining.toFixed(1)}M`}/></div>
      <CapBar spent={spent} remaining={remaining}/>
      {latestStory&&<StoryCard story={latestStory}/>} {tradeOffer&&<TradeCard offer={tradeOffer} capSpace={remaining} onAccept={acceptTrade} onDecline={declineTrade}/>} 
      {active.length>0&&<div className="border border-red-500/25 bg-red-500/5 p-4"><div className="text-xs font-black text-red-300">INJURY REPORT</div>{active.map(i=><div key={i.playerId} className="flex items-center gap-3 mt-2"><PlayerFace name={i.playerName} position={i.position} size={36}/><div className="text-sm"><b>{i.playerName}</b><div className="text-zinc-500">{i.weeks} game(s) left</div></div></div>)}</div>}
      {weeks.length<17?<GameDay week={weeks.length+1} opponent={makeSoloOpponent(weeks.length+1,settings.difficulty).userName} ratings={applyChemistry(ratingsWithInjuries(roster,active,bench),chemistry)} injuries={active} depth={bench} onPlay={playWeek}/>:<button onClick={enterPlayoffs} className="w-full py-5 bg-[#D4AF37] text-black font-black text-xl">SEE IF YOU MADE THE PLAYOFFS</button>}

      <details className="bg-[#111] border border-white/10"><summary className="cursor-pointer p-4 font-black">SEASON HUB <span className="text-zinc-500 text-sm font-medium">— stats, MVP race, leaders & game log</span></summary><div className="p-4 pt-0 space-y-5"><div className="grid lg:grid-cols-2 gap-4"><Panel title="LEAGUE LEADERS" icon={<BarChart3 size={18}/>}><LeaderList rows={leagueLeaders}/></Panel><Panel title="MVP RACE" icon={<TrendingUp size={18}/>}><MvpList rows={mvpRace}/></Panel></div><Panel title="YOUR SEASON STATS" icon={<Activity size={18}/>}><SeasonStats rows={seasonStats}/></Panel><Panel title="GAME LOG" icon={<Activity size={18}/>}><WeekLog weeks={weeks}/></Panel><ChemistryPanel chemistry={chemistry} compact/></div></details>
    </div>}

    {stage==='playoffs'&&<div className="max-w-5xl mx-auto"><section className="text-center border border-[#D4AF37]/25 bg-[#D4AF37]/5 p-6 mb-5"><div className="text-[10px] text-[#D4AF37] font-black tracking-[.2em]">STEP 3 — WIN FOUR GAMES</div><Trophy className="mx-auto text-[#D4AF37] mt-3" size={54}/><h3 className="text-4xl sm:text-5xl font-black mt-2">PLAYOFFS</h3><p className="text-zinc-400 mt-2">Lose once and the run is over. • ${remaining.toFixed(1)}M cap space</p></section><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{['WILD CARD','DIVISIONAL','CONFERENCE','SUPER BOWL'].map((r,i)=>{const x=playoffs[i];return <div key={r} className={`p-4 border ${round===r?'border-[#D4AF37] bg-[#D4AF37]/10':'border-white/10 bg-[#111]'}`}><div className="text-[9px] text-[#D4AF37] font-black">{r}</div>{x?<><b>{x.won?'WIN':'LOSS'} {x.you}-{x.them}</b><div className="text-xs text-zinc-500">{x.opponent}</div></>:<div className="text-zinc-600 mt-2">TBD</div>}</div>})}</div>{active.length>0&&<div className="mt-4 border border-red-500/20 p-4 text-red-300 text-sm">Injured: {active.map(i=>i.playerName).join(', ')}. Backups are automatically in.</div>}{round&&<button onClick={playRound} className="mt-5 w-full py-5 bg-[#D4AF37] text-black font-black text-xl">PLAY {round}</button>}</div>}

    {stage==='finished'&&<div className="max-w-6xl mx-auto"><div className={`text-center border p-7 ${champion?'border-[#D4AF37]/60 bg-[#D4AF37]/5':'border-white/10 bg-[#111]'}`}><Crown className={champion?'mx-auto text-[#D4AF37]':'mx-auto text-zinc-500'} size={64}/><div className="text-[#D4AF37] text-xs font-black tracking-[.3em] mt-3">SEASON COMPLETE</div><h3 className="text-4xl sm:text-6xl font-black">{champion?'SUPER BOWL CHAMPION':'YOUR RUN IS OVER'}</h3><p className="text-zinc-300 mt-3">{message}</p><div className="grid grid-cols-2 md:grid-cols-7 gap-2 mt-6"><SimpleStat label="RECORD" value={`${wins}-${losses}`}/><SimpleStat label="TEAM OVR" value={`${ratings.overall}`}/><SimpleStat label="CAP LEFT" value={`$${remaining.toFixed(1)}M`}/><SimpleStat label="CHEMISTRY" value={`${chemistry.score}`}/><SimpleStat label="DRAFT" value={grade.letter}/><SimpleStat label="BK SCORE" value={`${grade.score}`}/><SimpleStat label="BK RATING" value={`${careerRating}`}/></div></div>
      <div className="grid lg:grid-cols-2 gap-4 mt-5"><Panel title="SEASON AWARDS" icon={<Award size={18}/>}>{mvpRace[0]&&<div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 p-3 mb-2 flex items-center gap-3"><PlayerFace name={mvpRace[0].name} team={mvpRace[0].team} position={mvpRace[0].position} size={42}/><div><div className="text-[9px] text-[#D4AF37] font-black">SIMULATED LEAGUE MVP</div><b>{mvpRace[0].name}</b></div></div>}{awards.map(a=><div key={a.award} className="bg-[#181818] p-3 mb-2 flex items-center gap-3"><PlayerFace name={a.winner} size={38}/><div><div className="text-[9px] text-[#D4AF37] font-black">{a.award}</div><b>{a.winner}</b></div></div>)}</Panel><Panel title="ACHIEVEMENTS" icon={<Trophy size={18}/>}>{achievementsForRun(wins,losses,champion,grade.score,roster).map(a=><div key={a} className="py-2 border-b border-white/5">🏆 {a}</div>)}</Panel></div>
      <details className="mt-4 bg-[#111] border border-white/10"><summary className="cursor-pointer p-4 font-black">FULL SEASON DETAILS</summary><div className="p-4 pt-0 space-y-4"><Panel title="FULL GAME LOG" icon={<Activity size={18}/>}><WeekLog weeks={weeks}/>{playoffs.map(x=><div key={x.round} className="flex justify-between py-2 border-b border-white/5"><span>{x.won?'W':'L'} • {x.round} vs {x.opponent}</span><b>{x.you}-{x.them}</b></div>)}</Panel><Panel title="FULL SEASON STATS" icon={<BarChart3 size={18}/>}><SeasonStats rows={seasonStats}/></Panel><Panel title="INJURY HISTORY" icon={<ShieldAlert size={18}/>}>{injuryHistory.length?injuryHistory.map(i=><div key={`${i.playerId}-${i.week}`} className="flex items-center gap-3 py-2 border-b border-white/5"><PlayerFace name={i.playerName} position={i.position} size={34}/><div><b>{i.playerName}</b><div className="text-xs text-zinc-500">Week {i.week} • {i.severity}</div></div></div>):<p className="text-zinc-500 text-sm">No injuries.</p>}</Panel>{storylines.length>0&&<Panel title="YOUR SEASON IN HEADLINES" icon={<Flame size={18}/>}> <div className="grid md:grid-cols-2 gap-2">{storylines.map(s=><StoryMini key={s.id} story={s}/>)}</div></Panel>}</div></details>
      <div className="grid sm:grid-cols-2 gap-3 mt-5"><button onClick={share} className="py-4 border border-[#D4AF37] text-[#D4AF37] font-black"><Share2 className="inline mr-2"/>SHARE SEASON</button><button onClick={reset} className="py-4 bg-[#D4AF37] text-black font-black"><RotateCcw className="inline mr-2"/>PLAY AGAIN</button></div>
    </div>}
  </div></div>;
};

const StepBar=({stage}:{stage:Stage})=>{const active=stage==='draft'?0:stage==='regular'?1:stage==='playoffs'?2:3;const steps=['DRAFT TEAM','PLAY SEASON','PLAYOFFS'];return <div className="grid grid-cols-3 gap-2 mb-5">{steps.map((s,i)=><div key={s} className={`border px-2 py-2 text-center text-[9px] sm:text-[10px] font-black tracking-wider ${i===active?'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]':i<active?'border-green-500/25 text-green-400':'border-white/10 text-zinc-600'}`}>{i+1}. {s}</div>)}</div>};
const SimpleStat=({label,value}:{label:string,value:string})=><div className="bg-[#121212] border border-white/10 p-3"><div className="text-[8px] sm:text-[9px] text-zinc-500 font-black tracking-widest">{label}</div><div className="text-base sm:text-xl font-black mt-1 truncate">{value}</div></div>;
const CapBar=({spent,remaining}:{spent:number;remaining:number})=>{const pct=Math.max(0,Math.min(100,spent/DEFAULT_SALARY_CAP*100));const tight=remaining<15;return <div className={`border p-4 ${tight?'border-red-500/25 bg-red-500/5':'border-[#D4AF37]/25 bg-[#D4AF37]/5'}`}><div className="flex items-end justify-between gap-3"><div><div className="text-[9px] text-[#D4AF37] font-black tracking-[.2em]">2026 SALARY CAP</div><div className="text-xl font-black mt-1">${spent.toFixed(1)}M <span className="text-sm text-zinc-500">used of ${DEFAULT_SALARY_CAP.toFixed(1)}M</span></div></div><div className="text-right"><div className="text-[9px] text-zinc-500 font-black">AVAILABLE</div><div className={`text-xl font-black ${tight?'text-red-300':'text-green-400'}`}>${remaining.toFixed(1)}M</div></div></div><div className="h-2 bg-black/60 mt-3 overflow-hidden"><div className={`h-full ${tight?'bg-red-400':'bg-[#D4AF37]'}`} style={{width:`${pct}%`}}/></div><p className="text-[10px] text-zinc-500 mt-2">Trades update this instantly. Every player on your 29-man roster counts toward the cap.</p></div>};
const Panel=({title,icon,children}:{title:string;icon:React.ReactNode;children:React.ReactNode})=><div className="bg-[#111] border border-white/10 p-4"><h4 className="flex items-center gap-2 text-[#D4AF37] font-black mb-3">{icon}{title}</h4>{children}</div>;
const Select=({label:lbl,value,onChange,options}:{label:string;value:string;onChange:(v:string)=>void;options:string[][]})=><label className="text-xs font-black">{lbl}<select value={value} onChange={e=>onChange(e.target.value)} className="mt-2 block w-full bg-[#181818] border border-white/10 p-3">{options.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>;
const PlayerFace=({name,team='',position='',size=40}:{name:string;team?:string;position?:string;size?:number})=>{const src=`${HEADSHOT_ENDPOINT}?name=${encodeURIComponent(name)}&team=${encodeURIComponent(team)}&position=${encodeURIComponent(position)}`;return <img src={src} alt={name} width={size} height={size} loading="lazy" referrerPolicy="no-referrer" className="shrink-0 rounded-full border border-[#D4AF37]/35 bg-[#181818] object-cover object-top" style={{width:size,height:size}}/>;};
const Roster=({title,players,target,onRemove}:{title:string;players:Player[];target:number;onRemove:(p:Player)=>void})=><div className="bg-[#111] border border-white/10 p-3"><div className="flex justify-between text-[10px] font-black text-[#D4AF37] mb-2"><span>{title}</span><span>{players.length}/{target}</span></div>{players.length===0?<div className="text-xs text-zinc-600 py-3">No players yet.</div>:<div className="space-y-1 max-h-[320px] overflow-y-auto">{players.map(p=><div key={p.id} className="flex justify-between items-center gap-3 bg-[#181818] px-3 py-2"><div className="flex items-center gap-2 min-w-0"><PlayerFace name={p.name} team={p.team} position={p.position} size={38}/><div className="min-w-0"><div className="truncate text-sm"><b>{p.position}</b> {p.name} <small className="text-zinc-600">{p.ovr}</small></div><div className="text-[10px] text-[#D4AF37]">${p.salary.toFixed(2)}M cap hit</div></div></div><button onClick={()=>onRemove(p)} className="p-1 shrink-0"><Trash2 size={15}/></button></div>)}</div>}</div>;
const GameDay=({week,opponent,ratings,injuries,depth,onPlay}:{week:number;opponent:string;ratings:any;injuries:InjuryEvent[];depth:Player[];onPlay:()=>void})=><div className="bg-[#111] border border-[#D4AF37]/30 p-5 text-center"><div className="text-[#D4AF37] text-xs font-black tracking-[.25em]">NEXT GAME • WEEK {week}</div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-4"><div><div className="text-2xl font-black">YOU</div><div className="text-zinc-500 text-sm">{ratings.overall} OVR</div></div><b className="text-zinc-600">VS</b><div><div className="text-lg font-black">{opponent}</div><div className="text-zinc-500 text-sm">CPU</div></div></div><p className="text-xs text-zinc-500 mt-4">{injuries.length?`${injuries.length} starter(s) out. Your backups are already replacing them.`:`Healthy roster. ${depth.length} backups ready.`}</p><button onClick={onPlay} className="mt-4 w-full py-4 bg-[#D4AF37] text-black font-black"><Play className="inline mr-2"/>SIMULATE WEEK {week}</button></div>;
const WeekLog=({weeks}:{weeks:SoloWeek[]})=><div className="space-y-2">{weeks.length===0?<div className="text-sm text-zinc-600">Your game results will appear here.</div>:[...weeks].reverse().map(w=>{const home=w.game.homeMemberId==='solo-user',you=home?w.game.homeScore:w.game.awayScore,them=home?w.game.awayScore:w.game.homeScore;return <details key={w.week} className="bg-[#121212] border border-white/10 p-3"><summary className="cursor-pointer flex justify-between gap-3 text-sm"><span><b className={w.won?'text-green-400':'text-red-400'}>{w.won?'W':'L'}</b> • Week {w.week} vs {w.opponent}</span><b>{you}-{them}</b></summary>{w.injuries?.length>0&&<div className="text-xs text-red-300 mt-2">Injury: {w.injuries.map(i=>i.playerName).join(', ')}</div>}<div className="grid sm:grid-cols-2 gap-2 mt-3">{(w.playerLines||[]).slice(0,10).map(l=><div key={`${w.week}-${l.playerId}`} className="bg-[#181818] p-2 text-xs flex gap-2 items-center"><PlayerFace name={l.name} position={l.position} size={30}/><div><b>{l.name}</b> <span className="text-zinc-500">{l.position}</span><div className="text-zinc-300">{l.passYds!=null&&`${l.passYds} PASS • ${l.passTD} TD`} {l.rushYds!=null&&`${l.rushYds} RUSH`} {l.recYds!=null&&`${l.receptions} REC • ${l.recYds} YDS`} {l.sacks!=null&&`${l.tackles} TKL • ${l.sacks} SACK • ${l.picks} INT`} {l.fgMade!=null&&`${l.fgMade}/${l.fgAtt} FG`}</div></div></div>)}</div></details>})}</div>;
const ChemistryPanel=({chemistry,compact=false}:{chemistry:any;compact?:boolean})=><div className="bg-[#111] border border-[#D4AF37]/20 p-4"><div className="flex items-center justify-between"><div><div className="text-[9px] text-[#D4AF37] font-black tracking-widest">TEAM CHEMISTRY</div><div className="text-2xl font-black">{chemistry.score}<span className="text-xs text-zinc-600">/99</span></div></div><Sparkles className="text-[#D4AF37]" size={24}/></div>{!compact&&<p className="text-xs text-zinc-500 mt-2">Good combinations give small simulation bonuses. You do not need to manage this manually.</p>}<div className="flex flex-wrap gap-1 mt-2">{chemistry.tags.slice(0,4).map((t:string)=><span key={t} className="text-[8px] border border-[#D4AF37]/25 px-2 py-1 text-[#D4AF37]">{t}</span>)}</div></div>;
const StoryCard=({story}:{story:Storyline})=>{const featured=PLAYERS_DATABASE.find(p=>story.headline.toLowerCase().includes(p.name.toLowerCase()))||PLAYERS_DATABASE.find(p=>story.deck.toLowerCase().includes(p.name.toLowerCase()));return <div className={`border p-4 ${story.tone==='red'?'border-red-500/30 bg-red-500/5':story.tone==='green'?'border-green-500/30 bg-green-500/5':story.tone==='blue'?'border-cyan-500/30 bg-cyan-500/5':'border-[#D4AF37]/40 bg-[#D4AF37]/5'}`}><div className="flex items-start gap-3">{featured&&<PlayerFace name={featured.name} team={featured.team} position={featured.position} size={48}/>}<div><div className="text-[9px] font-black tracking-[.2em] text-[#D4AF37]">{story.tag} • WEEK {story.week}</div><h3 className="text-xl sm:text-2xl font-black mt-1">{story.headline}</h3><p className="text-sm text-zinc-400 mt-1">{story.deck}</p></div></div></div>;};
const StoryMini=({story}:{story:Storyline})=><div className="bg-[#181818] border border-white/5 p-3"><div className="text-[8px] text-[#D4AF37] font-black">{story.tag} • W{story.week}</div><b className="text-sm">{story.headline}</b></div>;
const TradeCard=({offer,capSpace,onAccept,onDecline}:{offer:SoloTradeOffer;capSpace:number;onAccept:()=>void;onDecline:()=>void})=>{const after=capSpace-offer.capDelta;return <div className="border border-cyan-400/30 bg-cyan-400/5 p-4"><div className="flex items-center gap-2 text-cyan-300 text-xs font-black"><ArrowRightLeft size={16}/>TRADE OFFER</div><p className="text-sm text-zinc-400 mt-2">{offer.reason}</p><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-3"><div className="bg-[#111] p-3"><div className="text-[9px] text-zinc-600">YOU SEND</div><div className="flex items-center gap-2 mt-2"><PlayerFace name={offer.outgoing.name} team={offer.outgoing.team} position={offer.outgoing.position} size={42}/><div><b className="block">{offer.outgoing.name}</b><div className="text-xs text-zinc-500">{offer.outgoing.position} • {offer.outgoing.ovr}</div><div className="text-[10px] text-[#D4AF37]">${offer.outgoing.salary.toFixed(2)}M</div></div></div></div><ArrowRightLeft/><div className="bg-[#111] p-3"><div className="text-[9px] text-cyan-300">YOU GET</div><div className="flex items-center gap-2 mt-2"><PlayerFace name={offer.incoming.name} team={offer.incoming.team} position={offer.incoming.position} size={42}/><div><b className="block">{offer.incoming.name}</b><div className="text-xs text-zinc-500">{offer.incoming.position} • {offer.incoming.ovr}</div><div className="text-[10px] text-cyan-300">${offer.incoming.salary.toFixed(2)}M</div></div></div></div></div><div className="mt-3 bg-black/20 border border-white/5 p-3 flex justify-between text-xs"><span className="text-zinc-500">Cap space after trade</span><b className={after<10?'text-red-300':'text-green-400'}>${after.toFixed(2)}M</b></div><div className="grid grid-cols-2 gap-2 mt-3"><button onClick={onDecline} className="py-3 border border-white/10 font-black">DECLINE</button><button onClick={onAccept} className="py-3 bg-cyan-300 text-black font-black">ACCEPT</button></div></div>;};
const LeaderList=({rows}:{rows:any[]})=><div>{rows.map(x=><div key={x.category} className="grid grid-cols-[70px_1fr_auto] gap-2 py-2 border-b border-white/5 text-sm items-center"><span className="text-[9px] font-black text-zinc-500">{x.category}</span><span className={`flex items-center gap-2 ${x.isUser?'text-[#D4AF37] font-black':''}`}><PlayerFace name={x.name} team={x.team} size={30}/><span>{x.name} <small className="text-zinc-600">{x.team}</small></span></span><b>{x.value}</b></div>)}</div>;
const MvpList=({rows}:{rows:any[]})=><div>{rows.map((x,i)=><div key={`${x.name}-${i}`} className={`flex justify-between gap-2 py-2 border-b border-white/5 text-sm items-center ${x.isUser?'text-[#D4AF37]':''}`}><span className="flex items-center gap-2"><PlayerFace name={x.name} team={x.team} position={x.position} size={32}/><span>#{i+1} {x.name} <small className="text-zinc-600">{x.position}</small></span></span><b>{Number(x.score).toFixed(1)}</b></div>)}</div>;
const SeasonStats=({rows}:{rows:any[]})=><div className="overflow-x-auto"><table className="w-full text-xs min-w-[760px]"><thead className="text-zinc-600"><tr><th className="text-left py-2">PLAYER</th><th>POS</th><th>PASS</th><th>PTD</th><th>RUSH</th><th>RTD</th><th>REC</th><th>RECYD</th><th>SACK</th><th>INT</th></tr></thead><tbody>{rows.map(x=><tr key={x.playerId} className="border-t border-white/5"><td className="py-2 font-black"><span className="flex items-center gap-2"><PlayerFace name={x.name} position={x.position} size={32}/>{x.name}</span></td><td className="text-center">{x.position}</td><td className="text-center">{x.passYds||0}</td><td className="text-center">{x.passTD||0}</td><td className="text-center">{x.rushYds||0}</td><td className="text-center">{x.rushTD||0}</td><td className="text-center">{x.receptions||0}</td><td className="text-center">{x.recYds||0}</td><td className="text-center">{x.sacks||0}</td><td className="text-center">{x.picks||0}</td></tr>)}</tbody></table></div>;
