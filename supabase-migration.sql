-- ============================================================
-- KALO — Supabase Migration
-- Run this in Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- 1. Profiles (user settings)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sex TEXT DEFAULT 'm',
  age INT DEFAULT 30,
  height_cm NUMERIC DEFAULT 172,
  weight_kg NUMERIC DEFAULT 70,
  activity_factor NUMERIC DEFAULT 1.55,
  tdee INT DEFAULT 0,
  goal INT DEFAULT 2000,
  plan TEXT,
  water_goal_ml INT DEFAULT 2500,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Daily logs (per-day aggregates: water, workouts)
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  water_ml INT DEFAULT 0,
  workout_sessions INT DEFAULT 0,
  workout_kcal INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 3. Meals (individual meal entries)
CREATE TABLE IF NOT EXISTS meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  kcal INT DEFAULT 0,
  protein_g NUMERIC DEFAULT 0,
  carbs_g NUMERIC DEFAULT 0,
  fat_g NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Routines (saved workout routines)
CREATE TABLE IF NOT EXISTS routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Current routine (active workout being built)
CREATE TABLE IF NOT EXISTS current_routine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_routine ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own profile" ON profiles;
DROP POLICY IF EXISTS "Users manage own logs" ON daily_logs;
DROP POLICY IF EXISTS "Users manage own meals" ON meals;
DROP POLICY IF EXISTS "Users manage own routines" ON routines;
DROP POLICY IF EXISTS "Users manage own current_routine" ON current_routine;

CREATE POLICY "Users manage own profile" ON profiles
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users manage own logs" ON daily_logs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own meals" ON meals
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own routines" ON routines
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own current_routine" ON current_routine
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- AI usage limit (20 requests per authenticated user per hour)
-- The table is intentionally inaccessible through the Data API;
-- callers may only invoke the narrowly scoped function below.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_windows (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INT NOT NULL DEFAULT 0
);

ALTER TABLE public.ai_usage_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_usage_windows FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_ai_request()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
  v_user_id UUID := auth.uid();
  v_allowed BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.ai_usage_windows (user_id, window_started_at, request_count)
  VALUES (v_user_id, pg_catalog.now(), 1)
  ON CONFLICT (user_id) DO UPDATE
  SET window_started_at = CASE
        WHEN public.ai_usage_windows.window_started_at <= pg_catalog.now() - INTERVAL '1 hour'
          THEN pg_catalog.now()
        ELSE public.ai_usage_windows.window_started_at
      END,
      request_count = CASE
        WHEN public.ai_usage_windows.window_started_at <= pg_catalog.now() - INTERVAL '1 hour'
          THEN 1
        ELSE public.ai_usage_windows.request_count + 1
      END
  RETURNING public.ai_usage_windows.request_count <= 20 INTO v_allowed;

  RETURN v_allowed;
END;
$;

REVOKE ALL ON FUNCTION public.consume_ai_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_request() TO authenticated;

-- ============================================================
-- Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_routines_user ON routines(user_id);
