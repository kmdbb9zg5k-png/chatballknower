export interface SoundtrackTrack {
  id: string;
  title: string;
  subtitle: string;
  tempoBpm: number;
  mood: string;
  durationSec: number;
  audioUrl: string;
}

const sunoAudio = (id: string) => `https://cdn1.suno.ai/${id}.mp3`;

/**
 * Elijah's original Ball Knower soundtrack.
 * The Suno clip IDs come from the metadata embedded in the MP3 exports.
 */
export const SOUNDTRACK_TRACKS: SoundtrackTrack[] = [
  {
    id: 'war-room-draft-remastered',
    title: 'War Room Draft (Remastered)',
    subtitle: 'elifromthesouth • Original Ball Knower Instrumental',
    tempoBpm: 96,
    mood: 'War Room',
    durationSec: 89,
    audioUrl: sunoAudio('df531107-7fdb-4057-8729-9abaf4aa2177'),
  },
  {
    id: 'draft-day-kings',
    title: 'Draft Day Kings',
    subtitle: 'elifromthesouth • Original Ball Knower Track',
    tempoBpm: 144,
    mood: 'Draft Night',
    durationSec: 175,
    audioUrl: sunoAudio('7c563b19-9b13-4d93-a891-2e2232ed08ef'),
  },
  {
    id: 'game-day-grin',
    title: 'Game Day Grin',
    subtitle: 'elifromthesouth • Original Ball Knower Track',
    tempoBpm: 86,
    mood: 'Game Day',
    durationSec: 189,
    audioUrl: sunoAudio('ad6a4429-ddea-48b4-8fe2-01c9d5191caa'),
  },
  {
    id: 'better-than-you',
    title: 'Better Than You',
    subtitle: 'elifromthesouth • Original Ball Knower Track',
    tempoBpm: 83,
    mood: 'Statement',
    durationSec: 249,
    audioUrl: sunoAudio('c7756be2-90ef-4752-a71a-36998071770f'),
  },
  {
    id: 'top-of-the-draft',
    title: 'Top of the Draft',
    subtitle: 'elifromthesouth • Original Ball Knower Track',
    tempoBpm: 129,
    mood: 'Franchise',
    durationSec: 121,
    audioUrl: sunoAudio('e4b60b48-e421-4abd-aeb9-2c8847f2f645'),
  },
  {
    id: 'war-room-draft-original',
    title: 'War Room Draft',
    subtitle: 'elifromthesouth • Original Instrumental',
    tempoBpm: 96,
    mood: 'On The Clock',
    durationSec: 89,
    audioUrl: sunoAudio('022d8ec1-d5e5-4c10-a0a3-222a2ec37b20'),
  },
];

export class SoundtrackEngine {
  private audio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private isMuted = false;
  private volume = 0.22;
  private currentTrackIndex = 0;
  private wantsPlayback = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const retry = () => {
        // Run after React's click/touch handler so a just-finished intro can
        // mark the soundtrack as wanted before we retry iOS autoplay.
        window.setTimeout(() => {
          if (this.wantsPlayback) void this.tryPlay();
        }, 0);
      };
      window.addEventListener('click', retry);
      window.addEventListener('touchend', retry);
      window.addEventListener('keydown', retry);
    }
  }

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.audio) {
      const audio = new Audio();
      audio.preload = 'auto';
      // Playlist mode: each song plays once, then advances automatically.
      audio.loop = false;
      audio.playsInline = true;
      audio.volume = this.volume;
      audio.muted = this.isMuted;
      audio.addEventListener('ended', () => {
        if (!this.wantsPlayback || SOUNDTRACK_TRACKS.length === 0) return;
        this.startTrack(this.currentTrackIndex + 1);
      });
      this.audio = audio;
    }
    return this.audio;
  }

  private notifyTrackChanged(index: number) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('ballknower-track-change', { detail: { index } }));
  }

  private async tryPlay() {
    const audio = this.ensureAudio();
    if (!audio || !this.wantsPlayback) return;
    try {
      await audio.play();
      this.isPlaying = true;
    } catch {
      // Safari/iOS may block playback until a user gesture. The listeners in
      // the constructor retry automatically on the next tap/key press.
      this.isPlaying = false;
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audio) this.audio.volume = this.volume;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.audio) this.audio.muted = muted;
  }

  public startTrack(index: number = 0) {
    const audio = this.ensureAudio();
    if (!audio || SOUNDTRACK_TRACKS.length === 0) return;

    const normalized = (index + SOUNDTRACK_TRACKS.length) % SOUNDTRACK_TRACKS.length;
    const track = SOUNDTRACK_TRACKS[normalized];
    const changed = this.currentTrackIndex !== normalized || audio.src !== track.audioUrl;

    this.currentTrackIndex = normalized;
    this.wantsPlayback = true;
    this.isPlaying = true;

    if (changed) {
      audio.pause();
      audio.src = track.audioUrl;
      audio.currentTime = 0;
      audio.load();
    }

    audio.loop = false;
    audio.volume = this.volume;
    audio.muted = this.isMuted;
    this.notifyTrackChanged(normalized);
    void this.tryPlay();
  }

  public stop() {
    this.wantsPlayback = false;
    this.isPlaying = false;
    if (this.audio) {
      this.audio.pause();
      try { this.audio.currentTime = 0; } catch {}
    }
  }

  public pause() {
    this.wantsPlayback = false;
    this.isPlaying = false;
    this.audio?.pause();
  }

  public resume() {
    this.wantsPlayback = true;
    this.isPlaying = true;
    if (!this.audio?.src) {
      this.startTrack(this.currentTrackIndex);
      return;
    }
    void this.tryPlay();
  }

  public nextTrack() {
    this.startTrack(this.currentTrackIndex + 1);
  }

  public prevTrack() {
    this.startTrack(this.currentTrackIndex - 1);
  }

  private initSfxContext(): AudioContext | null {
    if (typeof window === 'undefined' || this.isMuted) return null;
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, duration: number, gain = 0.12, delay = 0, type: OscillatorType = 'sine') {
    const ctx = this.initSfxContext();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    amp.gain.setValueAtTime(Math.max(0.0001, gain * Math.max(this.volume, 0.2)), start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  }

  public playDraftPickSound() {
    this.tone(523.25, 0.16, 0.18, 0, 'triangle');
    this.tone(659.25, 0.18, 0.17, 0.11, 'triangle');
    this.tone(783.99, 0.28, 0.16, 0.22, 'triangle');
  }

  public playRemovePlayerSound() {
    this.tone(330, 0.14, 0.11, 0, 'sine');
    this.tone(220, 0.22, 0.10, 0.09, 'sine');
  }

  public playRosterLockedSound() {
    this.tone(392, 0.16, 0.14, 0, 'square');
    this.tone(523.25, 0.18, 0.14, 0.10, 'square');
    this.tone(783.99, 0.30, 0.14, 0.20, 'triangle');
  }

  public playWarningSound() {
    this.tone(196, 0.16, 0.14, 0, 'sawtooth');
    this.tone(196, 0.16, 0.14, 0.22, 'sawtooth');
  }
}

export const globalSoundtrackEngine = new SoundtrackEngine();