'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  Search,
  Sparkles,
  Check,
  Pin,
  CheckCircle2,
  Flame,
  Activity,
  Layers,
  Scale,
} from 'lucide-react';
import { BetSlip, BetLeg, BetLegType, PropStatType, LiveGame, FantasyPlayer } from '@/types/fantasy';

interface ManageBetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedBets: BetSlip[];
  onUpdateBets: (bets: BetSlip[]) => void;
  availableGames: LiveGame[];
  availablePlayers: FantasyPlayer[];
}

export interface GeneratedMarketProp {
  id: string;
  type: BetLegType;
  category: 'PASSING' | 'RUSHING' | 'RECEIVING' | 'TOUCHDOWN' | 'GAME_LINE';
  playerName: string;
  playerId?: string;
  playerHeadshot?: string;
  playerTeam: string;
  statType?: PropStatType;
  direction?: 'OVER' | 'UNDER';
  targetValue?: number;
  description: string;
  odds: string;
  matchup: string;
  gameStatusText?: string;
  isGameLive?: boolean;
}

const STAT_OPTIONS: { id: PropStatType; label: string }[] = [
  { id: 'passYds', label: 'Pass Yds' },
  { id: 'passTD', label: 'Pass TDs' },
  { id: 'rushYds', label: 'Rush Yds' },
  { id: 'recYds', label: 'Rec Yds' },
  { id: 'rec', label: 'Receptions' },
  { id: 'rushRecYds', label: 'Rush + Rec Yds' },
];

export function getRealisticPropLine(position: string, statType: PropStatType): string {
  if (statType === 'passYds') return position === 'QB' ? '238.5' : '0.5';
  if (statType === 'passTD') return '1.5';
  if (statType === 'rushYds') {
    if (position === 'RB') return '62.5';
    if (position === 'QB') return '21.5';
    if (position === 'WR') return '6.5';
    return '14.5';
  }
  if (statType === 'recYds') {
    if (position === 'WR') return '48.5';
    if (position === 'TE') return '36.5';
    if (position === 'RB') return '16.5';
    return '24.5';
  }
  if (statType === 'rec') {
    if (position === 'WR') return '4.5';
    if (position === 'TE') return '3.5';
    if (position === 'RB') return '2.5';
    return '3.5';
  }
  if (statType === 'rushRecYds') {
    if (position === 'RB') return '76.5';
    if (position === 'WR') return '54.5';
    return '38.5';
  }
  return '45.5';
}

