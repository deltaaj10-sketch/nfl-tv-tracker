import { FantasyPosition, FantasyPoints, PlayerStats } from '@/types/fantasy';

export interface PlayerWeeklyProjection {
  athleteId: string;
  fullName: string;
  position: FantasyPosition;
  teamAbbr?: string;
  proTeamId?: number;
  week: number;
  points: FantasyPoints;
  stats: PlayerStats;
  statLine: string;
  rawStats?: Record<string, number>;
  injuryStatus?: string | null;
  injuryNotes?: string | null;
  injuryBodyPart?: string | null;
  isInjured?: boolean;
}

// ESPN Team ID to official NFL abbreviation
export const ESPN_TEAM_ID_TO_ABBR: Record<number, string> = {
  1: 'ATL',
  2: 'BUF',
  3: 'CHI',
  4: 'CIN',
  5: 'CLE',
  6: 'DAL',
  7: 'DEN',
  8: 'DET',
  9: 'GB',
  10: 'TEN',
  11: 'IND',
  12: 'KC',
  13: 'LV',
  14: 'LAR',
  15: 'MIA',
  16: 'MIN',
  17: 'NE',
  18: 'NO',
  19: 'NYG',
  20: 'NYJ',
  21: 'PHI',
  22: 'ARI',
  23: 'PIT',
  24: 'LAC',
  25: 'SF',
  26: 'SEA',
  27: 'TB',
  28: 'WSH',
  29: 'CAR',
  30: 'JAX',
  33: 'BAL',
  34: 'HOU',
};

// ESPN defaultPositionId to FantasyPosition
export const ESPN_POS_ID_TO_FANTASY_POS: Record<number, FantasyPosition> = {
  1: 'QB',
  2: 'RB',
  3: 'WR',
  4: 'TE',
  5: 'K',
  16: 'DEF',
};

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function round0(val: number): number {
  return Math.round(val);
}

/**
 * Normalizes full names for fuzzy index matching
 */
