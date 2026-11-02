import { supabase } from './client';

const randId = () => Math.random().toString(36).substring(2, 7);

// ─── STOCKS ───────────────────────────────────────────────────────────────────
export const getStock = async (ticker) => {
  const { data, error } = await supabase
    .from('stocks')
    .select('*')
    .eq('ticker', ticker)
    .single();

  if (error) return null;
  return normalizeStock(data);
};

export const getAllStocks = async () => {
  const { data, error } = await supabase.from('stocks').select('*');
  if (error) return [];
  return data.map(normalizeStock);
};

export const subscribeStocks = (callback) => {
  getAllStocks().then(callback);

  const channel = supabase
    .channel(`stocks-realtime-${randId()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'stocks' },
      () => {
        getAllStocks().then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeStock = (ticker, callback) => {
  getStock(ticker).then((data) => {
    if (data) callback(data);
  });

  const channel = supabase
    .channel(`stock-${ticker}-${randId()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'stocks',
        filter: `ticker=eq.${ticker}`,
      },
      (payload) => {
        if (payload.new) callback(normalizeStock(payload.new));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

const normalizeStock = (s) => ({
  ticker: s.ticker,
  name: s.name,
  shortName: s.short_name,
  sector: s.sector,
  category: s.category,
  startPrice: Number(s.start_price),
  currentPrice: Number(s.current_price),
  previousPrice: Number(s.previous_price),
  liquidityFactor: Number(s.liquidity_factor || 300000),
  priceHistory: Array.isArray(s.price_history) ? s.price_history : [],
  pendingShock: s.pending_shock !== null ? Number(s.pending_shock) : null,
  pendingShockAt: s.pending_shock_at,
  buyVolume: Number(s.buy_volume || 0),
  sellVolume: Number(s.sell_volume || 0),
  updatedAt: s.updated_at,
});

// ─── TRADES ───────────────────────────────────────────────────────────────────
export const placeTrade = async ({
  userId,
  userName,
  ticker,
  type,
  quantity,
  price,
}) => {
  const totalValue = quantity * price;

  // 1. Get Profile
  let { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (pErr || !profile) {
    // Auto-create profile if missing
    const newProfile = {
      id: userId,
      name: userName || 'Trader',
      email: '',
      participant_id: '',
      cash: 200000.0,
      role: 'student',
    };
    await supabase.from('profiles').upsert(newProfile);
    profile = newProfile;
  }

  const currentCash = Number(profile.cash || 0);

  // 2. Validate & Update Cash
  if (type === 'buy') {
    if (currentCash < totalValue) throw new Error('Insufficient Mudra Coins');
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ cash: currentCash - totalValue })
      .eq('id', userId);
    if (updErr) throw updErr;
  } else {
    // Sell: check holdings
    const { data: holding } = await supabase
      .from('holdings')
      .select('*')
      .eq('user_id', userId)
      .eq('ticker', ticker)
      .single();

    if (!holding || holding.quantity < quantity) {
      throw new Error('Insufficient shares to sell');
    }

    const { error: updErr } = await supabase
      .from('profiles')
      .update({ cash: currentCash + totalValue })
      .eq('id', userId);
    if (updErr) throw updErr;
  }

  // 3. Update Holdings
  const { data: existingHolding } = await supabase
    .from('holdings')
    .select('*')
    .eq('user_id', userId)
    .eq('ticker', ticker)
    .single();

  if (type === 'buy') {
    if (existingHolding) {
      const newQty = existingHolding.quantity + quantity;
      const newAvg =
        (Number(existingHolding.avg_price) * existingHolding.quantity +
          totalValue) /
        newQty;
      await supabase
        .from('holdings')
        .update({
          quantity: newQty,
          avg_price: newAvg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingHolding.id);
    } else {
      await supabase.from('holdings').insert({
        user_id: userId,
        ticker,
        quantity,
        avg_price: price,
      });
    }
  } else {
    const newQty = (existingHolding?.quantity || quantity) - quantity;
    if (newQty <= 0) {
      await supabase
        .from('holdings')
        .update({
          quantity: 0,
          avg_price: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingHolding.id);
    } else {
      await supabase
        .from('holdings')
        .update({
          quantity: newQty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingHolding.id);
    }
  }

  // 4. Log Trade
  await supabase.from('trades').insert({
    user_id: userId,
    user_name: userName,
    ticker,
    type,
    quantity,
    price,
    total_value: totalValue,
  });

  // 5. Update Stock Pending Volume
  const { data: stockData } = await supabase
    .from('stocks')
    .select('buy_volume, sell_volume')
    .eq('ticker', ticker)
    .single();

  if (stockData) {
    const newBuy =
      type === 'buy'
        ? Number(stockData.buy_volume || 0) + totalValue
        : Number(stockData.buy_volume || 0);
    const newSell =
      type === 'sell'
        ? Number(stockData.sell_volume || 0) + totalValue
        : Number(stockData.sell_volume || 0);

    await supabase
      .from('stocks')
      .update({ buy_volume: newBuy, sell_volume: newSell })
      .eq('ticker', ticker);
  }
};

// ─── HOLDINGS ─────────────────────────────────────────────────────────────────
export const getUserHoldings = async (userId) => {
  const { data, error } = await supabase
    .from('holdings')
    .select('*')
    .eq('user_id', userId)
    .gt('quantity', 0);

  if (error) return [];
  return data.map((h) => ({
    ticker: h.ticker,
    quantity: h.quantity,
    avgPrice: Number(h.avg_price),
  }));
};

export const subscribeHoldings = (userId, callback) => {
  getUserHoldings(userId).then(callback);

  const channel = supabase
    .channel(`holdings-${userId}-${randId()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'holdings',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        getUserHoldings(userId).then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const isOfficialParticipant = (participantId, name = '', email = '') => {
  if (participantId) {
    const match = String(participantId).trim().toUpperCase().match(/^MUDRA(\d{1,3})$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 200) return true;
    }
  }
  if (email) {
    const match = String(email).trim().toLowerCase().match(/^mudra(\d{1,3})@/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 200) return true;
    }
  }
  if (name) {
    const match = String(name).trim().toUpperCase().match(/MUDRA(\d{1,3})/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 200) return true;
    }
  }
  return false;
};

export const isTesterParticipant = (participantId, name = '', email = '') => {
  if (participantId) {
    const match = String(participantId).trim().toUpperCase().match(/^TRIAL(\d{1,3})$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 50) return true;
    }
  }
  if (email) {
    const match = String(email).trim().toLowerCase().match(/^trial(\d{1,3})@/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 50) return true;
    }
  }
  if (name) {
    const match = String(name).trim().toUpperCase().match(/TRIAL(\d{1,3})/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 50) return true;
    }
  }
  return false;
};

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
export const getLeaderboard = async () => {
  // Fetch all profiles, stocks, holdings, savings, commodities, mutual funds
  const [
    profilesRes,
    stocksRes,
    holdingsRes,
    savingsRes,
    commoditiesRes,
    comHoldingsRes,
    mfRes,
    mfHoldingsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('stocks').select('ticker, current_price'),
    supabase.from('holdings').select('*').gt('quantity', 0),
    supabase.from('savings').select('*').in('status', ['active', 'matured']),
    supabase.from('commodities').select('symbol, current_price'),
    supabase.from('commodity_holdings').select('*').gt('quantity', 0),
    supabase.from('mutual_funds').select('id, nav'),
    supabase.from('mf_holdings').select('*').gt('units', 0),
  ]);

  const allProfiles = profilesRes.data || [];
  const stocks = stocksRes.data || [];
  const holdings = holdingsRes.data || [];
  const savings = savingsRes.data || [];
  const commodities = commoditiesRes.data || [];
  const comHoldings = comHoldingsRes.data || [];
  const mutualFunds = mfRes.data || [];
  const mfHoldings = mfHoldingsRes.data || [];

  const stockPriceMap = {};
  stocks.forEach((s) => {
    stockPriceMap[s.ticker] = Number(s.current_price);
  });

  const comPriceMap = {};
  commodities.forEach((c) => {
    comPriceMap[c.symbol] = Number(c.current_price);
  });

  const mfNavMap = {};
  mutualFunds.forEach((m) => {
    mfNavMap[m.id] = Number(m.nav);
  });

  // Calculate user-level totals
  const stockHoldingsByUser = {};
  holdings.forEach((h) => {
    const val = (stockPriceMap[h.ticker] || 0) * Number(h.quantity);
    stockHoldingsByUser[h.user_id] = (stockHoldingsByUser[h.user_id] || 0) + val;
  });

  const savingsByUser = {};
  savings.forEach((s) => {
    savingsByUser[s.user_id] = (savingsByUser[s.user_id] || 0) + Number(s.amount);
  });

  const comByUser = {};
  comHoldings.forEach((ch) => {
    const val = (comPriceMap[ch.symbol] || 0) * Number(ch.quantity);
    comByUser[ch.user_id] = (comByUser[ch.user_id] || 0) + val;
  });

  const mfByUser = {};
  mfHoldings.forEach((mh) => {
    const val = (mfNavMap[mh.fund_id] || 0) * Number(mh.units);
    mfByUser[mh.user_id] = (mfByUser[mh.user_id] || 0) + val;
  });

  const board = allProfiles.map((p) => {
    const cash = Number(p.cash || 0);
    const sVal = stockHoldingsByUser[p.id] || 0;
    const savVal = savingsByUser[p.id] || 0;
    const cVal = comByUser[p.id] || 0;
    const mVal = mfByUser[p.id] || 0;
    const otherAssets = savVal + cVal + mVal;
    const total = cash + sVal + otherAssets;

    const isOfficial = isOfficialParticipant(p.participant_id, p.name, p.email);
    const isTester = isTesterParticipant(p.participant_id, p.name, p.email);
    const isAdmin = p.role === 'admin';
    const userType = isAdmin ? 'admin' : isTester ? 'tester' : isOfficial ? 'participant' : 'other';

    return {
      uid: p.id,
      name: p.name,
      email: p.email,
      participantId: p.participant_id,
      role: p.role,
      userType,
      isOfficial,
      isTester,
      isAdmin,
      cash,
      holdingsValue: sVal,
      savingsValue: savVal,
      commoditiesValue: cVal,
      mutualFundsValue: mVal,
      otherAssetsValue: otherAssets,
      totalValue: total,
    };
  });

  board.sort((a, b) => b.totalValue - a.totalValue);

  // Compute overall rank and dedicated official participant rank
  let officialCounter = 1;
  return board.map((item, idx) => {
    const rank = idx + 1;
    const officialRank = item.isOfficial ? officialCounter++ : null;
    return { ...item, rank, officialRank };
  });
};

// ─── USER PROFILE & ADMIN INSPECTION APIS ────────────────────────────────────
export const updateUserName = async (userId, newName) => {
  const cleanName = String(newName || '').trim();
  if (!cleanName) throw new Error('Name cannot be empty.');
  if (cleanName.length < 2) throw new Error('Name must be at least 2 characters.');

  const { error } = await supabase
    .from('profiles')
    .update({ name: cleanName, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw error;

  try {
    await supabase.auth.updateUser({
      data: { name: cleanName },
    });
  } catch {
    // Non-fatal if auth metadata update fails
  }

  return cleanName;
};

export const getUserTradeHistory = async (userId) => {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return [];
  return data;
};

export const getUserDetailedPortfolio = async (userId) => {
  const [
    profileRes,
    holdingsRes,
    stocksRes,
    savingsRes,
    commoditiesRes,
    comHoldingsRes,
    mutualFundsRes,
    mfHoldingsRes,
    tradesRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('holdings').select('*').eq('user_id', userId).gt('quantity', 0),
    supabase.from('stocks').select('*'),
    supabase.from('savings').select('*').eq('user_id', userId),
    supabase.from('commodities').select('*'),
    supabase.from('commodity_holdings').select('*').eq('user_id', userId).gt('quantity', 0),
    supabase.from('mutual_funds').select('*'),
    supabase.from('mf_holdings').select('*').eq('user_id', userId).gt('units', 0),
    supabase.from('trades').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
  ]);

  const profile = profileRes.data || {};
  const stocks = stocksRes.data || [];
  const stockMap = {};
  stocks.forEach((s) => {
    stockMap[s.ticker] = s;
  });

  const rawHoldings = holdingsRes.data || [];
  const stockHoldings = rawHoldings.map((h) => {
    const stock = stockMap[h.ticker];
    const currentPrice = Number(stock?.current_price || 0);
    const quantity = Number(h.quantity || 0);
    const avgPrice = Number(h.avg_price || 0);
    const currentValue = currentPrice * quantity;
    const costBasis = avgPrice * quantity;
    const pnl = currentValue - costBasis;
    const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
    return {
      ticker: h.ticker,
      name: stock?.name || h.ticker,
      quantity,
      avgPrice,
      currentPrice,
      currentValue,
      costBasis,
      pnl,
      pnlPct,
    };
  });

  const commodities = commoditiesRes.data || [];
  const comMap = {};
  commodities.forEach((c) => {
    comMap[c.symbol] = c;
  });

  const rawComHoldings = comHoldingsRes.data || [];
  const commodityHoldings = rawComHoldings.map((ch) => {
    const com = comMap[ch.symbol];
    const currentPrice = Number(com?.current_price || 0);
    const quantity = Number(ch.quantity || 0);
    const avgPrice = Number(ch.avg_buy_price || 0);
    const currentValue = currentPrice * quantity;
    const costBasis = avgPrice * quantity;
    const pnl = currentValue - costBasis;
    return {
      symbol: ch.symbol,
      name: com?.name || ch.symbol,
      unit: com?.unit || 'g',
      quantity,
      avgPrice,
      currentPrice,
      currentValue,
      costBasis,
      pnl,
    };
  });

  const mutualFunds = mutualFundsRes.data || [];
  const mfMap = {};
  mutualFunds.forEach((m) => {
    mfMap[m.id] = m;
  });

  const rawMfHoldings = mfHoldingsRes.data || [];
  const mutualFundHoldings = rawMfHoldings.map((mh) => {
    const fund = mfMap[mh.fund_id];
    const nav = Number(fund?.nav || 0);
    const units = Number(mh.units || 0);
    const avgNav = Number(mh.avg_nav || 0);
    const currentValue = nav * units;
    const costBasis = avgNav * units;
    const pnl = currentValue - costBasis;
    return {
      fundId: mh.fund_id,
      name: fund?.name || mh.fund_id,
      category: fund?.category || 'Equity',
      units,
      avgNav,
      currentNav: nav,
      currentValue,
      costBasis,
      pnl,
    };
  });

  const savings = (savingsRes.data || []).map((s) => ({
    id: s.id,
    type: s.type,
    amount: Number(s.amount || 0),
    interestRate: Number(s.interest_rate || 0),
    termMonths: Number(s.term_months || 0),
    startDate: s.start_date,
    maturityDate: s.maturity_date,
    status: s.status,
    totalAtMaturity: Number(s.total_at_maturity || s.amount || 0),
  }));

  const cash = Number(profile.cash || 0);
  const totalStocks = stockHoldings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalSavings = savings.reduce((sum, s) => sum + s.amount, 0);
  const totalCommodities = commodityHoldings.reduce((sum, c) => sum + c.currentValue, 0);
  const totalMFs = mutualFundHoldings.reduce((sum, m) => sum + m.currentValue, 0);
  const totalNetWorth = cash + totalStocks + totalSavings + totalCommodities + totalMFs;
  const initialCapital = profile.role === 'admin' ? 99900000000 : 200000;
  const netPnl = totalNetWorth - initialCapital;

  return {
    profile: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      participantId: profile.participant_id,
      role: profile.role,
      createdAt: profile.created_at,
    },
    valuation: {
      cash,
      totalStocks,
      totalSavings,
      totalCommodities,
      totalMFs,
      totalNetWorth,
      netPnl,
      netPnlPct: initialCapital > 0 ? (netPnl / initialCapital) * 100 : 0,
    },
    holdings: {
      stocks: stockHoldings,
      savings,
      commodities: commodityHoldings,
      mutualFunds: mutualFundHoldings,
    },
    trades: tradesRes.data || [],
  };
};

export const subscribeLeaderboard = (callback) => {
  getLeaderboard().then(callback);

  const channel = supabase
    .channel(`leaderboard-realtime-${randId()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trades' },
      () => {
        getLeaderboard().then(callback);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'stocks' },
      () => {
        getLeaderboard().then(callback);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'savings' },
      () => {
        getLeaderboard().then(callback);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'commodities' },
      () => {
        getLeaderboard().then(callback);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mutual_funds' },
      () => {
        getLeaderboard().then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// ─── NEWS ─────────────────────────────────────────────────────────────────────
export const getAllNews = async () => {
  const { data, error } = await supabase
    .from('news')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return [];
  return data.map(normalizeNews);
};

export const subscribeNews = (callback) => {
  getAllNews().then(callback);

  const channel = supabase
    .channel(`news-realtime-${randId()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'news' },
      () => {
        getAllNews().then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const publishNews = async (newsData) => {
  const { data, error } = await supabase.from('news').insert({
    headline: newsData.headline,
    body: newsData.body || '',
    tickers: newsData.tickers || [],
    sentiment: newsData.sentiment || 'neutral',
    shock_percent: newsData.shockPercent || 0,
    ai_reasoning: newsData.aiReasoning || '',
    engine: newsData.engine || 'manual',
    status: 'pending',
    applied_at: newsData.appliedAt,
  });
  if (error) throw error;
  return data;
};

const normalizeNews = (n) => ({
  id: n.id,
  headline: n.headline,
  body: n.body,
  tickers: n.tickers || [],
  sentiment: n.sentiment,
  shockPercent: Number(n.shock_percent),
  aiReasoning: n.ai_reasoning,
  engine: n.engine,
  status: n.status,
  appliedAt: n.applied_at,
  publishedAt: n.created_at ? { toMillis: () => new Date(n.created_at).getTime() } : null,
});

// ─── EVENT CONFIG ─────────────────────────────────────────────────────────────
export const subscribeEvent = (callback) => {
  supabase
    .from('event_config')
    .select('*')
    .eq('id', 'main')
    .single()
    .then(({ data }) => {
      if (data) {
        callback({
          startDate: data.start_date,
          endDate: data.end_date,
          isActive: data.is_active,
          isPaused: data.is_paused,
        });
      }
    });

  const channel = supabase
    .channel(`event-config-${randId()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'event_config',
        filter: 'id=eq.main',
      },
      (payload) => {
        if (payload.new) {
          callback({
            startDate: payload.new.start_date,
            endDate: payload.new.end_date,
            isActive: payload.new.is_active,
            isPaused: payload.new.is_paused,
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// ─── TRADES FEED ──────────────────────────────────────────────────────────────
export const subscribeRecentTrades = (callback) => {
  const fetchTrades = async () => {
    const { data } = await supabase
      .from('trades')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (data) {
      callback(
        data.map((t) => ({
          id: t.id,
          userName: t.user_name,
          ticker: t.ticker,
          type: t.type,
          quantity: t.quantity,
          price: Number(t.price),
          totalValue: Number(t.total_value),
          timestamp: { toDate: () => new Date(t.created_at) },
        }))
      );
    }
  };

  fetchTrades();

  const channel = supabase
    .channel(`trades-realtime-${randId()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'trades' },
      () => {
        fetchTrades();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// ─── ADMIN: ALL USERS ─────────────────────────────────────────────────────────
export const getAllUsers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return [];
  return data.map((u) => ({
    uid: u.id,
    name: u.name,
    email: u.email,
    participantId: u.participant_id,
    cash: Number(u.cash || 0),
    role: u.role,
  }));
};

// ─── SAVINGS ACCOUNT ────────────────────────────────────────────────────────
export const getUserSavings = async (userId) => {
  const { data, error } = await supabase
    .from('savings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return [];
  const now = Date.now();
  return data.map((s) => {
    const maturesAtMs = new Date(s.matures_at).getTime();
    const isMatured = now >= maturesAtMs;
    return {
      id: s.id,
      userId: s.user_id,
      amount: Number(s.amount),
      rate: Number(s.rate),
      depositedAt: s.deposited_at,
      maturesAt: s.matures_at,
      status: s.status === 'active' && isMatured ? 'matured' : s.status,
      payout: Number(s.payout || (Number(s.amount) * (1 + Number(s.rate)))),
    };
  });
};

export const subscribeSavings = (userId, callback) => {
  getUserSavings(userId).then(callback);

  const channel = supabase
    .channel(`savings-${userId}-${randId()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'savings',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        getUserSavings(userId).then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const depositSavings = async ({ userId, amount, durationDays = 3, rate = 0.05 }) => {
  const depAmount = parseFloat(amount);
  if (isNaN(depAmount) || depAmount <= 0) throw new Error('Invalid deposit amount');

  // 1. Check Cash
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('cash')
    .eq('id', userId)
    .single();

  if (pErr || !profile) throw new Error('User profile not found');
  const currentCash = Number(profile.cash || 0);
  if (currentCash < depAmount) throw new Error('Insufficient Mudra Coins for deposit');

  // 2. Deduct Cash
  const { error: updErr } = await supabase
    .from('profiles')
    .update({ cash: currentCash - depAmount })
    .eq('id', userId);
  if (updErr) throw updErr;

  // 3. Create Savings Row
  const now = new Date();
  const maturesAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const payout = depAmount * (1 + rate);

  const { error: insErr } = await supabase.from('savings').insert({
    user_id: userId,
    amount: depAmount,
    rate,
    deposited_at: now.toISOString(),
    matures_at: maturesAt.toISOString(),
    status: 'active',
    payout,
  });

  if (insErr) throw insErr;
  return true;
};

export const withdrawSavings = async ({ userId, savingsId }) => {
  const { data: deposit, error: dErr } = await supabase
    .from('savings')
    .select('*')
    .eq('id', savingsId)
    .eq('user_id', userId)
    .single();

  if (dErr || !deposit) throw new Error('Deposit not found');
  if (deposit.status === 'withdrawn') throw new Error('Deposit already withdrawn');

  const now = Date.now();
  const maturesAtMs = new Date(deposit.matures_at).getTime();
  if (now < maturesAtMs && deposit.status !== 'matured') {
    throw new Error('Deposit has not matured yet! Lock period active.');
  }

  const payout = Number(deposit.payout || (Number(deposit.amount) * (1 + Number(deposit.rate))));

  // 1. Update savings status
  const { error: sUpdErr } = await supabase
    .from('savings')
    .update({ status: 'withdrawn' })
    .eq('id', savingsId);
  if (sUpdErr) throw sUpdErr;

  // 2. Credit cash to profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('cash')
    .eq('id', userId)
    .single();
  const currentCash = Number(profile?.cash || 0);

  const { error: pUpdErr } = await supabase
    .from('profiles')
    .update({ cash: currentCash + payout })
    .eq('id', userId);
  if (pUpdErr) throw pUpdErr;

  return payout;
};

// ─── COMMODITIES (GOLD & SILVER) ───────────────────────────────────────────
export const getCommodities = async () => {
  const { data, error } = await supabase.from('commodities').select('*');
  if (error || !data) return [];
  return data.map((c) => ({
    symbol: c.symbol,
    name: c.name,
    currentPrice: Number(c.current_price),
    previousPrice: Number(c.previous_price || c.current_price),
    priceHistory: Array.isArray(c.price_history) ? c.price_history : [],
  }));
};

export const subscribeCommodities = (callback) => {
  getCommodities().then(callback);

  const channel = supabase
    .channel(`commodities-realtime-${randId()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'commodities' },
      () => {
        getCommodities().then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const getUserCommodityHoldings = async (userId) => {
  const { data, error } = await supabase
    .from('commodity_holdings')
    .select('*')
    .eq('user_id', userId)
    .gt('quantity', 0);

  if (error || !data) return [];
  return data.map((ch) => ({
    symbol: ch.symbol,
    quantity: Number(ch.quantity),
    avgPrice: Number(ch.avg_price),
  }));
};

export const subscribeCommodityHoldings = (userId, callback) => {
  getUserCommodityHoldings(userId).then(callback);

  const channel = supabase
    .channel(`com-holdings-${userId}-${randId()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'commodity_holdings',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        getUserCommodityHoldings(userId).then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const tradeCommodity = async ({
  userId,
  userName,
  symbol,
  type,
  quantity,
  price,
}) => {
  const qty = parseFloat(quantity);
  const p = parseFloat(price);
  if (isNaN(qty) || qty <= 0) throw new Error('Invalid quantity');
  const totalValue = qty * p;

  // 1. Profile cash check
  const { data: profile } = await supabase
    .from('profiles')
    .select('cash')
    .eq('id', userId)
    .single();
  const currentCash = Number(profile?.cash || 0);

  // 2. Existing holding check
  const { data: existing } = await supabase
    .from('commodity_holdings')
    .select('*')
    .eq('user_id', userId)
    .eq('symbol', symbol)
    .single();

  if (type === 'buy') {
    if (currentCash < totalValue) throw new Error('Insufficient Mudra Coins');
    // Deduct cash
    await supabase
      .from('profiles')
      .update({ cash: currentCash - totalValue })
      .eq('id', userId);

    if (existing) {
      const newQty = Number(existing.quantity) + qty;
      const newAvg =
        (Number(existing.avg_price) * Number(existing.quantity) + totalValue) /
        newQty;
      await supabase
        .from('commodity_holdings')
        .update({ quantity: newQty, avg_price: newAvg, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase.from('commodity_holdings').insert({
        user_id: userId,
        symbol,
        quantity: qty,
        avg_price: p,
      });
    }
  } else {
    // Sell
    if (!existing || Number(existing.quantity) < qty) {
      throw new Error('Insufficient commodity balance to sell');
    }
    // Add cash
    await supabase
      .from('profiles')
      .update({ cash: currentCash + totalValue })
      .eq('id', userId);

    const newQty = Number(existing.quantity) - qty;
    await supabase
      .from('commodity_holdings')
      .update({
        quantity: newQty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  }

  // 3. Log trade
  await supabase.from('trades').insert({
    user_id: userId,
    user_name: userName,
    ticker: symbol,
    type,
    quantity: qty,
    price: p,
    total_value: totalValue,
  });

  return true;
};

// ─── MUTUAL FUNDS ────────────────────────────────────────────────────────────
export const getMutualFunds = async () => {
  const { data, error } = await supabase.from('mutual_funds').select('*');
  if (error || !data) return [];
  return data.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    nav: Number(m.nav),
    prevNav: Number(m.prev_nav || m.nav),
    dailyReturnRate: Number(m.daily_return_rate),
    risk: m.risk,
    priceHistory: Array.isArray(m.price_history) ? m.price_history : [],
  }));
};

export const subscribeMutualFunds = (callback) => {
  getMutualFunds().then(callback);

  const channel = supabase
    .channel(`mutual-funds-realtime-${randId()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mutual_funds' },
      () => {
        getMutualFunds().then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const getUserMFHoldings = async (userId) => {
  const { data, error } = await supabase
    .from('mf_holdings')
    .select('*')
    .eq('user_id', userId)
    .gt('units', 0);

  if (error || !data) return [];
  return data.map((mh) => ({
    fundId: mh.fund_id,
    units: Number(mh.units),
    avgNav: Number(mh.avg_nav),
  }));
};

export const subscribeMFHoldings = (userId, callback) => {
  getUserMFHoldings(userId).then(callback);

  const channel = supabase
    .channel(`mf-holdings-${userId}-${randId()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mf_holdings',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        getUserMFHoldings(userId).then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const tradeMutualFund = async ({
  userId,
  userName,
  fundId,
  type, // 'invest' or 'redeem'
  amount, // Coins to invest (for invest) OR units to redeem (for redeem)
  nav,
}) => {
  const navPrice = parseFloat(nav);
  if (navPrice <= 0) throw new Error('Invalid NAV');

  const { data: profile } = await supabase
    .from('profiles')
    .select('cash')
    .eq('id', userId)
    .single();
  const currentCash = Number(profile?.cash || 0);

  const { data: existing } = await supabase
    .from('mf_holdings')
    .select('*')
    .eq('user_id', userId)
    .eq('fund_id', fundId)
    .single();

  if (type === 'invest') {
    const investAmount = parseFloat(amount);
    if (isNaN(investAmount) || investAmount <= 0) throw new Error('Invalid amount');
    if (currentCash < investAmount) throw new Error('Insufficient Mudra Coins');

    const unitsPurchased = investAmount / navPrice;

    // Deduct cash
    await supabase
      .from('profiles')
      .update({ cash: currentCash - investAmount })
      .eq('id', userId);

    if (existing) {
      const newUnits = Number(existing.units) + unitsPurchased;
      const newAvgNav =
        (Number(existing.avg_nav) * Number(existing.units) + investAmount) /
        newUnits;
      await supabase
        .from('mf_holdings')
        .update({ units: newUnits, avg_nav: newAvgNav, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase.from('mf_holdings').insert({
        user_id: userId,
        fund_id: fundId,
        units: unitsPurchased,
        avg_nav: navPrice,
      });
    }

    await supabase.from('trades').insert({
      user_id: userId,
      user_name: userName,
      ticker: fundId,
      type: 'buy',
      quantity: unitsPurchased,
      price: navPrice,
      total_value: investAmount,
    });
  } else {
    // Redeem units
    const unitsToRedeem = parseFloat(amount);
    if (isNaN(unitsToRedeem) || unitsToRedeem <= 0) throw new Error('Invalid units to redeem');
    if (!existing || Number(existing.units) < unitsToRedeem) {
      throw new Error('Insufficient fund units to redeem');
    }

    const creditAmount = unitsToRedeem * navPrice;

    await supabase
      .from('profiles')
      .update({ cash: currentCash + creditAmount })
      .eq('id', userId);

    const newUnits = Number(existing.units) - unitsToRedeem;
    await supabase
      .from('mf_holdings')
      .update({ units: newUnits, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    await supabase.from('trades').insert({
      user_id: userId,
      user_name: userName,
      ticker: fundId,
      type: 'sell',
      quantity: unitsToRedeem,
      price: navPrice,
      total_value: creditAmount,
    });
  }

  return true;
};

// ─── MUDRA SHOP (COUPONS & PERKS) ───────────────────────────────────────────
export const getShopItems = async () => {
  const { data, error } = await supabase
    .from('shop_items')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true });

  if (error || !data) return [];
  return data.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    imageUrl: item.image_url,
    price: Number(item.price),
    quantityAvailable: Number(item.quantity_available || 0),
    category: item.category,
    isActive: item.is_active,
  }));
};

export const subscribeShopItems = (callback) => {
  getShopItems().then(callback);

  const channel = supabase
    .channel(`shop-items-realtime-${randId()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'shop_items' },
      () => {
        getShopItems().then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const buyShopItem = async ({ userId, userName, itemId }) => {
  // 1. Fetch item
  const { data: item, error: iErr } = await supabase
    .from('shop_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (iErr || !item) throw new Error('Item not found');
  if (item.quantity_available <= 0) throw new Error('Item is out of stock!');

  const itemPrice = Number(item.price);

  // 2. Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('cash')
    .eq('id', userId)
    .single();
  const currentCash = Number(profile?.cash || 0);

  if (currentCash < itemPrice) throw new Error('Insufficient Mudra Coins to purchase this item');

  // 3. Deduct cash
  const { error: pErr } = await supabase
    .from('profiles')
    .update({ cash: currentCash - itemPrice })
    .eq('id', userId);
  if (pErr) throw pErr;

  // 4. Decrement stock
  await supabase
    .from('shop_items')
    .update({ quantity_available: item.quantity_available - 1 })
    .eq('id', itemId);

  // 5. Generate coupon code
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const prefix = item.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'MUDRA';
  const couponCode = `${prefix}-${randomSuffix}`;

  // 6. Record purchase
  const { data: purchase, error: purErr } = await supabase
    .from('shop_purchases')
    .insert({
      user_id: userId,
      item_id: itemId,
      item_name: item.name,
      price_paid: itemPrice,
      coupon_code: couponCode,
      status: 'delivered',
    })
    .select()
    .single();

  if (purErr) throw purErr;
  return purchase;
};

export const getUserPurchases = async (userId) => {
  const { data, error } = await supabase
    .from('shop_purchases')
    .select('*')
    .eq('user_id', userId)
    .order('purchased_at', { ascending: false });

  if (error || !data) return [];
  return data.map((p) => ({
    id: p.id,
    itemName: p.item_name,
    pricePaid: Number(p.price_paid),
    couponCode: p.coupon_code,
    status: p.status,
    purchasedAt: p.purchased_at,
  }));
};

export const subscribeUserPurchases = (userId, callback) => {
  getUserPurchases(userId).then(callback);

  const channel = supabase
    .channel(`shop-purchases-${userId}-${randId()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shop_purchases',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        getUserPurchases(userId).then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// ─── ADMIN SHOP ACTIONS ───────────────────────────────────────────────────────
export const addShopItem = async ({ name, description, imageUrl, price, quantity, category }) => {
  const { data, error } = await supabase.from('shop_items').insert({
    name,
    description: description || '',
    image_url: imageUrl || '',
    price: parseFloat(price),
    quantity_available: parseInt(quantity) || 1,
    category: category || 'voucher',
    is_active: true,
  });
  if (error) throw error;
  return data;
};

export const updateShopItem = async (id, fields) => {
  const { error } = await supabase.from('shop_items').update(fields).eq('id', id);
  if (error) throw error;
};

export const deleteShopItem = async (id) => {
  const { error } = await supabase.from('shop_items').delete().eq('id', id);
  if (error) throw error;
};

export const getAllPurchases = async () => {
  const { data, error } = await supabase
    .from('shop_purchases')
    .select('*, profiles(name, email)')
    .order('purchased_at', { ascending: false });

  if (error || !data) return [];
  return data.map((p) => ({
    id: p.id,
    userName: p.profiles?.name || 'Trader',
    userEmail: p.profiles?.email || '',
    itemName: p.item_name,
    pricePaid: Number(p.price_paid),
    couponCode: p.coupon_code,
    status: p.status,
    purchasedAt: p.purchased_at,
  }));
};

