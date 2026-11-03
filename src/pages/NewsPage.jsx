import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { subscribeNews, deleteNews } from '../supabase/api';
import { SECTOR_COLORS, COMPANIES } from '../data/companies';
import { useAuth } from '../context/AuthContext';

const VALID_TICKER_SET = new Set(COMPANIES.map((c) => c.ticker));

const sentimentConfig = {
  positive: { color: 'text-mudra-green', bg: 'bg-emerald-950/20 border-emerald-700/30', icon: '📈', label: 'Bullish' },
  negative: { color: 'text-mudra-red', bg: 'bg-red-950/20 border-red-700/30', icon: '📉', label: 'Bearish' },
  neutral: { color: 'text-mudra-gold', bg: 'bg-amber-950/20 border-amber-700/30', icon: '⚖️', label: 'Neutral' },
};

const NewsPage = () => {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [newsList, setNewsList] = useState([]);
  const [filter, setFilter] = useState('all'); // all | positive | negative | neutral
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteMsg, setDeleteMsg] = useState('');

  const handleDeleteNews = async (id, headline) => {
    const ok = window.confirm(
      `Are you sure you want to delete this news article?\n\n"${headline}"\n\nAny pending stock price shock associated with this news will also be cancelled.`
    );
    if (!ok) return;
    setDeletingId(id);
    try {
      await deleteNews(id);
      setNewsList((prev) => prev.filter((n) => n.id !== id));
      setDeleteMsg('✅ News article deleted and any pending price shock cancelled.');
      setTimeout(() => setDeleteMsg(''), 4000);
    } catch (err) {
      alert(`Error deleting news: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    const unsub = subscribeNews((data) => {
      setNewsList(data || []);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredNews = newsList.filter((n) => {
    if (filter === 'all') return true;
    return n.sentiment === filter;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Navigation Top Bar */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-mudra-border">
        <button
          onClick={() => navigate(-1)}
          className="btn-outline text-xs px-3.5 py-1.5 flex items-center gap-1.5 font-bold hover:bg-mudra-bg transition-colors"
        >
          <span>←</span> Back
        </button>

        <div className="flex items-center gap-3">
          <Link to="/market" className="text-xs text-mudra-accent hover:underline font-semibold">
            Market Watch →
          </Link>
          {userData?.role === 'admin' && (
            <Link to="/admin" className="text-xs text-mudra-gold hover:underline font-semibold bg-amber-950/30 border border-amber-500/30 px-2.5 py-1 rounded">
              ⚡ Publish News
            </Link>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-2">
            📰 <span className="text-mudra-gold">Market News Feed</span>
          </h1>
          <p className="text-mudra-muted text-sm mt-1">
            Real-time corporate & economic releases across the 30 Mudra equities.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 self-start sm:self-auto overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'All News' },
            { id: 'positive', label: '📈 Bullish' },
            { id: 'negative', label: '📉 Bearish' },
            { id: 'neutral', label: '⚖️ Neutral' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setFilter(pill.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                filter === pill.id
                  ? 'bg-mudra-accent text-white font-bold'
                  : 'bg-mudra-card border border-mudra-border text-mudra-muted hover:text-white'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Optional feedback banner */}
      {deleteMsg && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between">
          <span>{deleteMsg}</span>
          <button onClick={() => setDeleteMsg('')} className="text-emerald-400 hover:text-white font-bold ml-2">✕</button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="card text-center py-16 text-mudra-muted">
          <div className="text-3xl mb-2 animate-spin">⏳</div>
          <p>Loading live market news...</p>
        </div>
      ) : filteredNews.length === 0 ? (
        <div className="card text-center py-20 text-mudra-muted">
          <div className="text-4xl mb-3">🔕</div>
          <p className="font-semibold text-white text-base">No news articles found</p>
          <p className="text-xs text-mudra-muted mt-1 max-w-sm mx-auto">
            Stay tuned! Corporate developments, earnings, and macroeconomic policy news will drop right here.
          </p>
          <div className="mt-4">
            <Link to="/market" className="btn-primary text-xs px-4 py-2">
              Explore Live Stocks →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNews.map((news) => {
            const cfg = sentimentConfig[news.sentiment] || sentimentConfig.neutral;
            const publishedAtDate = news.publishedAt?.toMillis
              ? new Date(news.publishedAt.toMillis())
              : news.appliedAt
              ? new Date(Number(news.appliedAt) - 5 * 60 * 1000)
              : new Date();

            return (
              <div
                key={news.id}
                className={`card border ${cfg.bg} hover:border-opacity-60 transition-all`}
              >
                {/* Meta Header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold ${cfg.color} flex items-center gap-1`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-mudra-muted font-mono">
                      {publishedAtDate.toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {userData?.role === 'admin' && (
                      <button
                        onClick={() => handleDeleteNews(news.id, news.headline)}
                        disabled={deletingId === news.id}
                        className="px-2 py-0.5 rounded text-[11px] bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-300 font-bold transition-all flex items-center gap-1 shadow-sm"
                        title="Delete this news and clear pending shock"
                      >
                        {deletingId === news.id ? 'Deleting...' : '🗑️ Delete'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Headline */}
                <h2 className="text-white font-bold text-lg mb-2 leading-snug">{news.headline}</h2>

                {/* Body */}
                {news.body && (
                  <p className="text-mudra-text/90 text-sm leading-relaxed mb-4">{news.body}</p>
                )}

                {/* Affected Stocks with Quick Trade Links (Strictly 30 Mudra Equities) */}
                {(() => {
                  const validTickers = (news.tickers || []).filter((t) => VALID_TICKER_SET.has(t));
                  if (validTickers.length === 0) return null;
                  return (
                    <div className="flex items-center gap-2 flex-wrap border-t border-mudra-border/40 pt-3">
                      <span className="text-xs text-mudra-muted">Affected Equities:</span>
                      {validTickers.map((t) => (
                        <Link
                          key={t}
                          to={`/company/${t}`}
                          className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-mudra-bg border border-mudra-border hover:border-mudra-accent text-mudra-accent transition-all flex items-center gap-1"
                          title={`View ${t} chart and trade`}
                        >
                          <span>{t}</span>
                          <span className="text-[10px] text-mudra-muted">↗</span>
                        </Link>
                      ))}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NewsPage;
