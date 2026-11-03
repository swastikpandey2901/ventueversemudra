import { useEffect, useState, useCallback } from 'react';
import {
  getUserDetailedPortfolio,
  adminUpdateUserCash,
  adminResetUserPortfolio,
} from '../supabase/api';
import MudraIcon from './MudraIcon';

const UserDetailModal = ({ userId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('holdings'); // 'holdings' | 'trades'

  // Admin Fund Control States
  const [customCashInput, setCustomCashInput] = useState('');
  const [fundActionLoading, setFundActionLoading] = useState(false);
  const [fundMsg, setFundMsg] = useState('');

  const reloadData = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await getUserDetailedPortfolio(userId);
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to reload user details.');
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    setLoading(true);
    setError('');

    getUserDetailedPortfolio(userId)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load user details.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (!userId) return null;

  const { profile = {}, valuation = {}, holdings = {}, trades = [] } = data || {};
  const isParticipant = (profile.participantId || '').startsWith('MUDRA');
  const isTester = (profile.participantId || '').startsWith('TRIAL');

  const handleResetCash = async (target = 200000) => {
    if (!window.confirm(`Reset ${profile.name}'s cash balance to 🪙${target.toLocaleString('en-IN')}?`)) return;
    setFundActionLoading(true);
    setFundMsg('');
    try {
      await adminUpdateUserCash(userId, target);
      setFundMsg(`✅ Cash balance set to 🪙${target.toLocaleString('en-IN')}`);
      await reloadData();
    } catch (err) {
      setFundMsg(`❌ ${err.message}`);
    } finally {
      setFundActionLoading(false);
    }
  };

  const handleWipeAndReset = async () => {
    if (
      !window.confirm(
        `Are you sure you want to WIPE all stock, metal, and fund holdings and reset ${profile.name} to starting 🪙2,00,000?`
      )
    )
      return;
    setFundActionLoading(true);
    setFundMsg('');
    try {
      await adminResetUserPortfolio(userId, 200000);
      setFundMsg(`✅ Portfolio wiped and reset to 🪙2,00,000!`);
      await reloadData();
    } catch (err) {
      setFundMsg(`❌ ${err.message}`);
    } finally {
      setFundActionLoading(false);
    }
  };

  const handleSetExactCash = async (val) => {
    const num = Number(val);
    if (isNaN(num) || num < 0) return setFundMsg('❌ Enter a valid positive number');
    setFundActionLoading(true);
    setFundMsg('');
    try {
      await adminUpdateUserCash(userId, num);
      setFundMsg(`✅ Cash set to 🪙${num.toLocaleString('en-IN')}`);
      setCustomCashInput('');
      await reloadData();
    } catch (err) {
      setFundMsg(`❌ ${err.message}`);
    } finally {
      setFundActionLoading(false);
    }
  };

  const handleAddFunds = async (val) => {
    const num = Number(val);
    if (isNaN(num) || num <= 0) return setFundMsg('❌ Enter an amount to add');
    const newTotal = (valuation.cash || 0) + num;
    setFundActionLoading(true);
    setFundMsg('');
    try {
      await adminUpdateUserCash(userId, newTotal);
      setFundMsg(
        `✅ Added 🪙${num.toLocaleString('en-IN')}! New cash: 🪙${newTotal.toLocaleString('en-IN')}`
      );
      setCustomCashInput('');
      await reloadData();
    } catch (err) {
      setFundMsg(`❌ ${err.message}`);
    } finally {
      setFundActionLoading(false);
    }
  };

  const handleDeductFunds = async (val) => {
    const num = Number(val);
    if (isNaN(num) || num <= 0) return setFundMsg('❌ Enter an amount to deduct');
    const newTotal = Math.max(0, (valuation.cash || 0) - num);
    setFundActionLoading(true);
    setFundMsg('');
    try {
      await adminUpdateUserCash(userId, newTotal);
      setFundMsg(
        `✅ Deducted 🪙${num.toLocaleString('en-IN')}! New cash: 🪙${newTotal.toLocaleString('en-IN')}`
      );
      setCustomCashInput('');
      await reloadData();
    } catch (err) {
      setFundMsg(`❌ ${err.message}`);
    } finally {
      setFundActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-4xl max-h-[92vh] flex flex-col border-mudra-accent/40 bg-mudra-surface/95 shadow-2xl p-0 overflow-hidden relative">
        {/* Modal Header */}
        <div className="p-5 border-b border-mudra-border flex items-start justify-between bg-mudra-bg/70 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-mudra-accent/20 border border-mudra-accent/40 flex items-center justify-center text-xl font-black text-white shrink-0">
              {(profile.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white">
                  {profile.name || 'Trader'}
                </h2>
                <span className="font-mono text-xs bg-mudra-card border border-mudra-border px-2 py-0.5 rounded text-mudra-gold">
                  {profile.participantId || 'N/A'}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    profile.role === 'admin'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : isTester
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {profile.role === 'admin'
                    ? 'God Admin'
                    : isTester
                    ? 'Tester'
                    : 'Official Participant'}
                </span>
              </div>
              <div className="text-xs text-mudra-muted mt-1 flex items-center gap-2 flex-wrap">
                <span>{profile.email || 'No email'}</span>
                <span>•</span>
                <span>
                  Joined:{' '}
                  {profile.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-mudra-muted hover:text-white p-2 rounded-lg hover:bg-mudra-card transition-colors text-xl leading-none"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading ? (
            <div className="text-center py-20 text-mudra-muted">
              <div className="text-3xl animate-bounce mb-2">⚡</div>
              <p>Loading full user portfolio & trade history...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-mudra-red">
              <div className="text-3xl mb-2">❌</div>
              <p>{error}</p>
            </div>
          ) : (
            <>
              {/* Valuation Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="card bg-mudra-bg/80 border-mudra-accent/30 p-3">
                  <div className="text-[11px] text-mudra-muted">Total Net Worth</div>
                  <div className="text-lg font-bold font-mono text-white flex items-center gap-1 mt-0.5">
                    <MudraIcon className="w-4 h-4" />
                    {(valuation.totalNetWorth || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>

                <div className="card bg-mudra-bg/80 border-mudra-border p-3">
                  <div className="text-[11px] text-mudra-muted">Liquid Cash</div>
                  <div className="text-lg font-bold font-mono text-mudra-green flex items-center gap-1 mt-0.5">
                    <MudraIcon className="w-4 h-4" />
                    {(valuation.cash || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>

                <div className="card bg-mudra-bg/80 border-mudra-border p-3">
                  <div className="text-[11px] text-mudra-muted">Invested Assets</div>
                  <div className="text-lg font-bold font-mono text-white flex items-center gap-1 mt-0.5">
                    <MudraIcon className="w-4 h-4" />
                    {(
                      (valuation.totalStocks || 0) +
                      (valuation.totalSavings || 0) +
                      (valuation.totalCommodities || 0) +
                      (valuation.totalMFs || 0)
                    ).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>

                <div className="card bg-mudra-bg/80 border-mudra-border p-3">
                  <div className="text-[11px] text-mudra-muted">Net P&L</div>
                  <div
                    className={`text-lg font-bold font-mono flex items-center gap-1 mt-0.5 ${
                      valuation.netPnl >= 0 ? 'text-mudra-green' : 'text-mudra-red'
                    }`}
                  >
                    <span>{valuation.netPnl >= 0 ? '+' : '-'}</span>
                    <MudraIcon className="w-4 h-4" />
                    {Math.abs(valuation.netPnl || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              {/* God Admin Fund Management & Balance Reset */}
              <div className="card bg-purple-950/20 border-purple-500/30 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        God Admin Fund Calibration
                      </h4>
                      <p className="text-[11px] text-mudra-muted">
                        Calibrate, reward, or reset cash balance for this trader.
                      </p>
                    </div>
                  </div>
                  {fundMsg && (
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded ${
                        fundMsg.startsWith('✅')
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-red-950 text-red-400 border border-red-800'
                      }`}
                    >
                      {fundMsg}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Quick Resets */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={fundActionLoading}
                      onClick={() => handleResetCash(200000)}
                      className="btn-outline text-xs px-3 py-1.5 font-bold border-amber-500/40 text-amber-300 hover:bg-amber-500/10 flex items-center gap-1"
                      title="Reset liquid cash back to 2,00,000"
                    >
                      🔄 Reset Cash to 🪙2,00,000
                    </button>
                    <button
                      type="button"
                      disabled={fundActionLoading}
                      onClick={handleWipeAndReset}
                      className="btn-outline text-xs px-3 py-1.5 font-bold border-red-500/40 text-red-400 hover:bg-red-500/10 flex items-center gap-1"
                      title="Clear all holdings and reset cash to 2,00,000"
                    >
                      ⚠️ Wipe Portfolio & Reset
                    </button>
                  </div>

                  {/* Custom Balance Input */}
                  <div className="flex items-center gap-1.5 justify-start md:justify-end flex-wrap">
                    <input
                      type="number"
                      placeholder="Amount..."
                      value={customCashInput}
                      onChange={(e) => setCustomCashInput(e.target.value)}
                      className="input py-1 px-2.5 text-xs font-mono max-w-[110px]"
                    />
                    <button
                      type="button"
                      disabled={fundActionLoading || !customCashInput}
                      onClick={() => handleSetExactCash(customCashInput)}
                      className="btn-primary py-1 px-2.5 text-xs font-bold"
                      title="Set exact cash amount"
                    >
                      Set Balance
                    </button>
                    <button
                      type="button"
                      disabled={fundActionLoading || !customCashInput}
                      onClick={() => handleAddFunds(customCashInput)}
                      className="btn-green py-1 px-2.5 text-xs font-bold"
                      title="Add this amount as bonus"
                    >
                      + Add
                    </button>
                    <button
                      type="button"
                      disabled={fundActionLoading || !customCashInput}
                      onClick={() => handleDeductFunds(customCashInput)}
                      className="btn-red py-1 px-2.5 text-xs font-bold"
                      title="Deduct this amount"
                    >
                      - Deduct
                    </button>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-mudra-border pb-2">
                <button
                  onClick={() => setActiveTab('holdings')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'holdings'
                      ? 'bg-mudra-accent text-white shadow-md'
                      : 'text-mudra-muted hover:text-white hover:bg-mudra-card'
                  }`}
                >
                  💼 Current Assets & Holdings
                </button>
                <button
                  onClick={() => setActiveTab('trades')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'trades'
                      ? 'bg-mudra-accent text-white shadow-md'
                      : 'text-mudra-muted hover:text-white hover:bg-mudra-card'
                  }`}
                >
                  📜 Past Trade History ({trades.length})
                </button>
              </div>

              {/* TAB 1: CURRENT ASSETS */}
              {activeTab === 'holdings' && (
                <div className="space-y-6">
                  {/* Stocks */}
                  <div>
                    <h3 className="text-sm font-bold text-white mb-2.5 flex items-center justify-between">
                      <span>📈 Equities / Stocks ({holdings.stocks?.length || 0})</span>
                      <span className="text-xs font-mono text-mudra-muted">
                        Valuation: 🪙{(valuation.totalStocks || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </h3>
                    {!holdings.stocks || holdings.stocks.length === 0 ? (
                      <div className="text-xs text-mudra-muted bg-mudra-bg/40 rounded-lg p-3 text-center border border-mudra-border/50">
                        No active stock holdings.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-mudra-border">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-mudra-bg text-mudra-muted uppercase text-[10px]">
                            <tr>
                              <th className="p-2.5">Stock</th>
                              <th className="p-2.5 text-right">Qty</th>
                              <th className="p-2.5 text-right">Avg Buy</th>
                              <th className="p-2.5 text-right">LTP</th>
                              <th className="p-2.5 text-right">Current Value</th>
                              <th className="p-2.5 text-right">P&L</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-mudra-border/50">
                            {holdings.stocks.map((s) => (
                              <tr key={s.ticker} className="hover:bg-mudra-card/50">
                                <td className="p-2.5 font-bold text-white">
                                  {s.ticker}{' '}
                                  <span className="font-normal text-mudra-muted text-[11px] block sm:inline">
                                    {s.name}
                                  </span>
                                </td>
                                <td className="p-2.5 text-right font-mono text-white">{s.quantity}</td>
                                <td className="p-2.5 text-right font-mono text-mudra-muted">
                                  🪙{s.avgPrice.toFixed(2)}
                                </td>
                                <td className="p-2.5 text-right font-mono text-white">
                                  🪙{s.currentPrice.toFixed(2)}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-white">
                                  🪙{s.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </td>
                                <td
                                  className={`p-2.5 text-right font-mono font-bold ${
                                    s.pnl >= 0 ? 'text-mudra-green' : 'text-mudra-red'
                                  }`}
                                >
                                  {s.pnl >= 0 ? '+' : ''}
                                  🪙{s.pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (
                                  {s.pnlPct.toFixed(1)}%)
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Fixed Deposits / Savings */}
                  <div>
                    <h3 className="text-sm font-bold text-white mb-2.5 flex items-center justify-between">
                      <span>🏦 Fixed Deposits & Savings ({holdings.savings?.length || 0})</span>
                      <span className="text-xs font-mono text-mudra-muted">
                        Total Principal: 🪙{(valuation.totalSavings || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </h3>
                    {!holdings.savings || holdings.savings.length === 0 ? (
                      <div className="text-xs text-mudra-muted bg-mudra-bg/40 rounded-lg p-3 text-center border border-mudra-border/50">
                        No active fixed deposits.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-mudra-border">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-mudra-bg text-mudra-muted uppercase text-[10px]">
                            <tr>
                              <th className="p-2.5">Type</th>
                              <th className="p-2.5 text-right">Principal</th>
                              <th className="p-2.5 text-right">Rate</th>
                              <th className="p-2.5 text-right">Term</th>
                              <th className="p-2.5 text-right">Maturity Date</th>
                              <th className="p-2.5 text-right">Maturity Value</th>
                              <th className="p-2.5 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-mudra-border/50">
                            {holdings.savings.map((sv) => (
                              <tr key={sv.id} className="hover:bg-mudra-card/50">
                                <td className="p-2.5 font-bold text-white uppercase">{sv.type}</td>
                                <td className="p-2.5 text-right font-mono font-bold text-white">
                                  🪙{sv.amount.toLocaleString('en-IN')}
                                </td>
                                <td className="p-2.5 text-right font-mono text-mudra-gold">{sv.interestRate}%</td>
                                <td className="p-2.5 text-right font-mono text-mudra-muted">{sv.termMonths} mo</td>
                                <td className="p-2.5 text-right font-mono text-mudra-muted">
                                  {sv.maturityDate
                                    ? new Date(sv.maturityDate).toLocaleDateString('en-IN')
                                    : 'N/A'}
                                </td>
                                <td className="p-2.5 text-right font-mono text-mudra-green font-bold">
                                  🪙{sv.totalAtMaturity.toLocaleString('en-IN')}
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className="badge bg-mudra-green/20 text-mudra-green text-[10px] uppercase font-bold">
                                    {sv.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Precious Metals & Mutual Funds in 2 Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Precious Metals */}
                    <div>
                      <h3 className="text-sm font-bold text-white mb-2 flex items-center justify-between">
                        <span>🪙 Precious Metals</span>
                        <span className="text-xs font-mono text-mudra-muted">
                          🪙{(valuation.totalCommodities || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </h3>
                      {!holdings.commodities || holdings.commodities.length === 0 ? (
                        <div className="text-xs text-mudra-muted bg-mudra-bg/40 rounded-lg p-3 text-center border border-mudra-border/50">
                          No commodity holdings.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {holdings.commodities.map((c) => (
                            <div
                              key={c.symbol}
                              className="card bg-mudra-bg/60 p-2.5 flex items-center justify-between text-xs border-mudra-border/60"
                            >
                              <div>
                                <div className="font-bold text-white">{c.name}</div>
                                <div className="text-[11px] text-mudra-muted">
                                  {c.quantity} {c.unit} @ 🪙{c.avgPrice.toFixed(0)}
                                </div>
                              </div>
                              <div className="text-right font-mono">
                                <div className="font-bold text-white">
                                  🪙{c.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </div>
                                <div
                                  className={`text-[10px] ${
                                    c.pnl >= 0 ? 'text-mudra-green' : 'text-mudra-red'
                                  }`}
                                >
                                  {c.pnl >= 0 ? '+' : ''}🪙{c.pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Mutual Funds */}
                    <div>
                      <h3 className="text-sm font-bold text-white mb-2 flex items-center justify-between">
                        <span>📊 Mutual Funds</span>
                        <span className="text-xs font-mono text-mudra-muted">
                          🪙{(valuation.totalMFs || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </h3>
                      {!holdings.mutualFunds || holdings.mutualFunds.length === 0 ? (
                        <div className="text-xs text-mudra-muted bg-mudra-bg/40 rounded-lg p-3 text-center border border-mudra-border/50">
                          No mutual fund holdings.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {holdings.mutualFunds.map((m) => (
                            <div
                              key={m.fundId}
                              className="card bg-mudra-bg/60 p-2.5 flex items-center justify-between text-xs border-mudra-border/60"
                            >
                              <div>
                                <div className="font-bold text-white">{m.name}</div>
                                <div className="text-[11px] text-mudra-muted">
                                  {m.units.toFixed(2)} units • {m.category}
                                </div>
                              </div>
                              <div className="text-right font-mono">
                                <div className="font-bold text-white">
                                  🪙{m.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </div>
                                <div
                                  className={`text-[10px] ${
                                    m.pnl >= 0 ? 'text-mudra-green' : 'text-mudra-red'
                                  }`}
                                >
                                  {m.pnl >= 0 ? '+' : ''}🪙{m.pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PAST TRADE HISTORY */}
              {activeTab === 'trades' && (
                <div>
                  <h3 className="text-sm font-bold text-white mb-2.5">
                    📜 Execution Trade Log (Total: {trades.length})
                  </h3>
                  {trades.length === 0 ? (
                    <div className="text-xs text-mudra-muted bg-mudra-bg/40 rounded-lg p-8 text-center border border-mudra-border/50">
                      No trades have been executed yet by this account.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-mudra-border">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-mudra-bg text-mudra-muted uppercase text-[10px]">
                          <tr>
                            <th className="p-2.5">Date & Time</th>
                            <th className="p-2.5">Asset / Ticker</th>
                            <th className="p-2.5 text-center">Type</th>
                            <th className="p-2.5 text-right">Quantity</th>
                            <th className="p-2.5 text-right">Exec Price</th>
                            <th className="p-2.5 text-right">Total Mudra Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-mudra-border/50">
                          {trades.map((t, idx) => (
                            <tr key={t.id || idx} className="hover:bg-mudra-card/50">
                              <td className="p-2.5 font-mono text-mudra-muted">
                                {t.created_at
                                  ? new Date(t.created_at).toLocaleString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                    })
                                  : 'N/A'}
                              </td>
                              <td className="p-2.5 font-bold text-white font-mono">{t.ticker}</td>
                              <td className="p-2.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                    t.type?.toLowerCase() === 'buy'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  }`}
                                >
                                  {t.type}
                                </span>
                              </td>
                              <td className="p-2.5 text-right font-mono text-white">{t.quantity}</td>
                              <td className="p-2.5 text-right font-mono text-white">
                                🪙{Number(t.price || 0).toFixed(2)}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-white">
                                🪙{Number(t.total_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-mudra-border bg-mudra-bg/80 flex items-center justify-between shrink-0">
          <span className="text-xs text-mudra-muted">
            🛡️ God Admin Investor Inspector Tool
          </span>
          <button onClick={onClose} className="btn-primary py-1.5 px-4 text-xs font-bold">
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserDetailModal;
