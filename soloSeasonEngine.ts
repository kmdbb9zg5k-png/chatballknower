import { Player, LeagueMember, SimulationGame, TeamRatings, DEFAULT_SALARY_CAP } from './types';
import { calculateTeamRatings } from './evaluation';
import { simulateGame } from './simulation';
import { chooseSmartPick, GmPersonality, gradeDraft } from './smartDraft';
import { PLAYERS_DATABASE } from './players';

export type SoloDifficulty='rookie'|'pro'|'all_pro'|'all_madden';
export type InjurySetting='off'|'normal'|'chaos';

export interface PlayerLine {
  playerId:string; name:string; position:string;
  passYds?:number; passTD?:number; interceptions?:number;
  rushYds?:number; rushTD?:number; receptions?:number; recYds?:number; recTD?:number;
  tackles?:number; sacks?:number; picks?:number;
  fgMade?:number; fgAtt?:number; puntsInside20?:number;
  fantasyScore:number;
}
export interface InjuryEvent { playerId:string; playerName:string; position:string; weeks:number; week:number; severity:string; duration?:number; }
export interface SoloWeek {
  week:number; opponent:string; game:SimulationGame; won:boolean; playerLines:PlayerLine[];
  injuries:InjuryEvent[]; playoffSeed:number; playoffOdds:number; record:string;
}
export interface CareerProfile {
  runs:number; championships:number; playoffWins:number; regularWins:number; regularLosses:number;
  bestRecord:string; bestScore:number; perfectSeasons:number; achievements:string[];
}
export interface SoloSettings { difficulty:SoloDifficulty; injuries:InjurySetting; }

const NAMES=[
 'Baltimore Blackbirds','Buffalo Blizzard','Miami Waves','Boston Minutemen','Cleveland Hounds','Cincinnati Kings',
 'Pittsburgh Iron','Houston Outlaws','Indianapolis Racers','Jacksonville Storm','Tennessee Copperheads','Denver Peaks',
 'Kansas City Monarchs','Las Vegas Aces','Los Angeles Bolts','New York Knights','Dallas Wranglers','Philadelphia Liberty',
 'Washington Generals','Chicago Grizzlies','Detroit Motors','Green Bay Northmen','Minnesota Valkyries','Atlanta Flight',
 'Carolina Reapers','New Orleans Krewe','Tampa Bay Corsairs','Arizona Scorpions','Los Angeles Gold','San Francisco Rush','Seattle Orcas'
];
const PERSONALITIES:GmPersonality[]=['balanced','star_hunter','value_hunter','trenches','defense_first','air_raid'];

function seeded(seed:number){ let x=seed|0; return ()=>{x=Math.imul(x^x>>>15,1|x);x^=x+Math.imul(x^x>>>7,61|x);return ((x^x>>>14)>>>0)/4294967296};}
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}

