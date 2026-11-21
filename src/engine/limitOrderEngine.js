import { supabase } from '../supabase/client';
import { placeTrade } from '../supabase/api';

// ─── Limit Order Engine (Stop Loss & Take Profit) ─────────────────────────────
// Allows students to set Stop Loss and Take Profit thresholds.
// Evaluates automatically on every market cycle or price update.

const STORAGE_KEY_PREFIX = 'mudra_limits_';
let isExecutingLimits = false;

// 1. Get all active limit orders for a user
export const getUserLimits = (userId) => {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to load user limits:', e);
    return {};
  }
};

// 2. Set or update a limit order for a specific stock
export const setUserLimit = (userId, ticker, { stopLoss, takeProfit, quantity, entryPrice }) => {
  if (!userId || !ticker) return;
  try {
    const limits = getUserLimits(userId);
    const sl = parseFloat(stopLoss);
    const tp = parseFloat(takeProfit);
    const qty = quantity ? parseInt(quantity, 10) : null;

    if ((isNaN(sl) || sl <= 0) && (isNaN(tp) || tp <= 0)) {
      // Both empty or invalid -> remove limit
      delete limits[ticker];
    } else {
      limits[ticker] = {
        ticker,
        stopLoss: !isNaN(sl) && sl > 0 ? sl : null,
        takeProfit: !isNaN(tp) && tp > 0 ? tp : null,
        quantity: qty && qty > 0 ? qty : null,
        entryPrice: entryPrice ? parseFloat(entryPrice) : null,
        updatedAt: Date.now(),
      };
    }

    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(limits));
    window.dispatchEvent(new CustomEvent('mudra-limits-updated', { detail: { userId, limits } }));
    return limits[ticker] || null;
  } catch (e) {
    console.error('Failed to save user limit:', e);
  }
};

// 3. Clear limit order for a ticker
export const clearUserLimit = (userId, ticker) => {
  if (!userId || !ticker) return;
  try {
    const limits = getUserLimits(userId);
    delete limits[ticker];
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(limits));
    window.dispatchEvent(new CustomEvent('mudra-limits-updated', { detail: { userId, limits } }));
  } catch (e) {
    console.error('Failed to clear user limit:', e);
  }
};

// 4. Autonomous Check & Execute Limit Orders
export const checkAndExecuteLimitOrders = async (stocksMap, userId, userName) => {
  if (!userId || !stocksMap || isExecutingLimits) return [];
  const limits = getUserLimits(userId);
  const tickersWithLimits = Object.keys(limits);
  if (tickersWithLimits.length === 0) return [];

  isExecutingLimits = true;
  const executed = [];

  try {
    // Fetch live user holdings from Supabase
    const { data: holdings } = await supabase
      .from('holdings')
      .select('*')
      .eq('user_id', userId);

    if (!holdings || holdings.length === 0) {
      isExecutingLimits = false;
      return [];
    }

    const holdingMap = {};
    holdings.forEach((h) => {
      if (h.quantity > 0) holdingMap[h.ticker] = h;
    });

    for (const ticker of tickersWithLimits) {
      const limit = limits[ticker];
      const holding = holdingMap[ticker];

      // If user no longer holds any shares of this stock, remove limit
      if (!holding || holding.quantity <= 0) {
        clearUserLimit(userId, ticker);
        continue;
      }

      const stock = stocksMap[ticker] || stocksMap.find?.((s) => s.ticker === ticker);
      const currentPrice = Number(stock?.currentPrice || stock?.current_price);
      if (!currentPrice || currentPrice <= 0) continue;

      const availableQty = holding.quantity;
      const sellQty = limit.quantity ? Math.min(availableQty, limit.quantity) : availableQty;
      if (sellQty <= 0) continue;

      // Check Stop Loss
      if (limit.stopLoss && currentPrice <= limit.stopLoss) {
        try {
          await placeTrade({
            userId,
            userName: userName || 'Trader',
            ticker,
            type: 'sell',
            quantity: sellQty,
            price: currentPrice,
          });

          const pnlPerShare = currentPrice - (holding.avg_price || currentPrice);
          const totalPnl = pnlPerShare * sellQty;

          executed.push({
            type: 'stop_loss',
            ticker,
            price: currentPrice,
            triggerPrice: limit.stopLoss,
            quantity: sellQty,
            totalPnl,
            message: `🛑 Stop Loss Triggered! Sold ${sellQty} shares of ${ticker} at 🪙${currentPrice.toFixed(2)} to protect balance.`,
          });

          // Clear or decrement limit
          if (!limit.quantity || sellQty >= availableQty) {
            clearUserLimit(userId, ticker);
          } else {
            setUserLimit(userId, ticker, {
              ...limit,
              quantity: availableQty - sellQty,
            });
          }
        } catch (tradeErr) {
          console.error(`Failed to execute Stop Loss for ${ticker}:`, tradeErr);
        }
        continue;
      }

      // Check Take Profit
      if (limit.takeProfit && currentPrice >= limit.takeProfit) {
        try {
          await placeTrade({
            userId,
            userName: userName || 'Trader',
            ticker,
            type: 'sell',
            quantity: sellQty,
            price: currentPrice,
          });

          const pnlPerShare = currentPrice - (holding.avg_price || currentPrice);
          const totalPnl = pnlPerShare * sellQty;

          executed.push({
            type: 'take_profit',
            ticker,
            price: currentPrice,
            triggerPrice: limit.takeProfit,
            quantity: sellQty,
            totalPnl,
            message: `🎯 Take Profit Triggered! Sold ${sellQty} shares of ${ticker} at 🪙${currentPrice.toFixed(2)} (Locked profit: +🪙${Math.max(0, totalPnl).toFixed(0)}).`,
          });

          // Clear or decrement limit
          if (!limit.quantity || sellQty >= availableQty) {
            clearUserLimit(userId, ticker);
          } else {
            setUserLimit(userId, ticker, {
              ...limit,
              quantity: availableQty - sellQty,
            });
          }
        } catch (tradeErr) {
          console.error(`Failed to execute Take Profit for ${ticker}:`, tradeErr);
        }
      }
    }

    if (executed.length > 0) {
      window.dispatchEvent(new CustomEvent('mudra-limits-executed', { detail: { executed } }));
    }
  } catch (err) {
    console.error('Error in limit order execution check:', err);
  } finally {
    isExecutingLimits = false;
  }

  return executed;
};
