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

  // Keep React/UI state synchronized when the audio engine automatically
  // advances from one completed song to the next.
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