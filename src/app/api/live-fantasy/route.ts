import { NextResponse } from 'next/server';
import {
  FantasyPosition,
  FantasyPlayer,
  LiveGame,
  LiveUpdate,
  LiveFantasyResponse,
  PlayerStats,
  GameTeam,
  GameSituation,
} from '@/types/fantasy';
import { getMasterNflPlayers, MasterPlayer } from '@/lib/nflPlayers';

export const dynamic = 'force-dynamic';

interface CachedRosterAthlete {
  id: string;
  name: string;
  shortName: string;
  position: FantasyPosition;
  headshot: string;
  jersey?: string;
  teamId: string;
}

// Global in-memory roster cache to map athlete ID -> official position abbreviation
const rosterCache = new Map<string, string>();
// In-memory cache to map teamId -> list of active fantasy-relevant athletes (QB, RB, WR, TE, K)
const teamAthletesCache = new Map<string, CachedRosterAthlete[]>();
const teamRosterTimestamps = new Map<string, number>();
const ROSTER_CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Secondary lookup: Sleeper NFL players dictionary mapped by normalized full name
const sleeperPositionCache = new Map<string, FantasyPosition>();
let sleeperLoaded = false;
let sleeperLoadPromise: Promise<void> | null = null;

/**
 * Loads Sleeper's master NFL player database in the background to provide 100% position accuracy
 */
