import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');
    const week = searchParams.get('week') || '6';

    if (!leagueId) {
      return NextResponse.json({ error: 'Missing leagueId parameter' }, { status: 400 });
    }

    // Fetch league info, users, rosters, and matchups in parallel
    const [leagueRes, usersRes, rostersRes, matchupsRes] = await Promise.allSettled([
      fetch(`https://api.sleeper.app/v1/league/${leagueId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store',
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store',
      }).then((r) => (r.ok ? r.json() : [])),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store',
      }).then((r) => (r.ok ? r.json() : [])),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store',
      }).then((r) => (r.ok ? r.json() : [])),
    ]);

    interface SleeperUser {
      user_id: string;
      display_name?: string;
      metadata?: { team_name?: string };
      avatar?: string;
    }
    interface SleeperRoster {
      roster_id: number;
      owner_id: string;
      players?: string[];
      starters?: string[];
    }
    interface SleeperMatchup {
      matchup_id?: number;
      roster_id: number;
      points?: number;
      custom_points?: number;
    }

    const leagueData = leagueRes.status === 'fulfilled' ? leagueRes.value : null;
    const usersData: SleeperUser[] =
      usersRes.status === 'fulfilled' && Array.isArray(usersRes.value) ? usersRes.value : [];
    const rostersData: SleeperRoster[] =
      rostersRes.status === 'fulfilled' && Array.isArray(rostersRes.value) ? rostersRes.value : [];
    const matchupsData: SleeperMatchup[] =
      matchupsRes.status === 'fulfilled' && Array.isArray(matchupsRes.value) ? matchupsRes.value : [];

    if (!leagueData && usersData.length === 0 && rostersData.length === 0) {
      return NextResponse.json(
        { error: 'Failed to find Sleeper league. Please check the League ID.' },
        { status: 404 }
      );
    }

    // Map user_id to Display Name & Team Name
    const usersMap = new Map<
      string,
      {
        displayName: string;
        teamName: string;
        avatar?: string;
      }
    >();

    for (const u of usersData) {
      const displayName = u.display_name || 'Manager';
      const teamName = u.metadata?.team_name || `${displayName}'s Team`;
      const avatar = u.avatar ? `https://sleepercdn.com/avatars/thumbs/${u.avatar}` : undefined;
      usersMap.set(u.user_id, { displayName, teamName, avatar });
    }

    // Map roster_id to Team Info & Player IDs
    const rostersMap = new Map<
      number,
      {
        rosterId: number;
        ownerId: string;
        displayName: string;
        teamName: string;
        avatar?: string;
        players: string[];
        starters: string[];
      }
    >();

    for (const r of rostersData) {
      const userInfo = usersMap.get(r.owner_id) || {
        displayName: `Manager ${r.roster_id}`,
        teamName: `Team ${r.roster_id}`,
      };

      rostersMap.set(r.roster_id, {
        rosterId: r.roster_id,
        ownerId: r.owner_id,
        displayName: userInfo.displayName,
        teamName: userInfo.teamName,
        avatar: userInfo.avatar,
        players: r.players || [],
        starters: r.starters || [],
      });
    }

    // Group matchups by matchup_id
    const matchupsById = new Map<number, SleeperMatchup[]>();
    for (const m of matchupsData) {
      if (m.matchup_id === undefined || m.matchup_id === null) continue;
      const list = matchupsById.get(m.matchup_id) || [];
      list.push(m);
      matchupsById.set(m.matchup_id, list);
    }

    const parsedMatchups: Array<{
      id: number;
      team1: {
        teamId: number;
        ownerName: string;
        teamName: string;
        points: number;
        customPoints?: number;
        logo?: string;
      };
      team2: {
        teamId: number;
        ownerName: string;
        teamName: string;
        points: number;
        customPoints?: number;
        logo?: string;
      };
    }> = [];
    for (const [mid, pair] of matchupsById.entries()) {
      if (pair.length >= 2) {
        const team1Roster = rostersMap.get(pair[0].roster_id);
        const team2Roster = rostersMap.get(pair[1].roster_id);

        if (team1Roster && team2Roster) {
          parsedMatchups.push({
            id: mid,
            team1: {
              teamId: team1Roster.rosterId,
              ownerName: team1Roster.displayName,
              teamName: team1Roster.teamName,
              points: Math.round((pair[0].points || 0) * 10) / 10,
              customPoints: pair[0].custom_points,
              logo: team1Roster.avatar,
            },
            team2: {
              teamId: team2Roster.rosterId,
              ownerName: team2Roster.displayName,
              teamName: team2Roster.teamName,
              points: Math.round((pair[1].points || 0) * 10) / 10,
              customPoints: pair[1].custom_points,
              logo: team2Roster.avatar,
            },
          });
        }
      }
    }

    return NextResponse.json({
      leagueId,
      name: leagueData?.name || `Sleeper League ${leagueId}`,
      season: leagueData?.season || '2026',
      week: parseInt(week),
      teams: Array.from(rostersMap.values()),
      matchups: parsedMatchups,
    });
  } catch (error: unknown) {
    console.error('Error fetching Sleeper league:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process Sleeper league', message },
      { status: 500 }
    );
  }
}