export function normalizePlayerName(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Builds a clean, broadcast-ready projected stat line from Sleeper projection values
 */
export function buildSleeperStatLine(
  val: any,
  pos: FantasyPosition,
  isOut: boolean,
  injuryNotes?: string | null
): string {
  if (isOut) {
    return injuryNotes ? `OUT • ${injuryNotes}` : 'OUT - NO PROJECTION';
  }

  const parts: string[] = [];
  const r0 = (v: number) => String(round0(v));
  const r1 = (v: number) => round1(v).toFixed(1);

  if (pos === 'QB') {
    if (val.pass_yd) parts.push(`${r0(val.pass_yd)} PASS YDS`);
    if (val.pass_td && val.pass_td >= 0.5) parts.push(`${r1(val.pass_td)} PASS TD`);
    if (val.pass_int && val.pass_int >= 0.5) parts.push(`${r1(val.pass_int)} INT`);
    if (val.rush_yd && val.rush_yd >= 5) parts.push(`${r0(val.rush_yd)} RUSH YDS`);
    if (val.rush_td && val.rush_td >= 0.2) parts.push(`${r1(val.rush_td)} RUSH TD`);
  } else if (pos === 'RB') {
    if (val.rush_yd) parts.push(`${r0(val.rush_yd)} RUSH YDS`);
    if (val.rush_td && val.rush_td >= 0.2) parts.push(`${r1(val.rush_td)} TD`);
    if (val.rec && val.rec >= 1) parts.push(`${r1(val.rec)} REC`);
    if (val.rec_yd && val.rec_yd >= 5) parts.push(`${r0(val.rec_yd)} REC YDS`);
    if (val.rec_td && val.rec_td >= 0.2) parts.push(`${r1(val.rec_td)} REC TD`);
  } else if (pos === 'WR' || pos === 'TE') {
    if (val.rec && val.rec >= 0.5) parts.push(`${r1(val.rec)} REC`);
    if (val.rec_yd) parts.push(`${r0(val.rec_yd)} YDS`);
    if (val.rec_td && val.rec_td >= 0.2) parts.push(`${r1(val.rec_td)} TD`);
    if (val.rush_yd && val.rush_yd >= 5) parts.push(`${r0(val.rush_yd)} RUSH YDS`);
  } else if (pos === 'K') {
    if (val.fgm) parts.push(`${r1(val.fgm)} FGM`);
    if (val.xpm) parts.push(`${r1(val.xpm)} XPM`);
  } else if (pos === 'DEF') {
    if (val.sack) parts.push(`${r1(val.sack)} SCK`);
    if (val.int) parts.push(`${r1(val.int)} INT`);
    if (val.pts_allow) parts.push(`${r0(val.pts_allow)} PA`);
  }

  if (parts.length === 0) {
    const pts = val.pts_ppr || val.pts_std || 0;
    return `${round1(pts).toFixed(1)} PROJ PTS`;
  }
  return parts.join(' • ');
}

interface CachedWeeklyProjections {
  map: Map<string, PlayerWeeklyProjection>;
  timestamp: number;
}

// 5-Minute Cache TTL so live injury updates, practice report changes, and depth chart moves
// update constantly throughout Wednesday and Thursday leading up to kickoff
const PROJECTIONS_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

if (!(globalThis as any).__liveProjectionsCache) {
  (globalThis as any).__liveProjectionsCache = new Map<string, CachedWeeklyProjections>();
}

/**
 * Returns current date/time converted to US Eastern (America/New_York)
 */
export function getEasternDate(d: Date = new Date()): Date {
  const easternStr = d.toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(easternStr);
}

/**
 * Checks whether the app should be in Weekly Projections Mode:
 * - Updates every Wednesday morning at 5:00 AM Eastern.
 * - Remains active through Thursday until the first NFL game kicks off.
 * - Once the game on Thursday starts, all projections go away in place of real-time live game stats!
 */
export function checkProjectionsWindow(
  events: any[],
  weekNumber: number,
  now: Date = new Date()
): {
  isProjectionsMode: boolean;
  targetWeek: number;
  shouldAdvanceWeek?: boolean;
  earliestKickoff?: string;
  reason?: string;
} {
  const easternNow = getEasternDate(now);
  const nowMs = now.getTime();

  // If any game is actively playing right now, live stats mode MUST be active
  const hasLive = events.some((e) => e.status?.type?.state === 'in');
  if (hasLive) {
    return { isProjectionsMode: false, targetWeek: weekNumber, reason: 'game_in_progress' };
  }

  const hasPost = events.some((e) => e.status?.type?.state === 'post');
  const allPost = events.length > 0 && events.every((e) => e.status?.type?.state === 'post');
  const allPre = events.length > 0 && events.every((e) => e.status?.type?.state === 'pre');

  // Case 1: All games in current slate are finished (e.g. Monday Night Football concluded)
  if (allPost) {
    const latestGameMs = Math.max(...events.map((e) => new Date(e.date).getTime()));
    const latestGameEastern = getEasternDate(new Date(latestGameMs));

    // Wednesday 5:00 AM Eastern following the latest game
    const wed5am = new Date(latestGameEastern);
    while (wed5am.getDay() !== 3) {
      // 3 = Wednesday
      wed5am.setDate(wed5am.getDate() + 1);
    }
    wed5am.setHours(5, 0, 0, 0);

    if (easternNow >= wed5am) {
      // Wednesday 5 AM has arrived -> advance to upcoming week's projections!
      return { isProjectionsMode: true, shouldAdvanceWeek: true, targetWeek: weekNumber + 1 };
    } else {
      // Still Monday night, Tuesday, or early Wednesday before 5 AM -> show completed week stats
      return { isProjectionsMode: false, targetWeek: weekNumber, reason: 'before_wednesday_5am' };
    }
  }

  // Case 2: Slate has already started (e.g. Thursday Night Football finished, Sunday upcoming)
  // Per rule: Once the game on Thursday starts, all projections go away!
  if (hasPost) {
    return { isProjectionsMode: false, targetWeek: weekNumber, reason: 'slate_already_started' };
  }

  // Case 3: All games in upcoming slate are scheduled (pre)
  if (allPre) {
    const earliestKickoffMs = Math.min(...events.map((e) => new Date(e.date).getTime()));
    const earliestKickoff = new Date(earliestKickoffMs);
    const earliestEastern = getEasternDate(earliestKickoff);

    // Wednesday 5:00 AM Eastern before this Thursday kickoff
    const wed5am = new Date(earliestEastern);
    while (wed5am.getDay() !== 3) {
      // 3 = Wednesday
      wed5am.setDate(wed5am.getDate() - 1);
    }
    wed5am.setHours(5, 0, 0, 0);

    if (easternNow >= wed5am && nowMs < earliestKickoffMs) {
      return {
        isProjectionsMode: true,
        targetWeek: weekNumber,
        earliestKickoff: earliestKickoff.toISOString(),
      };
    } else if (nowMs >= earliestKickoffMs) {
      return { isProjectionsMode: false, targetWeek: weekNumber, reason: 'game_started' };
    } else {
      return { isProjectionsMode: false, targetWeek: weekNumber, reason: 'before_wednesday_5am' };
    }
  }

  return { isProjectionsMode: false, targetWeek: weekNumber, reason: 'unknown' };
}

// In-memory cache for Sleeper NFL player metadata (injuries, espn_id, etc.)
let sleeperPlayersMeta: Record<string, any> | null = null;
let sleeperMetaTimestamp = 0;
const SLEEPER_META_TTL = 1000 * 60 * 5; // 5 minutes

/**
 * Fetches Sleeper's master NFL players directory with live injury designations
 */
export async function getLiveSleeperPlayers(): Promise<Record<string, any>> {
  const now = Date.now();
  if (sleeperPlayersMeta && now - sleeperMetaTimestamp < SLEEPER_META_TTL) {
    return sleeperPlayersMeta;
  }
  try {
    const res = await fetch('https://api.sleeper.app/v1/players/nfl', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      sleeperPlayersMeta = await res.json();
      sleeperMetaTimestamp = now;
      return sleeperPlayersMeta || {};
    }
  } catch (err) {
    console.error('Error fetching Sleeper player metadata:', err);
  }
  return sleeperPlayersMeta || {};
}

/**
 * Primary Projections & Live Injury Engine:
 * Fetches accurate weekly fantasy projections (PPR, Half-PPR, Standard) and live injury statuses
 * from Sleeper's constantly-updating NFL database, with ESPN Kona as secondary support.
 * Caches for 5 minutes so injury developments are tracked in near real-time.
 */
export async function fetchLiveProjectionsAndInjuries(
  year: number,
  week: number,
  forceRefresh: boolean = false
): Promise<Map<string, PlayerWeeklyProjection>> {
  const cacheKey = `${year}_${week}`;
  const cacheMap = (globalThis as any).__liveProjectionsCache as Map<string, CachedWeeklyProjections>;
  const cached = cacheMap.get(cacheKey);

  if (!forceRefresh && cached && Date.now() - cached.timestamp < PROJECTIONS_CACHE_TTL) {
    return cached.map;
  }

  const projectionsMap = new Map<string, PlayerWeeklyProjection>();

  try {
    // 1. Fetch Sleeper live projections and player metadata concurrently
    const [projsRes, playersMeta] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/projections/nfl/regular/${year}/${week}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(6000),
      }),
      getLiveSleeperPlayers(),
    ]);

    let sleeperProjs: Record<string, any> = {};
    if (projsRes.ok) {
      sleeperProjs = await projsRes.json();
    }

    // Process all Sleeper projections
    for (const [id, val] of Object.entries(sleeperProjs)) {
      if (!val || typeof val !== 'object') continue;

      // Check if this is a Team Defense projection (e.g. id === 'DAL' or 'KC')
      if (id.length <= 3 && id === id.toUpperCase()) {
        const teamAbbr = id.toUpperCase();
        const ptsStd = round2(val.pts_std ?? val.pts_ppr ?? 0);
        const defObj: PlayerWeeklyProjection = {
          athleteId: `DEF_${teamAbbr}`,
          fullName: `${teamAbbr} Defense`,
          position: 'DEF',
          teamAbbr,
          week,
          points: { standard: ptsStd, halfPpr: ptsStd, ppr: ptsStd },
          stats: {
            sacks: round1(val.sack || 0),
            defensiveInterceptions: round1(val.int || 0),
            fumblesRecovered: round1(val.fum_rec || 0),
            defensiveTouchdowns: round1(val.def_td || 0),
            safeties: round1(val.safety || 0),
            pointsAllowed: round0(val.pts_allow || 21),
          },
          statLine: buildSleeperStatLine(val, 'DEF', false),
        };
        projectionsMap.set(`DEF_${teamAbbr}`, defObj);
        projectionsMap.set(`DEF_${teamAbbr.toLowerCase()}`, defObj);
        continue;
      }

      // Individual Player Projection
      const meta = playersMeta[id] || {};
      const fullName = meta.full_name || meta.first_name ? `${meta.first_name} ${meta.last_name}` : '';
      if (!fullName) continue;

      const normName = normalizePlayerName(fullName);
      const pos = (meta.position || 'WR') as FantasyPosition;
      const teamAbbr = meta.team || '';
      const injuryStatus = meta.injury_status || null;
      const injuryNotes = meta.injury_notes || null;
      const injuryBodyPart = meta.injury_body_part || null;
      const isOut = injuryStatus === 'Out' || injuryStatus === 'IR' || injuryStatus === 'PUP';
      const isInjured = Boolean(injuryStatus && injuryStatus !== 'NA');

      const std = isOut ? 0 : round2(val.pts_std ?? 0);
      const halfPpr = isOut ? 0 : round2(val.pts_half_ppr ?? (std + (val.rec ?? 0) * 0.5));
      const ppr = isOut ? 0 : round2(val.pts_ppr ?? (std + (val.rec ?? 0) * 1.0));

      const stats: PlayerStats = {
        passingYards: round0(val.pass_yd || 0),
        passingTouchdowns: round1(val.pass_td || 0),
        interceptions: round1(val.pass_int || 0),
        passingAttempts: round0(val.pass_att || 0),
        completions: round0(val.pass_cmp || 0),
        rushingYards: round0(val.rush_yd || 0),
        rushingTouchdowns: round1(val.rush_td || 0),
        rushingAttempts: round0(val.rush_att || 0),
        receptions: round1(val.rec || 0),
        receivingYards: round0(val.rec_yd || 0),
        receivingTouchdowns: round1(val.rec_td || 0),
        receivingTargets: round0(val.rec_tgt || 0),
        fgMade: round1(val.fgm || 0),
        fgAttempts: round0(val.fga || 0),
        xpMade: round1(val.xpm || 0),
      };

      const statLine = buildSleeperStatLine(val, pos, isOut, injuryNotes);

      const projObj: PlayerWeeklyProjection = {
        athleteId: meta.espn_id ? String(meta.espn_id) : id,
        fullName,
        position: pos,
        teamAbbr,
        week,
        points: { standard: std, halfPpr, ppr },
        stats,
        statLine,
        injuryStatus,
        injuryNotes,
        injuryBodyPart,
        isInjured,
      };

      // Key by ESPN athlete ID if present
      if (meta.espn_id) {
        projectionsMap.set(String(meta.espn_id), projObj);
      }
      // Key by Sleeper ID
      projectionsMap.set(id, projObj);
      // Key by normalized name
      projectionsMap.set(normName, projObj);
      if (teamAbbr) {
        projectionsMap.set(`${normName}_${teamAbbr.toLowerCase()}`, projObj);
      }
    }
  } catch (err) {
    console.error('Error fetching live projections from Sleeper:', err);
  }

  // 2. Supplementary pass: ESPN Kona API to fill any gaps or missing ESPN athlete IDs
  try {
    const filter = JSON.stringify({
      players: {
        limit: 1000,
        sortPercOwned: { sortPriority: 1, sortAsc: false },
        filterActive: { value: true },
      },
    });

    const espnRes = await fetch(
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leaguedefaults/1?view=kona_player_info`,
      {
        headers: {
          'x-fantasy-filter': filter,
          'User-Agent': 'Mozilla/5.0',
        },
        signal: AbortSignal.timeout(4500),
        cache: 'no-store',
      }
    );

    if (espnRes.ok) {
      const data = await espnRes.json();
      for (const p of data.players || []) {
        if (!p?.player) continue;
        const athleteId = String(p.id);
        const fullName = p.player.fullName || p.player.name || '';
        const normName = normalizePlayerName(fullName);
        const posId = p.player.defaultPositionId;
        const fantasyPos = ESPN_POS_ID_TO_FANTASY_POS[posId] || 'WR';
        const proTeamId = p.player.proTeamId;
        const teamAbbr = ESPN_TEAM_ID_TO_ABBR[proTeamId] || '';

        // If DEF, map ESPN team defense
        if (fantasyPos === 'DEF') {
          if (teamAbbr && !projectionsMap.has(`DEF_${teamAbbr}`)) {
            const statsList: any[] = p.player.stats || [];
            const projStat =
              statsList.find((s) => s.statSourceId === 1 && s.statSplitTypeId === 1 && s.scoringPeriodId === week) ||
              statsList.find((s) => s.statSourceId === 1 && s.statSplitTypeId === 1);
            if (projStat) {
              const defPts = round2(projStat.appliedTotal || 0);
              const defObj: PlayerWeeklyProjection = {
                athleteId,
                fullName: `${teamAbbr} Defense`,
                position: 'DEF',
                teamAbbr,
                proTeamId,
                week,
                points: { standard: defPts, halfPpr: defPts, ppr: defPts },
                stats: {},
                statLine: `${defPts.toFixed(1)} PROJ PTS`,
              };
              projectionsMap.set(`DEF_${teamAbbr}`, defObj);
              projectionsMap.set(`DEF_TEAMID_${proTeamId}`, defObj);
            }
          }
          continue;
        }

        // If player already mapped with Sleeper's accurate numbers, just ensure ESPN athleteId is indexed
        if (projectionsMap.has(normName)) {
          const existing = projectionsMap.get(normName)!;
          if (!projectionsMap.has(athleteId)) {
            projectionsMap.set(athleteId, existing);
          }
        }
      }
    }
  } catch {
    // Non-fatal ESPN fallback
  }

  cacheMap.set(cacheKey, {
    map: projectionsMap,
    timestamp: Date.now(),
  });

  return projectionsMap;
}

/**
 * Backwards compatibility alias
 */
export async function fetchEspnProjections(
  year: number,
  week: number,
  forceRefresh: boolean = false
): Promise<Map<string, PlayerWeeklyProjection>> {
  return fetchLiveProjectionsAndInjuries(year, week, forceRefresh);
}
