import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../supabase/auth';
import MudraIcon from '../components/MudraIcon';

const LoginPage = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await loginUser(identifier, password);
      // If admin, go to admin panel, otherwise market
      const rawId = identifier.trim().toLowerCase();
      if (['adarshgod', 'swastikgod', 'harshagodess'].includes(rawId)) {
        navigate('/admin');
      } else {
        navigate('/market');
      }
    } catch (err) {
      setError(err.message || 'Invalid Participant ID or Password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <MudraIcon className="w-14 h-14 drop-shadow-[0_0_15px_rgba(245,158,11,0.4)]" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            M<span className="text-mudra-accent">U</span>DRA <span className="text-mudra-gold">Trading Arena</span>
          </h1>
          <p className="text-mudra-muted text-xs mt-1.5">
            Official Competition Access — 30 Companies • 7 Days
          </p>
        </div>

        {/* Card */}
        <div className="card border-mudra-border/80 shadow-2xl shadow-mudra-accent/5 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-white block mb-1.5">
                Registration ID
              </label>
              <input
                id="registration_id"
                name="registration_id"
                type="text"
                className="input font-mono text-base"
                placeholder="e.g. MUDRA001, TRIAL001, or admin"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
                autoComplete="username"
              />
              <span className="text-[11px] text-mudra-muted mt-1 block">
                Enter your assigned registration ID (e.g. MUDRA001 / TRIAL001) or admin username
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-white">
                  Passcode / Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-xs text-mudra-accent hover:underline flex items-center gap-1 font-semibold"
                >
                  {showPassword ? '🙈 Hide' : '👁️ View Password'}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input font-mono text-base tracking-wider pr-12"
                  placeholder="Enter passcode"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mudra-muted hover:text-white p-1 text-base transition-colors"
                  title={showPassword ? 'Hide password' : 'View password'}
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-mudra-red text-xs bg-red-950/40 border border-red-500/30 rounded-xl p-3">
                ❌ {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-3.5 font-bold text-sm shadow-lg shadow-mudra-accent/25"
              disabled={loading}
            >
              {loading ? 'Authenticating & Loading Market...' : 'Enter Arena & Start Trading 🚀'}
            </button>
          </form>

          {/* Info Banner */}
          <div className="mt-6 pt-5 border-t border-mudra-border/50 text-center">
            <p className="text-[11px] text-mudra-muted">
              🔒 Closed tournament environment. Starting capital of <strong className="text-mudra-green">🪙2,00,000</strong> is automatically allocated upon initial sign-in.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
