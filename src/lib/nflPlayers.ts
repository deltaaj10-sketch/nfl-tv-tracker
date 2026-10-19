import { FantasyPosition } from '@/types/fantasy';

export interface MasterPlayer {
  id: string; // ESPN athlete ID or canonical ID
  sleeperId?: string;
  name: string;
  shortName: string;
  position: FantasyPosition;
  teamAbbr: string;
  teamId: string;
  teamName: string;
  teamLogo: string;
  jersey?: string;
  headshot: string;
  depthChartOrder?: number;
}

export const NFL_TEAMS: { id: string; abbr: string; name: string; city: string; displayName: string }[] = [
  { id: '1', abbr: 'ATL', name: 'Falcons', city: 'Atlanta', displayName: 'Atlanta Falcons' },
  { id: '2', abbr: 'BUF', name: 'Bills', city: 'Buffalo', displayName: 'Buffalo Bills' },
  { id: '3', abbr: 'CHI', name: 'Bears', city: 'Chicago', displayName: 'Chicago Bears' },
  { id: '4', abbr: 'CIN', name: 'Bengals', city: 'Cincinnati', displayName: 'Cincinnati Bengals' },
  { id: '5', abbr: 'CLE', name: 'Browns', city: 'Cleveland', displayName: 'Cleveland Browns' },
  { id: '6', abbr: 'DAL', name: 'Cowboys', city: 'Dallas', displayName: 'Dallas Cowboys' },
  { id: '7', abbr: 'DEN', name: 'Broncos', city: 'Denver', displayName: 'Denver Broncos' },
  { id: '8', abbr: 'DET', name: 'Lions', city: 'Detroit', displayName: 'Detroit Lions' },
  { id: '9', abbr: 'GB', name: 'Packers', city: 'Green Bay', displayName: 'Green Bay Packers' },
  { id: '10', abbr: 'TEN', name: 'Titans', city: 'Tennessee', displayName: 'Tennessee Titans' },
  { id: '11', abbr: 'IND', name: 'Colts', city: 'Indianapolis', displayName: 'Indianapolis Colts' },
  { id: '12', abbr: 'KC', name: 'Chiefs', city: 'Kansas City', displayName: 'Kansas City Chiefs' },
  { id: '13', abbr: 'LV', name: 'Raiders', city: 'Las Vegas', displayName: 'Las Vegas Raiders' },
  { id: '14', abbr: 'LAR', name: 'Rams', city: 'Los Angeles', displayName: 'Los Angeles Rams' },
  { id: '15', abbr: 'MIA', name: 'Dolphins', city: 'Miami', displayName: 'Miami Dolphins' },
  { id: '16', abbr: 'MIN', name: 'Vikings', city: 'Minnesota', displayName: 'Minnesota Vikings' },
  { id: '17', abbr: 'NE', name: 'Patriots', city: 'New England', displayName: 'New England Patriots' },
  { id: '18', abbr: 'NO', name: 'Saints', city: 'New Orleans', displayName: 'New Orleans Saints' },
  { id: '19', abbr: 'NYG', name: 'Giants', city: 'New York', displayName: 'New York Giants' },
  { id: '20', abbr: 'NYJ', name: 'Jets', city: 'New York', displayName: 'New York Jets' },
  { id: '21', abbr: 'PHI', name: 'Eagles', city: 'Philadelphia', displayName: 'Philadelphia Eagles' },
  { id: '22', abbr: 'ARI', name: 'Cardinals', city: 'Arizona', displayName: 'Arizona Cardinals' },
  { id: '23', abbr: 'PIT', name: 'Steelers', city: 'Pittsburgh', displayName: 'Pittsburgh Steelers' },
  { id: '24', abbr: 'LAC', name: 'Chargers', city: 'Los Angeles', displayName: 'Los Angeles Chargers' },
  { id: '25', abbr: 'SF', name: '49ers', city: 'San Francisco', displayName: 'San Francisco 49ers' },
  { id: '26', abbr: 'SEA', name: 'Seahawks', city: 'Seattle', displayName: 'Seattle Seahawks' },
  { id: '27', abbr: 'TB', name: 'Buccaneers', city: 'Tampa Bay', displayName: 'Tampa Bay Buccaneers' },
  { id: '28', abbr: 'WSH', name: 'Commanders', city: 'Washington', displayName: 'Washington Commanders' },
  { id: '29', abbr: 'CAR', name: 'Panthers', city: 'Carolina', displayName: 'Carolina Panthers' },
  { id: '30', abbr: 'JAX', name: 'Jaguars', city: 'Jacksonville', displayName: 'Jacksonville Jaguars' },
  { id: '33', abbr: 'BAL', name: 'Ravens', city: 'Baltimore', displayName: 'Baltimore Ravens' },
  { id: '34', abbr: 'HOU', name: 'Texans', city: 'Houston', displayName: 'Houston Texans' },
];

