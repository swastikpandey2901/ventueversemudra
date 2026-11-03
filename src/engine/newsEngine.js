import { supabase } from '../supabase/client';
import { publishNews } from '../supabase/api';
import { scheduleNewsShock } from './priceEngine';
import { MUDRA_NEWS_POOL } from '../data/mudraNewsPool';

// ─── Autonomous 10-Minute News Drop Engine ───────────────────────────────────
// Drops a new story every 10 minutes (actor/entertainment gossip, political debates,
// quirky Mudra human interest decoys, or high-impact corporate moves).
//
// Distributed architecture: Any active browser client checks every 20s, but only
// triggers when >= 10 minutes have elapsed since the last news publication.

const TEN_MINUTES_MS = 10 * 60 * 1000;
let isCheckingNews = false;

export const checkAutonomousNewsDropIfNeeded = async () => {
  if (isCheckingNews) return { checked: false };
  try {
    isCheckingNews = true;

    // Check latest news timestamp
    const { data: latest } = await supabase
      .from('news')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest?.created_at) {
      const lastTime = new Date(latest.created_at).getTime();
      const elapsed = Date.now() - lastTime;
      if (elapsed < TEN_MINUTES_MS) {
        return {
          dropped: false,
          elapsedMs: elapsed,
          remainingMs: TEN_MINUTES_MS - elapsed,
        };
      }
    }

    // 10 minutes elapsed or no news exists yet -> Trigger news drop!
    const result = await triggerAutonomousNewsDrop();
    return { dropped: true, article: result.article };
  } catch (err) {
    console.error('Autonomous news drop error:', err);
    return { dropped: false, error: err.message };
  } finally {
    isCheckingNews = false;
  }
};

export const triggerAutonomousNewsDrop = async () => {
  // 1. Fetch recent headlines to avoid repeating recently published ones
  const { data: recentNews } = await supabase
    .from('news')
    .select('headline')
    .order('created_at', { ascending: false })
    .limit(15);

  const recentSet = new Set((recentNews || []).map((r) => r.headline));
  const available = MUDRA_NEWS_POOL.filter((item) => !recentSet.has(item.headline));
  const pool = available.length > 0 ? available : MUDRA_NEWS_POOL;

  // 2. Pick a random article from the available pool
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  const shockAt = chosen.shockPercent !== 0 ? Date.now() + 5 * 60 * 1000 : null;

  // 3. Publish to Supabase news table
  await publishNews({
    headline: chosen.headline,
    body: chosen.body,
    tickers: chosen.tickers || [],
    sentiment: chosen.sentiment || 'neutral',
    shockPercent: chosen.shockPercent || 0,
    aiReasoning: chosen.isDecoy
      ? 'Mudra National Press Bureau — Public affairs, entertainment, or political release.'
      : 'Mudra Financial Intelligence Wire — Market development with potential equity impact.',
    appliedAt: shockAt,
    engine: 'autonomous-10m',
  });

  // 4. If actual stock shock, schedule the 5-minute delayed market shock
  if (chosen.shockPercent !== 0 && chosen.tickers?.length > 0) {
    await scheduleNewsShock(chosen.tickers, chosen.shockPercent);
  }

  return { success: true, article: chosen };
};

export const getAutonomousNewsStatus = async () => {
  try {
    const { data: latest } = await supabase
      .from('news')
      .select('created_at, headline')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latest?.created_at) {
      return { lastDrop: null, remainingSeconds: 0 };
    }

    const lastTime = new Date(latest.created_at).getTime();
    const elapsed = Date.now() - lastTime;
    const remainingMs = Math.max(0, TEN_MINUTES_MS - elapsed);
    return {
      lastDrop: new Date(lastTime),
      latestHeadline: latest.headline,
      remainingSeconds: Math.round(remainingMs / 1000),
      isDue: elapsed >= TEN_MINUTES_MS,
    };
  } catch (e) {
    return { lastDrop: null, remainingSeconds: 0 };
  }
};
