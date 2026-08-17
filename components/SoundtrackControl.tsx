import React, { useEffect, useRef, useState } from 'react';
import { useSoundtrack } from '../context/SoundtrackContext';
import { Disc3, Music, Pause, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react';

export const SoundtrackControl: React.FC = () => {
  const {
    isPlaying,
    isMuted,
    volume,
    currentTrack,
    currentTrackIndex,
    allTracks,
    toggleMute,
    setVolume,
    nextTrack,
    prevTrack,
    selectTrack,
    play,
    pause,
    isIntroActive,
  } = useSoundtrack();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, []);

  const volumePct = Math.round(volume * 100);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center rounded-full bg-[#1A1A1A] border border-white/10 p-0.5 shadow-md">
        <button
          id="soundtrack-mute-toggle-btn"
          onClick={toggleMute}
          className={`flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-full transition-all ${
            isMuted
              ? 'text-zinc-500 hover:text-white hover:bg-zinc-800'
              : isPlaying
                ? 'text-[#D4AF37] bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
          title={isMuted ? 'Unmute soundtrack' : 'Mute soundtrack'}
        >
          {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : volume < 0.35 ? <Volume1 className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>

        <button
          id="soundtrack-panel-toggle-btn"
          onClick={() => setIsOpen(open => !open)}
          className="flex items-center justify-center sm:justify-start gap-1.5 h-8 sm:h-9 min-w-8 sm:px-2.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-colors"
          title="Your Ball Knower music"
        >
          {isPlaying && !isMuted ? (
            <div className="flex items-end gap-0.5 h-3.5 w-3.5">
              <span className="w-0.5 bg-[#D4AF37] rounded-full animate-pulse" style={{ height: '70%', animationDuration: '0.6s' }} />
              <span className="w-0.5 bg-[#D4AF37] rounded-full animate-pulse" style={{ height: '100%', animationDuration: '0.4s' }} />
              <span className="w-0.5 bg-[#D4AF37] rounded-full animate-pulse" style={{ height: '50%', animationDuration: '0.8s' }} />
            </div>
          ) : (
            <Disc3 className="h-3.5 w-3.5" />
          )}
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-[9px] font-black uppercase tracking-wider max-w-[90px] truncate leading-tight">{currentTrack.title}</span>
            <span className="text-[8px] font-mono font-bold text-zinc-500 leading-none">{isMuted ? 'MUTED' : `${volumePct}% VOL`}</span>
          </div>
        </button>
      </div>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1rem))] rounded-lg border border-white/10 bg-[#121212] p-3.5 shadow-2xl z-[100]">
          <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-[#D4AF37]" />
              <div>
                <h4 className="text-xs font-black uppercase text-white tracking-wider">Your Ball Knower Soundtrack</h4>
                <p className="text-[9px] text-zinc-500 font-bold uppercase">Original tracks by elifromthesouth</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white text-sm px-1">✕</button>
          </div>

          <div className="my-3 rounded-md bg-[#1A1A1A] border border-white/5 p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-mono uppercase tracking-widest text-[#D4AF37] font-black">TRACK {currentTrackIndex + 1} OF {allTracks.length}</span>
              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">{currentTrack.mood}</span>
            </div>
            <div className="text-xs font-black uppercase text-white tracking-wide truncate">{currentTrack.title}</div>
            <div className="text-[10px] text-zinc-400 truncate mb-3">{currentTrack.subtitle}</div>

            <div className="flex items-center justify-center gap-4 pt-2 border-t border-white/5">
              <button onClick={prevTrack} className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800" title="Previous track"><SkipBack className="h-4 w-4" /></button>
              {isPlaying ? (
                <button onClick={pause} className="flex items-center justify-center h-9 w-9 rounded-full bg-[#D4AF37] text-black" title="Pause"><Pause className="h-4 w-4 fill-black" /></button>
              ) : (
                <button onClick={play} disabled={isIntroActive} className="flex items-center justify-center h-9 w-9 rounded-full bg-[#D4AF37] text-black disabled:opacity-40" title="Play"><Play className="h-4 w-4 fill-black ml-0.5" /></button>
              )}
              <button onClick={nextTrack} className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800" title="Next track"><SkipForward className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="space-y-1.5 mb-3 px-1">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-zinc-400">
              <span>Volume</span>
              <span className="font-mono text-[#D4AF37]">{isMuted ? 'Muted' : `${volumePct}%`}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volumePct}
              onChange={event => {
                const next = parseInt(event.target.value, 10) / 100;
                setVolume(next);
                if (isMuted && next > 0) toggleMute();
              }}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
            />
          </div>

          <div className="pt-2 border-t border-white/5">
            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-1 mb-1.5">Choose a track</div>
            <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
              {allTracks.map((track, index) => (
                <button
                  key={track.id}
                  onClick={() => selectTrack(index)}
                  className={`w-full flex items-center justify-between rounded px-2.5 py-2 text-left border transition-colors ${
                    currentTrackIndex === index
                      ? 'bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#D4AF37]'
                      : 'text-zinc-300 hover:bg-[#1A1A1A] hover:text-white border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[9px] text-zinc-500 font-bold">{String(index + 1).padStart(2, '0')}</span>
                    <div className="min-w-0">
                      <div className="text-[11px] font-black uppercase tracking-wide truncate">{track.title}</div>
                      <div className="text-[8px] text-zinc-500 truncate">{track.mood} • {track.tempoBpm} BPM</div>
                    </div>
                  </div>
                  {currentTrackIndex === index && isPlaying && !isMuted && <span className="h-2 w-2 rounded-full bg-[#D4AF37] animate-pulse shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
