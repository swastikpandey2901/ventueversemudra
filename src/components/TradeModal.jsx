import { useState, useRef, useEffect } from 'react';
import { placeTrade, getUserHoldings } from '../supabase/api';
import { useAuth } from '../context/AuthContext';
import MudraIcon from './MudraIcon';

const TradeModal = ({ stock, onClose, defaultType = 'buy' }) => {
  const { user, userData, refreshUserData } = useAuth();
  const [type, setType] = useState(defaultType);
  const [quantity, setQuantity] = useState(1);
  const [holdingQty, setHoldingQty] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const isSubmittingRef = useRef(false);

  // Fetch current user holding quantity for this specific stock
  useEffect(() => {
    const currentUserId = user?.id || user?.uid;
    if (currentUserId && stock?.ticker) {
      getUserHoldings(currentUserId).then((holdings) => {
        const item = holdings.find((h) => h.ticker === stock.ticker);
        setUserHolding(item ? Number(item.quantity) : 0);
      });
    }
  }, [user, stock?.ticker]);

  const setUserHolding = (qty) => {
    setHoldingQty(qty);
    if (type === 'sell' && qty > 0 && quantity === 1) {
      // Default to 1 or existing
    }
  };

  if (!stock) return null;

  const availableCash = Number(userData?.cash || 0);
  const currentPrice = Number(stock.currentPrice || 1);
  const maxBuyQty = Math.max(0, Math.floor(availableCash / currentPrice));
  const maxSellQty = Math.max(0, holdingQty);

  const validQty = Math.max(0, Math.floor(Number(quantity) || 0));
  const totalCost = validQty * currentPrice;

  // Quick Action: Buy Max
  const handleBuyMax = () => {
    if (maxBuyQty > 0) {
      setQuantity(maxBuyQty);
      setError('');
    } else {
      setError('Insufficient balance to buy even 1 share.');
    }
  };

  // Quick Action: Sell All Holdings
  const handleSellAll = () => {
    if (maxSellQty > 0) {
      setQuantity(maxSellQty);
      setError('');
    } else {
      setError(`You do not own any shares of ${stock.ticker} to sell.`);
    }
  };

  // Quick Percentage Setter
  const handleSetPercent = (pct) => {
    const max = type === 'buy' ? maxBuyQty : maxSellQty;
    if (max <= 0) return;
    const calc = Math.max(1, Math.floor(max * pct));
    setQuantity(calc);
    setError('');
  };

  const handleTrade = async () => {
    if (isSubmittingRef.current || loading) return;

    const cleanQty = Math.max(1, Math.floor(Number(quantity) || 0));
    if (cleanQty <= 0) {
      setError('Enter a valid quantity of at least 1 share.');
      return;
    }

    if (type === 'buy' && cleanQty > maxBuyQty) {
      setError(`Insufficient cash! Maximum buyable with current balance is ${maxBuyQty} shares.`);
      return;
    }

    if (type === 'sell' && cleanQty > maxSellQty) {
      setError(`You only hold ${maxSellQty} shares of ${stock.ticker}.`);
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
        `${type === 'buy' ? '✅ Successfully Bought' : '✅ Successfully Sold'} ${cleanQty} share${cleanQty > 1 ? 's' : ''} of ${stock.ticker} @ 🪙${stock.currentPrice.toLocaleString('en-IN')}`
      );
      await refreshUserData();
      // Update local holding
      setHoldingQty((prev) => (type === 'buy' ? prev + cleanQty : Math.max(0, prev - cleanQty)));
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err.message || 'Trade execution failed.');
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const isBuyDisabled = type === 'buy' && (maxBuyQty === 0 || validQty > maxBuyQty);
  const isSellDisabled = type === 'sell' && (maxSellQty === 0 || validQty > maxSellQty);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md animate-fadeIn space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-mudra-border/60">
          <div>
            <h2 className="text-lg font-bold text-white">{stock.name}</h2>
            <div className="flex items-center gap-2">
              <span className="text-mudra-muted text-xs font-mono">{stock.ticker}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-mudra-bg border border-mudra-border text-mudra-muted">
                {stock.sector || 'Equities'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-mudra-muted hover:text-white text-xl transition-colors p-1"
          >
            ✕
          </button>
        </div>

        {/* Live Market Price */}
        <div className="bg-mudra-bg/90 rounded-xl p-3 flex justify-between items-center border border-mudra-border/60">
          <span className="text-mudra-muted text-xs">Current Market Price</span>
          <span className="text-2xl font-bold font-mono text-white flex items-center gap-1.5">
            <MudraIcon className="w-5 h-5" />
            {stock.currentPrice?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Buy / Sell Tab Switcher */}
        <div className="flex gap-2 bg-mudra-bg p-1 rounded-xl border border-mudra-border">
          <button
            type="button"
            onClick={() => {
              setType('buy');
              setError('');
              if (maxBuyQty > 0 && quantity > maxBuyQty) setQuantity(Math.max(1, maxBuyQty));
            }}
            className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
              type === 'buy'
                ? 'bg-mudra-green text-black shadow-md'
                : 'text-mudra-muted hover:text-white'
            }`}
          >
            <span>📈</span>
            <span>Buy Shares</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setType('sell');
              setError('');
              if (maxSellQty > 0 && (quantity > maxSellQty || quantity === 0)) {
                setQuantity(maxSellQty);
              }
            }}
            className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
              type === 'sell'
                ? 'bg-mudra-red text-white shadow-md'
                : 'text-mudra-muted hover:text-white'
            }`}
          >
            <span>📉</span>
            <span>Sell Shares</span>
          </button>
        </div>

        {/* Balance / Portfolio Holdings Info Row */}
        <div className="bg-mudra-bg/70 border border-mudra-border/60 rounded-xl p-2.5 flex items-center justify-between text-xs">
          {type === 'buy' ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-mudra-muted">🪙 Cash Balance:</span>
                <span className="font-mono font-bold text-white">
                  🪙{availableCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-mudra-muted">Max Buy:</span>
                <span className="font-mono font-bold text-mudra-gold">
                  {maxBuyQty.toLocaleString('en-IN')} shares
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-mudra-muted">📦 Your Holdings:</span>
                <span className="font-mono font-bold text-white">
                  {holdingQty.toLocaleString('en-IN')} {holdingQty === 1 ? 'share' : 'shares'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-mudra-muted">Holding Value:</span>
                <span className="font-mono font-bold text-mudra-green">
                  🪙{(holdingQty * currentPrice).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Quantity Controls & Quick-Action Max/All Buttons */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-mudra-muted font-medium">Quantity to Trade</label>
            {type === 'buy' ? (
              <button
                type="button"
                onClick={handleBuyMax}
                disabled={maxBuyQty === 0}
                className="text-xs text-mudra-accent font-bold hover:underline flex items-center gap-1 disabled:opacity-40 disabled:no-underline"
              >
                <span>⚡ Buy Maximum ({maxBuyQty})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSellAll}
                disabled={maxSellQty === 0}
                className="text-xs text-mudra-red font-bold hover:underline flex items-center gap-1 disabled:opacity-40 disabled:no-underline"
              >
                <span>⚡ Sell All ({maxSellQty})</span>
              </button>
            )}
          </div>

          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, (Number(q) || 1) - 1))}
              className="btn-outline w-12 h-11 text-lg font-bold flex items-center justify-center rounded-xl"
            >
              −
            </button>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => {
                const val = e.target.value;
                setQuantity(val === '' ? '' : Math.max(1, parseInt(val, 10) || 1));
              }}
              onBlur={() => {
                if (!quantity || Number(quantity) < 1) setQuantity(1);
              }}
              className="input text-center font-mono text-xl font-bold flex-1 h-11 rounded-xl"
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => (Number(q) || 0) + 1)}
              className="btn-outline w-12 h-11 text-lg font-bold flex items-center justify-center rounded-xl"
            >
              +
            </button>
          </div>

          {/* Quick-Fill Presets (25%, 50%, 75%, Max / All) */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[
              { label: '25%', factor: 0.25 },
              { label: '50%', factor: 0.50 },
              { label: '75%', factor: 0.75 },
              { label: type === 'buy' ? '⚡ MAX BUY' : '⚡ SELL ALL', factor: 1.0 },
            ].map((p) => {
              const maxAvailable = type === 'buy' ? maxBuyQty : maxSellQty;
              const targetQty = Math.max(1, Math.floor(maxAvailable * p.factor));
              const isSelected = maxAvailable > 0 && Number(quantity) === targetQty;

              return (
                <button
                  key={p.label}
                  type="button"
                  disabled={maxAvailable === 0}
                  onClick={() => (p.factor === 1.0 ? (type === 'buy' ? handleBuyMax() : handleSellAll()) : handleSetPercent(p.factor))}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all border disabled:opacity-30 disabled:cursor-not-allowed ${
                    isSelected
                      ? type === 'buy'
                        ? 'bg-mudra-green text-black border-mudra-green shadow'
                        : 'bg-mudra-red text-white border-mudra-red shadow'
                      : 'bg-mudra-bg border-mudra-border text-mudra-muted hover:text-white hover:border-mudra-muted'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-mudra-bg rounded-xl p-3 space-y-2 text-xs border border-mudra-border/60">
          <div className="flex justify-between text-mudra-muted">
            <span>Price Per Share</span>
            <span className="font-mono text-white flex items-center gap-1 font-semibold">
              <MudraIcon className="w-3.5 h-3.5" />
              {currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-mudra-muted">
            <span>Order Quantity</span>
            <span className="font-mono text-white font-bold">{validQty.toLocaleString('en-IN')} shares</span>
          </div>
          <div className="border-t border-mudra-border/60 my-1" />
          <div className="flex justify-between items-center text-sm font-semibold">
            <span className="text-mudra-muted">
              Total {type === 'buy' ? 'Investment' : 'Proceeds'}
            </span>
            <span
              className={`font-mono text-base flex items-center gap-1 font-bold ${
                type === 'buy' ? 'text-amber-400' : 'text-mudra-green'
              }`}
            >
              <MudraIcon className="w-4 h-4" />
              {totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Remaining Cash preview */}
          {type === 'buy' && (
            <div className="flex justify-between text-[11px] text-mudra-muted pt-1 border-t border-mudra-border/40">
              <span>Remaining Cash:</span>
              <span
                className={`font-mono font-bold ${
                  availableCash >= totalCost ? 'text-white' : 'text-mudra-red'
                }`}
              >
                🪙{Math.max(0, availableCash - totalCost).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>

        {/* Error / Success Feedback */}
        {error && (
          <div className="text-mudra-red text-xs bg-red-950/40 border border-red-500/40 rounded-lg p-2.5 font-semibold">
            {error}
          </div>
        )}
        {success && (
          <div className="text-mudra-green text-xs bg-emerald-950/40 border border-emerald-500/40 rounded-lg p-2.5 font-semibold">
            {success}
          </div>
        )}

        {/* Confirmation Button */}
        <button
          onClick={handleTrade}
          disabled={loading || validQty <= 0 || isBuyDisabled || isSellDisabled}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all shadow-md ${
            type === 'buy' ? 'btn-green' : 'btn-red'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {loading
            ? 'Executing Trade...'
            : type === 'buy'
            ? maxBuyQty === 0
              ? 'Insufficient Cash to Buy'
              : `Confirm Buy (${validQty.toLocaleString('en-IN')} shares)`
            : maxSellQty === 0
            ? 'No Shares to Sell'
            : `Confirm Sell (${validQty.toLocaleString('en-IN')} shares)`}
        </button>
      </div>
    </div>
  );
};

export default TradeModal;
