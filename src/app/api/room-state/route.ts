import { NextResponse } from 'next/server';
import { SyncedLeagueConfig, GuestTagConfig } from '@/types/leagues';
import { BetSlip } from '@/types/fantasy';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

export interface SharedRoomState {
  syncedLeagues: SyncedLeagueConfig[];
  guestTags: GuestTagConfig[];
  savedBets: BetSlip[];
  lastUpdated: number;
}

const GLOBAL_KEY = '__nflSharedRoomState';
const TMP_FILE_PATH = path.join(os.tmpdir(), 'nfl_room_state_store.json');

function getInitialState(): SharedRoomState {
  if ((globalThis as any)[GLOBAL_KEY]) {
    return (globalThis as any)[GLOBAL_KEY];
  }

  // Try reading from temp file
  try {
    if (fs.existsSync(TMP_FILE_PATH)) {
      const data = fs.readFileSync(TMP_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        (globalThis as any)[GLOBAL_KEY] = parsed;
        return parsed;
      }
    }
  } catch {
    // Non-fatal filesystem fallback
  }

  const defaultState: SharedRoomState = {
    syncedLeagues: [],
    guestTags: [],
    savedBets: [],
    lastUpdated: Date.now(),
  };
  (globalThis as any)[GLOBAL_KEY] = defaultState;
  return defaultState;
}

function saveState(state: SharedRoomState): void {
  (globalThis as any)[GLOBAL_KEY] = state;
  try {
    fs.writeFileSync(TMP_FILE_PATH, JSON.stringify(state), 'utf-8');
  } catch {
    // Non-fatal filesystem fallback for serverless
  }
}

export async function GET() {
  try {
    const state = getInitialState();
    return NextResponse.json(
      {
        success: true,
        state,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get room state';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const currentState = getInitialState();

    const updatedState: SharedRoomState = {
      syncedLeagues: Array.isArray(body.syncedLeagues) ? body.syncedLeagues : currentState.syncedLeagues,
      guestTags: Array.isArray(body.guestTags)
        ? body.guestTags
        : Array.isArray(body.guestRosters)
        ? body.guestRosters
        : currentState.guestTags,
      savedBets: Array.isArray(body.savedBets)
        ? body.savedBets
        : Array.isArray(body.activeBets)
        ? body.activeBets
        : currentState.savedBets,
      lastUpdated: Date.now(),
    };

    saveState(updatedState);

    return NextResponse.json(
      {
        success: true,
        state: updatedState,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update room state';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
