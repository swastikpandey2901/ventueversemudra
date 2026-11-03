import { Link } from 'react-router-dom';
import { SECTOR_COLORS } from '../data/companies';
import MiniChart from './MiniChart';
import MudraIcon from './MudraIcon';

const getCategoryBadge = (cat) => {
  if (cat === 'L') return '🔵';
  if (cat === 'M') return '🟡';
  return '🔴';
};

const CompanyCard = ({ stock }) => {
  if (!stock) return null;

  const change = stock.previousPrice
    ? ((stock.currentPrice - stock.previousPrice) / stock.previousPrice) * 100
    : 0;
  const isUp = change >= 0;
  const color = SECTOR_COLORS[stock.sector] || '#6366f1';

  return (
    <Link
      to={`/company/${stock.ticker}`}
      className="card hover:border-mudra-accent/50 transition-all duration-300 hover:scale-[1.02] cursor-pointer block"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded font-mono"
              style={{ backgroundColor: color + '22', color }}
            >
              {stock.ticker}
            </span>
            <span className="text-xs text-mudra-muted">{stock.sector}</span>
          </div>
          <h3 className="text-sm font-semibold text-white mt-1 leading-tight">{stock.name}</h3>
        </div>
        <span className="text-lg">{getCategoryBadge(stock.category)}</span>
      </div>

      {/* Mini Chart */}
      <div className="h-14 mb-3">
        <MiniChart data={stock.priceHistory || []} isUp={isUp} />
      </div>

      {/* Price row */}
      <div className="flex items-end justify-between">
        <div className="text-xl font-bold font-mono text-white flex items-center gap-1.5">
          <MudraIcon className="w-4 h-4" />
          {stock.currentPrice?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </div>
        <div className={`text-xs font-mono font-semibold ${isUp ? 'text-mudra-green' : 'text-mudra-red'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
        </div>
      </div>
      <div className="flex items-center justify-end mt-0.5">
        <div className="text-xs text-mudra-muted">
          Cap: {stock.category === 'L' ? 'Large' : stock.category === 'M' ? 'Mid' : 'Small'}
        </div>
      </div>
    </Link>
  );
};

export default CompanyCard;