export function buildSoloAiRoster(seed:number):Player[]{
 const roster:Player[]=[];
 for(let i=0;i<60&&roster.length<20;i++){
  const p=chooseSmartPick(PLAYERS_DATABASE,roster,DEFAULT_SALARY_CAP,PERSONALITIES[(seed+i)%PERSONALITIES.length]);
  if(!p) break; roster.push(p);
 }
 return roster;
}
export function makeSoloOpponent(week:number,difficulty:SoloDifficulty):LeagueMember{
 let roster=buildSoloAiRoster(week*11+13);
 const bias={rookie:-4,pro:0,all_pro:2,all_madden:4}[difficulty];
 let ratings=calculateTeamRatings(roster);
 ratings={...ratings,
  overall:Math.max(65,Math.min(99,ratings.overall+bias)),
  offense:Math.max(65,Math.min(99,ratings.offense+bias)),
  defense:Math.max(65,Math.min(99,ratings.defense+bias)),
  passing:Math.max(65,Math.min(99,ratings.passing+bias)),
  rushing:Math.max(65,Math.min(99,ratings.rushing+bias)),
  passRush:Math.max(65,Math.min(99,ratings.passRush+bias)),
  runDefense:Math.max(65,Math.min(99,ratings.runDefense+bias)),
  coverage:Math.max(65,Math.min(99,ratings.coverage+bias)),
 } as TeamRatings;
 return {id:`solo-ai-${week}`,userId:`solo-ai-${week}`,userName:NAMES[(week-1)%NAMES.length],isCommissioner:false,isAi:true,status:'ready',roster,teamRatings:ratings};
}
export function ratingsWithInjuries(roster:Player[], active:InjuryEvent[], bench:Player[]=[]):TeamRatings{
 const base=calculateTeamRatings(roster); if(!active.length)return base;
 let off=0,def=0;
 for(const i of active){
  const p=roster.find(x=>x.id===i.playerId); if(!p)continue;
  const family=(pos:string)=>['OT','LT','RT','OG','LG','RG','C'].includes(pos)?'OL':['EDGE','DT','DE','NT'].includes(pos)?'DL':['S','FS','SS'].includes(pos)?'S':pos;
  const replacement=bench.filter(b=>family(b.position)===family(p.position)).sort((a,b)=>b.ovr-a.ovr)[0];
  const baseHit=Math.max(1,(p.ovr-70)*.08);
  const hit=replacement ? Math.max(.25, baseHit * Math.max(.2, (p.ovr-replacement.ovr+8)/18)) : baseHit;
  if(['QB','RB','WR','TE','OT','LT','RT','OG','LG','RG','C'].includes(p.position)) off+=hit; else def+=hit;
 }
 return {...base,overall:Math.round(base.overall-(off+def)*.3),offense:Math.round(base.offense-off),defense:Math.round(base.defense-def)};
}
export function simulateInjuries(roster:Player[],week:number,setting:InjurySetting,current:InjuryEvent[]):InjuryEvent[]{
 if(setting==='off')return[];
 const r=seeded(hash(`injury:${week}:${roster.map(p=>p.id).join('|')}`));
 const rate=setting==='chaos'?.18:.075;
 if(r()>rate)return[];
 const candidates=roster.filter(p=>!current.some(i=>i.playerId===p.id&&i.weeks>0));
 if(!candidates.length)return[];
 const p=candidates[Math.floor(r()*candidates.length)];
 const roll=r(); const weeks=roll<.58?1:roll<.86?2:roll<.97?3:5;
 return [{playerId:p.id,playerName:p.name,position:p.position,weeks,week,duration:weeks,severity:weeks===1?'Minor':weeks<=3?'Moderate':'Major'}];
}
export function generatePlayerLines(roster:Player[],game:SimulationGame,userHome:boolean,week:number):PlayerLine[]{
 const pts=userHome?game.homeScore:game.awayScore; const r=seeded(hash(`stats:${week}:${game.id}`));
 const qb=roster.find(p=>p.position==='QB'), rb=roster.find(p=>['RB','FB'].includes(p.position));
 const wr=roster.filter(p=>p.position==='WR'), te=roster.find(p=>p.position==='TE');
 const def=roster.filter(p=>['EDGE','DT','DE','NT','LB','CB','S','FS','SS'].includes(p.position));
 const k=roster.find(p=>p.position==='K'), punter=roster.find(p=>p.position==='P');
 const lines:PlayerLine[]=[]; const totalTD=Math.max(1,Math.floor(pts/7)); const passTD=Math.max(0,Math.min(totalTD,Math.round(totalTD*(.55+r()*.25))));
 if(qb){const y=Math.round(190+(qb.ovr-75)*5+r()*85);lines.push({playerId:qb.id,name:qb.name,position:'QB',passYds:y,passTD,interceptions:r()<.55?0:r()<.85?1:2,rushYds:Math.round(r()*35),fantasyScore:Math.round((y/25+passTD*4)*10)/10})}
 if(rb){const y=Math.round(45+(rb.ovr-70)*2.2+r()*55);const td=Math.max(0,totalTD-passTD>0?Math.round(r()*(totalTD-passTD+1)):0);lines.push({playerId:rb.id,name:rb.name,position:'RB',rushYds:y,rushTD:td,receptions:Math.round(2+r()*4),recYds:Math.round(10+r()*45),fantasyScore:Math.round((y/10+td*6)*10)/10})}
 const targets=[...wr,...(te?[te]:[])];
 targets.forEach((p,i)=>{const y=Math.round(25+(p.ovr-70)*1.8+r()*70);const td=i<passTD?1:0;lines.push({playerId:p.id,name:p.name,position:p.position,receptions:Math.max(1,Math.round(2+r()*6)),recYds:y,recTD:td,fantasyScore:Math.round((y/10+td*6)*10)/10})});
 def.sort((a,b)=>b.ovr-a.ovr).slice(0,4).forEach((p)=>{const sacks=['EDGE','DT','DE','NT','LB'].includes(p.position)?Math.round(r()*2):0;const picks=['CB','S','FS','SS','LB'].includes(p.position)&&r()>.65?1:0;lines.push({playerId:p.id,name:p.name,position:p.position,tackles:Math.round(3+r()*7),sacks,picks,fantasyScore:sacks*4+picks*6})});
 if(k){const att=Math.max(1,Math.round(pts/10));const made=Math.max(0,att-(r()<.78?0:1));lines.push({playerId:k.id,name:k.name,position:'K',fgMade:made,fgAtt:att,fantasyScore:made*3})}
 if(punter) lines.push({playerId:punter.id,name:punter.name,position:'P',puntsInside20:Math.round(1+r()*3),fantasyScore:Math.round(r()*3)});
 return lines;
}
export function playoffSnapshot(wins:number,losses:number,week:number){
 const pct=wins/Math.max(1,wins+losses);
 const seed=Math.max(1,Math.min(12,Math.round(9-(pct-.5)*10+(17-week)*.05)));
 const odds=Math.max(1,Math.min(99,Math.round(8+pct*88+(week>10?(pct-.5)*20:0))));
 return {seed,odds};
}
export function buildAwards(lines:PlayerLine[]){
 const by=new Map<string,{name:string,pos:string,score:number,line:PlayerLine}>();
 for(const l of lines){const prev=by.get(l.playerId);by.set(l.playerId,{name:l.name,pos:l.position,score:(prev?.score||0)+l.fantasyScore,line:l})}
 const arr=[...by.values()].sort((a,b)=>b.score-a.score);
 const offense=arr.filter(x=>['QB','RB','WR','TE'].includes(x.pos));
 const defense=arr.filter(x=>['EDGE','DT','DE','NT','LB','CB','S','FS','SS'].includes(x.pos));
 const air=arr.filter(x=>['QB','WR','TE'].includes(x.pos));
 const ground=arr.filter(x=>x.pos==='RB');
 const special=arr.filter(x=>['K','P'].includes(x.pos));
 return [
  {award:'TEAM MVP',winner:arr[0]?.name||'—',score:arr[0]?.score||0},
  {award:'OFFENSIVE PLAYER OF THE YEAR',winner:offense[0]?.name||'—',score:offense[0]?.score||0},
  {award:'DEFENSIVE PLAYER OF THE YEAR',winner:defense[0]?.name||'—',score:defense[0]?.score||0},
  {award:'AIR ATTACK AWARD',winner:air[0]?.name||offense[0]?.name||'—',score:air[0]?.score||offense[0]?.score||0},
  {award:'GROUND GAME AWARD',winner:ground[0]?.name||offense[0]?.name||'—',score:ground[0]?.score||offense[0]?.score||0},
  {award:'SPECIAL TEAMS ACE',winner:special[0]?.name||'—',score:special[0]?.score||0},
 ];
}
export function achievementsForRun(wins:number,losses:number,champ:boolean,grade:number,roster:Player[]){
 const a:string[]=[];
 if(wins>=12)a.push('DOUBLE-DIGIT DOMINANCE'); if(wins>=15)a.push('15-WIN MONSTER'); if(losses===0)a.push('PERFECT REGULAR SEASON');
 if(champ)a.push('SUPER BOWL CHAMPION'); if(champ&&losses===0)a.push('IMMORTAL SEASON'); if(grade>=95)a.push('CAP WIZARD');
 if(roster.filter(p=>p.ovr>=90).length>=5)a.push('STAR COLLECTOR'); if(roster.reduce((n,p)=>n+p.salary,0)<=DEFAULT_SALARY_CAP-10)a.push('MONEYBALL');
 return a;
}
export function defaultCareer():CareerProfile{return{runs:0,championships:0,playoffWins:0,regularWins:0,regularLosses:0,bestRecord:'0-0',bestScore:0,perfectSeasons:0,achievements:[]}}
export function updateCareer(c:CareerProfile,w:number,l:number,champ:boolean,playoffWins:number,score:number,ach:string[]):CareerProfile{
 const parse=(r:string)=>Number(r.split('-')[0]||0); const best=parse(c.bestRecord)>w?c.bestRecord:`${w}-${l}`;
 return {...c,runs:c.runs+1,championships:c.championships+(champ?1:0),playoffWins:c.playoffWins+playoffWins,regularWins:c.regularWins+w,regularLosses:c.regularLosses+l,bestRecord:best,bestScore:Math.max(c.bestScore,score),perfectSeasons:c.perfectSeasons+(l===0?1:0),achievements:[...new Set([...c.achievements,...ach])]};
}

