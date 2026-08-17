import React, { useState, useEffect } from 'react';
import { BallKnowerProvider, useBallKnower } from './BallKnowerContext';
import { SoundtrackProvider, useSoundtrack } from './SoundtrackContext';
import { Navbar } from './Navbar';
import { HomeDashboard } from './HomeDashboard';
import { LeagueLobby } from './LeagueLobby';
import { DraftRoom } from './DraftRoom';
import { SimulationView } from './SimulationView';
import { AuthModal } from './AuthModal';
import { CreateLeagueModal } from './CreateLeagueModal';
import { JoinLeagueModal } from './JoinLeagueModal';
import { CinematicIntro } from './CinematicIntro';
import { DatabaseVerificationModal } from './DatabaseVerificationModal';
import { SoloMode } from './SoloMode';
import { HallOfFame } from './HallOfFame';
import { League } from './types';
import {
  CheckCircle2,
  Play,
  Database,
  ChevronRight,
  Trophy,
  Users,
  User,
  DollarSign,
  Brain,
  CalendarDays,
} from 'lucide-react';

function WelcomeScreen({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070707] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.13),transparent_45%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-8 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.35em] text-[#D4AF37]">BALL KNOWER</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">NFL Team Building Simulator</div>
          </div>
          <div className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-[#D4AF37]">2026 Season</div>
        </div>

        <div className="mx-auto mt-10 max-w-4xl text-center sm:mt-14">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-[#D4AF37]">🏈 Prove You Know Ball</div>
          <h1 className="text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            Build A Team.<br /><span className="text-[#D4AF37]">Prove It Can Win.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-sm font-medium leading-6 text-zinc-400 sm:text-base">
            Ball Knower is simple: draft real NFL players, stay under the salary cap, then simulate a full season to see if your football knowledge actually builds a winner.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: DollarSign, step: '01', title: 'Draft', text: 'Choose current NFL players while staying under the salary cap.' },
            { icon: Brain, step: '02', title: 'Build Smart', text: 'Ratings, positions, depth and roster balance all matter.' },
            { icon: CalendarDays, step: '03', title: 'Sim 17 Games', text: 'Your roster plays through a complete NFL regular season.' },
            { icon: Trophy, step: '04', title: 'Win It All', text: 'Make the playoffs, survive the postseason and chase a title.' },
          ].map(({ icon: Icon, step, title, text }) => (
            <div key={step} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10"><Icon className="h-5 w-5 text-[#D4AF37]" /></div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">Step {step}</div>
              <h3 className="mt-2 text-xl font-black uppercase">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-zinc-500">{text}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-7 grid w-full max-w-4xl gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-[#101010] p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5"><User className="h-5 w-5 text-[#D4AF37]" /></div>
            <div><div className="text-sm font-black uppercase">Solo Mode</div><div className="mt-1 text-[11px] text-zinc-500">Draft your own team and see how far you can take it.</div></div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-[#101010] p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5"><Users className="h-5 w-5 text-[#D4AF37]" /></div>
            <div><div className="text-sm font-black uppercase">Play With Friends</div><div className="mt-1 text-[11px] text-zinc-500">Build competing teams and find out who actually knows ball.</div></div>
          </div>
        </div>

        <div className="mx-auto mt-8 w-full max-w-xl text-center">
          <button onClick={onEnter} className="group flex w-full items-center justify-center gap-3 rounded-xl bg-[#D4AF37] px-8 py-5 text-sm font-black uppercase tracking-[0.2em] text-black shadow-[0_0_40px_rgba(212,175,55,0.15)] transition-all hover:scale-[1.01] hover:bg-[#E7C75B]">
            Enter Ball Knower <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </button>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">No fantasy points. No weekly lineups. Just build the best football team.</p>
        </div>
      </div>
    </div>
  );
}

function BallKnowerApp() {
  const { activeLeague, setActiveLeagueId, toastMessage, joinLeague } = useBallKnower();
  const { setIntroActive } = useSoundtrack();

  const [currentTab, setCurrentTab] = useState<'home' | 'solo' | 'legacy' | 'lobby' | 'draft' | 'simulation'>('home');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreateLeagueOpen, setIsCreateLeagueOpen] = useState(false);
  const [isJoinLeagueOpen, setIsJoinLeagueOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [isIntroOpen, setIsIntroOpen] = useState(true);
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    setIntroActive(isIntroOpen);
  }, [isIntroOpen, setIntroActive]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const joinCode = params.get('join');
      if (joinCode) {
        joinLeague(joinCode).then(res => {
          if (res.success && res.league) {
            setShowWelcome(false);
            setCurrentTab('lobby');
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSelectLeague = (league: League, tab: 'lobby' | 'draft' | 'simulation') => {
    setActiveLeagueId(league.id);
    setCurrentTab(tab);
  };

  const handleLeagueCreated = (league: League) => {
    setActiveLeagueId(league.id);
    setCurrentTab('lobby');
  };

  const handleLeagueJoined = (league: League) => {
    setActiveLeagueId(league.id);
    setCurrentTab('lobby');
  };

  return (
    <>
      <CinematicIntro isOpen={isIntroOpen} onClose={() => setIsIntroOpen(false)} />

      {!isIntroOpen && showWelcome ? (
        <WelcomeScreen onEnter={() => setShowWelcome(false)} />
      ) : !isIntroOpen ? (
        <div className="min-h-screen bg-[#0A0A0A] text-white font-sans antialiased selection:bg-[#D4AF37]/30 selection:text-[#D4AF37] flex flex-col justify-between">
          <Navbar
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenCreateLeague={() => setIsCreateLeagueOpen(true)}
            onOpenJoinLeague={() => setIsJoinLeagueOpen(true)}
            onOpenIntro={() => {
              setShowWelcome(true);
              setIsIntroOpen(true);
            }}
            onOpenDatabaseModal={() => setIsDatabaseModalOpen(true)}
          />

          <main className="w-full flex-1">
            {currentTab === 'home' && <HomeDashboard onOpenCreateLeague={() => setIsCreateLeagueOpen(true)} onOpenJoinLeague={() => setIsJoinLeagueOpen(true)} onSelectLeague={handleSelectLeague} />}
            {currentTab === 'solo' && <SoloMode />}
            {currentTab === 'legacy' && <HallOfFame />}
            {currentTab === 'lobby' && activeLeague && <LeagueLobby league={activeLeague} onGoToDraft={() => setCurrentTab('draft')} onGoToSimulation={() => setCurrentTab('simulation')} />}
            {currentTab === 'draft' && <DraftRoom onBackToLobby={() => setCurrentTab(activeLeague ? 'lobby' : 'home')} onSubmitSuccess={() => setCurrentTab(activeLeague ? 'lobby' : 'home')} />}
            {currentTab === 'simulation' && activeLeague && <SimulationView league={activeLeague} onBackToLobby={() => setCurrentTab('lobby')} />}
          </main>

          <footer className="border-t border-white/5 bg-[#080808] px-6 sm:px-8 py-4 text-[10px] uppercase font-bold tracking-widest text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[#D4AF37]">PROVE YOU KNOW BALL.</span>
              <span>© 2026 BALL KNOWER NFL CAP ENGINE</span>
              <button onClick={() => { setShowWelcome(true); setIsIntroOpen(true); }} className="flex items-center gap-1 text-[#D4AF37] hover:text-white transition-colors cursor-pointer border-b border-[#D4AF37]/30">
                <Play className="h-2.5 w-2.5 fill-[#D4AF37]" /><span>Replay Intro Video</span>
              </button>
              <button onClick={() => setIsDatabaseModalOpen(true)} className="flex items-center gap-1 text-[#00FF00] hover:text-white transition-colors cursor-pointer border-b border-[#00FF00]/30">
                <Database className="h-2.5 w-2.5 text-[#00FF00]" /><span>32/32 Rosters Verified (2026 Season)</span>
              </button>
            </div>
            <div className="flex items-center gap-4 text-zinc-600 font-mono-numbers">
              <span>NFL SEASON: <span className="text-[#D4AF37]">2026</span></span>
              <span>STATUS: <span className="text-[#00FF00]">ACTIVE</span></span>
              <span>17-GAME SOLO + LEAGUE SIM</span>
              <span>V1.0 GAME BUILD</span>
            </div>
          </footer>

          <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
          <CreateLeagueModal isOpen={isCreateLeagueOpen} onClose={() => setIsCreateLeagueOpen(false)} onLeagueCreated={handleLeagueCreated} />
          <JoinLeagueModal isOpen={isJoinLeagueOpen} onClose={() => setIsJoinLeagueOpen(false)} onLeagueJoined={handleLeagueJoined} />
          <DatabaseVerificationModal isOpen={isDatabaseModalOpen} onClose={() => setIsDatabaseModalOpen(false)} />

          {toastMessage && (
            <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-md border border-[#D4AF37]/50 bg-[#121212] px-4 py-3 text-xs font-bold text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200">
              <CheckCircle2 className="h-4 w-4 text-[#D4AF37] shrink-0" /><span>{toastMessage}</span>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

export default function App() {
  return (
    <SoundtrackProvider>
      <BallKnowerProvider>
        <BallKnowerApp />
      </BallKnowerProvider>
    </SoundtrackProvider>
  );
}
