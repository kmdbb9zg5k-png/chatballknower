import React, { useState } from 'react';
import { useBallKnower } from '../context/BallKnowerContext';
import { Trophy, Shield, User, LogOut, ChevronDown, Sparkles, Plus, Users, Award, Play, Newspaper } from 'lucide-react';
import { SoundtrackControl } from './SoundtrackControl';

interface NavbarProps {
  currentTab: 'home' | 'solo' | 'news' | 'legacy' | 'lobby' | 'draft' | 'simulation';
  setCurrentTab: (tab: 'home' | 'solo' | 'news' | 'legacy' | 'lobby' | 'draft' | 'simulation') => void;
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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#D4AF37]/20 bg-[#121212]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 sm:h-20 max-w-7xl items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-4 min-w-0">
          <button id="nav-logo-btn" onClick={() => setCurrentTab('home')} className="group flex items-baseline gap-3 text-left focus:outline-none shrink-0">
            <div className="flex items-baseline space-x-2">
              <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tighter text-white group-hover:text-zinc-200 transition-colors">
                BALL <span className="text-[#D4AF37]">KNOWER</span>
              </h1>
              {activeLeague ? (
                <span className="hidden md:inline text-[10px] uppercase tracking-widest text-zinc-500 font-bold">LEAGUE: <span className="text-zinc-300">{activeLeague.name}</span></span>
              ) : (
                <span className="hidden md:inline text-[10px] uppercase tracking-widest text-zinc-500 font-bold">NFL CAP SIMULATOR</span>
              )}
            </div>
          </button>

          <button onClick={() => setCurrentTab('solo')} className={`hidden sm:flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[11px] font-black uppercase tracking-wider border transition-all ${currentTab === 'solo'?'bg-[#D4AF37] text-black border-[#D4AF37]':'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/30 hover:bg-[#D4AF37]/20'}`}>
            <Play className="h-3.5 w-3.5" /> Solo Road to Super Bowl
          </button>

          <button onClick={() => setCurrentTab('legacy')} className={`hidden md:flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[11px] font-black uppercase tracking-wider border transition-all ${currentTab === 'legacy'?'bg-white text-black border-white':'bg-white/5 text-zinc-300 border-white/10 hover:border-[#D4AF37]/50'}`}>
            <Trophy className="h-3.5 w-3.5" /> Hall of Fame
          </button>

          {isDemoMode && <div className="flex items-center gap-1.5 rounded-sm bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#D4AF37]"><Sparkles className="h-3 w-3"/><span>Demo</span><button onClick={exitDemoMode} className="ml-1 text-zinc-400 hover:text-white underline text-[9px]">Exit</button></div>}

          {onOpenDatabaseModal && <button onClick={onOpenDatabaseModal} title="Click to view 2026 Master Database Validation Report" className="hidden lg:flex items-center gap-1.5 rounded-sm bg-[#00FF00]/10 border border-[#00FF00]/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#00FF00] hover:bg-[#00FF00]/20 transition-all cursor-pointer"><Shield className="h-3 w-3"/><span>32/32 NFL Rosters Verified</span></button>}
        </div>

