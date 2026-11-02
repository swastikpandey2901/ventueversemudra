import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateUserName } from '../supabase/api';
import MudraIcon from './MudraIcon';

const NameSetupModal = () => {
  const { user, userData, refreshUserData } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const userId = user?.id || user?.uid;
  const currentName = userData?.name || '';
  const participantId = userData?.participantId || '';
  const role = userData?.role || '';

  useEffect(() => {
    if (!userId || !userData) return;

    // Only prompt participants and testers (admins keep their god titles)
    if (role === 'admin') return;

    // Check if dismissed in this browser session or previously marked
    const dismissed = localStorage.getItem(`mudra_name_dismissed_${userId}`);
    if (dismissed === 'true') return;

    // Check if user currently has default auto-assigned name
    // e.g. "Trader MUDRA001", "Tester TRIAL001", "Trader"
    const isDefault =
      !currentName ||
      /^Trader\s+(MUDRA\d+|Participant)?$/i.test(currentName) ||
      /^Tester\s+(TRIAL\d+)?$/i.test(currentName) ||
      currentName === participantId;

    if (isDefault) {
      setNewName('');
      setIsOpen(true);
    }
  }, [userId, userData, currentName, participantId, role]);

  const handleSave = async (e) => {
    e.preventDefault();
    const clean = newName.trim();
    if (!clean) {
      setError('Please enter your name.');
      return;
    }
    if (clean.length < 2) {
      setError('Name must be at least 2 characters long.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await updateUserName(userId, clean);
      await refreshUserData();
      localStorage.setItem(`mudra_name_dismissed_${userId}`, 'true');
      setIsOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to update name. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(`mudra_name_dismissed_${userId}`, 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-md border-mudra-accent/40 bg-mudra-surface/95 shadow-2xl p-6 sm:p-8 relative">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <MudraIcon className="w-12 h-12 drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-mudra-accent font-bold px-2 py-0.5 rounded bg-mudra-accent/10 border border-mudra-accent/20">
            Welcome to Mudra Trading Arena
          </span>
          <h2 className="text-2xl font-black text-white mt-2">
            Set Your Trader Name
          </h2>
          <p className="text-xs text-mudra-muted mt-1.5">
            Your registration ID is <strong className="text-white font-mono">{participantId || 'Trader'}</strong>. Enter the name you want displayed on the live leaderboard and portfolio:
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-white block mb-1.5">
              Full Name / Trader Alias
            </label>
            <input
              type="text"
              className="input font-semibold text-base"
              placeholder="e.g. Aarav Sharma or AlphaTrader"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              maxLength={40}
              required
            />
            <span className="text-[11px] text-mudra-muted mt-1 block">
              You can also edit this anytime later in your Portfolio.
            </span>
          </div>

          {error && (
            <div className="text-mudra-red text-xs bg-red-950/40 border border-red-500/30 rounded-lg p-2.5">
              ❌ {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSkip}
              className="btn-outline flex-1 py-2.5 text-xs font-bold text-mudra-muted hover:text-white"
              disabled={loading}
            >
              Skip for now
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 py-2.5 text-xs font-bold shadow-lg shadow-mudra-accent/20"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save & Enter 🚀'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NameSetupModal;
