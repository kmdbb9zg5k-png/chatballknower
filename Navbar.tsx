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
  TrendingUp,
  X,
  Calculator,
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

type DemoBook = 'FanDuel' | 'DraftKings' | 'BetMGM' | 'Caesars';
type DemoSport = 'NFL' | 'NBA' | 'MLB' | 'NHL';
type DemoLine = {
  id: string;
  sport: DemoSport;
  game: string;
  start: string;
  label: string;
  market: string;
  prices: Record<DemoBook, number>;
  move: string;
};

const SPORTSBOOKS: DemoBook[] = ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars'];
const DEMO_LINES: DemoLine[] = [
  { id:'phi-spread', sport:'NFL', game:'Dallas Cowboys @ Philadelphia Eagles', start:'Thu • 8:20 PM', label:'Philadelphia Eagles -2.5', market:'Spread', prices:{FanDuel:-105,DraftKings:-110,BetMGM:-108,Caesars:-110}, move:'-2 → -2.5' },
  { id:'phi-total', sport:'NFL', game:'Dallas Cowboys @ Philadelphia Eagles', start:'Thu • 8:20 PM', label:'Over 47.5', market:'Total', prices:{FanDuel:-110,DraftKings:-105,BetMGM:-110,Caesars:-108}, move:'46.5 → 47.5' },
  { id:'saquon-rush', sport:'NFL', game:'Dallas Cowboys @ Philadelphia Eagles', start:'Thu • 8:20 PM', label:'Saquon Barkley 80+ Rush Yards', market:'Player Prop', prices:{FanDuel:118,DraftKings:125,BetMGM:115,Caesars:120}, move:'+110 → +125' },
  { id:'kc-ml', sport:'NFL', game:'Buffalo Bills @ Kansas City Chiefs', start:'Sun • 4:25 PM', label:'Kansas City Chiefs ML', market:'Moneyline', prices:{FanDuel:-122,DraftKings:-118,BetMGM:-120,Caesars:-125}, move:'-130 → -118' },
  { id:'allen-pass', sport:'NFL', game:'Buffalo Bills @ Kansas City Chiefs', start:'Sun • 4:25 PM', label:'Josh Allen 250+ Pass Yards', market:'Player Prop', prices:{FanDuel:-102,DraftKings:105,BetMGM:-105,Caesars:100}, move:'-110 → +105' },
  { id:'bos-ml', sport:'NBA', game:'Boston @ New York', start:'Tonight • 7:30 PM', label:'Boston ML', market:'Moneyline', prices:{FanDuel:115,DraftKings:120,BetMGM:112,Caesars:118}, move:'+105 → +120' },
  { id:'nyy-ml', sport:'MLB', game:'New York @ Baltimore', start:'Tonight • 7:05 PM', label:'New York ML', market:'Moneyline', prices:{FanDuel:-112,DraftKings:-108,BetMGM:-110,Caesars:-115}, move:'-118 → -108' },
  { id:'edm-total', sport:'NHL', game:'Edmonton @ Colorado', start:'Tonight • 9:00 PM', label:'Over 6.5 Goals', market:'Total', prices:{FanDuel:102,DraftKings:105,BetMGM:100,Caesars:-102}, move:'6 → 6.5' },
];

function americanToDecimal(odds: number) {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

function decimalToAmerican(decimal: number) {
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / Math.max(0.01, decimal - 1));
}

function showOdds(odds: number) {
  return odds > 0 ? `+${odds}` : String(odds);
}