        <div className="flex items-center space-x-3 sm:space-x-6 shrink-0">
          {activeLeague && <div className="flex items-center space-x-4">
            <div className="hidden sm:block text-right"><div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Draft Code</div><div className="font-mono text-[#D4AF37] text-base sm:text-lg font-bold leading-tight">{activeLeague.code}</div></div>
            <div className="relative">
              <button id="league-dropdown-btn" onClick={() => setIsLeagueMenuOpen(!isLeagueMenuOpen)} className="flex items-center gap-1.5 rounded-sm border border-white/10 bg-[#1A1A1A] px-2.5 py-1 text-xs font-bold text-zinc-200 hover:border-[#D4AF37]/50 transition-colors uppercase tracking-wider">
                <Trophy className="h-3.5 w-3.5 text-[#D4AF37]"/><span className="max-w-[90px] sm:max-w-[160px] truncate">{activeLeague.name}</span><ChevronDown className="h-3 w-3 text-zinc-400"/>
              </button>
              {isLeagueMenuOpen && <div className="absolute right-0 mt-2 w-64 rounded-sm border border-white/10 bg-[#121212] p-2 shadow-2xl z-50" onClick={() => setIsLeagueMenuOpen(false)}>
                <div className="px-2 py-1 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Your Leagues</div>
                <div className="max-h-48 overflow-y-auto space-y-1 my-1">{leagues.map(l=><button key={l.id} onClick={()=>{setActiveLeagueId(l.id);setCurrentTab(l.status==='completed'?'simulation':'lobby')}} className={`w-full flex items-center justify-between rounded-sm px-2.5 py-2 text-left text-xs transition-colors ${l.id===activeLeague.id?'bg-[#D4AF37]/10 text-[#D4AF37] font-bold border border-[#D4AF37]/30':'text-zinc-300 hover:bg-[#1A1A1A]'}`}><span className="truncate font-bold uppercase">{l.name}</span><span className="font-mono text-[10px] text-zinc-500">{l.code}</span></button>)}</div>
                <div className="border-t border-white/10 pt-1.5 mt-1 flex gap-1"><button onClick={onOpenCreateLeague} className="flex-1 flex items-center justify-center gap-1 rounded-sm bg-[#1A1A1A] py-1.5 text-[10px] font-black text-zinc-200 hover:bg-zinc-800 uppercase tracking-wider border border-white/5"><Plus className="h-3 w-3 text-[#D4AF37]"/> Create</button><button onClick={onOpenJoinLeague} className="flex-1 flex items-center justify-center gap-1 rounded-sm bg-[#1A1A1A] py-1.5 text-[10px] font-black text-zinc-200 hover:bg-zinc-800 uppercase tracking-wider border border-white/5"><Users className="h-3 w-3 text-[#D4AF37]"/> Join</button></div>
              </div>}
            </div>
          </div>}

          <SoundtrackControl />

