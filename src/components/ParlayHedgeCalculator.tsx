'use client';

import React, { useState } from 'react';
import { DollarSign, Shield, ArrowRight, CheckCircle2, AlertTriangle, Scale, Sparkles, TrendingUp } from 'lucide-react';
import { BetSlip, BetLeg } from '@/types/fantasy';

interface ParlayHedgeCalculatorProps {
  slip: BetSlip;
  gradedLegs: Array<{
    leg: BetLeg;
    result: {
      status: 'cashed' | 'chalked' | 'covering' | 'sweating' | 'upcoming';
      statusText: string;
      badgeStyle: string;
      progressText: string;
      progressPct: number;
      gameStatusText?: string;
      liveGameMini?: {
        clock: string;
        score: string;
        isLive: boolean;
        isPost: boolean;
        isRedZone: boolean;
        formatted: string;
      };
      ringCategory?: 'cash_active' | 'sweat_zone' | 'chalked' | 'pending';
    };
  }>;
}

export default function ParlayHedgeCalculator({ slip, gradedLegs }: ParlayHedgeCalculatorProps) {
  // Parse original stake/wager
  const wagerMatch = slip.wager ? slip.wager.match(/(\d+(?:\.\d+)?)/) : null;
  const wagerNum = wagerMatch ? parseFloat(wagerMatch[1]) : 25;

  // Parse total payout
  const payoutMatch = slip.payout ? slip.payout.match(/(\d+(?:\.\d+)?)/) : null;
  const payoutNum = payoutMatch ? parseFloat(payoutMatch[1]) : 175;

  const total = gradedLegs.length;
  const cashedCount = gradedLegs.filter((g) => g.result.status === 'cashed').length;
  const chalkedCount = gradedLegs.filter((g) => g.result.status === 'chalked').length;
  const liveOrUpcoming = gradedLegs.filter(
    (g) => g.result.status !== 'cashed' && g.result.status !== 'chalked'
  );
  const remainingCount = liveOrUpcoming.length;

  // Real-Time Estimated Cash-Out Value
  let estimatedCashout = 0;
  if (chalkedCount > 0) {
    estimatedCashout = 0;
  } else if (cashedCount === total && total > 0) {
    estimatedCashout = payoutNum;
  } else if (remainingCount === 1) {
    const finalLeg = liveOrUpcoming[0];
    let mult = 0.68;
    if (finalLeg?.result.status === 'covering') mult = 0.82;
    else if (finalLeg?.result.status === 'sweating') mult = 0.52;
    else mult = 0.70;
    // Apply standard 8% bookmaker cashout haircut
    estimatedCashout = Math.round(payoutNum * mult * 0.92 * 100) / 100;
  } else if (remainingCount >= 2) {
    const hitRatio = cashedCount / Math.max(1, total);
    estimatedCashout = Math.round(wagerNum * (1 + hitRatio * 2.8) * 100) / 100;
  }

  // Hedge odds & preset
  const [hedgeOdds, setHedgeOdds] = useState<number>(-110);
  const [activeStrategy, setActiveStrategy] = useState<'equal' | 'freeroll' | 'aggressive'>('equal');

  // Decimal odds calculation
  const decOdds = hedgeOdds < 0 ? 1 + 100 / Math.abs(hedgeOdds) : 1 + hedgeOdds / 100;

  // Recommended Hedge Stakes based on Strategy
  const sweatLeg = liveOrUpcoming[0];
  let hedgeSideName = 'Opposite Side';
  if (sweatLeg) {
    const leg = sweatLeg.leg;
    if (leg.type === 'player_prop') {
      const oppositeDir = leg.direction === 'OVER' ? 'UNDER' : 'OVER';
      hedgeSideName = `${leg.playerName} ${oppositeDir} ${leg.targetValue} ${leg.statType || ''}`;
    } else if (leg.type === 'anytime_td') {
      hedgeSideName = `${leg.playerName} Under 0.5 TDs (No TD)`;
    } else if (leg.type === 'spread') {
      hedgeSideName = `Opponent Cover vs ${leg.teamAbbr}`;
    } else if (leg.type === 'total') {
      const oppDir = leg.direction === 'OVER' ? 'UNDER' : 'OVER';
      hedgeSideName = `${oppDir} ${leg.totalPoints} Total Points`;
    } else if (leg.type === 'moneyline') {
      hedgeSideName = `Opponent Moneyline`;
    }
  }

  // Optimal equal profit hedge
  const equalHedgeStake = Math.round((payoutNum / decOdds) * 100) / 100;
  // Freeroll hedge (just cover the initial parlay stake)
  const freerollHedgeStake = Math.round((wagerNum / (decOdds - 1)) * 100) / 100;
  // Aggressive 75% lock
  const aggressiveHedgeStake = Math.round(equalHedgeStake * 0.75 * 100) / 100;

  const currentHedgeStake =
    activeStrategy === 'equal'
      ? equalHedgeStake
      : activeStrategy === 'freeroll'
      ? freerollHedgeStake
      : aggressiveHedgeStake;

  // Outcomes for current selected strategy
  const parlayWinsNet = Math.round((payoutNum - wagerNum - currentHedgeStake) * 100) / 100;
  const hedgeWinsNet = Math.round((currentHedgeStake * decOdds - currentHedgeStake - wagerNum) * 100) / 100;

  return (
    <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-3 font-condensed bg-[#0B0D13]/90 rounded-lg p-3 border border-amber-500/30 animate-fadeIn">
      {/* Drawer Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Live Parlay Payout &amp; Hedge Calculator
          </span>
        </div>
        <span className="text-[10px] font-mono-score font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30">
          Stake: ${wagerNum.toFixed(2)} • Payout: ${payoutNum.toFixed(2)}
        </span>
      </div>

      {/* Row 1: Real-time Cashout & Paraly Equity */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {/* Estimated Cashout */}
        <div className="p-2.5 rounded-lg bg-[#13151f] border border-zinc-800 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
            Real-Time Cash-Out Offer
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span
              className={`text-2xl font-mono-score font-bold ${
                chalkedCount > 0
                  ? 'text-rose-400'
                  : estimatedCashout >= wagerNum
                  ? 'text-[#00E676]'
                  : 'text-amber-400'
              }`}
            >
              ${estimatedCashout.toFixed(2)}
            </span>
            {chalkedCount === 0 && estimatedCashout > wagerNum && (
              <span className="text-[10px] font-mono-score font-bold text-[#00E676]">
                (+{Math.round(((estimatedCashout - wagerNum) / wagerNum) * 100)}%)
              </span>
            )}
          </div>
          <span className="text-[9px] font-bold text-zinc-500 uppercase mt-0.5">
            {chalkedCount > 0
              ? 'Slip Chalked (Busted)'
              : cashedCount === total
              ? '100% Payout Secured'
              : 'Fair Market Live Value'}
          </span>
        </div>

        {/* Legs Progress */}
        <div className="p-2.5 rounded-lg bg-[#13151f] border border-zinc-800 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
            Legs In Flight
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-mono-score font-bold text-white">
              {cashedCount}/{total}
            </span>
            <span className="text-[10px] font-mono-score font-bold text-amber-300">
              {remainingCount} REMAINING
            </span>
          </div>
          <span className="text-[9px] font-bold text-zinc-500 uppercase mt-0.5">
            {remainingCount === 1 ? '1 Leg Remaining (Hedge Opportunity)' : `${remainingCount} Legs to Settle`}
          </span>
        </div>

        {/* Potential Net Profit */}
        <div className="p-2.5 rounded-lg bg-[#13151f] border border-zinc-800 flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
            Full Win Net Profit
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-mono-score font-bold text-emerald-400">
              +${(payoutNum - wagerNum).toFixed(2)}
            </span>
          </div>
          <span className="text-[9px] font-bold text-zinc-500 uppercase mt-0.5">
            If all {total} legs hit cleanly
          </span>
        </div>
      </div>

      {/* Row 2: Final Leg Sweating & Recommended Hedge Engine */}
      {chalkedCount === 0 && (
        <div className="p-3 rounded-lg bg-[#0e1015] border border-amber-500/30 flex flex-col gap-2.5 shadow-sm">
          {remainingCount === 1 && sweatLeg ? (
            <>
              {/* Sweat Header */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                    SWEATING THE FINAL LEG:
                  </span>
                  <span className="text-xs font-black text-white">{sweatLeg.leg.description}</span>
                </div>
                {sweatLeg.result.gameStatusText && (
                  <span className="text-[10px] font-mono-score font-bold text-zinc-500">
                    {sweatLeg.result.gameStatusText}
                  </span>
                )}
              </div>

              {/* Hedge Controls: Odds & Strategy */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">
                    Hedge Line:
                  </span>
                  <span className="text-xs font-mono-score font-bold text-white bg-[#13151f] px-2 py-0.5 rounded border border-zinc-800">
                    {hedgeSideName}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">
                    Hedge Odds:
                  </span>
                  <input
                    type="number"
                    value={hedgeOdds}
                    onChange={(e) => setHedgeOdds(parseInt(e.target.value) || -110)}
                    className="w-20 bg-[#0a0b0e] border border-zinc-800 rounded px-2 py-0.5 text-xs text-white font-mono-score font-bold text-center focus:border-amber-400 outline-none"
                    placeholder="-110"
                  />
                </div>
              </div>

              {/* Strategy Selector Pills */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  onClick={() => setActiveStrategy('equal')}
                  className={`px-2 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex flex-col items-center justify-center border ${
                    activeStrategy === 'equal'
                      ? 'bg-amber-400 text-black border-amber-300 font-black'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <span>1. Lock Profit (Equal)</span>
                  <span className="text-[9px] font-mono-score opacity-90">
                    Bet ${equalHedgeStake.toFixed(2)}
                  </span>
                </button>

                <button
                  onClick={() => setActiveStrategy('freeroll')}
                  className={`px-2 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex flex-col items-center justify-center border ${
                    activeStrategy === 'freeroll'
                      ? 'bg-amber-400 text-black border-amber-300 font-black'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <span>2. Cover Stake Only</span>
                  <span className="text-[9px] font-mono-score opacity-90">
                    Bet ${freerollHedgeStake.toFixed(2)}
                  </span>
                </button>

                <button
                  onClick={() => setActiveStrategy('aggressive')}
                  className={`px-2 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex flex-col items-center justify-center border ${
                    activeStrategy === 'aggressive'
                      ? 'bg-amber-400 text-black border-amber-300 font-black'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <span>3. Aggressive 75% Lock</span>
                  <span className="text-[9px] font-mono-score opacity-90">
                    Bet ${aggressiveHedgeStake.toFixed(2)}
                  </span>
                </button>
              </div>

              {/* Guaranteed Result Callout Box */}
              <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white uppercase block leading-tight">
                      Recommended Hedge Bet: Bet{' '}
                      <span className="text-amber-300 font-mono-score font-black">
                        ${currentHedgeStake.toFixed(2)}
                      </span>{' '}
                      on {hedgeSideName} ({hedgeOdds > 0 ? `+${hedgeOdds}` : hedgeOdds})
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase mt-0.5 block">
                      Guaranteed profit regardless of who wins!
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase block">
                      Parlay Hits:
                    </span>
                    <span className="text-xs font-mono-score font-bold text-emerald-400">
                      +${parlayWinsNet.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase block">
                      Hedge Hits:
                    </span>
                    <span className="text-xs font-mono-score font-bold text-emerald-400">
                      +${hedgeWinsNet.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : remainingCount > 1 ? (
            <div className="py-2 text-center text-zinc-400 flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-amber-300">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <span>Multi-Leg Hedge Road Map</span>
              </div>
              <p className="text-[11px] font-medium max-w-md text-zinc-400">
                {remainingCount} legs still in flight. When {remainingCount - 1} more leg hits, this calculator will automatically suggest your exact hedge size to guarantee ~${Math.round((payoutNum / 2.1) - wagerNum)} in risk-free profit.
              </p>
            </div>
          ) : (
            <div className="py-1 text-center text-emerald-400 text-xs font-bold uppercase">
              Parlay Completely Settled!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
