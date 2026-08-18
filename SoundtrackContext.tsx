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
const TEAM_ONBOARDING_KEY = 'ballknower_team_wheel_onboarding_v2';
const TEAM_FAVORITE_KEY = 'ballknower_favorite_team_v1';
const TEAM_PICKER_ID = 'bk-favorite-team-picker';

// The live Vercel loader flattens the normal utils wrapper import to the root
// soundtrack module. Keep the newest tracks available here too so the live app
// and normal bundled app expose the exact same playlist.
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

export const SoundtrackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MUTED);
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VOLUME);
      return saved !== null ? parseFloat(saved) : 0.22;
    } catch {
      return 0.22;
    }
  });

  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRACK);
      return saved !== null ? parseInt(saved, 10) % SOUNDTRACK_TRACKS.length : 0;
    } catch {
      return 0;
    }
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isIntroActive, setIsIntroActive] = useState<boolean>(true);
  const hasEverStartedRef = useRef<boolean>(false);

  // Force the new 32-team wheel once for this onboarding version, even if an
  // older favorite-team value already exists. ?teamsetup=1 always force-opens.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

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

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
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

  // Favorite-team confirmation runs from the compatibility layer in the
  // soundtrack engine. After a real confirmation, reload once so any observer
  // created from the previous stored team cannot repaint the old theme. Wheel
  // previews do not reload because localStorage has not changed yet.
  useEffect(() => {
    const favoriteKey = 'ballknower_favorite_team_v1';
    const handleTeamChange = (event: Event) => {
      const code = String((event as CustomEvent<{ code?: string }>).detail?.code || '');
      if (!code) return;
      let saved = '';
      try { saved = localStorage.getItem(favoriteKey) || ''; } catch {}
      const confirmVisible = Boolean(document.querySelector('[data-bk-team-confirm]'));
      if (confirmVisible && saved === code) {
        try { localStorage.setItem(TEAM_ONBOARDING_KEY, 'done'); } catch {}
        window.setTimeout(() => window.location.reload(), 80);
      }
    };
    const handleTeamClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-bk-team-skip]')) return;
      try {
        localStorage.setItem(TEAM_ONBOARDING_KEY, 'done');
        localStorage.setItem(TEAM_FAVORITE_KEY, 'NONE');
      } catch {}
      window.setTimeout(() => {
        document.body.style.background = '#0A0A0A';
        document.documentElement.removeAttribute('data-bk-favorite-team');
      }, 40);
    };
    window.addEventListener('ballknower-favorite-team-change', handleTeamChange as EventListener);
    document.addEventListener('click', handleTeamClick, true);
    return () => {
      window.removeEventListener('ballknower-favorite-team-change', handleTeamChange as EventListener);
      document.removeEventListener('click', handleTeamClick, true);
    };
  }, []);

  useEffect(() => {
    globalSoundtrackEngine.setMuted(isMuted);
    try {
      localStorage.setItem(STORAGE_KEY_MUTED, JSON.stringify(isMuted));
    } catch {}
  }, [isMuted]);

  useEffect(() => {
    globalSoundtrackEngine.setVolume(volume);
    try {
      localStorage.setItem(STORAGE_KEY_VOLUME, volume.toString());
    } catch {}
  }, [volume]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TRACK, currentTrackIndex.toString());
    } catch {}
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
    if (isPlaying && !isIntroActive) {
      globalSoundtrackEngine.startTrack(normalized);
    }
  }, [isPlaying, isIntroActive]);

  const nextTrack = useCallback(() => {
    const nextIdx = (currentTrackIndex + 1) % SOUNDTRACK_TRACKS.length;
    selectTrack(nextIdx);
  }, [currentTrackIndex, selectTrack]);

  const prevTrack = useCallback(() => {
    const prevIdx = (currentTrackIndex - 1 + SOUNDTRACK_TRACKS.length) % SOUNDTRACK_TRACKS.length;
    selectTrack(prevIdx);
  }, [currentTrackIndex, selectTrack]);

  const playDraftPickSfx = useCallback(() => {
    globalSoundtrackEngine.playDraftPickSound();
  }, []);

  const playRemoveSfx = useCallback(() => {
    globalSoundtrackEngine.playRemovePlayerSound();
  }, []);

  const playLockSfx = useCallback(() => {
    globalSoundtrackEngine.playRosterLockedSound();
  }, []);

  const playWarningSfx = useCallback(() => {
    globalSoundtrackEngine.playWarningSound();
  }, []);

  const setIntroActive = useCallback((active: boolean) => {
    setIsIntroActive(active);
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
    <SoundtrackContext.Provider
      value={{
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
      }}
    >
      {children}
    </SoundtrackContext.Provider>
  );
};

export const useSoundtrack = () => {
  const context = useContext(SoundtrackContext);
  if (!context) {
    throw new Error('useSoundtrack must be used within a SoundtrackProvider');
  }
  return context;
};
