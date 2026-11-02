-- ==============================================================================
-- MUDRA PLATFORM - SUPABASE DATABASE SCHEMA
-- Run this entire script in Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- 1. Profiles Table (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  participant_id TEXT DEFAULT '',
  cash NUMERIC(15, 2) DEFAULT 200000.00,
  role TEXT DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Stocks Table
CREATE TABLE IF NOT EXISTS public.stocks (
  ticker TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  sector TEXT NOT NULL,
  category TEXT NOT NULL,
  start_price NUMERIC(12, 2) NOT NULL,
  current_price NUMERIC(12, 2) NOT NULL,
  previous_price NUMERIC(12, 2) NOT NULL,
  liquidity_factor NUMERIC(15, 2) DEFAULT 300000.00,
  price_history JSONB DEFAULT '[]'::jsonb,
  pending_shock NUMERIC(6, 2) DEFAULT NULL,
  pending_shock_at BIGINT DEFAULT NULL,
  buy_volume NUMERIC(15, 2) DEFAULT 0.00,
  sell_volume NUMERIC(15, 2) DEFAULT 0.00,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Holdings Table
CREATE TABLE IF NOT EXISTS public.holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL REFERENCES public.stocks(ticker) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  avg_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ticker)
);

-- 4. Trades Table
CREATE TABLE IF NOT EXISTS public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  ticker TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  quantity INTEGER NOT NULL,
  price NUMERIC(12, 2) NOT NULL,
  total_value NUMERIC(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. News Table
CREATE TABLE IF NOT EXISTS public.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline TEXT NOT NULL,
  body TEXT DEFAULT '',
  tickers TEXT[] DEFAULT '{}',
  sentiment TEXT DEFAULT 'neutral',
  shock_percent NUMERIC(6, 2) DEFAULT 0.00,
  ai_reasoning TEXT DEFAULT '',
  engine TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'pending',
  applied_at BIGINT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Event Config Table
CREATE TABLE IF NOT EXISTS public.event_config (
  id TEXT PRIMARY KEY DEFAULT 'main',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  is_paused BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial event row
INSERT INTO public.event_config (id, is_active, is_paused)
VALUES ('main', true, false)
ON CONFLICT (id) DO NOTHING;

-- 7. Row Level Security (RLS) Configuration
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_config ENABLE ROW LEVEL SECURITY;

-- Allow public read for general platform elements
CREATE POLICY "Public read stocks" ON public.stocks FOR SELECT USING (true);
CREATE POLICY "Public read news" ON public.news FOR SELECT USING (true);
CREATE POLICY "Public read event_config" ON public.event_config FOR SELECT USING (true);
CREATE POLICY "Public read trades" ON public.trades FOR SELECT USING (true);
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);

-- Allow authenticated users / admins full write access as required for the simulation
CREATE POLICY "Allow all actions on stocks" ON public.stocks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions on news" ON public.news FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions on event_config" ON public.event_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions on trades" ON public.trades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions on profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions on holdings" ON public.holdings FOR ALL USING (true) WITH CHECK (true);

-- 8. Enable Realtime Replication for Stocks, Trades, News and Holdings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.stocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.news;
ALTER PUBLICATION supabase_realtime ADD TABLE public.holdings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
