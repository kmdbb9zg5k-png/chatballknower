import { Player } from '../types';
import { SPECIAL_TEAMS_2026 } from './specialTeams2026';

/**
 * 2026 runtime roster corrections.
 *
 * Production is wrapped by Ball Knower Live, which injects nflverse's daily 2026
 * weekly-roster map into the `nextTeam` line below before Babel compiles this file.
 * When that live map is present it is authoritative: players absent from the live
 * 2026 roster are removed from the draft pool, and current team assignments win.
 * Local/dev builds keep the small fallback overrides below.
 */
export const CURRENT_2026_QB_STARTERS: Record<string, string> = {
  BUF: 'Josh Allen',
  MIA: 'Malik Willis',
  NE: 'Drake Maye',
  NYJ: 'Geno Smith',
  BAL: 'Lamar Jackson',
  CIN: 'Joe Burrow',
  CLE: 'Deshaun Watson',
  PIT: 'Aaron Rodgers',
  HOU: 'C.J. Stroud',
  IND: 'Daniel Jones',
  JAX: 'Trevor Lawrence',
  TEN: 'Cam Ward',
  DEN: 'Bo Nix',
  KC: 'Patrick Mahomes',
  LV: 'Kirk Cousins',
  LAC: 'Justin Herbert',
  DAL: 'Dak Prescott',
  NYG: 'Jaxson Dart',
  PHI: 'Jalen Hurts',
  WAS: 'Jayden Daniels',
  CHI: 'Caleb Williams',
  DET: 'Jared Goff',
  GB: 'Jordan Love',
  MIN: 'Kyler Murray',
  ATL: 'Michael Penix Jr.',
  CAR: 'Bryce Young',
  NO: 'Tyler Shough',
  TB: 'Baker Mayfield',
  ARI: 'Jacoby Brissett',
  LAR: 'Matthew Stafford',
  SF: 'Brock Purdy',
  SEA: 'Sam Darnold',
};

export const MADDEN_27_QB_OVERRIDES: Record<string, number> = {
  'Josh Allen': 99,
  'Matthew Stafford': 99,
  'Joe Burrow': 97,
  'Lamar Jackson': 94,
  'Patrick Mahomes': 93,
  'Drake Maye': 92,
  'Dak Prescott': 91,
  'Caleb Williams': 90,
  'Justin Herbert': 90,
  'Jared Goff': 88,
  'Sam Darnold': 87,
  'Jordan Love': 86,
  'Brock Purdy': 85,
  'Trevor Lawrence': 84,
  'Baker Mayfield': 83,
  'Jalen Hurts': 82,
  'Bo Nix': 81,
  'Jayden Daniels': 80,
  'Aaron Rodgers': 79,
  'Bryce Young': 78,
  'Daniel Jones': 78,
  'Jaxson Dart': 77,
  'Tyler Shough': 77,
  'C.J. Stroud': 76,
  'Cam Ward': 75,
  'Kyler Murray': 75,
  'Fernando Mendoza': 74,
  'Malik Willis': 74,
  'Tua Tagovailoa': 74,
  'Kirk Cousins': 73,
  'Michael Penix Jr.': 73,
  'Geno Smith': 72,
  'Jacoby Brissett': 72,
  'Deshaun Watson': 69,
  'Shedeur Sanders': 69,
};

const TEAM_OVERRIDES: Record<string, string> = {
  'Malik Willis': 'MIA',
  'Geno Smith': 'NYJ',
  'Aaron Rodgers': 'PIT',
  'Daniel Jones': 'IND',
  'Kirk Cousins': 'LV',
  'Kyler Murray': 'MIN',
  'Jacoby Brissett': 'ARI',
  'Sam Darnold': 'SEA',
  'Tua Tagovailoa': 'ATL',
  'Davante Adams': 'LAR',
  'A.J. Brown': 'NE',
  'Jaylen Waddle': 'DEN',
  'Myles Garrett': 'LAC',
};

