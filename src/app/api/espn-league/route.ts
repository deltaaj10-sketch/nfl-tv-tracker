import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');
    const season = searchParams.get('season') || '2026';
    const week = parseInt(searchParams.get('week') || '6');
    const swid = searchParams.get('swid') || '';
    const espn_s2 = searchParams.get('espn_s2') || '';

    if (!leagueId) {
      return NextResponse.json({ error: 'Missing leagueId parameter' }, { status: 400 });
    }

    // Build ESPN Fantasy API URL
    const espnUrl = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=mMatchup&view=mRoster&view=mTeam&view=mSettings`;

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      Accept: 'application/json',
    };

    if (swid && espn_s2) {
      const formattedSwid = swid.startsWith('{') ? swid : `{${swid}}`;
      headers['Cookie'] = `espn_s2=${espn_s2}; SWID=${formattedSwid};`;
    }

    const res = await fetch(espnUrl, {
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          {
            error: 'Private ESPN League: requires SWID and espn_s2 cookies to access.',
            status: res.status,
          },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `ESPN API returned status ${res.status}`, status: res.status },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Map members by ID -> Display Name
    const membersMap = new Map<string, string>();
    for (const m of data.members || []) {
      const displayName = m.displayName || `${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Manager';
      membersMap.set(m.id, displayName);
    }

    // Map teams
    const teamsMap = new Map<
      number,
      {
        id: number;
        name: string;
        abbrev: string;
        logo: string;
        ownerName: string;
        roster: Array<{ id: string; name: string; positionId?: number }>;
      }
    >();

    for (const t of data.teams || []) {
      const ownerName = membersMap.get(t.primaryOwner) || t.location || 'Manager';
      const teamName = t.name || `${t.location || ''} ${t.nickname || ''}`.trim() || `Team ${t.id}`;
      const logo = t.logo || '';

      const roster: Array<{ id: string; name: string; positionId?: number }> = [];
      for (const entry of t.roster?.entries || []) {
        const p = entry.playerPoolEntry?.player;
        if (p) {
          roster.push({
            id: String(p.id),
            name: p.fullName,
            positionId: p.defaultPositionId,
          });
        }
      }

      teamsMap.set(t.id, {
        id: t.id,
        name: teamName,
        abbrev: t.abbrev || '',
        logo,
        ownerName,
        roster,
      });
    }

    // Matchups for current week / scoring period
    const currentPeriod = week || data.status?.currentMatchupPeriod || 1;
    const matchups: Array<{
      id: string | number;
      team1: { teamId: string | number; ownerName: string; teamName: string; points: number; logo?: string };
      team2: { teamId: string | number; ownerName: string; teamName: string; points: number; logo?: string };
    }> = [];

    for (const match of data.schedule || []) {
      if (match.matchupPeriodId === currentPeriod) {
        const homeTeam = teamsMap.get(match.home?.teamId);
        const awayTeam = teamsMap.get(match.away?.teamId);

        if (homeTeam && awayTeam) {
          matchups.push({
            id: match.id,
            team1: {
              teamId: awayTeam.id,
              ownerName: awayTeam.ownerName,
              teamName: awayTeam.name,
              points: Math.round((match.away?.totalPoints || 0) * 10) / 10,
              logo: awayTeam.logo,
            },
            team2: {
              teamId: homeTeam.id,
              ownerName: homeTeam.ownerName,
              teamName: homeTeam.name,
              points: Math.round((match.home?.totalPoints || 0) * 10) / 10,
              logo: homeTeam.logo,
            },
          });
        }
      }
    }

    return NextResponse.json({
      leagueId,
      name: data.settings?.name || `ESPN League ${leagueId}`,
      currentPeriod,
      teams: Array.from(teamsMap.values()),
      matchups,
    });
  } catch (error: unknown) {
    console.error('Error fetching ESPN league:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process ESPN league', message },
      { status: 500 }
    );
  }
}
