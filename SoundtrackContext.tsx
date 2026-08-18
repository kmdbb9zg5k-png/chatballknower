import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { globalSoundtrackEngine, SOUNDTRACK_TRACKS, SoundtrackTrack } from '../utils/soundtrackEngine';

interface SoundtrackContextType {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTrack: SoundtrackTrack;
  currentTrackIndex: number;
  allTracks: SoundtrackTrack[];
  toggleMute: () => void;
  setVolume: (vol: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  selectTrack: (index: number) => void;
  play: () => void;
  pause: () => void;
  playDraftPickSfx: () => void;
  playRemoveSfx: () => void;
  playLockSfx: () => void;
  playWarningSfx: () => void;
  setIntroActive: (active: boolean) => void;
  isIntroActive: boolean;
}

const SoundtrackContext = createContext<SoundtrackContextType | undefined>(undefined);

const STORAGE_KEY_MUTED = 'bk_soundtrack_muted';
const STORAGE_KEY_VOLUME = 'bk_soundtrack_volume';
const STORAGE_KEY_TRACK = 'bk_soundtrack_track_idx';
const TEAM_FAVORITE_KEY = 'ballknower_favorite_team_v1';
const TEAM_ONBOARDING_KEY = 'ballknower_team_onboarding_v2';
const TEAM_PICKER_ID = 'bk-favorite-team-picker';
const TEAM_CINEMATIC_STYLE_ID = 'bk-team-cinematic-v2';

const LIVE_EXTRA_TRACKS: SoundtrackTrack[] = [
  {
    id: 'boots-stay-clean',
    title: 'Boots Stay Clean',
    subtitle: 'elifromthesouth • Original Ball Knower Track',
    tempoBpm: 100,
    mood: 'Undefeated',
    durationSec: 175,
    audioUrl: 'https://cdn1.suno.ai/0d599a59-bdfd-4e8c-bee2-ac35f7cb87d7.mp3',
  },
  {
    id: 'cant-break-me',
    title: 'Can’t Break Me',
    subtitle: 'elifromthesouth • Original Ball Knower Track',
    tempoBpm: 100,
    mood: 'Unbreakable',
    durationSec: 152,
    audioUrl: 'https://cdn1.suno.ai/8f1c1f2a-c8ff-46e4-b357-cf894688e3eb.mp3',
  },
];

for (const track of LIVE_EXTRA_TRACKS) {
  if (!SOUNDTRACK_TRACKS.some(existing => existing.id === track.id)) SOUNDTRACK_TRACKS.push(track);
}

function installCinematicTeamThemeStyles() {
  if (typeof document === 'undefined' || document.getElementById(TEAM_CINEMATIC_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TEAM_CINEMATIC_STYLE_ID;
  style.textContent = `
    @keyframes bkCinematicSweepA {
      0%,100% { transform: translate3d(-28vw,-8vh,0) rotate(-20deg); opacity:.11; }
      50% { transform: translate3d(42vw,14vh,0) rotate(-20deg); opacity:.24; }
    }
    @keyframes bkCinematicSweepB {
      0%,100% { transform: translate3d(30vw,12vh,0) rotate(22deg); opacity:.08; }
      50% { transform: translate3d(-40vw,-8vh,0) rotate(22deg); opacity:.18; }
    }
    @keyframes bkCinematicLogoBreath {
      0%,100% { transform: scale(.985) translate3d(0,0,0); opacity:.085; }
      50% { transform: scale(1.025) translate3d(-8px,5px,0); opacity:.12; }
    }
    @keyframes bkCinematicHaze {
      0%,100% { transform: translateX(-5%) scale(1); opacity:.42; }
      50% { transform: translateX(5%) scale(1.04); opacity:.66; }
    }

    html[data-bk-favorite-team] body {
      background:
        radial-gradient(ellipse at 78% 12%, var(--bk-team-primary-soft), transparent 38%),
        radial-gradient(ellipse at 15% 75%, var(--bk-team-secondary-soft), transparent 40%),
        #030403 !important;
    }

    html[data-bk-favorite-team] #root {
      position:relative;
      z-index:3;
      isolation:isolate;
    }

    html[data-bk-favorite-team] #bk-favorite-team-backdrop {
      z-index:1 !important;
      mix-blend-mode:normal !important;
      opacity:1 !important;
      background:
        radial-gradient(ellipse at 72% 16%, var(--bk-team-primary-soft), transparent 34%),
        radial-gradient(ellipse at 12% 73%, var(--bk-team-secondary-soft), transparent 38%),
        linear-gradient(180deg,rgba(2,3,3,.02),rgba(2,3,3,.42) 56%,rgba(2,2,2,.82)) !important;
    }

    html[data-bk-favorite-team] #bk-favorite-team-backdrop::before {
      content:'';
      position:absolute;
      inset:0;
      background:
        radial-gradient(ellipse at 50% 104%, transparent 0 19%, rgba(255,255,255,.035) 20% 20.5%, transparent 21% 31%, rgba(255,255,255,.025) 32% 32.5%, transparent 33%),
        linear-gradient(90deg, transparent 0 47%, rgba(255,255,255,.025) 49.5%, rgba(255,255,255,.04) 50%, rgba(255,255,255,.025) 50.5%, transparent 53%),
        linear-gradient(180deg, transparent 0 72%, rgba(255,255,255,.018) 72.5%, transparent 73%);
      opacity:.8;
      pointer-events:none;
    }

    html[data-bk-favorite-team] #bk-favorite-team-backdrop::after {
      content:'';
      position:absolute;
      left:-10%; right:-10%; bottom:-8vh; height:42vh;
      border-radius:50% 50% 0 0;
      background:
        radial-gradient(ellipse at center bottom, rgba(255,255,255,.045), transparent 57%),
        linear-gradient(180deg, transparent, rgba(0,0,0,.42));
      filter:blur(3px);
      animation:bkCinematicHaze 10s ease-in-out infinite;
      pointer-events:none;
    }

    html[data-bk-favorite-team] #bk-favorite-team-backdrop .bk-team-watermark {
      right:-5vw !important;
      top:11vh !important;
      width:min(57vw,520px) !important;
      height:min(57vw,520px) !important;
      opacity:.09 !important;
      filter:saturate(.8) brightness(.78) drop-shadow(0 0 44px var(--bk-team-primary)) !important;
      animation:bkCinematicLogoBreath 7s ease-in-out infinite !important;
    }

    html[data-bk-favorite-team] #bk-favorite-team-backdrop .bk-team-beam {
      width:20vw !important;
      height:145vh !important;
      top:-28vh !important;
      filter:blur(42px) !important;
      border-radius:999px;
    }
    html[data-bk-favorite-team] #bk-favorite-team-backdrop .bk-team-beam.a {
      opacity:.14 !important;
      animation:bkCinematicSweepA 14s ease-in-out infinite !important;
    }
    html[data-bk-favorite-team] #bk-favorite-team-backdrop .bk-team-beam.b {
      opacity:.10 !important;
      animation:bkCinematicSweepB 17s ease-in-out infinite !important;
    }

    /* Let the cinematic layer breathe through the main app without letting the logo cover copy. */
    html[data-bk-favorite-team] #root > .relative.min-h-screen,
    html[data-bk-favorite-team] #root > .min-h-screen {
      background:linear-gradient(180deg,rgba(5,5,5,.42),rgba(6,6,6,.72) 60%,rgba(5,5,5,.92)) !important;
    }
    html[data-bk-favorite-team] main > .min-h-screen {
      background:rgba(6,6,6,.78) !important;
    }

    /* Welcome/overview hero: darker center panel and protected text readability. */
    html[data-bk-favorite-team] #root > .relative.min-h-screen > div.relative {
      position:relative;
      z-index:4;
    }
    html[data-bk-favorite-team] h1,
    html[data-bk-favorite-team] h2,
    html[data-bk-favorite-team] p,
    html[data-bk-favorite-team] button,
    html[data-bk-favorite-team] a {
      position:relative;
      z-index:2;
    }

    /* Softer premium surfaces once a team is active. */
    html[data-bk-favorite-team] [class*='border-white/10'][class*='bg-[#101010]'],
    html[data-bk-favorite-team] [class*='border-white/10'][class*='bg-[#111]'],
    html[data-bk-favorite-team] [class*='bg-[#121212]'] {
      background:rgba(11,12,12,.82) !important;
      backdrop-filter:blur(14px);
      -webkit-backdrop-filter:blur(14px);
      border-radius:24px !important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 18px 60px rgba(0,0,0,.22);
    }

    @media(max-width:600px) {
      html[data-bk-favorite-team] #bk-favorite-team-backdrop .bk-team-watermark {
        right:-24vw !important;
        top:18vh !important;
        width:92vw !important;
        height:92vw !important;
        opacity:.075 !important;
      }
      html[data-bk-favorite-team] #bk-favorite-team-backdrop {
        background:
          radial-gradient(ellipse at 84% 12%, var(--bk-team-primary-soft), transparent 37%),
          radial-gradient(ellipse at 6% 66%, var(--bk-team-secondary-soft), transparent 42%),
          linear-gradient(180deg,rgba(2,3,3,.10),rgba(2,3,3,.55) 58%,rgba(2,2,2,.88)) !important;
      }
    }

    @media(prefers-reduced-motion:reduce) {
      html[data-bk-favorite-team] #bk-favorite-team-backdrop *,
      html[data-bk-favorite-team] #bk-favorite-team-backdrop::after { animation:none !important; }
    }
  `;
  document.head.appendChild(style);
}

export const SoundtrackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MUTED);
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });

  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VOLUME);
      return saved !== null ? parseFloat(saved) : 0.22;
    } catch { return 0.22; }
  });

  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRACK);
      return saved !== null ? parseInt(saved, 10) % SOUNDTRACK_TRACKS.length : 0;
    } catch { return 0; }
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isIntroActive, setIsIntroActiveState] = useState(true);
  const hasEverStartedRef = useRef(false);

  useEffect(() => {
    installCinematicTeamThemeStyles();
    const handleTeamChange = () => installCinematicTeamThemeStyles();
    window.addEventListener('ballknower-favorite-team-change', handleTeamChange);
    return () => window.removeEventListener('ballknower-favorite-team-change', handleTeamChange);
  }, []);

  // Force this generation of the 32-team picker once; ?teamsetup=1 always opens it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let completed = false;
    let forceOpen = false;
    try {
      completed = localStorage.getItem(TEAM_ONBOARDING_KEY) === 'done';
      forceOpen = new URLSearchParams(window.location.search).get('teamsetup') === '1';
    } catch {}
    if (completed && !forceOpen) return;

    let opened = false;
    const timer = window.setTimeout(() => {
      opened = true;
      window.dispatchEvent(new Event('ballknower-open-team-picker'));
    }, 1800);

    const observer = new MutationObserver(() => {
      if (!opened) return;
      const picker = document.getElementById(TEAM_PICKER_ID);
      let favorite = '';
      try { favorite = localStorage.getItem(TEAM_FAVORITE_KEY) || ''; } catch {}
      if (!picker && favorite) {
        try { localStorage.setItem(TEAM_ONBOARDING_KEY, 'done'); } catch {}
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, []);

  useEffect(() => {
    const handleTrackChange = (event: Event) => {
      const index = Number((event as CustomEvent<{ index?: number }>).detail?.index);
      if (!Number.isInteger(index) || index < 0 || index >= SOUNDTRACK_TRACKS.length) return;
      setCurrentTrackIndex(index);
      setIsPlaying(true);
      hasEverStartedRef.current = true;
    };
    window.addEventListener('ballknower-track-change', handleTrackChange as EventListener);
    return () => window.removeEventListener('ballknower-track-change', handleTrackChange as EventListener);
  }, []);

  useEffect(() => {
    globalSoundtrackEngine.setMuted(isMuted);
    try { localStorage.setItem(STORAGE_KEY_MUTED, JSON.stringify(isMuted)); } catch {}
  }, [isMuted]);

  useEffect(() => {
    globalSoundtrackEngine.setVolume(volume);
    try { localStorage.setItem(STORAGE_KEY_VOLUME, volume.toString()); } catch {}
  }, [volume]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_TRACK, currentTrackIndex.toString()); } catch {}
  }, [currentTrackIndex]);

  const play = useCallback(() => {
    if (isIntroActive) return;
    globalSoundtrackEngine.startTrack(currentTrackIndex);
    setIsPlaying(true);
    hasEverStartedRef.current = true;
  }, [currentTrackIndex, isIntroActive]);

  const pause = useCallback(() => {
    globalSoundtrackEngine.pause();
    setIsPlaying(false);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      globalSoundtrackEngine.setMuted(next);
      return next;
    });
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    globalSoundtrackEngine.setVolume(clamped);
  }, []);

  const selectTrack = useCallback((index: number) => {
    const normalized = (index + SOUNDTRACK_TRACKS.length) % SOUNDTRACK_TRACKS.length;
    setCurrentTrackIndex(normalized);
    if (isPlaying && !isIntroActive) globalSoundtrackEngine.startTrack(normalized);
  }, [isPlaying, isIntroActive]);

  const nextTrack = useCallback(() => selectTrack(currentTrackIndex + 1), [currentTrackIndex, selectTrack]);
  const prevTrack = useCallback(() => selectTrack(currentTrackIndex - 1), [currentTrackIndex, selectTrack]);
  const playDraftPickSfx = useCallback(() => globalSoundtrackEngine.playDraftPickSound(), []);
  const playRemoveSfx = useCallback(() => globalSoundtrackEngine.playRemovePlayerSound(), []);
  const playLockSfx = useCallback(() => globalSoundtrackEngine.playRosterLockedSound(), []);
  const playWarningSfx = useCallback(() => globalSoundtrackEngine.playWarningSound(), []);

  const setIntroActive = useCallback((active: boolean) => {
    setIsIntroActiveState(active);
    if (active) {
      globalSoundtrackEngine.stop();
      setIsPlaying(false);
    } else {
      globalSoundtrackEngine.setVolume(volume);
      globalSoundtrackEngine.setMuted(isMuted);
      globalSoundtrackEngine.startTrack(currentTrackIndex);
      setIsPlaying(true);
      hasEverStartedRef.current = true;
    }
  }, [volume, isMuted, currentTrackIndex]);

  useEffect(() => {
    const handleFirstUserGesture = () => {
      if (!isIntroActive && !isPlaying && !hasEverStartedRef.current) {
        globalSoundtrackEngine.startTrack(currentTrackIndex);
        setIsPlaying(true);
        hasEverStartedRef.current = true;
      }
    };
    window.addEventListener('click', handleFirstUserGesture, { once: true });
    window.addEventListener('keydown', handleFirstUserGesture, { once: true });
    window.addEventListener('touchstart', handleFirstUserGesture, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstUserGesture);
      window.removeEventListener('keydown', handleFirstUserGesture);
      window.removeEventListener('touchstart', handleFirstUserGesture);
    };
  }, [isIntroActive, isPlaying, currentTrackIndex]);

  const currentTrack = SOUNDTRACK_TRACKS[currentTrackIndex] || SOUNDTRACK_TRACKS[0];

  return (
    <SoundtrackContext.Provider value={{
      isPlaying,
      isMuted,
      volume,
      currentTrack,
      currentTrackIndex,
      allTracks: SOUNDTRACK_TRACKS,
      toggleMute,
      setVolume,
      nextTrack,
      prevTrack,
      selectTrack,
      play,
      pause,
      playDraftPickSfx,
      playRemoveSfx,
      playLockSfx,
      playWarningSfx,
      setIntroActive,
      isIntroActive,
    }}>
      {children}
    </SoundtrackContext.Provider>
  );
};

export const useSoundtrack = () => {
  const context = useContext(SoundtrackContext);
  if (!context) throw new Error('useSoundtrack must be used within a SoundtrackProvider');
  return context;
};
