import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import MudraIcon from '../components/MudraIcon';
import {
  getShopItems,
  subscribeShopItems,
  buyShopItem,
  getUserPurchases,
  subscribeUserPurchases,
} from '../supabase/api';
import { supabase } from '../supabase/client';

// Default mock shop items if database hasn't been populated by admin yet
const DEFAULT_ITEMS = [
  {
    name: 'Amazon ₹500 Gift Voucher',
    description: 'Instant Amazon Pay gift card code redeemable on all shopping, bill payments, and recharge.',
    price: 150000,
    category: 'shopping',
    image_url: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=400&q=80',
    quantity_available: 10,
  },
  {
    name: 'Amazon ₹1,000 Premium Voucher',
    description: 'High-tier Amazon balance voucher for top market performers.',
    price: 280000,
    category: 'shopping',
    image_url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=400&q=80',
    quantity_available: 5,
  },
  {
    name: 'Zomato / Swiggy ₹250 Food Feast',
    description: 'Delicious hot meal voucher delivered straight to your dorm or home.',
    price: 80000,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
    quantity_available: 15,
  },
  {
    name: 'Spotify Premium 3-Month Pass',
    description: 'Ad-free high-fidelity music streaming for your late-night trading sessions.',
    price: 95000,
    category: 'entertainment',
    image_url: 'https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=400&q=80',
    quantity_available: 8,
  },
  {
    name: 'Mudra VIP Trader Trophy Badge',
    description: 'Exclusive digital collector badge displayed beside your name on the Leaderboard.',
    price: 50000,
    category: 'perks',
    image_url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=400&q=80',
    quantity_available: 25,
  },
];

