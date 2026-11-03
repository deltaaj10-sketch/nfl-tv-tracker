'use server';

import { SyncedLeagueConfig, GuestTagConfig } from '@/types/leagues';
import { BetSlip } from '@/types/fantasy';

export interface RoomState {
  slips: BetSlip[];
  guestFriends: GuestTagConfig[];
  sleeperLeagues: SyncedLeagueConfig[];
  updatedAt: number;
}

export interface PartialRoomState {
  slips?: BetSlip[];
  savedBets?: BetSlip[];
  guestFriends?: GuestTagConfig[];
  guestTags?: GuestTagConfig[];
  sleeperLeagues?: SyncedLeagueConfig[];
  syncedLeagues?: SyncedLeagueConfig[];
  updatedAt?: number;
}

// 100% Free Built-In Node.js Server Memory Map: globalThis.__roomStore (zero external packages)
const memoryStore: Map<string, RoomState> =
  (globalThis as any).__roomStore ||
  ((globalThis as any).__roomStore = new Map<string, RoomState>());

const GLOBAL_SHARED_KEY = '__nflSharedRoomState';

/**
 * Retrieve current synced room state for a given room (default 'default')
 * Backed by built-in globalThis.__roomStore Map + client localStorage persistence
 */
export async function getRoomState(roomId: string = 'default'): Promise<RoomState> {
  // 1. Read from built-in in-memory global store
  const inMemory = memoryStore.get(roomId);
  if (inMemory) {
    return inMemory;
  }

  // 2. Fall back to shared room state from /api/room-state if present
  const sharedGlobal = (globalThis as any)[GLOBAL_SHARED_KEY];
  if (sharedGlobal) {
    const state: RoomState = {
      slips: sharedGlobal.savedBets || [],
      guestFriends: sharedGlobal.guestTags || [],
      sleeperLeagues: sharedGlobal.syncedLeagues || [],
      updatedAt: sharedGlobal.lastUpdated || Date.now(),
    };
    memoryStore.set(roomId, state);
    return state;
  }

  // 3. Default empty room state
  const defaultState: RoomState = {
    slips: [],
    guestFriends: [],
    sleeperLeagues: [],
    updatedAt: Date.now(),
  };
  memoryStore.set(roomId, defaultState);
  return defaultState;
}

/**
 * Persist and broadcast partial room state updates across devices
 */
export async function syncRoomState(
  roomId: string = 'default',
  partialState: PartialRoomState
): Promise<RoomState> {
  const current = await getRoomState(roomId);

  const updatedSlips = partialState.slips ?? partialState.savedBets ?? current.slips;
  const updatedFriends = partialState.guestFriends ?? partialState.guestTags ?? current.guestFriends;
  const updatedLeagues = partialState.sleeperLeagues ?? partialState.syncedLeagues ?? current.sleeperLeagues;

  const newState: RoomState = {
    slips: updatedSlips,
    guestFriends: updatedFriends,
    sleeperLeagues: updatedLeagues,
    updatedAt: Date.now(),
  };

  // Update in-memory global Map
  memoryStore.set(roomId, newState);

  // Sync to global shared key for /api/room-state compatibility
  (globalThis as any)[GLOBAL_SHARED_KEY] = {
    syncedLeagues: updatedLeagues,
    guestTags: updatedFriends,
    savedBets: updatedSlips,
    lastUpdated: newState.updatedAt,
  };

  return newState;
}
