import { useEffect, useState } from 'react';
import { subscribeStocks } from '../supabase/api';
import CompanyCard from '../components/CompanyCard';
import { SECTORS } from '../data/companies';

const MarketPage = () => {
  const [stocks, setStocks] = useState([]);
  const [sector, setSector] = useState('All');
  const [search, setSearch] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    const unsub = subscribeStocks((data) => {
      setStocks(data);
      setLastUpdate(new Date());
    });
    return unsub;
  }, []);

  const filtered = stocks.filter(s => {
    const matchSector = sector === 'All' || s.sector === sector;
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
      || s.ticker.toLowerCase().includes(search.toLowerCase());
    return matchSector && matchSearch;
  });

  // Sort by % change desc
  const sorted = [...filtered].sort((a, b) => {
    const da = a.previousPrice ? ((a.currentPrice - a.previousPrice) / a.previousPrice) : 0;
    const db = b.previousPrice ? ((b.currentPrice - b.previousPrice) / b.previousPrice) : 0;
    return db - da;
  });

  const gainers = stocks
    .filter(s => s.previousPrice)
    .sort((a, b) => ((b.currentPrice - b.previousPrice) / b.previousPrice) - ((a.currentPrice - a.previousPrice) / a.previousPrice))
    .slice(0, 3);

  const losers = stocks
    .filter(s => s.previousPrice)
    .sort((a, b) => ((a.currentPrice - a.previousPrice) / a.previousPrice) - ((b.currentPrice - b.previousPrice) / b.previousPrice))
    .slice(0, 3);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Market</h1>
          <p className="text-mudra-muted text-sm">
            {stocks.length} companies live
            {lastUpdate && ` · Updated ${lastUpdate.toLocaleTimeString('en-IN')}`}
          </p>
        </div>
      </div>

      {/* Top Gainers / Losers */}
      {stocks.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="card">
            <h3 className="text-xs font-semibold text-mudra-green uppercase tracking-wider mb-3">🚀 Top Gainers</h3>
            <div className="space-y-2">
              {gainers.map(s => {
                const pct = ((s.currentPrice - s.previousPrice) / s.previousPrice * 100).toFixed(2);
                return (
                  <div key={s.ticker} className="flex items-center justify-between">
                    <span className="text-sm text-white font-mono">{s.ticker}</span>
                    <span className="text-mudra-green font-mono text-sm">+{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card">
            <h3 className="text-xs font-semibold text-mudra-red uppercase tracking-wider mb-3">📉 Top Losers</h3>
            <div className="space-y-2">
              {losers.map(s => {
                const pct = ((s.currentPrice - s.previousPrice) / s.previousPrice * 100).toFixed(2);
                return (
                  <div key={s.ticker} className="flex items-center justify-between">
                    <span className="text-sm text-white font-mono">{s.ticker}</span>
                    <span className="text-mudra-red font-mono text-sm">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          className="input w-48 text-sm"
          placeholder="Search company..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {['All', ...SECTORS].map(s => (
            <button
              key={s}
              onClick={() => setSector(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                sector === s
                  ? 'bg-mudra-accent text-white'
                  : 'bg-mudra-card border border-mudra-border text-mudra-muted hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Company Grid */}
      {stocks.length === 0 ? (
        <div className="text-center py-20 text-mudra-muted">
          <div className="text-4xl mb-3">📊</div>
          <p>Market data loading... Admin needs to seed stocks first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map(stock => (
            <CompanyCard key={stock.ticker} stock={stock} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MarketPage;
