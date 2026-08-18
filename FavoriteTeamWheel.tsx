import React,{useMemo,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {NFL_TEAMS} from './players';

type Props={value?:string;onConfirm:(team:string)=>void;onCancel?:()=>void};

export function FavoriteTeamWheel({value,onConfirm,onCancel}:Props){
 const start=Math.max(0,NFL_TEAMS.findIndex((t:any)=>t.code===value));
 const [index,setIndex]=useState(start); const touch=useRef<number|null>(null);
 const team:any=NFL_TEAMS[index];
 const move=(n:number)=>setIndex(i=>(i+n+NFL_TEAMS.length)%NFL_TEAMS.length);
 const visible=useMemo(()=>[-2,-1,0,1,2].map(offset=>({offset,team:NFL_TEAMS[(index+offset+NFL_TEAMS.length)%NFL_TEAMS.length]})),[index]);
 return <div className="fixed inset-0 z-[90] overflow-hidden bg-[#050607] text-white flex flex-col items-center justify-center px-4" onTouchStart={e=>touch.current=e.touches[0].clientX} onTouchEnd={e=>{if(touch.current==null)return;const d=e.changedTouches[0].clientX-touch.current;if(Math.abs(d)>35)move(d<0?1:-1);touch.current=null}}>
  <div className="absolute inset-0 opacity-70" style={{background:'radial-gradient(circle at 50% 28%,rgba(212,175,55,.18),transparent 30%),linear-gradient(180deg,#101419 0%,#050607 68%)'}}/>
  <div className="absolute top-[13%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent shadow-[0_0_30px_rgba(212,175,55,.45)]"/>
  <div className="relative z-10 text-center mb-5"><div className="text-[10px] tracking-[.35em] font-black text-[#D4AF37]">CHOOSE YOUR TEAM</div><h2 className="font-black text-3xl sm:text-5xl mt-1">WHO DO YOU RIDE WITH?</h2><p className="text-zinc-500 text-xs mt-2">Swipe the wheel or use the arrows.</p></div>
  <div className="relative z-10 w-full max-w-3xl h-[330px] sm:h-[430px] flex items-center justify-center [perspective:1000px]">
   <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 w-0 h-0 border-l-[13px] border-r-[13px] border-t-[24px] border-l-transparent border-r-transparent border-t-[#D4AF37] drop-shadow-[0_0_12px_rgba(212,175,55,.8)]"/>
   <div className="absolute inset-x-[8%] top-8 bottom-5 rounded-[50%] border border-[#D4AF37]/25 bg-gradient-to-b from-white/[.06] via-black/10 to-black/70 shadow-[inset_0_0_55px_rgba(255,255,255,.05),0_30px_80px_rgba(0,0,0,.7)]"/>
   {visible.map(({offset,team:t}:any)=>{const abs=Math.abs(offset);return <button key={t.code} onClick={()=>move(offset)} className="absolute transition-all duration-300 ease-out flex flex-col items-center justify-center" style={{transform:`translateX(${offset*105}px) translateZ(${-abs*135}px) rotateY(${-offset*24}deg) scale(${offset===0?1.28:abs===1?.82:.62})`,opacity:offset===0?1:abs===1?.58:.2,zIndex:10-abs,filter:offset===0?'none':`blur(${abs===2?1.5:0}px)`}}>
    <div className={`w-28 h-28 sm:w-36 sm:h-36 rounded-full grid place-items-center border ${offset===0?'border-[#D4AF37] bg-[#D4AF37]/10 shadow-[0_0_35px_rgba(212,175,55,.28)]':'border-white/10 bg-white/[.03]'}`}><span className={`font-black ${offset===0?'text-4xl sm:text-5xl text-[#D4AF37]':'text-2xl text-zinc-500'}`}>{t.code}</span></div>
   </button>})}
   <button aria-label="Previous team" onClick={()=>move(-1)} className="absolute left-0 sm:left-8 z-40 w-12 h-12 rounded-full border border-white/15 bg-black/50 grid place-items-center active:scale-95"><ChevronLeft/></button>
   <button aria-label="Next team" onClick={()=>move(1)} className="absolute right-0 sm:right-8 z-40 w-12 h-12 rounded-full border border-white/15 bg-black/50 grid place-items-center active:scale-95"><ChevronRight/></button>
  </div>
  <div className="relative z-10 text-center -mt-2"><div className="text-[10px] tracking-[.28em] text-zinc-500 font-black">SELECTED TEAM</div><div className="text-3xl sm:text-4xl font-black mt-1">{team.city} <span className="text-[#D4AF37]">{team.name}</span></div><button onClick={()=>onConfirm(team.code)} className="mt-5 min-w-[270px] bg-[#D4AF37] text-black px-8 py-4 font-black uppercase tracking-wider shadow-[0_8px_30px_rgba(212,175,55,.18)] active:scale-[.98]">CONFIRM {team.name}</button>{onCancel&&<button onClick={onCancel} className="block mx-auto mt-3 text-xs font-bold text-zinc-500 hover:text-white">CANCEL</button>}</div>
 </div>;
}