export const TEAM_BY_ABBR = new Map<string, (typeof NFL_TEAMS)[0]>();
export const TEAM_BY_ID = new Map<string, (typeof NFL_TEAMS)[0]>();
for (const tm of NFL_TEAMS) {
  TEAM_BY_ABBR.set(tm.abbr, tm);
  TEAM_BY_ID.set(tm.id, tm);
}

// In-memory global cache across serverless warm executions
let masterCache: MasterPlayer[] | null = null;
let lastMasterFetchTime = 0;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

/**
 * Normalizes NFL position abbreviations to standard fantasy skill positions
 */
export function normalizeFantasyPosition(rawPos?: string): FantasyPosition | null {
  if (!rawPos) return null;
  const p = rawPos.toUpperCase().trim();
  if (p === 'QB') return 'QB';
  if (p === 'RB' || p === 'FB' || p === 'HB') return 'RB';
  if (p === 'WR') return 'WR';
  if (p === 'TE') return 'TE';
  if (p === 'K' || p === 'PK') return 'K';
  if (p === 'DEF' || p === 'D/ST' || p === 'DST') return 'DEF';
  return null;
}

/**
 * Ensures key active players like Matthew Golden (#0 WR, Green Bay) are guaranteed to exist
 */
const KNOWN_ACTIVE_PLAYERS: MasterPlayer[] = [
  {
    id: '4242355',
    name: 'Jake Ferguson',
    shortName: 'J. Ferguson',
    position: 'TE',
    teamAbbr: 'DAL',
    teamId: '6',
    teamName: 'Dallas Cowboys',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/dal.png',
    jersey: '87',
    headshot: 'https://a.espncdn.com/i/headshots/nfl/players/full/4242355.png',
    depthChartOrder: 1,
  },
  {
    id: '4701936',
    name: 'Matthew Golden',
    shortName: 'M. Golden',
    position: 'WR',
    teamAbbr: 'GB',
    teamId: '9',
    teamName: 'Green Bay Packers',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/gb.png',
    jersey: '0',
    headshot: 'https://a.espncdn.com/i/headshots/nfl/players/full/4701936.png',
    depthChartOrder: 2,
  },
  {
    id: '4241389',
    name: 'CeeDee Lamb',
    shortName: 'C. Lamb',
    position: 'WR',
    teamAbbr: 'DAL',
    teamId: '6',
    teamName: 'Dallas Cowboys',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/dal.png',
    jersey: '88',
    headshot: 'https://a.espncdn.com/i/headshots/nfl/players/full/4241389.png',
    depthChartOrder: 1,
  },
  {
    id: '4361579',
    name: 'Javonte Williams',
    shortName: 'J. Williams',
    position: 'RB',
    teamAbbr: 'DAL',
    teamId: '6',
    teamName: 'Dallas Cowboys',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/dal.png',
    jersey: '33',
    headshot: 'https://a.espncdn.com/i/headshots/nfl/players/full/4361579.png',
    depthChartOrder: 1,
  },
  {
    id: '4432708',
    name: 'Tucker Kraft',
    shortName: 'T. Kraft',
    position: 'TE',
    teamAbbr: 'GB',
    teamId: '9',
    teamName: 'Green Bay Packers',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/gb.png',
    jersey: '85',
    headshot: 'https://a.espncdn.com/i/headshots/nfl/players/full/4432708.png',
    depthChartOrder: 1,
  },
  {
    id: '4361423',
    name: 'Luke Musgrave',
    shortName: 'L. Musgrave',
    position: 'TE',
    teamAbbr: 'GB',
    teamId: '9',
    teamName: 'Green Bay Packers',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/gb.png',
    jersey: '88',
    headshot: 'https://a.espncdn.com/i/headshots/nfl/players/full/4361423.png',
    depthChartOrder: 2,
  },
];

