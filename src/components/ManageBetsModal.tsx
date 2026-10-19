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

const STAT_OPTIONS: { id: PropStatType; label: string }[] = [
  { id: 'passYds', label: 'Pass Yds' },
  { id: 'passTD', label: 'Pass TDs' },
  { id: 'rushYds', label: 'Rush Yds' },
  { id: 'recYds', label: 'Rec Yds' },
  { id: 'rec', label: 'Receptions' },
  { id: 'rushRecYds', label: 'Rush + Rec Yds' },
];

export default function ManageBetsModal({
  isOpen,
  onClose,
  savedBets,
  onUpdateBets,
  availableGames,
  availablePlayers,
}: ManageBetsModalProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

  // New Slip Form State
  const [slipTitle, setSlipTitle] = useState('');
  const [slipOwner, setSlipOwner] = useState('');
  const [slipWager, setSlipWager] = useState('');
  const [slipPayout, setSlipPayout] = useState('');
  const [legs, setLegs] = useState<BetLeg[]>([]);

  // Leg Form State
  const [selectedLegType, setSelectedLegType] = useState<BetLegType>('player_prop');

  // Player Prop / Anytime TD
  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<FantasyPlayer | null>(null);
  const [propStat, setPropStat] = useState<PropStatType>('recYds');
  const [propDirection, setPropDirection] = useState<'OVER' | 'UNDER'>('OVER');
  const [propLine, setPropLine] = useState('64.5');

  // Game Spread / Moneyline / Total
  const [selectedGameId, setSelectedGameId] = useState(availableGames[0]?.id || '');
  const [selectedTeamAbbr, setSelectedTeamAbbr] = useState('');
  const [spreadValue, setSpreadValue] = useState('-3.5');
  const [totalDirection, setTotalDirection] = useState<'OVER' | 'UNDER'>('OVER');
  const [totalLine, setTotalLine] = useState('47.5');

  const selectedGame = availableGames.find((g) => g.id === selectedGameId) || availableGames[0];

  // Quick team filter for props: 'ALL' or team abbreviation (e.g. 'DAL', 'GB', etc.)
  const [teamPropFilter, setTeamPropFilter] = useState<string>('ALL');

  // Extract all unique teams from available games and players
  const uniqueTeams = useMemo(() => {
    const map = new Map<string, { abbreviation: string; name: string; isLive: boolean }>();
    for (const g of availableGames) {
      const isLive = g.status?.state === 'in';
      if (g.awayTeam?.abbreviation) {
        map.set(g.awayTeam.abbreviation, {
          abbreviation: g.awayTeam.abbreviation,
          name: g.awayTeam.displayName || g.awayTeam.name || g.awayTeam.abbreviation,
          isLive,
        });
      }
      if (g.homeTeam?.abbreviation) {
        map.set(g.homeTeam.abbreviation, {
          abbreviation: g.homeTeam.abbreviation,
          name: g.homeTeam.displayName || g.homeTeam.name || g.homeTeam.abbreviation,
          isLive,
        });
      }
    }
    for (const p of availablePlayers) {
      if (p.team?.abbreviation && !map.has(p.team.abbreviation)) {
        map.set(p.team.abbreviation, {
          abbreviation: p.team.abbreviation,
          name: p.team.displayName || p.team.abbreviation,
          isLive: p.isGameLive || false,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
      return a.abbreviation.localeCompare(b.abbreviation);
    });
  }, [availableGames, availablePlayers]);

  // Filtered Players for Prop Search
  const filteredPlayers = useMemo(() => {
    const query = playerSearch.trim().toLowerCase();
    let list = availablePlayers;

    if (teamPropFilter !== 'ALL') {
      list = list.filter((p) => p.team.abbreviation.toUpperCase() === teamPropFilter.toUpperCase());
    }

    if (query) {
      list = list.filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(query);
        const abbrMatch = p.team.abbreviation.toLowerCase().includes(query);
        const teamNameMatch = (p.team.displayName || '').toLowerCase().includes(query);
        const posMatch = p.position.toLowerCase().includes(query);
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

        return nameMatch || abbrMatch || teamNameMatch || posMatch || nicknameMatch;
      });
    }

    return list.slice(0, 36);
  }, [availablePlayers, teamPropFilter, playerSearch]);

  // Add Leg to pending slip
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
        description: `${selectedPlayer.name} Anytime Touchdown (1+ Rush/Rec TD)`,
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
    } else if (selectedLegType === 'moneyline') {
      if (!selectedGame) return;
      const team = selectedTeamAbbr || selectedGame.awayTeam.abbreviation;
      const opp = team === selectedGame.awayTeam.abbreviation ? selectedGame.homeTeam.abbreviation : selectedGame.awayTeam.abbreviation;
      newLeg = {
        id: legId,
        type: 'moneyline',
        gameId: selectedGame.id,
        teamAbbr: team,
        description: `${team} Moneyline (Outright Win vs ${opp})`,
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

    const updated = [newSlip, ...savedBets];
    onUpdateBets(updated);
    setSlipTitle('');
    setSlipOwner('');
    setSlipWager('');
    setSlipPayout('');
    setLegs([]);
    setActiveTab('list');
  };

  const handleDeleteSlip = (slipId: string) => {
    const updated = savedBets.filter((s) => s.id !== slipId);
    onUpdateBets(updated);
  };

  // Pre-seed sample parlays for instant demonstration
  const handleLoadDemoBets = () => {
    const samplePlayer1 = availablePlayers.find((p) => p.position === 'RB' || p.position === 'WR') || availablePlayers[0];
    const samplePlayer2 = availablePlayers.find((p) => p.position === 'QB') || availablePlayers[1] || availablePlayers[0];
    const sampleGame = availableGames[0];

    const demoSlip: BetSlip = {
      id: `slip-demo-${Date.now()}`,
      title: "Living Room Sunday Lock (+550)",
      ownerName: "Living Room",
      wager: "$20",
      payout: "$130 (+550)",
      createdAt: Date.now(),
      legs: [
        {
          id: `leg-1-${Date.now()}`,
          type: 'anytime_td',
          playerId: samplePlayer1?.id || 'demo-1',
          playerName: samplePlayer1?.name || "Derrick Henry",
          playerHeadshot: samplePlayer1?.headshot,
          playerTeam: samplePlayer1?.team?.abbreviation || 'BAL',
          description: `${samplePlayer1?.name || "Derrick Henry"} Anytime Touchdown`,
        },
        {
          id: `leg-2-${Date.now()}`,
          type: 'player_prop',
          playerId: samplePlayer2?.id || 'demo-2',
          playerName: samplePlayer2?.name || "Lamar Jackson",
          playerHeadshot: samplePlayer2?.headshot,
          playerTeam: samplePlayer2?.team?.abbreviation || 'BAL',
          statType: 'passYds',
          direction: 'OVER',
          targetValue: 215.5,
          description: `${samplePlayer2?.name || "Lamar Jackson"} OVER 215.5 Pass Yds`,
        },
        ...(sampleGame
          ? [
              {
                id: `leg-3-${Date.now()}`,
                type: 'spread' as BetLegType,
                gameId: sampleGame.id,
                teamAbbr: sampleGame.awayTeam.abbreviation,
                spread: -3.5,
                description: `${sampleGame.awayTeam.abbreviation} -3.5 vs ${sampleGame.homeTeam.abbreviation}`,
              },
            ]
          : []),
      ],
    };

    onUpdateBets([demoSlip, ...savedBets]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                💰 Parlay &amp; Bet Tracker
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Track live player props, spreads, totals, and anytime TDs across all games
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2 border-b border-slate-800/80 bg-slate-950">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                activeTab === 'list'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>Active Slips ({savedBets.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                activeTab === 'create'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Create Bet / Parlay</span>
            </button>
          </div>

          {savedBets.length === 0 && (
            <button
              onClick={handleLoadDemoBets}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-black uppercase flex items-center gap-1.5 transition-all"
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Load Sample Parlay</span>
            </button>
          )}
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'list' ? (
            /* ACTIVE BET SLIPS LIST */
            <div className="space-y-3">
              {savedBets.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
                  <DollarSign className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <h3 className="text-sm font-black text-slate-300 uppercase tracking-wide">
                    No Bets or Parlays Saved Yet
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4 font-medium">
                    Add your Sunday action! Track spreads, moneylines, totals, and player props live on the TV.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setActiveTab('create')}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase transition-all shadow-md"
                    >
                      + Create Your First Slip
                    </button>
                    <button
                      onClick={handleLoadDemoBets}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs uppercase transition-all border border-slate-700"
                    >
                      Load Sample Slip
                    </button>
                  </div>
                </div>
              ) : (
                savedBets.map((slip) => (
                  <div
                    key={slip.id}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase">
                          {slip.legs.length > 1 ? `${slip.legs.length}-LEG PARLAY` : 'SINGLE BET'}
                        </span>
                        <h4 className="text-sm font-black text-white">{slip.title}</h4>
                        {slip.ownerName && (
                          <span className="text-xs text-slate-400 font-bold">
                            • Tag: <span className="text-amber-400">{slip.ownerName}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {slip.wager && (
                          <span className="text-xs font-black text-slate-300">
                            Wager: <span className="text-white">{slip.wager}</span>
                          </span>
                        )}
                        {slip.payout && (
                          <span className="text-xs font-black text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                            To Win: {slip.payout}
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteSlip(slip.id)}
                          className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                          title="Delete Slip"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Legs list inside slip */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                      {slip.legs.map((leg, idx) => (
                        <div
                          key={leg.id || idx}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800/80 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-black text-slate-500">#{idx + 1}</span>
                            <span className="font-bold text-slate-200 truncate">{leg.description}</span>
                          </div>
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 shrink-0 ml-1">
                            {leg.type.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* CREATE BET SLIP FORM */
            <div className="space-y-5">
              {/* Slip Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900/50 p-3.5 rounded-2xl border border-slate-800">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Slip Title / Nickname
                  </label>
                  <input
                    type="text"
                    value={slipTitle}
                    onChange={(e) => setSlipTitle(e.target.value)}
                    placeholder="e.g. Alex's 4PM Lock, Room Parlay (+650)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Owner / Manager Tag
                  </label>
                  <input
                    type="text"
                    value={slipOwner}
                    onChange={(e) => setSlipOwner(e.target.value)}
                    placeholder="e.g. Alex, Room"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Wager / Potential Payout
                  </label>
                  <input
                    type="text"
                    value={slipPayout}
                    onChange={(e) => setSlipPayout(e.target.value)}
                    placeholder="e.g. $10 -> $85"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 font-bold"
                  />
                </div>
              </div>

              {/* Add Leg Section */}
              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">
                      Add a Leg to this Slip
                    </h3>
                  </div>

                  {/* Leg Type Selector */}
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { id: 'player_prop', label: 'Player Prop' },
                        { id: 'anytime_td', label: 'Anytime TD' },
                        { id: 'spread', label: 'Spread' },
                        { id: 'moneyline', label: 'Moneyline' },
                        { id: 'total', label: 'Total (O/U)' },
                      ] as { id: BetLegType; label: string }[]
                    ).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedLegType(t.id)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                          selectedLegType === t.id
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub-Form for Player Prop & Anytime TD */}
                {(selectedLegType === 'player_prop' || selectedLegType === 'anytime_td') && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-black uppercase text-slate-400">
                            Select Player
                          </label>
                          {teamPropFilter !== 'ALL' && (
                            <button
                              type="button"
                              onClick={() => setTeamPropFilter('ALL')}
                              className="text-[9px] font-black text-amber-400 hover:underline uppercase"
                            >
                              Reset Filter
                            </button>
                          )}
                        </div>

                        {/* Quick Team Filter Bar */}
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 mb-1.5">
                          <button
                            type="button"
                            onClick={() => setTeamPropFilter('ALL')}
                            className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0 transition-all ${
                              teamPropFilter === 'ALL'
                                ? 'bg-amber-400 text-slate-950 font-black'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            All Teams
                          </button>
                          {uniqueTeams.map((t) => {
                            const active = teamPropFilter === t.abbreviation;
                            return (
                              <button
                                key={t.abbreviation}
                                type="button"
                                onClick={() => setTeamPropFilter(t.abbreviation)}
                                className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1 transition-all ${
                                  active
                                    ? 'bg-amber-400 text-slate-950 font-black'
                                    : t.isLive
                                    ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 hover:border-emerald-400'
                                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                                }`}
                              >
                                {t.isLive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                                {t.abbreviation}
                              </button>
                            );
                          })}
                        </div>

                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            value={playerSearch}
                            onChange={(e) => setPlayerSearch(e.target.value)}
                            placeholder="Type player, team, or nickname (e.g. Love, Packers, DAL, Lamb)..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 font-bold"
                          />
                        </div>

                        {/* Player Search Results Grid */}
                        <div className="grid grid-cols-2 gap-1.5 mt-2 max-h-36 overflow-y-auto pr-1">
                          {filteredPlayers.map((p) => {
                            const isSelected = selectedPlayer?.id === p.id;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setSelectedPlayer(p);
                                  setPlayerSearch(p.name);
                                }}
                                className={`p-1.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                                  isSelected
                                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                                }`}
                              >
                                <img
                                  src={p.headshot}
                                  alt={p.name}
                                  className="w-6 h-6 rounded-full object-cover bg-slate-900 border border-slate-700 shrink-0"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).src = p.team.logo;
                                  }}
                                />
                                <div className="min-w-0 flex-1">
                                  <span className="text-xs font-black block truncate">{p.name}</span>
                                  <span className="text-[9px] text-slate-400 font-bold block">
                                    {p.team.abbreviation} • {p.position}
                                  </span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Stat Type & Target Line (only for player_prop) */}
                      {selectedLegType === 'player_prop' && (
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                              Prop Stat Category
                            </label>
                            <div className="grid grid-cols-3 gap-1">
                              {STAT_OPTIONS.map((st) => (
                                <button
                                  key={st.id}
                                  type="button"
                                  onClick={() => setPropStat(st.id)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                                    propStat === st.id
                                      ? 'bg-cyan-500 text-slate-950'
                                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                                  }`}
                                >
                                  {st.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                Direction
                              </label>
                              <div className="grid grid-cols-2 gap-1">
                                <button
                                  type="button"
                                  onClick={() => setPropDirection('OVER')}
                                  className={`py-1 rounded-lg text-xs font-black uppercase ${
                                    propDirection === 'OVER'
                                      ? 'bg-emerald-500 text-slate-950'
                                      : 'bg-slate-950 text-slate-400 border border-slate-800'
                                  }`}
                                >
                                  OVER
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPropDirection('UNDER')}
                                  className={`py-1 rounded-lg text-xs font-black uppercase ${
                                    propDirection === 'UNDER'
                                      ? 'bg-rose-500 text-white'
                                      : 'bg-slate-950 text-slate-400 border border-slate-800'
                                  }`}
                                >
                                  UNDER
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                Target Line Number
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                value={propLine}
                                onChange={(e) => setPropLine(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1 text-xs text-white font-black focus:outline-none focus:border-amber-400"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-Form for Spread, Moneyline & Total */}
                {(selectedLegType === 'spread' ||
                  selectedLegType === 'moneyline' ||
                  selectedLegType === 'total') && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                          Select Game
                        </label>
                        <select
                          value={selectedGameId}
                          onChange={(e) => {
                            setSelectedGameId(e.target.value);
                            const g = availableGames.find((game) => game.id === e.target.value);
                            if (g) setSelectedTeamAbbr(g.awayTeam.abbreviation);
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-amber-400"
                        >
                          {availableGames.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.awayTeam.abbreviation} vs {g.homeTeam.abbreviation} ({g.status.shortDetail || 'Upcoming'})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Team selection for Spread and Moneyline */}
                      {(selectedLegType === 'spread' || selectedLegType === 'moneyline') && selectedGame && (
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                            Select Team
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {[selectedGame.awayTeam, selectedGame.homeTeam].map((tm) => {
                              const isPicked =
                                selectedTeamAbbr === tm.abbreviation ||
                                (!selectedTeamAbbr && tm.abbreviation === selectedGame.awayTeam.abbreviation);
                              return (
                                <button
                                  key={tm.abbreviation}
                                  type="button"
                                  onClick={() => setSelectedTeamAbbr(tm.abbreviation)}
                                  className={`p-1.5 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                                    isPicked
                                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                      : 'bg-slate-950 border-slate-800 text-slate-300'
                                  }`}
                                >
                                  <img src={tm.logo} alt={tm.abbreviation} className="w-5 h-5 object-contain" />
                                  <span className="text-xs font-black">{tm.abbreviation}</span>
                                </button>
                              );
                            })}
                          </div>

                          {selectedLegType === 'spread' && (
                            <div className="mt-2">
                              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                Spread Line (e.g. -3.5 or +4.5)
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                value={spreadValue}
                                onChange={(e) => setSpreadValue(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1 text-xs text-white font-black focus:outline-none focus:border-amber-400"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Total Points Over/Under */}
                      {selectedLegType === 'total' && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                            Game Total Points Line
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() => setTotalDirection('OVER')}
                                className={`py-1 rounded-lg text-xs font-black uppercase ${
                                  totalDirection === 'OVER'
                                    ? 'bg-emerald-500 text-slate-950'
                                    : 'bg-slate-950 text-slate-400 border border-slate-800'
                                }`}
                              >
                                OVER
                              </button>
                              <button
                                type="button"
                                onClick={() => setTotalDirection('UNDER')}
                                className={`py-1 rounded-lg text-xs font-black uppercase ${
                                  totalDirection === 'UNDER'
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-slate-950 text-slate-400 border border-slate-800'
                                }`}
                              >
                                UNDER
                              </button>
                            </div>
                            <input
                              type="number"
                              step="0.5"
                              value={totalLine}
                              onChange={(e) => setTotalLine(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1 text-xs text-white font-black focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddLeg}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase transition-all shadow flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Leg to Slip</span>
                  </button>
                </div>
              </div>

              {/* Legs added so far */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-300 uppercase">
                    Legs in this Slip ({legs.length})
                  </h4>
                  {legs.length > 0 && (
                    <span className="text-[10px] font-black text-amber-400">
                      {legs.length > 1 ? `${legs.length}-Leg Parlay` : 'Single Bet'}
                    </span>
                  )}
                </div>

                {legs.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">
                    No legs added yet. Choose a type above and click &quot;Add Leg to Slip&quot;.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {legs.map((leg, idx) => (
                      <div
                        key={leg.id}
                        className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-amber-400">#{idx + 1}</span>
                          <span className="text-xs font-bold text-white">{leg.description}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLeg(leg.id)}
                          className="text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Save Slip Button */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={legs.length === 0}
                  onClick={handleSaveSlip}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-xs uppercase shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all"
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
