import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, VolumeX, SkipForward, RotateCcw, ChevronLeft, ChevronRight, Dices } from 'lucide-react';
import { NFL_TEAMS } from './players';

interface CinematicIntroProps {
  isOpen: boolean;
  onClose: () => void;
}

const INTRO_VIDEO_URL = 'https://raw.githubusercontent.com/kmdbb9zg5k-png/ball-knower1.0/main/public/assets/Creating_football_intro_video_202608160231.mp4';
const INTRO_VOLUME = 0.5;
const FAVORITE_TEAM_KEY = 'ballknower_favorite_team_v2';
const ESPN_CODE: Record<string,string> = { WAS: 'wsh' };
const teamLogo = (code:string) => `https://a.espncdn.com/i/teamlogos/nfl/500/${ESPN_CODE[code] || code.toLowerCase()}.png`;

type TeamWheelProps = { value?:string; onConfirm:(team:string)=>void; onCancel?:()=>void };

function FavoriteTeamWheel({ value, onConfirm, onCancel }: TeamWheelProps) {
  const start = Math.max(0, NFL_TEAMS.findIndex((t:any) => t.code === value));
  const [index, setIndex] = useState(start);
  const [spinning, setSpinning] = useState(false);
  const [pulse, setPulse] = useState(0);
  const touch = useRef<{x:number;t:number}|null>(null);
  const timer = useRef<number|undefined>(undefined);
  const team:any = NFL_TEAMS[index];
  const move = (n:number) => {
    if (!n) return;
    setIndex(i => (i + n + NFL_TEAMS.length) % NFL_TEAMS.length);
    setPulse(p => p + 1);
    if ('vibrate' in navigator) navigator.vibrate?.(8);
  };
  const visible = useMemo(() => [-3,-2,-1,0,1,2,3].map(offset => ({
    offset,
    team: NFL_TEAMS[(index + offset + NFL_TEAMS.length) % NFL_TEAMS.length],
  })), [index]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const randomSpin = () => {
    if (spinning) return;
    setSpinning(true);
    let step = 0;
    const total = 18 + Math.floor(Math.random() * 15);
    const direction = Math.random() > .5 ? 1 : -1;
    const tick = () => {
      move(direction);
      step++;
      if (step < total) {
        const delay = 38 + Math.pow(step / total, 3) * 190;
        timer.current = window.setTimeout(tick, delay);
      } else setSpinning(false);
    };
    tick();
  };

  return (
    <div
      className="fixed inset-0 z-[120] overflow-hidden bg-[#050607] text-white flex flex-col items-center justify-center px-3 sm:px-4 select-none"
      onTouchStart={e => touch.current = { x:e.touches[0].clientX, t:Date.now() }}
      onTouchEnd={e => {
        if (!touch.current || spinning) return;
        const d = e.changedTouches[0].clientX - touch.current.x;
        const dt = Math.max(1, Date.now() - touch.current.t);
        const speed = Math.abs(d) / dt;
        if (Math.abs(d) > 28) {
          const amount = speed > .9 ? 3 : speed > .55 ? 2 : 1;
          move((d < 0 ? 1 : -1) * amount);
        }
        touch.current = null;
      }}
    >
      <style>{`@keyframes bkWheelPulse{0%{transform:scale(.92);opacity:.25}55%{transform:scale(1.08);opacity:.8}100%{transform:scale(1.18);opacity:0}}@keyframes bkStadiumSweep{0%,100%{opacity:.16;transform:translateX(-20%) rotate(-8deg)}50%{opacity:.38;transform:translateX(20%) rotate(8deg)}}@keyframes bkFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
      <div className="absolute inset-0" style={{background:'radial-gradient(circle at 50% 22%,rgba(212,175,55,.22),transparent 26%),radial-gradient(circle at 50% 70%,rgba(18,70,95,.18),transparent 40%),linear-gradient(180deg,#111821 0%,#080a0c 52%,#020303 100%)'}} />
      <div className="absolute -top-24 left-[-15%] w-[52%] h-[130%] bg-gradient-to-r from-transparent via-white/[.06] to-transparent blur-2xl" style={{animation:'bkStadiumSweep 7s ease-in-out infinite'}} />
      <div className="absolute -top-24 right-[-15%] w-[52%] h-[130%] bg-gradient-to-l from-transparent via-[#D4AF37]/[.08] to-transparent blur-2xl" style={{animation:'bkStadiumSweep 8.5s ease-in-out infinite reverse'}} />
      <div className="absolute inset-x-0 bottom-0 h-[34%] opacity-55" style={{background:'repeating-linear-gradient(90deg,transparent 0 7%,rgba(255,255,255,.035) 7.2% 7.5%),linear-gradient(180deg,transparent,#050505 65%)'}} />
      <div className="absolute top-[12%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent shadow-[0_0_30px_rgba(212,175,55,.45)]" />

      <div className="relative z-10 text-center mb-1 sm:mb-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/25 bg-black/40 px-3 py-1.5 text-[9px] tracking-[.3em] font-black text-[#D4AF37]">BALL KNOWER • TEAM IDENTITY</div>
        <h2 className="font-black text-[32px] leading-none sm:text-5xl mt-3 tracking-tight">WHO DO YOU <span className="text-[#D4AF37]">RIDE WITH?</span></h2>
        <p className="text-zinc-500 text-[11px] sm:text-xs mt-2">Swipe the drum. Tap a logo. Lock in your team.</p>
      </div>

      <div className="relative z-10 w-full max-w-4xl h-[350px] sm:h-[465px] flex items-center justify-center [perspective:1250px]">
        <div className="absolute top-[10px] left-1/2 -translate-x-1/2 z-40 flex flex-col items-center">
          <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[27px] border-l-transparent border-r-transparent border-t-[#D4AF37] drop-shadow-[0_0_14px_rgba(212,175,55,.95)]" />
          <div className="w-px h-5 bg-gradient-to-b from-[#D4AF37] to-transparent" />
        </div>
        <div key={pulse} className="absolute top-[40px] w-48 h-48 sm:w-60 sm:h-60 rounded-full border border-[#D4AF37]/35 pointer-events-none" style={{animation:'bkWheelPulse .55s ease-out both'}} />
        <div className="absolute inset-x-[3%] sm:inset-x-[8%] top-9 bottom-4 rounded-[50%] border border-[#D4AF37]/25 bg-gradient-to-b from-white/[.075] via-black/[.14] to-black/80 shadow-[inset_0_18px_50px_rgba(255,255,255,.035),inset_0_-25px_55px_rgba(0,0,0,.85),0_35px_90px_rgba(0,0,0,.72)]" />
        <div className="absolute inset-x-[12%] top-[51%] h-px bg-gradient-to-r from-transparent via-[#D4AF37]/45 to-transparent" />

        {visible.map(({offset,team:t}:any) => {
          const abs = Math.abs(offset);
          const center = offset === 0;
          const x = offset * 112;
          const z = -abs * 145;
          const ry = -offset * 23;
          const scale = center ? 1.33 : abs === 1 ? .88 : abs === 2 ? .65 : .48;
          return (
            <button
              key={t.code}
              disabled={spinning}
              onClick={() => !spinning && move(offset)}
              aria-label={`Select ${t.city} ${t.name}`}
              className="absolute transition-all duration-300 ease-out flex flex-col items-center justify-center touch-manipulation outline-none"
              style={{
                transform:`translateX(${x}px) translateZ(${z}px) rotateY(${ry}deg) scale(${scale})`,
                opacity:center ? 1 : abs === 1 ? .68 : abs === 2 ? .32 : .12,
                zIndex:20-abs,
                filter:center ? 'drop-shadow(0 16px 24px rgba(0,0,0,.7))' : `saturate(${abs===1?.7:.35}) brightness(${abs===1?.72:.48}) blur(${abs===3?1.5:0}px)`,
              }}
            >
              <div className={`relative w-28 h-28 sm:w-36 sm:h-36 rounded-full grid place-items-center border transition-all ${center ? 'border-[#D4AF37] bg-[#111]/95 shadow-[0_0_0_5px_rgba(212,175,55,.08),0_0_38px_rgba(212,175,55,.30),inset_0_0_24px_rgba(255,255,255,.04)]' : 'border-white/10 bg-[#0b0d0f]/90'}`}>
                <img
                  src={teamLogo(t.code)}
                  alt={`${t.name} logo`}
                  draggable={false}
                  className={`${center ? 'w-[76%] h-[76%]' : 'w-[68%] h-[68%]'} object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,.65)]`}
                  onError={e => {
                    const el = e.currentTarget;
                    el.style.display = 'none';
                    const next = el.nextElementSibling as HTMLElement | null;
                    if (next) next.style.display = 'block';
                  }}
                />
                <span style={{display:'none'}} className={`font-black ${center ? 'text-4xl sm:text-5xl text-[#D4AF37]' : 'text-2xl text-zinc-500'}`}>{t.code}</span>
                {center && <div className="absolute inset-[-7px] rounded-full border border-[#D4AF37]/25" style={{animation:'bkFloat 2.8s ease-in-out infinite'}} />}
              </div>
              {center && <div className="mt-3 rounded-full border border-white/10 bg-black/65 px-3 py-1 text-[9px] font-black tracking-[.18em] text-[#D4AF37]">CENTER LOCK</div>}
            </button>
          );
        })}

        <button aria-label="Previous team" disabled={spinning} onClick={() => move(-1)} className="absolute left-0 sm:left-8 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-white/15 bg-black/65 grid place-items-center active:scale-95 hover:border-[#D4AF37]/60 hover:text-[#D4AF37] disabled:opacity-30"><ChevronLeft /></button>
        <button aria-label="Next team" disabled={spinning} onClick={() => move(1)} className="absolute right-0 sm:right-8 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-white/15 bg-black/65 grid place-items-center active:scale-95 hover:border-[#D4AF37]/60 hover:text-[#D4AF37] disabled:opacity-30"><ChevronRight /></button>
      </div>

      <div className="relative z-10 text-center -mt-3 sm:-mt-5 w-full max-w-xl">
        <div className="text-[9px] tracking-[.3em] text-zinc-500 font-black">SELECTED TEAM</div>
        <div className="text-3xl sm:text-5xl font-black mt-1 leading-none">{team.city} <span className="text-[#D4AF37]">{team.name}</span></div>
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <button disabled={spinning} onClick={() => onConfirm(team.code)} className="bg-[#D4AF37] disabled:opacity-45 text-black px-5 py-4 sm:py-5 font-black uppercase tracking-[.14em] shadow-[0_8px_30px_rgba(212,175,55,.20)] active:scale-[.985] hover:bg-[#e4c34f]">CONFIRM {team.name}</button>
          <button disabled={spinning} onClick={randomSpin} title="Spin to a random team" className="w-14 sm:w-16 border border-[#D4AF37]/45 bg-[#D4AF37]/10 text-[#D4AF37] grid place-items-center active:scale-95 disabled:opacity-40"><Dices className={spinning ? 'animate-spin' : ''} /></button>
        </div>
        <div className="mt-2 flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-[.12em] text-zinc-600"><Volume2 size={11}/> Haptic wheel feedback enabled</div>
        {onCancel && <button disabled={spinning} onClick={onCancel} className="mt-2 text-[10px] font-black uppercase tracking-[.18em] text-zinc-600 hover:text-white disabled:opacity-40">CANCEL</button>}
      </div>
    </div>
  );
}

export const CinematicIntro: React.FC<CinematicIntroProps> = ({ isOpen, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [teamWheelOpen, setTeamWheelOpen] = useState(false);
  const [favoriteTeam, setFavoriteTeam] = useState<string>(() => {
    try { return localStorage.getItem(FAVORITE_TEAM_KEY) || localStorage.getItem('ballknower_favorite_team') || ''; }
    catch { return ''; }
  });

  useEffect(() => {
    if (!isOpen) return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.muted = true;
    video.volume = INTRO_VOLUME;
    setIsMuted(true);
    video.play().catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    const openWheel = () => setTeamWheelOpen(true);
    const captureFavoriteTeamClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const clickable = target?.closest?.('button,a,[role="button"]') as HTMLElement | null;
      if (!clickable) return;
      const text = String(clickable.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (text.includes('change favorite team') || text.includes('choose favorite team') || text.includes('select favorite team') || text === 'favorite team') {
        event.preventDefault();
        event.stopPropagation();
        setTeamWheelOpen(true);
      }
    };
    window.addEventListener('ballknower:change-favorite-team', openWheel as EventListener);
    document.addEventListener('click', captureFavoriteTeamClick, true);
    (window as any).openBallKnowerTeamWheel = openWheel;
    return () => {
      window.removeEventListener('ballknower:change-favorite-team', openWheel as EventListener);
      document.removeEventListener('click', captureFavoriteTeamClick, true);
      if ((window as any).openBallKnowerTeamWheel === openWheel) delete (window as any).openBallKnowerTeamWheel;
    };
  }, []);

  const confirmFavoriteTeam = (code:string) => {
    setFavoriteTeam(code);
    try {
      localStorage.setItem(FAVORITE_TEAM_KEY, code);
      localStorage.setItem('ballknower_favorite_team', code);
      localStorage.setItem('favoriteTeam', code);
    } catch {}
    window.dispatchEvent(new CustomEvent('ballknower:favorite-team-changed', { detail:{team:code} }));
    setTeamWheelOpen(false);
  };

  const toggleMute = (event?:React.MouseEvent) => {
    event?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    video.volume = INTRO_VOLUME;
    setIsMuted(video.muted);
    if (video.paused) video.play().catch(() => {});
  };
  const restart = (event?:React.MouseEvent) => {
    event?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.volume = INTRO_VOLUME;
    video.play().catch(() => {});
  };
  const skipIntro = (event?:React.MouseEvent) => { event?.stopPropagation(); onClose(); };

  return (
    <>
      {teamWheelOpen && <FavoriteTeamWheel value={favoriteTeam || undefined} onConfirm={confirmFavoriteTeam} onCancel={() => setTeamWheelOpen(false)} />}
      {isOpen && !teamWheelOpen && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden">
          <video ref={videoRef} src={INTRO_VIDEO_URL} className="absolute inset-0 h-full w-full object-cover bg-black" playsInline muted={isMuted} preload="auto" onEnded={onClose} />
          <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 p-4 sm:p-6 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="rounded-sm border border-white/20 bg-black/60 p-2.5 text-white hover:bg-black/80" aria-label={isMuted ? 'Turn intro sound on' : 'Mute intro'}>{isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
              <button onClick={restart} className="rounded-sm border border-white/20 bg-black/60 p-2.5 text-white hover:bg-black/80" aria-label="Replay intro"><RotateCcw className="h-5 w-5" /></button>
            </div>
            <button onClick={skipIntro} className="flex items-center gap-2 rounded-sm border border-[#D4AF37]/50 bg-black/70 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#D4AF37] hover:bg-black"><SkipForward className="h-4 w-4" />Skip Intro</button>
          </div>
        </div>
      )}
    </>
  );
};