function SportsbookPage({ onClose }: { onClose: () => void }) {
  const [sport, setSport] = useState<DemoSport>('NFL');
  const [parlay, setParlay] = useState<string[]>([]);
  const [stake, setStake] = useState('10');
  const visible = DEMO_LINES.filter(x => x.sport === sport);
  const selected = DEMO_LINES.filter(x => parlay.includes(x.id));

  const bestBookForLine = (line: DemoLine) => SPORTSBOOKS.reduce((best, book) =>
    americanToDecimal(line.prices[book]) > americanToDecimal(line.prices[best]) ? book : best
  , SPORTSBOOKS[0]);

  const parlayByBook = SPORTSBOOKS.map(book => {
    const decimal = selected.length ? selected.reduce((acc, line) => acc * americanToDecimal(line.prices[book]), 1) : 1;
    return { book, decimal, american: selected.length ? decimalToAmerican(decimal) : 0 };
  }).sort((a,b) => b.decimal - a.decimal);

  const bestParlay = parlayByBook[0];
  const stakeNum = Math.max(0, Number(stake) || 0);
  const payout = selected.length ? stakeNum * bestParlay.decimal : 0;

  const theoreticalDecimal = selected.length
    ? selected.reduce((acc, line) => {
        const best = SPORTSBOOKS.reduce((bookA, bookB) => americanToDecimal(line.prices[bookB]) > americanToDecimal(line.prices[bookA]) ? bookB : bookA, SPORTSBOOKS[0]);
        return acc * americanToDecimal(line.prices[best]);
      }, 1)
    : 1;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#090909] text-white">
      <div className="sticky top-0 z-20 border-b border-[#D4AF37]/25 bg-[#111]/95 px-4 py-4 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[.24em] text-green-400">Ball Knower • Odds Comparison</div>
            <h2 className="font-display text-3xl font-black uppercase leading-none">SPORTS<span className="text-[#D4AF37]">BOOK</span></h2>
          </div>
          <button onClick={onClose} className="flex h-11 w-11 items-center justify-center border border-white/10 bg-[#191919] text-white"><X className="h-5 w-5" /></button>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        <section className="border border-[#D4AF37]/30 bg-[#111] p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.22em] text-[#D4AF37]"><TrendingUp className="h-4 w-4" /> Best Line Finder</div>
              <h3 className="mt-2 font-display text-4xl font-black uppercase leading-[.9] sm:text-6xl">SHOP THE LINE.<br/><span className="text-[#D4AF37]">BUILD IT SMARTER.</span></h3>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">Compare the same market across sportsbooks, then build a parlay and see which single sportsbook would offer the best combined price.</p>
            </div>
            <div className="border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-amber-300">DEMO DATA • NO WAGERS ACCEPTED</div>
          </div>
        </section>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(['NFL','NBA','MLB','NHL'] as DemoSport[]).map(s => <button key={s} onClick={() => setSport(s)} className={`min-w-[76px] border px-4 py-3 text-xs font-black uppercase ${sport===s?'border-[#D4AF37] bg-[#D4AF37] text-black':'border-white/10 bg-[#151515] text-zinc-400'}`}>{s}</button>)}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_390px]">
          <section>
            <div className="mb-3 flex items-end justify-between"><div><div className="text-[9px] font-black uppercase tracking-[.22em] text-[#D4AF37]">Market Board</div><h3 className="font-display text-2xl font-black uppercase">BEST AVAILABLE ODDS</h3></div><div className="text-[9px] font-bold uppercase text-zinc-600">Demo refreshed now</div></div>
            <div className="space-y-3">
              {visible.map(line => {
                const best = bestBookForLine(line);
                const inParlay = parlay.includes(line.id);
                return <div key={line.id} className="border border-white/10 bg-[#121212] p-4">
                  <div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-black uppercase tracking-wider text-zinc-600">{line.game} • {line.start}</div><div className="mt-1 text-lg font-black">{line.label}</div><div className="mt-1 text-xs text-zinc-500">{line.market} • Movement {line.move}</div></div><button onClick={() => setParlay(p => p.includes(line.id) ? p.filter(id=>id!==line.id) : [...p,line.id])} className={`shrink-0 border px-3 py-2 text-[10px] font-black uppercase ${inParlay?'border-green-500 bg-green-500/10 text-green-400':'border-[#D4AF37]/40 text-[#D4AF37]'}`}>{inParlay?'Added':'Add to Parlay'}</button></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{SPORTSBOOKS.map(book => <div key={book} className={`relative border p-3 ${book===best?'border-[#D4AF37] bg-[#D4AF37]/10':'border-white/5 bg-[#0c0c0c]'}`}><div className="text-[9px] font-black text-zinc-500">{book}</div><div className={`mt-1 text-xl font-black ${book===best?'text-[#D4AF37]':'text-white'}`}>{showOdds(line.prices[book])}</div>{book===best&&<span className="absolute right-2 top-2 bg-[#D4AF37] px-1.5 py-0.5 text-[7px] font-black text-black">BEST</span>}</div>)}</div>
                </div>
              })}
            </div>
          </section>

          <aside className="h-fit border border-[#D4AF37]/30 bg-[#111] p-5 xl:sticky xl:top-24">
            <div className="flex items-center gap-2 text-[#D4AF37]"><Calculator className="h-4 w-4"/><span className="text-[10px] font-black uppercase tracking-[.2em]">Parlay Lab</span></div>
            <h3 className="mt-2 font-display text-3xl font-black uppercase">{selected.length} LEG{selected.length===1?'':'S'}</h3>
            {selected.length===0 ? <div className="mt-4 border border-dashed border-white/10 p-6 text-center text-sm text-zinc-600">Tap “Add to Parlay” on any market.</div> : <div className="mt-4 space-y-2">{selected.map(line=><div key={line.id} className="flex items-start justify-between gap-3 border border-white/5 bg-[#0d0d0d] p-3"><div><div className="text-xs font-bold">{line.label}</div><div className="mt-1 text-[9px] text-zinc-600">{line.game}</div></div><button onClick={()=>setParlay(p=>p.filter(id=>id!==line.id))} className="text-zinc-600 hover:text-white"><X className="h-4 w-4"/></button></div>)}</div>}

            {selected.length>0 && <>
              <div className="mt-5 text-[9px] font-black uppercase tracking-widest text-zinc-500">Same parlay at each book</div>
              <div className="mt-2 space-y-2">{parlayByBook.map((r,i)=><div key={r.book} className={`flex items-center justify-between border p-3 ${i===0?'border-[#D4AF37] bg-[#D4AF37]/10':'border-white/5'}`}><div><div className="text-xs font-black">{r.book}</div>{i===0&&<div className="text-[8px] font-black uppercase text-[#D4AF37]">Best one-book price</div>}</div><div className="text-lg font-black">{showOdds(r.american)}</div></div>)}</div>

              <div className="mt-5 border-t border-white/10 pt-4"><label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Example stake</label><div className="mt-2 flex items-center border border-white/10 bg-[#0c0c0c] px-3"><span className="text-zinc-600">$</span><input value={stake} onChange={e=>setStake(e.target.value)} inputMode="decimal" className="w-full bg-transparent p-3 font-black outline-none"/></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="border border-white/5 bg-[#0c0c0c] p-3"><div className="text-[8px] font-black uppercase text-zinc-600">Best Odds</div><div className="mt-1 text-xl font-black text-[#D4AF37]">{showOdds(bestParlay.american)}</div></div><div className="border border-white/5 bg-[#0c0c0c] p-3"><div className="text-[8px] font-black uppercase text-zinc-600">Example Return</div><div className="mt-1 text-xl font-black">${payout.toFixed(2)}</div></div></div></div>

              <div className="mt-4 border border-blue-500/20 bg-blue-500/5 p-3 text-[10px] leading-4 text-zinc-400"><b className="text-blue-300">THEORETICAL BEST INDIVIDUAL LINES:</b> {showOdds(decimalToAmerican(theoreticalDecimal))}. This combines the best leg from different books and is <b>not</b> one playable parlay.</div>
            </>}

            <button disabled className="mt-5 w-full border border-white/10 bg-[#171717] py-4 text-xs font-black uppercase text-zinc-600">Sportsbook links unlock with live licensed feed</button>
          </aside>
        </div>

        <div className="mt-7 border border-white/10 bg-[#101010] p-4 text-[10px] leading-5 text-zinc-500"><b className="text-white">BALL KNOWER SPORTSBOOK:</b> Information and comparison only. Ball Knower does not accept wagers. Demo prices are fictional placeholders until a licensed odds provider is connected.</div>
      </main>
    </div>
  );
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
  const [isSportsbookOpen, setIsSportsbookOpen] = useState(false);

  const tabClass = (active: boolean) =>
    `text-xs font-black uppercase tracking-widest h-full flex items-center gap-1.5 whitespace-nowrap transition-colors ${
      active ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'text-zinc-500 hover:text-white'
    }`;

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-[#D4AF37]/20 bg-[#121212]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <button id="nav-logo-btn" onClick={() => setCurrentTab('home')} className="group shrink-0 text-left focus:outline-none">
              <h1 className="font-display text-2xl font-black tracking-tighter text-white transition-colors group-hover:text-zinc-200 sm:text-3xl">BALL <span className="text-[#D4AF37]">KNOWER</span></h1>
              <div className="hidden text-[8px] font-black uppercase tracking-[.2em] text-zinc-600 sm:block">Fantasy Football Platform</div>
            </button>

            {isDemoMode && <div className="hidden items-center gap-1.5 border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-1 text-[9px] font-black uppercase text-[#D4AF37] md:flex"><Sparkles className="h-3 w-3" /> Demo<button onClick={exitDemoMode} className="ml-1 text-zinc-400 underline hover:text-white">Exit</button></div>}
            {onOpenDatabaseModal && <button onClick={onOpenDatabaseModal} title="View the 2026 roster validation report" className="hidden items-center gap-1.5 border border-green-500/25 bg-green-500/5 px-2 py-1 text-[9px] font-black uppercase text-green-400 hover:bg-green-500/10 lg:flex"><Shield className="h-3 w-3" /> 32/32 Rosters</button>}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {activeLeague && <div className="relative hidden sm:block">
              <button id="league-dropdown-btn" onClick={() => setIsLeagueMenuOpen(!isLeagueMenuOpen)} className="flex items-center gap-1.5 border border-white/10 bg-[#1A1A1A] px-2.5 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-200 transition-colors hover:border-[#D4AF37]/50"><Trophy className="h-3.5 w-3.5 text-[#D4AF37]" /><span className="max-w-[125px] truncate">Challenge: {activeLeague.name}</span><ChevronDown className="h-3 w-3 text-zinc-500" /></button>
              {isLeagueMenuOpen && <div className="absolute right-0 z-50 mt-2 w-72 border border-white/10 bg-[#121212] p-2 shadow-2xl" onClick={() => setIsLeagueMenuOpen(false)}>
                <div className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">Draft Order Challenges</div>
                <div className="my-1 max-h-48 space-y-1 overflow-y-auto">{leagues.map(l => <button key={l.id} onClick={() => { setActiveLeagueId(l.id); setCurrentTab(l.status === 'completed' ? 'simulation' : 'lobby'); }} className={`flex w-full items-center justify-between px-2.5 py-2 text-left text-xs ${l.id === activeLeague.id ? 'border border-[#D4AF37]/30 bg-[#D4AF37]/10 font-bold text-[#D4AF37]' : 'text-zinc-300 hover:bg-[#1A1A1A]'}`}><span className="truncate font-bold uppercase">{l.name}</span><span className="font-mono text-[9px] text-zinc-500">{l.code}</span></button>)}</div>
                <div className="mt-1 flex gap-1 border-t border-white/10 pt-2"><button onClick={onOpenCreateLeague} className="flex flex-1 items-center justify-center gap-1 bg-[#1A1A1A] py-2 text-[9px] font-black uppercase text-zinc-200 hover:bg-zinc-800"><Plus className="h-3 w-3 text-[#D4AF37]" /> Challenge</button><button onClick={onOpenJoinLeague} className="flex flex-1 items-center justify-center gap-1 bg-[#1A1A1A] py-2 text-[9px] font-black uppercase text-zinc-200 hover:bg-zinc-800"><Users className="h-3 w-3 text-[#D4AF37]" /> Join</button></div>
              </div>}
            </div>}

            <SoundtrackControl />

            {currentUser ? <div className="relative">
              <button id="user-profile-btn" onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center rounded-full border-2 border-[#D4AF37] p-0.5 transition-all hover:ring-2 hover:ring-[#D4AF37]/40"><div className="h-8 w-8 overflow-hidden rounded-full bg-zinc-800 sm:h-9 sm:w-9"><img src={currentUser.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Elijah'} alt={currentUser.name} className="h-full w-full object-cover" referrerPolicy="no-referrer"/></div></button>
              {isUserMenuOpen && <div className="absolute right-0 z-50 mt-2 w-60 border border-white/10 bg-[#121212] p-2 shadow-2xl" onClick={() => setIsUserMenuOpen(false)}>
                <div className="border-b border-white/5 px-3 py-2"><p className="truncate text-xs font-black uppercase text-white">{currentUser.name}</p><p className="truncate font-mono text-[9px] uppercase text-zinc-500">{currentUser.email}</p></div>
                <div className="py-1"><MenuButton icon={<Users className="h-3.5 w-3.5 text-[#D4AF37]" />} label="Fantasy Leagues" onClick={() => setCurrentTab('fantasy')} /><MenuButton icon={<TrendingUp className="h-3.5 w-3.5 text-[#D4AF37]" />} label="Sportsbook" onClick={() => setIsSportsbookOpen(true)} /><MenuButton icon={<Trophy className="h-3.5 w-3.5 text-[#D4AF37]" />} label="Overview & Challenges" onClick={() => setCurrentTab('home')} /><MenuButton icon={<Play className="h-3.5 w-3.5 text-[#D4AF37]" />} label="Solo Franchise" onClick={() => setCurrentTab('solo')} /><MenuButton icon={<Newspaper className="h-3.5 w-3.5 text-[#D4AF37]" />} label="NFL Wire" onClick={() => setCurrentTab('news')} /><MenuButton icon={<User className="h-3.5 w-3.5 text-[#D4AF37]" />} label="Profile & Rankings" onClick={() => setCurrentTab('legacy')} />{onOpenIntro && <MenuButton icon={<Play className="h-3.5 w-3.5 text-[#D4AF37]" />} label="Watch Intro Video" onClick={onOpenIntro} />}<MenuButton icon={<User className="h-3.5 w-3.5 text-[#D4AF37]" />} label="Switch Account" onClick={onOpenAuth} /></div>
                <div className="border-t border-white/5 pt-1"><button onClick={logout} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/10"><LogOut className="h-3.5 w-3.5" /> Sign Out</button></div>
              </div>}
            </div> : <button id="sign-in-btn" onClick={onOpenAuth} className="bg-[#D4AF37] px-4 py-2 text-xs font-black uppercase text-black hover:bg-amber-300">Sign In</button>}
          </div>
        </div>

        <nav className="flex h-11 items-center border-b border-white/5 bg-[#1A1A1A] px-4 sm:h-12 sm:px-8"><div className="flex h-full items-center gap-4 overflow-x-auto no-scrollbar sm:gap-8">
          <button id="nav-tab-home" onClick={() => setCurrentTab('home')} className={tabClass(currentTab === 'home')}>Overview</button>
          <button id="nav-tab-fantasy" onClick={() => setCurrentTab('fantasy')} className={tabClass(currentTab === 'fantasy')}><Users className="h-3.5 w-3.5" /><span>Fantasy</span><span className="bg-[#D4AF37] px-1 py-0.5 text-[7px] leading-none text-black">MAIN</span></button>
          <button id="nav-tab-sportsbook" onClick={() => setIsSportsbookOpen(true)} className={tabClass(isSportsbookOpen)}><TrendingUp className="h-3.5 w-3.5" /><span>Sportsbook</span><span className="border border-green-500/40 bg-green-500/10 px-1 py-0.5 text-[7px] leading-none text-green-400">DEMO</span></button>
          <button id="nav-tab-solo-mobile" onClick={() => setCurrentTab('solo')} className={tabClass(currentTab === 'solo')}><Play className="h-3.5 w-3.5" /> Solo</button>
          <button id="nav-tab-news" onClick={() => setCurrentTab('news')} className={tabClass(currentTab === 'news')}><Newspaper className="h-3.5 w-3.5" /> News<span className="h-1.5 w-1.5 rounded-full bg-green-400" /></button>
          <button id="nav-tab-profile" onClick={() => setCurrentTab('legacy')} className={tabClass(currentTab === 'legacy')}><Trophy className="h-3.5 w-3.5" /> Profile</button>
          {activeLeague && <><span className="h-5 w-px shrink-0 bg-white/10" /><button id="tab-lobby-btn" onClick={() => setCurrentTab('lobby')} className={tabClass(currentTab === 'lobby')}>Challenge Lobby ({activeLeague.members.length}/{activeLeague.maxMembers})</button><button id="tab-draft-btn" onClick={() => setCurrentTab('draft')} className={tabClass(currentTab === 'draft')}><span>Challenge Team</span><span className={`px-1.5 py-0.5 font-mono text-[9px] font-black ${currentRoster.length === 20 ? 'bg-green-400 text-black' : 'border border-[#D4AF37]/30 bg-[#121212] text-[#D4AF37]'}`}>{currentRoster.length}/20</span></button>{activeLeague.status === 'completed' && <button id="tab-results-btn" onClick={() => setCurrentTab('simulation')} className={tabClass(currentTab === 'simulation')}><Award className="h-3.5 w-3.5" /> Earned Draft Order</button>}</>}
        </div></nav>
      </header>
      {isSportsbookOpen && <SportsbookPage onClose={() => setIsSportsbookOpen(false)} />}
    </>
  );
};

const MenuButton = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <button onClick={onClick} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-300 hover:bg-[#1A1A1A] hover:text-white">
    {icon}
    <span>{label}</span>
  </button>
);