const MISSING_2026_PLAYERS: Player[] = [
  {
    id: 'qb-cam-ward', name: 'Cam Ward', team: 'TEN', teamCity: 'Tennessee', position: 'QB',
    ovr: 75, overallRating: 75, overall: 75, ratingSource: 'EA SPORTS Madden', ratingSeason: 2026, ratingStatus: 'VERIFIED', salary: 10, starter: true,
    archetype: 'Second-Year Creator', attributes: { passing: 77, rushing: 76, athleticism: 82, footballIQ: 73 }, highlightStat: 'Live-arm creator entering Year 2',
  },
  {
    id: 'qb-jaxson-dart', name: 'Jaxson Dart', team: 'NYG', teamCity: 'New York', position: 'QB',
    ovr: 77, overallRating: 77, overall: 77, ratingSource: 'EA SPORTS Madden', ratingSeason: 2026, ratingStatus: 'VERIFIED', salary: 8, starter: true,
    archetype: 'Aggressive Young Dual-Threat', attributes: { passing: 78, rushing: 80, athleticism: 84, footballIQ: 77 }, highlightStat: 'Athletic second-year starter',
  },
  {
    id: 'qb-tyler-shough', name: 'Tyler Shough', team: 'NO', teamCity: 'New Orleans', position: 'QB',
    ovr: 77, overallRating: 77, overall: 77, ratingSource: 'EA SPORTS Madden', ratingSeason: 2026, ratingStatus: 'VERIFIED', salary: 7, starter: true,
    archetype: 'Tall Rhythm Passer', attributes: { passing: 79, rushing: 72, athleticism: 78, footballIQ: 76 }, highlightStat: 'Promising young pocket passer',
  },
  {
    id: 'qb-fernando-mendoza', name: 'Fernando Mendoza', team: 'LV', teamCity: 'Las Vegas', position: 'QB',
    ovr: 74, overallRating: 74, overall: 74, ratingSource: 'EA SPORTS Madden', ratingSeason: 2026, ratingStatus: 'VERIFIED', salary: 9, starter: false, projectedStarter: true,
    archetype: 'No. 1 Pick Developmental Franchise QB', attributes: { passing: 75, rushing: 73, athleticism: 84, footballIQ: 75 }, highlightStat: '2026 No. 1 overall pick',
  },
  {
    id: 'qb-shedeur-sanders', name: 'Shedeur Sanders', team: 'CLE', teamCity: 'Cleveland', position: 'QB',
    ovr: 69, overallRating: 69, overall: 69, ratingSource: 'EA SPORTS Madden', ratingSeason: 2026, ratingStatus: 'VERIFIED', salary: 4, starter: false,
    archetype: 'Accurate Young Pocket Passer', attributes: { passing: 74, rushing: 68, athleticism: 78, footballIQ: 75 }, highlightStat: 'Developmental QB with starting upside',
  },
];

const LIVE_ROSTER_SENTINEL = '__NOT_ON_LIVE_2026_ROSTER__';

function addIfMissing(target: Player[], additions: Player[]) {
  const names = new Set(target.map(p => p.name.toLowerCase()));
  for (const player of additions) {
    if (!names.has(player.name.toLowerCase())) {
      target.push(player);
      names.add(player.name.toLowerCase());
    }
  }
}

export function applyCurrent2026Roster(rawPlayers: Player[]): Player[] {
  const expectedStarterByName = new Map(
    Object.entries(CURRENT_2026_QB_STARTERS).map(([team, name]) => [name, team])
  );

  // Ball Knower Live injects a local `__norm` helper plus the daily nflverse
  // name->team object into this function. Detecting that transformed function lets
  // us make the live feed authoritative without breaking normal Vite/dev builds.
  const hasDailyLiveRoster = applyCurrent2026Roster.toString().includes('__norm');

  const seedPlayers: Player[] = [...rawPlayers];
  addIfMissing(seedPlayers, MISSING_2026_PLAYERS);
  addIfMissing(seedPlayers, SPECIAL_TEAMS_2026);

  const corrected: Player[] = seedPlayers.map((inputPlayer): Player => {
    const originalPlayer = inputPlayer;
    let player = inputPlayer;
    const savedOverride = TEAM_OVERRIDES[player.name];

    // In production, force the injected nflverse lookup to prove the player is
    // actually on a 2026 roster. If no live match exists, the sentinel survives
    // and the player is filtered out below. This removes retirees/stale players.
    if (hasDailyLiveRoster) {
      player = { ...player, team: LIVE_ROSTER_SENTINEL };
      if (savedOverride) delete TEAM_OVERRIDES[player.name];
    }

    // IMPORTANT: Ball Knower Live replaces this exact line at runtime with the
    // daily nflverse 2026 roster lookup. Keep the line text unchanged.
    const nextTeam = TEAM_OVERRIDES[player.name] || player.team;

    if (hasDailyLiveRoster && savedOverride) TEAM_OVERRIDES[player.name] = savedOverride;

    const onCurrentRoster = !hasDailyLiveRoster || nextTeam !== LIVE_ROSTER_SENTINEL;
    const officialQbOvr = originalPlayer.position === 'QB' ? MADDEN_27_QB_OVERRIDES[originalPlayer.name] : undefined;
    const expectedStarterTeam = originalPlayer.position === 'QB' ? expectedStarterByName.get(originalPlayer.name) : undefined;

    return {
      ...originalPlayer,
      team: nextTeam,
      teamId: nextTeam,
      active: onCurrentRoster,
      starter: originalPlayer.position === 'QB' ? expectedStarterTeam === nextTeam : originalPlayer.starter,
      projectedStarter: originalPlayer.position === 'QB' ? expectedStarterTeam === nextTeam : originalPlayer.projectedStarter,
      ...(officialQbOvr ? {
        ovr: officialQbOvr,
        overallRating: officialQbOvr,
        overall: officialQbOvr,
        ratingSource: 'EA SPORTS Madden',
        ratingSeason: 2026,
        ratingStatus: 'VERIFIED' as const,
      } : {}),
    };
  });

  // Production: only players proven present in the current 2026 roster feed survive.
  // Local/dev: preserve the legacy base pool plus the fallback correction layer.
  return corrected.filter(p => p.active !== false && p.team !== LIVE_ROSTER_SENTINEL);
}