// --- Ball Knower Solo immersion layer (kept in this existing module so Ball Knower Live can load it) ---
export type SoloGroup='QB'|'RB'|'WR'|'TE'|'OL'|'DL_EDGE'|'LB'|'CB'|'S'|'K'|'P';
export interface ChemistryResult{score:number;offenseBonus:number;defenseBonus:number;tags:string[];note:string;}
export interface SeasonStatRow{playerId:string;name:string;position:string;games:number;fantasy:number;passYds:number;passTD:number;interceptions:number;rushYds:number;rushTD:number;receptions:number;recYds:number;recTD:number;tackles:number;sacks:number;picks:number;fgMade:number;fgAtt:number;}
export interface Storyline{id:string;week:number;tag:string;headline:string;deck:string;tone:'gold'|'green'|'red'|'blue';}
export interface SoloTradeOffer{id:string;week:number;incoming:Player;outgoing:Player;capDelta:number;reason:string;expiresAfterWeek:number;}
export interface SimLeagueLeader{category:string;value:string;name:string;team:string;isUser:boolean;}
export interface MvpCandidate{name:string;team:string;position:string;score:number;isUser:boolean;}

export function soloGroupOf(p:Player):SoloGroup{if(p.position==='QB')return'QB';if(p.position==='RB'||p.position==='FB')return'RB';if(p.position==='WR')return'WR';if(p.position==='TE')return'TE';if(['OT','LT','RT','OG','LG','RG','C'].includes(p.position))return'OL';if(['EDGE','DT','DE','NT'].includes(p.position))return'DL_EDGE';if(p.position==='LB')return'LB';if(p.position==='CB')return'CB';if(['S','FS','SS'].includes(p.position))return'S';if(p.position==='K')return'K';return'P';}
const avgRating=(ps:Player[])=>ps.length?ps.reduce((n,p)=>n+p.ovr,0)/ps.length:70;
const clamp99=(n:number,a=0,b=99)=>Math.max(a,Math.min(b,n));

