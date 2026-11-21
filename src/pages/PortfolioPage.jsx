import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  subscribeHoldings,
  subscribeStocks,
  subscribeSavings,
  subscribeCommodities,
  subscribeCommodityHoldings,
  subscribeMutualFunds,
  subscribeMFHoldings,
  updateUserName,
  autoProcessMaturedSavings,
  withdrawSavings,
} from '../supabase/api';
import { getUserLimits, setUserLimit, clearUserLimit } from '../engine/limitOrderEngine';
import TradeModal from '../components/TradeModal';
import MudraIcon from '../components/MudraIcon';
import { supabase } from '../supabase/client';

const formatCurrency = (val) => {
  const num = Number(val) || 0;
  if (Math.abs(num) >= 10000000) {
    return `${(num / 10000000).toFixed(2)} Cr`;
  }
  if (Math.abs(num) >= 100000) {
    return `${(num / 100000).toFixed(2)} L`;
  }
  return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const PortfolioPage = () => {
  const { user, userData, refreshUserData } = useAuth();
  const [holdings, setHoldings] = useState([]);
  const [stocks, setStocks] = useState({});
  const [selectedStock, setSelectedStock] = useState(null);
  const [tradeActionType, setTradeActionType] = useState('buy');
  const [liveUserData, setLiveUserData] = useState(null);

  // Stop Loss & Take Profit limits state
  const [userLimits, setUserLimits] = useState({});
  const [limitModalStock, setLimitModalStock] = useState(null);
  const [editSL, setEditSL] = useState('');
  const [editTP, setEditTP] = useState('');

  // Name Editing State
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');

  // Phase 2 Asset States
  const [savingsList, setSavingsList] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [comHoldings, setComHoldings] = useState([]);
  const [mutualFunds, setMutualFunds] = useState([]);
  const [mfHoldings, setMfHoldings] = useState([]);

  const userId = user?.id || user?.uid;

  useEffect(() => {
    if (!userId) return;

    // Load active limits and auto-process any matured deposits immediately
    setUserLimits(getUserLimits(userId));
    autoProcessMaturedSavings(userId);
    const matureInterval = setInterval(() => autoProcessMaturedSavings(userId), 10000);

    const onLimitsUpdated = () => setUserLimits(getUserLimits(userId));
    window.addEventListener('mudra-limits-updated', onLimitsUpdated);
    window.addEventListener('mudra-limits-executed', onLimitsUpdated);

    const unsub1 = subscribeHoldings(userId, setHoldings);
    const unsub2 = subscribeStocks((data) => {
      const map = {};
      data.forEach((s) => {
        map[s.ticker] = s;
      });
      setStocks(map);
    });

    const unsub3 = subscribeSavings(userId, setSavingsList);
    const unsub4 = subscribeCommodities(setCommodities);
    const unsub5 = subscribeCommodityHoldings(userId, setComHoldings);
    const unsub6 = subscribeMutualFunds(setMutualFunds);
    const unsub7 = subscribeMFHoldings(userId, setMfHoldings);

    const fetchLiveUser = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (data) setLiveUserData(data);
    };
    fetchLiveUser();

    const channel = supabase
      .channel(`profile-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) setLiveUserData(payload.new);
        }
      )
      .subscribe();

    return () => {
      clearInterval(matureInterval);
      window.removeEventListener('mudra-limits-updated', onLimitsUpdated);
      window.removeEventListener('mudra-limits-executed', onLimitsUpdated);
      unsub1?.();
      unsub2?.();
      unsub3?.();
      unsub4?.();
      unsub5?.();
      unsub6?.();
      unsub7?.();
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const activeHoldings = holdings.filter((h) => h.quantity > 0);
  const cash = liveUserData?.cash ? Number(liveUserData.cash) : Number(userData?.cash || 0);

  // Stocks Value
  const holdingsWithPrices = activeHoldings.map((h) => {
    const stock = stocks[h.ticker];
    const currentPrice = stock?.currentPrice || 0;
    const currentValue = currentPrice * h.quantity;
    const costBasis = h.avgPrice * h.quantity;
    const pnl = currentValue - costBasis;
    const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
    return { ...h, currentPrice, currentValue, costBasis, pnl, pnlPct, stock };
  });
  const totalStocksValue = holdingsWithPrices.reduce((s, h) => s + h.currentValue, 0);

  // Savings Value (Active and Matured)
  const activeSavings = savingsList.filter((s) => s.status !== 'withdrawn');
  const totalSavingsValue = activeSavings.reduce((s, d) => s + d.amount, 0);

  // Commodities Value
  const comPriceMap = {};
  commodities.forEach((c) => {
    comPriceMap[c.symbol] = c.currentPrice;
  });
  const totalCommoditiesValue = comHoldings.reduce((sum, ch) => {
    return sum + (comPriceMap[ch.symbol] || 0) * ch.quantity;
  }, 0);

  // Mutual Funds Value
  const mfNavMap = {};
  mutualFunds.forEach((m) => {
    mfNavMap[m.id] = m.nav;
  });
  const totalMFValue = mfHoldings.reduce((sum, mh) => {
    return sum + (mfNavMap[mh.fundId] || 0) * mh.units;
  }, 0);

  // Total Portfolio Net Worth
  const totalInvestedValue = totalStocksValue + totalSavingsValue + totalCommoditiesValue + totalMFValue;
  const totalPortfolio = cash + totalInvestedValue;
  const totalPnl = totalPortfolio - 200000;
  const totalPnlPct = (totalPnl / 200000) * 100;

  const displayName = liveUserData?.name || userData?.name || 'Trader';
  const participantId = liveUserData?.participant_id || userData?.participantId || '';
  const role = liveUserData?.role || userData?.role || 'student';

  const handleSaveName = async (e) => {
    e.preventDefault();
    const clean = nameInput.trim();
    if (!clean) {
      setNameError('Name cannot be empty.');
      return;
    }
    if (clean.length < 2) {
      setNameError('Name must be at least 2 characters.');
      return;
    }

    setSavingName(true);
    setNameError('');
    setNameSuccess('');
    try {
      await updateUserName(userId, clean);
      await refreshUserData();
      setLiveUserData((prev) => (prev ? { ...prev, name: clean } : { name: clean }));
      setIsEditingName(false);
      setNameSuccess('Name updated successfully!');
      setTimeout(() => setNameSuccess(''), 4000);
    } catch (err) {
      setNameError(err.message || 'Failed to update name.');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-white">My Portfolio</h1>
          <p className="text-xs text-mudra-muted mt-1">Live consolidated valuation across all asset classes.</p>
        </div>
        <Link to="/finance" className="btn-outline text-xs px-4 py-2 font-bold self-start sm:self-auto flex items-center gap-1.5">
          <span>Explore Finance Hub</span> →
        </Link>
      </div>

      {/* Trader Profile Header Card with Name Editing */}
      <div className="card mb-6 border-mudra-border/80 bg-mudra-surface/60 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-mudra-accent/30 to-mudra-gold/30 border border-mudra-accent/40 flex items-center justify-center text-xl font-black text-white shrink-0 shadow-lg">
              {(displayName || 'T').charAt(0).toUpperCase()}
            </div>
            <div>
              {isEditingName ? (
                <form onSubmit={handleSaveName} className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="input py-1.5 px-3 text-sm font-semibold max-w-[240px]"
                    placeholder="Enter display name"
                    autoFocus
                    maxLength={40}
                  />
                  <button
                    type="submit"
                    disabled={savingName}
                    className="btn-primary py-1.5 px-3 text-xs font-bold"
                  >
                    {savingName ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(false);
                      setNameError('');
                    }}
                    className="btn-outline py-1.5 px-2.5 text-xs text-mudra-muted"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {displayName}
                  </h2>
                  <button
                    onClick={() => {
                      setNameInput(displayName);
                      setIsEditingName(true);
                      setNameError('');
                      setNameSuccess('');
                    }}
                    className="text-xs text-mudra-accent hover:text-amber-300 font-semibold flex items-center gap-1 hover:underline ml-1"
                    title="Change your display name"
                  >
                    ✏️ Edit Name
                  </button>
                </div>
              )}

              {nameError && (
                <div className="text-mudra-red text-[11px] mt-1">❌ {nameError}</div>
              )}
              {nameSuccess && (
                <div className="text-mudra-green text-[11px] mt-1">✓ {nameSuccess}</div>
              )}

              <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-mudra-muted">
                <span className="font-mono bg-mudra-bg/80 px-2 py-0.5 rounded border border-mudra-border text-white">
                  ID: {participantId || 'N/A'}
                </span>
                <span>•</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                  role === 'admin'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : participantId.startsWith('TRIAL')
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {role === 'admin' ? 'God Admin' : participantId.startsWith('TRIAL') ? 'Tester / Trial' : 'Official Participant'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-mudra-border/40">
            <span className="text-[11px] text-mudra-muted uppercase font-semibold tracking-wider">Account Status</span>
            <span className="text-xs text-mudra-green font-mono font-bold flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-mudra-green animate-pulse"></span>
              Live Tournament Active
            </span>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <div className="card border-mudra-accent/40 bg-gradient-to-br from-mudra-card to-mudra-accent/10 min-w-0 overflow-hidden p-3 sm:p-4">
          <div className="text-xs text-mudra-muted mb-1 truncate">Total Net Worth</div>
          <div
            className="text-base sm:text-xl lg:text-2xl font-black font-mono text-white flex items-center gap-1 min-w-0"
            title={`🪙${totalPortfolio.toLocaleString('en-IN')}`}
          >
            <MudraIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="truncate">{formatCurrency(totalPortfolio)}</span>
          </div>
          <div className="text-[10px] text-mudra-muted font-mono truncate hidden sm:block">
            🪙{totalPortfolio.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="card min-w-0 overflow-hidden p-3 sm:p-4">
          <div className="text-xs text-mudra-muted mb-1 truncate">Liquid Cash</div>
          <div
            className="text-base sm:text-xl lg:text-2xl font-bold font-mono text-mudra-green flex items-center gap-1 min-w-0"
            title={`🪙${cash.toLocaleString('en-IN')}`}
          >
            <MudraIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">{formatCurrency(cash)}</span>
          </div>
          <div className="text-[10px] text-mudra-muted font-mono truncate hidden sm:block">
            🪙{cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="card min-w-0 overflow-hidden p-3 sm:p-4">
          <div className="text-xs text-mudra-muted mb-1 truncate">All Assets Invested</div>
          <div
            className="text-base sm:text-xl lg:text-2xl font-bold font-mono text-white flex items-center gap-1 min-w-0"
            title={`🪙${totalInvestedValue.toLocaleString('en-IN')}`}
          >
            <MudraIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">{formatCurrency(totalInvestedValue)}</span>
          </div>
          <div className="text-[10px] text-mudra-muted mt-0.5 truncate">
            Stocks+FD+Metals+Funds
          </div>
        </div>

        <div className="card min-w-0 overflow-hidden p-3 sm:p-4">
          <div className="text-xs text-mudra-muted mb-1 truncate">Total P&L (from 2L)</div>
          <div
            className={`text-base sm:text-xl lg:text-2xl font-bold font-mono flex items-center gap-1 min-w-0 ${
              totalPnl >= 0 ? 'text-mudra-green' : 'text-mudra-red'
            }`}
            title={`${totalPnl >= 0 ? '+' : '-'}🪙${Math.abs(totalPnl).toLocaleString('en-IN')}`}
          >
            <span className="shrink-0">{totalPnl >= 0 ? '+' : '-'}</span>
            <MudraIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">{formatCurrency(Math.abs(totalPnl))}</span>
          </div>
          <div className={`text-xs font-mono font-semibold truncate ${totalPnl >= 0 ? 'text-mudra-green' : 'text-mudra-red'}`}>
            {totalPnl >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Asset Breakdown Bar */}
      <div className="card p-4 mb-8">
        <div className="text-xs font-semibold text-white mb-2">Portfolio Allocation</div>
        <div className="h-3 w-full bg-mudra-bg rounded-full overflow-hidden flex">
          <div
            style={{ width: `${Math.max(2, (cash / totalPortfolio) * 100)}%` }}
            className="bg-emerald-500 h-full"
            title={`Cash: ${((cash / totalPortfolio) * 100).toFixed(1)}%`}
          />
          <div
            style={{ width: `${Math.max(0, (totalStocksValue / totalPortfolio) * 100)}%` }}
            className="bg-indigo-500 h-full"
            title={`Stocks: ${((totalStocksValue / totalPortfolio) * 100).toFixed(1)}%`}
          />
          <div
            style={{ width: `${Math.max(0, (totalSavingsValue / totalPortfolio) * 100)}%` }}
            className="bg-blue-500 h-full"
            title={`Savings: ${((totalSavingsValue / totalPortfolio) * 100).toFixed(1)}%`}
          />
          <div
            style={{ width: `${Math.max(0, (totalCommoditiesValue / totalPortfolio) * 100)}%` }}
            className="bg-amber-500 h-full"
            title={`Metals: ${((totalCommoditiesValue / totalPortfolio) * 100).toFixed(1)}%`}
          />
          <div
            style={{ width: `${Math.max(0, (totalMFValue / totalPortfolio) * 100)}%` }}
            className="bg-teal-500 h-full"
            title={`Mutual Funds: ${((totalMFValue / totalPortfolio) * 100).toFixed(1)}%`}
          />
        </div>
        <div className="flex flex-wrap gap-4 text-[11px] text-mudra-muted mt-2.5">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Cash: 🪙{cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-500" /> Stocks: 🪙{totalStocksValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-500" /> Savings: 🪙{totalSavingsValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500" /> Metals: 🪙{totalCommoditiesValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-teal-500" /> Funds: 🪙{totalMFValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </div>
      </div>

      {/* Stock Holdings Section */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-white flex items-center gap-2">
              <span>📈 Equity Holdings</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-mudra-accent/20 text-mudra-accent border border-mudra-accent/30">
                {activeHoldings.length}
              </span>
            </h2>
            <p className="text-xs text-mudra-muted mt-0.5 hidden sm:block">
              Manage your stock positions, track live P&L, and configure automated Stop Loss / Take Profit targets.
            </p>
          </div>
          <Link to="/market" className="text-xs text-mudra-accent hover:underline font-semibold flex items-center gap-1">
            <span>Trade More Stocks</span> →
          </Link>
        </div>

        {holdingsWithPrices.length === 0 ? (
          <div className="text-center py-10 text-mudra-muted">
            <div className="text-3xl mb-2">📊</div>
            <p className="font-medium text-white mb-1">No stock holdings yet</p>
            <p className="text-xs text-mudra-muted mb-3 max-w-sm mx-auto">
              You haven't invested in any companies yet. Explore the 30 Mudra stocks to build your portfolio!
            </p>
            <Link to="/market" className="btn-primary text-xs px-4 py-2 font-bold">Browse 30 Stocks →</Link>
          </div>
        ) : (
          <>
            {/* ── Desktop / Tablet Table View (md:block) ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-mudra-muted text-xs border-b border-mudra-border/80">
                    <th className="text-left px-3.5 py-3">Company</th>
                    <th className="text-right px-3.5 py-3">Qty</th>
                    <th className="text-right px-3.5 py-3">Avg Buy Price</th>
                    <th className="text-right px-3.5 py-3">Current Market</th>
                    <th className="text-right px-3.5 py-3">Holding Value</th>
                    <th className="text-right px-3.5 py-3">Total P&L</th>
                    <th className="text-center px-3.5 py-3">Auto Limits</th>
                    <th className="text-right px-3.5 py-3">Quick Trade</th>
                  </tr>
                </thead>
                <tbody>
                  {holdingsWithPrices.map((h) => {
                    const limit = userLimits[h.ticker];
                    return (
                      <tr key={h.ticker} className="border-b border-mudra-border/50 hover:bg-mudra-bg/50 transition-colors">
                        <td className="px-3.5 py-3.5">
                          <Link to={`/company/${h.ticker}`} className="font-bold text-white hover:text-mudra-accent flex items-center gap-1.5">
                            <span>{h.stock?.logo || '📈'}</span>
                            <span>{h.ticker}</span>
                          </Link>
                          <div className="text-xs text-mudra-muted truncate max-w-[140px]">{h.stock?.name}</div>
                        </td>
                        <td className="text-right px-3.5 py-3.5 font-mono font-bold text-white">
                          {h.quantity.toLocaleString('en-IN')}
                        </td>
                        <td className="text-right px-3.5 py-3.5 font-mono text-mudra-muted">
                          <span className="flex items-center justify-end gap-0.5">
                            <MudraIcon className="w-3 h-3" />
                            {h.avgPrice?.toFixed(2)}
                          </span>
                        </td>
                        <td className="text-right px-3.5 py-3.5 font-mono text-white font-semibold">
                          <span className="flex items-center justify-end gap-0.5">
                            <MudraIcon className="w-3 h-3" />
                            {h.currentPrice?.toFixed(2)}
                          </span>
                        </td>
                        <td className="text-right px-3.5 py-3.5 font-mono font-bold text-white">
                          <span className="flex items-center justify-end gap-0.5">
                            <MudraIcon className="w-3 h-3" />
                            {h.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </td>
                        <td className={`text-right px-3.5 py-3.5 font-mono ${h.pnl >= 0 ? 'text-mudra-green' : 'text-mudra-red'}`}>
                          <div className="flex items-center justify-end gap-0.5 font-bold">
                            {h.pnl >= 0 ? '+' : '-'}
                            <MudraIcon className="w-3 h-3" />
                            {Math.abs(h.pnl).toFixed(0)}
                          </div>
                          <div className="text-[11px] font-semibold">{h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(1)}%</div>
                        </td>
                        <td className="text-center px-3.5 py-3.5">
                          {limit?.stopLoss || limit?.takeProfit ? (
                            <button
                              type="button"
                              onClick={() => {
                                setLimitModalStock(h);
                                setEditSL(limit?.stopLoss ? limit.stopLoss.toString() : '');
                                setEditTP(limit?.takeProfit ? limit.takeProfit.toString() : '');
                              }}
                              className="text-[10px] font-mono px-2 py-1 rounded bg-amber-950/40 border border-amber-500/40 text-amber-300 hover:bg-amber-900/60 transition-all font-bold block mx-auto text-left"
                            >
                              {limit.stopLoss && <div>🛑 SL: 🪙{limit.stopLoss}</div>}
                              {limit.takeProfit && <div>🎯 TP: 🪙{limit.takeProfit}</div>}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setLimitModalStock(h);
                                setEditSL((h.currentPrice * 0.95).toFixed(2));
                                setEditTP((h.currentPrice * 1.15).toFixed(2));
                              }}
                              className="text-[11px] text-mudra-muted hover:text-mudra-gold hover:underline font-semibold"
                            >
                              + Set SL/TP
                            </button>
                          )}
                        </td>
                        <td className="text-right px-3.5 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedStock(h.stock);
                                setTradeActionType('sell');
                              }}
                              className="text-xs px-2.5 py-1 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 hover:bg-red-900/60 font-bold transition-all shadow-sm"
                            >
                              Sell
                            </button>
                            <button
                              onClick={() => {
                                setSelectedStock(h.stock);
                                setTradeActionType('buy');
                              }}
                              className="text-xs px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60 font-bold transition-all shadow-sm"
                            >
                              Buy More
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Dedicated Mobile Card View (md:hidden) ── */}
            <div className="block md:hidden space-y-3">
              {holdingsWithPrices.map((h) => {
                const limit = userLimits[h.ticker];
                return (
                  <div
                    key={h.ticker}
                    className="p-3.5 rounded-xl border border-mudra-border/70 bg-mudra-bg/90 space-y-3 shadow-sm"
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between border-b border-mudra-border/50 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{h.stock?.logo || '📈'}</span>
                        <div>
                          <Link to={`/company/${h.ticker}`} className="font-bold text-white text-base hover:text-mudra-accent">
                            {h.ticker}
                          </Link>
                          <div className="text-[11px] text-mudra-muted">{h.stock?.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black font-mono text-white flex items-center justify-end gap-0.5">
                          <MudraIcon className="w-3.5 h-3.5" />
                          {h.currentPrice?.toFixed(2)}
                        </div>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-mudra-card border border-mudra-border text-mudra-muted">
                          {h.stock?.sector}
                        </span>
                      </div>
                    </div>

                    {/* Stats Grid: Quantity, Avg Price, Current, Value */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-mudra-card/50 p-2.5 rounded-lg border border-mudra-border/40">
                      <div>
                        <span className="text-[11px] text-mudra-muted block mb-0.5">Quantity Owned</span>
                        <span className="font-mono font-bold text-white text-sm">{h.quantity.toLocaleString('en-IN')} shares</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-mudra-muted block mb-0.5">Avg Buy Price</span>
                        <span className="font-mono font-bold text-mudra-muted text-sm flex items-center gap-0.5">
                          <MudraIcon className="w-3 h-3" />{h.avgPrice?.toFixed(2)}
                        </span>
                      </div>
                      <div className="pt-1 border-t border-mudra-border/30">
                        <span className="text-[11px] text-mudra-muted block mb-0.5">Holding Value</span>
                        <span className="font-mono font-bold text-white text-sm flex items-center gap-0.5">
                          <MudraIcon className="w-3 h-3" />{h.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="pt-1 border-t border-mudra-border/30">
                        <span className="text-[11px] text-mudra-muted block mb-0.5">Total P&L</span>
                        <span className={`font-mono font-bold text-sm flex items-center gap-0.5 ${h.pnl >= 0 ? 'text-mudra-green' : 'text-mudra-red'}`}>
                          <span>{h.pnl >= 0 ? '+' : '-'}</span>
                          <MudraIcon className="w-3 h-3" />
                          {Math.abs(h.pnl).toFixed(0)} ({h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    {/* Active Limits Row */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-mudra-muted text-[11px]">Auto Limits:</span>
                        {limit?.stopLoss || limit?.takeProfit ? (
                          <div className="flex items-center gap-1 font-mono text-[10px] font-bold">
                            {limit.stopLoss && <span className="text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded border border-red-500/30">🛑 {limit.stopLoss}</span>}
                            {limit.takeProfit && <span className="text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/30">🎯 {limit.takeProfit}</span>}
                          </div>
                        ) : (
                          <span className="text-mudra-muted italic text-[11px]">None set</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setLimitModalStock(h);
                          setEditSL(limit?.stopLoss ? limit.stopLoss.toString() : (h.currentPrice * 0.95).toFixed(2));
                          setEditTP(limit?.takeProfit ? limit.takeProfit.toString() : (h.currentPrice * 1.15).toFixed(2));
                        }}
                        className="text-xs text-mudra-accent font-bold hover:underline"
                      >
                        {limit?.stopLoss || limit?.takeProfit ? '⚙️ Edit SL/TP' : '🛡️ Set SL/TP'}
                      </button>
                    </div>

                    {/* Mobile Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-mudra-border/40">
                      <button
                        onClick={() => {
                          setSelectedStock(h.stock);
                          setTradeActionType('sell');
                        }}
                        className="btn-red py-2 text-xs font-bold w-full rounded-lg"
                      >
                        ⚡ Sell Shares
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStock(h.stock);
                          setTradeActionType('buy');
                        }}
                        className="btn-green py-2 text-xs font-bold w-full rounded-lg"
                      >
                        + Buy More
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Alternative Assets Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Savings Card */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-white flex items-center gap-1.5 text-sm">
              <span>🔒</span> Fixed Term Deposits
            </h3>
            <Link to="/finance" className="text-xs text-mudra-accent hover:underline">Manage</Link>
          </div>
          {activeSavings.length === 0 ? (
            <div className="text-center py-6 text-mudra-muted text-xs">
              No active deposits. Earn up to +15% guaranteed returns in Savings.
            </div>
          ) : (
            <div className="space-y-2">
              {activeSavings.map((s) => {
                const isMatured = s.status === 'matured' || Date.now() >= new Date(s.maturesAt).getTime();
                return (
                  <div
                    key={s.id}
                    className={`p-2.5 rounded-lg border text-xs flex justify-between items-center transition-all ${
                      isMatured ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-mudra-bg/70 border-mudra-border'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-white font-mono flex items-center gap-1.5">
                        <span>🪙{s.amount.toLocaleString('en-IN')}</span>
                        {isMatured && (
                          <span className="text-[10px] text-emerald-400 font-bold animate-pulse">
                            (Matured!)
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-mudra-green">+{(s.rate * 100).toFixed(0)}% return</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-semibold text-mudra-gold">
                        🪙{s.payout.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </div>
                      {isMatured && (
                        <button
                          onClick={async () => {
                            await withdrawSavings({ userId, savingsId: s.id });
                            refreshUserData();
                          }}
                          className="text-[10px] text-emerald-300 font-bold underline hover:text-white"
                        >
                          ⚡ Claim Now
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Commodities Card */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-white flex items-center gap-1.5 text-sm">
              <span>🪙</span> Gold & Silver Metals
            </h3>
            <Link to="/finance" className="text-xs text-amber-400 hover:underline">Trade</Link>
          </div>
          {comHoldings.length === 0 ? (
            <div className="text-center py-6 text-mudra-muted text-xs">
              No precious metals owned. Hedge against volatility with Gold & Silver.
            </div>
          ) : (
            <div className="space-y-2">
              {comHoldings.map((ch) => {
                const curPrice = comPriceMap[ch.symbol] || 0;
                const val = curPrice * ch.quantity;
                return (
                  <div key={ch.symbol} className="bg-mudra-bg/70 p-2.5 rounded-lg border border-mudra-border text-xs flex justify-between items-center">
                    <div>
                      <div className="font-bold text-white">{ch.symbol}</div>
                      <div className="text-[10px] text-mudra-muted">{ch.quantity.toFixed(2)} grams</div>
                    </div>
                    <div className="text-right font-mono font-semibold text-white">
                      🪙{val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mutual Funds Card */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-white flex items-center gap-1.5 text-sm">
              <span>📈</span> Mutual Funds
            </h3>
            <Link to="/finance" className="text-xs text-teal-400 hover:underline">Invest</Link>
          </div>
          {mfHoldings.length === 0 ? (
            <div className="text-center py-6 text-mudra-muted text-xs">
              No mutual fund units. Invest in professionally managed diversified baskets.
            </div>
          ) : (
            <div className="space-y-2">
              {mfHoldings.map((mh) => {
                const nav = mfNavMap[mh.fundId] || 0;
                const val = nav * mh.units;
                return (
                  <div key={mh.fundId} className="bg-mudra-bg/70 p-2.5 rounded-lg border border-mudra-border text-xs flex justify-between items-center">
                    <div>
                      <div className="font-bold text-white">{mh.fundId}</div>
                      <div className="text-[10px] text-mudra-muted">{mh.units.toFixed(2)} units</div>
                    </div>
                    <div className="text-right font-mono font-semibold text-emerald-400">
                      🪙{val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedStock && (
        <TradeModal
          stock={selectedStock}
          defaultType={tradeActionType}
          onClose={() => setSelectedStock(null)}
        />
      )}

      {/* ── Set Limits Modal (Stop Loss & Take Profit) ── */}
      {limitModalStock && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm animate-fadeIn space-y-4 border-mudra-gold/40">
            <div className="flex items-center justify-between pb-2 border-b border-mudra-border/60">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                  <span>🛡️</span> Auto Limits for {limitModalStock.ticker}
                </h3>
                <p className="text-xs text-mudra-muted">
                  Auto-sells at target when market price is reached.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLimitModalStock(null)}
                className="text-mudra-muted hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-mudra-bg p-2.5 rounded-lg border border-mudra-border flex justify-between text-xs">
              <span className="text-mudra-muted">Current Market Price:</span>
              <span className="font-mono font-bold text-white flex items-center gap-1">
                <MudraIcon className="w-3.5 h-3.5" />
                {limitModalStock.currentPrice?.toFixed(2)}
              </span>
            </div>

            {/* Stop Loss Input */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-rose-400 font-semibold flex items-center gap-1">
                  <span>🛑</span> Stop Loss Price
                </span>
                {editSL && (
                  <span className="text-[10px] text-mudra-muted font-mono">
                    {(((parseFloat(editSL) - limitModalStock.currentPrice) / limitModalStock.currentPrice) * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="flex gap-1.5 items-center">
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 110.00"
                  value={editSL}
                  onChange={(e) => setEditSL(e.target.value)}
                  className="input text-xs font-mono py-1.5 px-2.5 flex-1"
                />
                {[-5, -10, -15].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setEditSL((limitModalStock.currentPrice * (1 + pct / 100)).toFixed(2))}
                    className="text-[11px] px-2 py-1.5 rounded bg-red-950/40 border border-red-500/30 text-red-300 hover:bg-red-900/50 font-mono font-bold"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-mudra-muted">Auto-sells if price drops to or below this level.</p>
            </div>

            {/* Take Profit Input */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span>🎯</span> Take Profit Target
                </span>
                {editTP && (
                  <span className="text-[10px] text-mudra-muted font-mono">
                    +{(((parseFloat(editTP) - limitModalStock.currentPrice) / limitModalStock.currentPrice) * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="flex gap-1.5 items-center">
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 150.00"
                  value={editTP}
                  onChange={(e) => setEditTP(e.target.value)}
                  className="input text-xs font-mono py-1.5 px-2.5 flex-1"
                />
                {[10, 20, 30].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setEditTP((limitModalStock.currentPrice * (1 + pct / 100)).toFixed(2))}
                    className="text-[11px] px-2 py-1.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/50 font-mono font-bold"
                  >
                    +{pct}%
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-mudra-muted">Auto-sells if price rises to or above this target.</p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2 border-t border-mudra-border/60">
              <button
                type="button"
                onClick={() => {
                  clearUserLimit(userId, limitModalStock.ticker);
                  setLimitModalStock(null);
                }}
                className="btn-outline flex-1 py-2 text-xs text-mudra-muted hover:text-white"
              >
                Clear Limits
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserLimit(userId, limitModalStock.ticker, {
                    stopLoss: editSL,
                    takeProfit: editTP,
                    quantity: limitModalStock.quantity,
                    entryPrice: limitModalStock.currentPrice,
                  });
                  setLimitModalStock(null);
                }}
                className="btn-primary flex-1 py-2 text-xs font-bold"
              >
                Save Limits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioPage;
