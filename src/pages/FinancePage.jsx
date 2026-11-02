import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import MudraIcon from '../components/MudraIcon';
import MiniChart from '../components/MiniChart';
import {
  getUserSavings,
  subscribeSavings,
  depositSavings,
  withdrawSavings,
  getCommodities,
  subscribeCommodities,
  getUserCommodityHoldings,
  subscribeCommodityHoldings,
  tradeCommodity,
  getMutualFunds,
  subscribeMutualFunds,
  getUserMFHoldings,
  subscribeMFHoldings,
  tradeMutualFund,
} from '../supabase/api';

const DURATION_OPTIONS = [
  { days: 1, rate: 0.03, label: '1 Day (Flash Lock)', returnPct: '+3%' },
  { days: 3, rate: 0.05, label: '3 Days (Standard)', returnPct: '+5%' },
  { days: 7, rate: 0.10, label: '7 Days (Full Event)', returnPct: '+10%' },
];

const FinancePage = () => {
  const { user, userData, refreshUserData } = useAuth();
  const [activeTab, setActiveTab] = useState('savings'); // savings | commodities | mutual_funds

  // ── Savings State ──
  const [savingsList, setSavingsList] = useState([]);
  const [depAmount, setDepAmount] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(DURATION_OPTIONS[1]);
  const [savingsLoading, setSavingsLoading] = useState(false);
  const [savingsMsg, setSavingsMsg] = useState('');

  // ── Commodities State ──
  const [commodities, setCommodities] = useState([]);
  const [comHoldings, setComHoldings] = useState([]);
  const [comModal, setComModal] = useState(null); // { commodity, type: 'buy' | 'sell' }
  const [comQty, setComQty] = useState('');
  const [comLoading, setComLoading] = useState(false);
  const [comMsg, setComMsg] = useState('');

  // ── Mutual Funds State ──
  const [mutualFunds, setMutualFunds] = useState([]);
  const [mfHoldings, setMfHoldings] = useState([]);
  const [mfModal, setMfModal] = useState(null); // { fund, type: 'invest' | 'redeem' }
  const [mfInputVal, setMfInputVal] = useState('');
  const [mfLoading, setMfLoading] = useState(false);
  const [mfMsg, setMfMsg] = useState('');

  const userId = user?.id || user?.uid;

  // Real-time Subscriptions
  useEffect(() => {
    if (!userId) return;

    const u1 = subscribeSavings(userId, setSavingsList);
    const u2 = subscribeCommodities(setCommodities);
    const u3 = subscribeCommodityHoldings(userId, setComHoldings);
    const u4 = subscribeMutualFunds(setMutualFunds);
    const u5 = subscribeMFHoldings(userId, setMfHoldings);

    return () => {
      u1?.();
      u2?.();
      u3?.();
      u4?.();
      u5?.();
    };
  }, [userId]);

  // ─── SAVINGS HANDLERS ─────────────────────────────────────────────────────
  const handleDeposit = async () => {
    const amt = parseFloat(depAmount);
    if (isNaN(amt) || amt <= 0) {
      return setSavingsMsg('❌ Please enter a valid deposit amount');
    }
    if (amt > (userData?.cash || 0)) {
      return setSavingsMsg('❌ Insufficient Mudra Coins in your wallet');
    }

    setSavingsLoading(true);
    setSavingsMsg('');
    try {
      await depositSavings({
        userId,
        amount: amt,
        durationDays: selectedDuration.days,
        rate: selectedDuration.rate,
      });
      setSavingsMsg(`✅ Successfully locked 🪙${amt.toLocaleString('en-IN')} for ${selectedDuration.days} days!`);
      setDepAmount('');
      await refreshUserData();
    } catch (err) {
      setSavingsMsg(`❌ ${err.message}`);
    } finally {
      setSavingsLoading(false);
    }
  };

  const handleWithdraw = async (savingsId) => {
    setSavingsLoading(true);
    setSavingsMsg('');
    try {
      const payout = await withdrawSavings({ userId, savingsId });
      setSavingsMsg(`🎉 Claimed 🪙${payout.toLocaleString('en-IN', { maximumFractionDigits: 0 })} back to your cash!`);
      await refreshUserData();
    } catch (err) {
      setSavingsMsg(`❌ ${err.message}`);
    } finally {
      setSavingsLoading(false);
    }
  };

  // ─── COMMODITY HANDLERS ───────────────────────────────────────────────────
  const handleTradeCommodity = async () => {
    if (!comModal || !comQty) return;
    const qty = parseFloat(comQty);
    if (isNaN(qty) || qty <= 0) return setComMsg('❌ Invalid quantity in grams');

    setComLoading(true);
    setComMsg('');
    try {
      await tradeCommodity({
        userId,
        userName: userData?.name || 'Trader',
        symbol: comModal.commodity.symbol,
        type: comModal.type,
        quantity: qty,
        price: comModal.commodity.currentPrice,
      });
      setComMsg(`✅ Successfully ${comModal.type === 'buy' ? 'bought' : 'sold'} ${qty}g of ${comModal.commodity.name}!`);
      setComQty('');
      await refreshUserData();
      setTimeout(() => setComModal(null), 1500);
    } catch (err) {
      setComMsg(`❌ ${err.message}`);
    } finally {
      setComLoading(false);
    }
  };

  // ─── MUTUAL FUND HANDLERS ─────────────────────────────────────────────────
  const handleTradeMF = async () => {
    if (!mfModal || !mfInputVal) return;
    const val = parseFloat(mfInputVal);
    if (isNaN(val) || val <= 0) return setMfMsg('❌ Invalid value entered');

    setMfLoading(true);
    setMfMsg('');
    try {
      await tradeMutualFund({
        userId,
        userName: userData?.name || 'Trader',
        fundId: mfModal.fund.id,
        type: mfModal.type,
        amount: val,
        nav: mfModal.fund.nav,
      });
      setMfMsg(
        `✅ ${
          mfModal.type === 'invest'
            ? `Invested 🪙${val.toLocaleString('en-IN')} in ${mfModal.fund.name}!`
            : `Redeemed ${val} units of ${mfModal.fund.name}!`
        }`
      );
      setMfInputVal('');
      await refreshUserData();
      setTimeout(() => setMfModal(null), 1500);
    } catch (err) {
      setMfMsg(`❌ ${err.message}`);
    } finally {
      setMfLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-2">
            🏦 <span className="text-mudra-gold">Finance Hub</span>
          </h1>
          <p className="text-mudra-muted text-sm mt-1">
            Diversify beyond stocks — Guaranteed Savings, Gold & Silver commodities, and Managed Mutual Funds.
          </p>
        </div>

        {/* User Balance Chip */}
        <div className="card flex items-center gap-3 py-2 px-4 self-start md:self-auto border-mudra-accent/30 bg-mudra-accent/5">
          <div className="text-xs text-mudra-muted">Available Cash:</div>
          <div className="text-lg font-bold font-mono text-mudra-green flex items-center gap-1">
            <MudraIcon className="w-4 h-4" />
            {Number(userData?.cash || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-mudra-border pb-4 mb-8 overflow-x-auto">
        <button
          onClick={() => setActiveTab('savings')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
            activeTab === 'savings'
              ? 'bg-mudra-accent text-white shadow-lg shadow-mudra-accent/25'
              : 'bg-mudra-card border border-mudra-border text-mudra-muted hover:text-white'
          }`}
        >
          🔒 Savings Account
        </button>
        <button
          onClick={() => setActiveTab('commodities')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
            activeTab === 'commodities'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25'
              : 'bg-mudra-card border border-mudra-border text-mudra-muted hover:text-white'
          }`}
        >
          🪙 Gold & Silver
        </button>
        <button
          onClick={() => setActiveTab('mutual_funds')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
            activeTab === 'mutual_funds'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
              : 'bg-mudra-card border border-mudra-border text-mudra-muted hover:text-white'
          }`}
        >
          📈 Mutual Funds
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: SAVINGS ACCOUNT */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'savings' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-mudra-card border border-blue-500/20 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="badge-gold text-xs uppercase tracking-wider mb-2 inline-block">Zero Market Risk</span>
                <h2 className="text-xl font-bold text-white">Mudra Fixed Term Deposit</h2>
                <p className="text-sm text-mudra-muted mt-1 max-w-2xl">
                  Protect your principal! Lock your Mudra Coins safely for a fixed duration to earn up to <span className="text-mudra-green font-bold">+10% guaranteed returns</span> upon maturity.
                </p>
              </div>
              <div className="flex gap-4 text-center">
                <div className="bg-mudra-bg/80 border border-mudra-border px-4 py-2 rounded-xl">
                  <div className="text-xs text-mudra-muted">Active Locked</div>
                  <div className="text-lg font-bold font-mono text-white flex items-center justify-center gap-1 mt-0.5">
                    <MudraIcon className="w-4 h-4" />
                    {savingsList
                      .filter((s) => s.status === 'active' || s.status === 'matured')
                      .reduce((sum, s) => sum + s.amount, 0)
                      .toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Deposit Form */}
            <div className="lg:col-span-2 card space-y-5 h-fit">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                📥 Open New Deposit
              </h3>

              {/* Duration Options */}
              <div>
                <label className="text-xs text-mudra-muted block mb-2 font-medium">Select Lock-in Period</label>
                <div className="grid grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.days}
                      onClick={() => setSelectedDuration(opt)}
                      className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                        selectedDuration.days === opt.days
                          ? 'border-mudra-accent bg-mudra-accent/15 text-white'
                          : 'border-mudra-border bg-mudra-bg text-mudra-muted hover:text-white'
                      }`}
                    >
                      <span className="text-xs font-semibold">{opt.days} Day{opt.days > 1 ? 's' : ''}</span>
                      <span className="text-sm font-bold text-mudra-green font-mono mt-1">{opt.returnPct}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <div className="flex justify-between text-xs text-mudra-muted mb-1">
                  <span>Deposit Amount</span>
                  <span>Max: 🪙{Number(userData?.cash || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="100"
                    placeholder="Enter amount (e.g. 20000)"
                    value={depAmount}
                    onChange={(e) => setDepAmount(e.target.value)}
                    className="input text-lg font-mono pl-4 pr-16"
                  />
                  <button
                    onClick={() => setDepAmount(String(Math.floor(Number(userData?.cash || 0))))}
                    className="absolute right-2 top-2 text-xs bg-mudra-border hover:bg-mudra-accent text-white px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    MAX
                  </button>
                </div>
                <div className="flex gap-2 mt-2">
                  {[0.25, 0.5, 0.75].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setDepAmount(String(Math.floor(Number(userData?.cash || 0) * pct)))}
                      className="text-xs text-mudra-muted hover:text-mudra-accent bg-mudra-bg border border-mudra-border px-2 py-1 rounded"
                    >
                      {pct * 100}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Return Preview */}
              {parseFloat(depAmount) > 0 && (
                <div className="bg-mudra-bg border border-mudra-border/60 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-mudra-muted">Locked Principal:</span>
                    <span className="font-mono text-white">
                      🪙{parseFloat(depAmount).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-mudra-muted">Guaranteed Return ({selectedDuration.returnPct}):</span>
                    <span className="font-mono text-mudra-green font-bold">
                      +🪙{(parseFloat(depAmount) * selectedDuration.rate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="border-t border-mudra-border/40 pt-2 flex justify-between font-semibold">
                    <span className="text-white">Total Payout on Maturity:</span>
                    <span className="font-mono text-mudra-gold text-sm font-bold">
                      🪙{(parseFloat(depAmount) * (1 + selectedDuration.rate)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              )}

              {savingsMsg && (
                <div
                  className={`text-xs p-3 rounded-xl border ${
                    savingsMsg.startsWith('✅') || savingsMsg.startsWith('🎉')
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                      : 'bg-red-950/40 border-red-500/30 text-red-400'
                  }`}
                >
                  {savingsMsg}
                </div>
              )}

              <button
                onClick={handleDeposit}
                disabled={savingsLoading || !parseFloat(depAmount)}
                className="btn-primary w-full py-3.5 font-bold shadow-lg shadow-mudra-accent/20"
              >
                {savingsLoading ? 'Locking Deposit...' : 'Lock Coins in Savings 🔒'}
              </button>
            </div>

            {/* Existing Deposits List */}
            <div className="lg:col-span-3 card">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
                <span>📋 Your Term Deposits</span>
                <span className="text-xs text-mudra-muted font-normal">
                  Total Active: {savingsList.filter((s) => s.status !== 'withdrawn').length}
                </span>
              </h3>

              {savingsList.length === 0 ? (
                <div className="text-center py-16 text-mudra-muted">
                  <div className="text-4xl mb-3">🏦</div>
                  <p className="font-medium text-white">No active deposits</p>
                  <p className="text-xs text-mudra-muted mt-1 max-w-sm mx-auto">
                    Lock some of your Mudra Coins on the left to start earning guaranteed interest!
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {savingsList.map((dep) => {
                    const isMatured = dep.status === 'matured' || Date.now() >= new Date(dep.maturesAt).getTime();
                    const isWithdrawn = dep.status === 'withdrawn';
                    const diffMs = new Date(dep.maturesAt).getTime() - Date.now();
                    const hoursLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));

                    return (
                      <div
                        key={dep.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isWithdrawn
                            ? 'bg-mudra-bg/40 border-mudra-border/40 opacity-60'
                            : isMatured
                            ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                            : 'bg-mudra-bg/80 border-mudra-border'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white text-base">
                                🪙{dep.amount.toLocaleString('en-IN')}
                              </span>
                              <span className="text-xs font-semibold text-mudra-green bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                                +{(dep.rate * 100).toFixed(0)}% Interest
                              </span>
                            </div>
                            <div className="text-xs text-mudra-muted mt-1">
                              Locked on: {new Date(dep.depositedAt).toLocaleDateString('en-IN')} • Matures:{' '}
                              {new Date(dep.maturesAt).toLocaleDateString('en-IN')} (
                              {isWithdrawn
                                ? 'Withdrawn'
                                : isMatured
                                ? 'Matured!'
                                : `${hoursLeft}h remaining`}
                              )
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs text-mudra-muted">Payout Value</div>
                            <div className="font-mono font-bold text-mudra-gold text-base">
                              🪙{dep.payout.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </div>
                          </div>
                        </div>

                        {/* Action Bar */}
                        <div className="mt-3 pt-3 border-t border-mudra-border/40 flex items-center justify-between">
                          <div>
                            {isWithdrawn ? (
                              <span className="text-xs text-mudra-muted font-medium">✅ Already Withdrawn</span>
                            ) : isMatured ? (
                              <span className="text-xs text-emerald-400 font-semibold animate-pulse">
                                🎉 Matured & Ready for Payout!
                              </span>
                            ) : (
                              <span className="text-xs text-mudra-gold font-medium">
                                ⏳ Locked ({hoursLeft} hrs left)
                              </span>
                            )}
                          </div>

                          {!isWithdrawn && isMatured && (
                            <button
                              onClick={() => handleWithdraw(dep.id)}
                              disabled={savingsLoading}
                              className="btn-green text-xs px-4 py-1.5 font-bold shadow-md shadow-emerald-600/30"
                            >
                              Withdraw 🪙{dep.payout.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: GOLD & SILVER COMMODITIES */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'commodities' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-amber-950/40 via-yellow-950/20 to-mudra-card border border-amber-500/20 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="badge-gold text-xs uppercase tracking-wider mb-2 inline-block">Physical Asset Backing</span>
                <h2 className="text-xl font-bold text-white">Precious Metals (Gold & Silver)</h2>
                <p className="text-sm text-mudra-muted mt-1 max-w-2xl">
                  Steady, slow-growth assets that act as safe-haven hedges during market volatility. Prices update gently every 30 seconds.
                </p>
              </div>
            </div>
          </div>

          {/* Commodities Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {commodities.map((com) => {
              const holding = comHoldings.find((h) => h.symbol === com.symbol);
              const holdingQty = holding?.quantity || 0;
              const holdingAvg = holding?.avgPrice || 0;
              const currentValue = holdingQty * com.currentPrice;
              const costBasis = holdingQty * holdingAvg;
              const pnl = currentValue - costBasis;
              const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

              const change = com.previousPrice
                ? ((com.currentPrice - com.previousPrice) / com.previousPrice) * 100
                : 0;
              const isUp = change >= 0;

              return (
                <div
                  key={com.symbol}
                  className="card border-mudra-border hover:border-amber-500/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl p-2 bg-mudra-bg rounded-xl border border-mudra-border">
                          {com.symbol === 'GOLD' ? '🥇' : '🥈'}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">{com.name}</h3>
                          <span className="text-xs font-mono text-mudra-muted">{com.symbol} • Per Gram (1g)</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-black font-mono text-white flex items-center justify-end gap-1">
                          <MudraIcon className="w-5 h-5" />
                          {com.currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </div>
                        <div
                          className={`text-xs font-mono font-semibold ${
                            isUp ? 'text-mudra-green' : 'text-mudra-red'
                          }`}
                        >
                          {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    {/* Chart */}
                    <div className="h-16 mb-4">
                      <MiniChart data={com.priceHistory} isUp={isUp} />
                    </div>

                    {/* User Holdings Box */}
                    <div className="bg-mudra-bg border border-mudra-border/60 rounded-xl p-3.5 mb-5 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-mudra-muted">Your Holdings:</span>
                        <span className="font-mono font-bold text-white">
                          {holdingQty.toFixed(2)} grams
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-mudra-muted">Current Value:</span>
                        <span className="font-mono text-white">
                          🪙{currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      {holdingQty > 0 && (
                        <div className="flex justify-between border-t border-mudra-border/40 pt-1.5">
                          <span className="text-mudra-muted">Unrealized P&L:</span>
                          <span
                            className={`font-mono font-semibold ${
                              pnl >= 0 ? 'text-mudra-green' : 'text-mudra-red'
                            }`}
                          >
                            {pnl >= 0 ? '+' : ''}🪙{pnl.toFixed(0)} ({pnlPct.toFixed(2)}%)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Buy / Sell Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setComModal({ commodity: com, type: 'buy' });
                        setComQty('1');
                        setComMsg('');
                      }}
                      className="btn-green flex-1 py-2.5 font-bold text-sm"
                    >
                      Buy {com.symbol}
                    </button>
                    <button
                      onClick={() => {
                        setComModal({ commodity: com, type: 'sell' });
                        setComQty(String(holdingQty > 0 ? holdingQty : 1));
                        setComMsg('');
                      }}
                      disabled={holdingQty <= 0}
                      className="btn-red flex-1 py-2.5 font-bold text-sm disabled:opacity-40"
                    >
                      Sell {com.symbol}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: MUTUAL FUNDS */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'mutual_funds' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-emerald-950/40 via-teal-950/20 to-mudra-card border border-emerald-500/20 rounded-2xl p-6">
            <div>
              <span className="badge-green text-xs uppercase tracking-wider mb-2 inline-block">
                Professional Asset Management
              </span>
              <h2 className="text-xl font-bold text-white">Mudra Mutual Funds</h2>
              <p className="text-sm text-mudra-muted mt-1 max-w-2xl">
                Hands-off investing! Choose from 3 baskets that track high-growth stocks, balanced assets, or conservative debt instruments with steady NAV progression.
              </p>
            </div>
          </div>

          {/* Funds Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {mutualFunds.map((fund) => {
              const holding = mfHoldings.find((h) => h.fundId === fund.id);
              const units = holding?.units || 0;
              const currentValue = units * fund.nav;
              const costBasis = units * (holding?.avgNav || fund.nav);
              const pnl = currentValue - costBasis;
              const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

              const isUp = fund.nav >= fund.prevNav;

              return (
                <div
                  key={fund.id}
                  className="card border-mudra-border hover:border-emerald-500/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                            {fund.id}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-semibold ${
                              fund.risk === 'high'
                                ? 'bg-red-500/20 text-red-400'
                                : fund.risk === 'low'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}
                          >
                            {fund.risk.toUpperCase()} RISK
                          </span>
                        </div>
                        <h3 className="font-bold text-white text-base leading-snug">{fund.name}</h3>
                      </div>
                    </div>

                    <p className="text-xs text-mudra-muted mb-4 line-clamp-2">{fund.description}</p>

                    {/* NAV & Target Return */}
                    <div className="bg-mudra-bg border border-mudra-border/60 rounded-xl p-3 mb-4 flex justify-between items-center">
                      <div>
                        <div className="text-xs text-mudra-muted">Current NAV</div>
                        <div className="text-xl font-bold font-mono text-white flex items-center gap-1">
                          <MudraIcon className="w-4 h-4" />
                          {fund.nav.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-mudra-muted">Est. Daily Rate</div>
                        <div className="text-sm font-bold text-mudra-green font-mono">
                          +{(fund.dailyReturnRate * 100).toFixed(1)}% / day
                        </div>
                      </div>
                    </div>

                    {/* User Holdings */}
                    <div className="bg-mudra-bg/60 border border-mudra-border/40 rounded-xl p-3 mb-5 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-mudra-muted">Units Owned:</span>
                        <span className="font-mono font-bold text-white">{units.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-mudra-muted">Current Value:</span>
                        <span className="font-mono text-white">
                          🪙{currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      {units > 0 && (
                        <div className="flex justify-between border-t border-mudra-border/30 pt-1">
                          <span className="text-mudra-muted">Return:</span>
                          <span
                            className={`font-mono font-semibold ${
                              pnl >= 0 ? 'text-mudra-green' : 'text-mudra-red'
                            }`}
                          >
                            {pnl >= 0 ? '+' : ''}🪙{pnl.toFixed(0)} ({pnlPct.toFixed(1)}%)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setMfModal({ fund, type: 'invest' });
                        setMfInputVal('10000');
                        setMfMsg('');
                      }}
                      className="btn-green flex-1 py-2 text-xs font-bold"
                    >
                      Invest
                    </button>
                    <button
                      onClick={() => {
                        setMfModal({ fund, type: 'redeem' });
                        setMfInputVal(String(units > 0 ? units.toFixed(2) : 1));
                        setMfMsg('');
                      }}
                      disabled={units <= 0}
                      className="btn-outline flex-1 py-2 text-xs font-bold disabled:opacity-40"
                    >
                      Redeem
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* COMMODITY TRADE MODAL */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {comModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {comModal.type === 'buy' ? '🛒 Buy' : '💰 Sell'} {comModal.commodity.name}
              </h3>
              <button onClick={() => setComModal(null)} className="text-mudra-muted hover:text-white text-xl">
                ✕
              </button>
            </div>

            <div className="bg-mudra-bg p-3.5 rounded-xl border border-mudra-border mb-4 flex justify-between items-center text-sm">
              <span className="text-mudra-muted">Current Price per Gram</span>
              <span className="font-mono font-bold text-white flex items-center gap-1">
                <MudraIcon className="w-4 h-4" />
                {comModal.commodity.currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="mb-4">
              <label className="text-xs text-mudra-muted block mb-1">Quantity (in Grams)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={comQty}
                onChange={(e) => setComQty(e.target.value)}
                className="input font-mono text-lg"
                placeholder="e.g. 5"
              />
            </div>

            {parseFloat(comQty) > 0 && (
              <div className="bg-mudra-bg/80 p-3 rounded-xl border border-mudra-border/60 text-xs mb-4 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-mudra-muted">Total {comModal.type === 'buy' ? 'Cost' : 'Proceeds'}:</span>
                  <span className="font-mono font-bold text-white">
                    🪙{(parseFloat(comQty) * comModal.commodity.currentPrice).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-mudra-muted">Available Cash:</span>
                  <span className="font-mono text-mudra-green">
                    🪙{Number(userData?.cash || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}

            {comMsg && (
              <div
                className={`text-xs p-3 rounded-xl mb-4 ${
                  comMsg.startsWith('✅') ? 'bg-emerald-950/40 text-emerald-400' : 'bg-red-950/40 text-red-400'
                }`}
              >
                {comMsg}
              </div>
            )}

            <button
              onClick={handleTradeCommodity}
              disabled={comLoading || !parseFloat(comQty)}
              className={`w-full py-3.5 rounded-xl font-bold text-sm ${
                comModal.type === 'buy' ? 'btn-green' : 'btn-red'
              }`}
            >
              {comLoading ? 'Processing Trade...' : `Confirm ${comModal.type.toUpperCase()}`}
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* MUTUAL FUND TRADE MODAL */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {mfModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {mfModal.type === 'invest' ? '💼 Invest in' : '💸 Redeem from'} {mfModal.fund.name}
              </h3>
              <button onClick={() => setMfModal(null)} className="text-mudra-muted hover:text-white text-xl">
                ✕
              </button>
            </div>

            <div className="bg-mudra-bg p-3.5 rounded-xl border border-mudra-border mb-4 flex justify-between items-center text-sm">
              <span className="text-mudra-muted">Current NAV per Unit</span>
              <span className="font-mono font-bold text-white flex items-center gap-1">
                <MudraIcon className="w-4 h-4" />
                {mfModal.fund.nav.toFixed(3)}
              </span>
            </div>

            <div className="mb-4">
              <label className="text-xs text-mudra-muted block mb-1">
                {mfModal.type === 'invest' ? 'Amount to Invest (Coins)' : 'Units to Redeem'}
              </label>
              <input
                type="number"
                min="1"
                step="any"
                value={mfInputVal}
                onChange={(e) => setMfInputVal(e.target.value)}
                className="input font-mono text-lg"
                placeholder={mfModal.type === 'invest' ? 'e.g. 25000' : 'e.g. 100'}
              />
            </div>

            {parseFloat(mfInputVal) > 0 && (
              <div className="bg-mudra-bg/80 p-3 rounded-xl border border-mudra-border/60 text-xs mb-4 space-y-1.5">
                {mfModal.type === 'invest' ? (
                  <div className="flex justify-between">
                    <span className="text-mudra-muted">Units Allocated:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      ≈ {(parseFloat(mfInputVal) / mfModal.fund.nav).toFixed(2)} Units
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-mudra-muted">Estimated Payout:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      🪙{(parseFloat(mfInputVal) * mfModal.fund.nav).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {mfMsg && (
              <div
                className={`text-xs p-3 rounded-xl mb-4 ${
                  mfMsg.startsWith('✅') ? 'bg-emerald-950/40 text-emerald-400' : 'bg-red-950/40 text-red-400'
                }`}
              >
                {mfMsg}
              </div>
            )}

            <button
              onClick={handleTradeMF}
              disabled={mfLoading || !parseFloat(mfInputVal)}
              className="btn-primary w-full py-3.5 font-bold text-sm"
            >
              {mfLoading
                ? 'Processing...'
                : mfModal.type === 'invest'
                ? 'Confirm Investment'
                : 'Confirm Redemption'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancePage;