const ShopPage = () => {
  const { user, userData, refreshUserData } = useAuth();
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [activeTab, setActiveTab] = useState('shop'); // shop | my_coupons
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Purchase modal
  const [confirmItem, setConfirmItem] = useState(null);
  const [buying, setBuying] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(null); // purchase object
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  const userId = user?.id || user?.uid;

  useEffect(() => {
    // Subscribe to shop items
    const unsubItems = subscribeShopItems((data) => {
      if (data && data.length > 0) {
        setItems(data);
      } else {
        // Auto-seed default items if table is empty
        seedDefaultItems();
      }
    });

    // Subscribe to user purchases
    let unsubPurchases;
    if (userId) {
      unsubPurchases = subscribeUserPurchases(userId, setPurchases);
    }

    return () => {
      unsubItems?.();
      unsubPurchases?.();
    };
  }, [userId]);

  const seedDefaultItems = async () => {
    try {
      const { data: existing } = await supabase.from('shop_items').select('id').limit(1);
      if (!existing || existing.length === 0) {
        await supabase.from('shop_items').insert(DEFAULT_ITEMS);
        const { data } = await supabase.from('shop_items').select('*');
        if (data) setItems(data);
      }
    } catch (e) {
      console.error('Error seeding default shop items:', e);
    }
  };

  const handleBuy = async () => {
    if (!confirmItem || !userId) return;
    setBuying(true);
    setErrorMsg('');
    try {
      const purchase = await buyShopItem({
        userId,
        userName: userData?.name || 'Trader',
        itemId: confirmItem.id,
      });
      setPurchaseSuccess(purchase);
      setConfirmItem(null);
      await refreshUserData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBuying(false);
    }
  };

  const copyCodeToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const categories = [
    { id: 'all', label: 'All Items' },
    { id: 'shopping', label: '🛍️ Shopping' },
    { id: 'food', label: '🍔 Food' },
    { id: 'entertainment', label: '🎵 Subscriptions' },
    { id: 'perks', label: '✨ Perks' },
  ];

  const filteredItems = items.filter((item) => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-2">
            🛍️ <span className="text-mudra-gold">Mudra Rewards Shop</span>
          </h1>
          <p className="text-mudra-muted text-sm mt-1">
            Turn your trading profits into Amazon vouchers, meal passes, and event perks.
          </p>
        </div>

        {/* User Balance Chip */}
        <div className="card flex items-center gap-3 py-2 px-4 self-start md:self-auto border-mudra-accent/30 bg-mudra-accent/5">
          <div className="text-xs text-mudra-muted">Spending Coins:</div>
          <div className="text-lg font-bold font-mono text-mudra-green flex items-center gap-1">
            <MudraIcon className="w-4 h-4" />
            {Number(userData?.cash || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2 border-b border-mudra-border pb-4 mb-6">
        <button
          onClick={() => setActiveTab('shop')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'shop'
              ? 'bg-mudra-accent text-white shadow-lg shadow-mudra-accent/25'
              : 'bg-mudra-card border border-mudra-border text-mudra-muted hover:text-white'
          }`}
        >
          🏪 Coupon Market ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('my_coupons')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all relative ${
            activeTab === 'my_coupons'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25'
              : 'bg-mudra-card border border-mudra-border text-mudra-muted hover:text-white'
          }`}
        >
          🎟️ My Purchased Coupons ({purchases.length})
          {purchases.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-mudra-gold animate-ping" />
          )}
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: SHOP MARKETPLACE */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'shop' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Category Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  selectedCategory === c.id
                    ? 'bg-mudra-border text-white border border-mudra-accent'
                    : 'bg-mudra-bg/70 text-mudra-muted hover:text-white border border-transparent'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Items Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => {
              const canAfford = (userData?.cash || 0) >= item.price;
              const isOutOfStock = item.quantityAvailable <= 0;

              return (
                <div
                  key={item.id}
                  className="card border-mudra-border hover:border-mudra-accent/40 transition-all flex flex-col justify-between overflow-hidden group"
                >
                  <div>
                    {/* Item Image */}
                    <div className="h-40 -mx-6 -mt-6 mb-4 overflow-hidden relative bg-mudra-bg">
                      <img
                        src={
                          item.imageUrl ||
                          'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=400&q=80'
                        }
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-2 right-2">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-black/75 backdrop-blur text-mudra-gold border border-mudra-gold/30">
                          {item.quantityAvailable > 0
                            ? `${item.quantityAvailable} left`
                            : 'Sold Out'}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-bold text-white text-base mb-1.5 leading-snug">{item.name}</h3>
                    <p className="text-xs text-mudra-muted mb-4 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Price & Buy Button */}
                  <div className="border-t border-mudra-border/50 pt-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-mudra-muted">Price</div>
                      <div className="text-xl font-black font-mono text-white flex items-center gap-1">
                        <MudraIcon className="w-4 h-4" />
                        {item.price.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setConfirmItem(item);
                        setErrorMsg('');
                      }}
                      disabled={!canAfford || isOutOfStock}
                      className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                        isOutOfStock
                          ? 'bg-mudra-bg text-mudra-muted border border-mudra-border cursor-not-allowed'
                          : canAfford
                          ? 'btn-primary shadow-lg shadow-mudra-accent/20'
                          : 'bg-mudra-bg text-mudra-muted border border-mudra-border hover:border-red-500/50'
                      }`}
                    >
                      {isOutOfStock
                        ? 'Out of Stock'
                        : canAfford
                        ? 'Buy Coupon 🛒'
                        : 'Need More Coins'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: MY PURCHASED COUPONS */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'my_coupons' && (
        <div className="space-y-4 animate-fadeIn">
          {purchases.length === 0 ? (
            <div className="card text-center py-16 text-mudra-muted">
              <div className="text-4xl mb-3">🎟️</div>
              <p className="font-semibold text-white">No coupons purchased yet</p>
              <p className="text-xs text-mudra-muted mt-1 max-w-sm mx-auto">
                Explore the marketplace and exchange your Mudra Coins for Amazon vouchers and gift cards!
              </p>
              <button
                onClick={() => setActiveTab('shop')}
                className="btn-primary mt-4 text-xs px-4 py-2"
              >
                Go to Shop →
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {purchases.map((pur) => (
                <div
                  key={pur.id}
                  className="card border-mudra-gold/30 bg-mudra-card/90 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <span className="text-xs font-semibold text-mudra-gold uppercase tracking-wider mb-1 block">
                        🎁 Verified Coupon
                      </span>
                      <h3 className="font-bold text-white text-base">{pur.itemName}</h3>
                      <div className="text-xs text-mudra-muted mt-0.5">
                        Purchased on: {new Date(pur.purchasedAt).toLocaleDateString('en-IN')}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-mudra-muted">Paid</div>
                      <div className="font-mono font-bold text-white text-sm flex items-center justify-end gap-1">
                        <MudraIcon className="w-3.5 h-3.5" />
                        {pur.pricePaid.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Coupon Code Box */}
                  <div className="bg-mudra-bg border border-mudra-border rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="font-mono font-bold text-mudra-green tracking-widest text-base select-all">
                      {pur.couponCode}
                    </div>
                    <button
                      onClick={() => copyCodeToClipboard(pur.couponCode)}
                      className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1 font-semibold"
                    >
                      {copiedCode === pur.couponCode ? '✅ Copied' : '📋 Copy'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* CONFIRM PURCHASE MODAL */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {confirmItem && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Confirm Purchase</h3>
              <button onClick={() => setConfirmItem(null)} className="text-mudra-muted hover:text-white text-xl">
                ✕
              </button>
            </div>

            <div className="bg-mudra-bg p-4 rounded-xl border border-mudra-border mb-4 space-y-2">
              <div className="font-bold text-white text-base">{confirmItem.name}</div>
              <p className="text-xs text-mudra-muted">{confirmItem.description}</p>
              <div className="border-t border-mudra-border pt-2 flex justify-between items-center text-sm font-semibold">
                <span className="text-mudra-muted">Cost:</span>
                <span className="font-mono text-white flex items-center gap-1">
                  <MudraIcon className="w-4 h-4" />
                  {confirmItem.price.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="bg-mudra-bg/70 p-3 rounded-xl border border-mudra-border/50 text-xs text-mudra-muted mb-4 space-y-1">
              <div className="flex justify-between">
                <span>Your Balance:</span>
                <span className="font-mono text-white">🪙{Number(userData?.cash || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>Balance After Purchase:</span>
                <span className="font-mono text-mudra-green">
                  🪙{(Number(userData?.cash || 0) - confirmItem.price).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {errorMsg && (
              <div className="text-xs p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 mb-4">
                ❌ {errorMsg}
              </div>
            )}

            <button
              onClick={handleBuy}
              disabled={buying}
              className="btn-primary w-full py-3.5 font-bold text-sm shadow-lg shadow-mudra-accent/25"
            >
              {buying ? 'Generating Coupon...' : `Confirm & Deduct 🪙${confirmItem.price.toLocaleString('en-IN')}`}
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* CELEBRATION SUCCESS MODAL */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {purchaseSuccess && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md animate-fadeIn text-center border-mudra-gold/50 shadow-2xl shadow-mudra-gold/10">
            <div className="text-5xl mb-3 animate-bounce">🎉</div>
            <h3 className="text-2xl font-black text-white">Coupon Unlocked!</h3>
            <p className="text-xs text-mudra-muted mt-1">
              You successfully redeemed <strong className="text-white">{purchaseSuccess.item_name}</strong>
            </p>

            {/* Voucher Reveal */}
            <div className="my-6 bg-mudra-bg border-2 border-dashed border-mudra-gold/60 rounded-2xl p-4">
              <div className="text-xs text-mudra-muted mb-1">Your Redemption Code</div>
              <div className="font-mono font-black text-2xl text-mudra-gold tracking-widest my-2 select-all">
                {purchaseSuccess.coupon_code}
              </div>
              <button
                onClick={() => copyCodeToClipboard(purchaseSuccess.coupon_code)}
                className="btn-outline text-xs px-4 py-1.5 mt-1 font-semibold"
              >
                {copiedCode === purchaseSuccess.coupon_code ? '✅ Copied to Clipboard!' : '📋 Copy Code'}
              </button>
            </div>

            <p className="text-xs text-mudra-muted mb-6">
              This coupon is saved in your <strong className="text-white">My Purchased Coupons</strong> tab.
            </p>

            <button
              onClick={() => {
                setPurchaseSuccess(null);
                setActiveTab('my_coupons');
              }}
              className="btn-green w-full py-3 font-bold text-sm"
            >
              View My Coupons →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopPage;
