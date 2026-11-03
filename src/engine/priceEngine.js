import { supabase } from '../supabase/client';

// ─── Price Engine ─────────────────────────────────────────────────────────────
// Runs every 30 seconds (or configurable) from the Admin panel.
// Formula:
//   netFlow = buyVolume - sellVolume (in Mudra Coins)
//   impact  = netFlow / (currentPrice * liquidityFactor)
//   jitter  = random ±0.2%  (base volatility)
//   newPrice = currentPrice × (1 + impact + jitter)
//   Min price = ₹1.00

const BASE_JITTER = 0.002; // ±0.2%
const MAX_HISTORY = 200;

const jitter = () => (Math.random() - 0.5) * 2 * BASE_JITTER;

export const runPriceCycle = async () => {
  try {
    const { data: stocks, error } = await supabase.from('stocks').select('*');
    if (error || !stocks) {
      console.error('Failed to load stocks for price cycle:', error);
      return false;
    }

    const now = Date.now();

    const updates = stocks.map(async (stock) => {
      const currentPrice = Number(stock.current_price);
      const buyVolume = Number(stock.buy_volume || 0);
      const sellVolume = Number(stock.sell_volume || 0);
      const liquidityFactor = Number(stock.liquidity_factor || 300000);

      // 1. Calculate net order flow impact
      const netFlow = buyVolume - sellVolume;
      const impact = netFlow / (currentPrice * liquidityFactor);
      const j = jitter();

      // 2. Check AI Dynamic Target Shift OR pending news shock
      let newPrice;
      let clearShock = false;

      if (stock.pending_shock !== null && Number(stock.pending_shock_at) === 1) {
        // Mode B: AI Dynamic Target Shift
        const targetPrice = Number(stock.pending_shock);
        const diff = targetPrice - currentPrice;
        if (Math.abs(diff) <= 0.35 || Math.abs(diff) / currentPrice < 0.003) {
          // Reached target within 0.3%! Snap to target and complete the shift
          newPrice = targetPrice;
          clearShock = true;
        } else {
          // Move ~22% closer to target each cycle with realistic micro-volatility
          const driftStep = diff * 0.22;
          const microJitter = (Math.random() - 0.49) * 0.003 * currentPrice;
          newPrice = Math.max(1, parseFloat((currentPrice + driftStep + microJitter).toFixed(2)));
        }
      } else {
        // Standard Market Order Flow + News Shock:
        let shockImpact = 0;
        if (stock.pending_shock !== null && stock.pending_shock_at) {
          if (now >= Number(stock.pending_shock_at)) {
            shockImpact = Number(stock.pending_shock) / 100;
            clearShock = true;
          }
        }
        const totalImpact = impact + j + shockImpact;
        const rawNewPrice = currentPrice * (1 + totalImpact);
        newPrice = Math.max(1, parseFloat(rawNewPrice.toFixed(2)));
      }

      // 3. Update price history array
      let history = Array.isArray(stock.price_history) ? [...stock.price_history] : [];
      history.push({ price: newPrice, timestamp: now });
      if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY);
      }

      // 4. Commit to Supabase
      const updatePayload = {
        previous_price: currentPrice,
        current_price: newPrice,
        price_history: history,
        buy_volume: 0,
        sell_volume: 0,
        updated_at: new Date().toISOString(),
      };

      if (clearShock) {
        updatePayload.pending_shock = null;
        updatePayload.pending_shock_at = null;
      }

      return supabase
        .from('stocks')
        .update(updatePayload)
        .eq('ticker', stock.ticker);
    });

    await Promise.all(updates);

    // Also update commodities and mutual funds
    await Promise.all([runCommodityCycle(), runMutualFundCycle()]);

    return true;
  } catch (err) {
    console.error('Price cycle execution error:', err);
    return false;
  }
};

let isRunningCycle = false;

// ─── Autonomous Distributed Heartbeat (Always On) ──────────────────────────
export const runAutonomousCycleIfNeeded = async () => {
  if (isRunningCycle) return;
  try {
    isRunningCycle = true;
    const { data } = await supabase
      .from('stocks')
      .select('updated_at')
      .limit(1)
      .single();

    if (data?.updated_at) {
      const lastUpdate = new Date(data.updated_at).getTime();
      const elapsed = Date.now() - lastUpdate;
      // If ticked less than 28s ago, let the current tick breathe
      if (elapsed < 28000) {
        return;
      }
    }

    await runPriceCycle();
  } catch (err) {
    console.error('Autonomous cycle error:', err);
  } finally {
    isRunningCycle = false;
  }
};

// ─── Commodity Cycle (Gold & Silver slow drift) ──────────────────────────────
export const runCommodityCycle = async () => {
  try {
    const { data: commodities, error } = await supabase.from('commodities').select('*');
    if (error || !commodities) return false;

    const now = Date.now();
    const updates = commodities.map(async (c) => {
      const curPrice = Number(c.current_price);
      // Gentle drift: ±0.15%
      const drift = (Math.random() - 0.48) * 0.003; // slight upward bias
      const newPrice = Math.max(10, parseFloat((curPrice * (1 + drift)).toFixed(2)));

      let history = Array.isArray(c.price_history) ? [...c.price_history] : [];
      history.push({ price: newPrice, timestamp: now });
      if (history.length > 100) history.splice(0, history.length - 100);

      return supabase
        .from('commodities')
        .update({
          previous_price: curPrice,
          current_price: newPrice,
          price_history: history,
          updated_at: new Date().toISOString(),
        })
        .eq('symbol', c.symbol);
    });

    await Promise.all(updates);
    return true;
  } catch (e) {
    console.error('Commodity cycle error:', e);
    return false;
  }
};

