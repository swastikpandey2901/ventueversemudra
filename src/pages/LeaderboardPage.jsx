import { useEffect, useState } from 'react';
import { subscribeLeaderboard, isOfficialParticipant } from '../supabase/api';
import { useAuth } from '../context/AuthContext';
import MudraIcon from '../components/MudraIcon';

const medals = ['🥇', '🥈', '🥉'];

const LeaderboardPage = () => {
  const { user, userData } = useAuth();
  const [board, setBoard] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    const unsub = subscribeLeaderboard(data => {
      // Defense-in-depth: Ensure strictly official participants MUDRA001 - MUDRA200
      const filtered = (data || []).filter(e => isOfficialParticipant(e.participantId, e.name, e.email));
      setBoard(filtered);
      setLastUpdate(new Date());
    });
    return unsub;
  }, []);

  const myEntry = user ? board.find(e => e.uid === user.uid || e.uid === user.id) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Leaderboard
            <span className="text-xs font-mono font-normal bg-mudra-accent/20 text-mudra-accent border border-mudra-accent/30 px-2 py-0.5 rounded-full">
              MUDRA001 – MUDRA200
            </span>
          </h1>
          <p className="text-mudra-muted text-sm mt-0.5">
            {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString('en-IN')}` : 'Loading...'}
          </p>
        </div>
        <div className="text-mudra-gold text-2xl">🏆</div>
      </div>

      {/* Official Participant Rank */}
      {myEntry && (
        <div className="card mb-6 border-mudra-accent/40 bg-mudra-accent/5">
          <div className="text-xs text-mudra-accent mb-1 font-semibold">YOUR OFFICIAL RANK</div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-white">#{myEntry.rank}</span>
              <div>
                <div className="font-semibold text-white">{myEntry.name}</div>
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
              <div className={`text-xs font-mono flex items-center justify-end gap-0.5 ${
                myEntry.totalValue >= 200000 ? 'text-mudra-green' : 'text-mudra-red'
              }`}>
                {myEntry.totalValue >= 200000 ? '+' : '-'}
                <MudraIcon className="w-3 h-3" />
                {Math.abs((myEntry.totalValue || 200000) - 200000).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tester or Admin Notice */}
      {user && !myEntry && (
        <div className="card mb-6 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧪</span>
              <div>
                <div className="text-xs text-mudra-gold font-bold uppercase tracking-wider">
                  {userData?.role === 'admin' ? 'Admin Observer' : 'Tester / Trial Account'}
                </div>
                <div className="text-sm font-semibold text-white">
                  {userData?.name || userData?.participantId || user.email}
                </div>
                <p className="text-xs text-mudra-muted mt-0.5">
                  Official tournament leaderboard strictly ranks participants <strong>MUDRA001–MUDRA200</strong>. Tester & Admin portfolios are excluded from competition rankings.
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-block px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Unranked
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Full Board */}
      <div className="card">
        {board.length === 0 ? (
          <div className="text-center py-12 text-mudra-muted">
            <div className="text-4xl mb-3">🏁</div>
            <p>No participants yet. Be the first!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {board.map((entry, i) => {
              const isMe = user && (entry.uid === user.uid || entry.uid === user.id);
              const pnl = (entry.totalValue || 0) - 200000;
              return (
                <div
                  key={entry.uid}
                  className={`flex items-center justify-between py-3 px-3 rounded-lg transition-colors ${
                    isMe ? 'bg-mudra-accent/10 border border-mudra-accent/30' : 'hover:bg-mudra-bg/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl w-8 text-center shrink-0">
                      {i < 3 ? medals[i] : <span className="text-mudra-muted font-mono text-sm">#{i + 1}</span>}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {entry.name}
                        {isMe && <span className="text-mudra-accent text-xs ml-2">(you)</span>}
                      </div>
                      {entry.participantId && (
                        <div className="text-xs text-mudra-muted">{entry.participantId}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold font-mono text-white flex items-center justify-end gap-1">
                      <MudraIcon className="w-3.5 h-3.5" />
                      {(entry.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <div className={`text-xs font-mono flex items-center justify-end gap-0.5 ${pnl >= 0 ? 'text-mudra-green' : 'text-mudra-red'}`}>
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
    </div>
  );
};

export default LeaderboardPage;
