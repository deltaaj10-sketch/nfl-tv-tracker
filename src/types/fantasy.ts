export type FantasyPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

export type ScoringFormat = 'ppr' | 'halfPpr' | 'standard';

export interface FantasyPoints {
  ppr: number;
  halfPpr: number;
  standard: number;
}

export interface PlayerStats {
  // Passing
  passingYards?: number;
  passingTouchdowns?: number;
  interceptions?: number;
  completions?: number;
  passingAttempts?: number;
  // Rushing
  rushingYards?: number;
  rushingTouchdowns?: number;
  rushingAttempts?: number;
  // Receiving
  receptions?: number;
  receivingYards?: number;
  receivingTouchdowns?: number;
  receivingTargets?: number;
  // Fumbles
  fumblesLost?: number;
  // Kicking
  fgMade?: number;
  fgAttempts?: number;
  xpMade?: number;
  xpAttempts?: number;
  longFg?: number;
  // Defense
  pointsAllowed?: number;
  sacks?: number;
  defensiveInterceptions?: number;
  fumblesRecovered?: number;
  defensiveTouchdowns?: number;
  safeties?: number;
}

export interface FantasyPlayer {
  id: string;
  name: string;
  shortName: string;
  position: FantasyPosition;
  headshot: string;
  isGameLive?: boolean;
  isLive?: boolean;
  team: {
    id: string;
    abbreviation: string;
    displayName: string;
    logo: string;
    color?: string;
  };
  opponent: {
    abbreviation: string;
    isHome: boolean;
  };
  gameStatus: {
    state: 'pre' | 'in' | 'post';
    clock: string;
    period: number;
    detail: string;
    isRedZone: boolean;
    isGameLive?: boolean;
    isLive?: boolean;
  };
  rawStatLine: string;
  stats: PlayerStats;
  points: FantasyPoints;
  playerRawStats?: PlayerRawNumericStats;
}

export interface PlayerRawNumericStats {
  passYds: number;
  passTD: number;
  rushYds: number;
  rushTD: number;
  rec: number;
  recYds: number;
  recTD: number;
  anytimeTD: boolean; // rushTD + recTD > 0
}

export interface GameTeam {
  id: string;
  name: string;
  abbreviation: string;
  displayName: string;
  logo: string;
  color: string;
  score: number;
  record: string;
  timeoutsLeft?: number;
}

export interface GameSituation {
  isRedZone: boolean;
  possessionTeamId: string | null;
  possessionTeamAbbr: string | null;
  possessionText?: string | null;
  downDistanceText: string | null;
  yardLine: number | null;
  down: number | null;
  distance: number | null;
  lastPlay: string | null;
}

export interface LiveGame {
  id: string;
  name: string;
  shortName: string;
  possessionTeamId?: string | null;
  possessionTeamAbbr?: string | null;
  possessionText?: string | null;
  yardLine?: number | null;
  isRedZone?: boolean;
  status: {
    state: 'pre' | 'in' | 'post';
    detail: string;
    shortDetail: string;
    period: number;
    displayClock: string;
    completed: boolean;
  };
  awayTeam: GameTeam;
  homeTeam: GameTeam;
  situation: GameSituation;
  broadcast: string;
  odds?: string;
}

export interface LiveUpdate {
  id: string;
  type: 'touchdown' | 'field-goal' | 'turnover' | 'big-play' | 'safety';
  headline: string;
  description: string;
  fantasyImpact: string;
  gameClock: string;
  timestamp: string;
  isGameLive?: boolean;
  downDistanceText?: string | null;
  possessionTeamAbbr?: string | null;
  possessionText?: string | null;
  team: {
    id?: string;
    abbreviation: string;
    logo: string;
    color?: string;
  };
  gameName: string;
  scoreSummary: string;
}

export interface LiveFantasyResponse {
  lastUpdated: string;
  season?: {
    year: number;
    week: number;
    type: number;
  };
  games: LiveGame[];
  leaderboards: Record<FantasyPosition, FantasyPlayer[]>;
  liveUpdates: LiveUpdate[];
  allPlayers?: FantasyPlayer[];
}

// Bets & Parlays Data Models
export type BetLegType = 'player_prop' | 'anytime_td' | 'spread' | 'moneyline' | 'total';
export type PropStatType = 'passYds' | 'passTD' | 'rushYds' | 'recYds' | 'rec' | 'rushRecYds';

export interface BetLeg {
  id: string;
  type: BetLegType;
  description: string;
  // For player prop & anytime TD:
  playerId?: string;
  playerName?: string;
  playerHeadshot?: string;
  playerTeam?: string;
  statType?: PropStatType;
  targetValue?: number;
  direction?: 'OVER' | 'UNDER';
  // For game spread, moneyline, total:
  gameId?: string;
  teamAbbr?: string;
  spread?: number; // e.g. -3.5 or +4.5
  totalPoints?: number; // e.g. 47.5
}

export interface BetSlip {
  id: string;
  title: string;
  ownerName?: string;
  wager?: string;
  payout?: string;
  createdAt: number;
  legs: BetLeg[];
}

