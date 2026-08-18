import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, SkipForward, RotateCcw } from 'lucide-react';
import { FavoriteTeamWheel } from './FavoriteTeamWheel';

interface CinematicIntroProps {
  isOpen: boolean;
  onClose: () => void;
}

const INTRO_VIDEO_URL = 'https://raw.githubusercontent.com/kmdbb9zg5k-png/ball-knower1.0/main/public/assets/Creating_football_intro_video_202608160231.mp4';
const INTRO_VOLUME = 0.5;
const FAVORITE_TEAM_KEY = 'ballknower_favorite_team_v2';

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

    // iPhone Safari allows muted autoplay, so the intro starts immediately
    // with no extra launch prompt or blocked-audio screen.
    video.play().catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    const openWheel = () => setTeamWheelOpen(true);
    const captureFavoriteTeamClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const clickable = target?.closest?.('button,a,[role="button"]') as HTMLElement | null;
      if (!clickable) return;
      const text = String(clickable.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (
        text.includes('change favorite team') ||
        text.includes('choose favorite team') ||
        text.includes('select favorite team') ||
        text === 'favorite team'
      ) {
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

  const confirmFavoriteTeam = (code: string) => {
    setFavoriteTeam(code);
    try {
      localStorage.setItem(FAVORITE_TEAM_KEY, code);
      localStorage.setItem('ballknower_favorite_team', code);
      localStorage.setItem('favoriteTeam', code);
    } catch {}
    window.dispatchEvent(new CustomEvent('ballknower:favorite-team-changed', { detail: { team: code } }));
    setTeamWheelOpen(false);
  };

  const toggleMute = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    video.volume = INTRO_VOLUME;
    setIsMuted(video.muted);
    if (video.paused) video.play().catch(() => {});
  };

  const restart = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.volume = INTRO_VOLUME;
    video.play().catch(() => {});
  };

  const skipIntro = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    onClose();
  };

  return (
    <>
      {teamWheelOpen && (
        <FavoriteTeamWheel
          value={favoriteTeam || undefined}
          onConfirm={confirmFavoriteTeam}
          onCancel={() => setTeamWheelOpen(false)}
        />
      )}

      {isOpen && !teamWheelOpen && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            src={INTRO_VIDEO_URL}
            className="absolute inset-0 h-full w-full object-cover bg-black"
            playsInline
            muted={isMuted}
            preload="auto"
            onEnded={onClose}
          />

          <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 p-4 sm:p-6 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="rounded-sm border border-white/20 bg-black/60 p-2.5 text-white hover:bg-black/80"
                aria-label={isMuted ? 'Turn intro sound on' : 'Mute intro'}
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <button
                onClick={restart}
                className="rounded-sm border border-white/20 bg-black/60 p-2.5 text-white hover:bg-black/80"
                aria-label="Replay intro"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            </div>

            <button
              onClick={skipIntro}
              className="flex items-center gap-2 rounded-sm border border-[#D4AF37]/50 bg-black/70 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#D4AF37] hover:bg-black"
            >
              <SkipForward className="h-4 w-4" />
              Skip Intro
            </button>
          </div>
        </div>
      )}
    </>
  );
};
