import { NFL_TEAMS } from './players';

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
    id: 'war-room-draft-original',
    title: 'War Room Draft',
    subtitle: 'elifromthesouth • Original Instrumental',
    tempoBpm: 96,
    mood: 'On The Clock',
    durationSec: 89,
    audioUrl: sunoAudio('022d8ec1-d5e5-4c10-a0a3-222a2ec37b20'),
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
    id: 'fourth-quarter-king',
    title: 'Fourth Quarter King',
    subtitle: 'elifromthesouth • Original Ball Knower Track',
    tempoBpm: 100,
    mood: 'Fourth Quarter',
    durationSec: 191,
    audioUrl: sunoAudio('3d5afbae-7d13-406d-b6c4-bafb4a23c546'),
  },
  {
    id: 'fourth-down-smoke',
    title: 'Fourth Down Smoke',
    subtitle: 'elifromthesouth • Original Ball Knower Track',
    tempoBpm: 136,
    mood: 'Fourth Down',
    durationSec: 163,
    audioUrl: sunoAudio('af6a8af1-a07f-4285-8ea5-e238b3d88708'),
  },
  {
    id: 'end-zone-fever',
    title: 'End Zone Fever',
    subtitle: 'elifromthesouth • Original Ball Knower Track',
    tempoBpm: 99,
    mood: 'End Zone',
    durationSec: 164,
    audioUrl: sunoAudio('c5767de2-0804-4b2f-991b-b543972b6d42'),
  },
  {
    id: 'la-toma-perfecta',
    title: 'La Toma Perfecta',
    subtitle: 'elifromthesouth • Original Ball Knower Track',
    tempoBpm: 94,
    mood: 'Takeover',
    durationSec: 161,
    audioUrl: sunoAudio('32d9a614-83cd-4309-98d0-e09ad20efe7d'),
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

// ---------------------------------------------------------------------------
// Favorite NFL team personalization
// Lives in an already-loaded module so the current Vercel live-loader does not
// need another source file added to its whitelist.
// ---------------------------------------------------------------------------
const BK_FAVORITE_TEAM_KEY = 'ballknower_favorite_team_v1';
const BK_FAVORITE_TEAM_STYLE_ID = 'bk-favorite-team-styles';
const BK_FAVORITE_TEAM_BACKDROP_ID = 'bk-favorite-team-backdrop';
const BK_FAVORITE_TEAM_PICKER_ID = 'bk-favorite-team-picker';
const BK_TEAM_ORDER = [...NFL_TEAMS].sort((a, b) => `${a.conference}${a.division}${a.city}`.localeCompare(`${b.conference}${b.division}${b.city}`));
const BK_ESPN_LOGO_CODE: Record<string, string> = { WAS: 'wsh' };
let bkSelectedTeamIndex = Math.max(0, BK_TEAM_ORDER.findIndex(team => team.code === 'PHI'));
let bkPickerStage: 'wheel' | 'confirm' = 'wheel';
let bkThemeBeforePicker = '';
let bkSwipeStartX = 0;

function bkLogoUrl(code: string) {
  const slug = BK_ESPN_LOGO_CODE[code] || code.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${slug}.png`;
}

function bkTeamName(team: any) {
  return `${team.city} ${team.name}`;
}

function bkHexToRgb(hex: string) {
  const clean = String(hex || '#D4AF37').replace('#', '').trim();
  const value = clean.length === 3 ? clean.split('').map(x => x + x).join('') : clean.padEnd(6, '0').slice(0, 6);
  const n = parseInt(value, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function bkRgba(hex: string, alpha: number) {
  const { r, g, b } = bkHexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function bkEnsureTeamStyles() {
  if (document.getElementById(BK_FAVORITE_TEAM_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = BK_FAVORITE_TEAM_STYLE_ID;
  style.textContent = `
    @keyframes bkTeamBeamA{0%{transform:translate3d(-42vw,-15vh,0) rotate(-18deg)}50%{transform:translate3d(42vw,16vh,0) rotate(-18deg)}100%{transform:translate3d(-42vw,-15vh,0) rotate(-18deg)}}
    @keyframes bkTeamBeamB{0%{transform:translate3d(35vw,25vh,0) rotate(20deg)}50%{transform:translate3d(-38vw,-12vh,0) rotate(20deg)}100%{transform:translate3d(35vw,25vh,0) rotate(20deg)}}
    @keyframes bkTeamPulse{0%,100%{opacity:.45;transform:scale(.96)}50%{opacity:.78;transform:scale(1.035)}}
    @keyframes bkTeamSpin{to{transform:rotate(360deg)}}
    @keyframes bkTeamSpark{0%{opacity:0;transform:translate3d(0,20px,0) scale(.4)}25%{opacity:.8}100%{opacity:0;transform:translate3d(18px,-100px,0) scale(1.1)}}
    @keyframes bkTeamPickerIn{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:scale(1)}}
    #${BK_FAVORITE_TEAM_BACKDROP_ID}{position:fixed;inset:0;z-index:2;pointer-events:none;overflow:hidden;mix-blend-mode:screen;transition:background 650ms ease,opacity 650ms ease}
    #${BK_FAVORITE_TEAM_BACKDROP_ID} .bk-team-watermark{position:absolute;right:-12vw;top:17vh;width:min(78vw,720px);height:min(78vw,720px);object-fit:contain;opacity:.055;filter:drop-shadow(0 0 70px var(--bk-team-primary));animation:bkTeamPulse 6s ease-in-out infinite}
    #${BK_FAVORITE_TEAM_BACKDROP_ID} .bk-team-beam{position:absolute;width:28vw;height:160vh;top:-30vh;filter:blur(35px);opacity:.11;border-radius:999px}
    #${BK_FAVORITE_TEAM_BACKDROP_ID} .bk-team-beam.a{left:0;background:linear-gradient(180deg,transparent,var(--bk-team-primary),transparent);animation:bkTeamBeamA 13s ease-in-out infinite}
    #${BK_FAVORITE_TEAM_BACKDROP_ID} .bk-team-beam.b{right:0;background:linear-gradient(180deg,transparent,var(--bk-team-secondary),transparent);animation:bkTeamBeamB 16s ease-in-out infinite}
    #${BK_FAVORITE_TEAM_PICKER_ID}{position:fixed;inset:0;z-index:10000;overflow:auto;color:#fff;background:#030504;font-family:'Plus Jakarta Sans',system-ui,sans-serif;animation:bkTeamPickerIn .3s ease both;-webkit-overflow-scrolling:touch}
    #${BK_FAVORITE_TEAM_PICKER_ID} *{box-sizing:border-box}
    .bk-team-picker-bg{position:fixed;inset:0;pointer-events:none;overflow:hidden;background:radial-gradient(circle at 50% 30%,var(--bk-team-primary-soft),transparent 38%),radial-gradient(circle at 85% 15%,var(--bk-team-secondary-soft),transparent 36%),linear-gradient(180deg,#030504,#070807 62%,#030303)}
    .bk-team-picker-bg:before,.bk-team-picker-bg:after{content:'';position:absolute;width:22vw;height:160vh;top:-30vh;border-radius:999px;filter:blur(28px);opacity:.3;background:linear-gradient(180deg,transparent,var(--bk-team-primary),transparent)}
    .bk-team-picker-bg:before{left:0;animation:bkTeamBeamA 9s ease-in-out infinite}.bk-team-picker-bg:after{right:0;animation:bkTeamBeamB 11s ease-in-out infinite;background:linear-gradient(180deg,transparent,var(--bk-team-secondary),transparent)}
    .bk-team-picker-watermark{position:fixed;right:-22vw;top:7vh;width:min(105vw,760px);opacity:.095;filter:drop-shadow(0 0 50px var(--bk-team-primary));animation:bkTeamPulse 5s ease-in-out infinite}
    .bk-team-picker-shell{position:relative;z-index:2;width:min(100%,760px);min-height:100vh;margin:0 auto;padding:22px 16px 38px;display:flex;flex-direction:column}
    .bk-team-picker-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.bk-team-brand{font-family:'Barlow Condensed',sans-serif;font-size:30px;font-weight:950;letter-spacing:-.035em}.bk-team-brand b{color:#D4AF37}.bk-team-step{margin:20px auto 0;border:1px solid rgba(212,175,55,.26);border-radius:999px;background:rgba(4,8,7,.72);padding:8px 16px;font-size:9px;font-weight:900;letter-spacing:.22em;color:#a1a1aa;text-transform:uppercase;backdrop-filter:blur(12px)}
    .bk-team-title{margin:22px 0 0;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:clamp(42px,12vw,72px);line-height:.86;font-weight:950;text-transform:uppercase;letter-spacing:-.045em}.bk-team-title span{color:#D4AF37}.bk-team-sub{text-align:center;color:#a1a1aa;font-size:13px;margin:13px auto 0;max-width:440px}
    .bk-team-wheel{position:relative;height:330px;margin:16px -16px 0;overflow:hidden;touch-action:pan-y}.bk-team-wheel-card{position:absolute;left:50%;top:22px;width:220px;height:270px;border-radius:42px;border:1px solid rgba(255,255,255,.14);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px;background:linear-gradient(155deg,var(--card-primary),rgba(7,7,7,.95) 72%);box-shadow:inset 0 1px 0 rgba(255,255,255,.11),0 28px 80px rgba(0,0,0,.5);transition:transform .42s cubic-bezier(.2,.8,.2,1),opacity .35s ease,filter .35s ease,border-color .35s ease;transform-style:preserve-3d}.bk-team-wheel-card[data-offset='0']{transform:translateX(-50%) scale(1);z-index:5;border-color:var(--bk-team-primary);box-shadow:0 0 0 1px var(--bk-team-primary-soft),0 0 48px var(--bk-team-primary-soft),0 30px 75px rgba(0,0,0,.62)}.bk-team-wheel-card[data-offset='-1']{transform:translateX(calc(-50% - 155px)) scale(.72) rotateY(24deg);opacity:.82;z-index:4;filter:saturate(.7)}.bk-team-wheel-card[data-offset='1']{transform:translateX(calc(-50% + 155px)) scale(.72) rotateY(-24deg);opacity:.82;z-index:4;filter:saturate(.7)}.bk-team-wheel-card[data-offset='-2']{transform:translateX(calc(-50% - 250px)) scale(.5) rotateY(38deg);opacity:.36;z-index:2}.bk-team-wheel-card[data-offset='2']{transform:translateX(calc(-50% + 250px)) scale(.5) rotateY(-38deg);opacity:.36;z-index:2}.bk-team-wheel-logo{width:132px;height:132px;object-fit:contain;filter:drop-shadow(0 10px 22px rgba(0,0,0,.45))}.bk-team-wheel-code{display:none;width:120px;height:120px;align-items:center;justify-content:center;border-radius:50%;border:2px solid #D4AF37;color:#D4AF37;font-family:'Barlow Condensed';font-size:42px;font-weight:950}.bk-team-wheel-city{margin-top:13px;font-size:9px;font-weight:900;letter-spacing:.22em;color:#a1a1aa;text-transform:uppercase}.bk-team-wheel-name{font-family:'Barlow Condensed';font-size:25px;font-weight:950;text-transform:uppercase;line-height:1;text-align:center}.bk-team-wheel-controls{display:flex;align-items:center;justify-content:center;gap:28px;margin-top:-2px}.bk-team-round-btn{width:48px;height:48px;border-radius:999px;border:1px solid rgba(212,175,55,.42);background:rgba(8,8,8,.78);color:#D4AF37;font-size:25px;font-weight:800}.bk-team-count{min-width:80px;text-align:center;font:800 10px 'JetBrains Mono';color:#71717a;letter-spacing:.08em}
    .bk-team-selected{margin:16px auto 0;width:min(100%,570px);border:1px solid var(--bk-team-primary);border-radius:28px;background:linear-gradient(135deg,var(--bk-team-primary-soft),rgba(9,9,9,.88));padding:17px;text-align:center;backdrop-filter:blur(16px);box-shadow:0 0 35px var(--bk-team-primary-soft)}.bk-team-selected-eyebrow{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.22em;color:var(--bk-team-primary)}.bk-team-selected-name{font-family:'Barlow Condensed';font-size:34px;font-weight:950;line-height:1.05;margin-top:4px}.bk-team-primary-btn,.bk-team-secondary-btn,.bk-team-text-btn{border:0;font-family:'Plus Jakarta Sans';font-weight:950;text-transform:uppercase;letter-spacing:.1em}.bk-team-primary-btn{width:min(100%,570px);margin:14px auto 0;padding:19px 22px;border-radius:999px;background:linear-gradient(120deg,#F4C938,#D4AF37);color:#080808;font-size:13px;box-shadow:0 10px 42px rgba(212,175,55,.24)}.bk-team-secondary-btn{width:min(100%,570px);margin:10px auto 0;padding:17px 22px;border-radius:999px;border:1px solid var(--bk-team-primary);background:rgba(5,8,7,.76);color:#fff;font-size:12px;box-shadow:0 0 25px var(--bk-team-primary-soft)}.bk-team-text-btn{margin:12px auto 0;background:none;color:#71717a;font-size:10px;text-decoration:underline;text-underline-offset:4px}
    .bk-team-confirm-ring{position:relative;width:min(78vw,470px);aspect-ratio:1;margin:22px auto 0;border-radius:50%;display:grid;place-items:center;border:2px solid var(--bk-team-primary);background:radial-gradient(circle,var(--bk-team-primary-soft),rgba(5,5,5,.92) 64%);box-shadow:0 0 0 7px rgba(212,175,55,.05),0 0 60px var(--bk-team-primary-soft);overflow:visible}.bk-team-confirm-ring:before,.bk-team-confirm-ring:after{content:'';position:absolute;inset:-10px;border-radius:50%;border:2px solid transparent;border-top-color:#D4AF37;border-right-color:var(--bk-team-primary);animation:bkTeamSpin 8s linear infinite}.bk-team-confirm-ring:after{inset:-22px;opacity:.4;animation-duration:13s;animation-direction:reverse}.bk-team-confirm-logo{width:58%;height:58%;object-fit:contain;filter:drop-shadow(0 0 28px var(--bk-team-primary))}.bk-team-confirm-copy{text-align:center;margin-top:18px}.bk-team-confirm-copy small{display:block;font-size:9px;font-weight:900;letter-spacing:.25em;color:var(--bk-team-primary);text-transform:uppercase}.bk-team-confirm-copy h2{font-family:'Barlow Condensed';font-size:clamp(46px,13vw,72px);font-weight:950;line-height:.86;text-transform:uppercase;margin:7px 0 0}.bk-team-confirm-copy h3{font-family:'Barlow Condensed';font-size:32px;font-weight:900;color:#fff;margin:13px 0 0}.bk-team-chips{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:18px auto 0;width:min(100%,590px)}.bk-team-chip{border-radius:20px;border:1px solid rgba(255,255,255,.12);background:rgba(8,11,10,.7);padding:11px 7px;text-align:center;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#d4d4d8}.bk-team-chip b{display:block;color:var(--bk-team-primary);font-size:14px;margin-bottom:2px}.bk-team-note{text-align:center;color:#a1a1aa;font-size:11px;margin:14px auto 0;max-width:430px}.bk-team-note strong{color:#D4AF37}
    @media(max-width:430px){.bk-team-picker-shell{padding-left:12px;padding-right:12px}.bk-team-brand{font-size:26px}.bk-team-wheel{margin-left:-12px;margin-right:-12px;height:310px}.bk-team-wheel-card{width:205px;height:252px}.bk-team-wheel-card[data-offset='-1']{transform:translateX(calc(-50% - 137px)) scale(.68) rotateY(24deg)}.bk-team-wheel-card[data-offset='1']{transform:translateX(calc(-50% + 137px)) scale(.68) rotateY(-24deg)}.bk-team-wheel-card[data-offset='-2']{transform:translateX(calc(-50% - 220px)) scale(.46) rotateY(38deg)}.bk-team-wheel-card[data-offset='2']{transform:translateX(calc(-50% + 220px)) scale(.46) rotateY(-38deg)}.bk-team-wheel-logo{width:118px;height:118px}.bk-team-chips{grid-template-columns:repeat(3,minmax(0,1fr))}.bk-team-chip{padding:10px 4px;font-size:7px}}
    @media(prefers-reduced-motion:reduce){#${BK_FAVORITE_TEAM_BACKDROP_ID} *,#${BK_FAVORITE_TEAM_PICKER_ID} *{animation:none!important;transition:none!important}}
  `;
  document.head.appendChild(style);
}

function bkApplyTheme(teamCode: string) {
  bkEnsureTeamStyles();
  const existing = document.getElementById(BK_FAVORITE_TEAM_BACKDROP_ID);
  if (!teamCode || teamCode === 'NONE') {
    existing?.remove();
    document.documentElement.removeAttribute('data-bk-favorite-team');
    document.documentElement.style.removeProperty('--bk-team-primary');
    document.documentElement.style.removeProperty('--bk-team-secondary');
    document.documentElement.style.removeProperty('--bk-team-primary-soft');
    document.documentElement.style.removeProperty('--bk-team-secondary-soft');
    return;
  }
  const team = BK_TEAM_ORDER.find(item => item.code === teamCode);
  if (!team) return;
  const primary = team.primaryColor || '#D4AF37';
  const secondary = team.secondaryColor || '#A5ACAF';
  document.documentElement.setAttribute('data-bk-favorite-team', team.code);
  document.documentElement.style.setProperty('--bk-team-primary', primary);
  document.documentElement.style.setProperty('--bk-team-secondary', secondary);
  document.documentElement.style.setProperty('--bk-team-primary-soft', bkRgba(primary, .22));
  document.documentElement.style.setProperty('--bk-team-secondary-soft', bkRgba(secondary, .16));
  document.body.style.background = `radial-gradient(circle at 82% 14%,${bkRgba(primary,.22)},transparent 35%),radial-gradient(circle at 15% 80%,${bkRgba(secondary,.11)},transparent 35%),#050505`;
  let backdrop = existing;
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = BK_FAVORITE_TEAM_BACKDROP_ID;
    document.body.appendChild(backdrop);
  }
  backdrop.style.background = `radial-gradient(circle at 82% 18%,${bkRgba(primary,.14)},transparent 35%),radial-gradient(circle at 8% 78%,${bkRgba(secondary,.09)},transparent 40%)`;
  backdrop.innerHTML = `<div class="bk-team-beam a"></div><div class="bk-team-beam b"></div><img class="bk-team-watermark" src="${bkLogoUrl(team.code)}" alt="" />`;
  const header = document.querySelector<HTMLElement>('header');
  if (header) header.style.boxShadow = `0 12px 36px ${bkRgba(primary,.09)}`;
  window.dispatchEvent(new CustomEvent('ballknower-favorite-team-change', { detail: { code: team.code, team } }));
}

function bkSetPreviewVariables(team: any) {
  const primary = team.primaryColor || '#D4AF37';
  const secondary = team.secondaryColor || '#A5ACAF';
  document.documentElement.style.setProperty('--bk-team-primary', primary);
  document.documentElement.style.setProperty('--bk-team-secondary', secondary);
  document.documentElement.style.setProperty('--bk-team-primary-soft', bkRgba(primary, .24));
  document.documentElement.style.setProperty('--bk-team-secondary-soft', bkRgba(secondary, .16));
  bkApplyTheme(team.code);
}

function bkAttachLogoFallbacks(root: ParentNode) {
  for (const image of Array.from(root.querySelectorAll<HTMLImageElement>('img[data-bk-team-logo]'))) {
    if (image.dataset.bkFallbackBound === '1') continue;
    image.dataset.bkFallbackBound = '1';
    image.addEventListener('error', () => {
      image.style.display = 'none';
      const fallback = image.nextElementSibling as HTMLElement | null;
      if (fallback) fallback.style.display = 'flex';
    });
  }
}

function bkWheelCard(team: any, offset: number) {
  return `<button class="bk-team-wheel-card" type="button" data-offset="${offset}" data-team-index="${BK_TEAM_ORDER.indexOf(team)}" style="--card-primary:${team.primaryColor || '#222'}" aria-label="Choose ${bkTeamName(team)}"><img data-bk-team-logo class="bk-team-wheel-logo" src="${bkLogoUrl(team.code)}" alt="${bkTeamName(team)} logo"/><span class="bk-team-wheel-code">${team.code}</span><span class="bk-team-wheel-city">${team.city}</span><span class="bk-team-wheel-name">${team.name}</span></button>`;
}

function bkCurrentTeam() {
  return BK_TEAM_ORDER[(bkSelectedTeamIndex + BK_TEAM_ORDER.length) % BK_TEAM_ORDER.length];
}

function bkMoveWheel(delta: number) {
  bkSelectedTeamIndex = (bkSelectedTeamIndex + delta + BK_TEAM_ORDER.length) % BK_TEAM_ORDER.length;
  const team = bkCurrentTeam();
  bkSetPreviewVariables(team);
  bkRenderPicker();
  try { if ('vibrate' in navigator) navigator.vibrate(8); } catch {}
}

function bkRenderPicker() {
  const overlay = document.getElementById(BK_FAVORITE_TEAM_PICKER_ID);
  if (!overlay) return;
  const team = bkCurrentTeam();
  bkSetPreviewVariables(team);
  const commonTop = `<div class="bk-team-picker-bg"></div><img class="bk-team-picker-watermark" src="${bkLogoUrl(team.code)}" alt=""/><div class="bk-team-picker-shell"><div class="bk-team-picker-top"><button type="button" data-bk-close-team-picker class="bk-team-round-btn" aria-label="Close">‹</button><div class="bk-team-brand">BALL <b>KNOWER</b></div><div style="width:48px;height:48px;border:1px solid rgba(212,175,55,.35);border-radius:50%;display:grid;place-items:center;color:#D4AF37;font-size:22px">🏆</div></div>`;
  if (bkPickerStage === 'wheel') {
    const slots = [-2, -1, 0, 1, 2].map(offset => {
      const index = (bkSelectedTeamIndex + offset + BK_TEAM_ORDER.length) % BK_TEAM_ORDER.length;
      return bkWheelCard(BK_TEAM_ORDER[index], offset);
    }).join('');
    overlay.innerHTML = `${commonTop}<div class="bk-team-step">Step 2 • Favorite Team</div><h1 class="bk-team-title">CHOOSE <span>YOUR TEAM.</span></h1><p class="bk-team-sub">Swipe the wheel. Preview the colors. Lock in your squad.</p><div class="bk-team-wheel" data-bk-team-wheel>${slots}</div><div class="bk-team-wheel-controls"><button type="button" class="bk-team-round-btn" data-bk-team-prev>‹</button><div class="bk-team-count">${String(bkSelectedTeamIndex + 1).padStart(2, '0')} / 32</div><button type="button" class="bk-team-round-btn" data-bk-team-next>›</button></div><div class="bk-team-selected"><div class="bk-team-selected-eyebrow">Your Favorite Team</div><div class="bk-team-selected-name">${bkTeamName(team)}</div></div><button type="button" class="bk-team-primary-btn" data-bk-team-lock>LOCK IN ${team.name} →</button><button type="button" class="bk-team-text-btn" data-bk-team-skip>Skip for now</button></div>`;
  } else {
    overlay.innerHTML = `${commonTop}<div class="bk-team-step"><span style="color:var(--bk-team-primary)">Step 3</span> • Confirm Favorite Team</div><div class="bk-team-confirm-copy"><small>Your team is</small><h2>LOCKED IN</h2></div><div class="bk-team-confirm-ring"><img data-bk-team-logo class="bk-team-confirm-logo" src="${bkLogoUrl(team.code)}" alt="${bkTeamName(team)} logo"/><span class="bk-team-wheel-code">${team.code}</span></div><div class="bk-team-confirm-copy" style="margin-top:10px"><h3>${bkTeamName(team)}</h3><div style="margin-top:5px;color:#a1a1aa;font-size:12px">Is this your favorite team?</div></div><div class="bk-team-chips"><div class="bk-team-chip"><b>◉</b>Favorite Theme</div><div class="bk-team-chip"><b>✦</b>Custom Background</div><div class="bk-team-chip"><b>✓</b>Team Mode</div></div><p class="bk-team-note">This theme will personalize your <strong>Ball Knower</strong> experience.</p><button type="button" class="bk-team-primary-btn" data-bk-team-confirm>CONFIRM ${team.name} →</button><button type="button" class="bk-team-secondary-btn" data-bk-team-again>↻ &nbsp; SPIN AGAIN</button><button type="button" class="bk-team-text-btn" data-bk-team-skip>Skip for now</button></div>`;
  }
  bkAttachPickerEvents(overlay);
  bkAttachLogoFallbacks(overlay);
}

function bkClosePicker(restoreBefore = false) {
  document.getElementById(BK_FAVORITE_TEAM_PICKER_ID)?.remove();
  if (restoreBefore) bkApplyTheme(bkThemeBeforePicker);
}

function bkConfirmFavoriteTeam() {
  const team = bkCurrentTeam();
  try { localStorage.setItem(BK_FAVORITE_TEAM_KEY, team.code); } catch {}
  bkApplyTheme(team.code);
  bkClosePicker(false);
  try { if ('vibrate' in navigator) navigator.vibrate([24, 35, 55]); } catch {}
}

function bkSkipFavoriteTeam() {
  try { localStorage.setItem(BK_FAVORITE_TEAM_KEY, 'NONE'); } catch {}
  bkApplyTheme('NONE');
  bkClosePicker(false);
}

function bkAttachPickerEvents(overlay: HTMLElement) {
  overlay.querySelector<HTMLElement>('[data-bk-team-prev]')?.addEventListener('click', () => bkMoveWheel(-1));
  overlay.querySelector<HTMLElement>('[data-bk-team-next]')?.addEventListener('click', () => bkMoveWheel(1));
  overlay.querySelector<HTMLElement>('[data-bk-team-lock]')?.addEventListener('click', () => { bkPickerStage = 'confirm'; bkRenderPicker(); });
  overlay.querySelector<HTMLElement>('[data-bk-team-confirm]')?.addEventListener('click', bkConfirmFavoriteTeam);
  overlay.querySelector<HTMLElement>('[data-bk-team-again]')?.addEventListener('click', () => { bkPickerStage = 'wheel'; bkRenderPicker(); });
  overlay.querySelector<HTMLElement>('[data-bk-team-skip]')?.addEventListener('click', bkSkipFavoriteTeam);
  overlay.querySelector<HTMLElement>('[data-bk-close-team-picker]')?.addEventListener('click', () => bkClosePicker(true));
  for (const card of Array.from(overlay.querySelectorAll<HTMLElement>('[data-team-index]'))) {
    card.addEventListener('click', () => {
      const index = Number(card.dataset.teamIndex);
      if (!Number.isFinite(index)) return;
      bkSelectedTeamIndex = index;
      bkPickerStage = 'wheel';
      bkRenderPicker();
    });
  }
  const wheel = overlay.querySelector<HTMLElement>('[data-bk-team-wheel]');
  if (wheel) {
    wheel.addEventListener('touchstart', event => { bkSwipeStartX = event.touches[0]?.clientX || 0; }, { passive: true });
    wheel.addEventListener('touchend', event => {
      const end = event.changedTouches[0]?.clientX || 0;
      const delta = end - bkSwipeStartX;
      if (Math.abs(delta) > 42) bkMoveWheel(delta > 0 ? -1 : 1);
    }, { passive: true });
  }
}

function bkOpenFavoriteTeamPicker() {
  bkEnsureTeamStyles();
  if (document.getElementById(BK_FAVORITE_TEAM_PICKER_ID)) return;
  try { bkThemeBeforePicker = localStorage.getItem(BK_FAVORITE_TEAM_KEY) || ''; } catch { bkThemeBeforePicker = ''; }
  const savedIndex = BK_TEAM_ORDER.findIndex(team => team.code === bkThemeBeforePicker);
  bkSelectedTeamIndex = savedIndex >= 0 ? savedIndex : Math.max(0, BK_TEAM_ORDER.findIndex(team => team.code === 'PHI'));
  bkPickerStage = 'wheel';
  const overlay = document.createElement('div');
  overlay.id = BK_FAVORITE_TEAM_PICKER_ID;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const cleanup = new MutationObserver(() => {
    if (!document.getElementById(BK_FAVORITE_TEAM_PICKER_ID)) {
      document.body.style.overflow = '';
      cleanup.disconnect();
    }
  });
  cleanup.observe(document.body, { childList: true });
  bkRenderPicker();
}

function bkInstallProfileFavoriteTeamButton() {
  const profileButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button => String(button.textContent || '').includes('Profile & Rankings'));
  if (!profileButton || document.getElementById('bk-favorite-team-menu-button')) return;
  const parent = profileButton.parentElement;
  if (!parent) return;
  let stored = '';
  try { stored = localStorage.getItem(BK_FAVORITE_TEAM_KEY) || ''; } catch {}
  const team = BK_TEAM_ORDER.find(item => item.code === stored);
  const button = document.createElement('button');
  button.id = 'bk-favorite-team-menu-button';
  button.className = profileButton.className;
  button.innerHTML = `<span style="width:14px;height:14px;display:grid;place-items:center;overflow:hidden"><img data-bk-team-logo src="${team ? bkLogoUrl(team.code) : ''}" alt="" style="width:14px;height:14px;object-fit:contain;${team ? '' : 'display:none'}"/><span style="display:${team ? 'none' : 'inline'};color:#D4AF37">★</span></span><span>${team ? `Favorite Team: ${team.name}` : 'Choose Favorite Team'}</span>`;
  button.addEventListener('click', event => { event.preventDefault(); bkOpenFavoriteTeamPicker(); });
  parent.insertBefore(button, profileButton);
  bkAttachLogoFallbacks(button);
}

function bkStartFavoriteTeamSystem() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  bkEnsureTeamStyles();
  let stored = '';
  try { stored = localStorage.getItem(BK_FAVORITE_TEAM_KEY) || ''; } catch {}
  if (stored) bkApplyTheme(stored);
  const root = document.getElementById('root');
  if (root) {
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        bkInstallProfileFavoriteTeamButton();
        if (stored && stored !== 'NONE') bkApplyTheme(stored);
      });
    });
    observer.observe(root, { childList: true, subtree: true });
  }
  window.addEventListener('ballknower-open-team-picker', bkOpenFavoriteTeamPicker);
  window.setTimeout(() => {
    bkInstallProfileFavoriteTeamButton();
    if (!stored) bkOpenFavoriteTeamPicker();
  }, 900);
}

if (typeof window !== 'undefined') window.setTimeout(bkStartFavoriteTeamSystem, 0);
