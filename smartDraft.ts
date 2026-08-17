import { Player, ROSTER_REQUIREMENTS } from '../types';
import { countRosterGroups, getDraftPositionGroup } from './rosterRules';

export type GmPersonality = 'balanced'|'star_hunter'|'value_hunter'|'trenches'|'defense_first'|'air_raid';

const POSITION_VALUE: Record<string,number> = {
 QB:1.35, WR:1.12, TE:1.02, RB:.91, OL:1.13, DL_EDGE:1.18, LB:.98, CB:1.17, S:1.02, K:.70, P:.62
};

function personalityBonus(p:Player,g:string,capEfficiency:number,personality:GmPersonality){
 let bonus=0;
 if(personality==='star_hunter') bonus+=Math.max(0,p.ovr-88)*3-p.salary*.08;
 if(personality==='value_hunter') bonus+=Math.min(capEfficiency,35);
 if(personality==='trenches' && ['OL','DL_EDGE'].includes(g)) bonus+=18;
 if(personality==='defense_first' && ['DL_EDGE','LB','CB','S'].includes(g)) bonus+=14;
 if(personality==='air_raid' && ['QB','WR','TE'].includes(g)) bonus+=15;
 return bonus;
}

export function playerDraftValue(p:Player, roster:Player[], pool:Player[], capRemaining:number, personality:GmPersonality='balanced') {
 const g=getDraftPositionGroup(p); const counts=countRosterGroups(roster);
 const need=Math.max(0,(ROSTER_REQUIREMENTS as any)[g]-(counts as any)[g]);
 const same=pool.filter(x=>getDraftPositionGroup(x)===g).sort((a,b)=>b.ovr-a.ovr);
 const rank=Math.max(0,same.findIndex(x=>x.id===p.id));
 const scarcity=Math.max(0,8-rank)*1.1;
 const capEfficiency=(p.ovr/Math.max(p.salary,0.75))*2.2;
 let score=p.ovr*(POSITION_VALUE[g]||1)+need*9+scarcity+Math.min(capEfficiency,30);
 if(p.salary>capRemaining*.35) score-=12;
 if(p.salaryType!=='cap_hit') score-=3;
 score+=personalityBonus(p,g,capEfficiency,personality);
 return score;
}

// Fast smart-pick engine. The old version ran minimumCompletionCost for nearly
// every player and then repeatedly re-sorted the full NFL pool inside the sort
// comparator. That could lock up mobile Safari when Solo created a CPU opponent.
export function chooseSmartPick(pool:Player[], roster:Player[], salaryCap:number, personality:GmPersonality='balanced') {
 const spent=roster.reduce((n,p)=>n+Number(p.salary||0),0);
 const remaining=salaryCap-spent;
 const drafted=new Set(roster.map(p=>p.id));
 const counts=countRosterGroups(roster) as any;
 const requirements=ROSTER_REQUIREMENTS as any;
 const groups=Object.keys(ROSTER_REQUIREMENTS);

 const byGroup:Record<string,Player[]>={};
 const needByGroup:Record<string,number>={};
 for(const g of groups){
  byGroup[g]=[];
  needByGroup[g]=Math.max(0,Number(requirements[g]||0)-Number(counts[g]||0));
 }

 for(const p of pool){
  if(drafted.has(p.id)) continue;
  const salary=Number(p.salary);
  if(!Number.isFinite(salary)||salary<0||salary>remaining) continue;
  const g=getDraftPositionGroup(p);
  if(!groups.includes(g)||needByGroup[g]<=0) continue;
  byGroup[g].push(p);
 }

 // Pre-sort once by salary for legal-cap completion checks and once by OVR for
 // scarcity ranking. This replaces thousands of repeated sorts per CPU pick.
 const cheapCost:Record<string,number>={};
 const rankById=new Map<string,number>();
 let minimumRequired=0;
 for(const g of groups){
  const need=needByGroup[g];
  if(!need){cheapCost[g]=0;continue;}
  const salarySorted=byGroup[g].sort((a,b)=>a.salary-b.salary||b.ovr-a.ovr);
  if(salarySorted.length<need) return null;
  const cost=salarySorted.slice(0,need).reduce((n,p)=>n+p.salary,0);
  cheapCost[g]=cost; minimumRequired+=cost;
  const byOvr=[...salarySorted].sort((a,b)=>b.ovr-a.ovr||a.salary-b.salary);
  byOvr.forEach((p,i)=>rankById.set(p.id,i));
 }
 if(minimumRequired>remaining+.0001) return null;

 let best:Player|null=null;
 let bestScore=-Infinity;

 for(const g of groups){
  const need=needByGroup[g];
  if(!need) continue;
  const groupPool=byGroup[g];
  for(const p of groupPool){
   const afterNeed=need-1;
   let sameGroupFinish=0,taken=0;
   if(afterNeed>0){
    for(const q of groupPool){
     if(q.id===p.id) continue;
     sameGroupFinish+=q.salary; taken++;
     if(taken===afterNeed) break;
    }
    if(taken<afterNeed) continue;
   }
   const reserve=minimumRequired-cheapCost[g]+sameGroupFinish;
   if(p.salary+reserve>remaining+.0001) continue;

   const rank=rankById.get(p.id)??99;
   const scarcity=Math.max(0,8-rank)*1.1;
   const capEfficiency=(p.ovr/Math.max(p.salary,.75))*2.2;
   let score=p.ovr*(POSITION_VALUE[g]||1)+need*9+scarcity+Math.min(capEfficiency,30);
   if(p.salary>remaining*.35) score-=12;
   if(p.salaryType!=='cap_hit') score-=3;
   score+=personalityBonus(p,g,capEfficiency,personality);
   if(score>bestScore){bestScore=score;best=p;}
  }
 }
 return best;
}

export function gradeDraft(roster:Player[], salaryCap:number) {
 if(!roster.length) return {score:0,letter:'F',summary:'No roster submitted',strengths:[],weaknesses:['Roster incomplete']};
 const spent=roster.reduce((n,p)=>n+p.salary,0);
 const avg=roster.reduce((n,p)=>n+p.ovr,0)/roster.length;
 const verified=roster.filter(p=>p.salaryType==='cap_hit').length/roster.length;
 const groups=countRosterGroups(roster);
 const complete=Object.entries(ROSTER_REQUIREMENTS).every(([g,n])=>(groups as any)[g]>=n);
 const stars=roster.filter(p=>p.ovr>=90).length;
 const value=roster.reduce((n,p)=>n+p.ovr/Math.max(p.salary,1),0)/roster.length;
 let score=avg*.70 + Math.min(12,value*.65) + Math.min(7,stars*1.4) + verified*5 + (complete?6:0);
 if(spent>salaryCap) score-=25;
 score=Math.max(0,Math.min(100,Math.round(score)));
 const letter=score>=93?'A+':score>=90?'A':score>=87?'A-':score>=83?'B+':score>=80?'B':score>=77?'B-':score>=73?'C+':score>=70?'C':score>=65?'D':'F';
 const strengths:string[]=[]; const weaknesses:string[]=[];
 if(avg>=86) strengths.push('High-end talent across the roster'); else weaknesses.push('Overall talent level is light');
 if(value>=5) strengths.push('Strong production per cap dollar'); else weaknesses.push('Too much cap tied up for the rating return');
 if(stars>=3) strengths.push(`${stars} elite 90+ OVR players`);
 if(verified<.8) weaknesses.push('Some salaries still need verified 2026 cap-hit data');
 return {score,letter,summary:`${letter} — ${score}/100 Ball Knower Draft Score`,strengths,weaknesses,spent,remaining:salaryCap-spent};
}
