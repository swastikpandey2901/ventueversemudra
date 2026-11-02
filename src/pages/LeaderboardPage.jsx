import { useEffect, useState } from 'react';
import { subscribeLeaderboard } from '../supabase/api';
import { useAuth } from '../context/AuthContext';
import MudraIcon from '../components/MudraIcon';
import UserDetailModal from '../components/UserDetailModal';

const medals = ['🥇', '🥈', '🥉'];

const LeaderboardPage = () => {
  const { user, userData } = useAuth();
  const [rawBoard, setRawBoard] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [adminFilter, setAdminFilter] = useState('all'); // 'all' | 'participants' | 'testers'
  const [selectedUserId, setSelectedUserId] = useState(null);

  const isAdmin = userData?.role === 'admin';
  const participantId = userData?.participantId || '';
  const isTester = participantId.startsWith('TRIAL') || userData?.type === 'tester';
  const isParticipant = !isAdmin && !isTester;

  useEffect(() => {
    const unsub = subscribeLeaderboard((data) => {
      setRawBoard(data || []);
      setLastUpdate(new Date());
    });
    return unsub;
  }, []);

  // Compute scoped board based on viewer role
  let displayBoard = [];
  if (isAdmin) {
    if (adminFilter === 'participants') {
      displayBoard = rawBoard.filter((e) => e.isOfficial);
    } else if (adminFilter === 'testers') {
      displayBoard = rawBoard.filter((e) => e.isTester);
    } else {
      displayBoard = rawBoard;
    }
  } else if (isTester) {
    // Testers see all participants and testers
    displayBoard = rawBoard.filter((e) => e.isOfficial || e.isTester);
  } else {
    // Official participants strictly see only fellow participants MUDRA001 - MUDRA200
    displayBoard = rawBoard.filter((e) => e.isOfficial);
  }

  const myEntry = user
    ? rawBoard.find((e) => e.uid === user.uid || e.uid === user.id)
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2 flex-wrap">
            Leaderboard
            {isParticipant && (
              <span className="text-xs font-mono font-normal bg-mudra-accent/20 text-mudra-accent border border-mudra-accent/30 px-2 py-0.5 rounded-full">
                Tournament: MUDRA001 – MUDRA200
              </span>
            )}
            {isTester && (
              <span className="text-xs font-mono font-normal bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                Tester Mode: All Accounts Visible
              </span>
            )}
            {isAdmin && (
              <span className="text-xs font-mono font-normal bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                God Admin Inspector Mode
              </span>
            )}
          </h1>
          <p className="text-mudra-muted text-xs mt-1">
            {isAdmin
              ? 'Click any user row to view their live portfolio, assets, and past trade history.'
              : isTester
              ? 'Showing combined standings of participants and testers for validation.'
              : 'Official live tournament rankings. Only verified competition participants are listed.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-mudra-muted font-mono">
            {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString('en-IN')}` : 'Loading...'}
          </span>
          <div className="text-mudra-gold text-2xl">🏆</div>
        </div>
      </div>

      {/* Admin Filter Controls */}
      {isAdmin && (
        <div className="flex items-center gap-2 mb-4 p-2 bg-mudra-card/80 border border-mudra-border rounded-xl">
          <span className="text-xs text-mudra-muted font-semibold px-2">Filter View:</span>
          <button
            onClick={() => setAdminFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              adminFilter === 'all'
                ? 'bg-mudra-accent text-white shadow'
                : 'text-mudra-muted hover:text-white hover:bg-mudra-surface'
            }`}
          >
            All Accounts ({rawBoard.length})
          </button>
          <button
            onClick={() => setAdminFilter('participants')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              adminFilter === 'participants'
                ? 'bg-emerald-500 text-white shadow'
                : 'text-mudra-muted hover:text-white hover:bg-mudra-surface'
            }`}
          >
            Participants Only ({rawBoard.filter((e) => e.isOfficial).length})
          </button>
          <button
            onClick={() => setAdminFilter('testers')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              adminFilter === 'testers'
                ? 'bg-amber-500 text-white shadow'
                : 'text-mudra-muted hover:text-white hover:bg-mudra-surface'
            }`}
          >
            Testers Only ({rawBoard.filter((e) => e.isTester).length})
          </button>
        </div>
      )}

      {/* Logged In User's Rank Card */}
      {myEntry && (
        <div className="card mb-6 border-mudra-accent/40 bg-mudra-accent/5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-mudra-accent font-semibold tracking-wider uppercase">
              {isAdmin
                ? 'Your Admin Portfolio'
                : isTester
                ? 'Your Tester Account Rank'
                : 'Your Official Tournament Rank'}
            </span>
            {isTester && (
              <span className="badge bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">
                Tester (Not Ranked in Official Participant Board)
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-white">
                #{isParticipant ? myEntry.officialRank || myEntry.rank : myEntry.rank}
              </span>
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  <span>{myEntry.name}</span>
                  <span className="text-xs font-mono text-mudra-muted">
                    ({myEntry.participantId || 'Trader'})
                  </span>
                </div>
                <div className="text-xs text-mudra-muted flex items-center gap-1 flex-wrap">
                  <span>Cash:</span>
                  <MudraIcon className="w-3 h-3" />
                  <span>{(myEntry.cash || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  <span>•</span>
                  <span>Holdings:</span>
                  <MudraIcon className="w-3 h-3" />
                  <span>{(myEntry.holdingsValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold font-mono text-white flex items-center justify-end gap-1">
                <MudraIcon className="w-4 h-4" />
                {(myEntry.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <div
                className={`text-xs font-mono flex items-center justify-end gap-0.5 ${
                  myEntry.totalValue >= 200000 ? 'text-mudra-green' : 'text-mudra-red'
                }`}
              >
                {myEntry.totalValue >= 200000 ? '+' : '-'}
                <MudraIcon className="w-3 h-3" />
                {Math.abs((myEntry.totalValue || 200000) - 200000).toLocaleString('en-IN', {
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Leaderboard Table */}
      <div className="card">
        {displayBoard.length === 0 ? (
          <div className="text-center py-12 text-mudra-muted">
            <div className="text-4xl mb-3">🏁</div>
            <p>No active accounts found in this category.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {displayBoard.map((entry, i) => {
              const isMe = user && (entry.uid === user.uid || entry.uid === user.id);
              const pnl = (entry.totalValue || 0) - 200000;
              const displayRank = isParticipant ? entry.officialRank || i + 1 : i + 1;

              return (
                <div
                  key={entry.uid}
                  onClick={() => {
                    if (isAdmin) setSelectedUserId(entry.uid);
                  }}
                  className={`flex items-center justify-between py-3 px-3 rounded-lg transition-all ${
                    isMe
                      ? 'bg-mudra-accent/10 border border-mudra-accent/30'
                      : 'hover:bg-mudra-card/70'
                  } ${
                    isAdmin
                      ? 'cursor-pointer hover:border-l-4 hover:border-l-mudra-accent hover:pl-4'
                      : ''
                  }`}
                  title={isAdmin ? 'Click to inspect full holdings & trade logs' : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl w-8 text-center shrink-0">
                      {displayRank <= 3 && isParticipant ? (
                        medals[displayRank - 1]
                      ) : (
                        <span className="text-mudra-muted font-mono text-sm">#{displayRank}</span>
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate flex items-center gap-1.5 flex-wrap">
                        <span>{entry.name}</span>
                        {isMe && <span className="text-mudra-accent text-xs">(you)</span>}
                        {/* Tags for testers or admin views */}
                        {!isParticipant && (
                          <span
                            className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded font-bold ${
                              entry.isAdmin
                                ? 'bg-purple-500/20 text-purple-300'
                                : entry.isTester
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {entry.isAdmin ? 'Admin' : entry.isTester ? 'Tester' : 'Participant'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-mudra-muted flex items-center gap-2">
                        {entry.participantId && <span className="font-mono">{entry.participantId}</span>}
                        {isAdmin && (
                          <span className="text-[11px] text-mudra-accent hover:underline flex items-center gap-0.5">
                            🔍 Inspect
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-bold font-mono text-white flex items-center justify-end gap-1">
                      <MudraIcon className="w-3.5 h-3.5" />
                      {(entry.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <div
                      className={`text-xs font-mono flex items-center justify-end gap-0.5 ${
                        pnl >= 0 ? 'text-mudra-green' : 'text-mudra-red'
                      }`}
                    >
                      {pnl >= 0 ? '+' : '-'}
                      <MudraIcon className="w-3 h-3" />
                      {Math.abs(pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Admin Deep-Dive User Inspector Modal */}
      {isAdmin && selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
};

export default LeaderboardPage;
