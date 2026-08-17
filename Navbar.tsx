import React, { useState } from 'react';
import { useBallKnower } from '../context/BallKnowerContext';
import {
  Trophy,
  Shield,
  User,
  LogOut,
  ChevronDown,
  Sparkles,
  Plus,
  Users,
  Award,
  Play,
  Newspaper,
} from 'lucide-react';
import { SoundtrackControl } from './SoundtrackControl';

interface NavbarProps {
  currentTab: 'home' | 'solo' | 'news' | 'fantasy' | 'legacy' | 'lobby' | 'draft' | 'simulation';
  setCurrentTab: (tab: 'home' | 'solo' | 'news' | 'fantasy' | 'legacy' | 'lobby' | 'draft' | 'simulation') => void;
  onOpenAuth: () => void;
  onOpenCreateLeague: () => void;
  onOpenJoinLeague: () => void;
  onOpenIntro?: () => void;
  onOpenDatabaseModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenAuth,
  onOpenCreateLeague,
  onOpenJoinLeague,
  onOpenIntro,
  onOpenDatabaseModal,
}) => {
  const {
    currentUser,
    logout,
    activeLeague,
    isDemoMode,
    exitDemoMode,
    currentRoster,
    leagues,
    setActiveLeagueId,
  } = useBallKnower();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLeagueMenuOpen, setIsLeagueMenuOpen] = useState(false);

  const tabClass = (active: boolean) =>
    `text-xs font-black uppercase tracking-widest h-full flex items-center gap-1.5 whitespace-nowrap transition-colors ${
      active ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'text-zinc-500 hover:text-white'
    }`;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#D4AF37]/20 bg-[#121212]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button
            id="nav-logo-btn"
            onClick={() => setCurrentTab('home')}
            className="group shrink-0 text-left focus:outline-none"
          >
            <h1 className="font-display text-2xl font-black tracking-tighter text-white transition-colors group-hover:text-zinc-200 sm:text-3xl">
              BALL <span className="text-[#D4AF37]">KNOWER</span>
            </h1>
            <div className="hidden text-[8px] font-black uppercase tracking-[.2em] text-zinc-600 sm:block">
              Fantasy Football Platform
            </div>
          </button>

          {isDemoMode && (
            <div className="hidden items-center gap-1.5 border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-1 text-[9px] font-black uppercase text-[#D4AF37] md:flex">
              <Sparkles className="h-3 w-3" /> Demo
              <button onClick={exitDemoMode} className="ml-1 text-zinc-400 underline hover:text-white">Exit</button>
            </div>
          )}

          {onOpenDatabaseModal && (
            <button
              onClick={onOpenDatabaseModal}
              title="View the 2026 roster validation report"
              className="hidden items-center gap-1.5 border border-green-500/25 bg-green-500/5 px-2 py-1 text-[9px] font-black uppercase text-green-400 hover:bg-green-500/10 lg:flex"
            >
              <Shield className="h-3 w-3" /> 32/32 Rosters
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          {activeLeague && (
            <div className="relative hidden sm:block">
              <button
                id="league-dropdown-btn"
                onClick={() => setIsLeagueMenuOpen(!isLeagueMenuOpen)}
                className="flex items-center gap-1.5 border border-white/10 bg-[#1A1A1A] px-2.5 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-200 transition-colors hover:border-[#D4AF37]/50"
              >
                <Trophy className="h-3.5 w-3.5 text-[#D4AF37]" />
                <span className="max-w-[125px] truncate">Challenge: {activeLeague.name}</span>
                <ChevronDown className="h-3 w-3 text-zinc-500" />
              </button>

              {isLeagueMenuOpen && (
                <div
                  className="absolute right-0 z-50 mt-2 w-72 border border-white/10 bg-[#121212] p-2 shadow-2xl"
                  onClick={() => setIsLeagueMenuOpen(false)}
                >
                  <div className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    Draft Order Challenges
                  </div>
                  <div className="my-1 max-h-48 space-y-1 overflow-y-auto">
                    {leagues.map(l => (
                      <button
                        key={l.id}
                        onClick={() => {
                          setActiveLeagueId(l.id);
                          setCurrentTab(l.status === 'completed' ? 'simulation' : 'lobby');
                        }}
                        className={`flex w-full items-center justify-between px-2.5 py-2 text-left text-xs ${
                          l.id === activeLeague.id
                            ? 'border border-[#D4AF37]/30 bg-[#D4AF37]/10 font-bold text-[#D4AF37]'
                            : 'text-zinc-300 hover:bg-[#1A1A1A]'
                        }`}
                      >
                        <span className="truncate font-bold uppercase">{l.name}</span>
                        <span className="font-mono text-[9px] text-zinc-500">{l.code}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 flex gap-1 border-t border-white/10 pt-2">
                    <button onClick={onOpenCreateLeague} className="flex flex-1 items-center justify-center gap-1 bg-[#1A1A1A] py-2 text-[9px] font-black uppercase text-zinc-200 hover:bg-zinc-800">
                      <Plus className="h-3 w-3 text-[#D4AF37]" /> Challenge
                    </button>
                    <button onClick={onOpenJoinLeague} className="flex flex-1 items-center justify-center gap-1 bg-[#1A1A1A] py-2 text-[9px] font-black uppercase text-zinc-200 hover:bg-zinc-800">
                      <Users className="h-3 w-3 text-[#D4AF37]" /> Join
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <SoundtrackControl />

          {currentUser ? (
            <div className="relative">
              <button
                id="user-profile-btn"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center rounded-full border-2 border-[#D4AF37] p-0.5 transition-all hover:ring-2 hover:ring-[#D4AF37]/40"
              >
                <div className="h-8 w-8 overflow-hidden rounded-full bg-zinc-800 sm:h-9 sm:w-9">
                  <img
                    src={currentUser.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Elijah'}
                    alt={currentUser.name}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </button>

              {isUserMenuOpen && (
                <div
                  className="absolute right-0 z-50 mt-2 w-60 border border-white/10 bg-[#121212] p-2 shadow-2xl"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  <div className="border-b border-white/5 px-3 py-2">
                    <p className="truncate text-xs font-black uppercase text-white">{currentUser.name}</p>
                    <p className="truncate font-mono text-[9px] uppercase text-zinc-500">{currentUser.email}</p>
                  </div>
                  <div className="py-1">
                    <MenuButton icon={<Users className="h-3.5 w-3.5 text-[#D4AF37]" />} label="Fantasy Leagues" onClick={() => setCurrentTab('fantasy')} />
                    <MenuButton icon={<Trophy className="h-3.5 w-3.5 text-[#D4AF37]" />} label="Overview & Challenges" onClick={() => setCurrentTab('home')} />
                    <MenuButton icon={<Play className="h-3.5 w-3.5 text-[#D4AF37]" />} label="Solo Franchise" onClick={() => setCurrentTab('solo')} />
                    <MenuButton icon={<Newspaper className="h-3.5 w-3.5 text-[#D4AF37]" />} label="NFL Wire" onClick={() => setCurrentTab('news')} />
                    <MenuButton icon={<User className="h-3.5 w-3.5 text-[#D4AF37]" />} label="Profile & Rankings" onClick={() => setCurrentTab('legacy')} />
                    {onOpenIntro && <MenuButton icon={<Play className="h-3.5 w-3.5 text-[#D4AF37]" />} label="Watch Intro Video" onClick={onOpenIntro} />}
                    <MenuButton icon={<User className="h-3.5 w-3.5 text-[#D4AF37]" />} label="Switch Account" onClick={onOpenAuth} />
                  </div>
                  <div className="border-t border-white/5 pt-1">
                    <button onClick={logout} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/10">
                      <LogOut className="h-3.5 w-3.5" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button id="sign-in-btn" onClick={onOpenAuth} className="bg-[#D4AF37] px-4 py-2 text-xs font-black uppercase text-black hover:bg-amber-300">Sign In</button>
          )}
        </div>
      </div>

      <nav className="flex h-11 items-center border-b border-white/5 bg-[#1A1A1A] px-4 sm:h-12 sm:px-8">
        <div className="flex h-full items-center gap-4 overflow-x-auto no-scrollbar sm:gap-8">
          <button id="nav-tab-home" onClick={() => setCurrentTab('home')} className={tabClass(currentTab === 'home')}>Overview</button>

          <button id="nav-tab-fantasy" onClick={() => setCurrentTab('fantasy')} className={tabClass(currentTab === 'fantasy')}>
            <Users className="h-3.5 w-3.5" />
            <span>Fantasy</span>
            <span className="bg-[#D4AF37] px-1 py-0.5 text-[7px] leading-none text-black">MAIN</span>
          </button>

          <button id="nav-tab-solo-mobile" onClick={() => setCurrentTab('solo')} className={tabClass(currentTab === 'solo')}>
            <Play className="h-3.5 w-3.5" /> Solo
          </button>

          <button id="nav-tab-news" onClick={() => setCurrentTab('news')} className={tabClass(currentTab === 'news')}>
            <Newspaper className="h-3.5 w-3.5" /> News
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          </button>

          <button id="nav-tab-profile" onClick={() => setCurrentTab('legacy')} className={tabClass(currentTab === 'legacy')}>
            <Trophy className="h-3.5 w-3.5" /> Profile
          </button>

          {activeLeague && (
            <>
              <span className="h-5 w-px shrink-0 bg-white/10" />
              <button id="tab-lobby-btn" onClick={() => setCurrentTab('lobby')} className={tabClass(currentTab === 'lobby')}>
                Challenge Lobby ({activeLeague.members.length}/{activeLeague.maxMembers})
              </button>
              <button id="tab-draft-btn" onClick={() => setCurrentTab('draft')} className={tabClass(currentTab === 'draft')}>
                <span>Challenge Team</span>
                <span className={`px-1.5 py-0.5 font-mono text-[9px] font-black ${currentRoster.length === 20 ? 'bg-green-400 text-black' : 'border border-[#D4AF37]/30 bg-[#121212] text-[#D4AF37]'}`}>
                  {currentRoster.length}/20
                </span>
              </button>
              {activeLeague.status === 'completed' && (
                <button id="tab-results-btn" onClick={() => setCurrentTab('simulation')} className={tabClass(currentTab === 'simulation')}>
                  <Award className="h-3.5 w-3.5" /> Earned Draft Order
                </button>
              )}
            </>
          )}
        </div>
      </nav>
    </header>
  );
};

const MenuButton = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <button onClick={onClick} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-300 hover:bg-[#1A1A1A] hover:text-white">
    {icon}
    <span>{label}</span>
  </button>
);
