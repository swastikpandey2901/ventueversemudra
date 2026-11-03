import { useState, useRef } from 'react';
import { placeTrade } from '../supabase/api';
import { useAuth } from '../context/AuthContext';
import MudraIcon from './MudraIcon';

const TradeModal = ({ stock, onClose }) => {
  const { user, userData, refreshUserData } = useAuth();
  const [type, setType] = useState('buy');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const isSubmittingRef = useRef(false);

  if (!stock) return null;

  const validQty = Math.max(1, Math.floor(Number(quantity) || 1));
  const totalCost = validQty * stock.currentPrice;
  const maxBuyQty = Math.max(0, Math.floor((userData?.cash || 0) / stock.currentPrice));

  const handleTrade = async () => {
    if (isSubmittingRef.current || loading) return;

    const cleanQty = Math.max(1, Math.floor(Number(quantity) || 1));
    if (cleanQty <= 0) {
      setError('Enter a valid quantity (1 or more)');
      return;
    }

    isSubmittingRef.current = true;
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const currentUserId = user?.id || user?.uid;
      if (!currentUserId) throw new Error('User not logged in');

      await placeTrade({
        userId: currentUserId,
        userName: userData?.name || 'Trader',
        ticker: stock.ticker,
        type,
        quantity: cleanQty,
        price: stock.currentPrice,
      });

      setSuccess(
        `${type === 'buy' ? '✅ Bought' : '✅ Sold'} ${cleanQty} share${cleanQty > 1 ? 's' : ''} of ${stock.ticker} @ 🪙${stock.currentPrice.toLocaleString('en-IN')}`
      );
      await refreshUserData();
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err.message || 'Trade execution failed.');
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">{stock.name}</h2>
            <span className="text-mudra-muted text-sm font-mono">{stock.ticker}</span>
          </div>
          <button onClick={onClose} className="text-mudra-muted hover:text-white text-xl transition-colors">✕</button>
        </div>

        {/* Price */}
        <div className="bg-mudra-bg rounded-lg p-3 mb-4 flex justify-between items-center">
          <span className="text-mudra-muted text-sm">Current Price</span>
          <span className="text-2xl font-bold font-mono text-white flex items-center gap-1.5">
            <MudraIcon className="w-5 h-5" />
            {stock.currentPrice?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Buy / Sell Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setType('buy')}
            className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-all ${type === 'buy' ? 'bg-mudra-green text-black' : 'bg-mudra-bg text-mudra-muted hover:text-white'}`}
          >
            Buy
          </button>
          <button
            onClick={() => setType('sell')}
            className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-all ${type === 'sell' ? 'bg-mudra-red text-white' : 'bg-mudra-bg text-mudra-muted hover:text-white'}`}
          >
            Sell
          </button>
        </div>

        {/* Quantity */}
        <div className="mb-3">
          <label className="text-xs text-mudra-muted mb-1 block">Quantity</label>
          <div className="flex gap-2">
            <button onClick={() => setQuantity(q => Math.max(1, (Number(q) || 1) - 1))} className="btn-outline w-10 text-lg">−</button>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={e => {
                const val = e.target.value;
                setQuantity(val === '' ? '' : Math.max(1, parseInt(val, 10) || 1));
              }}
              onBlur={() => {
                if (!quantity || Number(quantity) < 1) setQuantity(1);
              }}
              className="input text-center font-mono text-lg"
            />
            <button onClick={() => setQuantity(q => (Number(q) || 0) + 1)} className="btn-outline w-10 text-lg">+</button>
          </div>
          {type === 'buy' && (
            <button
              onClick={() => setQuantity(maxBuyQty)}
              className="text-xs text-mudra-accent mt-1 hover:underline"
            >
              Max: {maxBuyQty} shares
            </button>
          )}
        </div>

        {/* Summary */}
        <div className="bg-mudra-bg rounded-lg p-3 mb-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-mudra-muted">Price per share</span>
            <span className="font-mono text-white flex items-center gap-1">
              <MudraIcon className="w-3.5 h-3.5" />
              {stock.currentPrice?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-mudra-muted">Quantity</span>
            <span className="font-mono text-white">{quantity}</span>
          </div>
          <div className="border-t border-mudra-border my-1" />
          <div className="flex justify-between font-semibold">
            <span className="text-mudra-muted">Total {type === 'buy' ? 'Cost' : 'Credit'}</span>
            <span className={`font-mono text-lg flex items-center gap-1 ${type === 'buy' ? 'text-mudra-red' : 'text-mudra-green'}`}>
              <MudraIcon className="w-4 h-4" />
              {totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-mudra-muted">Your cash</span>
            <span className="text-mudra-muted font-mono flex items-center gap-1">
              <MudraIcon className="w-3 h-3" />
              {(userData?.cash || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {error && <div className="text-mudra-red text-sm mb-3 bg-red-900/20 rounded p-2">{error}</div>}
        {success && <div className="text-mudra-green text-sm mb-3 bg-emerald-900/20 rounded p-2">{success}</div>}

        <button
          onClick={handleTrade}
          disabled={loading || quantity <= 0}
          className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${type === 'buy' ? 'btn-green' : 'btn-red'}`}
        >
          {loading ? 'Processing...' : `Confirm ${type === 'buy' ? 'Buy' : 'Sell'}`}
        </button>
      </div>
    </div>
  );
};

export default TradeModal;
