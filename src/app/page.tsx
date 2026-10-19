'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  Flame,
  Trophy,
  Clock,
  RefreshCw,
  Play,
  Pause,
  Zap,
  Tv,
  Radio,
  Activity,
  Settings,
  Users,
  Swords,
  Crown,
  DollarSign,
  Plus,
  Search,
  Volume2,
  VolumeX,
  Smartphone,
  QrCode,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { playBroadcastAlertSound } from '@/lib/soundEffects';
import {
  LiveFantasyResponse,
  FantasyPosition,
  ScoringFormat,
  FantasyPlayer,
  LiveGame,
  BetSlip,
  BetLeg,
} from '@/types/fantasy';
import {
  SyncedLeagueConfig,
  GuestTagConfig,
  PlayerOwnerTag,
  ParsedLeagueMatchup,
  RoomFriendLeaderboard,
} from '@/types/leagues';
import ManageLeaguesModal from '@/components/ManageLeaguesModal';
import ManageBetsModal from '@/components/ManageBetsModal';

const NFL_TEAM_COLORS: Record<string, string> = {
  ARI: '#97233F',
  ATL: '#A71930',
  BAL: '#241773',
  BUF: '#00338D',
  CAR: '#0085CA',
  CHI: '#0B162A',
  CIN: '#FB4F14',
  CLE: '#311D00',
  DAL: '#003594',
  DEN: '#FB4F14',
  DET: '#0076B6',
  GB:  '#203731',
  HOU: '#03202F',
  IND: '#002C5F',
  JAX: '#006778',
  KC:  '#E31837',
  LAC: '#0080C6',
  LAR: '#003594',
  LV:  '#000000',
  MIA: '#008E97',
  MIN: '#4F2683',
  NE:  '#002244',
  NO:  '#D3BC8D',
  NYG: '#0B2265',
  NYJ: '#125740',
  PHI: '#004C54',
  PIT: '#FFB612',
  SEA: '#002244',
  SF:  '#AA0000',
  TB:  '#D50A0A',
  TEN: '#0C2340',
  WAS: '#5A1414',
};

type MainTab = 'live' | FantasyPosition | 'room' | 'bets';

// Compact TV Tab Labels that stretch 100% across the screen without horizontal scrolling
const TABS: { id: MainTab; label: string }[] = [
  { id: 'live', label: 'LIVE' },
  { id: 'QB', label: 'QB' },
  { id: 'RB', label: 'RB' },
  { id: 'WR', label: 'WR' },
  { id: 'TE', label: 'TE' },
  { id: 'DEF', label: 'DEF' },
  { id: 'K', label: 'K' },
  { id: 'room', label: 'LEAGUES' },
  { id: 'bets', label: 'SPORTSBOOK' },
];

interface PointBurstAlert {
  id: string;
  playerName: string;
  position: string;
  teamAbbr: string;
  teamLogo?: string;
  headshot?: string;
  delta: number;
  newTotal: number;
  timestamp: number;
}

export interface TouchdownAlert {
  id: string;
  playerName: string;
  playerHeadshot?: string;
  position?: string;
  teamAbbr: string;
  teamLogo?: string;
  headline: string;
  description: string;
  gameClock?: string;
  gameName?: string;
  scoreSummary?: string;
  fantasyImpact?: string;
  totalPoints?: number;
  owners: PlayerOwnerTag[];
}

interface GradedLegResult {
  status: 'cashed' | 'covering' | 'sweating' | 'chalked' | 'upcoming';
  statusText: string;
  badgeStyle: string;
  progressText: string;
  progressPct: number;
  gameStatusText?: string;
  currentValue?: number | string;
}

function gradeBetLeg(
  leg: BetLeg,
  allPlayers: FantasyPlayer[],
  games: LiveGame[]
): GradedLegResult {
  // 1. Player Prop
  if (leg.type === 'player_prop') {
    const player = allPlayers.find(
      (p) =>
        (leg.playerId && p.id === leg.playerId) ||
        p.name.toLowerCase() === leg.playerName?.toLowerCase()
    );

    const isLive = Boolean(player?.isGameLive || player?.isLive || player?.gameStatus?.state === 'in');
    const isPost = player?.gameStatus?.state === 'post';
    const raw = player?.playerRawStats;

    let currentVal = 0;
    if (raw && leg.statType) {
      if (leg.statType === 'passYds') currentVal = raw.passYds;
      else if (leg.statType === 'passTD') currentVal = raw.passTD;
      else if (leg.statType === 'rushYds') currentVal = raw.rushYds;
      else if (leg.statType === 'recYds') currentVal = raw.recYds;
      else if (leg.statType === 'rec') currentVal = raw.rec;
      else if (leg.statType === 'rushRecYds') currentVal = raw.rushYds + raw.recYds;
    } else if (player?.stats && leg.statType) {
      if (leg.statType === 'passYds') currentVal = player.stats.passingYards || 0;
      else if (leg.statType === 'passTD') currentVal = player.stats.passingTouchdowns || 0;
      else if (leg.statType === 'rushYds') currentVal = player.stats.rushingYards || 0;
      else if (leg.statType === 'recYds') currentVal = player.stats.receivingYards || 0;
      else if (leg.statType === 'rec') currentVal = player.stats.receptions || 0;
      else if (leg.statType === 'rushRecYds') currentVal = (player.stats.rushingYards || 0) + (player.stats.receivingYards || 0);
    }

    const target = leg.targetValue || 0;
    const direction = leg.direction || 'OVER';
    const progressPct = target > 0 ? Math.min(100, Math.round((currentVal / target) * 100)) : 0;
    const gameClock = player
      ? `${player.team.abbreviation} vs ${player.opponent.abbreviation} • ${player.gameStatus?.detail || (isLive ? 'LIVE' : isPost ? 'FINAL' : 'Upcoming')}`
      : 'Upcoming';

    if (direction === 'OVER') {
      if (currentVal >= target) {
        return {
          status: 'cashed',
          statusText: 'CASHED',
          badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.4)]',
          progressText: `${currentVal} / ${target} (${progressPct}%)`,
          progressPct: 100,
          gameStatusText: gameClock,
          currentValue: currentVal,
        };
      }
      if (isPost) {
        return {
          status: 'chalked',
          statusText: 'CHALKED',
          badgeStyle: 'bg-rose-950/80 text-rose-300 border-rose-500/50',
          progressText: `${currentVal} / ${target} (${progressPct}%)`,
          progressPct,
          gameStatusText: gameClock,
          currentValue: currentVal,
        };
      }
      if (isLive) {
        const isCovering = progressPct >= 65;
        return {
          status: isCovering ? 'covering' : 'sweating',
          statusText: isCovering ? 'ON PACE' : 'SWEATING',
          badgeStyle: isCovering
            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
            : 'bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse',
          progressText: `${currentVal} / ${target} (${progressPct}%)`,
          progressPct,
          gameStatusText: gameClock,
          currentValue: currentVal,
        };
      }
      return {
        status: 'upcoming',
        statusText: 'UPCOMING',
        badgeStyle: 'bg-slate-900 text-slate-400 border-slate-800',
        progressText: `0 / ${target} (0%)`,
        progressPct: 0,
        gameStatusText: gameClock,
        currentValue: 0,
      };
    } else {
      // UNDER
      if (currentVal > target) {
        return {
          status: 'chalked',
          statusText: 'CHALKED',
          badgeStyle: 'bg-rose-950/80 text-rose-300 border-rose-500/50',
          progressText: `${currentVal} / ${target} (Exceeded)`,
          progressPct: 100,
          gameStatusText: gameClock,
          currentValue: currentVal,
        };
      }
      if (isPost) {
        return {
          status: 'cashed',
          statusText: 'CASHED',
          badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.4)]',
          progressText: `${currentVal} / ${target} (Stayed Under)`,
          progressPct: 100,
          gameStatusText: gameClock,
          currentValue: currentVal,
        };
      }
      if (isLive) {
        const isSafe = progressPct <= 60;
        return {
          status: isSafe ? 'covering' : 'sweating',
          statusText: isSafe ? 'UNDER PACE' : 'SWEATING',
          badgeStyle: isSafe
            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
            : 'bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse',
          progressText: `${currentVal} / ${target} (${progressPct}%)`,
          progressPct,
          gameStatusText: gameClock,
          currentValue: currentVal,
        };
      }
      return {
        status: 'upcoming',
        statusText: 'UPCOMING',
        badgeStyle: 'bg-slate-900 text-slate-400 border-slate-800',
        progressText: `Target: < ${target}`,
        progressPct: 0,
        gameStatusText: gameClock,
        currentValue: 0,
      };
    }
  }

  // 2. Anytime Touchdown
  if (leg.type === 'anytime_td') {
    const player = allPlayers.find(
      (p) =>
        (leg.playerId && p.id === leg.playerId) ||
        p.name.toLowerCase() === leg.playerName?.toLowerCase()
    );

    const isLive = Boolean(player?.isGameLive || player?.isLive || player?.gameStatus?.state === 'in');
    const isPost = player?.gameStatus?.state === 'post';
    const gameClock = player
      ? `${player.team.abbreviation} vs ${player.opponent.abbreviation} • ${player.gameStatus?.detail || (isLive ? 'LIVE' : isPost ? 'FINAL' : 'Upcoming')}`
      : 'Upcoming';

    const raw = player?.playerRawStats;
    const tdCount = raw
      ? raw.rushTD + raw.recTD + (raw.anytimeTD ? 1 : 0)
      : (player?.stats.rushingTouchdowns || 0) + (player?.stats.receivingTouchdowns || 0);

    if (tdCount > 0) {
      return {
        status: 'cashed',
        statusText: 'CASHED (TD)',
        badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.4)]',
        progressText: `${tdCount} TD Scored`,
        progressPct: 100,
        gameStatusText: gameClock,
        currentValue: tdCount,
      };
    }
    if (isPost) {
      return {
        status: 'chalked',
        statusText: 'CHALKED',
        badgeStyle: 'bg-rose-950/80 text-rose-300 border-rose-500/50',
        progressText: '0 TDs (Game Final)',
        progressPct: 0,
        gameStatusText: gameClock,
        currentValue: 0,
      };
    }
    if (isLive) {
      return {
        status: 'sweating',
        statusText: 'HUNTING TD',
        badgeStyle: 'bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse',
        progressText: '0 TDs so far',
        progressPct: 35,
        gameStatusText: gameClock,
        currentValue: 0,
      };
    }
    return {
      status: 'upcoming',
      statusText: 'UPCOMING',
      badgeStyle: 'bg-slate-900 text-slate-400 border-slate-800',
      progressText: 'Awaiting Kickoff',
      progressPct: 0,
      gameStatusText: gameClock,
      currentValue: 0,
    };
  }

  // 3. Game Spread
  if (leg.type === 'spread') {
    const game = games.find(
      (g) =>
        (leg.gameId && g.id === leg.gameId) ||
        g.awayTeam.abbreviation === leg.teamAbbr ||
        g.homeTeam.abbreviation === leg.teamAbbr
    );

    if (!game) {
      return {
        status: 'upcoming',
        statusText: 'PENDING',
        badgeStyle: 'bg-slate-900 text-slate-400 border-slate-800',
        progressText: 'Game Not Found',
        progressPct: 0,
      };
    }

    const isLive = game.status.state === 'in';
    const isPost = game.status.state === 'post';
    const isAway = game.awayTeam.abbreviation === leg.teamAbbr;
    const teamScore = isAway ? game.awayTeam.score : game.homeTeam.score;
    const oppScore = isAway ? game.homeTeam.score : game.awayTeam.score;
    const spread = leg.spread || 0;
    const diff = teamScore + spread - oppScore;
    const gameClock = `${game.awayTeam.abbreviation} ${game.awayTeam.score} - ${game.homeTeam.score} ${game.homeTeam.abbreviation} • ${game.status.shortDetail || (isLive ? 'LIVE' : isPost ? 'FINAL' : 'Upcoming')}`;

    if (isPost) {
      if (diff > 0) {
        return {
          status: 'cashed',
          statusText: 'CASHED',
          badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.4)]',
          progressText: `Covered by +${diff.toFixed(1)} pts`,
          progressPct: 100,
          gameStatusText: gameClock,
        };
      } else if (diff === 0) {
        return {
          status: 'cashed',
          statusText: 'PUSH',
          badgeStyle: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
          progressText: 'Push',
          progressPct: 100,
          gameStatusText: gameClock,
        };
      } else {
        return {
          status: 'chalked',
          statusText: 'CHALKED',
          badgeStyle: 'bg-rose-950/80 text-rose-300 border-rose-500/50',
          progressText: `Missed by ${Math.abs(diff).toFixed(1)} pts`,
          progressPct: 0,
          gameStatusText: gameClock,
        };
      }
    }

    if (isLive) {
      const isCovering = diff > 0;
      return {
        status: isCovering ? 'covering' : 'sweating',
        statusText: isCovering ? 'COVERING' : 'TRAILING SPREAD',
        badgeStyle: isCovering
          ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
          : 'bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse',
        progressText: isCovering ? `Covering (+${diff.toFixed(1)})` : `Trailing (${diff.toFixed(1)})`,
        progressPct: isCovering ? 75 : 35,
        gameStatusText: gameClock,
      };
    }

    return {
      status: 'upcoming',
      statusText: 'UPCOMING',
      badgeStyle: 'bg-slate-900 text-slate-400 border-slate-800',
      progressText: `${leg.teamAbbr} ${spread > 0 ? `+${spread}` : spread}`,
      progressPct: 0,
      gameStatusText: game.status.shortDetail || 'Upcoming',
    };
  }

  // 4. Moneyline / Total
  if (leg.type === 'moneyline') {
    const game = games.find(
      (g) =>
        (leg.gameId && g.id === leg.gameId) ||
        g.awayTeam.abbreviation === leg.teamAbbr ||
        g.homeTeam.abbreviation === leg.teamAbbr
    );

    if (!game) {
      return {
        status: 'upcoming',
        statusText: 'PENDING',
        badgeStyle: 'bg-slate-900 text-slate-400 border-slate-800',
        progressText: 'Game Not Found',
        progressPct: 0,
      };
    }

    const isLive = game.status.state === 'in';
    const isPost = game.status.state === 'post';
    const isAway = game.awayTeam.abbreviation === leg.teamAbbr;
    const teamScore = isAway ? game.awayTeam.score : game.homeTeam.score;
    const oppScore = isAway ? game.homeTeam.score : game.awayTeam.score;
    const gameClock = `${game.awayTeam.abbreviation} ${game.awayTeam.score} - ${game.homeTeam.score} ${game.homeTeam.abbreviation} • ${game.status.shortDetail || (isLive ? 'LIVE' : isPost ? 'FINAL' : 'Upcoming')}`;

    if (isPost) {
      if (teamScore > oppScore) {
        return {
          status: 'cashed',
          statusText: 'CASHED',
          badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.4)]',
          progressText: `Won by ${teamScore - oppScore} pts`,
          progressPct: 100,
          gameStatusText: gameClock,
        };
      } else {
        return {
          status: 'chalked',
          statusText: 'CHALKED',
          badgeStyle: 'bg-rose-950/80 text-rose-300 border-rose-500/50',
          progressText: 'Lost Game',
          progressPct: 0,
          gameStatusText: gameClock,
        };
      }
    }

    if (isLive) {
      const winning = teamScore > oppScore;
      return {
        status: winning ? 'covering' : 'sweating',
        statusText: winning ? 'LEADING' : 'TRAILING',
        badgeStyle: winning
          ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
          : 'bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse',
        progressText: `${teamScore} - ${oppScore}`,
        progressPct: winning ? 70 : 30,
        gameStatusText: gameClock,
      };
    }

    return {
      status: 'upcoming',
      statusText: 'UPCOMING',
      badgeStyle: 'bg-slate-900 text-slate-400 border-slate-800',
      progressText: `${leg.teamAbbr} Moneyline`,
      progressPct: 0,
      gameStatusText: game.status.shortDetail || 'Upcoming',
    };
  }

  if (leg.type === 'total') {
    const game = games.find((g) => g.id === leg.gameId);
    if (!game) {
      return {
        status: 'upcoming',
        statusText: 'PENDING',
        badgeStyle: 'bg-slate-900 text-slate-400 border-slate-800',
        progressText: 'Game Not Found',
        progressPct: 0,
      };
    }

    const isLive = game.status.state === 'in';
    const isPost = game.status.state === 'post';
    const totalCurrent = game.awayTeam.score + game.homeTeam.score;
    const target = leg.totalPoints || 0;
    const direction = leg.direction || 'OVER';
    const progressPct = target > 0 ? Math.min(100, Math.round((totalCurrent / target) * 100)) : 0;
    const gameClock = `${game.awayTeam.abbreviation} ${game.awayTeam.score} - ${game.homeTeam.score} ${game.homeTeam.abbreviation} • ${game.status.shortDetail || (isLive ? 'LIVE' : isPost ? 'FINAL' : 'Upcoming')}`;

    if (direction === 'OVER') {
      if (totalCurrent > target) {
        return {
          status: 'cashed',
          statusText: 'CASHED',
          badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.4)]',
          progressText: `${totalCurrent} / ${target} pts`,
          progressPct: 100,
          gameStatusText: gameClock,
        };
      }
      if (isPost) {
        return {
          status: 'chalked',
          statusText: 'CHALKED',
          badgeStyle: 'bg-rose-950/80 text-rose-300 border-rose-500/50',
          progressText: `${totalCurrent} / ${target} pts`,
          progressPct,
          gameStatusText: gameClock,
        };
      }
      if (isLive) {
        const isCovering = progressPct >= 65;
        return {
          status: isCovering ? 'covering' : 'sweating',
          statusText: isCovering ? 'ON PACE' : 'SWEATING',
          badgeStyle: isCovering
            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
            : 'bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse',
          progressText: `${totalCurrent} / ${target} pts (${progressPct}%)`,
          progressPct,
          gameStatusText: gameClock,
        };
      }
      return {
        status: 'upcoming',
        statusText: 'UPCOMING',
        badgeStyle: 'bg-slate-900 text-slate-400 border-slate-800',
        progressText: `Target: > ${target} pts`,
        progressPct: 0,
        gameStatusText: game.status.shortDetail || 'Upcoming',
      };
    } else {
      // UNDER
      if (totalCurrent > target) {
        return {
          status: 'chalked',
          statusText: 'CHALKED',
          badgeStyle: 'bg-rose-950/80 text-rose-300 border-rose-500/50',
          progressText: `${totalCurrent} / ${target} pts (Exceeded)`,
          progressPct: 100,
          gameStatusText: gameClock,
        };
      }
      if (isPost) {
        return {
          status: 'cashed',
          statusText: 'CASHED',
          badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.4)]',
          progressText: `${totalCurrent} / ${target} pts (Stayed Under)`,
          progressPct: 100,
          gameStatusText: gameClock,
        };
      }
      if (isLive) {
        const isSafe = progressPct <= 60;
        return {
          status: isSafe ? 'covering' : 'sweating',
          statusText: isSafe ? 'UNDER PACE' : 'SWEATING',
          badgeStyle: isSafe
            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
            : 'bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse',
          progressText: `${totalCurrent} / ${target} pts`,
          progressPct,
          gameStatusText: gameClock,
        };
      }
      return {
        status: 'upcoming',
        statusText: 'UPCOMING',
        badgeStyle: 'bg-slate-900 text-slate-400 border-slate-800',
        progressText: `Target: < ${target} pts`,
        progressPct: 0,
        gameStatusText: game.status.shortDetail || 'Upcoming',
      };
    }
  }

  return {
    status: 'upcoming',
    statusText: 'PENDING',
    badgeStyle: 'bg-slate-900 text-slate-400 border-slate-800',
    progressText: '',
    progressPct: 0,
  };
}

