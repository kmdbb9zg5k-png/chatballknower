import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, SkipForward, RotateCcw } from 'lucide-react';

interface CinematicIntroProps {
  isOpen: boolean;
  onClose: () => void;
}

const INTRO_VIDEO_URL = 'https://raw.githubusercontent.com/kmdbb9zg5k-png/ball-knower1.0/main/public/assets/Creating_football_intro_video_202608160231.mp4';
const INTRO_VOLUME = 0.5;

export const CinematicIntro: React.FC<CinematicIntroProps> = ({ isOpen, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = 0;
    video.muted = false;
    video.volume = INTRO_VOLUME;
    setIsMuted(false);
    setNeedsGesture(false);

    const attempt = video.play();
    if (attempt) {
      attempt.catch(() => {
        // iPhone Safari blocks autoplay with sound. Never fall back to mute;
        // keep the first frame visible and let one tap anywhere unlock audio.
        video.pause();
        video.muted = false;
        video.volume = INTRO_VOLUME;
        setIsMuted(false);
        setNeedsGesture(true);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const startWithSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = INTRO_VOLUME;
    setIsMuted(false);
    video.play()
      .then(() => setNeedsGesture(false))
      .catch(() => setNeedsGesture(true));
  };

  const toggleMute = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    video.volume = INTRO_VOLUME;
    setIsMuted(video.muted);
    if (video.paused) video.play().catch(() => setNeedsGesture(true));
  };

  const restart = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.muted = false;
    video.volume = INTRO_VOLUME;
    setIsMuted(false);
    video.play().then(() => setNeedsGesture(false)).catch(() => setNeedsGesture(true));
  };

  const skipIntro = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden"
      onClick={needsGesture ? startWithSound : undefined}
    >
      <video
        ref={videoRef}
        src={INTRO_VIDEO_URL}
        className="absolute inset-0 h-full w-full object-cover bg-black"
        playsInline
        preload="auto"
        onEnded={onClose}
        onError={() => setNeedsGesture(true)}
      />

      {needsGesture && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center pb-24 sm:pb-28">
          <div className="rounded-full border border-[#D4AF37]/35 bg-black/55 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#D4AF37] backdrop-blur-sm animate-pulse">
            Tap anywhere to start • Sound 50%
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 p-4 sm:p-6 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="rounded-sm border border-white/20 bg-black/60 p-2.5 text-white hover:bg-black/80"
            aria-label={isMuted ? 'Unmute intro' : 'Mute intro'}
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
  );
};