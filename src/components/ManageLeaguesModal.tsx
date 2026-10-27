'use client';

import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Users,
  Sparkles,
  RefreshCw,
  Search,
  Check,
  AlertCircle,
} from 'lucide-react';
import { SyncedLeagueConfig, GuestTagConfig } from '@/types/leagues';

interface ManageLeaguesModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncedLeagues: SyncedLeagueConfig[];
  onUpdateLeagues: (leagues: SyncedLeagueConfig[]) => void;
  guestTags: GuestTagConfig[];
  onUpdateGuests: (guests: GuestTagConfig[]) => void;
  availablePlayers: Array<{ id: string; name: string; position: string; team: string }>;
  currentWeek: number;
}

export default function ManageLeaguesModal({
  isOpen,
  onClose,
  syncedLeagues,
  onUpdateLeagues,
  guestTags,
  onUpdateGuests,
  availablePlayers,
  currentWeek,
}: ManageLeaguesModalProps) {
  const [activeTab, setActiveTab] = useState<'sleeper' | 'espn' | 'guests'>('sleeper');

  // Sleeper Form State
  const [sleeperId, setSleeperId] = useState('');
  const [sleeperName, setSleeperName] = useState('');
  const sleeperWeek = String(currentWeek || 6);
  const [sleeperLoading, setSleeperLoading] = useState(false);
  const [sleeperError, setSleeperError] = useState<string | null>(null);

  // ESPN Form State
  const [espnId, setEspnId] = useState('');
  const [espnName, setEspnName] = useState('');
  const espnSeason = '2026';
  const espnWeek = String(currentWeek || 6);
  const [espnSwid, setEspnSwid] = useState('');
  const [espnS2, setEspnS2] = useState('');
  const [espnLoading, setEspnLoading] = useState(false);
  const [espnError, setEspnError] = useState<string | null>(null);

  // Guest Tag Form State
  const [guestName, setGuestName] = useState('');
  const [guestTeamName, setGuestTeamName] = useState('');
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuestPlayers, setSelectedGuestPlayers] = useState<
    Array<{ id?: string; name: string; position?: string; team?: string }>
  >([]);

  if (!isOpen) return null;

  // Handle Add Sleeper League
  const handleAddSleeper = async () => {
    if (!sleeperId.trim()) return;
    setSleeperLoading(true);
    setSleeperError(null);

    try {
      const res = await fetch(`/api/sleeper-league?leagueId=${sleeperId.trim()}&week=${sleeperWeek}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      const newLeague: SyncedLeagueConfig = {
        id: `sleeper-${sleeperId.trim()}-${Date.now()}`,
        type: 'sleeper',
        name: sleeperName.trim() || json.name || `Sleeper League ${sleeperId.trim()}`,
        leagueId: sleeperId.trim(),
        week: parseInt(sleeperWeek) || 6,
      };

      onUpdateLeagues([...syncedLeagues, newLeague]);
      setSleeperId('');
      setSleeperName('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect Sleeper league. Verify the League ID.';
      setSleeperError(message);
    } finally {
      setSleeperLoading(false);
    }
  };

  // Handle Add ESPN League
  const handleAddEspn = async () => {
    if (!espnId.trim()) return;
    setEspnLoading(true);
    setEspnError(null);

    try {
      let url = `/api/espn-league?leagueId=${espnId.trim()}&season=${espnSeason}&week=${espnWeek}`;
      if (espnSwid.trim()) url += `&swid=${encodeURIComponent(espnSwid.trim())}`;
      if (espnS2.trim()) url += `&espn_s2=${encodeURIComponent(espnS2.trim())}`;

      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      const newLeague: SyncedLeagueConfig = {
        id: `espn-${espnId.trim()}-${Date.now()}`,
        type: 'espn',
        name: espnName.trim() || json.name || `ESPN League ${espnId.trim()}`,
        leagueId: espnId.trim(),
        season: espnSeason,
        week: parseInt(espnWeek) || 6,
        swid: espnSwid.trim() || undefined,
        espn_s2: espnS2.trim() || undefined,
      };

      onUpdateLeagues([...syncedLeagues, newLeague]);
      setEspnId('');
      setEspnName('');
      setEspnSwid('');
      setEspnS2('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect ESPN league.';
      setEspnError(message);
    } finally {
      setEspnLoading(false);
    }
  };

  // Handle Add Guest
  const handleAddGuest = () => {
    if (!guestName.trim()) return;

    const newGuest: GuestTagConfig = {
      id: `guest-${Date.now()}`,
      guestName: guestName.trim(),
      teamName: guestTeamName.trim() || `${guestName.trim()}'s Squad`,
      players: selectedGuestPlayers,
    };

    onUpdateGuests([...guestTags, newGuest]);
    setGuestName('');
    setGuestTeamName('');
    setSelectedGuestPlayers([]);
    setGuestSearch('');
  };

  // Load Demo Living Room Preset
  const handleLoadDemo = () => {
    const demoGuests: GuestTagConfig[] = [
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
          { name: 'Ka\'imi Fairbairn', position: 'K', team: 'HOU' },
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

    onUpdateGuests(demoGuests);
  };

  // Filtered available players for guest tagging autocomplete
  const filteredPlayers = guestSearch.trim()
    ? availablePlayers
        .filter(
          (p) =>
            p.name.toLowerCase().includes(guestSearch.trim().toLowerCase()) ||
            p.team.toLowerCase().includes(guestSearch.trim().toLowerCase()) ||
            p.position.toLowerCase().includes(guestSearch.trim().toLowerCase())
        )
        .slice(0, 30)
    : availablePlayers.slice(0, 20);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0e1422] border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-black uppercase text-white tracking-wide">
              Manage Leagues & Living Room Guests
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex items-center bg-slate-950 px-6 border-b border-slate-800 gap-2">
          <button
            onClick={() => setActiveTab('sleeper')}
            className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'sleeper'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Sleeper Leagues ({syncedLeagues.filter((l) => l.type === 'sleeper').length})
          </button>

          <button
            onClick={() => setActiveTab('espn')}
            className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'espn'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ESPN Fantasy ({syncedLeagues.filter((l) => l.type === 'espn').length})
          </button>

          <button
            onClick={() => setActiveTab('guests')}
            className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'guests'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Living Room Friends ({guestTags.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: SLEEPER LEAGUE SYNC */}
          {activeTab === 'sleeper' && (
            <div className="space-y-5">
              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-400" />
                  Connect Sleeper League
                </h3>
                <p className="text-xs text-slate-400">
                  Enter your public or private Sleeper League ID. Sleeper IDs can be found in your browser URL:
                  <code className="ml-1 text-emerald-400 font-mono">sleeper.com/leagues/[LEAGUE_ID]</code>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                      Sleeper League ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 112345678901234567"
                      value={sleeperId}
                      onChange={(e) => setSleeperId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                      Custom Label
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Frat League"
                      value={sleeperName}
                      onChange={(e) => setSleeperName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                {sleeperError && (
                  <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-800">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{sleeperError}</span>
                  </div>
                )}

                <button
                  onClick={handleAddSleeper}
                  disabled={sleeperLoading || !sleeperId.trim()}
                  className="w-full py-2.5 rounded-[4px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-emerald-400/50"
                >
                  {sleeperLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Connect & Sync Sleeper League</span>
                </button>
              </div>

              {/* Connected Sleeper Leagues List */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Connected Sleeper Leagues ({syncedLeagues.filter((l) => l.type === 'sleeper').length})
                </h4>

                {syncedLeagues.filter((l) => l.type === 'sleeper').length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No Sleeper leagues connected yet.</p>
                ) : (
                  syncedLeagues
                    .filter((l) => l.type === 'sleeper')
                    .map((league) => (
                      <div
                        key={league.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-emerald-400 bg-emerald-950/70 border border-emerald-500/40 px-2 py-0.5 rounded">
                              SLEEPER
                            </span>
                            <span className="text-sm font-bold text-white">{league.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">ID: {league.leagueId}</p>
                        </div>

                        <button
                          onClick={() => onUpdateLeagues(syncedLeagues.filter((l) => l.id !== league.id))}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 transition-colors"
                          title="Remove League"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ESPN FANTASY SYNC */}
          {activeTab === 'espn' && (
            <div className="space-y-5">
              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
                  <Plus className="w-4 h-4 text-cyan-400" />
                  Connect ESPN Fantasy League
                </h3>
                <p className="text-xs text-slate-400">
                  Enter your ESPN League ID from your browser URL:
                  <code className="ml-1 text-cyan-400 font-mono">
                    fantasy.espn.com/football/league?leagueId=[LEAGUE_ID]
                  </code>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                      ESPN League ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 12345678"
                      value={espnId}
                      onChange={(e) => setEspnId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                      Custom Label
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Home League"
                      value={espnName}
                      onChange={(e) => setEspnName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                {/* Optional SWID / espn_s2 for private ESPN leagues */}
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <span className="text-[11px] font-black text-slate-300 uppercase tracking-wide block">
                    Optional: Private ESPN League Credentials
                  </span>
                  <p className="text-[11px] text-slate-500">
                    If your ESPN league is set to private, enter your cookies from browser Developer Tools:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="SWID (e.g. {ABCD-1234-...})"
                      value={espnSwid}
                      onChange={(e) => setEspnSwid(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                    />
                    <input
                      type="password"
                      placeholder="espn_s2 cookie string"
                      value={espnS2}
                      onChange={(e) => setEspnS2(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                    />
                  </div>
                </div>

                {espnError && (
                  <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-800">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{espnError}</span>
                  </div>
                )}

                <button
                  onClick={handleAddEspn}
                  disabled={espnLoading || !espnId.trim()}
                  className="w-full py-2.5 rounded-[4px] bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-cyan-400/50"
                >
                  {espnLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Connect & Sync ESPN League</span>
                </button>
              </div>

              {/* Connected ESPN Leagues List */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Connected ESPN Leagues ({syncedLeagues.filter((l) => l.type === 'espn').length})
                </h4>

                {syncedLeagues.filter((l) => l.type === 'espn').length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No ESPN leagues connected yet.</p>
                ) : (
                  syncedLeagues
                    .filter((l) => l.type === 'espn')
                    .map((league) => (
                      <div
                        key={league.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-cyan-400 bg-cyan-950/70 border border-cyan-500/40 px-2 py-0.5 rounded">
                              ESPN
                            </span>
                            <span className="text-sm font-bold text-white">{league.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">ID: {league.leagueId}</p>
                        </div>

                        <button
                          onClick={() => onUpdateLeagues(syncedLeagues.filter((l) => l.id !== league.id))}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 transition-colors"
                          title="Remove League"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: QUICK GUEST TAGGING (UNIVERSAL) */}
          {activeTab === 'guests' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Tag friends in the living room and assign players from Yahoo, DraftKings, or any custom league.
                </p>
                <button
                  onClick={handleLoadDemo}
                  className="px-3 py-1.5 rounded-[4px] bg-amber-500/10 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-xs font-black uppercase flex items-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load Demo Preset (3 Friends)</span>
                </button>
              </div>

              {/* Add New Guest Form */}
              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-400" />
                  Tag a Friend in the Living Room
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                      Friend Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Alex"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                      Fantasy Team Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Alex's Squad"
                      value={guestTeamName}
                      onChange={(e) => setGuestTeamName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Selected Players for this guest */}
                {selectedGuestPlayers.length > 0 && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                      Assigned Players ({selectedGuestPlayers.length}):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedGuestPlayers.map((p) => (
                        <span
                          key={p.name}
                          className="px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center gap-1.5"
                        >
                          <span>{p.name}</span>
                          <span className="text-[10px] text-amber-400/80">({p.position || p.team})</span>
                          <button
                            onClick={() =>
                              setSelectedGuestPlayers(
                                selectedGuestPlayers.filter((item) => item.name !== p.name)
                              )
                            }
                            className="hover:text-white"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Player Autocomplete / Search */}
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                    Search & Add Players to Roster
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Type player name (e.g. Caleb Williams, Bijan Robinson)..."
                      value={guestSearch}
                      onChange={(e) => setGuestSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && guestSearch.trim()) {
                          const existing = selectedGuestPlayers.find(
                            (p) => p.name.toLowerCase() === guestSearch.trim().toLowerCase()
                          );
                          if (!existing) {
                            setSelectedGuestPlayers([
                              ...selectedGuestPlayers,
                              { name: guestSearch.trim() },
                            ]);
                          }
                          setGuestSearch('');
                        }
                      }}
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* Quick-add chips from live active players */}
                  <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto">
                    {filteredPlayers.map((p) => {
                      const isSelected = selectedGuestPlayers.some(
                        (item) => item.name.toLowerCase() === p.name.toLowerCase()
                      );
                      return (
                        <button
                          key={p.id || p.name}
                          type="button"
                          onClick={() => {
                            if (!isSelected) {
                              setSelectedGuestPlayers([...selectedGuestPlayers, p]);
                            } else {
                              setSelectedGuestPlayers(
                                selectedGuestPlayers.filter(
                                  (item) => item.name.toLowerCase() !== p.name.toLowerCase()
                                )
                              );
                            }
                          }}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                            isSelected
                              ? 'bg-amber-400 text-slate-950 font-black'
                              : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          + {p.name} ({p.position})
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={handleAddGuest}
                  disabled={!guestName.trim()}
                  className="w-full py-2.5 rounded-[4px] bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-amber-400/50"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Friend to Living Room</span>
                </button>
              </div>

              {/* Tagged Friends List */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Tagged Friends in Room ({guestTags.length})
                </h4>

                {guestTags.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No friends tagged yet.</p>
                ) : (
                  guestTags.map((guest) => (
                    <div
                      key={guest.id}
                      className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white">{guest.guestName}</span>
                          <span className="text-xs font-bold text-amber-400">({guest.teamName})</span>
                        </div>

                        <button
                          onClick={() => onUpdateGuests(guestTags.filter((g) => g.id !== guest.id))}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 transition-colors"
                          title="Remove Friend"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {guest.players.length === 0 ? (
                          <span className="text-[11px] text-slate-500">No players assigned yet</span>
                        ) : (
                          guest.players.map((p) => (
                            <span
                              key={p.name}
                              className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-medium"
                            >
                              {p.name}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            All leagues & guests are automatically saved to your TV browser storage.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-colors"
          >
            Close & View on TV
          </button>
        </div>
      </div>
    </div>
  );
}
