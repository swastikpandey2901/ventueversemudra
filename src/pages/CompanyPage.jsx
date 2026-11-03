import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { subscribeStock } from '../supabase/api';
import { getCompany } from '../data/companies';
import StockChart from '../components/StockChart';
import TradeModal from '../components/TradeModal';
import { useAuth } from '../context/AuthContext';
import { SECTOR_COLORS } from '../data/companies';
import MudraIcon from '../components/MudraIcon';

const CompanyPage = () => {
  const { ticker } = useParams();
  const { user } = useAuth();
  const [stock, setStock] = useState(null);
  const [tradeOpen, setTradeOpen] = useState(false);
  const company = getCompany(ticker);

  useEffect(() => {
    if (!ticker) return;
    const unsub = subscribeStock(ticker, setStock);
    return unsub;
  }, [ticker]);

  if (!stock) {
    return (
      <div className="flex items-center justify-center h-64 text-mudra-muted">
        Loading {ticker}...
      </div>
    );
  }

  const change = stock.previousPrice
    ? ((stock.currentPrice - stock.previousPrice) / stock.previousPrice) * 100
    : 0;
  const isUp = change >= 0;
  const color = SECTOR_COLORS[stock.sector] || '#6366f1';

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span
              className="text-sm font-bold px-3 py-1 rounded font-mono"
              style={{ backgroundColor: color + '22', color }}
            >
              {stock.ticker}
            </span>
            <span className="text-mudra-muted text-sm">{stock.sector}</span>
            <span className="badge-gold">
              {stock.category === 'L' ? 'Large Cap' : stock.category === 'M' ? 'Mid Cap' : 'Small Cap'}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white">{stock.name}</h1>
          {company?.description && (
            <p className="text-mudra-muted text-sm mt-2 max-w-xl">{company.description}</p>
          )}
        </div>

        {/* Price panel */}
        <div className="card text-right min-w-[160px]">
          <div className="text-3xl font-black font-mono text-white flex items-center justify-end gap-1.5">
            <MudraIcon className="w-6 h-6" />
            {stock.currentPrice?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className={`text-lg font-mono font-semibold ${isUp ? 'text-mudra-green' : 'text-mudra-red'}`}>
            {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
          </div>
          <div className="text-xs text-mudra-muted mt-1 flex items-center justify-end gap-1">
            Prev: <MudraIcon className="w-3 h-3" />{stock.previousPrice?.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card mb-6" style={{ height: 320 }}>
        <StockChart data={stock.priceHistory} startPrice={company?.startPrice} />
      </div>

      {/* Trade Button */}
      {user && (
        <div className="flex gap-3">
          <button
            onClick={() => setTradeOpen(true)}
            className="btn-green flex-1 py-4 text-base"
          >
            Buy / Sell {stock.ticker}
          </button>
        </div>
      )}

      {tradeOpen && (
        <TradeModal stock={stock} onClose={() => setTradeOpen(false)} />
      )}
    </div>
  );
};

export default CompanyPage;
