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
} from '../supabase/api';
import TradeModal from '../components/TradeModal';
import MudraIcon from '../components/MudraIcon';
import { supabase } from '../supabase/client';

const PortfolioPage = () => {
  const { user, userData } = useAuth();
  const [holdings, setHoldings] = useState([]);
  const [stocks, setStocks] = useState({});
  const [selectedStock, setSelectedStock] = useState(null);
  const [liveUserData, setLiveUserData] = useState(null);

  // Phase 2 Asset States
  const [savingsList, setSavingsList] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [comHoldings, setComHoldings] = useState([]);
  const [mutualFunds, setMutualFunds] = useState([]);
  const [mfHoldings, setMfHoldings] = useState([]);

  const userId = user?.id || user?.uid;

  useEffect(() => {
    if (!userId) return;

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

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card border-mudra-accent/40 bg-gradient-to-br from-mudra-card to-mudra-accent/10">
          <div className="text-xs text-mudra-muted mb-1">Total Net Worth</div>
          <div className="text-2xl font-black font-mono text-white flex items-center gap-1">
            <MudraIcon className="w-5 h-5" />
            {totalPortfolio.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-mudra-muted mb-1">Liquid Cash</div>
          <div className="text-xl font-bold font-mono text-mudra-green flex items-center gap-1">
            <MudraIcon className="w-4 h-4" />
            {cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-mudra-muted mb-1">All Assets Invested</div>
          <div className="text-xl font-bold font-mono text-white flex items-center gap-1">
            <MudraIcon className="w-4 h-4" />
            {totalInvestedValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-mudra-muted mt-0.5">
            Stocks + Savings + Metals + Funds
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-mudra-muted mb-1">Total P&L (from 2L)</div>
          <div className={`text-xl font-bold font-mono flex items-center gap-1 ${totalPnl >= 0 ? 'text-mudra-green' : 'text-mudra-red'}`}>
            {totalPnl >= 0 ? '+' : '-'}
            <MudraIcon className="w-4 h-4" />
            {Math.abs(totalPnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className={`text-xs font-mono font-semibold ${totalPnl >= 0 ? 'text-mudra-green' : 'text-mudra-red'}`}>
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
        <h2 className="font-bold text-white mb-4 flex items-center justify-between">
          <span>📈 Equity Holdings ({activeHoldings.length})</span>
          <Link to="/market" className="text-xs text-mudra-accent hover:underline">Trade More Stocks →</Link>
        </h2>
        {holdingsWithPrices.length === 0 ? (
          <div className="text-center py-8 text-mudra-muted">
            <p className="mb-2">No stock holdings yet.</p>
            <Link to="/market" className="btn-primary text-xs px-3 py-1.5">Browse 30 Stocks →</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-mudra-muted text-xs border-b border-mudra-border">
                  <th className="text-left pb-3">Company</th>
                  <th className="text-right pb-3">Qty</th>
                  <th className="text-right pb-3">Avg Price</th>
                  <th className="text-right pb-3">Current</th>
                  <th className="text-right pb-3">Value</th>
                  <th className="text-right pb-3">P&L</th>
                  <th className="text-right pb-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {holdingsWithPrices.map((h) => (
                  <tr key={h.ticker} className="border-b border-mudra-border/50 hover:bg-mudra-bg/50">
                    <td className="py-3">
                      <Link to={`/company/${h.ticker}`} className="font-semibold text-white hover:text-mudra-accent">
                        {h.ticker}
                      </Link>
                      <div className="text-xs text-mudra-muted">{h.stock?.sector}</div>
                    </td>
                    <td className="text-right font-mono">{h.quantity}</td>
                    <td className="text-right font-mono">
                      <span className="flex items-center justify-end gap-0.5">
                        <MudraIcon className="w-3 h-3" />{h.avgPrice?.toFixed(2)}
                      </span>
                    </td>
                    <td className="text-right font-mono">
                      <span className="flex items-center justify-end gap-0.5">
                        <MudraIcon className="w-3 h-3" />{h.currentPrice?.toFixed(2)}
                      </span>
                    </td>
                    <td className="text-right font-mono font-semibold text-white">
                      <span className="flex items-center justify-end gap-0.5">
                        <MudraIcon className="w-3 h-3" />{h.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </td>
                    <td className={`text-right font-mono ${h.pnl >= 0 ? 'text-mudra-green' : 'text-mudra-red'}`}>
                      <div className="flex items-center justify-end gap-0.5">
                        {h.pnl >= 0 ? '+' : '-'}
                        <MudraIcon className="w-3 h-3" />
                        {Math.abs(h.pnl).toFixed(0)}
                      </div>
                      <div className="text-xs">{h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(1)}%</div>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => setSelectedStock(h.stock)}
                        className="text-xs btn-outline px-2 py-1"
                      >
                        Trade
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              No active deposits. Earn up to +10% guaranteed returns in Savings.
            </div>
          ) : (
            <div className="space-y-2">
              {activeSavings.map((s) => (
                <div key={s.id} className="bg-mudra-bg/70 p-2.5 rounded-lg border border-mudra-border text-xs flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white font-mono">🪙{s.amount.toLocaleString('en-IN')}</div>
                    <div className="text-[10px] text-mudra-green">+{(s.rate * 100).toFixed(0)}% return</div>
                  </div>
                  <div className="text-right font-mono font-semibold text-mudra-gold">
                    🪙{s.payout.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              ))}
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
        <TradeModal stock={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </div>
  );
};

export default PortfolioPage;