/**
 * Fetches and aggregates the full active NFL player database across all 32 teams.
 * Pulls from ESPN official team rosters with fallback and in-memory 1-hour caching.
 */
export async function getMasterNflPlayers(forceRefresh = false): Promise<MasterPlayer[]> {
  const now = Date.now();
  if (!forceRefresh && masterCache && masterCache.length > 300 && now - lastMasterFetchTime < CACHE_TTL_MS) {
    return masterCache;
  }

  const playerMap = new Map<string, MasterPlayer>();

  // 1. Pre-seed known key players
  for (const kp of KNOWN_ACTIVE_PLAYERS) {
    playerMap.set(kp.id, kp);
    playerMap.set(`${kp.name.toLowerCase().replace(/[^a-z]/g, '')}_${kp.teamAbbr.toLowerCase()}`, kp);
    playerMap.set(`${kp.name.toLowerCase()}_${kp.teamAbbr.toLowerCase()}`, kp);
  }

  // 2. Fetch all 32 team rosters from ESPN in parallel with batching and timeout
  try {
    const fetchPromises = NFL_TEAMS.map(async (team) => {
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${team.id}/roster`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000),
          next: { revalidate: 3600 },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return { team, data };
      } catch {
        return null;
      }
    });

    const results = await Promise.allSettled(fetchPromises);

    for (const res of results) {
      if (res.status !== 'fulfilled' || !res.value?.data?.athletes) continue;
      const { team, data } = res.value;

      for (const group of data.athletes) {
        const groupName = (group.position || '').toLowerCase();
        // Skip practice squad or suspended
        if (groupName === 'practicesquad' || groupName === 'suspended') continue;

        for (const item of group.items || []) {
          if (!item?.id) continue;
          const rawPos = item.position?.abbreviation || '';
          const fantasyPos = normalizeFantasyPosition(rawPos);
          if (!fantasyPos) continue;

          const athleteId = String(item.id);
          const fullName = item.displayName || item.fullName || item.name || 'Unknown Player';
          const shortName = item.shortName || item.displayName || fullName;
          const headshot =
            item.headshot?.href ||
            `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${athleteId}.png&w=96&h=70&cb=1`;

          const player: MasterPlayer = {
            id: athleteId,
            name: fullName,
            shortName,
            position: fantasyPos,
            teamAbbr: team.abbr,
            teamId: team.id,
            teamName: team.displayName,
            teamLogo: `https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/${team.abbr.toLowerCase()}.png`,
            jersey: item.jersey != null ? String(item.jersey) : undefined,
            headshot,
          };

          playerMap.set(athleteId, player);
          playerMap.set(`${fullName.toLowerCase()}_${team.abbr.toLowerCase()}`, player);
        }
      }
    }

    // 3. Add all 32 Team Defenses (DEF)
    for (const team of NFL_TEAMS) {
      const defId = `def-${team.abbr.toLowerCase()}`;
      playerMap.set(defId, {
        id: defId,
        name: `${team.name} Defense`,
        shortName: `${team.abbr} DEF`,
        position: 'DEF',
        teamAbbr: team.abbr,
        teamId: team.id,
        teamName: team.displayName,
        teamLogo: `https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/${team.abbr.toLowerCase()}.png`,
        headshot: `https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/${team.abbr.toLowerCase()}.png`,
      });
    }

    // De-duplicate by canonical ID
    const uniquePlayers = Array.from(new Set(Array.from(playerMap.values())));
    if (uniquePlayers.length > 300) {
      masterCache = uniquePlayers;
      lastMasterFetchTime = Date.now();
      return masterCache;
    }
  } catch (err) {
    console.error('Failed to update master NFL player cache:', err);
  }

  return masterCache || Array.from(playerMap.values());
}
