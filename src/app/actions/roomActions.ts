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

// Connect to Vercel KV / Upstash Redis if credentials exist
let redisClient: Redis | null = null;
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

if (redisUrl && redisToken) {
  try {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  } catch (err) {
    console.warn('Failed to initialize Vercel KV Redis, using memory store:', err);
    redisClient = null;
  }
}

// Global In-Memory Fallback: globalThis.__roomStore
const memoryStore: Map<string, RoomState> =
  (globalThis as any).__roomStore ||
  ((globalThis as any).__roomStore = new Map<string, RoomState>());

const GLOBAL_SHARED_KEY = '__nflSharedRoomState';

/**
 * Retrieve current synced room state for a given room (default 'default')
 * Reads from Vercel KV Redis when connected, falling back to globalThis.__roomStore
 */
export async function getRoomState(roomId: string = 'default'): Promise<RoomState> {
  const roomKey = `nfl_room_${roomId}`;

  // 1. Try Vercel KV Redis if connected
  if (redisClient) {
    try {
      const data = await redisClient.get<RoomState>(roomKey);
      if (data && typeof data === 'object') {
        memoryStore.set(roomId, data);
        return data;
      }
    } catch (err) {
      console.warn('Error reading from Vercel KV room store:', err);
    }
  }

  // 2. Read from in-memory global store
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

  // Update in-memory global Map
  memoryStore.set(roomId, newState);

  // Sync to global shared key for /api/room-state compatibility
  (globalThis as any)[GLOBAL_SHARED_KEY] = {
    syncedLeagues: updatedLeagues,
    guestTags: updatedFriends,
    savedBets: updatedSlips,
    lastUpdated: newState.updatedAt,
  };

  // Save to Vercel KV Redis with 7-day retention
  if (redisClient) {
    try {
      await redisClient.set(`nfl_room_${roomId}`, newState, { ex: 604800 });
    } catch (err) {
      console.warn('Error saving to Vercel KV room store:', err);
    }
  }

  return newState;
}
