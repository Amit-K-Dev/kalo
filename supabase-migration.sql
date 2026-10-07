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

-- 6. AI request counters (written only through a privileged atomic function)
CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  requests INT NOT NULL DEFAULT 0 CHECK (requests >= 0),
  PRIMARY KEY (user_id, day)
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_routine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Clients cannot read or modify the counters directly.
REVOKE ALL ON TABLE public.ai_usage FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Users manage own profile" ON profiles;
CREATE POLICY "Users manage own profile" ON profiles
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users manage own logs" ON daily_logs;
CREATE POLICY "Users manage own logs" ON daily_logs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own meals" ON meals;
CREATE POLICY "Users manage own meals" ON meals
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own routines" ON routines;
CREATE POLICY "Users manage own routines" ON routines
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own current_routine" ON current_routine;
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atomically reserve one AI call so parallel workers cannot exceed a user's
-- daily allowance. The function owner can update ai_usage despite its RLS.
CREATE OR REPLACE FUNCTION public.reserve_ai_estimate(max_per_day INT DEFAULT 30)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reserved_count INT;
BEGIN
  IF auth.uid() IS NULL OR max_per_day < 1 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.ai_usage (user_id, day, requests)
  VALUES (auth.uid(), CURRENT_DATE, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET requests = public.ai_usage.requests + 1
    WHERE public.ai_usage.requests < max_per_day
  RETURNING requests INTO reserved_count;

  RETURN reserved_count IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_estimate(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_ai_estimate(INT) TO authenticated;

-- ============================================================
-- Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_routines_user ON routines(user_id);