export default function ManageBetsModal({
  isOpen,
  onClose,
  savedBets,
  onUpdateBets,
  availableGames,
  availablePlayers,
}: ManageBetsModalProps) {
  // Tabs: 'props_market' (Fast-search pinning) | 'list' (active slips) | 'create' (custom builder)
  const [activeTab, setActiveTab] = useState<'props_market' | 'list' | 'create'>('props_market');

  // Fast-Search Prop Market State
  const [marketSearch, setMarketSearch] = useState('');
  const [marketCategory, setMarketCategory] = useState<'ALL' | 'PASSING' | 'RUSHING' | 'RECEIVING' | 'TOUCHDOWN' | 'GAME_LINE'>('ALL');
  const [marketGameFilter, setMarketGameFilter] = useState('ALL');

  // New Custom Slip Form State
  const [slipTitle, setSlipTitle] = useState('');
  const [slipOwner, setSlipOwner] = useState('');
  const [slipWager, setSlipWager] = useState('');
  const [slipPayout, setSlipPayout] = useState('');
  const [legs, setLegs] = useState<BetLeg[]>([]);

  // Leg Form State (for Custom Builder)
  const [selectedLegType, setSelectedLegType] = useState<BetLegType>('player_prop');
  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<FantasyPlayer | null>(null);
  const [propStat, setPropStat] = useState<PropStatType>('recYds');
  const [propDirection, setPropDirection] = useState<'OVER' | 'UNDER'>('OVER');
  const [propLine, setPropLine] = useState('48.5');

  // Game Spread / Moneyline / Total
  const [selectedGameId, setSelectedGameId] = useState(availableGames[0]?.id || '');
  const [selectedTeamAbbr, setSelectedTeamAbbr] = useState('');
  const [spreadValue, setSpreadValue] = useState('-3.5');
  const [totalDirection, setTotalDirection] = useState<'OVER' | 'UNDER'>('OVER');
  const [totalLine, setTotalLine] = useState('47.5');

  const selectedGame = availableGames.find((g) => g.id === selectedGameId) || availableGames[0];

  // 1. Generate the Comprehensive 629 Live Props Market Database
  const allGeneratedProps = useMemo<GeneratedMarketProp[]>(() => {
    const list: GeneratedMarketProp[] = [];

    // Helper to find live game state
    const getGameStatus = (teamAbbr: string) => {
      const g = availableGames.find(
        (gm) =>
          gm.awayTeam.abbreviation.toUpperCase() === teamAbbr.toUpperCase() ||
          gm.homeTeam.abbreviation.toUpperCase() === teamAbbr.toUpperCase()
      );
      if (!g) return { text: 'Upcoming', isLive: false, matchup: 'NFL Matchup' };
      const isLive = g.status.state === 'in';
      const isPost = g.status.state === 'post';
      const clock = isLive ? g.status.shortDetail || 'LIVE' : isPost ? 'FINAL' : 'Upcoming';
      const score = `${g.awayTeam.score}-${g.homeTeam.score}`;
      return {
        text: isLive ? `${clock} • ${score}` : isPost ? `FINAL • ${score}` : `${g.awayTeam.abbreviation} @ ${g.homeTeam.abbreviation}`,
        isLive,
        matchup: `${g.awayTeam.abbreviation} vs ${g.homeTeam.abbreviation}`,
      };
    };

    // A. Player Props
    for (const p of availablePlayers) {
      if (p.position === 'DEF') continue;
      const gameInfo = getGameStatus(p.team.abbreviation);

      // Anytime TD for all offensive players
      list.push({
        id: `prop-${p.id}-anytime-td`,
        type: 'anytime_td',
        category: 'TOUCHDOWN',
        playerName: p.name,
        playerId: p.id,
        playerHeadshot: p.headshot,
        playerTeam: p.team.abbreviation,
        description: `${p.name} Anytime Touchdown (1+ TD)`,
        odds: p.position === 'RB' ? '-110' : p.position === 'WR' ? '+155' : p.position === 'TE' ? '+210' : '+280',
        matchup: gameInfo.matchup,
        gameStatusText: gameInfo.text,
        isGameLive: gameInfo.isLive,
      });

      // QB Props
      if (p.position === 'QB') {
        list.push({
          id: `prop-${p.id}-passYds-over`,
          type: 'player_prop',
          category: 'PASSING',
          playerName: p.name,
          playerId: p.id,
          playerHeadshot: p.headshot,
          playerTeam: p.team.abbreviation,
          statType: 'passYds',
          direction: 'OVER',
          targetValue: 238.5,
          description: `${p.name} OVER 238.5 Passing Yds`,
          odds: '-115',
          matchup: gameInfo.matchup,
          gameStatusText: gameInfo.text,
          isGameLive: gameInfo.isLive,
        });
        list.push({
          id: `prop-${p.id}-passYds-under`,
          type: 'player_prop',
          category: 'PASSING',
          playerName: p.name,
          playerId: p.id,
          playerHeadshot: p.headshot,
          playerTeam: p.team.abbreviation,
          statType: 'passYds',
          direction: 'UNDER',
          targetValue: 238.5,
          description: `${p.name} UNDER 238.5 Passing Yds`,
          odds: '-115',
          matchup: gameInfo.matchup,
          gameStatusText: gameInfo.text,
          isGameLive: gameInfo.isLive,
        });
        list.push({
          id: `prop-${p.id}-passTD-over`,
          type: 'player_prop',
          category: 'PASSING',
          playerName: p.name,
          playerId: p.id,
          playerHeadshot: p.headshot,
          playerTeam: p.team.abbreviation,
          statType: 'passTD',
          direction: 'OVER',
          targetValue: 1.5,
          description: `${p.name} OVER 1.5 Passing TDs`,
          odds: '+115',
          matchup: gameInfo.matchup,
          gameStatusText: gameInfo.text,
          isGameLive: gameInfo.isLive,
        });
        list.push({
          id: `prop-${p.id}-rushYds-qb-over`,
          type: 'player_prop',
          category: 'RUSHING',
          playerName: p.name,
          playerId: p.id,
          playerHeadshot: p.headshot,
          playerTeam: p.team.abbreviation,
          statType: 'rushYds',
          direction: 'OVER',
          targetValue: 21.5,
          description: `${p.name} OVER 21.5 Rushing Yds`,
          odds: '-110',
          matchup: gameInfo.matchup,
          gameStatusText: gameInfo.text,
          isGameLive: gameInfo.isLive,
        });
      }

      // RB Props
      if (p.position === 'RB') {
        list.push({
          id: `prop-${p.id}-rushYds-rb-over`,
          type: 'player_prop',
          category: 'RUSHING',
          playerName: p.name,
          playerId: p.id,
          playerHeadshot: p.headshot,
          playerTeam: p.team.abbreviation,
          statType: 'rushYds',
          direction: 'OVER',
          targetValue: 64.5,
          description: `${p.name} OVER 64.5 Rushing Yds`,
          odds: '-115',
          matchup: gameInfo.matchup,
          gameStatusText: gameInfo.text,
          isGameLive: gameInfo.isLive,
        });
        list.push({
          id: `prop-${p.id}-rushYds-rb-under`,
          type: 'player_prop',
          category: 'RUSHING',
          playerName: p.name,
          playerId: p.id,
          playerHeadshot: p.headshot,
          playerTeam: p.team.abbreviation,
          statType: 'rushYds',
          direction: 'UNDER',
          targetValue: 64.5,
          description: `${p.name} UNDER 64.5 Rushing Yds`,
          odds: '-115',
          matchup: gameInfo.matchup,
          gameStatusText: gameInfo.text,
          isGameLive: gameInfo.isLive,
        });
        list.push({
          id: `prop-${p.id}-rushRecYds-rb-over`,
          type: 'player_prop',
          category: 'RUSHING',
          playerName: p.name,
          playerId: p.id,
          playerHeadshot: p.headshot,
          playerTeam: p.team.abbreviation,
          statType: 'rushRecYds',
          direction: 'OVER',
          targetValue: 78.5,
          description: `${p.name} OVER 78.5 Rush + Rec Yds`,
          odds: '-110',
          matchup: gameInfo.matchup,
          gameStatusText: gameInfo.text,
          isGameLive: gameInfo.isLive,
        });
        list.push({
          id: `prop-${p.id}-rec-rb-over`,
          type: 'player_prop',
          category: 'RECEIVING',
          playerName: p.name,
          playerId: p.id,
          playerHeadshot: p.headshot,
          playerTeam: p.team.abbreviation,
          statType: 'rec',
          direction: 'OVER',
          targetValue: 2.5,
          description: `${p.name} OVER 2.5 Receptions`,
          odds: '-125',
          matchup: gameInfo.matchup,
          gameStatusText: gameInfo.text,
          isGameLive: gameInfo.isLive,
        });
      }

      // WR Props
      if (p.position === 'WR') {
        list.push({
          id: `prop-${p.id}-recYds-wr-over`,
          type: 'player_prop',
          category: 'RECEIVING',
          playerName: p.name,
          playerId: p.id,
          playerHeadshot: p.headshot,
          playerTeam: p.team.abbreviation,
          statType: 'recYds',
          direction: 'OVER',
          targetValue: 52.5,
          description: `${p.name} OVER 52.5 Receiving Yds`,
          odds: '-115',
          matchup: gameInfo.matchup,
          gameStatusText: gameInfo.text,
          isGameLive: gameInfo.isLive,
        });
        list.push({
          id: `prop-${p.id}-recYds-wr-under`,
          type: 'player_prop',
          category: 'RECEIVING',
          playerName: p.name,
          playerId: p.id,
          playerHeadshot: p.headshot,
          playerTeam: p.team.abbreviation,
          statType: 'recYds',
          direction: 'UNDER',
          targetValue: 52.5,
          description: `${p.name} UNDER 52.5 Receiving Yds`,
          odds: '-115',
          matchup: gameInfo.matchup,
          gameStatusText: gameInfo.text,
          isGameLive: gameInfo.isLive,
        });
        list.push({
          id: `prop-${p.id}-rec-wr-over`,
          type: 'player_prop',
          category: 'RECEIVING',
          playerName: p.name,
          playerId: p.id,
          playerHeadshot: p.headshot,
          playerTeam: p.team.abbreviation,
          statType: 'rec',
          direction: 'OVER',
          targetValue: 4.5,
          description: `${p.name} OVER 4.5 Receptions`,
          odds: '-110',
          matchup: gameInfo.matchup,
          gameStatusText: gameInfo.text,
          isGameLive: gameInfo.isLive,
        });
      }

      // TE Props
      if (p.position === 'TE') {
        list.push({
          id: `prop-${p.id}-recYds-te-over`,
          type: 'player_prop',
          category: 'RECEIVING',
          playerName: p.name,
          playerId: p.id,
          playerHeadshot: p.headshot,
          playerTeam: p.team.abbreviation,
          statType: 'recYds',
          direction: 'OVER',
          targetValue: 36.5,
          description: `${p.name} OVER 36.5 Receiving Yds`,
          odds: '-115',
          matchup: gameInfo.matchup,
          gameStatusText: gameInfo.text,
          isGameLive: gameInfo.isLive,
        });
        list.push({
          id: `prop-${p.id}-rec-te-over`,
          type: 'player_prop',
          category: 'RECEIVING',
          playerName: p.name,
          playerId: p.id,
          playerHeadshot: p.headshot,
          playerTeam: p.team.abbreviation,
          statType: 'rec',
          direction: 'OVER',
          targetValue: 3.5,
          description: `${p.name} OVER 3.5 Receptions`,
          odds: '+105',
          matchup: gameInfo.matchup,
          gameStatusText: gameInfo.text,
          isGameLive: gameInfo.isLive,
        });
      }
    }

    // B. Game Lines (Spreads, Totals, Moneylines)
    for (const g of availableGames) {
      const isLive = g.status.state === 'in';
      const isPost = g.status.state === 'post';
      const clock = isLive ? g.status.shortDetail || 'LIVE' : isPost ? 'FINAL' : 'Upcoming';
      const score = `${g.awayTeam.score}-${g.homeTeam.score}`;
      const statusText = isLive ? `${clock} • ${score}` : isPost ? `FINAL • ${score}` : `${g.awayTeam.abbreviation} @ ${g.homeTeam.abbreviation}`;

      // Spread Away
      list.push({
        id: `game-${g.id}-spread-away`,
        type: 'spread',
        category: 'GAME_LINE',
        playerName: g.awayTeam.displayName,
        playerTeam: g.awayTeam.abbreviation,
        description: `${g.awayTeam.abbreviation} -3.5 vs ${g.homeTeam.abbreviation}`,
        odds: '-110',
        matchup: `${g.awayTeam.abbreviation} vs ${g.homeTeam.abbreviation}`,
        gameStatusText: statusText,
        isGameLive: isLive,
      });

      // Spread Home
      list.push({
        id: `game-${g.id}-spread-home`,
        type: 'spread',
        category: 'GAME_LINE',
        playerName: g.homeTeam.displayName,
        playerTeam: g.homeTeam.abbreviation,
        description: `${g.homeTeam.abbreviation} +3.5 vs ${g.awayTeam.abbreviation}`,
        odds: '-110',
        matchup: `${g.awayTeam.abbreviation} vs ${g.homeTeam.abbreviation}`,
        gameStatusText: statusText,
        isGameLive: isLive,
      });

      // Over Total
      list.push({
        id: `game-${g.id}-total-over`,
        type: 'total',
        category: 'GAME_LINE',
        playerName: `${g.awayTeam.abbreviation} / ${g.homeTeam.abbreviation}`,
        playerTeam: g.awayTeam.abbreviation,
        description: `OVER 47.5 Total Points (${g.awayTeam.abbreviation} vs ${g.homeTeam.abbreviation})`,
        odds: '-110',
        matchup: `${g.awayTeam.abbreviation} vs ${g.homeTeam.abbreviation}`,
        gameStatusText: statusText,
        isGameLive: isLive,
      });

      // Under Total
      list.push({
        id: `game-${g.id}-total-under`,
        type: 'total',
        category: 'GAME_LINE',
        playerName: `${g.awayTeam.abbreviation} / ${g.homeTeam.abbreviation}`,
        playerTeam: g.homeTeam.abbreviation,
        description: `UNDER 47.5 Total Points (${g.awayTeam.abbreviation} vs ${g.homeTeam.abbreviation})`,
        odds: '-110',
        matchup: `${g.awayTeam.abbreviation} vs ${g.homeTeam.abbreviation}`,
        gameStatusText: statusText,
        isGameLive: isLive,
      });
    }

    return list;
  }, [availableGames, availablePlayers]);

  // 2. Filter Market Props based on Search, Category, and Game
  const filteredMarketProps = useMemo(() => {
    let result = allGeneratedProps;

    if (marketCategory !== 'ALL') {
      result = result.filter((p) => p.category === marketCategory);
    }

    if (marketGameFilter !== 'ALL') {
      result = result.filter((p) =>
        p.matchup.toUpperCase().includes(marketGameFilter.toUpperCase()) ||
        p.playerTeam.toUpperCase() === marketGameFilter.toUpperCase()
      );
    }

    const q = marketSearch.trim().toLowerCase();
    if (q) {
      // Support multi-term searches like "caleb williams passing" or "kenneth walker rush"
      const terms = q.split(/\s+/).filter(Boolean);
      result = result.filter((p) => {
        const fullString = `${p.playerName} ${p.playerTeam} ${p.description} ${p.category} ${p.matchup}`.toLowerCase();
        return terms.every((term) => fullString.includes(term));
      });
    }

    return result.slice(0, 100);
  }, [allGeneratedProps, marketCategory, marketGameFilter, marketSearch]);

  // 3. Fast Pinning Logic: Check if prop is pinned & toggle pin
  const isPropPinned = (prop: GeneratedMarketProp) => {
    return savedBets.some((s) =>
      s.legs.some(
        (l) =>
          l.id === prop.id ||
          (l.description === prop.description) ||
          (l.playerId && prop.playerId && l.playerId === prop.playerId && l.statType === prop.statType && l.direction === prop.direction)
      )
    );
  };

  const handleTogglePinProp = (prop: GeneratedMarketProp) => {
    let targetSlip = savedBets.find(
      (s) =>
        s.id === 'sunday-sweat-slip' ||
        s.title.toLowerCase().includes('sunday sweat') ||
        s.title.toLowerCase().includes('sunday room lock')
    );

    const isPinned = isPropPinned(prop);

    if (isPinned && targetSlip) {
      // Unpin
      const updatedLegs = targetSlip.legs.filter(
        (l) =>
          l.id !== prop.id &&
          l.description !== prop.description &&
          !(l.playerId && prop.playerId && l.playerId === prop.playerId && l.statType === prop.statType && l.direction === prop.direction)
      );
      const updatedSlips = savedBets.map((s) => (s.id === targetSlip!.id ? { ...s, legs: updatedLegs } : s));
      onUpdateBets(updatedSlips);
    } else {
      // Pin
      const newLeg: BetLeg = {
        id: prop.id,
        type: prop.type,
        playerId: prop.playerId,
        playerName: prop.playerName,
        playerHeadshot: prop.playerHeadshot,
        playerTeam: prop.playerTeam,
        statType: prop.statType,
        direction: prop.direction,
        targetValue: prop.targetValue,
        description: prop.description,
      };

      if (targetSlip) {
        const updatedLegs = [...targetSlip.legs, newLeg];
        const updatedSlips = savedBets.map((s) => (s.id === targetSlip!.id ? { ...s, legs: updatedLegs } : s));
        onUpdateBets(updatedSlips);
      } else {
        const newSlip: BetSlip = {
          id: 'sunday-sweat-slip',
          title: 'Sunday Sweat (Pinned Action)',
          ownerName: 'Living Room',
          wager: '$25',
          payout: '$175 (+600)',
          createdAt: Date.now(),
          legs: [newLeg],
        };
        onUpdateBets([newSlip, ...savedBets]);
      }
    }
  };

  // Pinned count in Sunday Sweat
  const sweatSlip = savedBets.find(
    (s) =>
      s.id === 'sunday-sweat-slip' ||
      s.title.toLowerCase().includes('sunday sweat') ||
      s.title.toLowerCase().includes('sunday room lock')
  );
  const pinnedLegsCount = sweatSlip ? sweatSlip.legs.length : 0;

  // Custom Builder Handlers
  const handleAddLeg = () => {
    let newLeg: BetLeg | null = null;
    const legId = `leg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    if (selectedLegType === 'player_prop') {
      if (!selectedPlayer) return;
      const statLabel = STAT_OPTIONS.find((s) => s.id === propStat)?.label || propStat;
      newLeg = {
        id: legId,
        type: 'player_prop',
        playerId: selectedPlayer.id,
        playerName: selectedPlayer.name,
        playerHeadshot: selectedPlayer.headshot,
        playerTeam: selectedPlayer.team.abbreviation,
        statType: propStat,
        direction: propDirection,
        targetValue: parseFloat(propLine) || 0,
        description: `${selectedPlayer.name} ${propDirection} ${propLine} ${statLabel}`,
      };
    } else if (selectedLegType === 'anytime_td') {
      if (!selectedPlayer) return;
      newLeg = {
        id: legId,
        type: 'anytime_td',
        playerId: selectedPlayer.id,
        playerName: selectedPlayer.name,
        playerHeadshot: selectedPlayer.headshot,
        playerTeam: selectedPlayer.team.abbreviation,
        description: `${selectedPlayer.name} Anytime Touchdown (1+ TD)`,
      };
    } else if (selectedLegType === 'spread') {
      if (!selectedGame) return;
      const team = selectedTeamAbbr || selectedGame.awayTeam.abbreviation;
      const opp = team === selectedGame.awayTeam.abbreviation ? selectedGame.homeTeam.abbreviation : selectedGame.awayTeam.abbreviation;
      const spreadNum = parseFloat(spreadValue) || 0;
      const spreadStr = spreadNum > 0 ? `+${spreadNum}` : `${spreadNum}`;
      newLeg = {
        id: legId,
        type: 'spread',
        gameId: selectedGame.id,
        teamAbbr: team,
        spread: spreadNum,
        description: `${team} ${spreadStr} vs ${opp}`,
      };
    } else if (selectedLegType === 'total') {
      if (!selectedGame) return;
      const totalNum = parseFloat(totalLine) || 0;
      newLeg = {
        id: legId,
        type: 'total',
        gameId: selectedGame.id,
        direction: totalDirection,
        totalPoints: totalNum,
        description: `${totalDirection} ${totalNum} Total Points (${selectedGame.awayTeam.abbreviation} vs ${selectedGame.homeTeam.abbreviation})`,
      };
    }

    if (newLeg) {
      setLegs((prev) => [...prev, newLeg!]);
      setSelectedPlayer(null);
      setPlayerSearch('');
    }
  };

  const handleRemoveLeg = (legId: string) => {
    setLegs((prev) => prev.filter((l) => l.id !== legId));
  };

  const handleSaveSlip = () => {
    if (legs.length === 0) return;
    const title = slipTitle.trim() || (legs.length > 1 ? `${legs.length}-Leg Parlay` : legs[0].description);
    const newSlip: BetSlip = {
      id: `slip-${Date.now()}`,
      title,
      ownerName: slipOwner.trim() || undefined,
      wager: slipWager.trim() || undefined,
      payout: slipPayout.trim() || undefined,
      createdAt: Date.now(),
      legs,
    };
    onUpdateBets([newSlip, ...savedBets]);
    setSlipTitle('');
    setSlipOwner('');
    setSlipWager('');
    setSlipPayout('');
    setLegs([]);
    setActiveTab('list');
  };

  const handleDeleteSlip = (slipId: string) => {
    onUpdateBets(savedBets.filter((s) => s.id !== slipId));
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-[#0e1015] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] font-condensed animate-fadeIn"
      >
        {/* Modal Header */}
        <div className="bg-[#0a0b0e] px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black text-white uppercase tracking-wider">
                Live Sportsbook &amp; Props Market
              </h2>
              <p className="text-xs text-zinc-500 font-medium">
                Instant prop pinning, multi-game tracking, and live parlay hedge management
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-zinc-800 bg-[#0a0b0e]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('props_market')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${
                activeTab === 'props_market'
                  ? 'bg-amber-400 text-black font-black'
                  : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800'
              }`}
            >
              <Pin className="w-3.5 h-3.5" />
              <span>Fast-Pin Props ({allGeneratedProps.length} Live Markets)</span>
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${
                activeTab === 'list'
                  ? 'bg-amber-400 text-black font-black'
                  : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tracked Slips ({savedBets.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${
                activeTab === 'create'
                  ? 'bg-amber-400 text-black font-black'
                  : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Custom Slip Builder</span>
            </button>
          </div>

          {/* Active Sunday Sweat Pin Indicator */}
          {pinnedLegsCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono-score font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                {pinnedLegsCount} Props Pinned to Sweat
              </span>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#0e1015]">
          {/* TAB 1: FAST-PIN PROPS MARKET (SEARCH & 1-CLICK PINNING) */}
          {activeTab === 'props_market' && (
            <div className="flex flex-col gap-3.5 h-full">
              {/* Search & Category Filter Header */}
              <div className="flex flex-col gap-2.5 pb-3 border-b border-zinc-800">
                {/* Search Input */}
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={marketSearch}
                    onChange={(e) => setMarketSearch(e.target.value)}
                    placeholder="Search 629 live props (e.g. 'Caleb Williams Passing Yds' or 'Kenneth Walker')..."
                    className="w-full bg-[#13151f] border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs md:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-bold"
                  />
                  {marketSearch && (
                    <button
                      onClick={() => setMarketSearch('')}
                      className="absolute right-3 top-3 text-zinc-500 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filter Pills: Categories + Games */}
                <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    {(
                      [
                        { id: 'ALL', label: `ALL (${allGeneratedProps.length})` },
                        { id: 'PASSING', label: 'PASSING' },
                        { id: 'RUSHING', label: 'RUSHING' },
                        { id: 'RECEIVING', label: 'RECEIVING' },
                        { id: 'TOUCHDOWN', label: 'ANYTIME TD' },
                        { id: 'GAME_LINE', label: 'GAME LINES' },
                      ] as const
                    ).map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setMarketCategory(cat.id)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all whitespace-nowrap shrink-0 border ${
                          marketCategory === cat.id
                            ? 'bg-amber-400 text-black border-amber-300 font-black'
                            : 'bg-[#13151f] text-zinc-300 hover:text-white border-zinc-800'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Filter by Game */}
                  <select
                    value={marketGameFilter}
                    onChange={(e) => setMarketGameFilter(e.target.value)}
                    className="bg-[#13151f] border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 font-bold outline-none shrink-0"
                  >
                    <option value="ALL">All Matchups</option>
                    {availableGames.map((g) => (
                      <option key={g.id} value={g.awayTeam.abbreviation}>
                        {g.awayTeam.abbreviation} vs {g.homeTeam.abbreviation}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Props Results Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredMarketProps.length === 0 ? (
                  <div className="col-span-2 py-12 text-center text-zinc-500 text-xs">
                    No props matching &quot;{marketSearch}&quot;. Try searching player name or prop type.
                  </div>
                ) : (
                  filteredMarketProps.map((prop) => {
                    const pinned = isPropPinned(prop);
                    return (
                      <div
                        key={prop.id}
                        className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                          pinned
                            ? 'bg-[#0f1914] border-emerald-500/50 border-l-4 border-l-emerald-400'
                            : 'bg-[#13151f] border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {/* Prop Info */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {prop.playerHeadshot ? (
                            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0">
                              <img
                                src={prop.playerHeadshot}
                                alt={prop.playerName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                }}
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-xs text-amber-400 shrink-0">
                              {prop.playerTeam}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white uppercase truncate">
                                {prop.description}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
                              <span className="font-bold text-zinc-400">{prop.matchup}</span>
                              {prop.gameStatusText && (
                                <>
                                  <span>•</span>
                                  <span
                                    className={
                                      prop.isGameLive
                                        ? 'text-amber-400 font-bold flex items-center gap-1'
                                        : 'text-zinc-500'
                                    }
                                  >
                                    {prop.isGameLive && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                                    )}
                                    {prop.gameStatusText}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Odds & Pin Action */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] font-mono-score font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                            {prop.odds}
                          </span>
                          <button
                            onClick={() => handleTogglePinProp(prop)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all flex items-center gap-1 ${
                              pinned
                                ? 'bg-emerald-400 text-black font-black hover:bg-rose-600 hover:text-white'
                                : 'bg-zinc-800 text-white hover:bg-amber-400 hover:text-black border border-zinc-700'
                            }`}
                          >
                            {pinned ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>PINNED</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ PIN TO SWEAT</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ACTIVE TRACKED SLIPS */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {savedBets.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-xl bg-[#13151f] border border-dashed border-zinc-800">
                  <DollarSign className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                    No Bets or Parlays Saved Yet
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4 font-medium">
                    Use the Fast-Pin Props market to instantly add your Sunday action!
                  </p>
                  <button
                    onClick={() => setActiveTab('props_market')}
                    className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase transition-all shadow-md"
                  >
                    Browse &amp; Pin Props
                  </button>
                </div>
              ) : (
                savedBets.map((slip) => (
                  <div
                    key={slip.id}
                    className="p-4 rounded-xl bg-[#13151f] border border-zinc-800 hover:border-zinc-700 transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase">
                          {slip.legs.length > 1 ? `${slip.legs.length}-LEG PARLAY` : 'SINGLE BET'}
                        </span>
                        <h4 className="text-sm font-black text-white">{slip.title}</h4>
                        {slip.ownerName && (
                          <span className="text-xs text-zinc-500 font-bold">
                            • Tag: <span className="text-amber-400">{slip.ownerName}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {slip.wager && (
                          <span className="text-xs font-mono-score font-bold text-zinc-400">
                            Stake: <span className="text-white">{slip.wager}</span>
                          </span>
                        )}
                        {slip.payout && (
                          <span className="text-xs font-mono-score font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-500/30">
                            To Win: {slip.payout}
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteSlip(slip.id)}
                          className="text-zinc-500 hover:text-rose-400 transition-colors p-1"
                          title="Delete Slip"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Legs list inside slip */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-zinc-800">
                      {slip.legs.map((leg, idx) => (
                        <div
                          key={leg.id || idx}
                          className="px-2.5 py-1.5 rounded-lg bg-[#0e1015] border border-zinc-800 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-mono-score font-bold text-zinc-500">
                              #{idx + 1}
                            </span>
                            <span className="font-bold text-zinc-200 truncate">{leg.description}</span>
                          </div>
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 shrink-0 ml-1">
                            {leg.type.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: CUSTOM SLIP BUILDER */}
          {activeTab === 'create' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1 uppercase">
                    Slip Title
                  </label>
                  <input
                    type="text"
                    value={slipTitle}
                    onChange={(e) => setSlipTitle(e.target.value)}
                    placeholder="e.g. Sunday Room Lock (+600)"
                    className="w-full bg-[#13151f] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-amber-400 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1 uppercase">
                    Stake / Wager
                  </label>
                  <input
                    type="text"
                    value={slipWager}
                    onChange={(e) => setSlipWager(e.target.value)}
                    placeholder="$25"
                    className="w-full bg-[#13151f] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-amber-400 outline-none font-mono-score"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1 uppercase">
                    Payout / Odds
                  </label>
                  <input
                    type="text"
                    value={slipPayout}
                    onChange={(e) => setSlipPayout(e.target.value)}
                    placeholder="$175 (+600)"
                    className="w-full bg-[#13151f] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-amber-400 outline-none font-mono-score"
                  />
                </div>
              </div>

              {/* Legs added so far */}
              <div className="p-3 rounded-lg bg-[#13151f] border border-zinc-800">
                <span className="text-xs font-bold text-zinc-300 uppercase block mb-2">
                  Legs Added to this Slip ({legs.length})
                </span>
                {legs.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">No legs added yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {legs.map((leg, idx) => (
                      <div
                        key={leg.id}
                        className="px-3 py-2 rounded-lg bg-[#0e1015] border border-zinc-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono-score font-bold text-amber-400">
                            #{idx + 1}
                          </span>
                          <span className="text-xs font-bold text-white">{leg.description}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLeg(leg.id)}
                          className="text-zinc-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Leg Form Controls */}
              <div className="p-3 rounded-lg bg-[#13151f] border border-zinc-800 flex flex-col gap-2.5">
                <span className="text-xs font-bold text-amber-300 uppercase">
                  Add a New Leg
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={selectedLegType}
                    onChange={(e) => setSelectedLegType(e.target.value as BetLegType)}
                    className="bg-[#0e1015] border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white font-bold outline-none"
                  >
                    <option value="player_prop">Player Prop (Over / Under)</option>
                    <option value="anytime_td">Anytime Touchdown</option>
                    <option value="spread">Game Spread</option>
                    <option value="total">Game Total (Over / Under)</option>
                  </select>

                  {(selectedLegType === 'player_prop' || selectedLegType === 'anytime_td') && (
                    <select
                      onChange={(e) => {
                        const p = availablePlayers.find((pl) => pl.id === e.target.value);
                        setSelectedPlayer(p || null);
                      }}
                      className="bg-[#0e1015] border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white font-bold outline-none"
                    >
                      <option value="">Select Player...</option>
                      {availablePlayers
                        .filter((p) => p.position !== 'DEF')
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.team.abbreviation} - {p.position})
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddLeg}
                    className="px-4 py-1.5 rounded-md bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs uppercase"
                  >
                    + Add Leg
                  </button>
                </div>
              </div>

              {/* Save Slip Button */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('props_market')}
                  className="px-4 py-2 rounded-lg bg-[#13151f] hover:bg-zinc-800 text-zinc-300 font-bold text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={legs.length === 0}
                  onClick={handleSaveSlip}
                  className="px-5 py-2 rounded-md bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-xs uppercase transition-colors"
                >
                  Save Slip ({legs.length} {legs.length === 1 ? 'Leg' : 'Legs'})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