export function calculateChemistry(starters:Player[],bench:Player[]=[]):ChemistryResult{
 const qb=starters.filter(p=>soloGroupOf(p)==='QB'),rb=starters.filter(p=>soloGroupOf(p)==='RB'),targets=starters.filter(p=>['WR','TE'].includes(soloGroupOf(p))),ol=starters.filter(p=>soloGroupOf(p)==='OL'),front=starters.filter(p=>['DL_EDGE','LB'].includes(soloGroupOf(p))),back=starters.filter(p=>['CB','S'].includes(soloGroupOf(p))),all=[...starters,...bench];
 let off=0,def=0;const tags:string[]=[];const qbO=avgRating(qb),rbO=avgRating(rb),targetO=avgRating([...targets].sort((a,b)=>b.ovr-a.ovr).slice(0,3)),olO=avgRating(ol),frontO=avgRating(front),backO=avgRating(back);
 if(qbO>=88&&targetO>=87){off+=2;tags.push('QB + WEAPONS')}if(qbO>=92&&targetO>=91){off+=1;tags.push('ELITE AIR ATTACK')}if(rbO>=87&&olO>=84){off+=2;tags.push('RUN GAME FIT')}if(olO>=88){off+=1;tags.push('TRENCH WALL')}if(frontO>=87){def+=2;tags.push('FRONT-SEVEN HEAT')}if(backO>=87){def+=2;tags.push('NO-FLY ZONE')}if(frontO>=86&&backO>=86){def+=1;tags.push('COMPLETE DEFENSE')}
 const depth=avgRating(bench);if(bench.length>=8&&depth>=80){off+=1;def+=1;tags.push('REAL DEPTH')}const spread=all.length?Math.max(...all.map(p=>p.ovr))-Math.min(...all.map(p=>p.ovr)):0;if(all.length>=20&&spread<=22){off+=1;def+=1;tags.push('BALANCED BUILD')}
 const score=Math.round(clamp99(48+(off+def)*6+(depth-75)*.35,35,99));return{score,offenseBonus:off,defenseBonus:def,tags:tags.slice(0,5),note:score>=88?'Roster pieces amplify each other.':score>=75?'Solid fit with a few real synergies.':'Talent is there, but the pieces do not fully complement each other yet.'};
}
export function applyChemistry(r:TeamRatings,c:ChemistryResult):TeamRatings{const o=c.offenseBonus,d=c.defenseBonus;return{...r,overall:Math.round(clamp99(r.overall+(o+d)*.32)),offense:Math.round(clamp99(r.offense+o)),defense:Math.round(clamp99(r.defense+d)),passing:Math.round(clamp99(r.passing+Math.ceil(o*.65))),rushing:Math.round(clamp99(r.rushing+Math.ceil(o*.55))),passProtection:Math.round(clamp99(r.passProtection+Math.floor(o*.45))),runBlocking:Math.round(clamp99(r.runBlocking+Math.floor(o*.45))),passRush:Math.round(clamp99(r.passRush+Math.ceil(d*.55))),runDefense:Math.round(clamp99(r.runDefense+Math.floor(d*.45))),coverage:Math.round(clamp99(r.coverage+Math.ceil(d*.6))),strengths:[...new Set([...(r.strengths||[]),...c.tags])]};}
export function aggregateSeasonStats(lines:PlayerLine[]):SeasonStatRow[]{const m=new Map<string,SeasonStatRow>();for(const l of lines){const x=m.get(l.playerId)||{playerId:l.playerId,name:l.name,position:l.position,games:0,fantasy:0,passYds:0,passTD:0,interceptions:0,rushYds:0,rushTD:0,receptions:0,recYds:0,recTD:0,tackles:0,sacks:0,picks:0,fgMade:0,fgAtt:0};x.games+=1;x.fantasy+=Number(l.fantasyScore||0);x.passYds+=Number(l.passYds||0);x.passTD+=Number(l.passTD||0);x.interceptions+=Number(l.interceptions||0);x.rushYds+=Number(l.rushYds||0);x.rushTD+=Number(l.rushTD||0);x.receptions+=Number(l.receptions||0);x.recYds+=Number(l.recYds||0);x.recTD+=Number(l.recTD||0);x.tackles+=Number(l.tackles||0);x.sacks+=Number(l.sacks||0);x.picks+=Number(l.picks||0);x.fgMade+=Number(l.fgMade||0);x.fgAtt+=Number(l.fgAtt||0);m.set(l.playerId,x)}return[...m.values()].sort((a,b)=>b.fantasy-a.fantasy)}
export function buildStoryline(week:number,game:SimulationGame,userHome:boolean,lines:PlayerLine[],injuries:{playerName:string;severity:string}[],record:string,chemistry:number):Storyline{const you=userHome?game.homeScore:game.awayScore,them=userHome?game.awayScore:game.homeScore,won=you>them,star=[...lines].sort((a,b)=>Number(b.fantasyScore||0)-Number(a.fantasyScore||0))[0];if(injuries.length)return{id:`w${week}-injury`,week,tag:'BREAKING',headline:`${injuries[0].playerName} goes down in Week ${week}`,deck:`${injuries[0].severity} injury forces the depth chart into action. ${won?`Ball Knower still escaped ${you}-${them}.`:`The loss, ${you}-${them}, makes the backup plan matter immediately.`}`,tone:'red'};if(Math.abs(you-them)<=3)return{id:`w${week}-nailbiter`,week,tag:'FINAL',headline:`Heart-stopper: ${won?'Ball Knower survives':'Ball Knower falls'} ${you}-${them}`,deck:`A one-possession game went to the final moments. ${star?`${star.name} led the way.`:''}`,tone:won?'green':'red'};if(won&&you-them>=17)return{id:`w${week}-statement`,week,tag:'STATEMENT',headline:`Ball Knower sends a message with a ${you}-${them} rout`,deck:`The ${record} squad controlled both sides of the ball. Chemistry sits at ${chemistry}/99.${star?` ${star.name} was the headline performer.`:''}`,tone:'gold'};if(star&&Number(star.fantasyScore||0)>=25)return{id:`w${week}-star`,week,tag:'STAR WATCH',headline:`${star.name} takes over in Week ${week}`,deck:`A monster performance powered a ${you}-${them} ${won?'win':'result'} and puts ${star.name} directly into the award conversation.`,tone:'blue'};return{id:`w${week}-recap`,week,tag:won?'WIN COLUMN':'FILM ROOM',headline:`Week ${week}: ${won?'another step toward January':'time to answer back'}`,deck:`Final: ${you}-${them}. Ball Knower moves to ${record}. ${chemistry>=85?'The roster fit continues to show up on Sundays.':'There are still roster combinations to squeeze more from.'}`,tone:won?'green':'red'};}
export function buildTradeOffer(starters:Player[],bench:Player[],week:number,capLeft:number):SoloTradeOffer|null{if(![3,6,9,12,15].includes(week))return null;const current=[...starters,...bench];if(current.length<20)return null;const chosen=new Set(current.map(p=>p.id)),r=seeded(hash(`trade:${week}:${current.map(p=>p.id).sort().join('|')}`)),movable=current.filter(p=>!['K','P'].includes(soloGroupOf(p))).sort((a,b)=>a.ovr-b.ovr||b.salary-a.salary).slice(0,12);if(!movable.length)return null;const outgoing=movable[Math.floor(r()*Math.min(5,movable.length))],g=soloGroupOf(outgoing),candidates=PLAYERS_DATABASE.filter(p=>!chosen.has(p.id)&&soloGroupOf(p)===g&&p.ovr>=outgoing.ovr+2&&p.salary-outgoing.salary<=capLeft+.001).sort((a,b)=>((b.ovr-outgoing.ovr)*5-(b.salary-outgoing.salary))-((a.ovr-outgoing.ovr)*5-(a.salary-outgoing.salary))).slice(0,15);if(!candidates.length)return null;const incoming=candidates[Math.floor(r()*Math.min(5,candidates.length))],delta=Math.round((incoming.salary-outgoing.salary)*100)/100,reason=g==='OL'?'A contender wants your lineman and is offering a talent upgrade.':g==='DL_EDGE'||g==='LB'?'A defense-needy club called with a front-seven swap.':`A rival GM is offering an upgrade at ${g}.`;return{id:`trade-${week}-${incoming.id}`,week,incoming,outgoing,capDelta:delta,reason,expiresAfterWeek:week};}
function cpuStat(p:Player,week:number,kind:'pass'|'rush'|'rec'|'sack'|'pick'){const r=seeded(hash(`${kind}:${week}:${p.id}`)),q=(p.ovr-70)/30;if(kind==='pass')return Math.round(week*(205+q*95+r()*18));if(kind==='rush')return Math.round(week*(42+q*54+r()*10));if(kind==='rec')return Math.round(week*(45+q*58+r()*10));if(kind==='sack')return Math.round(week*(.25+q*.7+r()*.18)*10)/10;return Math.round(week*(.05+q*.16+r()*.05)*10)/10;}
export function buildLeagueLeaders(userStats:SeasonStatRow[],week:number,userName='YOU'):SimLeagueLeader[]{if(week<1)return[];const qb=PLAYERS_DATABASE.filter(p=>p.position==='QB').sort((a,b)=>b.ovr-a.ovr).slice(0,8),rb=PLAYERS_DATABASE.filter(p=>p.position==='RB').sort((a,b)=>b.ovr-a.ovr).slice(0,10),wr=PLAYERS_DATABASE.filter(p=>['WR','TE'].includes(p.position)).sort((a,b)=>b.ovr-a.ovr).slice(0,12),rushers=PLAYERS_DATABASE.filter(p=>['EDGE','DE','DT','LB'].includes(p.position)).sort((a,b)=>b.ovr-a.ovr).slice(0,12),db=PLAYERS_DATABASE.filter(p=>['CB','S','FS','SS'].includes(p.position)).sort((a,b)=>b.ovr-a.ovr).slice(0,12),userBest=(key:keyof SeasonStatRow)=>[...userStats].sort((a,b)=>Number(b[key])-Number(a[key]))[0],cats:[string,keyof SeasonStatRow,Player[],('pass'|'rush'|'rec'|'sack'|'pick')][]=[['PASS YDS','passYds',qb,'pass'],['RUSH YDS','rushYds',rb,'rush'],['REC YDS','recYds',wr,'rec'],['SACKS','sacks',rushers,'sack'],['INTS','picks',db,'pick']];return cats.map(([category,key,pool,kind])=>{const cpu=pool.map(p=>({p,v:cpuStat(p,week,kind)})).sort((a,b)=>b.v-a.v)[0],u=userBest(key),uv=Number(u?.[key]||0);if(u&&uv>=cpu.v)return{category,value:kind==='sack'||kind==='pick'?uv.toFixed(1):String(Math.round(uv)),name:u.name,team:userName,isUser:true};return{category,value:kind==='sack'||kind==='pick'?cpu.v.toFixed(1):String(Math.round(cpu.v)),name:cpu.p.name,team:cpu.p.team,isUser:false};});}
export function buildMvpRace(userStats:SeasonStatRow[],week:number):MvpCandidate[]{if(week<1)return[];const user=userStats.slice(0,5).map(x=>({name:x.name,team:'BK',position:x.position,score:Math.round(x.fantasy*10)/10,isUser:true})),cpu=PLAYERS_DATABASE.filter(p=>['QB','RB','WR','TE','EDGE','LB','CB'].includes(p.position)).sort((a,b)=>b.ovr-a.ovr).slice(0,18).map(p=>{const r=seeded(hash(`mvp:${week}:${p.id}`));return{name:p.name,team:p.team,position:p.position,score:Math.round((week*(8+(p.ovr-75)*.55+r()*3))*10)/10,isUser:false}});return[...user,...cpu].sort((a,b)=>b.score-a.score).slice(0,5);}
export function buildShareCardSvg(data:{name:string;record:string;champion:boolean;ovr:number;chemistry:number;bkScore:number;capLeft:number;topPlayer?:string}){const title=data.champion?'SUPER BOWL CHAMPION':'BALL KNOWER SEASON',accent='#D4AF37',esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]||c));return`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><rect width="1200" height="1200" fill="#090909"/><rect x="52" y="52" width="1096" height="1096" rx="36" fill="#111" stroke="${accent}" stroke-width="4"/><text x="100" y="145" fill="${accent}" font-size="30" font-family="Arial" font-weight="800" letter-spacing="8">BALL KNOWER</text><text x="100" y="245" fill="white" font-size="64" font-family="Arial" font-weight="900">${title}</text><text x="100" y="310" fill="#aaa" font-size="30" font-family="Arial">${esc(data.name)}</text><text x="100" y="500" fill="white" font-size="150" font-family="Arial" font-weight="900">${esc(data.record)}</text><text x="100" y="565" fill="${accent}" font-size="28" font-family="Arial" font-weight="800">FINAL RECORD</text><g font-family="Arial" font-weight="800" font-size="38" fill="white"><text x="100" y="720">${data.ovr} OVR</text><text x="420" y="720">${data.chemistry} CHEM</text><text x="760" y="720">BK ${data.bkScore}</text><text x="100" y="805">$${data.capLeft.toFixed(1)}M CAP LEFT</text></g>${data.topPlayer?`<text x="100" y="930" fill="#aaa" font-size="30" font-family="Arial">Season MVP: ${esc(data.topPlayer)}</text>`:''}<text x="100" y="1070" fill="${accent}" font-size="34" font-family="Arial" font-weight="900">PROVE YOU KNOW BALL.</text></svg>`;}
export function calculateBkRating(c:{championships:number;regularWins:number;regularLosses:number;playoffWins:number;bestScore:number;perfectSeasons:number}){return Math.max(100,Math.round(500+c.regularWins*5-c.regularLosses*2+c.playoffWins*18+c.championships*140+c.perfectSeasons*220+c.bestScore*1.5));}
