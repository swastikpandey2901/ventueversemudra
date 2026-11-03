import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  subscribeStocks,
  subscribeRecentTrades,
  subscribeLeaderboard,
  subscribeNews,
  publishNews,
  deleteNews,
  getAllUsers,
  getShopItems,
  addShopItem,
  deleteShopItem,
  getAllPurchases,
  getCommodities,
  getMutualFunds,
  adminUpdateUserCash,
  adminResetUserPortfolio,
} from '../supabase/api';
import { analyzeNews } from '../ai/newsAnalyzer';
import {
  runPriceCycle,
  seedStocks,
  scheduleNewsShock,
  runCommodityCycle,
  runMutualFundCycle,
  godSetStockPrice,
  godMoveToTargetPrice,
  godCancelTargetPrice,
} from '../engine/priceEngine';
import { COMPANIES } from '../data/companies';
import { supabase } from '../supabase/client';
import MudraIcon from '../components/MudraIcon';
import UserDetailModal from '../components/UserDetailModal';

const ADMIN_CASH = 99900000000; // 999 Crore

const AdminPage = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();

  // Redirect if not god admin
  useEffect(() => {
    if (userData) {
      const isGodAdmin =
        userData.role === 'admin' ||
        ['adarsh@mudra.internal', 'swastik@mudra.internal', 'harsha@mudra.internal'].includes(userData.email) ||
        ['adarshgod', 'swastikgod', 'harshagodess'].includes(userData.participantId);
      if (!isGodAdmin) navigate('/market');
    }
  }, [userData, navigate]);

  const [stocks, setStocks] = useState([]);
  const [trades, setTrades] = useState([]);
  const [board, setBoard] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('god');

  // God Admin User Portfolio Inspection & Fund Calibration Modal
  const [inspectUserId, setInspectUserId] = useState(null);

  // Price engine
  const [engineRunning, setEngineRunning] = useState(false);
  const engineRef = useRef(null);
  const [lastCycle, setLastCycle] = useState(null);

  // God trade
  const [godTicker, setGodTicker] = useState('');
  const [godAmount, setGodAmount] = useState('');
  const [godType, setGodType] = useState('buy');
  const [godMsg, setGodMsg] = useState('');

  // God Direct Stock Price Override & AI Target Shift
  const [priceSetMode, setPriceSetMode] = useState('direct'); // 'direct' | 'move'
  const [overrideTicker, setOverrideTicker] = useState('');
  const [overridePrice, setOverridePrice] = useState('');
  const [overrideMsg, setOverrideMsg] = useState('');
  const [targetDurationMinutes, setTargetDurationMinutes] = useState('10');
  const [targetTimeMode, setTargetTimeMode] = useState('duration'); // 'duration' | 'exact_time'
  const [targetExactTime, setTargetExactTime] = useState('');
  const [clock, setClock] = useState(Date.now());

  // Clock tick every 3s to keep countdowns accurate
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 3000);
    return () => clearInterval(timer);
  }, []);

  // God Quick Player Fund Calibrator
  const [quickPlayerId, setQuickPlayerId] = useState('');
  const [quickPlayerCash, setQuickPlayerCash] = useState('');
  const [quickPlayerMsg, setQuickPlayerMsg] = useState('');

  // News Publisher Controls
  const [newsText, setNewsText] = useState('');
  const [newsHeadline, setNewsHeadline] = useState('');
  const [newsBody, setNewsBody] = useState('');
  const [selectedTickers, setSelectedTickers] = useState([]);
  const [shockPercent, setShockPercent] = useState(0);
  const [sentiment, setSentiment] = useState('neutral');
  const [newsSectorFilter, setNewsSectorFilter] = useState('ALL');
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [newsPublishing, setNewsPublishing] = useState(false);
  const [newsMsg, setNewsMsg] = useState('');
  const [adminNewsList, setAdminNewsList] = useState([]);
  const [deletingNewsId, setDeletingNewsId] = useState(null);

  // Event
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');

  // Shop & Finance Admin State
  const [shopItems, setShopItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemQty, setNewItemQty] = useState('10');
  const [newItemCategory, setNewItemCategory] = useState('shopping');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemImg, setNewItemImg] = useState('');
  const [shopMsg, setShopMsg] = useState('');

  const [adminCommodities, setAdminCommodities] = useState([]);
  const [adminFunds, setAdminFunds] = useState([]);
  const [adminSavings, setAdminSavings] = useState([]);

  useEffect(() => {
    const u1 = subscribeStocks(setStocks);
    const u2 = subscribeRecentTrades(setTrades);
    const u3 = subscribeLeaderboard(setBoard);
    const u4 = subscribeNews(setAdminNewsList);
    getAllUsers().then(setUsers);
    getShopItems().then(setShopItems);
    getAllPurchases().then(setPurchases);
    getCommodities().then(setAdminCommodities);
    getMutualFunds().then(setAdminFunds);
    supabase.from('savings').select('*, profiles(name)').then(({ data }) => {
      if (data) setAdminSavings(data);
    });

    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, []);

  // Price Engine
  const startEngine = () => {
    if (engineRef.current) return;
    setEngineRunning(true);
    const run = async () => {
      await runPriceCycle();
      setLastCycle(new Date());
    };
    run();
    engineRef.current = setInterval(run, 30000);
  };

  const stopEngine = () => {
    if (engineRef.current) {
      clearInterval(engineRef.current);
      engineRef.current = null;
    }
    setEngineRunning(false);
  };

  // God Trade
  const handleGodTrade = async () => {
    if (!godTicker || !godAmount) return;
    setGodMsg('');
    try {
      const amount = parseFloat(godAmount);
      const stock = stocks.find((s) => s.ticker === godTicker);
      if (!stock) throw new Error('Stock not found');
      const qty = Math.floor(amount / stock.currentPrice);
      if (qty < 1) throw new Error('Amount too small for even 1 share');

      // Update pending volume in stocks table directly
      const { data: stockRow } = await supabase
        .from('stocks')
        .select('buy_volume, sell_volume')
        .eq('ticker', godTicker)
        .single();

      const existingBuy = Number(stockRow?.buy_volume || 0);
      const existingSell = Number(stockRow?.sell_volume || 0);

      await supabase
        .from('stocks')
        .update({
          buy_volume: godType === 'buy' ? existingBuy + amount : existingBuy,
          sell_volume: godType === 'sell' ? existingSell + amount : existingSell,
        })
        .eq('ticker', godTicker);

      // Log the admin trade
      await supabase.from('trades').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        user_name: '🔱 Market',
        ticker: godTicker,
        type: godType,
        quantity: qty,
        price: stock.currentPrice,
        total_value: amount,
      });

      setGodMsg(
        `✅ God trade queued: ${godType.toUpperCase()} 🪙${Number(amount).toLocaleString('en-IN')} of ${godTicker}`
      );
    } catch (err) {
      setGodMsg(`❌ ${err.message}`);
    }
  };

  // God Direct Stock Price Override & AI Target Shift
  const handleOverridePrice = async () => {
    if (!overrideTicker || !overridePrice) return;
    setOverrideMsg('');
    try {
      const price = parseFloat(overridePrice);
      if (isNaN(price) || price < 1) throw new Error('Please enter a valid price (minimum 🪙1.00)');

      if (priceSetMode === 'direct') {
        await godSetStockPrice(overrideTicker, price);
        setOverrideMsg(`⚡ [DIRECT SET] ${overrideTicker} price overridden to 🪙${price.toFixed(2)} instantly!`);
      } else {
        const timeVal = targetTimeMode === 'exact_time' ? targetExactTime : Number(targetDurationMinutes);
        if (targetTimeMode === 'exact_time' && !targetExactTime) {
          throw new Error('Please pick an exact target reach time.');
        }
        const res = await godMoveToTargetPrice(overrideTicker, price, timeVal);
        const reachTimeStr = res.targetTimestamp
          ? new Date(res.targetTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : `${targetDurationMinutes} min`;
        setOverrideMsg(`🤖 [MOVE TO TARGET] ${overrideTicker} target set to 🪙${price.toFixed(2)} (Reach by ${reachTimeStr}). AI will dynamically shift the price smoothly cycle-by-cycle!`);
      }
      setOverridePrice('');
    } catch (err) {
      setOverrideMsg(`❌ ${err.message}`);
    }
  };

  const handleCancelTargetShift = async (ticker) => {
    try {
      await godCancelTargetPrice(ticker);
      setOverrideMsg(`ℹ️ Cancelled AI target shift for ${ticker}.`);
    } catch (err) {
      setOverrideMsg(`❌ ${err.message}`);
    }
  };

  // God Quick Player Cash Calibrator Action
  const handleQuickPlayerCashAction = async (actionType) => {
    if (!quickPlayerId) {
      return setQuickPlayerMsg('❌ Please select a player or tester first.');
    }
    const targetUser = users.find((u) => (u.uid || u.id) === quickPlayerId);
    if (!targetUser) return setQuickPlayerMsg('❌ Player not found.');

    setQuickPlayerMsg('');
    try {
      const currentCash = Number(targetUser.cash || 0);
      const inputAmount = Number(quickPlayerCash);

      if (actionType === 'reset') {
        // Liquidate all assets (FD, stocks, commodities, funds) and reset cash to 200,000
        await adminResetUserPortfolio(quickPlayerId, 200000);
        setQuickPlayerMsg(`✅ Reset ${targetUser.name}'s entire portfolio (liquid cash, FDs, stocks, funds) to 🪙2,00,000!`);
      } else if (actionType === 'set') {
        if (isNaN(inputAmount) || inputAmount < 0) {
          throw new Error('Please enter a valid positive cash amount.');
        }
        // Liquidate all assets (FD, stocks, commodities, funds) and bring total net worth to exact amount
        await adminResetUserPortfolio(quickPlayerId, inputAmount);
        setQuickPlayerMsg(`✅ All assets (FD, stocks, funds) liquidated & set ${targetUser.name}'s total net worth to 🪙${inputAmount.toLocaleString('en-IN')}!`);
      } else if (actionType === 'bonus') {
        if (isNaN(inputAmount) || inputAmount <= 0) {
          throw new Error('Please enter a bonus amount greater than 0.');
        }
        const newCash = currentCash + inputAmount;
        await adminUpdateUserCash(quickPlayerId, newCash);
        setQuickPlayerMsg(`✅ Added 🪙${inputAmount.toLocaleString('en-IN')} bonus to ${targetUser.name}! (New liquid balance: 🪙${newCash.toLocaleString('en-IN')})`);
      } else if (actionType === 'deduct') {
        if (isNaN(inputAmount) || inputAmount <= 0) {
          throw new Error('Please enter a deduction amount greater than 0.');
        }
        const newCash = Math.max(0, currentCash - inputAmount);
        await adminUpdateUserCash(quickPlayerId, newCash);
        setQuickPlayerMsg(`✅ Deducted 🪙${inputAmount.toLocaleString('en-IN')} from ${targetUser.name}! (New liquid balance: 🪙${newCash.toLocaleString('en-IN')})`);
      } else if (actionType === 'wipe') {
        if (!window.confirm(`Are you sure you want to completely wipe all holdings and reset ${targetUser.name} to 🪙2,00,000?`)) return;
        await adminResetUserPortfolio(quickPlayerId, 200000);
        setQuickPlayerMsg(`⚠️ Wiped all holdings for ${targetUser.name} and restored initial 🪙2,00,000 cash!`);
      }

      setQuickPlayerCash('');
      const updatedUsers = await getAllUsers();
      setUsers(updatedUsers);
    } catch (err) {
      setQuickPlayerMsg(`❌ ${err.message}`);
    }
  };

  // AI / Built-in News Analyze
  const handleAnalyze = async () => {
    if (!newsText.trim()) return;
    setAiLoading(true);
    setAiResult(null);
    setNewsMsg('');
    try {
      const result = await analyzeNews(newsText);
      setAiResult(result);
      if (result.headline) setNewsHeadline(result.headline);
      if (Array.isArray(result.affectedTickers) && result.affectedTickers.length > 0) {
        setSelectedTickers(result.affectedTickers);
      }
      if (typeof result.shockPercent === 'number') {
        setShockPercent(result.shockPercent);
      }
      if (result.sentiment) {
        setSentiment(result.sentiment);
      }
    } catch (err) {
      setNewsMsg(`❌ ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Publish News
  const handlePublishNews = async () => {
    const finalHeadline = newsHeadline.trim() || aiResult?.headline?.trim();
    if (!finalHeadline) {
      return setNewsMsg('❌ Please enter a headline or click Analyze');
    }
    if (selectedTickers.length === 0) {
      return setNewsMsg('❌ Please select at least one affected stock');
    }
    setNewsPublishing(true);
    try {
      const finalShock = Number(shockPercent) || 0;
      const shockAt = Date.now() + 5 * 60 * 1000;

      await publishNews({
        headline: finalHeadline,
        body: newsBody || newsText,
        tickers: selectedTickers,
        sentiment: sentiment || 'neutral',
        shockPercent: finalShock,
        aiReasoning: aiResult?.reasoning || `Manual news release targeting ${selectedTickers.join(', ')}`,
        appliedAt: shockAt,
        engine: aiResult?.engine || 'manual',
      });

      // Schedule price shock
      if (selectedTickers.length > 0 && finalShock !== 0) {
        await scheduleNewsShock(selectedTickers, finalShock);
      }

      setNewsMsg(
        `✅ News published! Market will react with ${finalShock > 0 ? '+' : ''}${finalShock}% on [${selectedTickers.join(', ')}] in 5 minutes.`
      );
      setNewsText('');
      setNewsHeadline('');
      setNewsBody('');
      setSelectedTickers([]);
      setShockPercent(0);
      setSentiment('neutral');
      setAiResult(null);
    } catch (err) {
      setNewsMsg(`❌ ${err.message}`);
    } finally {
      setNewsPublishing(false);
    }
  };

  // Delete News Article
  const handleDeleteNews = async (id, headline) => {
    const ok = window.confirm(
      `Are you sure you want to delete this news article?\n\n"${headline}"\n\nAny pending stock price shock associated with this news will also be cancelled.`
    );
    if (!ok) return;
    setDeletingNewsId(id);
    try {
      await deleteNews(id);
      setAdminNewsList((prev) => prev.filter((n) => n.id !== id));
      setNewsMsg('✅ News article deleted and any pending price shock cancelled.');
    } catch (err) {
      setNewsMsg(`❌ Failed to delete news: ${err.message}`);
    } finally {
      setDeletingNewsId(null);
    }
  };

  // Seed Stocks
  const handleSeed = async () => {
    try {
      await seedStocks(COMPANIES);
      alert('✅ All 30 stocks seeded to Supabase!');
    } catch (err) {
      alert(`❌ Error seeding stocks: ${err.message}`);
    }
  };

  // Event Setup
  const handleSetEvent = async () => {
    try {
      const { error } = await supabase.from('event_config').upsert({
        id: 'main',
        start_date: eventStart ? new Date(eventStart).toISOString() : null,
        end_date: eventEnd ? new Date(eventEnd).toISOString() : null,
        is_active: true,
        is_paused: false,
      });
      if (error) throw error;
      alert('✅ Event configured!');
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  const handleAddShopItem = async () => {
    if (!newItemName || !newItemPrice) {
      return setShopMsg('❌ Name and price are required');
    }
    setShopMsg('');
    try {
      await addShopItem({
        name: newItemName,
        price: newItemPrice,
        quantity: newItemQty,
        category: newItemCategory,
        description: newItemDesc,
        imageUrl: newItemImg,
      });
      setShopMsg('✅ Item added to shop!');
      setNewItemName('');
      setNewItemPrice('');
      setNewItemDesc('');
      setNewItemImg('');
      const updated = await getShopItems();
      setShopItems(updated);
    } catch (e) {
      setShopMsg(`❌ ${e.message}`);
    }
  };

  const handleDeleteShopItem = async (id) => {
    if (!window.confirm('Delete this shop item?')) return;
    try {
      await deleteShopItem(id);
      setShopItems(shopItems.filter((i) => i.id !== id));
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleManualCommodityCycle = async () => {
    await runCommodityCycle();
    const updated = await getCommodities();
    setAdminCommodities(updated);
    alert('✅ Commodity prices updated!');
  };

  const handleManualMFCycle = async () => {
    await runMutualFundCycle();
    const updated = await getMutualFunds();
    setAdminFunds(updated);
    alert('✅ Mutual Fund NAVs updated!');
  };

  const tabs = [
    { id: 'god', label: '⚡ God Mode' },
    { id: 'news', label: '📰 News Publisher' },
    { id: 'shop', label: '🛍️ Shop Manager' },
    { id: 'finance', label: '🏦 Finance Control' },
    { id: 'trades', label: '📋 Trade Feed' },
    { id: 'board', label: '🏆 Leaderboard' },
    { id: 'players', label: '👥 Players' },
    { id: 'setup', label: '⚙️ Setup' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-white">
            ⚡ <span className="text-mudra-gold">God Panel</span>
          </h1>
          <p className="text-mudra-muted text-sm">God Admin Control Suite — 999 Crore Mudra Capital</p>
        </div>

        {/* Always-On Market Status */}
        <div className="card flex items-center gap-3 px-4 py-2.5 border-emerald-500/30 bg-emerald-950/20">
          <div className="w-2.5 h-2.5 rounded-full bg-mudra-green animate-ping" />
          <div className="text-xs">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span>Market Always ON</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-900/50 px-1.5 py-0.5 rounded font-mono">24/7 AUTO</span>
            </div>
            <div className="text-mudra-muted text-[11px] mt-0.5">
              Continuous 30s distributed cycle
            </div>
          </div>
          <button
            onClick={async () => {
              await runPriceCycle();
              setLastCycle(new Date());
              alert('⚡ Market tick executed!');
            }}
            className="btn-outline text-xs px-2.5 py-1 text-mudra-gold border-mudra-gold/40 hover:bg-mudra-gold/10 ml-1 font-bold"
            title="Force immediate price update"
          >
            ⚡ Force Tick
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === t.id
                ? t.id === 'god'
                  ? 'bg-amber-500 text-black font-black shadow-lg shadow-amber-500/25 border border-amber-400'
                  : 'bg-mudra-accent text-white'
                : 'bg-mudra-card border border-mudra-border text-mudra-muted hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ⚡ GOD MODE ── */}
      {(activeTab === 'god' || activeTab === 'market') && (
        <div className="space-y-6">
          {/* Top Grid: God Trade & Direct Price Override */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* 1. 💰 God Trade (Volume Pump / Dump) */}
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-mudra-gold text-lg flex items-center gap-1.5">
                  <span>💰</span> God Trade (Volume Mover)
                </h2>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded">
                  999 Crore Capital
                </span>
              </div>
              <p className="text-mudra-muted text-xs">
                Pump or dump any stock realistically using massive admin volume. Buys push prices up; sells push prices down.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-mudra-muted block mb-1">Select Company</label>
                  <select
                    className="input text-sm"
                    value={godTicker}
                    onChange={(e) => setGodTicker(e.target.value)}
                  >
                    <option value="">-- Select company --</option>
                    {stocks.map((s) => (
                      <option key={s.ticker} value={s.ticker}>
                        {s.ticker} – {s.name} (🪙{s.currentPrice?.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-mudra-muted block mb-1">
                    Amount (Mudra Coins)
                  </label>
                  <input
                    type="number"
                    className="input text-sm font-mono"
                    placeholder="e.g. 10000000 (1 Crore)"
                    value={godAmount}
                    onChange={(e) => setGodAmount(e.target.value)}
                  />
                  <div className="flex gap-2 mt-1">
                    {['1000000', '10000000', '100000000', '1000000000'].map((v) => (
                      <button
                        key={v}
                        onClick={() => setGodAmount(v)}
                        className="text-xs text-mudra-accent hover:underline font-mono"
                      >
                        {parseInt(v) >= 10000000
                          ? `${parseInt(v) / 10000000}Cr`
                          : `${parseInt(v) / 100000}L`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setGodType('buy')}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all ${
                      godType === 'buy'
                        ? 'bg-mudra-green text-black shadow-md'
                        : 'bg-mudra-bg border border-mudra-border text-mudra-muted hover:text-white'
                    }`}
                  >
                    📈 Pump (Buy Order)
                  </button>
                  <button
                    onClick={() => setGodType('sell')}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all ${
                      godType === 'sell'
                        ? 'bg-mudra-red text-white shadow-md'
                        : 'bg-mudra-bg border border-mudra-border text-mudra-muted hover:text-white'
                    }`}
                  >
                    📉 Dump (Sell Order)
                  </button>
                </div>

                <button onClick={handleGodTrade} className="btn-primary w-full py-2.5 font-bold text-sm shadow-md">
                  Execute God Volume Trade 🔱
                </button>

                {godMsg && (
                  <div
                    className={`text-xs rounded-lg p-2 font-semibold ${
                      godMsg.startsWith('✅')
                        ? 'text-mudra-green bg-emerald-950/40 border border-emerald-500/30'
                        : 'text-mudra-red bg-red-950/40 border border-red-500/30'
                    }`}
                  >
                    {godMsg}
                  </div>
                )}
              </div>
            </div>

            {/* 2. 🎯 God Company Price Control: Direct Set & AI Shift to Target */}
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-mudra-gold text-lg flex items-center gap-1.5">
                  <span>🎯</span> Company Price Setter
                </h2>
                <div className="flex gap-1 bg-mudra-bg p-0.5 rounded-lg border border-mudra-border">
                  <button
                    type="button"
                    onClick={() => setPriceSetMode('direct')}
                    className={`px-2 py-0.5 text-xs rounded-md font-bold transition-all ${
                      priceSetMode === 'direct'
                        ? 'bg-amber-500 text-black shadow'
                        : 'text-mudra-muted hover:text-white'
                    }`}
                  >
                    ⚡ Direct Set
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceSetMode('move')}
                    className={`px-2 py-0.5 text-xs rounded-md font-bold transition-all ${
                      priceSetMode === 'move'
                        ? 'bg-mudra-accent text-white shadow'
                        : 'text-mudra-muted hover:text-white'
                    }`}
                  >
                    🤖 Move to Target
                  </button>
                </div>
              </div>

              <p className="text-mudra-muted text-xs">
                {priceSetMode === 'direct' ? (
                  <span>
                    <strong className="text-amber-400">⚡ Direct Set Mode:</strong> Sets the stock price to your target immediately across all users.
                  </span>
                ) : (
                  <span>
                    <strong className="text-mudra-accent">🤖 Move to Target Mode:</strong> Instructs the AI engine to shift the market price smoothly towards your target cycle-by-cycle with organic candles.
                  </span>
                )}
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-mudra-muted block mb-1">Select Target Stock</label>
                  <select
                    className="input text-sm"
                    value={overrideTicker}
                    onChange={(e) => {
                      setOverrideTicker(e.target.value);
                      const st = stocks.find((s) => s.ticker === e.target.value);
                      if (st) setOverridePrice(st.currentPrice?.toString() || '');
                    }}
                  >
                    <option value="">-- Choose company --</option>
                    {stocks.map((s) => {
                      const shockAtNum = Number(s.pendingShockAt);
                      const isDrifting = s.pendingShock !== null && (shockAtNum < 0 || shockAtNum === 1);
                      return (
                        <option key={s.ticker} value={s.ticker}>
                          {s.ticker} – {s.name} (Now: 🪙{s.currentPrice?.toFixed(2)}){isDrifting ? ` 🤖 [Target: 🪙${s.pendingShock}]` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-mudra-muted">
                      {priceSetMode === 'direct' ? 'New Price' : 'Target Price to Shift To'} (Mudra Coins)
                    </label>
                    {overrideTicker && (
                      <span className="text-[11px] text-mudra-gold font-mono">
                        Current: 🪙{stocks.find((s) => s.ticker === overrideTicker)?.currentPrice?.toFixed(2) || '--'}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="input text-sm font-mono"
                    placeholder="e.g. 750.00"
                    value={overridePrice}
                    onChange={(e) => setOverridePrice(e.target.value)}
                  />

                  {/* Quick percentage adjustment shortcuts */}
                  {overrideTicker && (
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {[
                        { label: '+25%', factor: 1.25 },
                        { label: '+50%', factor: 1.5 },
                        { label: '+100%', factor: 2.0 },
                        { label: '-25%', factor: 0.75 },
                        { label: '-50%', factor: 0.5 },
                      ].map((adj) => (
                        <button
                          key={adj.label}
                          type="button"
                          onClick={() => {
                            const cur = stocks.find((s) => s.ticker === overrideTicker)?.currentPrice || 100;
                            setOverridePrice((cur * adj.factor).toFixed(2));
                          }}
                          className="text-[11px] px-2 py-0.5 rounded bg-mudra-bg border border-mudra-border text-mudra-muted hover:text-white"
                        >
                          {adj.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ⏱️ Timing Configuration (Only when priceSetMode is 'move') */}
                {priceSetMode === 'move' && (
                  <div className="space-y-2 bg-purple-950/20 border border-purple-500/20 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-purple-200 flex items-center gap-1.5">
                        <span>⏱️</span> Target Reach Timing
                      </label>
                      <div className="flex gap-1 bg-black/40 p-0.5 rounded-lg border border-purple-500/30">
                        <button
                          type="button"
                          onClick={() => setTargetTimeMode('duration')}
                          className={`px-2 py-0.5 text-[11px] rounded font-medium transition-all ${
                            targetTimeMode === 'duration'
                              ? 'bg-mudra-accent text-white shadow'
                              : 'text-mudra-muted hover:text-white'
                          }`}
                        >
                          Duration (Mins)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetTimeMode('exact_time');
                            if (!targetExactTime) {
                              const d = new Date(Date.now() + 15 * 60 * 1000);
                              const hh = String(d.getHours()).padStart(2, '0');
                              const mm = String(d.getMinutes()).padStart(2, '0');
                              setTargetExactTime(`${hh}:${mm}`);
                            }
                          }}
                          className={`px-2 py-0.5 text-[11px] rounded font-medium transition-all ${
                            targetTimeMode === 'exact_time'
                              ? 'bg-mudra-accent text-white shadow'
                              : 'text-mudra-muted hover:text-white'
                          }`}
                        >
                          Exact Clock Time
                        </button>
                      </div>
                    </div>

                    {targetTimeMode === 'duration' ? (
                      <div className="space-y-2">
                        {/* Quick duration presets */}
                        <div className="grid grid-cols-5 gap-1.5">
                          {[
                            { label: '2 min', val: '2' },
                            { label: '5 min', val: '5' },
                            { label: '10 min', val: '10' },
                            { label: '15 min', val: '15' },
                            { label: '30 min', val: '30' },
                          ].map((preset) => (
                            <button
                              key={preset.val}
                              type="button"
                              onClick={() => setTargetDurationMinutes(preset.val)}
                              className={`py-1 text-xs rounded border transition-all ${
                                targetDurationMinutes === preset.val
                                  ? 'bg-mudra-accent text-white font-bold border-purple-400 shadow-sm'
                                  : 'bg-mudra-bg border-mudra-border text-mudra-muted hover:text-white'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-mudra-muted whitespace-nowrap">Custom Duration:</label>
                          <input
                            type="number"
                            min="1"
                            max="720"
                            className="input text-xs font-mono py-1 flex-1"
                            placeholder="e.g. 10"
                            value={targetDurationMinutes}
                            onChange={(e) => setTargetDurationMinutes(e.target.value)}
                          />
                          <span className="text-xs text-mudra-muted">minutes</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-mudra-muted whitespace-nowrap">Reach Price At:</label>
                          <input
                            type="time"
                            className="input text-xs font-mono py-1 flex-1"
                            value={targetExactTime}
                            onChange={(e) => setTargetExactTime(e.target.value)}
                          />
                        </div>
                        <p className="text-[10px] text-mudra-muted">
                          Stock will organically reach the target price precisely by this clock time.
                        </p>
                      </div>
                    )}

                    {/* Live AI Drift Preview */}
                    {overrideTicker && overridePrice && (
                      <div className="bg-black/40 rounded-lg p-2 text-[11px] font-mono border border-purple-500/20 text-purple-200">
                        {(() => {
                          const cur = stocks.find((s) => s.ticker === overrideTicker)?.currentPrice || 0;
                          const target = parseFloat(overridePrice) || 0;
                          const diff = target - cur;
                          const pct = cur > 0 ? ((diff / cur) * 100).toFixed(1) : 0;
                          let mins = Number(targetDurationMinutes) || 10;
                          if (targetTimeMode === 'exact_time' && targetExactTime) {
                            const [hh, mm] = targetExactTime.split(':').map(Number);
                            const d = new Date();
                            d.setHours(hh, mm, 0, 0);
                            if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
                            mins = Math.max(1, Math.round((d.getTime() - Date.now()) / 60000));
                          }
                          const cycles = Math.max(1, Math.round((mins * 60) / 30));
                          const perCycle = (diff / cycles).toFixed(2);
                          return (
                            <div className="space-y-0.5">
                              <div className="flex justify-between">
                                <span className="text-mudra-muted">Trajectory:</span>
                                <span className={diff >= 0 ? 'text-mudra-green font-bold' : 'text-mudra-red font-bold'}>
                                  🪙{cur.toFixed(2)} → 🪙{target.toFixed(2)} ({diff >= 0 ? '+' : ''}{pct}%)
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-mudra-muted">Target Time:</span>
                                <span className="text-white">~{mins} mins ({cycles} cycles of 30s)</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-mudra-muted">Pace:</span>
                                <span className="text-mudra-gold">{perCycle >= 0 ? '+' : ''}🪙{perCycle} / cycle</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleOverridePrice}
                  disabled={!overrideTicker || !overridePrice}
                  className={`w-full py-2.5 font-bold text-sm shadow-md rounded-lg transition-all ${
                    priceSetMode === 'direct'
                      ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
                      : 'bg-mudra-accent hover:bg-purple-600 text-white shadow-purple-500/20'
                  }`}
                >
                  {priceSetMode === 'direct'
                    ? '⚡ Set Price Instantly 🔱'
                    : '🤖 Shift Market to This Price (AI Drift) 📈'}
                </button>

                {overrideMsg && (
                  <div
                    className={`text-xs rounded-lg p-2 font-semibold ${
                      overrideMsg.startsWith('✅') || overrideMsg.startsWith('⚡') || overrideMsg.startsWith('🤖')
                        ? 'text-mudra-green bg-emerald-950/40 border border-emerald-500/30'
                        : 'text-mudra-red bg-red-950/40 border border-red-500/30'
                    }`}
                  >
                    {overrideMsg}
                  </div>
                )}

                {/* Active AI Target Shifts Monitor */}
                {stocks.some((s) => s.pendingShock !== null && (Number(s.pendingShockAt) < 0 || Number(s.pendingShockAt) === 1)) && (
                  <div className="pt-2 border-t border-mudra-border/50 space-y-1.5">
                    <span className="text-[11px] font-bold text-mudra-accent flex items-center gap-1">
                      <span>🤖</span> Active AI Price Shifts in Progress:
                    </span>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                      {stocks
                        .filter((s) => s.pendingShock !== null && (Number(s.pendingShockAt) < 0 || Number(s.pendingShockAt) === 1))
                        .map((s) => {
                          const shockAt = Number(s.pendingShockAt);
                          const deadline = shockAt < 0 ? Math.abs(shockAt) : null;
                          const remainingMs = deadline ? Math.max(0, deadline - clock) : null;
                          const remainingMins = remainingMs !== null ? Math.floor(remainingMs / 60000) : null;
                          const remainingSecs = remainingMs !== null ? Math.floor((remainingMs % 60000) / 1000) : null;
                          const deadlineTimeStr = deadline ? new Date(deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

                          return (
                            <div
                              key={s.ticker}
                              className="flex items-center justify-between p-2 rounded-lg bg-purple-950/30 border border-purple-500/30 text-xs gap-2"
                            >
                              <div className="flex flex-col">
                                <span className="font-mono font-bold text-white flex items-center gap-1">
                                  {s.ticker}
                                  <span className="text-[10px] font-normal text-mudra-muted">({s.name})</span>
                                </span>
                                <span className="text-[11px] text-mudra-muted">
                                  🪙{s.currentPrice?.toFixed(2)} → <strong className="text-emerald-400">🪙{s.pendingShock}</strong>
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                {deadline ? (
                                  <div className="text-right">
                                    <div className="text-[11px] font-mono text-purple-200">
                                      {remainingMs <= 0 ? '🏁 Finalizing' : `⏱️ ${remainingMins}m ${remainingSecs}s`}
                                    </div>
                                    <div className="text-[10px] text-mudra-muted">
                                      reach {deadlineTimeStr}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-purple-300">Drifting</span>
                                )}
                                <button
                                  onClick={() => handleCancelTargetShift(s.ticker)}
                                  className="px-2 py-1 rounded bg-red-950/50 hover:bg-red-900/60 border border-red-500/30 text-[10px] text-red-300 font-bold"
                                >
                                  ✕ Cancel
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Grid: Quick Player Calibrator & Realtime Stock Monitor */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* 3. 👑 Quick Player Cash & Balance Calibrator */}
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-mudra-gold text-lg flex items-center gap-1.5">
                  <span>👑</span> Player & Tester Cash Control
                </h2>
                <span className="text-[11px] font-mono text-purple-400 bg-purple-950/40 border border-purple-500/30 px-2 py-0.5 rounded">
                  God Calibrator
                </span>
              </div>
              <p className="text-mudra-muted text-xs">
                Bring participants or testers to any cash amount, grant event bonus capital, or wipe excess profits.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-mudra-muted block mb-1">Select Player or Tester</label>
                  <select
                    className="input text-sm"
                    value={quickPlayerId}
                    onChange={(e) => setQuickPlayerId(e.target.value)}
                  >
                    <option value="">-- Choose Trader ({users.filter((u) => u.role !== 'admin').length} accounts) --</option>
                    {users
                      .filter((u) => u.role !== 'admin')
                      .map((u) => (
                        <option key={u.uid || u.id} value={u.uid || u.id}>
                          {u.name} [{u.participantId || 'NO-ID'}] – Cash: 🪙{Number(u.cash || 0).toLocaleString('en-IN')}
                        </option>
                      ))}
                  </select>
                </div>

                {quickPlayerId && (
                  <div className="bg-mudra-bg p-3 rounded-xl border border-mudra-border space-y-2">
                    {(() => {
                      const sel = users.find((u) => (u.uid || u.id) === quickPlayerId);
                      if (!sel) return null;
                      return (
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <span className="text-white font-bold">{sel.name}</span>
                            <span className="text-mudra-muted font-mono ml-1.5">({sel.participantId})</span>
                          </div>
                          <div className="font-mono text-mudra-green font-bold flex items-center gap-1">
                            <MudraIcon className="w-3.5 h-3.5" />
                            {Number(sel.cash || 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                      );
                    })()}

                    <div>
                      <label className="text-[11px] text-mudra-muted block mb-1">
                        Amount to Set / Add / Deduct
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 50000 or 250000"
                        className="input text-xs font-mono py-1.5"
                        value={quickPlayerCash}
                        onChange={(e) => setQuickPlayerCash(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <button
                        onClick={() => handleQuickPlayerCashAction('set')}
                        className="btn-primary text-xs py-1.5 font-bold"
                        title="Set cash exactly to this amount"
                      >
                        Set Cash
                      </button>
                      <button
                        onClick={() => handleQuickPlayerCashAction('bonus')}
                        className="btn-green text-xs py-1.5 font-bold"
                        title="Add this bonus amount to player"
                      >
                        + Add Bonus
                      </button>
                      <button
                        onClick={() => handleQuickPlayerCashAction('deduct')}
                        className="bg-red-950/60 border border-red-500/50 hover:bg-red-900/60 text-red-300 text-xs py-1.5 rounded-lg font-bold"
                        title="Deduct this amount from player"
                      >
                        - Deduct
                      </button>
                    </div>

                    <div className="flex gap-2 pt-1 border-t border-mudra-border/40">
                      <button
                        onClick={() => handleQuickPlayerCashAction('reset')}
                        className="flex-1 py-1 text-xs rounded bg-mudra-card border border-mudra-border text-mudra-gold hover:text-white font-semibold"
                      >
                        🔄 Reset to 🪙2L
                      </button>
                      <button
                        onClick={() => setInspectUserId(quickPlayerId)}
                        className="flex-1 py-1 text-xs rounded bg-mudra-card border border-mudra-border text-mudra-accent hover:text-white font-semibold"
                      >
                        🔍 Deep Inspect
                      </button>
                    </div>
                  </div>
                )}

                {quickPlayerMsg && (
                  <div
                    className={`text-xs rounded-lg p-2 font-semibold ${
                      quickPlayerMsg.startsWith('✅') || quickPlayerMsg.startsWith('⚠️')
                        ? 'text-mudra-green bg-emerald-950/40 border border-emerald-500/30'
                        : 'text-mudra-red bg-red-950/40 border border-red-500/30'
                    }`}
                  >
                    {quickPlayerMsg}
                  </div>
                )}
              </div>
            </div>

            {/* 4. 📈 Real-Time 30-Stock Price Monitor */}
            <div className="card space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-white text-base">📈 Live Market Prices ({stocks.length})</h2>
                <span className="text-[11px] font-mono text-mudra-muted">Continuous 30s</span>
              </div>
              <div className="space-y-1 overflow-y-auto max-h-[300px] pr-1">
                {stocks.map((s) => {
                  const chg = s.previousPrice
                    ? ((s.currentPrice - s.previousPrice) / s.previousPrice) * 100
                    : 0;
                  return (
                    <div
                      key={s.ticker}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-mudra-bg/70 border-b border-mudra-border/40 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-white font-bold w-14">{s.ticker}</span>
                        <span className="text-[11px] text-mudra-muted truncate max-w-[120px]">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-white font-bold flex items-center gap-0.5">
                          <MudraIcon className="w-3 h-3" />{s.currentPrice?.toFixed(2)}
                        </span>
                        <span
                          className={`font-mono text-xs w-16 text-right font-semibold ${
                            chg >= 0 ? 'text-mudra-green' : 'text-mudra-red'
                          }`}
                        >
                          {chg >= 0 ? '+' : ''}
                          {chg.toFixed(2)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setOverrideTicker(s.ticker);
                            setOverridePrice(s.currentPrice?.toString() || '');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="text-[10px] text-mudra-gold hover:underline font-bold"
                          title="Override this stock's price"
                        >
                          ⚡ Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NEWS PUBLISHER ── */}
      {activeTab === 'news' && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-mudra-gold text-lg">📰 News & Market Shock Publisher</h2>
                <p className="text-xs text-mudra-muted">
                  Publish market news to move the 30 Mudra stocks. Works 100% autonomously without external API keys.
                </p>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                ⚡ 5-Min Reaction Timer
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-mudra-muted block mb-1">
                  News Text or Social Caption (Paste from Instagram / YouTube / Press Release)
                </label>
                <textarea
                  className="input min-h-[90px] resize-y text-sm"
                  placeholder="e.g. State Bank of Mudra reports massive Q3 profit growth; RBI cuts repo rates boost banking sector..."
                  value={newsText}
                  onChange={(e) => setNewsText(e.target.value)}
                />
              </div>

              <button
                onClick={handleAnalyze}
                disabled={aiLoading || !newsText.trim()}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
              >
                {aiLoading ? (
                  <span>🤖 Analyzing News & Detecting Affected Stocks...</span>
                ) : (
                  <span>🤖 Auto-Detect Affected Stocks & Sentiment</span>
                )}
              </button>

              {/* AI / Engine Result Banner */}
              {aiResult && (
                <div className="bg-mudra-bg rounded-xl p-3.5 border border-mudra-border space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-mudra-gold flex items-center gap-1">
                      <span>⚡ Engine:</span>
                      <span className="text-white font-mono uppercase bg-mudra-card px-1.5 py-0.5 rounded border border-mudra-border">
                        {aiResult.engine}
                      </span>
                    </span>
                    <span className="text-mudra-muted text-[11px]">
                      {aiResult.engine === 'built-in' ? 'Zero-Key Autonomous Parser' : 'Cloud LLM'}
                    </span>
                  </div>

                  <div className="text-xs flex items-center gap-2 flex-wrap">
                    <span className="text-mudra-muted">Suggested Stocks:</span>
                    <span className="text-white font-mono font-bold">
                      {aiResult.affectedTickers?.length > 0
                        ? aiResult.affectedTickers.join(', ')
                        : 'None auto-detected (pick manually below)'}
                    </span>
                  </div>

                  <div className="text-xs text-mudra-muted italic bg-mudra-card/50 p-2 rounded border border-mudra-border/40">
                    "{aiResult.reasoning}"
                  </div>
                </div>
              )}

              {/* Headline & Body Inputs */}
              <div>
                <label className="text-xs text-mudra-muted block mb-1">
                  Headline <span className="text-mudra-red">*</span>
                </label>
                <input
                  className="input text-sm"
                  value={newsHeadline}
                  onChange={(e) => setNewsHeadline(e.target.value)}
                  placeholder="e.g. Banking Stocks Surge on RBI Liquidity Boost"
                />
              </div>

              <div>
                <label className="text-xs text-mudra-muted block mb-1">Detailed Story / Body (Optional)</label>
                <textarea
                  className="input text-xs min-h-[50px]"
                  value={newsBody}
                  onChange={(e) => setNewsBody(e.target.value)}
                  placeholder="Additional context or full news body for students..."
                />
              </div>

              {/* ── 30-Stock Visual Selector Chips ── */}
              <div className="border-t border-mudra-border/60 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">Target Mudra Stocks</span>
                    <span className="text-[11px] font-mono font-bold bg-mudra-accent/20 text-mudra-accent px-2 py-0.2 rounded-full">
                      {selectedTickers.length} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        const visible = (newsSectorFilter === 'ALL'
                          ? COMPANIES
                          : COMPANIES.filter((c) => c.sector === newsSectorFilter)
                        ).map((c) => c.ticker);
                        setSelectedTickers((prev) => Array.from(new Set([...prev, ...visible])));
                      }}
                      className="text-mudra-accent hover:underline text-[11px]"
                    >
                      + Add All Visible
                    </button>
                    <span className="text-mudra-muted">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTickers([])}
                      className="text-mudra-muted hover:text-white text-[11px]"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Sector filter pills */}
                <div className="flex gap-1 flex-wrap mb-2">
                  {['ALL', ...Array.from(new Set(COMPANIES.map((c) => c.sector).filter(Boolean)))].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setNewsSectorFilter(sec)}
                      className={`text-[10px] px-2 py-0.5 rounded-full transition-all ${
                        newsSectorFilter === sec
                          ? 'bg-mudra-gold text-black font-bold'
                          : 'bg-mudra-bg border border-mudra-border/60 text-mudra-muted hover:text-white'
                      }`}
                    >
                      {sec}
                    </button>
                  ))}
                </div>

                {/* Chips Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-[170px] overflow-y-auto p-2 bg-mudra-bg/80 rounded-xl border border-mudra-border/60">
                  {COMPANIES.filter((c) => newsSectorFilter === 'ALL' || c.sector === newsSectorFilter).map((comp) => {
                    const isSelected = selectedTickers.includes(comp.ticker);
                    return (
                      <button
                        key={comp.ticker}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedTickers(selectedTickers.filter((t) => t !== comp.ticker));
                          } else {
                            setSelectedTickers([...selectedTickers, comp.ticker]);
                          }
                        }}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all border text-left ${
                          isSelected
                            ? 'bg-amber-500/20 border-mudra-gold text-white font-bold shadow'
                            : 'bg-mudra-card/50 border-mudra-border/40 text-mudra-muted hover:border-mudra-border hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span>{comp.logo || '📈'}</span>
                          <span className="font-mono">{comp.ticker}</span>
                        </div>
                        {isSelected ? (
                          <span className="text-mudra-gold text-[11px] font-bold">✓</span>
                        ) : (
                          <span className="text-[10px] text-mudra-muted/60">{comp.sector}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Sentiment & Market Shock Impact Controls ── */}
              <div className="border-t border-mudra-border/60 pt-3 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-mudra-muted block mb-1">Market Sentiment</label>
                    <div className="flex gap-1">
                      {[
                        { id: 'positive', label: '📈 Bullish' },
                        { id: 'neutral', label: '⚖️ Neutral' },
                        { id: 'negative', label: '📉 Bearish' },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSentiment(s.id)}
                          className={`flex-1 py-1 text-xs rounded-lg font-semibold border transition-all ${
                            sentiment === s.id
                              ? s.id === 'positive'
                                ? 'bg-mudra-green text-black border-mudra-green'
                                : s.id === 'negative'
                                ? 'bg-mudra-red text-white border-mudra-red'
                                : 'bg-mudra-gold text-black border-mudra-gold'
                              : 'bg-mudra-bg border-mudra-border text-mudra-muted hover:text-white'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-mudra-muted">Shock Magnitude (%)</label>
                      <span
                        className={`text-xs font-mono font-bold ${
                          shockPercent > 0
                            ? 'text-mudra-green'
                            : shockPercent < 0
                            ? 'text-mudra-red'
                            : 'text-mudra-gold'
                        }`}
                      >
                        {shockPercent > 0 ? '+' : ''}
                        {shockPercent}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="-25"
                        max="25"
                        step="1"
                        value={shockPercent}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setShockPercent(val);
                          if (val > 0) setSentiment('positive');
                          else if (val < 0) setSentiment('negative');
                        }}
                        className="flex-1 accent-mudra-gold cursor-pointer"
                      />
                      <input
                        type="number"
                        min="-25"
                        max="25"
                        value={shockPercent}
                        onChange={(e) => setShockPercent(Number(e.target.value))}
                        className="input w-16 text-center text-xs py-1 px-1 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-mudra-muted">Quick Shocks:</span>
                  {[
                    { label: '+15% Rally', val: 15, sent: 'positive' },
                    { label: '+7% Up', val: 7, sent: 'positive' },
                    { label: '0% Flat', val: 0, sent: 'neutral' },
                    { label: '-7% Down', val: -7, sent: 'negative' },
                    { label: '-15% Crash', val: -15, sent: 'negative' },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setShockPercent(p.val);
                        setSentiment(p.sent);
                      }}
                      className={`text-[11px] px-2 py-0.5 rounded border transition-all ${
                        shockPercent === p.val
                          ? 'bg-mudra-gold/20 border-mudra-gold text-mudra-gold font-bold'
                          : 'bg-mudra-bg border-mudra-border text-mudra-muted hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Publish Action Button */}
              <button
                onClick={handlePublishNews}
                disabled={newsPublishing || (!newsHeadline && !aiResult)}
                className="btn-green w-full py-3 font-bold text-base mt-2 shadow-lg"
              >
                {newsPublishing
                  ? 'Publishing to Market...'
                  : `🚀 Publish News (${selectedTickers.length} stocks | ${
                      shockPercent > 0 ? '+' : ''
                    }${shockPercent}%)`}
              </button>

              {newsMsg && (
                <div
                  className={`text-sm rounded-lg p-2.5 font-semibold ${
                    newsMsg.startsWith('✅')
                      ? 'text-mudra-green bg-emerald-950/40 border border-emerald-500/30'
                      : 'text-mudra-red bg-red-950/40 border border-red-500/30'
                  }`}
                >
                  {newsMsg}
                </div>
              )}
            </div>
          </div>

          {/* Right Information & Engine Guide */}
          <div className="lg:col-span-5 space-y-4">
            <div className="card space-y-3">
              <h3 className="font-bold text-white flex items-center gap-2">
                <span>🤖</span> Autonomous Built-In News Engine
              </h3>
              <p className="text-xs text-mudra-muted leading-relaxed">
                No external API key is needed! Mudra comes equipped with an internal financial intelligence analyzer that scans keywords, detects sectors, assigns sentiment, and strictly restricts target tickers to our 30 official stocks.
              </p>
              <div className="p-3 bg-mudra-bg rounded-lg border border-mudra-border/60 text-xs space-y-2">
                <div className="font-semibold text-mudra-gold">How News Moves the Market:</div>
                <div className="flex gap-2">
                  <span className="font-bold text-mudra-accent">1.</span>
                  <span className="text-mudra-muted">
                    News is published instantly to the student News Feed and ticker marquee.
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-mudra-accent">2.</span>
                  <span className="text-mudra-muted">
                    A <strong>5-minute countdown</strong> begins, giving participants time to read and trade ahead of the price shock.
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-mudra-accent">3.</span>
                  <span className="text-mudra-muted">
                    After 5 minutes, the scheduled price shock triggers, moving target stock prices by your configured percentage.
                  </span>
                </div>
              </div>
            </div>

            <div className="card space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                  Official 30 Mudra Companies
                </h4>
                <span className="text-[11px] font-mono text-mudra-muted">30 Stocks</span>
              </div>
              <p className="text-[11px] text-mudra-muted">
                Only these 30 official companies exist in the tournament. News published here strictly effects these tickers:
              </p>
              <div className="flex flex-wrap gap-1 max-h-[160px] overflow-y-auto p-1.5 bg-mudra-bg rounded-lg border border-mudra-border/40">
                {COMPANIES.map((c) => (
                  <span
                    key={c.ticker}
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-mudra-card border border-mudra-border/50 text-white"
                  >
                    {c.ticker}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Published News Articles Management ── */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-white text-lg flex items-center gap-2">
                <span>📰</span> Published News Articles
              </h2>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-mudra-gold/20 text-mudra-gold border border-mudra-gold/30">
                {adminNewsList.length} Total
              </span>
            </div>
            <span className="text-xs text-mudra-muted hidden sm:inline">
              Live student news feed & marquee ticker
            </span>
          </div>

          {adminNewsList.length === 0 ? (
            <div className="text-center py-8 text-mudra-muted text-sm border border-dashed border-mudra-border rounded-xl">
              No news articles published yet. Use the composer above to publish market developments!
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {adminNewsList.map((item) => {
                const publishedAtDate = item.publishedAt?.toMillis
                  ? new Date(item.publishedAt.toMillis())
                  : item.appliedAt
                  ? new Date(Number(item.appliedAt) - 5 * 60 * 1000)
                  : new Date();
                const appliedAtMs = typeof item.appliedAt === 'number'
                  ? item.appliedAt
                  : (item.appliedAt?.toMillis ? item.appliedAt.toMillis() : new Date(item.appliedAt).getTime());
                const isPendingShock = appliedAtMs && appliedAtMs > clock && item.shockPercent !== 0;
                const remainingSecs = isPendingShock ? Math.max(0, Math.round((appliedAtMs - clock) / 1000)) : 0;
                const remainingMins = Math.floor(remainingSecs / 60);
                const remainingRemSecs = remainingSecs % 60;

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-mudra-bg/70 border border-mudra-border hover:border-mudra-border/80 transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            item.sentiment === 'positive'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                              : item.sentiment === 'negative'
                              ? 'bg-red-950/60 text-red-400 border border-red-800/40'
                              : 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                          }`}
                        >
                          {item.sentiment === 'positive' ? '📈 Bullish' : item.sentiment === 'negative' ? '📉 Bearish' : '⚖️ Neutral'}
                        </span>

                        {item.shockPercent !== 0 && (
                          <span
                            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                              item.shockPercent > 0
                                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                                : 'bg-red-950/40 text-red-300 border border-red-500/30'
                            }`}
                          >
                            {item.shockPercent > 0 ? '+' : ''}{item.shockPercent}% Shock
                          </span>
                        )}

                        {isPendingShock ? (
                          <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-950/50 border border-amber-500/40 rounded px-2 py-0.5 animate-pulse">
                            ⏳ Reaction in {remainingMins}:{String(remainingRemSecs).padStart(2, '0')}
                          </span>
                        ) : (
                          <span className="text-[11px] text-mudra-muted font-mono">
                            ✓ Reaction Triggered
                          </span>
                        )}

                        <span className="text-[11px] text-mudra-muted font-mono ml-auto sm:ml-0">
                          {publishedAtDate.toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <h4 className="text-white font-bold text-sm leading-snug">
                        {item.headline}
                      </h4>

                      {item.body && (
                        <p className="text-xs text-mudra-muted line-clamp-2">
                          {item.body}
                        </p>
                      )}

                      {/* Affected Tickers */}
                      {item.tickers && item.tickers.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[10px] text-mudra-muted">Affected:</span>
                          {item.tickers.map((t) => (
                            <span
                              key={t}
                              className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-mudra-border text-mudra-accent font-bold"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Delete Action Button */}
                    <div className="sm:self-center shrink-0">
                      <button
                        onClick={() => handleDeleteNews(item.id, item.headline)}
                        disabled={deletingNewsId === item.id}
                        className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-300 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                        title="Delete this news article and cancel any pending price shock"
                      >
                        <span>🗑️</span>
                        <span>{deletingNewsId === item.id ? 'Deleting...' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── SHOP MANAGER ── */}
      {activeTab === 'shop' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Create Item */}
            <div className="card space-y-3">
              <h2 className="font-bold text-mudra-gold text-lg">➕ Add Shop Reward / Coupon</h2>
              <p className="text-xs text-mudra-muted">
                Create new vouchers (Amazon, Swiggy, etc.) that students can purchase with Mudra Coins.
              </p>

              <div>
                <label className="text-xs text-mudra-muted block mb-1">Item / Voucher Name</label>
                <input
                  type="text"
                  placeholder="e.g. Amazon ₹500 Gift Voucher"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="input text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-mudra-muted block mb-1">Price (Mudra Coins)</label>
                  <input
                    type="number"
                    placeholder="e.g. 150000"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="input text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-mudra-muted block mb-1">Quantity Stock</label>
                  <input
                    type="number"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    className="input text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-mudra-muted block mb-1">Category</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="input text-sm"
                  >
                    <option value="shopping">🛍️ Shopping (Amazon/Flipkart)</option>
                    <option value="food">🍔 Food (Zomato/Swiggy)</option>
                    <option value="entertainment">🎵 Subscriptions</option>
                    <option value="perks">✨ Event Perks</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-mudra-muted block mb-1">Image URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={newItemImg}
                    onChange={(e) => setNewItemImg(e.target.value)}
                    className="input text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-mudra-muted block mb-1">Description</label>
                <textarea
                  placeholder="Details and how the coupon works..."
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  className="input text-xs min-h-[60px]"
                />
              </div>

              {shopMsg && (
                <div className={`text-xs p-2 rounded ${shopMsg.startsWith('✅') ? 'bg-emerald-950/40 text-emerald-400' : 'bg-red-950/40 text-red-400'}`}>
                  {shopMsg}
                </div>
              )}

              <button onClick={handleAddShopItem} className="btn-primary w-full py-2.5 font-bold text-sm">
                Add to Store 🚀
              </button>
            </div>

            {/* Existing Items */}
            <div className="card">
              <h2 className="font-bold text-white text-lg mb-3">🏪 Current Shop Items ({shopItems.length})</h2>
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {shopItems.length === 0 ? (
                  <div className="text-xs text-mudra-muted py-8 text-center">No items in store yet</div>
                ) : (
                  shopItems.map((item) => (
                    <div key={item.id} className="p-3 bg-mudra-bg rounded-xl border border-mudra-border flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-white text-sm">{item.name}</div>
                        <div className="text-mudra-muted mt-0.5">
                          🪙{item.price.toLocaleString('en-IN')} • {item.quantityAvailable} left in stock
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteShopItem(item.id)}
                        className="btn-red text-xs px-2.5 py-1"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Student Purchases Table */}
          <div className="card">
            <h2 className="font-bold text-white text-lg mb-4 flex items-center justify-between">
              <span>🎟️ Student Coupon Purchases ({purchases.length})</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-mudra-muted border-b border-mudra-border">
                  <tr>
                    <th className="text-left pb-2">Student</th>
                    <th className="text-left pb-2">Item</th>
                    <th className="text-left pb-2">Delivered Coupon Code</th>
                    <th className="text-right pb-2">Paid</th>
                    <th className="text-right pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-mudra-muted">
                        No purchases recorded yet
                      </td>
                    </tr>
                  ) : (
                    purchases.map((p) => (
                      <tr key={p.id} className="border-b border-mudra-border/40 hover:bg-mudra-bg/40">
                        <td className="py-2.5 font-semibold text-white">{p.userName}</td>
                        <td className="py-2.5 text-mudra-muted">{p.itemName}</td>
                        <td className="py-2.5 font-mono text-mudra-green font-bold select-all">
                          {p.couponCode}
                        </td>
                        <td className="py-2.5 text-right font-mono text-white">
                          🪙{p.pricePaid.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 text-right text-mudra-muted">
                          {new Date(p.purchasedAt).toLocaleDateString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── FINANCE CONTROL ── */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Commodities Panel */}
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-amber-400 text-lg">🪙 Commodities (Gold & Silver)</h2>
                <button
                  onClick={handleManualCommodityCycle}
                  className="btn-outline text-xs px-3 py-1 font-semibold"
                >
                  ⚡ Tick Prices
                </button>
              </div>
              <p className="text-xs text-mudra-muted">
                Commodities drift slowly (±0.15% per cycle). You can also manually tick them.
              </p>
              <div className="space-y-2">
                {adminCommodities.map((c) => (
                  <div key={c.symbol} className="bg-mudra-bg p-3 rounded-xl border border-mudra-border flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-white text-sm">{c.name} ({c.symbol})</div>
                      <div className="text-mudra-muted mt-0.5">Base Commodity</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-white font-bold text-sm">
                        🪙{c.currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/g
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mutual Funds Panel */}
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-emerald-400 text-lg">📈 Mutual Funds (NAV)</h2>
                <button
                  onClick={handleManualMFCycle}
                  className="btn-outline text-xs px-3 py-1 font-semibold"
                >
                  ⚡ Tick NAVs
                </button>
              </div>
              <p className="text-xs text-mudra-muted">
                Managed funds gain steady returns according to their fixed target rate.
              </p>
              <div className="space-y-2">
                {adminFunds.map((f) => (
                  <div key={f.id} className="bg-mudra-bg p-3 rounded-xl border border-mudra-border flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-white text-sm">{f.name} ({f.id})</div>
                      <div className="text-mudra-green mt-0.5 font-semibold">
                        +{(f.dailyReturnRate * 100).toFixed(1)}% Daily Target ({f.risk.toUpperCase()})
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-white font-bold text-sm">
                        NAV 🪙{f.nav.toFixed(3)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active Savings Deposits Monitor */}
          <div className="card">
            <h2 className="font-bold text-white text-lg mb-3">
              🔒 Student Fixed Savings Deposits ({adminSavings.length})
            </h2>
            <div className="overflow-x-auto max-h-[300px]">
              <table className="w-full text-xs">
                <thead className="text-mudra-muted border-b border-mudra-border">
                  <tr>
                    <th className="text-left pb-2">Student</th>
                    <th className="text-right pb-2">Locked Principal</th>
                    <th className="text-center pb-2">Rate</th>
                    <th className="text-right pb-2">Maturity Payout</th>
                    <th className="text-center pb-2">Status</th>
                    <th className="text-right pb-2">Matures At</th>
                  </tr>
                </thead>
                <tbody>
                  {adminSavings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-mudra-muted">
                        No student deposits yet
                      </td>
                    </tr>
                  ) : (
                    adminSavings.map((s) => (
                      <tr key={s.id} className="border-b border-mudra-border/40">
                        <td className="py-2 font-semibold text-white">{s.profiles?.name || 'Trader'}</td>
                        <td className="py-2 text-right font-mono text-white">
                          🪙{Number(s.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 text-center text-mudra-green font-bold">
                          +{(Number(s.rate) * 100).toFixed(0)}%
                        </td>
                        <td className="py-2 text-right font-mono text-mudra-gold font-bold">
                          🪙{Number(s.payout).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.status === 'withdrawn' ? 'bg-mudra-bg text-mudra-muted' : 'bg-emerald-950 text-emerald-400'
                          }`}>
                            {s.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 text-right text-mudra-muted">
                          {new Date(s.matures_at).toLocaleDateString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TRADE FEED ── */}
      {activeTab === 'trades' && (
        <div className="card">
          <h2 className="font-bold text-white mb-4">Live Trade Feed</h2>
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {trades.length === 0 ? (
              <div className="text-mudra-muted text-center py-8">No trades yet</div>
            ) : (
              trades.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-2 border-b border-mudra-border/50 text-sm"
                >
                  <span className="text-mudra-muted text-xs w-24 shrink-0">
                    {t.timestamp?.toDate?.()?.toLocaleTimeString('en-IN') || '--:--'}
                  </span>
                  <span className="font-semibold text-white w-28 truncate">{t.userName}</span>
                  <span
                    className={`font-semibold w-10 ${
                      t.type === 'buy' ? 'text-mudra-green' : 'text-mudra-red'
                    }`}
                  >
                    {t.type === 'buy' ? 'BUY' : 'SELL'}
                  </span>
                  <span className="font-mono text-white w-20">
                    {t.quantity}× {t.ticker}
                  </span>
                  <span className="font-mono text-mudra-muted text-xs flex items-center gap-0.5">
                    <MudraIcon className="w-3 h-3" />{t.totalValue?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── LEADERBOARD ── */}
      {activeTab === 'board' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-white text-lg">🏆 Live Leaderboard ({board.length})</h2>
              <p className="text-xs text-mudra-muted">Click any player to inspect portfolio and calibrate funds</p>
            </div>
            <span className="text-xs font-mono text-mudra-gold bg-mudra-gold/10 border border-mudra-gold/30 px-2.5 py-1 rounded-lg">
              Admin Inspection Active
            </span>
          </div>
          <div className="space-y-1">
            {board.map((entry, i) => (
              <div
                key={entry.uid}
                onClick={() => setInspectUserId(entry.uid)}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-transparent hover:border-mudra-border hover:bg-mudra-bg/60 cursor-pointer transition-all text-sm group"
              >
                <span className="text-mudra-muted w-8 font-bold">#{i + 1}</span>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="text-white font-semibold flex items-center gap-2">
                    <span className="truncate">{entry.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                        entry.isTester
                          ? 'bg-amber-500/20 text-amber-300'
                          : entry.isAdmin
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {entry.isAdmin ? 'Admin' : entry.isTester ? 'Tester' : 'Participant'}
                    </span>
                  </div>
                  <div className="text-xs text-mudra-muted font-mono">{entry.participantId || '—'}</div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <span className="font-mono font-bold text-white flex items-center gap-0.5 text-sm">
                    <MudraIcon className="w-3.5 h-3.5" />
                    {(entry.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setInspectUserId(entry.uid);
                    }}
                    className="btn-outline text-xs py-1 px-2.5 text-mudra-gold border-mudra-gold/30 group-hover:border-mudra-gold font-bold"
                  >
                    ⚙️ Calibrate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PLAYERS ── */}
      {activeTab === 'players' && (
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-bold text-white text-lg">
                👥 Registered Players & Testers ({users.filter((u) => u.role !== 'admin').length})
              </h2>
              <p className="text-xs text-mudra-muted">
                God Admin controls — inspect live portfolio, grant funds, deduct excess profit, or 1-click reset accounts.
              </p>
            </div>
            <button
              onClick={() => getAllUsers().then(setUsers)}
              className="btn-outline text-xs px-3 py-1.5 font-semibold text-mudra-gold border-mudra-gold/30 hover:bg-mudra-gold/10 shrink-0"
            >
              🔄 Refresh List
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-mudra-muted text-xs border-b border-mudra-border">
                <tr>
                  <th className="text-left pb-2">Name & Email</th>
                  <th className="text-left pb-2">Participant ID</th>
                  <th className="text-left pb-2">Type</th>
                  <th className="text-right pb-2">Cash Balance</th>
                  <th className="text-right pb-2">God Controls</th>
                </tr>
              </thead>
              <tbody>
                {users
                  .filter((u) => u.role !== 'admin')
                  .map((u) => (
                    <tr
                      key={u.uid || u.id}
                      className="border-b border-mudra-border/50 hover:bg-mudra-bg/50 transition-colors"
                    >
                      <td className="py-2.5 text-white font-semibold">
                        <div>{u.name}</div>
                        <div className="text-[11px] text-mudra-muted font-normal">{u.email}</div>
                      </td>
                      <td className="py-2.5 text-mudra-muted font-mono">{u.participantId || '—'}</td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            (u.participantId || '').startsWith('TRIAL')
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {(u.participantId || '').startsWith('TRIAL') ? 'Tester' : 'Participant'}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono text-mudra-green font-bold">
                        <div className="flex items-center justify-end gap-1">
                          <MudraIcon className="w-3.5 h-3.5" />
                          {(u.cash || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => setInspectUserId(u.uid || u.id)}
                          className="btn-outline text-xs py-1 px-3 font-bold text-mudra-gold border-mudra-gold/40 hover:bg-mudra-gold/20"
                        >
                          ⚙️ Manage & Calibrate
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SETUP ── */}
      {activeTab === 'setup' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="font-bold text-white mb-4">⚙️ Event Setup</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-mudra-muted block mb-1">Event Start</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={eventStart}
                  onChange={(e) => setEventStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-mudra-muted block mb-1">Event End (Day 7)</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={eventEnd}
                  onChange={(e) => setEventEnd(e.target.value)}
                />
              </div>
              <button onClick={handleSetEvent} className="btn-primary w-full">
                Save Event Config
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="font-bold text-white mb-4">🌱 Initialize Market</h2>
            <p className="text-mudra-muted text-sm mb-4">
              Run this once before the event to seed all 30 company stocks into Supabase.
            </p>
            <button onClick={handleSeed} className="btn-green w-full py-3">
              Seed All 30 Stocks →
            </button>

            <div className="mt-4 p-3 bg-mudra-bg rounded-lg text-xs text-mudra-muted space-y-1">
              <div className="font-semibold text-white mb-2">Stocks that will be seeded:</div>
              {COMPANIES.map((c) => (
                <div key={c.ticker} className="flex justify-between">
                  <span className="font-mono">{c.ticker}</span>
                  <span>🪙{c.startPrice}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Admin Deep-Dive User Inspector & Fund Calibration Modal */}
      {inspectUserId && (
        <UserDetailModal
          userId={inspectUserId}
          onClose={() => {
            setInspectUserId(null);
            getAllUsers().then(setUsers);
          }}
        />
      )}
    </div>
  );
};

export default AdminPage;