// ─── Mutual Fund Cycle (NAV fixed/steady growth) ─────────────────────────────
export const runMutualFundCycle = async () => {
  try {
    const { data: funds, error } = await supabase.from('mutual_funds').select('*');
    if (error || !funds) return false;

    const now = Date.now();
    const updates = funds.map(async (f) => {
      const curNav = Number(f.nav);
      const dailyRate = Number(f.daily_return_rate || 0.005);
      // Steady progress per 30s cycle
      const cycleGrowth = (dailyRate / 100) + (Math.random() - 0.45) * 0.0004;
      const newNav = Math.max(1, parseFloat((curNav * (1 + cycleGrowth)).toFixed(3)));

      let history = Array.isArray(f.price_history) ? [...f.price_history] : [];
      history.push({ price: newNav, timestamp: now });
      if (history.length > 100) history.splice(0, history.length - 100);

      return supabase
        .from('mutual_funds')
        .update({
          prev_nav: curNav,
          nav: newNav,
          price_history: history,
          updated_at: new Date().toISOString(),
        })
        .eq('id', f.id);
    });

    await Promise.all(updates);
    return true;
  } catch (e) {
    console.error('Mutual fund cycle error:', e);
    return false;
  }
};

// ─── Apply News Shock ─────────────────────────────────────────────────────────
export const scheduleNewsShock = async (tickers, shockPercent) => {
  const shockAt = Date.now() + 5 * 60 * 1000; // 5 minutes from now
  const updates = tickers.map(async (ticker) => {
    return supabase
      .from('stocks')
      .update({
        pending_shock: shockPercent,
        pending_shock_at: shockAt,
      })
      .eq('ticker', ticker);
  });
  await Promise.all(updates);
};

// ─── Seed Stocks ─────────────────────────────────────────────────────────────
export const seedStocks = async (companies) => {
  // 1. Cleanly remove old stocks so no obsolete company names linger
  await supabase.from('stocks').delete().neq('ticker', '___DUMMY___');

  const rows = companies.map((c) => ({
    ticker: c.ticker,
    name: c.name,
    short_name: c.shortName,
    sector: c.sector,
    category: c.category,
    start_price: c.startPrice,
    current_price: c.startPrice,
    previous_price: c.startPrice,
    liquidity_factor: c.liquidityFactor,
    price_history: Array.isArray(c.priceHistory) && c.priceHistory.length > 0
      ? c.priceHistory
      : [{ price: c.startPrice, timestamp: Date.now() }],
    pending_shock: null,
    pending_shock_at: null,
    buy_volume: 0,
    sell_volume: 0,
  }));

  const { error } = await supabase.from('stocks').upsert(rows, { onConflict: 'ticker' });
  if (error) {
    console.error('Error seeding stocks:', error);
    throw error;
  }
};

export const godSetStockPrice = async (ticker, newPrice) => {
  const cleanPrice = Math.max(1, parseFloat(Number(newPrice).toFixed(2)));
  if (isNaN(cleanPrice)) throw new Error('Please enter a valid target price.');

  const { data: stock, error: fetchErr } = await supabase
    .from('stocks')
    .select('*')
    .eq('ticker', ticker)
    .single();
  if (fetchErr || !stock) throw new Error('Stock not found');

  const now = Date.now();
  let history = Array.isArray(stock.price_history) ? [...stock.price_history] : [];
  history.push({ price: cleanPrice, timestamp: now });
  if (history.length > 200) history.splice(0, history.length - 200);

  const { error } = await supabase
    .from('stocks')
    .update({
      previous_price: stock.current_price,
      current_price: cleanPrice,
      price_history: history,
      pending_shock: null,
      pending_shock_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('ticker', ticker);

  if (error) throw error;
  return cleanPrice;
};

// Mode B: Move to Target (Dynamic AI Shift over cycles)
export const godMoveToTargetPrice = async (ticker, targetPrice) => {
  const cleanTarget = Math.max(1, parseFloat(Number(targetPrice).toFixed(2)));
  if (isNaN(cleanTarget)) throw new Error('Please enter a valid target price.');

  const { error } = await supabase
    .from('stocks')
    .update({
      pending_shock: cleanTarget,
      pending_shock_at: 1, // Sentinel indicating active AI Target Shift
      updated_at: new Date().toISOString(),
    })
    .eq('ticker', ticker);

  if (error) throw error;
  return cleanTarget;
};

// Cancel AI Target Shift
export const godCancelTargetPrice = async (ticker) => {
  const { error } = await supabase
    .from('stocks')
    .update({
      pending_shock: null,
      pending_shock_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('ticker', ticker);

  if (error) throw error;
  return true;
};
