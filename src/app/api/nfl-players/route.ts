import { NextRequest, NextResponse } from 'next/server';
import { getMasterNflPlayers } from '@/lib/nflPlayers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamParam = searchParams.get('team')?.toUpperCase();
    const positionParam = searchParams.get('position')?.toUpperCase();
    const searchParam = searchParams.get('search')?.toLowerCase().trim();
    const forceRefresh = searchParams.get('refresh') === 'true';

    let players = await getMasterNflPlayers(forceRefresh);

    if (teamParam) {
      players = players.filter((p) => p.teamAbbr === teamParam);
    }

    if (positionParam && positionParam !== 'ALL') {
      players = players.filter((p) => p.position === positionParam);
    }

    if (searchParam) {
      players = players.filter(
        (p) =>
          p.name.toLowerCase().includes(searchParam) ||
          p.teamAbbr.toLowerCase().includes(searchParam) ||
          p.teamName.toLowerCase().includes(searchParam) ||
          p.position.toLowerCase().includes(searchParam)
      );
    }

    return NextResponse.json(
      {
        count: players.length,
        lastUpdated: new Date().toISOString(),
        players,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('Error in /api/nfl-players:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch NFL players database',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
