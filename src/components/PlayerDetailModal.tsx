'use client';

import React, { useEffect } from 'react';
import { X, Zap, Activity, Shield, Crosshair } from 'lucide-react';
import { FantasyPlayer, LiveUpdate, ScoringFormat } from '@/types/fantasy';

interface PlayerDetailModalProps {
  player: FantasyPlayer | null;
  scoringFormat: ScoringFormat;
  liveUpdates?: LiveUpdate[];
  onClose: () => void;
}

/**
 * Clean and highlight play description with bold yardage, touchdowns, and player names
 */
function renderCleanPlayDescription(raw: string): React.ReactNode {
  if (!raw) return null;
  const cleaned = raw.replace(/\((?:No Huddle, Shotgun|Shotgun, No Huddle|Shotgun|No Huddle)\)\s*/gi, '').trim();
  const regex = /(\b[A-Z]\.[A-Za-z'-]+\b|\b\d+ yards?\b|TOUCHDOWN)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      parts.push(cleaned.slice(lastIndex, match.index));
    }
    const val = match[0];
    if (val === 'TOUCHDOWN') {
      parts.push(
        <span key={`td-${keyIdx++}`} className="font-extrabold text-emerald-400 tracking-wide">
          TOUCHDOWN
        </span>
      );
    } else if (/\b\d+ yards?\b/.test(val)) {
      parts.push(
        <span key={`yd-${keyIdx++}`} className="font-bold text-amber-300 font-mono-score">
          {val}
        </span>
      );
    } else {
      parts.push(
        <span key={`p-${keyIdx++}`} className="font-bold text-white">
          {val}
        </span>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < cleaned.length) {
    parts.push(cleaned.slice(lastIndex));
  }
  return parts;
}

/**
 * Match a play update to a specific player
 */
function playMatchesPlayer(play: LiveUpdate, player: FantasyPlayer): boolean {
  const text = (play.headline + ' ' + play.description + ' ' + (play.fantasyImpact || '')).toLowerCase();
  const fullName = player.name.toLowerCase();
  if (text.includes(fullName)) return true;

  // Check abbreviated format: "F.LastName", e.g. "J.Ferguson" or "A.St. Brown"
  const nameParts = player.name.split(' ');
  if (nameParts.length >= 2) {
    const firstInitial = nameParts[0][0].toLowerCase();
    const lastName = nameParts.slice(1).join(' ').toLowerCase();
    const shortFormat = `${firstInitial}.${lastName}`;
    if (text.includes(shortFormat)) return true;

    // Check last name if play involves player's team
    const isPlayerTeamInPlay =
      play.team?.abbreviation?.toUpperCase() === player.team.abbreviation.toUpperCase() ||
      play.gameName?.toUpperCase().includes(player.team.abbreviation.toUpperCase());

    if (isPlayerTeamInPlay && lastName.length >= 4 && text.includes(lastName)) {
      return true;
    }
  }

  // If defense, match team abbreviation
  if (player.position === 'DEF') {
    if (play.team?.abbreviation?.toUpperCase() === player.team.abbreviation.toUpperCase()) {
      return true;
    }
  }

  return false;
}

export default function PlayerDetailModal({
  player,
  scoringFormat,
  liveUpdates = [],
  onClose,
}: PlayerDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!player) return null;

  const s = player.stats || {};
  const isPost = player.gameStatus.state === 'post' || player.gameStatus.detail?.toLowerCase().includes('final');
  const isStaleInjury = isPost && (player.injuryStatus === 'Questionable' || player.injuryStatus === 'Doubtful');
  const showInjuryBadge = Boolean(player.injuryStatus && player.injuryStatus !== 'NA' && !isStaleInjury);

  // Filter player-specific play logs
  const playerPlays = liveUpdates.filter((p) => playMatchesPlayer(p, player));

  // Compute stat ratios
  const ypc =
    (s.rushingAttempts || 0) > 0
      ? ((s.rushingYards || 0) / (s.rushingAttempts || 1)).toFixed(1)
      : null;
  const ypr =
    (s.receptions || 0) > 0
      ? ((s.receivingYards || 0) / (s.receptions || 1)).toFixed(1)
      : null;
  const catchPct =
    (s.receivingTargets || 0) > 0
      ? Math.round(((s.receptions || 0) / (s.receivingTargets || 1)) * 100)
      : null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#0e1015] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] font-condensed animate-fadeIn"
      >
        {/* Modal Header */}
        <div className="relative bg-[#0a0b0e] px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            {/* Headshot & Unclipped Team Logo Badge */}
            <div className="relative w-14 h-14 md:w-16 md:h-16 shrink-0">
              <div className="w-full h-full rounded-full overflow-hidden bg-[#0a0b0e] border border-zinc-800 shadow-md">
                <img
                  src={player.headshot}
                  alt={player.name}
                  className={`w-full h-full ${
                    player.position === 'DEF' ? 'object-contain p-2 team-logo-contrast' : 'object-cover'
                  }`}
                  style={
                    player.position === 'DEF'
                      ? { filter: 'drop-shadow(0 0 3px rgba(255, 255, 255, 0.5))' }
                      : undefined
                  }
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = player.team.logo;
                  }}
                />
              </div>
              {player.position !== 'DEF' && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zinc-900 ring-1 ring-zinc-700 p-0.5 z-20 flex items-center justify-center shadow-lg">
                  <img
                    src={player.team.logo}
                    alt={player.team.abbreviation}
                    className="w-full h-full object-contain team-logo-contrast"
                    style={{ filter: 'drop-shadow(0 0 2.5px rgba(255, 255, 255, 0.45))' }}
                  />
                </div>
              )}
            </div>

            {/* Player Info */}
            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-white font-mono-score text-xs font-bold uppercase tracking-wider">
                  {player.position}
                </span>
                {player.jersey && (
                  <span className="text-xs font-mono-score font-semibold text-zinc-500">
                    #{player.jersey}
                  </span>
                )}
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                  {player.team.abbreviation} vs {player.opponent.abbreviation}
                </span>
                {showInjuryBadge && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                      player.injuryStatus === 'Out' || player.injuryStatus === 'IR' || player.injuryStatus === 'PUP'
                        ? 'bg-red-600 text-white border border-red-500 shadow-sm'
                        : player.injuryStatus === 'Doubtful'
                        ? 'bg-orange-600 text-white border border-orange-500'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {player.injuryStatus === 'Questionable'
                      ? 'Q'
                      : player.injuryStatus === 'Doubtful'
                      ? 'D'
                      : player.injuryStatus?.toUpperCase()}
                  </span>
                )}
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight truncate mt-0.5">
                {player.name}
              </h2>
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 mt-0.5">
                <span
                  className={
                    player.isGameLive || player.gameStatus.state === 'in'
                      ? 'text-amber-400 font-bold inline-flex items-center gap-1.5'
                      : player.isProjection
                      ? 'text-cyan-400 font-bold'
                      : 'text-zinc-400'
                  }
                >
                  {(player.isGameLive || player.gameStatus.state === 'in') && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                  )}
                  {player.isProjection
                    ? 'PROJECTION'
                    : player.gameStatus.detail || (player.isGameLive ? 'Live' : 'Final')}
                </span>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 bg-[#0e1015]">
          {/* Scoring Format Comparison Banner */}
          <div className="grid grid-cols-3 gap-3">
            <div
              className={`p-3 rounded-lg flex flex-col items-center justify-center border transition-all ${
                scoringFormat === 'ppr'
                  ? 'bg-emerald-950/30 border-emerald-500/80 ring-1 ring-emerald-500/40'
                  : 'bg-[#13151f] border-zinc-800'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                PPR
              </span>
              <span className="text-2xl md:text-3xl font-mono-score font-bold text-white mt-0.5">
                {player.points.ppr.toFixed(1)}
              </span>
              <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-500">
                PTS
              </span>
            </div>

            <div
              className={`p-3 rounded-lg flex flex-col items-center justify-center border transition-all ${
                scoringFormat === 'halfPpr'
                  ? 'bg-emerald-950/30 border-emerald-500/80 ring-1 ring-emerald-500/40'
                  : 'bg-[#13151f] border-zinc-800'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                0.5彙 PPR
              </span>
              <span className="text-2xl md:text-3xl font-mono-score font-bold text-white mt-0.5">
                {player.points.halfPpr.toFixed(1)}
              </span>
              <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-500">
                PTS
              </span>
            </div>

            <div
              className={`p-3 rounded-lg flex flex-col items-center justify-center border transition-all ${
                scoringFormat === 'standard'
                  ? 'bg-emerald-950/30 border-emerald-500/80 ring-1 ring-emerald-500/40'
                  : 'bg-[#13151f] border-zinc-800'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                STANDARD
              </span>
              <span className="text-2xl md:text-3xl font-mono-score font-bold text-white mt-0.5">
                {player.points.standard.toFixed(1)}
              </span>
              <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-500">
                PTS
              </span>
            </div>
          </div>

          {/* Full Stat Line Breakdown */}
          <div className="bg-[#13151f] rounded-lg border border-zinc-800 p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-800">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                STAT BREAKDOWN
              </h3>
            </div>

            {/* Position-Specific Stat Cards */}
            {player.position === 'DEF' ? (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">PTS ALLOW</span>
                  <p className="text-lg font-mono-score font-bold text-white mt-0.5">{s.pointsAllowed ?? 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">SACKS</span>
                  <p className="text-lg font-mono-score font-bold text-emerald-400 mt-0.5">{s.sacks ?? 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">INT</span>
                  <p className="text-lg font-mono-score font-bold text-emerald-400 mt-0.5">{s.defensiveInterceptions ?? 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">FUM REC</span>
                  <p className="text-lg font-mono-score font-bold text-emerald-400 mt-0.5">{s.fumblesRecovered ?? 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">DEF TD</span>
                  <p className="text-lg font-mono-score font-bold text-emerald-400 mt-0.5">{s.defensiveTouchdowns ?? 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">SAFETY</span>
                  <p className="text-lg font-mono-score font-bold text-emerald-400 mt-0.5">{s.safeties ?? 0}</p>
                </div>
              </div>
            ) : player.position === 'K' ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">FG MADE / ATT</span>
                  <p className="text-lg font-mono-score font-bold text-white mt-0.5">
                    {s.fgMade || 0} / {s.fgAttempts || 0}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">LONG FG</span>
                  <p className="text-lg font-mono-score font-bold text-amber-300 mt-0.5">{s.longFg || 0} YDS</p>
                </div>
                <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">XP MADE / ATT</span>
                  <p className="text-lg font-mono-score font-bold text-white mt-0.5">
                    {s.xpMade || 0} / {s.xpAttempts || 0}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">TOTAL PTS</span>
                  <p className="text-lg font-mono-score font-bold text-emerald-400 mt-0.5">
                    {player.points.standard.toFixed(1)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Passing Section */}
                {((s.passingAttempts || 0) > 0 || (s.passingYards || 0) > 0) && (
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      PASSING
                    </span>
                    <div className="grid grid-cols-4 gap-2 text-center mt-1">
                      <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold">COMP / ATT</span>
                        <p className="text-base font-mono-score font-bold text-white mt-0.5">
                          {s.completions || 0} / {s.passingAttempts || 0}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold">YARDS</span>
                        <p className="text-base font-mono-score font-bold text-amber-300 mt-0.5">
                          {s.passingYards || 0}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold">TOUCHDOWNS</span>
                        <p className="text-base font-mono-score font-bold text-emerald-400 mt-0.5">
                          {s.passingTouchdowns || 0}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold">INTERCEPTIONS</span>
                        <p className="text-base font-mono-score font-bold text-rose-400 mt-0.5">
                          {s.interceptions || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rushing Section */}
                {((s.rushingAttempts || 0) > 0 || (s.rushingYards || 0) !== 0) && (
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      RUSHING
                    </span>
                    <div className="grid grid-cols-4 gap-2 text-center mt-1">
                      <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold">CARRIES</span>
                        <p className="text-base font-mono-score font-bold text-white mt-0.5">
                          {s.rushingAttempts || 0}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold">YARDS</span>
                        <p className="text-base font-mono-score font-bold text-amber-300 mt-0.5">
                          {s.rushingYards || 0}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold">AVG YPC</span>
                        <p className="text-base font-mono-score font-bold text-white mt-0.5">
                          {ypc ?? '--'}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold">TOUCHDOWNS</span>
                        <p className="text-base font-mono-score font-bold text-emerald-400 mt-0.5">
                          {s.rushingTouchdowns || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Receiving Section */}
                {((s.receptions || 0) > 0 || (s.receivingYards || 0) !== 0 || (s.receivingTargets || 0) > 0) && (
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      RECEIVING
                    </span>
                    <div className="grid grid-cols-5 gap-2 text-center mt-1">
                      <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold">REC / TGT</span>
                        <p className="text-base font-mono-score font-bold text-white mt-0.5">
                          {s.receptions || 0} / {s.receivingTargets || 0}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold">CATCH %</span>
                        <p className="text-base font-mono-score font-bold text-white mt-0.5">
                          {catchPct !== null ? `${catchPct}%` : '--'}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold">YARDS</span>
                        <p className="text-base font-mono-score font-bold text-amber-300 mt-0.5">
                          {s.receivingYards || 0}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold">AVG YPR</span>
                        <p className="text-base font-mono-score font-bold text-white mt-0.5">
                          {ypr ?? '--'}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0e1015] border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold">TOUCHDOWNS</span>
                        <p className="text-base font-mono-score font-bold text-emerald-400 mt-0.5">
                          {s.receivingTouchdowns || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Turnovers Section */}
                {(s.fumblesLost || 0) > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                      TURNOVERS
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-center mt-1">
                      <div className="p-2 rounded-lg bg-[#0e1015] border border-rose-500/20">
                        <span className="text-[10px] text-rose-400 uppercase font-semibold">FUMBLES LOST</span>
                        <p className="text-base font-mono-score font-bold text-rose-400 mt-0.5">
                          {s.fumblesLost || 0}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0e1015] border border-rose-500/20">
                        <span className="text-[10px] text-rose-400 uppercase font-semibold">POINTS LOST</span>
                        <p className="text-base font-mono-score font-bold text-rose-400 mt-0.5">
                          -{((s.fumblesLost || 0) * 2).toFixed(1)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chronological Play Log */}
          <div className="bg-[#13151f] rounded-lg border border-zinc-800 p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  PLAY LOG ({playerPlays.length})
                </h3>
              </div>
              <span className="text-[10px] uppercase font-semibold text-zinc-500">
                SCORING &amp; BIG PLAYS
              </span>
            </div>

            {playerPlays.length === 0 ? (
              <div className="py-6 text-center text-zinc-500 text-xs">
                No scoring plays or big plays logged yet for {player.name} in this slate.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                {playerPlays.map((play, pIdx) => {
                  const isTD = play.type === 'touchdown';
                  const isFG = play.type === 'field-goal';
                  const isTO = play.type === 'turnover';
                  return (
                    <div
                      key={`play-${play.id || pIdx}`}
                      className={`p-2.5 rounded-lg border text-xs transition-colors ${
                        isTD
                          ? 'bg-emerald-950/30 border-emerald-500/40 text-zinc-200'
                          : isTO
                          ? 'bg-rose-950/30 border-rose-500/40 text-zinc-200'
                          : isFG
                          ? 'bg-amber-950/30 border-amber-500/40 text-zinc-200'
                          : 'bg-[#0e1015] border-zinc-800 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono-score font-bold uppercase ${
                              isTD
                                ? 'bg-emerald-500 text-black font-extrabold'
                                : isTO
                                ? 'bg-rose-500 text-white font-extrabold'
                                : isFG
                                ? 'bg-amber-400 text-black font-extrabold'
                                : 'bg-zinc-800 text-zinc-300'
                            }`}
                          >
                            {play.type.toUpperCase()}
                          </span>
                          <span className="text-[10px] font-bold text-zinc-500">
                            {play.gameClock}
                          </span>
                        </div>
                        {play.fantasyImpact && (
                          <span className="text-[10px] font-mono-score font-bold text-emerald-400">
                            {play.fantasyImpact}
                          </span>
                        )}
                      </div>
                      <p className="leading-snug">
                        {renderCleanPlayDescription(play.description)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
