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

      // 1. Calculate normalized net order flow impact (with diminishing returns & cycle circuit breaker)
      // Prevents massive violent price shocks when large sums of money are invested
      const netFlow = buyVolume - sellVolume;
      let impact = 0;
      if (netFlow !== 0) {
        // Effective depth baseline in Mudra Coins prevents penny-stock hypersensitivity
        const effectivePrice = Math.max(100, Math.min(1000, currentPrice));
        const marketDepth = effectivePrice * liquidityFactor;
        const rawRatio = netFlow / marketDepth;

        // Hyperbolic tangent (tanh) curves large investments smoothly into realistic market movement:
        // - Small trades (±🪙5k - 🪙25k): organic micro-movement (±0.1% to ±0.6%)
        // - Large trades (±🪙1L - 🪙2L): noticeable market movement (±1.5% to ±2.8%)
        // - Whale / massive investments: smoothly saturated at circuit ceiling (max ±4.0% per 30s cycle)
        const MAX_CYCLE_FLOW_IMPACT = 0.04; // ±4.0% max order-flow move per cycle
        const SENSITIVITY = 0.025;
        impact = MAX_CYCLE_FLOW_IMPACT * Math.tanh(rawRatio / SENSITIVITY);
      }
      const j = jitter();

      // 2. Check AI Dynamic Target Shift OR pending news shock
      let newPrice;
      let clearShock = false;
      const shockAtNum = Number(stock.pending_shock_at);
      const isTargetShift = stock.pending_shock !== null && (shockAtNum < 0 || shockAtNum === 1);

      if (isTargetShift) {
        // Mode B: AI Dynamic Target Shift towards target price by deadline
        const targetPrice = Number(stock.pending_shock);
        // If shockAtNum < 0, deadline is Math.abs(shockAtNum), otherwise fallback to 5 minutes
        const targetDeadline = shockAtNum < 0 ? Math.abs(shockAtNum) : (now + 5 * 60 * 1000);
        const remainingMs = targetDeadline - now;
        const diff = targetPrice - currentPrice;

        // If time is up, or diff is within 0.35 or 0.3%
        if (remainingMs <= 10000 || Math.abs(diff) <= 0.35 || (Math.abs(diff) / currentPrice) < 0.003) {
          // Snap directly to target upon reaching deadline/price
          newPrice = targetPrice;
          clearShock = true;
        } else {
          // Calculate cycles remaining based on remaining time (each cycle is ~30s)
          const cyclesRemaining = Math.max(1, Math.round(remainingMs / 30000));
          // Move exactly a proportional step towards the target
          const driftStep = diff / cyclesRemaining;
          // Add subtle organic micro-volatility (±0.25% market noise)
          const microJitter = (Math.random() - 0.49) * 0.003 * currentPrice;
          newPrice = Math.max(1, parseFloat((currentPrice + driftStep + microJitter).toFixed(2)));
        }
      } else {
        // Standard Market Order Flow + News Shock:
        let shockImpact = 0;
        if (stock.pending_shock !== null && stock.pending_shock_at && shockAtNum > 1) {
          if (now >= shockAtNum) {
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

// Mode B: Move to Target (Dynamic AI Shift over specified duration or target time)
export const godMoveToTargetPrice = async (ticker, targetPrice, durationMinutesOrTime = 10) => {
  const cleanTarget = Math.max(1, parseFloat(Number(targetPrice).toFixed(2)));
  if (isNaN(cleanTarget)) throw new Error('Please enter a valid target price.');

  const now = Date.now();
  let targetTimestamp;

  if (typeof durationMinutesOrTime === 'string' && durationMinutesOrTime.includes(':')) {
    // Exact time string like "14:30" or "22:15"
    const [hh, mm] = durationMinutesOrTime.split(':').map(Number);
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    if (d.getTime() <= now) {
      d.setDate(d.getDate() + 1); // If time has passed today, assume tomorrow
    }
    targetTimestamp = d.getTime();
  } else {
    // Numeric minutes (or millisecond timestamp)
    const val = Number(durationMinutesOrTime);
    if (val > 1000000000000) {
      targetTimestamp = val;
    } else {
      const minutes = Math.max(1, isNaN(val) ? 10 : val);
      targetTimestamp = now + minutes * 60 * 1000;
    }
  }

  const { error } = await supabase
    .from('stocks')
    .update({
      pending_shock: cleanTarget,
      pending_shock_at: -targetTimestamp, // Negative timestamp stores target reach deadline!
      updated_at: new Date().toISOString(),
    })
    .eq('ticker', ticker);

  if (error) throw error;
  return { targetPrice: cleanTarget, targetTimestamp };
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
