'use server';

import { Redis } from '@upstash/redis';
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

// Auto-detect Upstash Redis credentials from environment
let redisClient: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } catch (err) {
    console.warn('Failed to initialize Upstash Redis for room actions, falling back to memory store:', err);
    redisClient = null;
  }
}

// Zero-Config Global In-Memory Fallback
const memoryStore: Map<string, RoomState> =
  (globalThis as any).__roomStore ||
  ((globalThis as any).__roomStore = new Map<string, RoomState>());

const GLOBAL_SHARED_KEY = '__nflSharedRoomState';

/**
 * Retrieve current synced room state for a given room (default 'default')
 */
export async function getRoomState(roomId: string = 'default'): Promise<RoomState> {
  const roomKey = `nfl_room_${roomId}`;

  // 1. Try Upstash Redis if configured
  if (redisClient) {
    try {
      const data = await redisClient.get<RoomState>(roomKey);
      if (data && typeof data === 'object') {
        memoryStore.set(roomId, data);
        return data;
      }
    } catch (err) {
      console.warn('Error reading from Upstash Redis room store:', err);
    }
  }

  // 2. Fall back to in-memory global store
  const inMemory = memoryStore.get(roomId);
  if (inMemory) {
    return inMemory;
  }

  // 3. Fall back to shared room state from /api/room-state if present
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

  // 4. Default empty room state
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

  // Update in-memory Map
  memoryStore.set(roomId, newState);

  // Sync to global shared key for /api/room-state compatibility
  (globalThis as any)[GLOBAL_SHARED_KEY] = {
    syncedLeagues: updatedLeagues,
    guestTags: updatedFriends,
    savedBets: updatedSlips,
    lastUpdated: newState.updatedAt,
  };

  // Update Upstash Redis with 7-day retention
  if (redisClient) {
    try {
      await redisClient.set(`nfl_room_${roomId}`, newState, { ex: 604800 });
    } catch (err) {
      console.warn('Error saving to Upstash Redis room store:', err);
    }
  }

  return newState;
}