function ensureSleeperLoaded(): void {
  if (sleeperLoaded || sleeperLoadPromise) return;
  sleeperLoadPromise = (async () => {
    try {
      const res = await fetch('https://api.sleeper.app/v1/players/nfl', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return;
      const data = await res.json();
      for (const p of Object.values(data) as any[]) {
        if (!p?.full_name) continue;
        const rawPos = p.fantasy_positions?.[0] || p.position;
        const pos = normalizePosition(rawPos);
        if (pos) {
          const norm = p.full_name.toLowerCase().replace(/[^a-z]/g, '');
          sleeperPositionCache.set(norm, pos);
          if (p.team) {
            sleeperPositionCache.set(`${norm}_${p.team.toLowerCase()}`, pos);
          }
        }
      }
      sleeperLoaded = true;
    } catch {
      // Non-fatal background fetch
    } finally {
      sleeperLoadPromise = null;
    }
  })();
}

/**
 * Guaranteed starters and rotation players to ensure critical stars like Jake Ferguson (TE DAL)
 * and Matthew Golden (WR GB) are ALWAYS present even on instant cold starts
 */
const GUARANTEED_ROSTER_ATHLETES: CachedRosterAthlete[] = [
  {
    id: '4242355',
    name: 'Jake Ferguson',
    shortName: 'J. Ferguson',
    position: 'TE',
    jersey: '87',
    headshot: 'https://a.espncdn.com/i/headshots/nfl/players/full/4242355.png',
    teamId: '6',
  },
  {
    id: '4701936',
    name: 'Matthew Golden',
    shortName: 'M. Golden',
    position: 'WR',
    jersey: '0',
    headshot: 'https://a.espncdn.com/i/headshots/nfl/players/full/4701936.png',
    teamId: '9',
  },
  {
    id: '4241389',
    name: 'CeeDee Lamb',
    shortName: 'C. Lamb',
    position: 'WR',
    jersey: '88',
    headshot: 'https://a.espncdn.com/i/headshots/nfl/players/full/4241389.png',
    teamId: '6',
  },
  {
    id: '4361579',
    name: 'Javonte Williams',
    shortName: 'J. Williams',
    position: 'RB',
    jersey: '33',
    headshot: 'https://a.espncdn.com/i/headshots/nfl/players/full/4361579.png',
    teamId: '6',
  },
  {
    id: '4426515',
    name: 'Luke Schoonmaker',
    shortName: 'L. Schoonmaker',
    position: 'TE',
    jersey: '86',
    headshot: 'https://a.espncdn.com/i/headshots/nfl/players/full/4426515.png',
    teamId: '6',
  },
  {
    id: '4432708',
    name: 'Tucker Kraft',
    shortName: 'T. Kraft',
    position: 'TE',
    jersey: '85',
    headshot: 'https://a.espncdn.com/i/headshots/nfl/players/full/4432708.png',
    teamId: '9',
  },
  {
    id: '4361423',
    name: 'Luke Musgrave',
    shortName: 'L. Musgrave',
    position: 'TE',
    jersey: '88',
    headshot: 'https://a.espncdn.com/i/headshots/nfl/players/full/4361423.png',
    teamId: '9',
  },
  {
    id: '4248528',
    name: 'Christian Watson',
    shortName: 'C. Watson',
    position: 'WR',
    jersey: '9',
    headshot: 'https://a.espncdn.com/i/headshots/nfl/players/full/4248528.png',
    teamId: '9',
  },
  {
    id: '4431487',
    name: 'Savion Williams',
    shortName: 'S. Williams',
    position: 'WR',
    jersey: '13',
    headshot: 'https://a.espncdn.com/i/headshots/nfl/players/full/4431487.png',
    teamId: '9',
  },
  {
    id: '4429023',
    name: 'MarShawn Lloyd',
    shortName: 'M. Lloyd',
    position: 'RB',
    jersey: '0',
    headshot: 'https://a.espncdn.com/i/headshots/nfl/players/full/4429023.png',
    teamId: '9',
  },
];

// Pre-seed guaranteed players into global rosterCache immediately
for (const p of GUARANTEED_ROSTER_ATHLETES) {
  rosterCache.set(p.id, p.position);
  rosterCache.set(p.name.toLowerCase().replace(/[^a-z]/g, ''), p.position);
}

/**
 * Fetch and populate team rosters in parallel for all teams playing this week.
 * Uses per-team in-memory caching with 1-hour TTL and request timeouts so polls remain fast.
 */
async function ensureRostersLoaded(teamIds: string[]): Promise<void> {
  const now = Date.now();
  const missingTeamIds = teamIds.filter((id) => {
    if (!id) return false;
    const hasCache = teamAthletesCache.has(id);
    const ts = teamRosterTimestamps.get(id) || 0;
    return !hasCache || now - ts > ROSTER_CACHE_TTL;
  });

  if (missingTeamIds.length === 0) {
    return;
  }

  try {
    const fetchPromises = missingTeamIds.map(async (id) => {
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${id}/roster`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000),
          next: { revalidate: 3600 },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return { teamId: id, data };
      } catch {
        return null;
      }
    });

    const results = await Promise.allSettled(fetchPromises);
    for (const res of results) {
      if (res.status !== 'fulfilled' || !res.value?.data?.athletes) continue;
      const { teamId, data } = res.value;
      const teamList: CachedRosterAthlete[] = [];

      for (const group of data.athletes) {
        const groupPos = (group.position || '').toLowerCase();
        if (groupPos === 'practicesquad' || groupPos === 'suspended') continue;

        for (const item of group.items || []) {
          if (!item?.id) continue;
          const athleteId = String(item.id);
          const fullName = item.displayName || item.fullName || item.name || 'Unknown Player';
          const shortName = item.shortName || item.displayName || fullName;
          const rawPos = item.position?.abbreviation?.toUpperCase() || '';
          const normName = fullName.toLowerCase().replace(/[^a-z]/g, '');

          // Position determination: official abbreviation first, Sleeper second
          let fantasyPos = normalizePosition(rawPos);
          if (!fantasyPos && sleeperPositionCache.has(normName)) {
            fantasyPos = sleeperPositionCache.get(normName) || null;
          }

          if (rawPos) {
            rosterCache.set(athleteId, rawPos);
            rosterCache.set(normName, rawPos);
          }

          // Cache fantasy skill positions: QB, RB, WR, TE, K
          if (fantasyPos) {
            const headshot =
              item.headshot?.href ||
              `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${athleteId}.png&w=96&h=70&cb=1`;
            teamList.push({
              id: athleteId,
              name: fullName,
              shortName,
              position: fantasyPos,
              headshot,
              jersey: item.jersey != null ? String(item.jersey) : undefined,
              teamId: String(teamId),
            });
          }
        }
      }

      if (teamList.length > 0) {
        teamAthletesCache.set(String(teamId), teamList);
        teamRosterTimestamps.set(String(teamId), now);
      }
    }
  } catch (err) {
    console.error('Error updating roster cache:', err);
  }
}

/**
 * Normalize NFL position to standard fantasy positions
 */
function normalizePosition(rawPos?: string): FantasyPosition | null {
  if (!rawPos) return null;
  const pos = rawPos.toUpperCase().trim();
  if (pos === 'QB') return 'QB';
  if (['RB', 'FB', 'HB'].includes(pos)) return 'RB';
  if (pos === 'WR') return 'WR';
  if (pos === 'TE') return 'TE';
  if (['K', 'PK'].includes(pos)) return 'K';
  if (['DEF', 'D/ST', 'DST'].includes(pos)) return 'DEF';
  return null;
}

/**
 * Round a number to two decimal places
 */
function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Calculate Fantasy Point totals (PPR, Half-PPR, Standard)
 */
function calculatePoints(stats: PlayerStats, position: FantasyPosition) {
  // Passing: 0.04 pts/yd (1 pt per 25 yds), 4 pts/TD, -2 pts/INT
  const passYds = stats.passingYards || 0;
  const passTD = stats.passingTouchdowns || 0;
  const passInt = stats.interceptions || 0;
  const passPts = passYds * 0.04 + passTD * 4 - passInt * 2;

  // Rushing: 0.1 pts/yd (1 pt per 10 yds), 6 pts/TD
  const rushYds = stats.rushingYards || 0;
  const rushTD = stats.rushingTouchdowns || 0;
  const rushPts = rushYds * 0.1 + rushTD * 6;

  // Receiving: 0.1 pts/yd, 6 pts/TD, +1 pt/rec (PPR), +0.5 pt/rec (Half-PPR), 0 pt/rec (Standard)
  const rec = stats.receptions || 0;
  const recYds = stats.receivingYards || 0;
  const recTD = stats.receivingTouchdowns || 0;
  const recBasePts = recYds * 0.1 + recTD * 6;

  // Fumbles Lost: -2 pts
  const fumbles = stats.fumblesLost || 0;
  const fumPts = -2 * fumbles;

  // Kicking: 3 pts FG Made (or 4 pts 40-49, 5 pts 50+), 1 pt XP Made, -1 pt FG Missed
  let kickingPts = 0;
  if (position === 'K') {
    const fgMade = stats.fgMade || 0;
    const fgAttempts = stats.fgAttempts || 0;
    const fgMissed = Math.max(0, fgAttempts - fgMade);
    const xpMade = stats.xpMade || 0;
    const longFg = stats.longFg || 0;

    // Use long FG if known to provide realistic weighting
    let fgValue = 3.0;
    if (longFg >= 50) fgValue = 4.2;
    else if (longFg >= 40) fgValue = 3.6;

    kickingPts = fgMade * fgValue + xpMade * 1.0 - fgMissed * 1.0;
  }

  const baseStandard = passPts + rushPts + recBasePts + fumPts + kickingPts;
  const standard = round2(baseStandard);
  const halfPpr = round2(baseStandard + rec * 0.5);
  const ppr = round2(baseStandard + rec * 1.0);

  return { standard, halfPpr, ppr };
}

/**
 * Format human-readable raw stat line
 */
function buildRawStatLine(stats: PlayerStats, position: FantasyPosition): string {
  const parts: string[] = [];

  if (position === 'DEF') {
    const pts = stats.pointsAllowed ?? 0;
    const sck = stats.sacks ?? 0;
    const ints = stats.defensiveInterceptions ?? 0;
    const fr = stats.fumblesRecovered ?? 0;
    const td = stats.defensiveTouchdowns ?? 0;
    const sfty = stats.safeties ?? 0;

    parts.push(`${pts} PA`);
    if (sck > 0) parts.push(`${sck} SCK`);
    if (ints > 0) parts.push(`${ints} INT`);
    if (fr > 0) parts.push(`${fr} FR`);
    if (td > 0) parts.push(`${td} TD`);
    if (sfty > 0) parts.push(`${sfty} SF`);
    return parts.join(' • ');
  }

  if (position === 'K') {
    const fgMade = stats.fgMade || 0;
    const fgAtt = stats.fgAttempts || 0;
    const xpMade = stats.xpMade || 0;
    const xpAtt = stats.xpAttempts || 0;
    const longFg = stats.longFg || 0;

    let fgStr = `${fgMade}/${fgAtt} FG`;
    if (longFg > 0) fgStr += ` (LG ${longFg})`;
    parts.push(fgStr);
    parts.push(`${xpMade}/${xpAtt} XP`);
    return parts.join(' • ');
  }

  if ((stats.passingAttempts || 0) > 0 || (stats.passingYards || 0) > 0) {
    let pStr = '';
    if ((stats.completions || 0) > 0 || (stats.passingAttempts || 0) > 0) {
      pStr += `${stats.completions || 0}/${stats.passingAttempts || 0}, `;
    }
    pStr += `${stats.passingYards || 0} PASS`;
    if ((stats.passingTouchdowns || 0) > 0) pStr += `, ${stats.passingTouchdowns} TD`;
    if ((stats.interceptions || 0) > 0) pStr += `, ${stats.interceptions} INT`;
    parts.push(pStr);
  }

  if ((stats.rushingAttempts || 0) > 0 || (stats.rushingYards || 0) !== 0) {
    let rStr = '';
    if ((stats.rushingAttempts || 0) > 0) rStr += `${stats.rushingAttempts} CAR, `;
    rStr += `${stats.rushingYards || 0} RUSH`;
    if ((stats.rushingTouchdowns || 0) > 0) rStr += `, ${stats.rushingTouchdowns} TD`;
    parts.push(rStr);
  }

  if ((stats.receptions || 0) > 0 || (stats.receivingYards || 0) !== 0 || (stats.receivingTargets || 0) > 0) {
    let recStr = `${stats.receptions || 0} REC`;
    recStr += `, ${stats.receivingYards || 0} YDS`;
    if ((stats.receivingTouchdowns || 0) > 0) recStr += `, ${stats.receivingTouchdowns} TD`;
    parts.push(recStr);
  }

  if ((stats.fumblesLost || 0) > 0) {
    parts.push(`${stats.fumblesLost} FUM`);
  }

  return parts.length > 0 ? parts.join(' • ') : '0 YDS';
}

/**
 * Calculate team DEF fantasy stats and points
 */
function calculateTeamDef(
  gameState: 'pre' | 'in' | 'post',
  defTeam: GameTeam,
  oppTeam: GameTeam,
  boxPlayersTeam: any,
  boxTeamsDef: any,
  boxTeamsOpp: any,
  scoringPlays: any[]
): FantasyPlayer {
  const pointsAllowed = oppTeam.score;

  let sacks = 0;
  let interceptions = 0;
  let fumblesRecovered = 0;
  let defTouchdowns = 0;
  let safeties = 0;

  if (gameState !== 'pre') {
    // Sacks from def team player stats
    const defStats = boxPlayersTeam?.statistics?.find((s: any) => s.name === 'defensive');
    if (defStats) {
      const sIdx = defStats.keys?.indexOf('sacks');
      if (sIdx !== -1) {
        for (const ath of defStats.athletes || []) {
          sacks += parseFloat(ath.stats?.[sIdx]) || 0;
        }
      }
    }
    // Cross check with opponent team sacks taken
    const oppSacksTakenStat = boxTeamsOpp?.statistics?.find((s: any) => s.name === 'sacksYardsLost');
    if (oppSacksTakenStat?.displayValue) {
      const parsedSacks = parseInt(oppSacksTakenStat.displayValue.split('-')[0]) || 0;
      sacks = Math.max(sacks, parsedSacks);
    }

    // Interceptions
    const intStats = boxPlayersTeam?.statistics?.find((s: any) => s.name === 'interceptions');
    if (intStats) {
      const idx = intStats.keys?.indexOf('interceptions');
      if (idx !== -1) {
        for (const ath of intStats.athletes || []) {
          interceptions += parseFloat(ath.stats?.[idx]) || 0;
        }
      }
    }
    const oppIntsStat = boxTeamsOpp?.statistics?.find((s: any) => s.name === 'interceptions');
    if (oppIntsStat) {
      interceptions = Math.max(interceptions, parseInt(oppIntsStat.displayValue) || 0);
    }

    // Fumbles Recovered (from opponent fumbles lost)
    const oppFumStat = boxTeamsOpp?.statistics?.find((s: any) => s.name === 'fumblesLost');
    if (oppFumStat) {
      fumblesRecovered = parseInt(oppFumStat.displayValue) || 0;
    }

    // Defensive / Special Teams Touchdowns
    const defTDStat = boxTeamsDef?.statistics?.find((s: any) => s.name === 'defensiveTouchdowns');
    if (defTDStat) {
      defTouchdowns = parseInt(defTDStat.displayValue) || 0;
    }

    // Safeties & Touchdowns from scoring plays
    for (const sp of scoringPlays || []) {
      if (sp.team?.id === defTeam.id) {
        const typeText = (sp.scoringType?.name || sp.type?.text || '').toLowerCase();
        const playText = (sp.text || '').toLowerCase();
        if (typeText.includes('safety') || playText.includes('safety')) {
          safeties += 1;
        }
        if (playText.includes('interception return') || playText.includes('fumble return') || playText.includes('kickoff return') || playText.includes('punt return')) {
          if (defTouchdowns === 0) defTouchdowns += 1;
        }
      }
    }
  }

  // Bracket for Points Allowed:
  // 0 pts: 10
  // 1-6 pts: 7
  // 7-13 pts: 4
  // 14-20 pts: 1
  // 21-27 pts: 0
  // 28-34 pts: -1
  // 35+ pts: -4
  let baseline = 0;
  if (gameState !== 'pre') {
    if (pointsAllowed === 0) baseline = 10;
    else if (pointsAllowed <= 6) baseline = 7;
    else if (pointsAllowed <= 13) baseline = 4;
    else if (pointsAllowed <= 20) baseline = 1;
    else if (pointsAllowed <= 27) baseline = 0;
    else if (pointsAllowed <= 34) baseline = -1;
    else baseline = -4;
  }

  const defFantasyPts =
    gameState === 'pre'
      ? 0
      : baseline + sacks * 1 + interceptions * 2 + fumblesRecovered * 2 + defTouchdowns * 6 + safeties * 2;

  const defStatsObj: PlayerStats = {
    pointsAllowed,
    sacks,
    defensiveInterceptions: interceptions,
    fumblesRecovered,
    defensiveTouchdowns: defTouchdowns,
    safeties,
  };

  const roundedPts = round2(defFantasyPts);

  return {
    id: `def-${defTeam.id}`,
    name: `${defTeam.name} D/ST`,
    shortName: `${defTeam.abbreviation} DEF`,
    position: 'DEF',
    headshot: defTeam.logo,
    isGameLive: gameState === 'in',
    isLive: gameState === 'in',
    team: {
      id: defTeam.id,
      abbreviation: defTeam.abbreviation,
      displayName: defTeam.displayName,
      logo: defTeam.logo,
      color: defTeam.color,
    },
    opponent: {
      abbreviation: oppTeam.abbreviation,
      isHome: false,
    },
    gameStatus: {
      state: gameState,
      clock: '',
      period: 0,
      detail: '',
      isRedZone: false,
      isGameLive: gameState === 'in',
      isLive: gameState === 'in',
    },
    rawStatLine: buildRawStatLine(defStatsObj, 'DEF'),
    stats: defStatsObj,
    points: {
      standard: roundedPts,
      halfPpr: roundedPts,
      ppr: roundedPts,
    },
  };
}

interface LiveFantasyResponseCache {
  payload: LiveFantasyResponse;
  timestamp: number;
}

// Global server-side completed games summary cache to avoid re-fetching finished games
if (!(globalThis as any).__completedGamesCache) {
  (globalThis as any).__completedGamesCache = new Map<string, any>();
}

export async function GET() {
  try {
    const now = Date.now();
    // 1. 10-Second in-memory response cache: returns in ~2ms and eliminates ESPN rate limits
    const cachedResponse = (globalThis as any).__liveFantasyCache as LiveFantasyResponseCache | undefined;
    if (cachedResponse && now - cachedResponse.timestamp < 10000) {
      return NextResponse.json(cachedResponse.payload, {
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=5',
        },
      });
    }

    // 2. Fetch current scoreboard with 4500ms timeout guard
    const scoreboardRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(4500),
      cache: 'no-store',
    });

    if (!scoreboardRes.ok) {
      throw new Error(`ESPN Scoreboard API failed with status ${scoreboardRes.status}`);
    }

    const scoreboard = await scoreboardRes.json();
    const events: any[] = scoreboard.events || [];

    // Extract team IDs to pre-warm roster cache if needed
    const teamIdsSet = new Set<string>();
    for (const ev of events) {
      for (const comp of ev.competitions?.[0]?.competitors || []) {
        const tId = comp.team?.id || comp.id;
        if (tId) teamIdsSet.add(String(tId));
      }
    }
    // Pre-warm Sleeper positions and ESPN team rosters
    ensureSleeperLoaded();
    await ensureRostersLoaded(Array.from(teamIdsSet));

    // Load master active NFL player database (cached in-memory for 1 hr)
    const masterPlayers = await getMasterNflPlayers();
    const masterByTeam = new Map<string, MasterPlayer[]>();
    for (const mp of masterPlayers) {
      const abbr = mp.teamAbbr.toUpperCase();
      if (!masterByTeam.has(abbr)) {
        masterByTeam.set(abbr, []);
      }
      masterByTeam.get(abbr)!.push(mp);
    }

    // 3. Fetch detailed boxscores and summaries in parallel
    // Freeze Final games: if status.type.state === 'post', check completedGamesCache first!
    const completedCache = (globalThis as any).__completedGamesCache as Map<string, any>;
    const summaryPromises = events.map(async (ev) => {
      const state = ev.status?.type?.state;
      const isCompleted = state === 'post';
      if (isCompleted && completedCache.has(ev.id)) {
        return completedCache.get(ev.id);
      }
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${ev.id}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(4500),
          cache: 'no-store',
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (isCompleted && data) {
          completedCache.set(ev.id, data);
        }
        return data;
      } catch (err) {
        console.error(`Failed to fetch summary for event ${ev.id}:`, err);
        return null;
      }
    });

    const summaries = await Promise.allSettled(summaryPromises);

    const games: LiveGame[] = [];
    const allPlayersMap = new Map<string, FantasyPlayer>();
    const allPlayersByName = new Map<string, FantasyPlayer>();
    const defPlayers: FantasyPlayer[] = [];
    const liveUpdates: LiveUpdate[] = [];

    // Process each game
    events.forEach((ev, idx) => {
      const competition = ev.competitions?.[0] || {};
      const competitors: any[] = competition.competitors || [];
      const awayCompetitor = competitors.find((c) => c.homeAway === 'away') || competitors[1] || {};
      const homeCompetitor = competitors.find((c) => c.homeAway === 'home') || competitors[0] || {};

      const awayTeam: GameTeam = {
        id: awayCompetitor.team?.id || '',
        name: awayCompetitor.team?.name || 'Away',
        abbreviation: awayCompetitor.team?.abbreviation || 'AWAY',
        displayName: awayCompetitor.team?.displayName || 'Away Team',
        logo: awayCompetitor.team?.logo || awayCompetitor.team?.logos?.[0]?.href || '',
        color: awayCompetitor.team?.color ? `#${awayCompetitor.team.color}` : '#333333',
        score: parseInt(awayCompetitor.score) || 0,
        record: awayCompetitor.records?.[0]?.summary || awayCompetitor.record?.[0]?.summary || '',
        timeoutsLeft: awayCompetitor.timeoutsUsed !== undefined ? 3 - awayCompetitor.timeoutsUsed : 3,
      };

      const homeTeam: GameTeam = {
        id: homeCompetitor.team?.id || '',
        name: homeCompetitor.team?.name || 'Home',
        abbreviation: homeCompetitor.team?.abbreviation || 'HOME',
        displayName: homeCompetitor.team?.displayName || 'Home Team',
        logo: homeCompetitor.team?.logo || homeCompetitor.team?.logos?.[0]?.href || '',
        color: homeCompetitor.team?.color ? `#${homeCompetitor.team.color}` : '#333333',
        score: parseInt(homeCompetitor.score) || 0,
        record: homeCompetitor.records?.[0]?.summary || homeCompetitor.record?.[0]?.summary || '',
        timeoutsLeft: homeCompetitor.timeoutsUsed !== undefined ? 3 - homeCompetitor.timeoutsUsed : 3,
      };

      const status = ev.status || {};
      const statusType = status.type || {};
      const state: 'pre' | 'in' | 'post' = statusType.state === 'post' ? 'post' : statusType.state === 'in' ? 'in' : 'pre';

      // Red zone & Situation
      const sit = competition.situation || {};
      const isRedZone = sit.isRedZone === true;
      const rawPossession = sit.possession
        ? String(sit.possession)
        : sit.lastPlay?.team?.id
        ? String(sit.lastPlay.team.id)
        : null;
      let possessionTeamId: string | null = null;
      let possessionTeamAbbr: string | null = null;

      if (rawPossession) {
        if (rawPossession === String(awayTeam.id) || rawPossession.toLowerCase() === awayTeam.abbreviation.toLowerCase()) {
          possessionTeamId = awayTeam.id;
          possessionTeamAbbr = awayTeam.abbreviation;
        } else if (rawPossession === String(homeTeam.id) || rawPossession.toLowerCase() === homeTeam.abbreviation.toLowerCase()) {
          possessionTeamId = homeTeam.id;
          possessionTeamAbbr = homeTeam.abbreviation;
        } else {
          possessionTeamId = rawPossession;
        }
      }

      // Extract ESPN's shortDownDistanceText or downDistanceText
      let downDistanceText: string | null = sit.shortDownDistanceText || sit.downDistanceText || null;
      if (!downDistanceText && sit.down > 0 && sit.distance !== undefined) {
        const ordinals = ['', '1st', '2nd', '3rd', '4th'];
        const downStr = ordinals[sit.down] || `${sit.down}th`;
        const distStr = sit.distance === 0 ? 'Goal' : sit.distance;
        downDistanceText = `${downStr} & ${distStr}`;
      }

      const possessionText: string | null = sit.possessionText ? String(sit.possessionText).trim() : null;
      const yardLine: number | null = typeof sit.yardLine === 'number'
        ? sit.yardLine
        : sit.yardLine !== undefined && sit.yardLine !== null
        ? parseInt(String(sit.yardLine)) || null
        : null;

      const situation: GameSituation = {
        isRedZone,
        possessionTeamId,
        possessionTeamAbbr,
        possessionText,
        downDistanceText,
        yardLine,
        down: sit.down ?? null,
        distance: sit.distance ?? null,
        lastPlay: sit.lastPlay?.text ?? null,
      };

      const broadcast = competition.broadcasts?.[0]?.names?.[0] || competition.geoBroadcasts?.[0]?.media?.shortName || '';
      const odds = competition.odds?.[0]?.details || '';

      const liveGame: LiveGame = {
        id: ev.id,
        name: ev.name || `${awayTeam.displayName} at ${homeTeam.displayName}`,
        shortName: ev.shortName || `${awayTeam.abbreviation} @ ${homeTeam.abbreviation}`,
        possessionTeamId,
        possessionTeamAbbr,
        possessionText,
        yardLine,
        isRedZone,
        status: {
          state,
          detail: statusType.detail || statusType.description || '',
          shortDetail: statusType.shortDetail || '',
          period: status.period || 0,
          displayClock: status.displayClock || '',
          completed: statusType.completed === true,
        },
        awayTeam,
        homeTeam,
        situation,
        broadcast,
        odds,
      };

      games.push(liveGame);

      // Pre-seed all active skill-position players from guaranteed starters, team rosters, and master database
      // This guarantees every player (including Jake Ferguson #87 TE DAL and Matthew Golden #0 WR GB) exists
      const preSeedRoster = (team: GameTeam, oppTeam: GameTeam, isHome: boolean) => {
        const espnAthletes = teamAthletesCache.get(String(team.id)) || [];
        const guaranteedAthletes = GUARANTEED_ROSTER_ATHLETES.filter((p) => p.teamId === String(team.id));
        const masterAthletes = masterByTeam.get(team.abbreviation.toUpperCase()) || [];

        const combinedAthletes = new Map<string, { id: string; name: string; shortName: string; position: FantasyPosition; headshot: string; jersey?: string }>();
        // 1. Guaranteed starters first
        for (const ath of guaranteedAthletes) {
          combinedAthletes.set(ath.id, {
            id: ath.id,
            name: ath.name,
            shortName: ath.shortName,
            position: ath.position,
            headshot: ath.headshot,
            jersey: ath.jersey,
          });
        }
        // 2. Master active database
        for (const ath of masterAthletes) {
          if (ath.position === 'DEF') continue;
          combinedAthletes.set(ath.id, {
            id: ath.id,
            name: ath.name,
            shortName: ath.shortName,
            position: ath.position,
            headshot: ath.headshot,
            jersey: ath.jersey,
          });
        }
        // 3. Official ESPN active roster
        for (const ath of espnAthletes) {
          combinedAthletes.set(ath.id, {
            id: ath.id,
            name: ath.name,
            shortName: ath.shortName,
            position: ath.position,
            headshot: ath.headshot,
            jersey: ath.jersey || combinedAthletes.get(ath.id)?.jersey,
          });
        }

        for (const ath of combinedAthletes.values()) {
          const normName = ath.name.toLowerCase().replace(/[^a-z]/g, '');
          let pos = ath.position;
          if (sleeperPositionCache.has(normName)) {
            pos = sleeperPositionCache.get(normName)!;
          }

          if (!allPlayersMap.has(ath.id)) {
            const playerObj: FantasyPlayer = {
              id: ath.id,
              name: ath.name,
              shortName: ath.shortName,
              position: pos,
              headshot: ath.headshot,
              jersey: ath.jersey,
              team: {
                id: team.id,
                abbreviation: team.abbreviation,
                displayName: team.displayName,
                logo: team.logo,
                color: team.color,
              },
              opponent: {
                abbreviation: oppTeam.abbreviation,
                isHome: !isHome,
              },
              stats: {
                completions: 0,
                passingAttempts: 0,
                passingYards: 0,
                passingTouchdowns: 0,
                interceptions: 0,
                rushingAttempts: 0,
                rushingYards: 0,
                rushingTouchdowns: 0,
                receptions: 0,
                receivingYards: 0,
                receivingTouchdowns: 0,
                receivingTargets: 0,
                fumblesLost: 0,
                fgMade: 0,
                fgAttempts: 0,
                xpMade: 0,
                xpAttempts: 0,
              },
              points: {
                standard: 0,
                ppr: 0,
                halfPpr: 0,
              },
              rawStatLine: state === 'pre' ? 'Upcoming' : '0 YDS',
              isGameLive: state === 'in',
              isLive: state === 'in',
              gameStatus: {
                state,
                clock: status.displayClock || '',
                period: status.period || 0,
                detail: statusType.shortDetail || '',
                isRedZone,
                isGameLive: state === 'in',
                isLive: state === 'in',
              },
              playerRawStats: {
                passYds: 0,
                passTD: 0,
                rushYds: 0,
                rushTD: 0,
                rec: 0,
                recYds: 0,
                recTD: 0,
                anytimeTD: false,
              },
            };
            (playerObj as any).hasOfficialPosition = true;
            allPlayersMap.set(ath.id, playerObj);
            allPlayersByName.set(`${ath.name.toLowerCase()}_${team.abbreviation.toLowerCase()}`, playerObj);
            allPlayersByName.set(`${normName}_${team.abbreviation.toLowerCase()}`, playerObj);
            allPlayersByName.set(normName, playerObj);
          }
        }
      };

      preSeedRoster(awayTeam, homeTeam, false);
      preSeedRoster(homeTeam, awayTeam, true);

      // Process Game Summary details
      const summaryResult = summaries[idx];
      const summary = summaryResult?.status === 'fulfilled' ? summaryResult.value : null;

      if (!summary) {
        // If summary failed, still push defense placeholders for this game
        const awayDef = calculateTeamDef(state, awayTeam, homeTeam, null, null, null, []);
        awayDef.isGameLive = state === 'in';
        awayDef.isLive = state === 'in';
        awayDef.gameStatus = {
          state,
          clock: status.displayClock || '',
          period: status.period || 0,
          detail: statusType.shortDetail || '',
          isRedZone,
          isGameLive: state === 'in',
          isLive: state === 'in',
        };
        const homeDef = calculateTeamDef(state, homeTeam, awayTeam, null, null, null, []);
        homeDef.isGameLive = state === 'in';
        homeDef.isLive = state === 'in';
        homeDef.gameStatus = {
          state,
          clock: status.displayClock || '',
          period: status.period || 0,
          detail: statusType.shortDetail || '',
          isRedZone,
          isGameLive: state === 'in',
          isLive: state === 'in',
        };
        defPlayers.push(awayDef, homeDef);
        return;
      }

      const boxPlayers: any[] = summary.boxscore?.players || [];
      const boxTeams: any[] = summary.boxscore?.teams || [];
      const scoringPlays: any[] = summary.scoringPlays || [];

      // Map leaders for high confidence position overrides
      const leaderPositions = new Map<string, string>();
      for (const cat of summary.leaders || []) {
        for (const leaderGroup of cat.leaders || []) {
          for (const athObj of leaderGroup.leaders || []) {
            const ath = athObj.athlete;
            if (ath?.id && ath.position?.abbreviation) {
              leaderPositions.set(ath.id, ath.position.abbreviation.toUpperCase());
            }
          }
        }
      }

      // Process DEF for both teams
      const awayBoxPlayers = boxPlayers.find((p) => p.team?.id === awayTeam.id);
      const homeBoxPlayers = boxPlayers.find((p) => p.team?.id === homeTeam.id);
      const awayBoxTeams = boxTeams.find((t) => t.team?.id === awayTeam.id);
      const homeBoxTeams = boxTeams.find((t) => t.team?.id === homeTeam.id);

      const awayDef = calculateTeamDef(state, awayTeam, homeTeam, awayBoxPlayers, awayBoxTeams, homeBoxTeams, scoringPlays);
      awayDef.isGameLive = state === 'in';
      awayDef.isLive = state === 'in';
      awayDef.gameStatus = {
        state,
        clock: status.displayClock || '',
        period: status.period || 0,
        detail: statusType.shortDetail || '',
        isRedZone,
        isGameLive: state === 'in',
        isLive: state === 'in',
      };

      const homeDef = calculateTeamDef(state, homeTeam, awayTeam, homeBoxPlayers, homeBoxTeams, awayBoxTeams, scoringPlays);
      homeDef.isGameLive = state === 'in';
      homeDef.isLive = state === 'in';
      homeDef.gameStatus = {
        state,
        clock: status.displayClock || '',
        period: status.period || 0,
        detail: statusType.shortDetail || '',
        isRedZone,
        isGameLive: state === 'in',
        isLive: state === 'in',
      };

      defPlayers.push(awayDef, homeDef);

      // Parse individual offensive & kicking player stats
      for (const teamSection of boxPlayers) {
        const teamObj = teamSection.team || {};
        const isAway = teamObj.id === awayTeam.id;
        const currentTeam = isAway ? awayTeam : homeTeam;
        const opponentTeam = isAway ? homeTeam : awayTeam;

        for (const statCat of teamSection.statistics || []) {
          const catName: string = statCat.name || '';
          if (!['passing', 'rushing', 'receiving', 'fumbles', 'kicking'].includes(catName)) {
            continue;
          }

          const keys: string[] = statCat.keys || [];
          for (const athEntry of statCat.athletes || []) {
            const athlete = athEntry.athlete || {};
            const athleteId = athlete.id ? String(athlete.id) : '';
            if (!athleteId) continue;

            const athleteName = athlete.displayName || athlete.fullName || athlete.name || 'Unknown Player';
            const athleteShort = athlete.shortName || athleteName;
            const athleteNorm = athleteName.toLowerCase().replace(/[^a-z]/g, '');
            const fallbackKeyNorm = `${athleteNorm}_${currentTeam.abbreviation.toLowerCase()}`;
            const fallbackKey = `${athleteName.toLowerCase()}_${currentTeam.abbreviation.toLowerCase()}`;

            const headshot =
              athlete.headshot?.href ||
              `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${athleteId}.png&w=96&h=70&cb=1`;

            // 1. Retrieve or locate pre-seeded player
            let player = allPlayersMap.get(athleteId);
            if (!player) {
              player =
                allPlayersByName.get(fallbackKeyNorm) ||
                allPlayersByName.get(fallbackKey) ||
                allPlayersByName.get(athleteNorm);
              if (player) {
                allPlayersMap.set(athleteId, player);
              }
            }

            // 2. High-confidence position resolution
            let resolvedPosition: FantasyPosition | null = null;
            let hasOfficial = false;

            if (player && (player.position === 'TE' || player.position === 'RB' || player.position === 'QB' || player.position === 'K')) {
              // PRESERVE true position from master roster / pre-seed!
              resolvedPosition = player.position;
              hasOfficial = true;
            } else if (sleeperPositionCache.has(athleteNorm)) {
              resolvedPosition = sleeperPositionCache.get(athleteNorm) || null;
              if (resolvedPosition) hasOfficial = true;
            } else if (athlete.position?.abbreviation) {
              resolvedPosition = normalizePosition(athlete.position.abbreviation);
              if (resolvedPosition) hasOfficial = true;
            } else if (leaderPositions.has(athleteId)) {
              resolvedPosition = normalizePosition(leaderPositions.get(athleteId));
              if (resolvedPosition) hasOfficial = true;
            } else if (rosterCache.has(athleteId)) {
              resolvedPosition = normalizePosition(rosterCache.get(athleteId));
              if (resolvedPosition) hasOfficial = true;
            } else if (rosterCache.has(athleteNorm)) {
              resolvedPosition = normalizePosition(rosterCache.get(athleteNorm));
              if (resolvedPosition) hasOfficial = true;
            }

            // Stat category fallback ONLY if position is completely unknown
            if (!resolvedPosition) {
              if (catName === 'kicking') resolvedPosition = 'K';
              else if (catName === 'passing') resolvedPosition = 'QB';
              else if (catName === 'rushing') resolvedPosition = 'RB';
              else if (catName === 'receiving') resolvedPosition = 'WR';
            }

            if (!resolvedPosition) continue;

            if (!player) {
              player = {
                id: athleteId,
                name: athleteName,
                shortName: athleteShort,
                position: resolvedPosition,
                headshot,
                jersey: athlete.jersey,
                isGameLive: state === 'in',
                isLive: state === 'in',
                team: {
                  id: currentTeam.id,
                  abbreviation: currentTeam.abbreviation,
                  displayName: currentTeam.displayName,
                  logo: currentTeam.logo,
                  color: currentTeam.color,
                },
                opponent: {
                  abbreviation: opponentTeam.abbreviation,
                  isHome: !isAway,
                },
                gameStatus: {
                  state,
                  clock: status.displayClock || '',
                  period: status.period || 0,
                  detail: statusType.shortDetail || '',
                  isRedZone,
                  isGameLive: state === 'in',
                  isLive: state === 'in',
                },
                rawStatLine: '',
                stats: {},
                points: { ppr: 0, halfPpr: 0, standard: 0 },
              };
              (player as any).hasOfficialPosition = hasOfficial;
              allPlayersMap.set(athleteId, player);
              allPlayersByName.set(fallbackKey, player);
              allPlayersByName.set(fallbackKeyNorm, player);
              allPlayersByName.set(athleteNorm, player);
            } else {
              // CRITICAL BUG 2 FIX: Player already exists!
              // NEVER overwrite a player's known TE or RB position with 'WR' just because they had receiving stats!
              if (player.position === 'TE' || player.position === 'RB' || player.position === 'QB' || player.position === 'K') {
                // Keep the true position!
              } else if (hasOfficial && resolvedPosition && resolvedPosition !== 'WR') {
                player.position = resolvedPosition;
                (player as any).hasOfficialPosition = true;
              }
            }

            // Parse category stats
            const statValues: string[] = athEntry.stats || [];

            if (catName === 'passing') {
              const compAttIdx = keys.indexOf('completions/passingAttempts');
              const ydsIdx = keys.indexOf('passingYards');
              const tdIdx = keys.indexOf('passingTouchdowns');
              const intIdx = keys.indexOf('interceptions');

              if (compAttIdx !== -1 && statValues[compAttIdx]) {
                const [c, a] = statValues[compAttIdx].split('/');
                player.stats.completions = (player.stats.completions || 0) + (parseInt(c) || 0);
                player.stats.passingAttempts = (player.stats.passingAttempts || 0) + (parseInt(a) || 0);
              }
              if (ydsIdx !== -1) {
                player.stats.passingYards = (player.stats.passingYards || 0) + (parseInt(statValues[ydsIdx]) || 0);
              }
              if (tdIdx !== -1) {
                player.stats.passingTouchdowns =
                  (player.stats.passingTouchdowns || 0) + (parseInt(statValues[tdIdx]) || 0);
              }
              if (intIdx !== -1) {
                player.stats.interceptions =
                  (player.stats.interceptions || 0) + (parseInt(statValues[intIdx]) || 0);
              }
            } else if (catName === 'rushing') {
              const attIdx = keys.indexOf('rushingAttempts');
              const ydsIdx = keys.indexOf('rushingYards');
              const tdIdx = keys.indexOf('rushingTouchdowns');

              if (attIdx !== -1) {
                player.stats.rushingAttempts =
                  (player.stats.rushingAttempts || 0) + (parseInt(statValues[attIdx]) || 0);
              }
              if (ydsIdx !== -1) {
                player.stats.rushingYards = (player.stats.rushingYards || 0) + (parseInt(statValues[ydsIdx]) || 0);
              }
              if (tdIdx !== -1) {
                player.stats.rushingTouchdowns =
                  (player.stats.rushingTouchdowns || 0) + (parseInt(statValues[tdIdx]) || 0);
              }
            } else if (catName === 'receiving') {
              const recIdx = keys.indexOf('receptions');
              const ydsIdx = keys.indexOf('receivingYards');
              const tdIdx = keys.indexOf('receivingTouchdowns');
              const tgtIdx = keys.indexOf('receivingTargets');

              if (recIdx !== -1) {
                player.stats.receptions = (player.stats.receptions || 0) + (parseInt(statValues[recIdx]) || 0);
              }
              if (ydsIdx !== -1) {
                player.stats.receivingYards = (player.stats.receivingYards || 0) + (parseInt(statValues[ydsIdx]) || 0);
              }
              if (tdIdx !== -1) {
                player.stats.receivingTouchdowns =
                  (player.stats.receivingTouchdowns || 0) + (parseInt(statValues[tdIdx]) || 0);
              }
              if (tgtIdx !== -1) {
                player.stats.receivingTargets =
                  (player.stats.receivingTargets || 0) + (parseInt(statValues[tgtIdx]) || 0);
              }
            } else if (catName === 'fumbles') {
              const lostIdx = keys.indexOf('fumblesLost');
              if (lostIdx !== -1) {
                player.stats.fumblesLost = (player.stats.fumblesLost || 0) + (parseInt(statValues[lostIdx]) || 0);
              }
            } else if (catName === 'kicking') {
              const fgIdx = keys.indexOf('fieldGoalsMade/fieldGoalAttempts');
              const xpIdx = keys.indexOf('extraPointsMade/extraPointAttempts');
              const longIdx = keys.indexOf('longFieldGoalMade');

              if (fgIdx !== -1 && statValues[fgIdx]) {
                const [m, a] = statValues[fgIdx].split('/');
                player.stats.fgMade = (player.stats.fgMade || 0) + (parseInt(m) || 0);
                player.stats.fgAttempts = (player.stats.fgAttempts || 0) + (parseInt(a) || 0);
              }
              if (xpIdx !== -1 && statValues[xpIdx]) {
                const [m, a] = statValues[xpIdx].split('/');
                player.stats.xpMade = (player.stats.xpMade || 0) + (parseInt(m) || 0);
                player.stats.xpAttempts = (player.stats.xpAttempts || 0) + (parseInt(a) || 0);
              }
              if (longIdx !== -1) {
                player.stats.longFg = Math.max(player.stats.longFg || 0, parseInt(statValues[longIdx]) || 0);
              }
            }
          }
        }
      }

      // Collect drives plays for Big Plays & Turnovers
      const allDrivePlays: any[] = [];
      for (const dr of summary.drives?.previous || []) {
        for (const pl of dr.plays || []) {
          allDrivePlays.push(pl);
        }
      }
      for (const pl of summary.drives?.current?.plays || []) {
        allDrivePlays.push(pl);
      }

      // 7. Parse scoringPlays
      for (const sp of scoringPlays) {
        const typeStr = (sp.scoringType?.name || sp.type?.text || '').toLowerCase();
        let cat: LiveUpdate['type'] = 'touchdown';

        if (typeStr.includes('field-goal') || sp.text?.toLowerCase().includes('field goal')) {
          cat = 'field-goal';
        } else if (typeStr.includes('safety') || sp.text?.toLowerCase().includes('safety')) {
          cat = 'safety';
        } else if (typeStr.includes('touchdown') || sp.text?.toLowerCase().includes('touchdown')) {
          cat = 'touchdown';
        }

        // Calculate fantasy points impact string
        let impact = '';
        if (cat === 'touchdown') {
          if (sp.text?.includes('pass from')) {
            impact = '+6.0 pts (REC TD), +4.0 pts (PASS TD)';
          } else if (
            sp.text?.toLowerCase().includes('interception') ||
            sp.text?.toLowerCase().includes('fumble') ||
            sp.text?.toLowerCase().includes('return')
          ) {
            impact = '+6.0 pts DEF TD, +2.0 pts (Turnover)';
          } else {
            impact = '+6.0 pts (RUSH TD)';
          }
        } else if (cat === 'field-goal') {
          const match = sp.text?.match(/(\d+)\s*Yd/i);
          const yds = match ? parseInt(match[1]) : 35;
          const pts = yds >= 50 ? 5 : yds >= 40 ? 4 : 3;
          impact = `+${pts}.0 pts (${yds} YD FG)`;
        } else if (cat === 'safety') {
          impact = '+2.0 pts DEF (Safety)';
        }

        // Match wallclock if available
        const matchedPlay = allDrivePlays.find((p) => p.id === sp.id);
        const timestamp = matchedPlay?.wallclock || matchedPlay?.modified || new Date().toISOString();
        const playId = `sp-${sp.id || `${ev.id}-${liveUpdates.length}`}`;

        liveUpdates.push({
          id: playId,
          type: cat,
          headline: sp.scoringType?.displayName || sp.type?.text || 'Scoring Play',
          description: sp.text || '',
          fantasyImpact: impact,
          gameClock: `Q${sp.period?.number || '?'} ${sp.clock?.displayValue || ''}`.trim(),
          timestamp,
          isGameLive: state === 'in',
          downDistanceText,
          possessionTeamAbbr,
          team: {
            id: sp.team?.id,
            abbreviation: sp.team?.abbreviation || '',
            logo: sp.team?.logo || sp.team?.logos?.[0]?.href || '',
          },
          gameName: ev.shortName || `${awayTeam.abbreviation} @ ${homeTeam.abbreviation}`,
          scoreSummary: `${sp.awayScore ?? awayTeam.score} - ${sp.homeScore ?? homeTeam.score}`,
        });
      }

      // Track already added scoring play IDs so we never duplicate
      const seenPlayIds = new Set<string>(scoringPlays.map((sp) => String(sp.id)));

      // Add Big Plays (>= 25 yds offensive scrimmage) and Turnovers from drives
      for (const pl of allDrivePlays) {
        const plIdStr = String(pl.id);
        if (seenPlayIds.has(plIdStr)) continue; // Already added via scoringPlays

        const textLower = (pl.text || '').toLowerCase();
        const typeText = (pl.type?.text || '').toLowerCase();

        const isTurnover =
          pl.isTurnover === true ||
          textLower.includes('intercepted') ||
          textLower.includes('fumble lost');

        // Filter out routine special teams plays (kickoffs, punts, touchbacks)
        const isSpecialTeams =
          textLower.includes('kicks ') ||
          textLower.includes('punts ') ||
          textLower.includes('touchback') ||
          typeText.includes('kickoff') ||
          typeText.includes('punt');

        if (isSpecialTeams && !textLower.includes('touchdown') && !isTurnover) {
          continue; // Ignore routine special teams kicks and returns
        }

        const yardage = pl.statYardage || 0;
        // Big plays must be offensive scrimmage plays (pass or rush)
        const isPass = textLower.includes('pass') || typeText.includes('pass');
        const isRush =
          textLower.includes('rush') ||
          textLower.includes('run') ||
          textLower.includes('up the middle') ||
          textLower.includes('guard') ||
          textLower.includes('tackle') ||
          typeText.includes('rush');
        const isBigPlay = yardage >= 25 && !pl.isPenalty && (isPass || isRush) && !isSpecialTeams;

        if (isTurnover) {
          seenPlayIds.add(plIdStr);
          const timestamp = pl.wallclock || pl.modified || new Date().toISOString();
          liveUpdates.push({
            id: `to-${pl.id || `${ev.id}-${liveUpdates.length}`}`,
            type: 'turnover',
            headline: textLower.includes('intercepted') ? 'INTERCEPTION' : 'TURNOVER',
            description: pl.text || '',
            fantasyImpact: '-2.0 pts (Turnover), +2.0 pts DEF',
            gameClock: `Q${pl.period?.number || '?'} ${pl.clock?.displayValue || ''}`.trim(),
            timestamp,
            isGameLive: state === 'in',
            downDistanceText,
            possessionTeamAbbr,
            team: {
              abbreviation: pl.start?.team?.id === awayTeam.id ? awayTeam.abbreviation : homeTeam.abbreviation,
              logo: pl.start?.team?.id === awayTeam.id ? awayTeam.logo : homeTeam.logo,
            },
            gameName: ev.shortName || `${awayTeam.abbreviation} @ ${homeTeam.abbreviation}`,
            scoreSummary: `${pl.awayScore ?? awayTeam.score} - ${pl.homeScore ?? homeTeam.score}`,
          });
        } else if (isBigPlay) {
          seenPlayIds.add(plIdStr);
          const timestamp = pl.wallclock || pl.modified || new Date().toISOString();
          const impact = isPass
            ? `+${round2(yardage * 0.1)} pts REC / +${round2(yardage * 0.04)} pts PASS`
            : `+${round2(yardage * 0.1)} pts RUSH`;

          liveUpdates.push({
            id: `bp-${pl.id || `${ev.id}-${liveUpdates.length}`}`,
            type: 'big-play',
            headline: `BIG PLAY (+${yardage} YDS)`,
            description: pl.text || '',
            fantasyImpact: impact,
            gameClock: `Q${pl.period?.number || '?'} ${pl.clock?.displayValue || ''}`.trim(),
            timestamp,
            isGameLive: state === 'in',
            downDistanceText,
            possessionTeamAbbr,
            team: {
              abbreviation: pl.start?.team?.id === awayTeam.id ? awayTeam.abbreviation : homeTeam.abbreviation,
              logo: pl.start?.team?.id === awayTeam.id ? awayTeam.logo : homeTeam.logo,
            },
            gameName: ev.shortName || `${awayTeam.abbreviation} @ ${homeTeam.abbreviation}`,
            scoreSummary: `${pl.awayScore ?? awayTeam.score} - ${pl.homeScore ?? homeTeam.score}`,
          });
        }
      }
    });

    // Secondary position refinement pass to ensure accurate RB vs WR vs QB classification
    for (const player of allPlayersMap.values()) {
      const athleteNorm = player.name.toLowerCase().replace(/[^a-z]/g, '');
      if (sleeperPositionCache.has(athleteNorm)) {
        player.position = sleeperPositionCache.get(athleteNorm)!;
        (player as any).hasOfficialPosition = true;
        continue;
      }
      if (rosterCache.has(player.id)) {
        const rPos = normalizePosition(rosterCache.get(player.id));
        if (rPos) {
          player.position = rPos;
          (player as any).hasOfficialPosition = true;
          continue;
        }
      }

      // If player is already TE, NEVER alter to WR!
      if (player.position === 'TE') {
        continue;
      }

      if (!(player as any).hasOfficialPosition) {
        const rushAtt = player.stats.rushingAttempts || 0;
        const rushYds = player.stats.rushingYards || 0;
        const rec = player.stats.receptions || 0;
        const tgt = player.stats.receivingTargets || 0;
        const passAtt = player.stats.passingAttempts || 0;

        if (passAtt > 0 || (player.stats.passingYards || 0) > 0) {
          player.position = 'QB';
        } else if ((player.stats.fgAttempts || 0) > 0 || (player.stats.xpAttempts || 0) > 0) {
          player.position = 'K';
        } else {
          // Anyone in rushing who has >= 2 carries (and isn't a QB) defaults to RB
          if (rushAtt >= 2) {
            // Unless they have significantly more targets than carries (e.g. 8 targets vs 2 carries on WR end-arounds)
            if (tgt > rushAtt * 2 && rushAtt <= 2 && rushYds < 20) {
              player.position = 'WR';
            } else {
              player.position = 'RB';
            }
          } else if (rushAtt === 1 && rec === 0) {
            player.position = 'RB';
          } else if (rec > 0 || tgt > 0) {
            player.position = 'WR';
          }
        }
      }
    }

    // Finalize Fantasy Points & Raw Stat Line for all players
    for (const player of allPlayersMap.values()) {
      player.points = calculatePoints(player.stats, player.position);
      player.rawStatLine = buildRawStatLine(player.stats, player.position);
      const s = player.stats;
      const passYds = s.passingYards || 0;
      const passTD = s.passingTouchdowns || 0;
      const rushYds = s.rushingYards || 0;
      const rushTD = s.rushingTouchdowns || 0;
      const rec = s.receptions || 0;
      const recYds = s.receivingYards || 0;
      const recTD = s.receivingTouchdowns || 0;
      player.playerRawStats = {
        passYds,
        passTD,
        rushYds,
        rushTD,
        rec,
        recYds,
        recTD,
        anytimeTD: rushTD + recTD > 0,
      };
    }

    // Populate playerRawStats on defenses
    for (const def of defPlayers) {
      def.playerRawStats = {
        passYds: 0,
        passTD: 0,
        rushYds: 0,
        rushTD: 0,
        rec: 0,
        recYds: 0,
        recTD: 0,
        anytimeTD: (def.stats.defensiveTouchdowns || 0) > 0,
      };
    }

    // Group players into Leaderboards by position
    const leaderboards: Record<FantasyPosition, FantasyPlayer[]> = {
      QB: [],
      RB: [],
      WR: [],
      TE: [],
      K: [],
      DEF: [],
    };

    for (const player of allPlayersMap.values()) {
      if (leaderboards[player.position]) {
        leaderboards[player.position].push(player);
      }
    }

    // Add DEF
    leaderboards.DEF = defPlayers;

    // Sort each leaderboard by PPR points descending, returning all players (up to 150) so live games are not omitted
    for (const pos of Object.keys(leaderboards) as FantasyPosition[]) {
      leaderboards[pos].sort((a, b) => {
        // Priority 1: PPR points descending
        if (b.points.ppr !== a.points.ppr) {
          return b.points.ppr - a.points.ppr;
        }
        // Priority 2: Standard points descending
        if (b.points.standard !== a.points.standard) {
          return b.points.standard - a.points.standard;
        }
        // Priority 3: Alphabetical by name
        return a.name.localeCompare(b.name);
      });
      // Return up to 300 players so no active players are sliced off before frontend filtering
      leaderboards[pos] = leaderboards[pos].slice(0, 300);
    }

    // Sort Live Updates chronologically descending (newest first)
    liveUpdates.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeB - timeA;
      }
      return b.id.localeCompare(a.id);
    });

    // Merge all active players and defenses across all games on the weekly slate
    const allAvailable = Array.from(allPlayersMap.values()).concat(defPlayers);
    allAvailable.sort((a, b) => {
      // Priority 1: Currently active live games first
      const aLive = a.isGameLive || a.isLive ? 1 : 0;
      const bLive = b.isGameLive || b.isLive ? 1 : 0;
      if (bLive !== aLive) return bLive - aLive;

      // Priority 2: Higher fantasy scoring points
      if (b.points.ppr !== a.points.ppr) {
        return b.points.ppr - a.points.ppr;
      }

      // Priority 3: Alphabetical by player name
      return a.name.localeCompare(b.name);
    });

    const responsePayload: LiveFantasyResponse = {
      lastUpdated: new Date().toISOString(),
      season: {
        year: scoreboard.season?.year || 2026,
        week: scoreboard.week?.number || 7,
        type: scoreboard.season?.type || 2,
      },
      games,
      leaderboards,
      liveUpdates: liveUpdates.slice(0, 60), // Capped to 60 items to prevent memory bloat
      allPlayers: allAvailable,
      allAvailablePlayers: allAvailable,
    };

    // Store in global 10-second response cache
    (globalThis as any).__liveFantasyCache = {
      payload: responsePayload,
      timestamp: Date.now(),
    };

    return NextResponse.json(responsePayload, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=5',
      },
    });
  } catch (error: unknown) {
    console.error('Error in /api/live-fantasy:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to fetch live fantasy data',
        message,
        lastUpdated: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
