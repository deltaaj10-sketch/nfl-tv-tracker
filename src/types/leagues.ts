export interface SyncedLeagueConfig {
  id: string; // unique identifier in localStorage
  type: 'sleeper' | 'espn';
  name: string; // user label, e.g. "Frat League", "Home League"
  leagueId: string;
  season?: string; // default "2026"
  week?: number;
  swid?: string; // for private ESPN leagues
  espn_s2?: string; // for private ESPN leagues
}

export interface GuestTagConfig {
  id: string;
  guestName: string; // e.g. "Alex", "Nick"
  teamName?: string; // e.g. "Alex's Squad"
  players: Array<{
    id?: string;
    name: string;
    position?: string;
    team?: string;
  }>;
}

export interface PlayerOwnerTag {
  ownerName: string;
  teamName: string;
  leagueName: string;
  leagueType: 'sleeper' | 'espn' | 'guest';
  isStarter?: boolean;
}

export interface LeagueMatchupTeam {
  teamId: string | number;
  ownerName: string;
  teamName: string;
  points: number;
  projected?: number;
  logo?: string;
}

export interface ParsedLeagueMatchup {
  id: string | number;
  leagueName: string;
  leagueType: 'sleeper' | 'espn' | 'guest';
  team1: LeagueMatchupTeam;
  team2: LeagueMatchupTeam;
}

export interface RoomFriendLeaderboard {
  name: string;
  teamName?: string;
  totalPoints: number;
  leaguesCount: number;
  leagues: string[];
  rosteredPlayers: Array<{
    name: string;
    points: number;
    team: string;
    position: string;
  }>;
}
