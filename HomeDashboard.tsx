import React from 'react';
import { useBallKnower } from '../context/BallKnowerContext';
import {
  Shield,
  Trophy,
  Users,
  Play,
  Sparkles,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  CalendarDays,
  Repeat2,
  Swords,
} from 'lucide-react';
import { League } from '../types';

interface HomeDashboardProps {
  onOpenCreateLeague: () => void;
  onOpenJoinLeague: () => void;
  onSelectLeague: (league: League, tab: 'lobby' | 'draft' | 'simulation') => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onOpenCreateLeague,
  onOpenJoinLeague,
  onSelectLeague,
}) => {
  const { leagues, currentUser, startDemoMode } = useBallKnower();

  const openFantasy = () => {
    document.getElementById('nav-tab-fantasy')?.click();
  };

  const openSolo = () => {
    document.getElementById('nav-tab-solo-mobile')?.click();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0A0A0A] pb-16 text-white">
      <section className="relative overflow-hidden border-b border-white/5 bg-[#111] py-12 sm:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,.14),transparent_48%)]" />
        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-8">
          <div className="mb-5 inline-flex items-center gap-2 border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[.22em] text-[#D4AF37]">
            <Trophy className="h-3.5 w-3.5" />
            Full Fantasy Football • Ball Knower Built In
          </div>

          <h1 className="font-display text-5xl font-black uppercase leading-[.9] tracking-tighter sm:text-7xl lg:text-8xl">
            RUN YOUR LEAGUE.<br />
            <span className="text-[#D4AF37]">PROVE YOU KNOW BALL.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-sm font-semibold leading-6 text-zinc-400 sm:text-base">
            Create the league, schedule the draft, draft real NFL players, manage lineups, waivers and trades, then fight through the playoffs. Want draft order to mean something? Turn on the Ball Knower Challenge and earn it first.
          </p>

          <div className="mx-auto mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            <button onClick={openFantasy} className="flex min-h-[56px] items-center justify-center gap-2 bg-[#D4AF37] px-6 py-4 text-sm font-black uppercase tracking-wider text-black transition-colors hover:bg-amber-300">
              <Users className="h-4 w-4" /> Fantasy Football
            </button>
            <button onClick={openSolo} className="flex min-h-[56px] items-center justify-center gap-2 border border-white/10 bg-[#1A1A1A] px-6 py-4 text-sm font-black uppercase tracking-wider text-white transition-colors hover:border-white/20 hover:bg-zinc-800">
              <Play className="h-4 w-4 text-[#D4AF37]" /> Solo Franchise
            </button>
          </div>

          <button onClick={startDemoMode} className="mt-4 inline-flex items-center gap-2 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-zinc-500 transition-colors hover:text-[#D4AF37]">
            <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" /> Try Ball Knower Demo <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pt-9 sm:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: '01', icon: Users, title: 'Create League', text: 'Invite the group and choose scoring, teams, waivers and format.' },
            { n: '02', icon: Swords, title: 'Choose Draft Order', text: 'Random, commissioner controlled, or earn it with Ball Knower.' },
            { n: '03', icon: CalendarDays, title: 'Draft & Play', text: 'Schedule draft night, build rosters and battle every NFL week.' },
            { n: '04', icon: Trophy, title: 'Win The League', text: 'Trades, waivers, standings, playoffs and permanent league history.' },
          ].map(({ n, icon: Icon, title, text }) => (
            <div key={n} className="border border-white/5 bg-[#121212] p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#D4AF37]"><Icon className="h-4 w-4" /></div>
                <span className="font-mono text-[10px] font-black text-zinc-700">{n}</span>
              </div>
              <h3 className="mt-4 font-display text-lg font-black uppercase">{title}</h3>
              <p className="mt-2 text-xs font-medium leading-5 text-zinc-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-8">
        <div className="overflow-hidden border border-[#D4AF37]/30 bg-[#111]">
          <div className="grid gap-0 lg:grid-cols-[1.35fr_.65fr]">
            <div className="p-6 sm:p-8">
              <div className="text-[10px] font-black uppercase tracking-[.24em] text-[#D4AF37]">Signature Optional Feature</div>
              <h2 className="mt-2 font-display text-3xl font-black uppercase leading-none sm:text-4xl">BALL KNOWER<br/><span className="text-[#D4AF37]">DRAFT ORDER CHALLENGE</span></h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
                Everyone gets the same NFL player pool and the same $301.2M cap. Build the smartest team, survive the simulation, and the final standings become your real fantasy draft order.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                <span className="border border-white/10 bg-[#171717] px-3 py-2">Same Player Pool</span>
                <span className="border border-white/10 bg-[#171717] px-3 py-2">Same Cap</span>
                <span className="border border-white/10 bg-[#171717] px-3 py-2">Earn Your Pick</span>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-3 border-t border-white/5 bg-[#0D0D0D] p-6 lg:border-l lg:border-t-0">
              <button onClick={onOpenCreateLeague} className="flex min-h-[50px] items-center justify-center gap-2 bg-[#D4AF37] px-5 py-3 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300"><Shield className="h-4 w-4" /> Start Challenge</button>
              <button onClick={onOpenJoinLeague} className="flex min-h-[50px] items-center justify-center gap-2 border border-white/10 bg-[#181818] px-5 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-zinc-800"><Users className="h-4 w-4 text-[#D4AF37]" /> Join Challenge Code</button>
              <button onClick={openFantasy} className="text-xs font-black uppercase tracking-wider text-[#D4AF37]">Use inside a Fantasy League →</button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-8">
        <div className="mb-5 flex flex-col gap-3 border-b border-white/5 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[.2em] text-[#D4AF37]">Optional Competition Mode</div>
            <h2 className="mt-1 font-display text-2xl font-black uppercase">Your Draft Order Challenges</h2>
            <p className="mt-1 text-xs text-zinc-500">These can stand alone or feed the results into a Fantasy league.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button onClick={onOpenCreateLeague} className="min-h-[44px] border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 text-xs font-black uppercase text-[#E7C95F]">+ Challenge</button>
            <button onClick={onOpenJoinLeague} className="min-h-[44px] border border-white/10 bg-[#181818] px-4 text-xs font-black uppercase text-zinc-200">Join Code</button>
          </div>
        </div>

        {leagues.length === 0 ? (
          <div className="border border-white/5 bg-[#121212] p-8 text-center">
            <Trophy className="mx-auto h-10 w-10 text-zinc-700" />
            <h3 className="mt-3 font-display text-lg font-black uppercase">No Draft Order Challenges Yet</h3>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-zinc-500">You do not need one to run Fantasy. Turn it on only when your league wants everyone to compete for draft position.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {leagues.map(league => {
              const myMember = league.members.find(m => m.userId === currentUser?.id);
              const isReady = myMember?.status === 'ready';
              const submittedCount = league.members.filter(m => m.status === 'ready').length;
              const isCompleted = league.status === 'completed';
              const userDraftPick = isCompleted && league.seasonResult ? league.seasonResult.draftOrder.find(d => d.memberId === myMember?.id)?.pickNumber : null;

              return (
                <div key={league.id} className="border border-white/5 bg-[#121212] p-5 transition-colors hover:border-[#D4AF37]/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-zinc-800 px-2 py-1 font-mono text-[10px] font-black text-[#D4AF37]">{league.code}</span>
                        {league.commissionerId === currentUser?.id && <span className="border border-white/5 bg-zinc-800 px-2 py-1 text-[8px] font-black uppercase text-zinc-300">Commish</span>}
                      </div>
                      <h3 className="mt-3 truncate font-display text-xl font-black uppercase">{league.name}</h3>
                    </div>
                    {isCompleted ? <span className="flex items-center gap-1 border border-green-500/25 bg-green-500/5 px-2 py-1 text-[9px] font-black uppercase text-green-400"><CheckCircle2 className="h-3 w-3"/>Complete</span> : <span className="flex items-center gap-1 border border-[#D4AF37]/25 bg-[#D4AF37]/5 px-2 py-1 text-[9px] font-black uppercase text-[#D4AF37]"><Clock className="h-3 w-3"/>Active</span>}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 border border-white/5 bg-[#0A0A0A] p-3 text-center">
                    <div><div className="text-[8px] font-black uppercase text-zinc-600">Managers</div><div className="mt-1 text-sm font-black">{league.members.length}/{league.maxMembers}</div></div>
                    <div><div className="text-[8px] font-black uppercase text-zinc-600">Ready</div><div className="mt-1 text-sm font-black text-[#D4AF37]">{submittedCount}/{league.members.length}</div></div>
                    <div><div className="text-[8px] font-black uppercase text-zinc-600">Cap</div><div className="mt-1 text-sm font-black">${league.salaryCap}M</div></div>
                  </div>

                  {isCompleted && userDraftPick && <div className="mt-3 flex items-center justify-between border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-3"><div className="flex items-center gap-2"><Award className="h-5 w-5 text-[#D4AF37]"/><div><div className="text-[8px] font-black uppercase text-[#D4AF37]">Earned Draft Position</div><div className="font-black">PICK #{userDraftPick}</div></div></div><Repeat2 className="h-4 w-4 text-zinc-500" /></div>}

                  <div className="mt-4 flex gap-2 border-t border-white/5 pt-3">
                    {isCompleted ? <button onClick={() => onSelectLeague(league, 'simulation')} className="flex w-full items-center justify-center gap-2 bg-[#D4AF37] py-3 text-xs font-black uppercase text-black"><Award className="h-3.5 w-3.5"/>View Draft Order</button> : <><button onClick={() => onSelectLeague(league, 'lobby')} className="flex-1 border border-white/10 bg-[#1A1A1A] py-3 text-xs font-black uppercase">Lobby</button><button onClick={() => onSelectLeague(league, 'draft')} className="flex-1 bg-white py-3 text-xs font-black uppercase text-black hover:bg-[#D4AF37]">{isReady ? 'Edit Team' : 'Build Team'}</button></>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