          {currentUser ? <div className="relative">
            <button id="user-profile-btn" onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center gap-2 rounded-full border-2 border-[#D4AF37] p-0.5 hover:ring-2 hover:ring-[#D4AF37]/40 transition-all focus:outline-none">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full overflow-hidden bg-zinc-800"><img src={currentUser.avatarUrl||'https://api.dicebear.com/7.x/avataaars/svg?seed=Elijah'} alt={currentUser.name} className="h-full w-full object-cover" referrerPolicy="no-referrer"/></div>
            </button>
            {isUserMenuOpen && <div className="absolute right-0 mt-2 w-60 rounded-sm border border-white/10 bg-[#121212] p-2 shadow-2xl z-50" onClick={() => setIsUserMenuOpen(false)}>
              <div className="px-3 py-2 border-b border-white/5"><p className="text-xs font-black uppercase text-white tracking-tight truncate">{currentUser.name}</p><p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono truncate">{currentUser.email}</p></div>
              <div className="py-1">
                <MenuButton icon={<Trophy className="h-3.5 w-3.5 text-[#D4AF37]"/>} label="Dashboard & Leagues" onClick={()=>setCurrentTab('home')}/>
                <MenuButton icon={<User className="h-3.5 w-3.5 text-[#D4AF37]"/>} label="Profile & Rankings" onClick={()=>setCurrentTab('legacy')}/>
                <MenuButton icon={<Newspaper className="h-3.5 w-3.5 text-[#D4AF37]"/>} label="NFL Wire" onClick={()=>setCurrentTab('news')}/>
                {onOpenIntro&&<MenuButton icon={<Play className="h-3.5 w-3.5 text-[#D4AF37]"/>} label="Watch Intro Video" onClick={onOpenIntro}/>} 
                <MenuButton icon={<User className="h-3.5 w-3.5 text-[#D4AF37]"/>} label="Switch Account" onClick={onOpenAuth}/>
              </div>
              <div className="border-t border-white/5 pt-1"><button onClick={logout} className="w-full flex items-center gap-2 rounded-sm px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/10"><LogOut className="h-3.5 w-3.5"/> Sign Out</button></div>
            </div>}
          </div> : <button id="sign-in-btn" onClick={onOpenAuth} className="bg-[#D4AF37] text-black px-4 py-2 rounded-sm text-xs font-black uppercase tracking-wider hover:bg-amber-300 transition-colors">Sign In</button>}
        </div>
      </div>

      <nav className="h-11 sm:h-12 bg-[#1A1A1A] flex items-center justify-between px-4 sm:px-8 border-b border-white/5 overflow-x-auto no-scrollbar">
        <div className="flex items-center space-x-4 sm:space-x-8 h-full">
          <button id="nav-tab-home" onClick={() => setCurrentTab('home')} className={`text-xs font-black uppercase tracking-widest h-full flex items-center whitespace-nowrap transition-colors ${currentTab==='home'?'text-[#D4AF37] border-b-2 border-[#D4AF37]':'text-zinc-500 hover:text-white'}`}>Overview</button>

          <button id="nav-tab-solo-mobile" onClick={() => setCurrentTab('solo')} className={`text-xs font-black uppercase tracking-widest h-full flex items-center gap-1.5 whitespace-nowrap transition-colors ${currentTab==='solo'?'text-[#D4AF37] border-b-2 border-[#D4AF37]':'text-zinc-500 hover:text-white'}`}><Play className="h-3.5 w-3.5"/><span>Solo</span></button>

          <button id="nav-tab-news" onClick={() => setCurrentTab('news')} className={`text-xs font-black uppercase tracking-widest h-full flex items-center gap-1.5 whitespace-nowrap transition-colors ${currentTab==='news'?'text-[#D4AF37] border-b-2 border-[#D4AF37]':'text-zinc-500 hover:text-white'}`}><Newspaper className="h-3.5 w-3.5"/><span>News</span><span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse"/></button>

          <button id="nav-tab-profile" onClick={() => setCurrentTab('legacy')} className={`text-xs font-black uppercase tracking-widest h-full flex items-center gap-1.5 whitespace-nowrap transition-colors ${currentTab==='legacy'?'text-[#D4AF37] border-b-2 border-[#D4AF37]':'text-zinc-500 hover:text-white'}`}><Trophy className="h-3.5 w-3.5"/><span>Profile</span></button>

          {activeLeague&&<>
            <button id="tab-lobby-btn" onClick={() => setCurrentTab('lobby')} className={`text-xs font-black uppercase tracking-widest h-full flex items-center whitespace-nowrap transition-colors ${currentTab==='lobby'?'text-[#D4AF37] border-b-2 border-[#D4AF37]':'text-zinc-500 hover:text-white'}`}>Lobby ({activeLeague.members.length}/{activeLeague.maxMembers})</button>
            <button id="tab-draft-btn" onClick={() => setCurrentTab('draft')} className={`text-xs font-black uppercase tracking-widest h-full flex items-center gap-2 whitespace-nowrap transition-colors ${currentTab==='draft'?'text-[#D4AF37] border-b-2 border-[#D4AF37]':'text-zinc-500 hover:text-white'}`}><span>Draft Board</span><span className={`px-1.5 py-0.2 text-[10px] font-mono font-black rounded-sm ${currentRoster.length===20?'bg-[#00FF00] text-black':'bg-[#121212] text-[#D4AF37] border border-[#D4AF37]/30'}`}>{currentRoster.length}/20</span></button>
            {activeLeague.status==='completed'&&<button id="tab-results-btn" onClick={() => setCurrentTab('simulation')} className={`text-xs font-black uppercase tracking-widest h-full flex items-center gap-1.5 whitespace-nowrap transition-colors ${currentTab==='simulation'?'text-[#D4AF37] border-b-2 border-[#D4AF37]':'text-zinc-500 hover:text-white'}`}><Award className="h-3.5 w-3.5 text-[#D4AF37]"/><span>Simulation & Draft Order</span></button>}
          </>}
        </div>

        {onOpenIntro&&<button id="nav-play-intro-btn" onClick={onOpenIntro} className="flex items-center gap-1.5 rounded-xs border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-all shrink-0 cursor-pointer ml-4"><Play className="h-3 w-3 fill-[#D4AF37]"/><span>Intro Video</span></button>}
      </nav>
    </header>
  );
};

const MenuButton=({icon,label,onClick}:{icon:React.ReactNode,label:string,onClick:()=>void})=><button onClick={onClick} className="w-full flex items-center gap-2 rounded-sm px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-zinc-300 hover:bg-[#1A1A1A] hover:text-white">{icon}{label}</button>;