function getSlipSummary(slip: BetSlip, allPlayers: FantasyPlayer[], games: LiveGame[]) {
  const gradedLegs = slip.legs.map((leg) => ({
    leg,
    result: gradeBetLeg(leg, allPlayers, games),
  }));

  const total = gradedLegs.length;
  const cashedCount = gradedLegs.filter((g) => g.result.status === 'cashed').length;
  const chalkedCount = gradedLegs.filter((g) => g.result.status === 'chalked').length;
  const coveringCount = gradedLegs.filter((g) => g.result.status === 'covering').length;

  let overallStatus: 'cashed' | 'chalked' | 'live' = 'live';
  let badgeLabel = `${cashedCount}/${total} LEGS HIT`;
  let badgeStyle = 'bg-amber-500/20 text-amber-300 border-amber-500/50';

  if (cashedCount === total && total > 0) {
    overallStatus = 'cashed';
    badgeLabel = `ALL ${total} LEGS CASHED`;
    badgeStyle = 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-[0_0_15px_rgba(16,185,129,0.8)]';
  } else if (chalkedCount > 0) {
    overallStatus = 'chalked';
    badgeLabel = `BUSTED (${cashedCount}/${total} Hit)`;
    badgeStyle = 'bg-rose-950/80 text-rose-300 border-rose-500/50';
  } else if (coveringCount > 0) {
    badgeLabel = `${cashedCount + coveringCount}/${total} ON TRACK`;
    badgeStyle = 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50';
  }

  return { gradedLegs, total, cashedCount, chalkedCount, overallStatus, badgeLabel, badgeStyle };
}

interface SyncedLeagueTeam {
  id?: string | number;
  rosterId?: number;
  ownerId?: string;
  displayName?: string;
  ownerName?: string;
  name?: string;
  teamName?: string;
  avatar?: string;
  logo?: string;
  players?: string[];
  starters?: string[];
  roster?: Array<{ id?: string | number; name?: string }>;
}

interface SyncedLeaguePayload {
  leagueId?: string;
  name?: string;
  season?: string | number;
  week?: number;
  currentPeriod?: number;
  teams?: SyncedLeagueTeam[];
  matchups?: Array<{
    id: string | number;
    team1: {
      teamId: string | number;
      ownerName: string;
      teamName: string;
      points: number;
      customPoints?: number;
      logo?: string;
    };
    team2: {
      teamId: string | number;
      ownerName: string;
      teamName: string;
      points: number;
      customPoints?: number;
      logo?: string;
    };
  }>;
}

/**
 * Dynamically generates realistic live prop lines and evaluates current progress
 * for player props market cards in the Betting tab
 */
function getPlayerPropsSummary(player: FantasyPlayer) {
  const pos = player.position;
  const raw = player.playerRawStats;
  const stats = player.stats;

  if (pos === 'QB') {
    const passYdsTarget = 238.5;
    const currentPassYds = raw?.passYds ?? (stats.passingYards || 0);
    const passTdsTarget = 1.5;
    const currentPassTds = raw?.passTD ?? (stats.passingTouchdowns || 0);
    return [
      {
        id: 'passYds',
        label: 'Pass Yds',
        target: passYdsTarget,
        current: currentPassYds,
        unit: 'YDS',
        pct: Math.min(100, Math.round((currentPassYds / passYdsTarget) * 100)),
        statusText: currentPassYds >= passYdsTarget ? 'COVERED' : `${currentPassYds} / ${passYdsTarget} YDS`,
        isCashed: currentPassYds >= passYdsTarget,
      },
      {
        id: 'passTD',
        label: 'Pass TDs',
        target: passTdsTarget,
        current: currentPassTds,
        unit: 'TD',
        pct: Math.min(100, Math.round((currentPassTds / passTdsTarget) * 100)),
        statusText: currentPassTds >= passTdsTarget ? 'COVERED' : `${currentPassTds} / ${passTdsTarget} TD`,
        isCashed: currentPassTds >= passTdsTarget,
      },
    ];
  }

  if (pos === 'RB') {
    const rushYdsTarget = 62.5;
    const currentRushYds = raw?.rushYds ?? (stats.rushingYards || 0);
    const rushTds = (raw?.rushTD ?? 0) + (raw?.recTD ?? 0) + (stats.rushingTouchdowns || 0);
    return [
      {
        id: 'rushYds',
        label: 'Rush Yds',
        target: rushYdsTarget,
        current: currentRushYds,
        unit: 'YDS',
        pct: Math.min(100, Math.round((currentRushYds / rushYdsTarget) * 100)),
        statusText: currentRushYds >= rushYdsTarget ? 'COVERED' : `${currentRushYds} / ${rushYdsTarget} YDS`,
        isCashed: currentRushYds >= rushYdsTarget,
      },
      {
        id: 'anytimeTD',
        label: 'Anytime TD',
        target: 1,
        current: rushTds,
        unit: 'TD',
        pct: rushTds > 0 ? 100 : 35,
        statusText: rushTds > 0 ? 'TD CASHED' : 'HUNTING TD',
        isCashed: rushTds > 0,
      },
    ];
  }

  if (pos === 'WR' || pos === 'TE') {
    const recYdsTarget = pos === 'WR' ? 48.5 : 36.5;
    const currentRecYds = raw?.recYds ?? (stats.receivingYards || 0);
    const recTarget = pos === 'WR' ? 4.5 : 3.5;
    const currentRec = raw?.rec ?? (stats.receptions || 0);
    const tds = (raw?.recTD ?? 0) + (raw?.rushTD ?? 0) + (stats.receivingTouchdowns || 0);
    return [
      {
        id: 'recYds',
        label: 'Rec Yds',
        target: recYdsTarget,
        current: currentRecYds,
        unit: 'YDS',
        pct: Math.min(100, Math.round((currentRecYds / recYdsTarget) * 100)),
        statusText: currentRecYds >= recYdsTarget ? 'COVERED' : `${currentRecYds} / ${recYdsTarget} YDS`,
        isCashed: currentRecYds >= recYdsTarget,
      },
      {
        id: 'rec',
        label: 'Receptions',
        target: recTarget,
        current: currentRec,
        unit: 'REC',
        pct: Math.min(100, Math.round((currentRec / recTarget) * 100)),
        statusText: currentRec >= recTarget ? 'COVERED' : `${currentRec} / ${recTarget} REC`,
        isCashed: currentRec >= recTarget,
      },
      {
        id: 'anytimeTD',
        label: 'Anytime TD',
        target: 1,
        current: tds,
        unit: 'TD',
        pct: tds > 0 ? 100 : 35,
        statusText: tds > 0 ? 'TD CASHED' : 'HUNTING TD',
        isCashed: tds > 0,
      },
    ];
  }

  if (pos === 'K') {
    const fgTarget = 1.5;
    const currentFg = stats.fgMade || 0;
    return [
      {
        id: 'fgMade',
        label: 'FG Made',
        target: fgTarget,
        current: currentFg,
        unit: 'FG',
        pct: Math.min(100, Math.round((currentFg / fgTarget) * 100)),
        statusText: currentFg >= fgTarget ? 'COVERED' : `${currentFg} / ${fgTarget} FG`,
        isCashed: currentFg >= fgTarget,
      },
    ];
  }

  return [];
}

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
}

interface SyncCountdownProps {
  onSync: () => void;
  intervalSec?: number;
}

/**
 * Pure 60fps Optimization: Memoized 1-second countdown clock.
 * Prevents the entire parent dashboard from re-rendering every 1,000ms.
 */
const SyncCountdown = React.memo(function SyncCountdown({ onSync, intervalSec = 15 }: SyncCountdownProps) {
  const [countdown, setCountdown] = useState(intervalSec);
  const [isSpinning, setIsSpinning] = useState(false);
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onSyncRef.current();
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [intervalSec]);

  const handleManualRefresh = () => {
    setIsSpinning(true);
    setCountdown(intervalSec);
    onSyncRef.current();
    setTimeout(() => setIsSpinning(false), 900);
  };

  return (
    <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-800 shadow-inner shrink-0 text-xs whitespace-nowrap">
      <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">NEXT SYNC:</span>
      <span className="tv-tabular text-cyan-300 font-black w-4 text-center text-xs">
        {countdown}s
      </span>

      <button
        onClick={handleManualRefresh}
        title="Force Refresh Data"
        className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
      >
        <RefreshCw className={`w-3 h-3 ${isSpinning ? 'animate-spin text-emerald-400' : ''}`} />
      </button>
    </div>
  );
});

export default function TVCommandCenter() {
  const [data, setData] = useState<LiveFantasyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // User Controls
  const [activeTab, setActiveTab] = useState<MainTab>('live');
  const [scoringFormat, setScoringFormat] = useState<ScoringFormat>('ppr');
  const [autoCycle, setAutoCycle] = useState(true);

  // Game Filter Mode: 'live' (active in-progress games) vs 'all' (all games including final)
  const [gameFilterMode, setGameFilterMode] = useState<'live' | 'all'>('live');
  const [hasUserToggledFilter, setHasUserToggledFilter] = useState(false);

  // Modal State
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isBetsModalOpen, setIsBetsModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Web Audio Alert Sound Settings & Cashed Bet Tracking
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);
  const seenCashedItemsRef = useRef<Set<string>>(new Set());
  const hasInitializedBetsRef = useRef<boolean>(false);

  // Continuous 6-Hour TV Run Stability: Screen Wake Lock
  const [isWakeLockActive, setIsWakeLockActive] = useState<boolean>(false);
  const wakeLockSentinelRef = useRef<WakeLockSentinelLike | null>(null);

  // Persisted Leagues, Guests & Bets State
  const [syncedLeagues, setSyncedLeagues] = useState<SyncedLeagueConfig[]>([]);
  const [guestTags, setGuestTags] = useState<GuestTagConfig[]>([]);
  const [syncedLeagueData, setSyncedLeagueData] = useState<Record<string, SyncedLeaguePayload>>({});
  const [savedBets, setSavedBets] = useState<BetSlip[]>([]);
  const [bettingSubView, setBettingSubView] = useState<'slips' | 'props'>('slips');
  const [bettingSearch, setBettingSearch] = useState('');
  const [bettingGameFilter, setBettingGameFilter] = useState('ALL');
  const [bettingPosFilter, setBettingPosFilter] = useState<'ALL' | 'QB' | 'RB' | 'WR' | 'TE' | 'K'>('ALL');

  // Timers & Cycling
  const [cycleProgress, setCycleProgress] = useState(0); // 0 to 100%
  const CYCLE_DURATION_SEC = 18;

  // Real-time delta tracking
  const prevPointsRef = useRef<Map<string, number>>(new Map());
  const [boostedPlayers, setBoostedPlayers] = useState<Record<string, { delta: number; timestamp: number }>>({});
  const [burstAlerts, setBurstAlerts] = useState<PointBurstAlert[]>([]);

  // Touchdown Alert Queue & Active Overlay with Strict Baseline Initialization
  const hasInitializedAlertsRef = useRef<boolean>(false);
  const seenTouchdownsRef = useRef<Set<string>>(new Set());
  const [tdAlertQueue, setTdAlertQueue] = useState<TouchdownAlert[]>([]);
  const [activeTdAlert, setActiveTdAlert] = useState<TouchdownAlert | null>(null);
  const [tdProgress, setTdProgress] = useState(100);

  // Scoreboard scroll ref
  const scoreboardRef = useRef<HTMLDivElement>(null);

  // Mark client mounted to prevent hydration mismatches
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load Persisted Leagues, Guests & Bets from localStorage + seen TDs from sessionStorage on Mount
  useEffect(() => {
    // 1. Load seen_td_ids from sessionStorage to prevent TD spam on reload
    try {
      const storedTd = sessionStorage.getItem('seen_td_ids');
      if (storedTd) {
        const parsed = JSON.parse(storedTd);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => seenTouchdownsRef.current.add(id));
        }
      }
    } catch (e) {
      console.error('Failed to load sessionStorage seen_td_ids:', e);
    }

    // 2. Load Leagues
    try {
      const storedLeagues = localStorage.getItem('nfl_tv_synced_leagues');
      if (storedLeagues) {
        setSyncedLeagues(JSON.parse(storedLeagues));
      }

      const storedGuests = localStorage.getItem('nfl_tv_guest_tags');
      if (storedGuests) {
        setGuestTags(JSON.parse(storedGuests));
      } else {
        // Default Demo Room Setup if fresh start
        const defaultGuests: GuestTagConfig[] = [
          {
            id: 'demo-alex',
            guestName: 'Alex',
            teamName: "Alex's Studs",
            players: [
              { name: 'Caleb Williams', position: 'QB', team: 'CHI' },
              { name: "D'Andre Swift", position: 'RB', team: 'CHI' },
              { name: 'Rome Odunze', position: 'WR', team: 'CHI' },
              { name: 'Cairo Santos', position: 'K', team: 'CHI' },
              { name: 'Bears D/ST', position: 'DEF', team: 'CHI' },
            ],
          },
          {
            id: 'demo-nick',
            guestName: 'Nick',
            teamName: "Nick's Juggernaut",
            players: [
              { name: 'Trevor Lawrence', position: 'QB', team: 'JAX' },
              { name: 'Bhayshul Tuten', position: 'RB', team: 'JAX' },
              { name: 'Jaxon Smith-Njigba', position: 'WR', team: 'SEA' },
              { name: 'Foster Moreau', position: 'TE', team: 'HOU' },
              { name: "Ka'imi Fairbairn", position: 'K', team: 'HOU' },
            ],
          },
          {
            id: 'demo-dan',
            guestName: 'Dan',
            teamName: "Dan's Dynasty",
            players: [
              { name: 'Tyler Huntley', position: 'QB', team: 'BAL' },
              { name: 'Bijan Robinson', position: 'RB', team: 'ATL' },
              { name: 'Kyle Pitts Sr.', position: 'TE', team: 'ATL' },
              { name: 'Broncos D/ST', position: 'DEF', team: 'DEN' },
              { name: 'Tyler Loop', position: 'K', team: 'BAL' },
            ],
          },
        ];
        setGuestTags(defaultGuests);
        localStorage.setItem('nfl_tv_guest_tags', JSON.stringify(defaultGuests));
      }

      // 3. Load Saved Bets & Parlays
      const storedBets = localStorage.getItem('nfl_tv_bets');
      if (storedBets) {
        setSavedBets(JSON.parse(storedBets));
      } else {
        const defaultBets: BetSlip[] = [
          {
            id: 'demo-slip-1',
            title: "Sunday Room Lock (+600)",
            ownerName: "Living Room",
            wager: "$25",
            payout: "$175 (+600)",
            createdAt: Date.now(),
            legs: [
              {
                id: 'leg-demo-1',
                type: 'anytime_td',
                playerName: "Kenneth Walker III",
                playerTeam: "SEA",
                description: "Kenneth Walker III Anytime Touchdown",
              },
              {
                id: 'leg-demo-2',
                type: 'player_prop',
                playerName: "Caleb Williams",
                playerTeam: "CHI",
                statType: 'passYds',
                direction: 'OVER',
                targetValue: 215.5,
                description: "Caleb Williams OVER 215.5 Pass Yds",
              },
              {
                id: 'leg-demo-3',
                type: 'spread',
                teamAbbr: "CHI",
                spread: -2.5,
                description: "CHI -2.5 vs JAX",
              },
              {
                id: 'leg-demo-4',
                type: 'total',
                direction: 'OVER',
                totalPoints: 44.5,
                description: "OVER 44.5 Total Points (JAX vs CHI)",
              },
            ],
          },
        ];
        setSavedBets(defaultBets);
        localStorage.setItem('nfl_tv_bets', JSON.stringify(defaultBets));
      }

      // 4. Load Audio Sound setting
      const storedSound = localStorage.getItem('nfl_tv_sound');
      if (storedSound !== null) {
        setIsSoundEnabled(storedSound === 'true');
      }
    } catch (e) {
      console.error('Failed to load localStorage leagues/guests/bets:', e);
    }
  }, []);

  // Room State Synchronization (/api/room-state)
  const lastRoomStateSyncRef = useRef<number>(0);

  const pushRoomState = useCallback(
    async (override?: {
      syncedLeagues?: SyncedLeagueConfig[];
      guestTags?: GuestTagConfig[];
      savedBets?: BetSlip[];
    }) => {
      try {
        const payload = {
          syncedLeagues: override?.syncedLeagues ?? syncedLeagues,
          guestTags: override?.guestTags ?? guestTags,
          savedBets: override?.savedBets ?? savedBets,
        };
        const res = await fetch('/api/room-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.state?.lastUpdated) {
            lastRoomStateSyncRef.current = json.state.lastUpdated;
          }
        }
      } catch (e) {
        console.error('Failed to push room state to server:', e);
      }
    },
    [syncedLeagues, guestTags, savedBets]
  );

  const fetchRoomState = useCallback(async () => {
    try {
      const res = await fetch('/api/room-state', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.state) {
        const serverState = json.state;
        if (serverState.lastUpdated > lastRoomStateSyncRef.current) {
          const hasServerData =
            (Array.isArray(serverState.syncedLeagues) && serverState.syncedLeagues.length > 0) ||
            (Array.isArray(serverState.guestTags) && serverState.guestTags.length > 0) ||
            (Array.isArray(serverState.savedBets) && serverState.savedBets.length > 0);

          if (lastRoomStateSyncRef.current === 0 && !hasServerData) {
            // First run and server is empty: seed server with current local storage
            lastRoomStateSyncRef.current = serverState.lastUpdated;
            try {
              const localLeagues = JSON.parse(localStorage.getItem('nfl_tv_synced_leagues') || '[]');
              const localGuests = JSON.parse(localStorage.getItem('nfl_tv_guest_tags') || '[]');
              const localBets = JSON.parse(localStorage.getItem('nfl_tv_bets') || '[]');
              if (localLeagues.length > 0 || localGuests.length > 0 || localBets.length > 0) {
                pushRoomState({
                  syncedLeagues: localLeagues,
                  guestTags: localGuests,
                  savedBets: localBets,
                });
              }
            } catch {}
          } else {
            // Sync server state down to client
            lastRoomStateSyncRef.current = serverState.lastUpdated;
            if (Array.isArray(serverState.syncedLeagues)) {
              setSyncedLeagues(serverState.syncedLeagues);
              try {
                localStorage.setItem('nfl_tv_synced_leagues', JSON.stringify(serverState.syncedLeagues));
              } catch {}
            }
            if (Array.isArray(serverState.guestTags)) {
              setGuestTags(serverState.guestTags);
              try {
                localStorage.setItem('nfl_tv_guest_tags', JSON.stringify(serverState.guestTags));
              } catch {}
            }
            if (Array.isArray(serverState.savedBets)) {
              setSavedBets(serverState.savedBets);
              try {
                localStorage.setItem('nfl_tv_bets', JSON.stringify(serverState.savedBets));
              } catch {}
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to sync room state from server:', e);
    }
  }, [pushRoomState]);

  // Initial Room State Sync
  useEffect(() => {
    fetchRoomState();
  }, [fetchRoomState]);

  const handleToggleSound = () => {
    setIsSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('nfl_tv_sound', String(next));
      } catch {}
      if (next) {
        playBroadcastAlertSound('cashed');
      }
      return next;
    });
  };

  // Continuous 6-Hour TV Run Stability: Screen Wake Lock
  const requestWakeLock = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const nav = navigator as unknown as { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } };
    if (!nav.wakeLock) return;

    try {
      if (wakeLockSentinelRef.current && !wakeLockSentinelRef.current.released) {
        setIsWakeLockActive(true);
        return;
      }
      const sentinel = await nav.wakeLock.request('screen');
      wakeLockSentinelRef.current = sentinel;
      setIsWakeLockActive(true);
      sentinel.addEventListener('release', () => {
        setIsWakeLockActive(false);
      });
    } catch {
      setIsWakeLockActive(false);
    }
  }, []);

  useEffect(() => {
    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    const handleUserInteraction = () => {
      if (!wakeLockSentinelRef.current || wakeLockSentinelRef.current.released) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      if (wakeLockSentinelRef.current) {
        wakeLockSentinelRef.current.release().catch(() => {});
      }
    };
  }, [requestWakeLock]);

  // Save changes to localStorage and push to shared room state
  const handleUpdateLeagues = (leagues: SyncedLeagueConfig[]) => {
    setSyncedLeagues(leagues);
    try {
      localStorage.setItem('nfl_tv_synced_leagues', JSON.stringify(leagues));
    } catch (e) {
      console.error(e);
    }
    pushRoomState({ syncedLeagues: leagues });
  };

  const handleUpdateGuests = (guests: GuestTagConfig[]) => {
    setGuestTags(guests);
    try {
      localStorage.setItem('nfl_tv_guest_tags', JSON.stringify(guests));
    } catch (e) {
      console.error(e);
    }
    pushRoomState({ guestTags: guests });
  };

  const handleUpdateBets = (bets: BetSlip[]) => {
    setSavedBets(bets);
    try {
      localStorage.setItem('nfl_tv_bets', JSON.stringify(bets));
    } catch (e) {
      console.error('Failed to save bets to localStorage:', e);
    }
    pushRoomState({ savedBets: bets });
  };

  // Sync connected leagues (Sleeper & ESPN) with stale-while-revalidate safety
  const syncLeaguesData = useCallback(async () => {
    if (syncedLeagues.length === 0) return;

    for (const league of syncedLeagues) {
      try {
        let json: SyncedLeaguePayload | null = null;
        if (league.type === 'sleeper') {
          const res = await fetch(`/api/sleeper-league?leagueId=${league.leagueId}&week=${league.week || 6}`);
          if (res.ok) {
            json = await res.json();
          }
        } else if (league.type === 'espn') {
          let url = `/api/espn-league?leagueId=${league.leagueId}&season=${league.season || '2026'}&week=${league.week || 6}`;
          if (league.swid) url += `&swid=${encodeURIComponent(league.swid)}`;
          if (league.espn_s2) url += `&espn_s2=${encodeURIComponent(league.espn_s2)}`;

          const res = await fetch(url);
          if (res.ok) {
            json = await res.json();
          }
        }

        // Only update if valid data with matchups or teams was returned (never overwrite with empty)
        if (json && (Array.isArray(json.matchups) || Array.isArray(json.teams))) {
          setSyncedLeagueData((prev) => ({ ...prev, [league.leagueId]: json }));
        }
      } catch (err) {
        console.error(`Error syncing league ${league.name}:`, err);
      }
    }
  }, [syncedLeagues]);

  // Sync league data when leagues change or periodically
  useEffect(() => {
    syncLeaguesData();
  }, [syncLeaguesData]);

  // Build Player Ownership Map: Map<string, PlayerOwnerTag[]>
  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

  const playerOwnershipMap = useMemo(() => {
    const map = new Map<string, PlayerOwnerTag[]>();

    const addTag = (key: string, tag: PlayerOwnerTag) => {
      if (!key) return;
      const k = normalize(key);
      const existing = map.get(k) || [];
      if (!existing.some((t) => t.ownerName === tag.ownerName && t.leagueName === tag.leagueName)) {
        existing.push(tag);
        map.set(k, existing);
      }
    };

    // 1. Tagged Living Room Friends (Guests)
    for (const guest of guestTags) {
      for (const p of guest.players) {
        const tag: PlayerOwnerTag = {
          ownerName: guest.guestName,
          teamName: guest.teamName || `${guest.guestName}'s Squad`,
          leagueName: 'Living Room',
          leagueType: 'guest',
        };
        addTag(p.name, tag);
        if (p.id) addTag(p.id, tag);
        if (p.team) addTag(p.team, tag);
      }
    }

    // 2. Synced Leagues (Sleeper & ESPN)
    for (const [leagueId, leagueData] of Object.entries(syncedLeagueData)) {
      const config = syncedLeagues.find((l) => l.leagueId === leagueId);
      const leagueName = config?.name || leagueData?.name || 'League';
      const leagueType = config?.type || 'sleeper';

      for (const team of leagueData?.teams || []) {
        const tag: PlayerOwnerTag = {
          ownerName: team.ownerName || team.displayName || 'Manager',
          teamName: team.name || team.teamName || 'Team',
          leagueName,
          leagueType,
        };

        // ESPN Roster
        for (const p of team.roster || []) {
          if (p.id) addTag(String(p.id), tag);
          if (p.name) addTag(p.name, tag);
        }

        // Sleeper Players
        for (const pid of team.players || []) {
          addTag(String(pid), tag);
        }
      }
    }

    return map;
  }, [guestTags, syncedLeagueData, syncedLeagues]);

  // Helper to get ownership tags for a given player
  const getOwnershipTags = useCallback(
    (player: FantasyPlayer): PlayerOwnerTag[] => {
      const byName = playerOwnershipMap.get(normalize(player.name)) || [];
      const byId = playerOwnershipMap.get(normalize(player.id)) || [];
      const byTeam =
        player.position === 'DEF'
          ? playerOwnershipMap.get(normalize(player.team.abbreviation)) || []
          : [];

      const combined = [...byName, ...byId, ...byTeam];
      const unique: PlayerOwnerTag[] = [];
      for (const t of combined) {
        if (!unique.some((u) => u.ownerName === t.ownerName && u.leagueName === t.leagueName)) {
          unique.push(t);
        }
      }
      return unique;
    },
    [playerOwnershipMap]
  );

  /**
   * Fetch live fantasy data from backend API
   */
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/live-fantasy', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: LiveFantasyResponse = await res.json();

      // Detect Fantasy Point Deltas
      const newBoosts: Record<string, { delta: number; timestamp: number }> = {};
      const newAlerts: PointBurstAlert[] = [];
      const now = Date.now();

      // Check all players across all positions
      for (const pos of ['QB', 'RB', 'WR', 'TE', 'DEF', 'K'] as FantasyPosition[]) {
        const players = json.leaderboards?.[pos] || [];
        for (const p of players) {
          const currentPts = p.points[scoringFormat] || 0;
          const prevPts = prevPointsRef.current.get(p.id);

          if (prevPts !== undefined && currentPts > prevPts) {
            const delta = Math.round((currentPts - prevPts) * 100) / 100;
            if (delta >= 0.1) {
              newBoosts[p.id] = { delta, timestamp: now };
              newAlerts.push({
                id: `${p.id}-${now}`,
                playerName: p.name,
                position: p.position,
                teamAbbr: p.team.abbreviation,
                teamLogo: p.team.logo,
                headshot: p.headshot,
                delta,
                newTotal: currentPts,
                timestamp: now,
              });
            }
          }
          prevPointsRef.current.set(p.id, currentPts);
        }
      }

      if (Object.keys(newBoosts).length > 0) {
        setBoostedPlayers((prev) => ({ ...prev, ...newBoosts }));
      }

      if (newAlerts.length > 0) {
        setBurstAlerts((prev) => [...newAlerts, ...prev].slice(0, 5));
      }

      // Cap liveUpdates to max 60 items in memory to guarantee long-running stability
      if (json.liveUpdates && json.liveUpdates.length > 60) {
        json.liveUpdates = json.liveUpdates.slice(0, 60);
      }
      const allUpdates = json.liveUpdates || [];
      const tdUpdates = allUpdates.filter((u) => u.type === 'touchdown');

      if (!hasInitializedAlertsRef.current) {
        // First load: seed ALL existing touchdowns so no historical alerts fire on startup
        for (const td of tdUpdates) {
          seenTouchdownsRef.current.add(td.id);
        }
        hasInitializedAlertsRef.current = true;
        try {
          sessionStorage.setItem('seen_td_ids', JSON.stringify(Array.from(seenTouchdownsRef.current)));
        } catch {}
      } else {
        // Subsequent background polls: only alert if unseen AND the game is actively in-progress
        const newTds: TouchdownAlert[] = [];
        const flatPlayers: FantasyPlayer[] = [];
        if (json.leaderboards) {
          for (const pos of ['QB', 'RB', 'WR', 'TE', 'DEF', 'K'] as FantasyPosition[]) {
            flatPlayers.push(...(json.leaderboards[pos] || []));
          }
        }

        for (const td of tdUpdates) {
          if (!seenTouchdownsRef.current.has(td.id)) {
            seenTouchdownsRef.current.add(td.id);

            // Skip any play that is not actively from a live in-progress game
            if (td.isGameLive !== true) {
              continue;
            }

            // Match athlete in play description
            const matchedPlayer = flatPlayers.find(
              (p) =>
                td.description.toLowerCase().includes(p.name.toLowerCase()) ||
                (p.shortName && td.description.includes(p.shortName)) ||
                (p.position === 'DEF' && p.team.abbreviation === td.team.abbreviation)
            );

            const owners = matchedPlayer ? getOwnershipTags(matchedPlayer) : [];

            newTds.push({
              id: td.id,
              playerName: matchedPlayer?.name || td.headline,
              playerHeadshot: matchedPlayer?.headshot,
              position: matchedPlayer?.position,
              teamAbbr: td.team?.abbreviation || matchedPlayer?.team.abbreviation || '',
              teamLogo: td.team?.logo || matchedPlayer?.team.logo,
              headline: td.headline,
              description: td.description,
              gameClock: td.gameClock,
              gameName: td.gameName,
              scoreSummary: td.scoreSummary,
              fantasyImpact: td.fantasyImpact,
              totalPoints: matchedPlayer?.points?.[scoringFormat],
              owners,
            });
          }
        }

        try {
          sessionStorage.setItem('seen_td_ids', JSON.stringify(Array.from(seenTouchdownsRef.current)));
        } catch {}

        if (newTds.length > 0) {
          setTdAlertQueue((prev) => [...prev, ...newTds]);
        }
      }

      setData(json);
      setError(null);
      // Periodically sync room state so mobile entries appear on TV
      fetchRoomState();
    } catch (err: unknown) {
      console.error('Failed to poll live fantasy data:', err);
      const message = err instanceof Error ? err.message : 'Error updating data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [scoringFormat, getOwnershipTags, fetchRoomState]);

  // Dequeue Touchdown Alerts into active display
  useEffect(() => {
    if (!activeTdAlert && tdAlertQueue.length > 0) {
      const nextAlert = tdAlertQueue[0];
      setTdAlertQueue((prev) => prev.slice(1));
      setActiveTdAlert(nextAlert);
      setTdProgress(100);
      if (isSoundEnabled) {
        playBroadcastAlertSound('touchdown');
      }
    }
  }, [activeTdAlert, tdAlertQueue, isSoundEnabled]);

  // 8-Second auto-dismiss countdown timer for active Touchdown Alert
  useEffect(() => {
    if (!activeTdAlert) return;
    setTdProgress(100);

    const stepMs = 100;
    const totalMs = 8000;
    const decrement = (stepMs / totalMs) * 100;

    const interval = setInterval(() => {
      setTdProgress((prev) => {
        if (prev <= decrement) {
          clearInterval(interval);
          setActiveTdAlert(null);
          return 0;
        }
        return prev - decrement;
      });
    }, stepMs);

    return () => clearInterval(interval);
  }, [activeTdAlert]);

  // Escape key listener to close TD Alert
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTdAlert(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initial Fetch on Mount
  useEffect(() => {
    fetchData();
    syncLeaguesData();
  }, [fetchData, syncLeaguesData]);

  // Combined Sync Handler passed to memoized <SyncCountdown />
  const handleSync = useCallback(() => {
    fetchData();
    syncLeaguesData();
    fetchRoomState();
  }, [fetchData, syncLeaguesData, fetchRoomState]);

  // Clean up old boost highlights (older than 6s)
  useEffect(() => {
    const cleaner = setInterval(() => {
      const now = Date.now();
      setBoostedPlayers((prev) => {
        let changed = false;
        const next: Record<string, { delta: number; timestamp: number }> = {};
        for (const [id, val] of Object.entries(prev)) {
          if (now - val.timestamp < 6000) {
            next[id] = val;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      setBurstAlerts((prev) => prev.filter((a) => now - a.timestamp < 10000));
    }, 1000);

    return () => clearInterval(cleaner);
  }, []);

  // Auto-Cycle TV Mode (cycles every 18 seconds)
  useEffect(() => {
    if (!autoCycle) {
      setCycleProgress(0);
      return;
    }

    const stepMs = 200;
    const totalSteps = (CYCLE_DURATION_SEC * 1000) / stepMs;
    let stepCount = 0;

    const cycleInterval = setInterval(() => {
      stepCount++;
      const pct = Math.min(100, (stepCount / totalSteps) * 100);
      setCycleProgress(pct);

      if (stepCount >= totalSteps) {
        stepCount = 0;
        setCycleProgress(0);
        setActiveTab((curr) => {
          const availableTabs = savedBets.length > 0 ? TABS : TABS.filter((t) => t.id !== 'bets');
          const currentIndex = availableTabs.findIndex((t) => t.id === curr);
          const nextIndex = (currentIndex + 1) % availableTabs.length;
          return availableTabs[nextIndex].id;
        });
      }
    }, stepMs);

    return () => clearInterval(cycleInterval);
  }, [autoCycle, savedBets]);

  // Live Games Count across all scoreboard events
  const liveGamesCount = useMemo(() => {
    return data?.games?.filter((g) => g.status.state === 'in').length || 0;
  }, [data]);

  // Auto-default: If user hasn't explicitly clicked a toggle yet, default to 'live' if active games exist, else 'all'
  useEffect(() => {
    if (!hasUserToggledFilter && data) {
      if (liveGamesCount > 0) {
        setGameFilterMode('live');
      } else {
        setGameFilterMode('all');
      }
    }
  }, [liveGamesCount, hasUserToggledFilter, data]);

  const handleSelectFilterMode = (mode: 'live' | 'all') => {
    setHasUserToggledFilter(true);
    setGameFilterMode(mode);
  };

  // All active players flat array for search, matching, and props
  const allActivePlayers = useMemo(() => {
    if (data?.allAvailablePlayers && data.allAvailablePlayers.length > 0) {
      return data.allAvailablePlayers;
    }
    if (data?.allPlayers && data.allPlayers.length > 0) {
      return data.allPlayers;
    }
    if (!data?.leaderboards) return [];
    const list: FantasyPlayer[] = [];
    for (const pos of ['QB', 'RB', 'WR', 'TE', 'DEF', 'K'] as FantasyPosition[]) {
      list.push(...(data.leaderboards[pos] || []));
    }
    return list;
  }, [data]);

  // Monitor Bet Slips & Legs for newly Cashed Wins
  useEffect(() => {
    if (!data?.games || savedBets.length === 0) return;

    const currentAvailablePlayers = data.allAvailablePlayers || data.allPlayers || allActivePlayers;
    const currentCashedIds = new Set<string>();

    savedBets.forEach((slip) => {
      const summary = getSlipSummary(slip, currentAvailablePlayers, data.games);
      if (summary.overallStatus === 'cashed') {
        currentCashedIds.add(`slip-${slip.id}`);
      }
      summary.gradedLegs.forEach((item) => {
        if (item.result.status === 'cashed') {
          currentCashedIds.add(`leg-${item.leg.id}`);
        }
      });
    });

    if (!hasInitializedBetsRef.current) {
      seenCashedItemsRef.current = currentCashedIds;
      hasInitializedBetsRef.current = true;
      return;
    }

    let newlyCashed = false;
    for (const id of currentCashedIds) {
      if (!seenCashedItemsRef.current.has(id)) {
        newlyCashed = true;
        seenCashedItemsRef.current.add(id);
      }
    }

    if (newlyCashed && isSoundEnabled) {
      playBroadcastAlertSound('cashed');
    }
  }, [data, savedBets, allActivePlayers, isSoundEnabled]);

  // Filtered master player market for Betting Tab
  const filteredMarketPlayers = useMemo(() => {
    const query = bettingSearch.trim().toLowerCase();
    let list = allActivePlayers;

    // Filter by game
    if (bettingGameFilter !== 'ALL') {
      const g = data?.games.find((gm) => gm.id === bettingGameFilter);
      if (g) {
        const away = g.awayTeam.abbreviation.toUpperCase();
        const home = g.homeTeam.abbreviation.toUpperCase();
        list = list.filter((p) => {
          const t = p.team.abbreviation.toUpperCase();
          return t === away || t === home;
        });
      }
    }

    // Filter by position
    if (bettingPosFilter !== 'ALL') {
      list = list.filter((p) => p.position === bettingPosFilter);
    }

    // Filter by search query
    if (query) {
      list = list.filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(query);
        const abbrMatch = p.team.abbreviation.toLowerCase().includes(query);
        const teamMatch = (p.team.displayName || '').toLowerCase().includes(query);
        const posMatch = p.position.toLowerCase().includes(query);
        const jerseyMatch = p.jersey ? p.jersey.includes(query) : false;
        const nicknameMatch =
          (query.includes('pack') && p.team.abbreviation === 'GB') ||
          (query.includes('cowboy') && p.team.abbreviation === 'DAL') ||
          (query.includes('chief') && p.team.abbreviation === 'KC') ||
          (query.includes('raven') && p.team.abbreviation === 'BAL') ||
          (query.includes('eagle') && p.team.abbreviation === 'PHI') ||
          (query.includes('bear') && p.team.abbreviation === 'CHI') ||
          (query.includes('falcon') && p.team.abbreviation === 'ATL') ||
          (query.includes('texan') && p.team.abbreviation === 'HOU') ||
          (query.includes('jag') && p.team.abbreviation === 'JAX') ||
          (query.includes('titan') && p.team.abbreviation === 'TEN') ||
          (query.includes('colt') && p.team.abbreviation === 'IND') ||
          (query.includes('jet') && p.team.abbreviation === 'NYJ') ||
          (query.includes('patriot') && p.team.abbreviation === 'NE') ||
          (query.includes('saint') && p.team.abbreviation === 'NO') ||
          (query.includes('giant') && p.team.abbreviation === 'NYG') ||
          (query.includes('panther') && p.team.abbreviation === 'CAR') ||
          (query.includes('steeler') && p.team.abbreviation === 'PIT') ||
          (query.includes('bucs') && p.team.abbreviation === 'TB') ||
          (query.includes('buccaneer') && p.team.abbreviation === 'TB') ||
          (query.includes('cardinal') && p.team.abbreviation === 'ARI') ||
          (query.includes('ram') && p.team.abbreviation === 'LAR') ||
          (query.includes('charger') && p.team.abbreviation === 'LAC') ||
          (query.includes('bill') && p.team.abbreviation === 'BUF') ||
          (query.includes('raider') && p.team.abbreviation === 'LV') ||
          (query.includes('seahawk') && p.team.abbreviation === 'SEA') ||
          (query.includes('bronco') && p.team.abbreviation === 'DEN') ||
          (query.includes('49er') && p.team.abbreviation === 'SF') ||
          (query.includes('commander') && p.team.abbreviation === 'WSH');
        return nameMatch || abbrMatch || teamMatch || posMatch || jerseyMatch || nicknameMatch;
      });
    }

    return list.slice(0, 100);
  }, [allActivePlayers, data?.games, bettingSearch, bettingGameFilter, bettingPosFilter]);

  // Sort leaderboards by active scoring format and filter by game state
  const sortedLeaderboards = useMemo(() => {
    if (!data?.leaderboards) return null;
    const result: Record<FantasyPosition, FantasyPlayer[]> = {
      QB: [],
      RB: [],
      WR: [],
      TE: [],
      DEF: [],
      K: [],
    };

    for (const pos of ['QB', 'RB', 'WR', 'TE', 'DEF', 'K'] as FantasyPosition[]) {
      let list = [...(data.leaderboards[pos] || [])];
      if (gameFilterMode === 'live') {
        list = list.filter((p) => p.isGameLive === true || p.isLive === true);
      }
      list.sort((a, b) => {
        const ptsB = b.points[scoringFormat] ?? 0;
        const ptsA = a.points[scoringFormat] ?? 0;
        if (ptsB !== ptsA) return ptsB - ptsA;
        return a.name.localeCompare(b.name);
      });
      result[pos] = list.slice(0, 10); // Strictly Top 10 for TV View
    }
    return result;
  }, [data, scoringFormat, gameFilterMode]);

  // Filter Live Updates feed by game state
  const filteredLiveUpdates = useMemo(() => {
    if (!data?.liveUpdates) return [];
    if (gameFilterMode === 'live') {
      return data.liveUpdates.filter((u) => u.isGameLive === true);
    }
    return data.liveUpdates;
  }, [data?.liveUpdates, gameFilterMode]);

  // Living Room Friends Leaderboard (Tab 8)
  const roomFriendsLeaderboard = useMemo(() => {
    const list: RoomFriendLeaderboard[] = [];

    // Map each guest friend
    for (const guest of guestTags) {
      const rostered: RoomFriendLeaderboard['rosteredPlayers'] = [];
      let totalPts = 0;

      for (const gp of guest.players) {
        // Find player in live data
        const matched = allActivePlayers.find(
          (p) =>
            normalize(p.name) === normalize(gp.name) ||
            (gp.id && normalize(p.id) === normalize(gp.id)) ||
            (gp.position === 'DEF' &&
              normalize(p.team.abbreviation) === normalize(gp.team || gp.name))
        );

        if (matched) {
          const pts = matched.points[scoringFormat] || 0;
          totalPts += pts;
          rostered.push({
            name: matched.name,
            points: pts,
            team: matched.team.abbreviation,
            position: matched.position,
          });
        } else {
          rostered.push({
            name: gp.name,
            points: 0,
            team: gp.team || 'NFL',
            position: gp.position || 'FLEX',
          });
        }
      }

      // Sort rostered players by points descending
      rostered.sort((a, b) => b.points - a.points);

      list.push({
        name: guest.guestName,
        teamName: guest.teamName,
        totalPoints: Math.round(totalPts * 10) / 10,
        leaguesCount: 1,
        leagues: ['Living Room'],
        rosteredPlayers: rostered,
      });
    }

    // Sort by totalPoints descending
    list.sort((a, b) => b.totalPoints - a.totalPoints);
    return list;
  }, [guestTags, allActivePlayers, scoringFormat]);

  // All Matchups across all connected leagues
  const allConnectedMatchups = useMemo(() => {
    const list: ParsedLeagueMatchup[] = [];

    for (const [leagueId, leagueData] of Object.entries(syncedLeagueData)) {
      const config = syncedLeagues.find((l) => l.leagueId === leagueId);
      const leagueName = config?.name || leagueData?.name || 'League';
      const leagueType = config?.type || 'sleeper';

      for (const m of leagueData?.matchups || []) {
        if (m && m.team1 && m.team2) {
          list.push({
            id: `${leagueId}-${m.id}`,
            leagueName,
            leagueType,
            team1: m.team1,
            team2: m.team2,
          });
        }
      }
    }

    return list;
  }, [syncedLeagueData, syncedLeagues]);

  // Unified marquee ticker matchups: connected leagues or synthesized living room matchups
  const displayMatchups = useMemo(() => {
    if (allConnectedMatchups.length > 0) {
      return allConnectedMatchups;
    }
    // If no external leagues, synthesize living room matchups from guest friends
    if (guestTags.length >= 2) {
      const list: ParsedLeagueMatchup[] = [];
      for (let i = 0; i < guestTags.length; i += 2) {
        const g1 = guestTags[i];
        const g2 = guestTags[i + 1] || guestTags[0];
        const friend1 = roomFriendsLeaderboard.find((f) => f.name === g1.guestName);
        const friend2 = roomFriendsLeaderboard.find((f) => f.name === g2.guestName);
        list.push({
          id: `guest-${g1.id}-${g2.id}`,
          leagueName: 'Living Room',
          leagueType: 'guest',
          team1: {
            teamId: g1.id,
            teamName: g1.teamName || `${g1.guestName}'s Squad`,
            ownerName: g1.guestName,
            points: friend1?.totalPoints || 0,
          },
          team2: {
            teamId: g2.id,
            teamName: g2.teamName || `${g2.guestName}'s Squad`,
            ownerName: g2.guestName,
            points: friend2?.totalPoints || 0,
          },
        });
      }
      return list;
    }
    return [];
  }, [allConnectedMatchups, guestTags, roomFriendsLeaderboard]);

  // Format Helper for Point Badges
  const formatPoints = (pts: number) => {
    return Number.isInteger(pts) ? pts.toFixed(1) : pts.toFixed(1);
  };

  // Split NFL games: Pin ALL active in-progress games on the Left + Scroll FINAL & PRE games on the Right
  const { pinnedLiveGames, scrollingGames, hasActiveRedZone } = useMemo(() => {
    const allGames = data?.games || [];
    const live: LiveGame[] = [];
    const nonLive: LiveGame[] = [];
    let rzFound = false;

    for (const g of allGames) {
      const isLive = g.status.state === 'in';
      if (isLive) {
        const isRz = Boolean(g.isRedZone || g.situation?.isRedZone);
        if (isRz) rzFound = true;
        live.push(g);
      } else {
        nonLive.push(g);
      }
    }

    // Sort live games so any in the RedZone appear first
    live.sort((a, b) => {
      const aRz = Boolean(a.isRedZone || a.situation?.isRedZone);
      const bRz = Boolean(b.isRedZone || b.situation?.isRedZone);
      if (aRz && !bRz) return -1;
      if (!aRz && bRz) return 1;
      return 0;
    });

    return { pinnedLiveGames: live, scrollingGames: nonLive, hasActiveRedZone: rzFound };
  }, [data?.games]);

  // Clean seamless 2x track of scrolling games
  const scrollingGamesList = useMemo(() => {
    return scrollingGames;
  }, [scrollingGames]);

  // Bottom Ticker: Clean 2x track of matchups for locked 60fps GPU scrolling
  const tickerMatchups = useMemo(() => {
    return displayMatchups;
  }, [displayMatchups]);

  // Helper to render individual scoreboard game card (used for both pinned RedZone & continuous scrolling)
  const renderScoreboardGameCard = useCallback((game: LiveGame, isRedZonePinned?: boolean) => {
    const isLive = game.status?.state === 'in' || (game as unknown as { status: string }).status === 'in' || Boolean((game as unknown as { isLive: boolean }).isLive);
    const isRedZone = isLive && Boolean(game.isRedZone || game.situation?.isRedZone);
    const isPost = game.status?.state === 'post';
    const possessionAbbr = game.possessionTeamAbbr || game.situation?.possessionTeamAbbr;
    const hasPossessionAway = isLive && possessionAbbr === game.awayTeam.abbreviation;
    const hasPossessionHome = isLive && possessionAbbr === game.homeTeam.abbreviation;

    const possText = game.possessionText || game.situation?.possessionText;
    let downDistanceDisplay = game.situation?.downDistanceText || null;
    if (downDistanceDisplay && possText && !downDistanceDisplay.includes(possText)) {
      downDistanceDisplay = `${downDistanceDisplay} • ${possText}`;
    } else if (!downDistanceDisplay && possText) {
      downDistanceDisplay = `Ball at ${possText}`;
    }

    // Calculate miniature field position percentage towards the end zone
    let fieldProgressPct = 50;
    if (isLive) {
      if (possText) {
        const clean = possText.trim();
        if (clean === '50') {
          fieldProgressPct = 50;
        } else {
          const parts = clean.split(' ');
          if (parts.length === 2) {
            const team = parts[0].toUpperCase();
            const yds = parseInt(parts[1]) || 50;
            if (team === possessionAbbr?.toUpperCase()) {
              // Own territory, e.g. "KC 25" -> 25% towards endzone
              fieldProgressPct = Math.max(5, Math.min(50, yds));
            } else {
              // Opponent territory, e.g. "LAR 8" -> 92% towards endzone
              fieldProgressPct = Math.max(50, Math.min(99, 100 - yds));
            }
          }
        }
      } else if (game.situation?.yardLine) {
        const yl = game.situation.yardLine;
        fieldProgressPct = isRedZone ? Math.max(80, 100 - yl) : yl;
      } else if (isRedZone) {
        fieldProgressPct = 85;
      }
    }

    return (
      <div
        className={`relative flex items-center gap-2 px-2 py-1 rounded-xl bg-slate-900/90 border transition-all shrink-0 min-w-[200px] ${
          isRedZone
            ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.7)] animate-redzone bg-gradient-to-r from-red-950/40 to-slate-900'
            : isLive
            ? 'border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.35)] bg-gradient-to-r from-emerald-950/30 via-slate-900 to-amber-950/20'
            : 'border-slate-800/80'
        }`}
      >
        {/* Red Zone Badge Alert on card */}
        {isRedZone && !isRedZonePinned && (
          <div className="absolute -top-2 right-1.5 px-1 py-0.2 bg-red-600 text-white text-[8px] font-black tracking-widest uppercase rounded shadow animate-pulse">
            RED ZONE
          </div>
        )}

        {/* Sleek Miniature Field-Position Progress Bar at Bottom of In-Progress Card */}
        {isLive && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-950/90 overflow-hidden rounded-b-xl">
            <div
              className={`h-full transition-all duration-300 ${
                isRedZone
                  ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]'
                  : 'bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
              }`}
              style={{ width: `${fieldProgressPct}%` }}
              title={`Drive Progress: ${fieldProgressPct}% to End Zone`}
            />
          </div>
        )}

        {/* Away Team */}
        <div
          className={`flex flex-col items-center gap-0.5 w-11 py-0.5 px-1 rounded-lg transition-all ${
            hasPossessionAway
              ? 'bg-amber-500/20 border border-amber-400/60 shadow-[0_0_10px_rgba(245,158,11,0.35)]'
              : ''
          }`}
        >
          <div className="relative">
            <img
              src={game.awayTeam.logo}
              alt={game.awayTeam.abbreviation}
              className="w-5 h-5 object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div className="flex items-center gap-0.5">
            <span
              className={`text-[10px] font-bold ${
                hasPossessionAway ? 'text-amber-300 font-black' : 'text-slate-300'
              }`}
            >
              {game.awayTeam.abbreviation}
            </span>
            {hasPossessionAway && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
            )}
          </div>
          <span className="text-sm font-black tv-tabular text-white leading-none">
            {game.awayTeam.score}
          </span>
        </div>

        {/* Game Clock & Situation Middle */}
        <div className="flex flex-col items-center justify-center text-center px-1 border-x border-slate-800/60 min-w-[76px]">
          {isLive ? (
            <>
              <div className="flex items-center gap-1 text-[10px] font-black text-amber-400 uppercase tracking-tight">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>{game.status.shortDetail || 'LIVE'}</span>
              </div>
              {downDistanceDisplay && (
                <span className="text-[9px] text-amber-300 font-extrabold leading-tight mt-0.5 px-1 py-0.2 rounded bg-slate-950/90 border border-slate-800 whitespace-nowrap shadow-sm">
                  {downDistanceDisplay}
                </span>
              )}
            </>
          ) : isPost ? (
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
              FINAL
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-slate-400">
              {game.status.shortDetail || 'UPCOMING'}
            </span>
          )}
        </div>

        {/* Home Team */}
        <div
          className={`flex flex-col items-center gap-0.5 w-11 py-0.5 px-1 rounded-lg transition-all ${
            hasPossessionHome
              ? 'bg-amber-500/20 border border-amber-400/60 shadow-[0_0_10px_rgba(245,158,11,0.35)]'
              : ''
          }`}
        >
          <div className="relative">
            <img
              src={game.homeTeam.logo}
              alt={game.homeTeam.abbreviation}
              className="w-5 h-5 object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div className="flex items-center gap-0.5">
            <span
              className={`text-[10px] font-bold ${
                hasPossessionHome ? 'text-amber-300 font-black' : 'text-slate-300'
              }`}
            >
              {game.homeTeam.abbreviation}
            </span>
            {hasPossessionHome && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
            )}
          </div>
          <span className="text-sm font-black tv-tabular text-white leading-none">
            {game.homeTeam.score}
          </span>
        </div>
      </div>
    );
  }, []);

  return (
    <div className="flex flex-col h-screen max-h-screen w-screen bg-[#07080C] text-slate-100 select-none overflow-hidden font-condensed justify-between pb-14">
      {/* 1. AUTO-CYCLE PROGRESS BAR (Visual bar at the top of the TV) */}
      <div className="w-full h-1 bg-[#0E1017] relative overflow-hidden shrink-0">
        {autoCycle && (
          <div
            className="h-full bg-gradient-to-r from-[#00E676] via-cyan-400 to-amber-400 transition-all duration-200 ease-linear shadow-[0_0_10px_rgba(0,230,118,0.8)]"
            style={{ width: `${cycleProgress}%` }}
          />
        )}
      </div>

      {/* 2. UNIFIED 48PX BROADCAST HEADER BAR */}
      <header className="h-12 bg-[#0B0D13] border-b border-white/10 px-4 flex items-center justify-between shrink-0 gap-3">
        {/* Left Controls: LIVE REDZONE bug + segmented LIVE / ALL + PPR / HALF / STD */}
        <div className="flex items-center gap-2.5">
          {/* LIVE REDZONE bug */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-950/80 border border-red-500/50 rounded-[4px] text-red-400 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-[11px] font-condensed font-black tracking-wider uppercase text-red-200">
              LIVE REDZONE
            </span>
          </div>

          {/* Segmented LIVE / ALL */}
          <div className="flex items-center bg-[#141722] p-0.5 rounded-[4px] border border-white/10">
            <button
              onClick={() => handleSelectFilterMode('live')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-xs font-condensed font-bold uppercase transition-all ${
                gameFilterMode === 'live'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  gameFilterMode === 'live' ? 'bg-white' : 'bg-red-500'
                }`}
              />
              <span>LIVE</span>
              {liveGamesCount > 0 && (
                <span className="text-[10px] font-mono-score px-1 py-0.2 bg-black/40 rounded-[2px]">
                  {liveGamesCount}
                </span>
              )}
            </button>
            <button
              onClick={() => handleSelectFilterMode('all')}
              className={`px-2.5 py-1 rounded-[2px] text-xs font-condensed font-bold uppercase transition-all ${
                gameFilterMode === 'all'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ALL
            </button>
          </div>

          {/* Segmented PPR / HALF / STD */}
          <div className="flex items-center bg-[#141722] p-0.5 rounded-[4px] border border-white/10">
            {(['ppr', 'halfPpr', 'standard'] as ScoringFormat[]).map((fmt) => {
              const label = fmt === 'ppr' ? 'PPR' : fmt === 'halfPpr' ? 'HALF' : 'STD';
              const active = scoringFormat === fmt;
              return (
                <button
                  key={fmt}
                  onClick={() => setScoringFormat(fmt)}
                  className={`px-2.5 py-1 rounded-[2px] text-xs font-condensed font-bold uppercase transition-all ${
                    active
                      ? 'bg-[#00E676] text-black shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Controls: LEAGUES, ROOM QR, AUDIO, CYCLE, and <SyncCountdown /> */}
        <div className="flex items-center gap-2">
          {/* LEAGUES Button */}
          <button
            onClick={() => setIsManageModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#141722] hover:bg-[#1E2330] text-xs font-condensed font-bold uppercase text-amber-300 border border-white/10 transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-amber-400" />
            <span>LEAGUES</span>
            {(syncedLeagues.length > 0 || guestTags.length > 0) && (
              <span className="px-1.5 py-0.2 rounded-[2px] bg-amber-500/20 text-amber-300 text-[10px] font-mono-score font-bold">
                {syncedLeagues.length + guestTags.length}
              </span>
            )}
          </button>

          {/* ROOM QR Button */}
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#141722] hover:bg-[#1E2330] text-xs font-condensed font-bold uppercase text-cyan-400 border border-white/10 transition-colors"
            title="Scan QR Code with phone to join and add bets"
          >
            <QrCode className="w-3.5 h-3.5 text-cyan-400" />
            <span>ROOM QR</span>
          </button>

          {/* Sound Toggle Button */}
          <button
            onClick={handleToggleSound}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-condensed font-bold uppercase transition-colors border ${
              isSoundEnabled
                ? 'bg-[#00E676]/15 border-[#00E676]/40 text-[#00E676]'
                : 'bg-[#141722] border-white/10 text-slate-400 hover:text-slate-200'
            }`}
            title={isSoundEnabled ? 'Sound is ON' : 'Sound is MUTED'}
          >
            {isSoundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-[#00E676]" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>{isSoundEnabled ? 'AUDIO: ON' : 'MUTE'}</span>
          </button>

          {/* TV Auto-Cycle Toggle */}
          <button
            onClick={() => setAutoCycle(!autoCycle)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-condensed font-bold uppercase transition-colors border ${
              autoCycle
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-[#141722] border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tv className={`w-3.5 h-3.5 ${autoCycle ? 'text-cyan-400' : 'text-slate-500'}`} />
            <span>CYCLE: {autoCycle ? 'ON' : 'PAUSED'}</span>
          </button>

          {/* Center/Right Sync Countdown */}
          <SyncCountdown onSync={handleSync} />
        </div>
      </header>

      {/* 3. HORIZONTAL LIVE NFL SCOREBOARD STRIP (Pinned RedZone on Left + Slow Scrolling on Right) */}
      <section
        ref={scoreboardRef}
        className="w-full bg-[#0E1017] border-b border-white/10 px-2 py-1 overflow-hidden flex items-center shrink-0 relative"
      >
        <style>{`
          @keyframes scoreboardScroll {
            0% { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-50%, 0, 0); }
          }
        `}</style>

        {loading && !data ? (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-0.5 px-3">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00E676]" />
            <span>Loading scoreboard...</span>
          </div>
        ) : (
          <div className="flex items-center w-full overflow-hidden">
            {/* Left Section — Pinned In-Progress Live Games */}
            {pinnedLiveGames.length > 0 && (
              <div className="flex-shrink-0 z-20 flex items-center gap-2 pr-3 pl-1 border-r border-white/10 bg-[#0E1017] shadow-[10px_0_20px_rgba(0,0,0,0.8)]">
                <div
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-white text-[10px] font-condensed font-bold uppercase tracking-wider whitespace-nowrap shadow-sm ${
                    hasActiveRedZone
                      ? 'bg-red-600 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.8)]'
                      : 'bg-emerald-600 border border-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                  }`}
                >
                  <Activity className="w-3 h-3 text-white shrink-0" />
                  <span>{hasActiveRedZone ? 'RED ZONE' : 'LIVE NOW'}</span>
                  <span className="px-1.5 py-0.2 rounded-[2px] bg-black/40 text-[9px] font-mono-score font-bold">
                    {pinnedLiveGames.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {pinnedLiveGames.map((game, idx) => (
                    <div key={`live-pinned-${game.id}-${idx}`}>
                      {renderScoreboardGameCard(game, true)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Right Section — Slow Continuous Scrolling Game Ticker (FINAL & PRE Games) */}
            <div className="overflow-hidden flex-1 relative flex items-center">
              {scrollingGames.length === 0 ? (
                <div className="px-4 text-xs font-semibold text-slate-500 italic">
                  All NFL games currently LIVE!
                </div>
              ) : (
                <div
                  className="scoreboard-ticker-track flex items-center gap-3 px-3"
                  style={{
                    display: 'flex',
                    width: 'max-content',
                    animation: 'scoreboardScroll 95s linear infinite',
                    willChange: 'transform',
                    transform: 'translate3d(0, 0, 0)',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                  }}
                >
                  {/* Set 1 of Scrolling Games */}
                  {scrollingGamesList.map((game, idx) => (
                    <div key={`sg1-${game.id}-${idx}`}>
                      {renderScoreboardGameCard(game, false)}
                    </div>
                  ))}

                  {/* Set 2 of Scrolling Games for Seamless Infinite Loop */}
                  {scrollingGamesList.map((game, idx) => (
                    <div key={`sg2-${game.id}-${idx}`}>
                      {renderScoreboardGameCard(game, false)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 4. EDGE-TO-EDGE BROADCAST NAVIGATION TABS */}
      <nav className="h-10 bg-[#0B0D13] border-b border-white/10 px-2 flex items-center shrink-0 w-full justify-between">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setAutoCycle(false);
              }}
              className={`flex-1 h-full flex items-center justify-center font-condensed text-xs md:text-sm tracking-wider uppercase transition-colors relative font-bold ${
                active
                  ? 'text-[#00E676] border-b-2 border-[#00E676] bg-white/[0.03]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.id === 'room' && (guestTags.length > 0 || syncedLeagues.length > 0) && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-amber-400/20 text-amber-300 rounded-[2px] text-[10px] font-mono-score font-bold">
                  {guestTags.length + syncedLeagues.length}
                </span>
              )}
              {tab.id === 'bets' && savedBets.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-[#00E676]/20 text-[#00E676] rounded-[2px] text-[10px] font-mono-score font-bold">
                  {savedBets.length}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 5. MAIN CONTENT AREA (Fills 100% of the Available Viewport Without Scrolling) */}
      <main className={`flex-1 overflow-hidden flex flex-col min-h-0 ${activeTab === 'live' ? 'px-4 py-2' : 'p-3 md:p-4'}`}>
        {loading && !data ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-base font-bold text-slate-400">Loading Real-Time NFL Fantasy Command Center...</p>
          </div>
        ) : error && !data ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-red-400">
            <p className="text-lg font-bold">Failed to load live data</p>
            <p className="text-sm text-slate-400">{error}</p>
          </div>
        ) : activeTab === 'live' ? (
          /* TAB 1: 12-COLUMN BROADCAST GRID (8-COL STUDS + 4-COL VERTICAL PLAY FEED) */
          <div className="grid grid-cols-12 gap-3 h-full overflow-hidden min-h-0">
            {/* LEFT 8 COLUMNS: #1 OVERALL STUDS RIGHT NOW (2x3 Grid) */}
            <div className="col-span-12 lg:col-span-8 flex flex-col h-full bg-[#0E1017] rounded-[4px] border border-white/10 p-3 overflow-hidden shadow-xl min-h-0">
              <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <h2 className="text-xs md:text-sm font-condensed font-bold tracking-wide uppercase text-white">
                    {gameFilterMode === 'live' ? '#1 OVERALL STUDS RIGHT NOW' : '#1 OVERALL STUDS (ALL GAMES)'}
                  </h2>
                  <span
                    className={`text-[9px] font-condensed font-bold uppercase px-1.5 py-0.2 rounded-[2px] ${
                      gameFilterMode === 'live'
                        ? 'bg-red-950/80 text-red-300 border border-red-500/40'
                        : 'bg-white/10 text-slate-300 border border-white/15'
                    }`}
                  >
                    {gameFilterMode === 'live' ? 'LIVE IN-PROGRESS' : 'ALL GAMES'}
                  </span>
                </div>

                <span className="text-[11px] font-condensed font-bold text-[#00E676] uppercase tracking-wider">
                  {scoringFormat.toUpperCase()} LEADERS
                </span>
              </div>

              {/* 2 Columns x 3 Rows Grid */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 overflow-y-auto pr-1 min-h-0">
                {[
                  { pos: 'QB' as FantasyPosition, label: 'TOP QB' },
                  { pos: 'RB' as FantasyPosition, label: 'TOP RB' },
                  { pos: 'WR' as FantasyPosition, label: 'TOP WR' },
                  { pos: 'TE' as FantasyPosition, label: 'TOP TE' },
                  { pos: 'DEF' as FantasyPosition, label: 'TOP DEF' },
                  { pos: 'K' as FantasyPosition, label: 'TOP K' },
                ].map(({ pos, label }) => {
                  const player = sortedLeaderboards?.[pos]?.[0];

                  if (!player) {
                    return (
                      <div
                        key={pos}
                        className="p-2.5 md:p-3 rounded-[4px] border border-white/10 bg-[#141722] flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-condensed font-bold tracking-wider uppercase px-2 py-0.5 rounded-[2px] bg-[#0E1017] text-slate-400 border border-white/10">
                            {label}
                          </span>
                        </div>
                        <div className="text-center py-2">
                          <span className="text-xs font-condensed font-bold text-slate-500 block uppercase">
                            {gameFilterMode === 'live' ? 'Awaiting Live Game Play' : 'No Data Available'}
                          </span>
                        </div>
                        <div className="text-right border-t border-white/10 pt-1.5">
                          <span className="text-sm font-mono-score font-bold text-slate-600">0.0 PTS</span>
                        </div>
                      </div>
                    );
                  }

                  const pts = player.points[scoringFormat] ?? 0;
                  const isBoosted = boostedPlayers[player.id];
                  const owners = getOwnershipTags(player);

                  // Split raw stat line by • or , into individual crisp pills
                  const statPills = player.rawStatLine
                    ? player.rawStatLine
                        .split(/[•,]/)
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0)
                    : [];

                  return (
                    <div
                      key={player.id}
                      className={`relative p-2.5 md:p-3 rounded-[4px] border flex flex-col justify-between transition-all ${
                        isBoosted
                          ? 'border-[#00E676] shadow-[0_0_20px_rgba(0,230,118,0.8)] bg-[#00E676]/10 scale-[1.01]'
                          : 'bg-[#141722] border-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Top Row: Position badge, larger headshot, Name, Clock, Matchup, and massive glowing Points */}
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Larger Player Headshot */}
                          <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-[4px] overflow-hidden bg-[#07080C] border border-white/10 shadow-md shrink-0">
                            <img
                              src={player.headshot}
                              alt={player.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = player.team.logo;
                              }}
                            />
                          </div>

                          <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
                            {/* Meta badges: Position Badge + Matchup + Clock + Owner */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-condensed font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-[2px] bg-[#0E1017] text-amber-300 border border-amber-500/40 shrink-0">
                                {label}
                              </span>
                              <span className="text-xs font-condensed font-bold text-slate-300 shrink-0">
                                {player.team.abbreviation} vs {player.opponent.abbreviation}
                              </span>
                              <span className={`text-[11px] font-condensed font-bold shrink-0 ${player.isGameLive ? 'text-amber-400 flex items-center gap-1' : 'text-slate-400'}`}>
                                {player.isGameLive && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-[#00E676] animate-ping inline-block" />
                                )}
                                {player.gameStatus.clock ? `${player.gameStatus.clock}${player.gameStatus.period ? ` - ${player.gameStatus.period === 1 ? '1st' : player.gameStatus.period === 2 ? '2nd' : player.gameStatus.period === 3 ? '3rd' : player.gameStatus.period === 4 ? '4th' : `OT`}` : ''}` : player.gameStatus.detail || (player.isGameLive ? 'Live' : 'Final')}
                              </span>
                              {owners.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded-[2px] bg-amber-500/15 text-amber-300 text-[9px] font-condensed font-bold uppercase border border-amber-500/30 flex items-center gap-1 shrink-0">
                                  <Users className="w-2.5 h-2.5 text-amber-400" />
                                  <span>{owners[0].ownerName}</span>
                                </span>
                              )}
                            </div>

                            {/* Player Name */}
                            <h3 className="text-sm md:text-base font-condensed font-bold text-white truncate leading-tight uppercase">
                              {player.name}
                            </h3>
                          </div>
                        </div>

                        {/* Right: Massive Glowing Fantasy Points Readout */}
                        <div className="flex flex-col items-end shrink-0 pl-2">
                          <span className="text-3xl md:text-4xl font-mono-score font-bold text-[#00E676] leading-none">
                            {formatPoints(pts)}
                          </span>
                          <span className="text-[9px] font-condensed font-bold uppercase text-slate-400 tracking-widest mt-1">
                            {scoringFormat.toUpperCase()} PTS
                          </span>
                        </div>
                      </div>

                      {/* Bottom Stat Pills Area: Individual Crisp High-Contrast Pills (Never truncated!) */}
                      <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-white/10">
                        {statPills.length > 0 ? (
                          statPills.map((pill, pIdx) => {
                            const isTD = pill.toUpperCase().includes('TD');
                            const isTurnover = pill.toUpperCase().includes('INT') || pill.toUpperCase().includes('FUM');
                            return (
                              <span
                                key={`pill-${player.id}-${pIdx}`}
                                className={`px-2 py-0.5 rounded-[2px] text-[10px] md:text-[11px] font-mono-score font-bold tracking-wide uppercase border ${
                                  isTD
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                    : isTurnover
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : 'bg-[#0E1017] text-slate-200 border-white/10'
                                }`}
                              >
                                {pill}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[10px] font-condensed font-semibold text-slate-500 italic">
                            Stats updating live...
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT 4 COLUMNS: VERTICAL LIVE SCORING & BIG PLAYS FEED */}
            <div className="col-span-12 lg:col-span-4 flex flex-col h-full bg-[#0E1017] rounded-[4px] border border-white/10 p-3 overflow-hidden shadow-xl min-h-0">
              <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h2 className="text-xs md:text-sm font-condensed font-bold tracking-wide uppercase text-white">
                    LIVE SCORING &amp; BIG PLAYS FEED
                  </h2>
                  <span
                    className={`text-[9px] font-condensed font-bold uppercase px-1.5 py-0.2 rounded-[2px] ${
                      gameFilterMode === 'live'
                        ? 'bg-red-950/80 text-red-300 border border-red-500/40'
                        : 'bg-white/10 text-slate-300 border border-white/15'
                    }`}
                  >
                    {gameFilterMode === 'live' ? 'LIVE' : 'ALL'}
                  </span>
                </div>

                {/* Inline Fantasy Burst Alert */}
                {burstAlerts.length > 0 && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-[10px] font-mono-score font-bold animate-pulse shadow-sm">
                    <Flame className="w-3 h-3 text-emerald-400" />
                    <span>+{burstAlerts[0].delta.toFixed(1)}: {burstAlerts[0].playerName}</span>
                  </div>
                )}
              </div>

              {/* Scrollable Vertical Plays List */}
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-230px)] pr-1 pt-2">
                {filteredLiveUpdates.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 font-condensed font-semibold text-xs py-8 gap-2 text-center">
                    <span>
                      {gameFilterMode === 'live'
                        ? liveGamesCount === 0
                          ? 'No NFL games currently live. Switch to ALL GAMES to view earlier scoring plays.'
                          : 'Awaiting scoring plays or big game moments from live in-progress games...'
                        : 'Awaiting live scoring plays or big game moments...'}
                    </span>
                    {gameFilterMode === 'live' && liveGamesCount === 0 && (
                      <button
                        onClick={() => handleSelectFilterMode('all')}
                        className="px-2.5 py-1 rounded-[4px] bg-blue-600/80 hover:bg-blue-600 text-white text-[11px] font-condensed font-bold uppercase transition-colors"
                      >
                        Switch to ALL GAMES
                      </button>
                    )}
                  </div>
                ) : (
                  filteredLiveUpdates.map((upd, idx) => {
                    const isTD = upd.type === 'touchdown';
                    const isFG = upd.type === 'field-goal';
                    const isTO = upd.type === 'turnover';
                    const isSafety = upd.type === 'safety';

                    const matchingOwners = Array.from(playerOwnershipMap.entries()).filter(([key]) =>
                      upd.description.toLowerCase().includes(key)
                    );

                    return (
                      <div
                        key={`${upd.id}-${idx}`}
                        className={`h-auto p-3 rounded-[4px] border transition-all flex flex-col gap-1.5 ${
                          isTD
                            ? 'bg-emerald-950/30 border-emerald-500/40 shadow-sm'
                            : isTO
                            ? 'bg-rose-950/30 border-rose-500/40 shadow-sm'
                            : isFG
                            ? 'bg-cyan-950/30 border-cyan-500/40'
                            : isSafety
                            ? 'bg-purple-950/30 border-purple-500/40'
                            : 'bg-[#141722] border-white/10'
                        }`}
                      >
                        {/* Play Header: Type Badge • Matchup • Clock • Score */}
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[9px] font-condensed font-bold uppercase px-1.5 py-0.5 rounded-[2px] tracking-wider ${
                                isTD
                                  ? 'bg-[#00E676] text-black font-bold'
                                  : isTO
                                  ? 'bg-rose-600 text-white font-bold'
                                  : isFG
                                  ? 'bg-cyan-500 text-black font-bold'
                                  : 'bg-amber-500 text-black font-bold'
                              }`}
                            >
                              {upd.headline}
                            </span>
                            <span className="text-[11px] font-condensed font-bold text-slate-300">
                              {upd.gameName} • {upd.gameClock}
                            </span>
                            {upd.downDistanceText && (
                              <span className="text-[9px] font-condensed font-bold text-amber-300 bg-[#07080C] px-1.5 py-0.2 rounded-[2px] border border-white/10 shrink-0">
                                {upd.downDistanceText}
                              </span>
                            )}
                          </div>

                          {upd.scoreSummary && (
                            <span className="text-[11px] font-mono-score font-bold text-slate-300 shrink-0">
                              {upd.scoreSummary}
                            </span>
                          )}
                        </div>

                        {/* Full Play Description (Never clipped!) */}
                        <p className="text-xs font-semibold text-slate-100 leading-snug">
                          {upd.description}
                        </p>

                        {/* Fantasy Impact & Ownership Tagging */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {upd.fantasyImpact && (
                            <span className="text-[10px] font-mono-score font-bold text-[#00E676] bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-[2px] shadow-sm flex items-center gap-1">
                              <Zap className="w-3 h-3 text-[#00E676]" />
                              <span>{upd.fantasyImpact}</span>
                            </span>
                          )}

                          {matchingOwners.length > 0 && (
                            <span className="text-[9px] font-condensed font-bold uppercase px-2 py-0.5 rounded-[2px] bg-amber-500/15 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                              <Users className="w-3 h-3 text-amber-400" />
                              <span>{matchingOwners[0][1][0]?.ownerName.toUpperCase()}&apos;S PLAYER</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'room' ? (
          /* TAB 8: ROOM MATCHUPS & ROSTERS */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 h-full overflow-hidden">
            {/* Left 6 Columns: Living Room Friends Leaderboard */}
            <div className="lg:col-span-6 flex flex-col h-full bg-slate-900/50 rounded-2xl border border-slate-800/80 p-3 overflow-hidden backdrop-blur-sm shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-black tracking-wide uppercase text-white">
                    Living Room Leaderboard (Who is Winning Today?)
                  </h2>
                </div>
                <button
                  onClick={() => setIsManageModalOpen(true)}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 uppercase"
                >
                  + Add / Edit Friends
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 pt-2 space-y-2.5">
                {roomFriendsLeaderboard.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Users className="w-8 h-8 text-slate-600" />
                    <p className="text-xs font-semibold">No friends tagged in the living room yet.</p>
                    <button
                      onClick={() => setIsManageModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase"
                    >
                      Tag Friends in Room
                    </button>
                  </div>
                ) : (
                  roomFriendsLeaderboard.map((friend, idx) => {
                    const rank = idx + 1;
                    const isFirst = rank === 1;

                    return (
                      <div
                        key={`${friend.name}-${idx}`}
                        className={`p-3 rounded-xl border transition-all ${
                          isFirst
                            ? 'bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                            : 'bg-slate-900/90 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black border ${
                                rank === 1
                                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                                  : rank === 2
                                  ? 'bg-slate-300 text-slate-950 border-slate-200'
                                  : rank === 3
                                  ? 'bg-amber-700 text-white border-amber-600'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {rank}
                            </div>
                            <div>
                              <h3 className="text-sm font-black text-white leading-tight">
                                {friend.name}
                              </h3>
                              {friend.teamName && (
                                <p className="text-[11px] text-amber-400/90 font-bold">{friend.teamName}</p>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xl font-black text-emerald-400 tv-tabular">
                              {friend.totalPoints.toFixed(1)}
                            </div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              TOTAL {scoringFormat.toUpperCase()} PTS
                            </span>
                          </div>
                        </div>

                        {/* Rostered Players Chips */}
                        <div className="pt-1.5 border-t border-slate-800/80 flex flex-wrap gap-1">
                          {friend.rosteredPlayers.map((p, pIdx) => (
                            <span
                              key={`${p.name}-${pIdx}`}
                              className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-semibold text-slate-300 flex items-center gap-1.5"
                            >
                              <span>{p.name}</span>
                              <span className="text-[10px] font-bold text-emerald-400 tv-tabular">
                                {p.points > 0 ? `${p.points.toFixed(1)} pts` : '0 pts'}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right 6 Columns: Connected League Matchups */}
            <div className="lg:col-span-6 flex flex-col h-full bg-slate-900/50 rounded-2xl border border-slate-800/80 p-3 overflow-hidden backdrop-blur-sm shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-black tracking-wide uppercase text-white">
                    Live Head-to-Head League Matchups
                  </h2>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase">
                  {allConnectedMatchups.length} MATCHUPS
                </span>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 pt-2 space-y-2">
                {allConnectedMatchups.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Swords className="w-8 h-8 text-slate-600" />
                    <p className="text-xs font-semibold">No Sleeper or ESPN leagues connected yet.</p>
                    <button
                      onClick={() => setIsManageModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase"
                    >
                      Connect Your League
                    </button>
                  </div>
                ) : (
                  allConnectedMatchups.map((match, mIdx) => {
                    const team1Winning = match.team1.points > match.team2.points;
                    const team2Winning = match.team2.points > match.team1.points;

                    return (
                      <div
                        key={`${match.id}-${mIdx}`}
                        className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all space-y-1.5"
                      >
                        {/* League Title Badge */}
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="font-black text-cyan-400 uppercase tracking-wider">
                            {match.leagueType.toUpperCase()} • {match.leagueName}
                          </span>
                          <span className="text-[9px] font-bold text-slate-500">HEAD-TO-HEAD</span>
                        </div>

                        {/* Matchup Teams Grid */}
                        <div className="grid grid-cols-2 gap-2 items-center">
                          {/* Team 1 */}
                          <div
                            className={`p-2 rounded-lg border flex items-center justify-between ${
                              team1Winning
                                ? 'bg-emerald-950/30 border-emerald-500/50'
                                : 'bg-slate-950/60 border-slate-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1 mr-1">
                              <span className="text-[11px] font-black text-white block truncate">
                                {match.team1.teamName}
                              </span>
                              <span className="text-[9px] text-slate-400 font-semibold block truncate">
                                {match.team1.ownerName}
                              </span>
                            </div>
                            <span
                              className={`text-base font-black tv-tabular ${
                                team1Winning ? 'text-emerald-400' : 'text-slate-300'
                              }`}
                            >
                              {match.team1.points.toFixed(1)}
                            </span>
                          </div>

                          {/* Team 2 */}
                          <div
                            className={`p-2 rounded-lg border flex items-center justify-between ${
                              team2Winning
                                ? 'bg-emerald-950/30 border-emerald-500/50'
                                : 'bg-slate-950/60 border-slate-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1 mr-1">
                              <span className="text-[11px] font-black text-white block truncate">
                                {match.team2.teamName}
                              </span>
                              <span className="text-[9px] text-slate-400 font-semibold block truncate">
                                {match.team2.ownerName}
                              </span>
                            </div>
                            <span
                              className={`text-base font-black tv-tabular ${
                                team2Winning ? 'text-emerald-400' : 'text-slate-300'
                              }`}
                            >
                              {match.team2.points.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'bets' ? (
          /* TAB 9: BETS & PARLAYS TRACKER (10-FOOT TV BROADCAST UI) */
          <div className="h-full flex flex-col justify-between overflow-hidden">
            {/* Header row with Summary, View Toggle & Add Button */}
            <div className="flex items-center justify-between pb-2 shrink-0 border-b border-slate-800 gap-2 flex-wrap">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base font-black tracking-wide uppercase text-white">
                    Live Parlay &amp; Bet Tracker
                  </h2>
                </div>

                {/* Sub-View Switcher: Slips vs Live Props Market */}
                <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setBettingSubView('slips')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                      bettingSubView === 'slips'
                        ? 'bg-amber-400 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Tracked Slips ({savedBets.length})
                  </button>
                  <button
                    onClick={() => setBettingSubView('props')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                      bettingSubView === 'props'
                        ? 'bg-emerald-400 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Live Props Market ({allActivePlayers.length})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-black text-slate-300 uppercase">
                    {savedBets.length} Active {savedBets.length === 1 ? 'Slip' : 'Slips'}
                  </span>
                  {(() => {
                    const allSummaries = savedBets.map((s) => getSlipSummary(s, allActivePlayers, data?.games || []));
                    const cashedSlips = allSummaries.filter((sum) => sum.overallStatus === 'cashed').length;
                    const liveSlips = allSummaries.filter((sum) => sum.overallStatus === 'live').length;
                    return (
                      <>
                        {cashedSlips > 0 && (
                          <span className="px-2 py-0.5 rounded-[2px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-condensed font-bold uppercase flex items-center gap-1 shadow-sm">
                            <Trophy className="w-3 h-3 text-emerald-400" />
                            <span>{cashedSlips} CASHOUT</span>
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-[2px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-condensed font-bold uppercase flex items-center gap-1">
                          <Activity className="w-3 h-3 text-cyan-400" />
                          <span>{liveSlips} IN-FLIGHT</span>
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsBetsModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Manage Slips &amp; Props</span>
                </button>
              </div>
            </div>

            {/* Main Content: Slips vs Live Props Market */}
            {bettingSubView === 'props' ? (
              /* LIVE PROPS & PLAYER MARKET BOARD */
              <div className="flex-1 flex flex-col min-h-0 pt-2">
                {/* Search & Filters Bar */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 pb-2 shrink-0 border-b border-slate-800/80">
                  {/* Search Bar */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={bettingSearch}
                      onChange={(e) => setBettingSearch(e.target.value)}
                      placeholder="Search any NFL player, team, or position... e.g., Matthew Golden"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-bold"
                    />
                  </div>

                  {/* Filter Pills: Position + Game */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {/* Position Pills */}
                    <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 shrink-0">
                      {(['ALL', 'QB', 'RB', 'WR', 'TE', 'K'] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setBettingPosFilter(pos)}
                          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all ${
                            bettingPosFilter === pos
                              ? 'bg-cyan-400 text-slate-950 font-black'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>

                    {/* Game Filter Pills */}
                    {data?.games && data.games.length > 0 && (
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
                        <button
                          onClick={() => setBettingGameFilter('ALL')}
                          className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                            bettingGameFilter === 'ALL'
                              ? 'bg-amber-400 text-slate-950 font-black'
                              : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          All Games
                        </button>
                        {data.games.map((g) => {
                          const isLive = g.status?.state === 'in';
                          const active = bettingGameFilter === g.id;
                          return (
                            <button
                              key={g.id}
                              onClick={() => setBettingGameFilter(g.id)}
                              className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1 shrink-0 ${
                                active
                                  ? 'bg-amber-400 text-slate-950 font-black'
                                  : isLive
                                  ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                              }`}
                            >
                              {isLive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                              {g.awayTeam.abbreviation} @ {g.homeTeam.abbreviation}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Player Props Cards Grid */}
                <div className="flex-1 overflow-y-auto pr-1 pt-2">
                  {filteredMarketPlayers.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                      <p className="text-sm font-bold uppercase text-slate-300">No matching players found</p>
                      <button
                        onClick={() => {
                          setBettingSearch('');
                          setBettingPosFilter('ALL');
                          setBettingGameFilter('ALL');
                        }}
                        className="mt-2 text-xs font-black text-amber-400 hover:underline"
                      >
                        Reset Search &amp; Filters
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-3">
                      {filteredMarketPlayers.map((player) => {
                        const props = getPlayerPropsSummary(player);
                        const isLive = player.isGameLive || player.isLive || player.gameStatus?.state === 'in';
                        return (
                          <div
                            key={player.id}
                            className={`rounded-2xl border p-3 flex flex-col justify-between backdrop-blur-sm transition-all shadow-lg ${
                              isLive
                                ? 'bg-slate-900/90 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {/* Card Header */}
                            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={player.headshot}
                                  alt={player.name}
                                  className="w-8 h-8 rounded-full object-cover bg-slate-950 border border-slate-700 shrink-0"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).src = player.team.logo;
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-black text-white truncate">
                                      {player.name} {player.jersey ? `#${player.jersey}` : ''}
                                    </span>
                                    <span className="text-[9px] font-black text-amber-400 px-1 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 shrink-0">
                                      {player.position}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold truncate">
                                    <span>{player.team.abbreviation} vs {player.opponent.abbreviation}</span>
                                    <span>•</span>
                                    <span className={isLive ? 'text-emerald-400 font-black' : ''}>
                                      {player.gameStatus?.detail || (isLive ? 'LIVE' : 'Upcoming')}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => setIsBetsModalOpen(true)}
                                className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase transition-all shrink-0"
                              >
                                + Bet Prop
                              </button>
                            </div>

                            {/* Live In-Game Stat Line */}
                            <div className="py-2 flex items-center justify-between text-[11px] font-bold">
                              <span className="text-slate-400 uppercase text-[9px] tracking-wider">
                                Live In-Game Stats
                              </span>
                              <span className="text-white tv-tabular font-black">
                                {player.rawStatLine || '0 PTS'}
                              </span>
                            </div>

                            {/* Dynamic Prop Lines with Live Progress */}
                            <div className="space-y-2 pt-1 border-t border-slate-800/60">
                              {props.map((pr) => (
                                <div key={pr.id} className="space-y-1">
                                  <div className="flex items-center justify-between text-[10px] font-bold">
                                    <span className="text-slate-300">
                                      {pr.label} (O/U {pr.target})
                                    </span>
                                    <span className={`font-black tv-tabular ${pr.isCashed ? 'text-emerald-400' : 'text-slate-400'}`}>
                                      {pr.statusText}
                                    </span>
                                  </div>
                                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                    <div
                                      className={`h-full transition-all duration-300 ${
                                        pr.isCashed
                                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                                          : 'bg-gradient-to-r from-cyan-400 to-blue-500'
                                      }`}
                                      style={{ width: `${Math.max(4, pr.pct)}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Slips 2-Column Grid */
              <div className="flex-1 overflow-y-auto pr-1 pt-2">
                {savedBets.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 py-12">
                    <div className="p-4 rounded-full bg-slate-900 border border-slate-800">
                      <DollarSign className="w-10 h-10 text-emerald-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-black text-white uppercase">
                        No Bets or Parlays Currently Tracked
                      </p>
                      <p className="text-xs text-slate-500 max-w-sm mt-1 font-medium">
                        Add player props, game spreads, totals, and anytime touchdown scorers to watch them grade live on your second TV.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsBetsModalOpen(true)}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase shadow-lg transition-all"
                      >
                        + Add Your First Bet / Parlay
                      </button>
                      <button
                        onClick={() => setBettingSubView('props')}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-black text-xs uppercase transition-all"
                      >
                        Browse Player Props Market
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-2">
                    {savedBets.map((slip) => {
                      const summary = getSlipSummary(slip, allActivePlayers, data?.games || []);
                    return (
                      <div
                        key={slip.id}
                        className={`rounded-2xl border p-3 flex flex-col justify-between backdrop-blur-sm transition-all shadow-xl ${
                          summary.overallStatus === 'cashed'
                            ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-slate-950 border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                            : summary.overallStatus === 'chalked'
                            ? 'bg-slate-900/80 border-slate-800/80 opacity-90'
                            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Slip Card Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 shrink-0">
                              {slip.legs.length > 1 ? `${slip.legs.length}-LEG` : 'STRAIGHT'}
                            </span>
                            <h3 className="text-sm font-black text-white truncate">{slip.title}</h3>
                            {slip.ownerName && (
                              <span className="text-[10px] font-condensed font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded-[2px] border border-amber-500/40 shrink-0 flex items-center gap-1">
                                <Users className="w-2.5 h-2.5 text-amber-400" />
                                <span>{slip.ownerName}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {slip.payout && (
                              <span className="text-[11px] font-extrabold text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-500/40">
                                {slip.payout}
                              </span>
                            )}
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${summary.badgeStyle}`}>
                              {summary.badgeLabel}
                            </span>
                          </div>
                        </div>

                        {/* Legs List */}
                        <div className="space-y-2 pt-2">
                          {summary.gradedLegs.map(({ leg, result }, idx) => (
                            <div
                              key={leg.id || idx}
                              className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                                result.status === 'cashed'
                                  ? 'bg-emerald-950/30 border-emerald-500/50 shadow-sm'
                                  : result.status === 'chalked'
                                  ? 'bg-rose-950/30 border-rose-500/40'
                                  : result.status === 'covering'
                                  ? 'bg-cyan-950/30 border-cyan-500/40'
                                  : result.status === 'sweating'
                                  ? 'bg-amber-950/30 border-amber-500/40'
                                  : 'bg-slate-950/70 border-slate-800/80'
                              }`}
                            >
                              {/* Leg Top Info */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  {leg.playerHeadshot ? (
                                    <img
                                      src={leg.playerHeadshot}
                                      alt={leg.playerName || ''}
                                      className="w-6 h-6 rounded-full object-cover bg-slate-900 border border-slate-700 shrink-0"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] font-black text-amber-400 shrink-0">
                                      {leg.teamAbbr || 'NFL'}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <span className="text-xs font-black text-white block truncate leading-tight">
                                      {leg.description}
                                    </span>
                                    {result.gameStatusText && (
                                      <span className="text-[10px] font-bold text-slate-400 block truncate">
                                        {result.gameStatusText}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${result.badgeStyle}`}>
                                    {result.statusText}
                                  </span>
                                </div>
                              </div>

                              {/* Leg Live Progress Bar */}
                              <div className="mt-2 pt-1.5 border-t border-slate-800/60">
                                <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                                  <span className="text-slate-400 uppercase tracking-wider">
                                    LIVE PROGRESS
                                  </span>
                                  <span className="text-slate-200 tv-tabular font-black">
                                    {result.progressText}
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      result.status === 'cashed'
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                                        : result.status === 'chalked'
                                        ? 'bg-rose-600'
                                        : result.status === 'covering'
                                        ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                                        : result.status === 'sweating'
                                        ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                                        : 'bg-slate-700'
                                    }`}
                                    style={{ width: `${Math.max(4, result.progressPct)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
          /* TABS 2-7: TOP 10 LEADERBOARDS (2-COLUMN GRID: 1-5 ON LEFT, 6-10 ON RIGHT) */
          <div className="h-full flex flex-col justify-between overflow-hidden">
            {/* Compact Subheader with Inline Burst Alert */}
            <div className="flex items-center justify-between pb-1.5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm md:text-base font-condensed font-bold tracking-wide uppercase text-white">
                    TOP 10 {TABS.find((t) => t.id === activeTab)?.label}
                  </h2>
                  <span
                    className={`text-[9px] font-condensed font-bold uppercase px-1.5 py-0.2 rounded-[2px] ${
                      gameFilterMode === 'live'
                        ? 'bg-red-950/80 text-red-300 border border-red-500/40'
                        : 'bg-white/10 text-slate-300 border border-white/15'
                    }`}
                  >
                    {gameFilterMode === 'live' ? 'LIVE IN-PROGRESS' : 'ALL GAMES'}
                  </span>
                </div>

                {/* Inline Burst Alert next to title to save vertical space */}
                {burstAlerts.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-[2px] bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-[10px] font-mono-score font-bold animate-pulse shadow-sm">
                    <Flame className="w-3 h-3 text-emerald-400" />
                    <span>BURST: {burstAlerts[0].playerName} +{burstAlerts[0].delta.toFixed(1)} PTS</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] font-condensed font-bold text-slate-400">
                <span>SCORING:</span>
                <span className="text-[#00E676] font-bold uppercase">
                  {scoringFormat.toUpperCase()}
                </span>
              </div>
            </div>

            {/* If 0 players found (e.g. in Live mode when no players are active in that position) */}
            {sortedLeaderboards?.[activeTab as FantasyPosition]?.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
                <div className="p-3 rounded-[4px] bg-[#0E1017] border border-white/10">
                  <Radio className="w-8 h-8 text-amber-400 animate-pulse" />
                </div>
                <div className="text-center font-condensed">
                  <p className="text-base font-bold text-white uppercase">
                    No {TABS.find((t) => t.id === activeTab)?.label}s Active In Live Games Right Now
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {liveGamesCount === 0
                      ? 'Zero NFL games are currently in progress.'
                      : 'Active in-progress games do not have stats for this position yet.'}
                  </p>
                </div>
                <button
                  onClick={() => handleSelectFilterMode('all')}
                  className="px-3 py-1.5 rounded-[4px] bg-blue-600 hover:bg-blue-500 text-white font-condensed font-bold text-xs uppercase shadow-md transition-colors"
                >
                  Switch to ALL GAMES
                </button>
              </div>
            ) : (
              /* 2-Column Grid: Ranks 1-5 (Left) and Ranks 6-10 (Right) - Exactly 5 items per column fitting 100% */
              <div className="flex-1 grid grid-cols-2 gap-3 h-full overflow-hidden min-h-0">
                {/* Left Column: Ranks 1 to 5 */}
                <div className="flex flex-col gap-1.5 h-full justify-between overflow-hidden min-h-0">
                  {sortedLeaderboards?.[activeTab as FantasyPosition]
                    ?.slice(0, 5)
                    .map((player, idx) => {
                      const rank = idx + 1;
                      const owners = getOwnershipTags(player);
                      return renderLeaderboardCard(
                        player,
                        rank,
                        scoringFormat,
                        boostedPlayers[player.id],
                        owners
                      );
                    })}
                </div>

                {/* Right Column: Ranks 6 to 10 */}
                <div className="flex flex-col gap-1.5 h-full justify-between overflow-hidden min-h-0">
                  {sortedLeaderboards?.[activeTab as FantasyPosition]
                    ?.slice(5, 10)
                    .map((player, idx) => {
                      const rank = idx + 6;
                      const owners = getOwnershipTags(player);
                      return renderLeaderboardCard(
                        player,
                        rank,
                        scoringFormat,
                        boostedPlayers[player.id],
                        owners
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 6. CONTINUOUS NEWS-NETWORK SCROLLING MARQUEE TICKER (ESPN BottomLine Style) */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 h-14 bg-[#0B0D13] border-t-2 border-[#00E676]/40 overflow-hidden flex items-center shadow-2xl">
        <style>{`
          @keyframes tickerScroll {
            0% { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-50%, 0, 0); }
          }
        `}</style>

        {/* Fixed Left Label Badge (Anchored) */}
        <div className="h-full px-3 md:px-4 bg-[#07080C] border-r border-white/10 flex items-center gap-2 z-20 shrink-0 shadow-lg">
          <span className="text-[#00E676] font-condensed font-bold tracking-wider text-xs md:text-sm flex items-center gap-1.5 whitespace-nowrap uppercase">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>LIVE LEAGUE SCORES</span>
          </span>
          {displayMatchups.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-[2px] bg-[#00E676]/20 text-[#00E676] text-[10px] font-mono-score font-bold">
              {displayMatchups.length}
            </span>
          )}
        </div>

        {/* Seamless Infinite Marquee Track - Relaxed 110s Pace for Effortless 10-Foot Reading */}
        <div className="flex-1 overflow-hidden relative h-full flex items-center">
          {displayMatchups.length === 0 ? (
            <div className="px-4 text-xs font-condensed font-semibold text-slate-400 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[#00E676] animate-pulse" />
              <span>Tip: Click &quot;LEAGUES&quot; in the top bar to link your Sleeper/ESPN leagues or living room friends.</span>
            </div>
          ) : (
            <div
              className="league-ticker-track flex items-center gap-6"
              style={{
                display: 'flex',
                width: 'max-content',
                animation: 'tickerScroll 110s linear infinite',
                willChange: 'transform',
                transform: 'translate3d(0, 0, 0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              {/* Set 1 of Matchups */}
              {tickerMatchups.map((m, idx) => (
                <div
                  key={`m1-${m.id || idx}-${idx}`}
                  className="flex items-center gap-3 px-3 py-1.5 rounded-[4px] bg-[#0E1017] border border-white/10 shrink-0 whitespace-nowrap shadow-sm hover:border-white/20 transition-colors"
                >
                  <span className="text-[10px] font-condensed font-bold uppercase text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded-[2px] border border-cyan-500/30">
                    {m.leagueName}
                  </span>
                  <div className="flex items-center gap-2 text-xs font-condensed font-bold">
                    <span className={m.team1.points > m.team2.points ? 'text-[#00E676] font-bold' : 'text-slate-200'}>
                      {m.team1.ownerName}
                    </span>
                    <span className="text-sm font-mono-score font-bold text-white px-1.5 py-0.2 rounded-[2px] bg-[#07080C] border border-white/10">
                      {m.team1.points.toFixed(1)}
                    </span>
                    <span className="text-slate-500 text-[10px] font-bold">VS</span>
                    <span className="text-sm font-mono-score font-bold text-white px-1.5 py-0.2 rounded-[2px] bg-[#07080C] border border-white/10">
                      {m.team2.points.toFixed(1)}
                    </span>
                    <span className={m.team2.points > m.team1.points ? 'text-[#00E676] font-bold' : 'text-slate-200'}>
                      {m.team2.ownerName}
                    </span>
                  </div>
                </div>
              ))}

              {/* Set 2 of Matchups for Seamless Infinite Loop */}
              {tickerMatchups.map((m, idx) => (
                <div
                  key={`m2-${m.id || idx}-${idx}`}
                  className="flex items-center gap-3 px-3 py-1.5 rounded-[4px] bg-[#0E1017] border border-white/10 shrink-0 whitespace-nowrap shadow-sm hover:border-white/20 transition-colors"
                >
                  <span className="text-[10px] font-condensed font-bold uppercase text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded-[2px] border border-cyan-500/30">
                    {m.leagueName}
                  </span>
                  <div className="flex items-center gap-2 text-xs font-condensed font-bold">
                    <span className={m.team1.points > m.team2.points ? 'text-[#00E676] font-bold' : 'text-slate-200'}>
                      {m.team1.ownerName}
                    </span>
                    <span className="text-sm font-mono-score font-bold text-white px-1.5 py-0.2 rounded-[2px] bg-[#07080C] border border-white/10">
                      {m.team1.points.toFixed(1)}
                    </span>
                    <span className="text-slate-500 text-[10px] font-bold">VS</span>
                    <span className="text-sm font-mono-score font-bold text-white px-1.5 py-0.2 rounded-[2px] bg-[#07080C] border border-white/10">
                      {m.team2.points.toFixed(1)}
                    </span>
                    <span className={m.team2.points > m.team1.points ? 'text-[#00E676] font-bold' : 'text-slate-200'}>
                      {m.team2.ownerName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fixed Right Sync Time & Screen WakeLock Status */}
        <div className="h-full px-3 bg-[#07080C] border-l border-white/10 flex items-center gap-3 text-[10px] text-slate-500 shrink-0 z-20 font-condensed">
          <div
            className="flex items-center gap-1.5 cursor-pointer hover:text-slate-300 transition-colors"
            onClick={requestWakeLock}
            title={isWakeLockActive ? "Screen WakeLock Active: TV display will stay awake" : "Click to activate Screen WakeLock"}
          >
            <Tv className={`w-3.5 h-3.5 ${isWakeLockActive ? 'text-[#00E676]' : 'text-slate-600'}`} />
            <span className="hidden md:inline font-bold uppercase text-[9px]">
              {isWakeLockActive ? 'WAKELOCK' : 'SLEEP-DEFENSE'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono-score">
            <Activity className="w-3.5 h-3.5 text-[#00E676]" />
            <span suppressHydrationWarning>{mounted && data?.lastUpdated ? `SYNC: ${new Date(data.lastUpdated).toLocaleTimeString()}` : ''}</span>
          </div>
        </div>
      </footer>

      {/* 7. MANAGE LEAGUES & GUESTS MODAL */}
      <ManageLeaguesModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        syncedLeagues={syncedLeagues}
        onUpdateLeagues={handleUpdateLeagues}
        guestTags={guestTags}
        onUpdateGuests={handleUpdateGuests}
        availablePlayers={allActivePlayers.map((p) => ({
          id: p.id,
          name: p.name,
          position: p.position,
          team: p.team.abbreviation,
        }))}
        currentWeek={data?.season?.week || 6}
      />

      {/* 7b. MANAGE BETS & PARLAYS MODAL */}
      <ManageBetsModal
        isOpen={isBetsModalOpen}
        onClose={() => setIsBetsModalOpen(false)}
        savedBets={savedBets}
        onUpdateBets={handleUpdateBets}
        availableGames={data?.games || []}
        availablePlayers={data?.allAvailablePlayers || data?.allPlayers || allActivePlayers}
      />

      {/* 7c. ROOM PHONE SYNC QR CODE MODAL */}
      {isQrModalOpen && (
        <div
          onClick={() => setIsQrModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 cursor-pointer animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full p-6 md:p-8 rounded-3xl bg-slate-900 border border-cyan-500/40 shadow-[0_0_60px_rgba(6,182,212,0.3)] flex flex-col items-center text-center cursor-default"
          >
            {/* Close button */}
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-black uppercase mb-3">
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>Room Phone Sync</span>
            </div>

            <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wide">
              Scan to Add Bets &amp; Players
            </h2>
            <p className="text-xs text-slate-400 mt-1 mb-5 max-w-xs leading-relaxed">
              Point your phone camera here to open this tracker on mobile, add your parlays, or connect fantasy teams to this TV in real-time.
            </p>

            {/* High-Contrast QR Code Card */}
            <div className="p-4 bg-white rounded-2xl shadow-2xl border-4 border-cyan-400/80 mb-5 flex items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                  typeof window !== 'undefined' ? window.location.origin : ''
                )}`}
                alt="Room QR Code"
                className="w-48 h-48 md:w-56 md:h-56 object-contain"
              />
            </div>

            {/* Room URL & Copy Button */}
            <div className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <span className="text-slate-400 font-mono truncate text-[11px]">
                {typeof window !== 'undefined' ? window.location.origin : ''}
              </span>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard?.writeText(window.location.origin);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-[10px] uppercase transition-all shrink-0"
              >
                {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Multi-Device Room Sync Active</span>
            </div>
          </div>
        </div>
      )}

      {/* 8. FULL-SCREEN BROADCAST TOUCHDOWN ALERT BANNER OVERLAY */}
      {activeTdAlert && (
        <div
          onClick={() => setActiveTdAlert(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 cursor-pointer animate-td-overlay"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-[94vw] md:w-[840px] p-6 md:p-8 rounded-[4px] bg-[#0E1017] border-2 border-amber-400 shadow-[0_0_80px_rgba(245,158,11,0.7)] animate-td-border flex flex-col items-center text-center overflow-hidden cursor-default"
          >
            {/* Top Close Button & RedZone Alert Header */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-xs font-condensed font-bold tracking-widest uppercase text-amber-400/80 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                REDZONE BREAKING PLAY ALERT
              </span>
              <button
                onClick={() => setActiveTdAlert(null)}
                className="px-2.5 py-1 rounded-[2px] bg-[#141722] hover:bg-[#1E2330] text-slate-300 hover:text-white text-xs font-condensed font-bold uppercase transition-colors border border-white/10 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>CLOSE</span>
              </button>
            </div>

            {/* Jumbotron Animated Header */}
            <div className="my-3">
              <h1 className="text-4xl md:text-6xl font-condensed font-bold tracking-widest text-amber-300 animate-td-title drop-shadow-[0_0_35px_rgba(251,191,36,0.9)] uppercase">
                TOUCHDOWN!
              </h1>
              <p className="text-sm md:text-base font-condensed font-bold text-slate-300 uppercase tracking-wider mt-1">
                {activeTdAlert.gameName} • {activeTdAlert.gameClock} {activeTdAlert.scoreSummary ? `• (${activeTdAlert.scoreSummary})` : ''}
              </p>
            </div>

            {/* Player Headshot & Team Logo Showcase */}
            <div className="flex items-center justify-center gap-6 my-3">
              {activeTdAlert.teamLogo && (
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-[4px] bg-[#07080C] border border-white/10 p-2 flex items-center justify-center shrink-0 shadow-lg">
                  <img
                    src={activeTdAlert.teamLogo}
                    alt={activeTdAlert.teamAbbr}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {activeTdAlert.playerHeadshot && (
                <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-[4px] overflow-hidden bg-[#07080C] border-2 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.8)] shrink-0">
                  <img
                    src={activeTdAlert.playerHeadshot}
                    alt={activeTdAlert.playerName}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            {/* Player Name & Position */}
            <div className="mb-2">
              <h2 className="text-3xl md:text-5xl font-condensed font-bold text-white leading-tight tracking-tight uppercase">
                {activeTdAlert.playerName}
              </h2>
              <div className="flex items-center justify-center gap-2 text-xs md:text-sm font-condensed font-bold text-slate-400 mt-1 uppercase">
                <span className="text-amber-400 font-bold">{activeTdAlert.teamAbbr}</span>
                {activeTdAlert.position && <span>• {activeTdAlert.position}</span>}
                {activeTdAlert.totalPoints !== undefined && (
                  <span className="text-[#00E676] font-mono-score font-bold ml-1">
                    • Total: {activeTdAlert.totalPoints.toFixed(1)} {scoringFormat.toUpperCase()} PTS
                  </span>
                )}
              </div>
            </div>

            {/* Full Play Description */}
            <div className="my-2 px-4 py-2.5 rounded-[4px] bg-[#141722] border border-white/10 max-w-2xl w-full shadow-inner">
              <p className="text-sm md:text-lg font-condensed font-semibold text-slate-100 italic leading-snug">
                &ldquo;{activeTdAlert.description}&rdquo;
              </p>
              {activeTdAlert.fantasyImpact && (
                <div className="mt-1 text-xs md:text-sm font-mono-score font-bold text-[#00E676] flex items-center justify-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-[#00E676]" />
                  <span>{activeTdAlert.fantasyImpact}</span>
                </div>
              )}
            </div>

            {/* Living Room Owner Callout Badge */}
            {activeTdAlert.owners.length > 0 ? (
              <div className="mt-3 px-5 py-2.5 rounded-[4px] bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-amber-500/15 border border-amber-400/80 shadow-[0_0_25px_rgba(245,158,11,0.5)] animate-pulse max-w-xl w-full">
                <div className="text-[11px] font-condensed font-bold uppercase text-amber-300 tracking-wider">
                  LIVING ROOM ROSTER SHOWDOWN ALERT
                </div>
                <div className="text-lg md:text-2xl font-condensed font-bold text-white mt-0.5">
                  Rostered by <span className="text-amber-300 underline">{activeTdAlert.owners[0].ownerName}</span> ({activeTdAlert.owners[0].teamName})
                </div>
                {activeTdAlert.owners.length > 1 && (
                  <div className="text-[10px] font-condensed font-bold text-rose-300 uppercase mt-0.5">
                    + Rostered in {activeTdAlert.owners.length - 1} other synced league(s)!
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-2 text-xs font-condensed font-semibold text-slate-500">
                Free Agent / Unowned in synced leagues
              </div>
            )}

            {/* 8-Second Progress Bar */}
            <div className="w-full h-1.5 bg-slate-900 rounded-full mt-5 overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-red-500 to-emerald-400 transition-all duration-100 ease-linear"
                style={{ width: `${tdProgress}%` }}
              />
            </div>
            <div className="w-full flex justify-between text-[10px] text-slate-500 font-bold uppercase mt-1">
              <span>Touchdown Alert</span>
              <span>Dismissing in {Math.ceil((tdProgress / 100) * 8)}s</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Render an individual player leaderboard card in the Top 10 2-column grid
 * Fully responsive to available height with zero stat truncation
 */
function renderLeaderboardCard(
  player: FantasyPlayer,
  rank: number,
  scoringFormat: ScoringFormat,
  boosted?: { delta: number; timestamp: number },
  ownershipTags?: PlayerOwnerTag[]
) {
  const pts = player.points[scoringFormat] ?? 0;
  const isBoosted = Boolean(boosted && Date.now() - boosted.timestamp < 6000);
  const owners = ownershipTags || [];

  // Rank Accent Color: Gold (1), Silver (2), Bronze (3), or NFL Team Primary Color (4-10)
  const accentColor =
    rank === 1
      ? '#FFD700'
      : rank === 2
      ? '#C0C0C0'
      : rank === 3
      ? '#CD7F32'
      : NFL_TEAM_COLORS[player.team.abbreviation] || '#38BDF8';

  let rankBadgeStyle = 'bg-[#141722] text-slate-300 border border-white/10';
  if (rank === 1) {
    rankBadgeStyle = 'bg-[#FFD700] text-black font-black border border-[#FFD700] shadow-[0_0_12px_rgba(255,215,0,0.6)]';
  } else if (rank === 2) {
    rankBadgeStyle = 'bg-[#C0C0C0] text-black font-black border border-[#C0C0C0] shadow-[0_0_10px_rgba(192,192,192,0.5)]';
  } else if (rank === 3) {
    rankBadgeStyle = 'bg-[#CD7F32] text-white font-black border border-[#CD7F32] shadow-[0_0_8px_rgba(205,127,50,0.5)]';
  }

  return (
    <div
      key={`${player.id}-${rank}`}
      style={{ borderLeftColor: accentColor }}
      className={`relative flex items-center justify-between px-3 py-1.5 rounded-[4px] border-l-[3px] border-y border-r border-white/10 transition-all flex-1 min-h-0 ${
        isBoosted
          ? 'bg-[#00E676]/10 border-r-[#00E676] border-y-[#00E676] shadow-[0_0_20px_rgba(0,230,118,0.7)] animate-burst'
          : 'bg-[#0E1017] hover:bg-[#141722] hover:border-white/20'
      }`}
    >
      {/* Floating Delta Badge when points increase */}
      {isBoosted && (
        <div className="absolute -top-2 right-4 px-2 py-0.2 rounded-[2px] bg-[#00E676] text-black text-[10px] font-mono-score font-bold tracking-wider shadow-[0_0_10px_rgba(0,230,118,0.9)] animate-bounce z-10">
          +{boosted?.delta.toFixed(1)} PTS!
        </div>
      )}

      {/* Left: Rank + Headshot + Name, Team, and Full Non-Truncated Stat Line */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
        {/* Rank Number */}
        <div
          className={`w-7 h-7 rounded-[2px] flex items-center justify-center text-xs font-mono-score font-bold shrink-0 ${rankBadgeStyle}`}
        >
          <span>{rank}</span>
        </div>

        {/* Headshot / Team Logo */}
        <div className="relative w-10 h-10 rounded-[2px] overflow-hidden bg-[#07080C] border border-white/10 shrink-0">
          <img
            src={player.headshot}
            alt={player.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = player.team.logo;
            }}
          />
          {/* Miniature Team Logo in Corner */}
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-[2px] bg-[#07080C] p-0.5 border border-white/10">
            <img
              src={player.team.logo}
              alt={player.team.abbreviation}
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Name, Team vs Opponent, Live Clock, Owner Badges, and FULL UNTRUNCATED STAT LINE */}
        <div className="min-w-0 flex-1 font-condensed">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-xs md:text-sm font-bold text-white truncate leading-tight tracking-tight uppercase">
              {player.name}
            </h3>

            {/* Red Zone Badge */}
            {player.gameStatus.isRedZone && (
              <span className="px-1 py-0.2 bg-red-600 text-white text-[8px] font-bold rounded-[2px] uppercase animate-pulse shrink-0">
                RZ
              </span>
            )}

            {/* GLOWING LEAGUE / GUEST OWNERSHIP BADGES */}
            {owners.length > 0 && (
              <div className="inline-flex items-center gap-1">
                {owners.length === 1 ? (
                  <span className="px-1.5 py-0.2 rounded-[2px] bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Users className="w-2.5 h-2.5 text-amber-400" />
                    <span>{owners[0].ownerName}</span>
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded-[2px] bg-rose-500/15 border border-rose-400/40 text-rose-300 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Users className="w-2.5 h-2.5 text-rose-400" />
                    <span>{owners.length} LEAGUES</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold truncate mt-0.5">
            <span className="text-slate-200 font-bold">{player.team.abbreviation}</span>
            <span>vs {player.opponent.abbreviation}</span>
            <span>•</span>
            <span
              className={
                player.isGameLive || player.gameStatus.state === 'in'
                  ? 'text-amber-400 font-bold inline-flex items-center gap-1'
                  : ''
              }
            >
              {(player.isGameLive || player.gameStatus.state === 'in') && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#00E676] animate-ping inline-block" />
              )}
              {player.gameStatus.detail || (player.isGameLive ? 'Live' : 'Final')}
            </span>
          </div>

          {/* Crisp Badge of Real-World Stats - FULLY VISIBLE WITH NO TRUNCATION */}
          <div className="mt-0.5">
            <span className="inline-block px-1.5 py-0.2 rounded-[2px] bg-[#141722] border border-white/10 text-[10px] md:text-[11px] font-mono-score font-bold text-slate-200 whitespace-nowrap">
              {player.rawStatLine}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Huge High-Contrast Fantasy Points Display */}
      <div className="flex flex-col items-end justify-center shrink-0 pl-2 border-l border-white/10 min-w-[70px]">
        <div className="text-xl lg:text-2xl font-mono-score font-bold text-[#00E676] leading-none">
          {Number.isInteger(pts) ? pts.toFixed(1) : pts.toFixed(1)}
        </div>
        <div className="text-[9px] font-condensed font-bold text-slate-400 uppercase tracking-widest mt-0.5">
          {scoringFormat.toUpperCase()} PTS
        </div>
      </div>
    </div>
  );
}
