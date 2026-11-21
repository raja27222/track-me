-- Cadence Habit Tracker — Complete Supabase PostgreSQL Schema & RLS Migration
-- Run this script in Supabase Dashboard -> SQL Editor

-- Enable pgcrypto for gen_random_uuid() if not already active
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Profiles table (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT 'Habit Builder',
  avatar_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Habits table
CREATE TABLE IF NOT EXISTS public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'droplets',
  category TEXT NOT NULL DEFAULT 'Health',
  color TEXT NOT NULL DEFAULT '#12C5DF',
  target_value NUMERIC NOT NULL DEFAULT 1,
  target_unit TEXT NOT NULL DEFAULT 'times',
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'custom')),
  scheduled_days SMALLINT[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Habit Completions table
CREATE TABLE IF NOT EXISTS public.habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  completion_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT TRUE,
  completed_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_habit_completion_per_day UNIQUE (habit_id, completion_date)
);

-- 4. Daily Summaries table (stores historical daily snapshots)
CREATE TABLE IF NOT EXISTS public.daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  scheduled_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  completion_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_successful_day BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_daily_summary UNIQUE (user_id, summary_date)
);

-- 5. User Settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  streak_rule TEXT NOT NULL DEFAULT 'all' CHECK (streak_rule IN ('all', 'custom_percentage')),
  custom_completion_percentage INTEGER NOT NULL DEFAULT 80 CHECK (custom_completion_percentage BETWEEN 1 AND 100),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_habits_user_status ON public.habits (user_id, status);
CREATE INDEX IF NOT EXISTS idx_habit_completions_user_date ON public.habit_completions (user_id, completion_date);
CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_date ON public.habit_completions (habit_id, completion_date);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_date ON public.daily_summaries (user_id, summary_date);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_habits_updated_at ON public.habits;
CREATE TRIGGER trg_habits_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_habit_completions_updated_at ON public.habit_completions;
CREATE TRIGGER trg_habit_completions_updated_at
  BEFORE UPDATE ON public.habit_completions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_daily_summaries_updated_at ON public.daily_summaries;
CREATE TRIGGER trg_daily_summaries_updated_at
  BEFORE UPDATE ON public.daily_summaries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Automatically provision profile + user_settings on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_tz TEXT;
BEGIN
  v_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1), 'Habit Builder');
  v_tz := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'timezone'), ''), 'UTC');

  INSERT INTO public.profiles (id, full_name, timezone)
  VALUES (NEW.id, v_name, v_tz)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (user_id, timezone)
  VALUES (NEW.id, v_tz)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Transactional RPC to toggle a completion and atomically upsert daily_summary
CREATE OR REPLACE FUNCTION public.toggle_habit_completion_tx(
  p_habit_id UUID,
  p_completion_date DATE,
  p_completed BOOLEAN,
  p_scheduled_count INTEGER,
  p_completed_count INTEGER,
  p_completion_percentage NUMERIC,
  p_is_successful_day BOOLEAN,
  p_notes TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify habit belongs to caller
  IF NOT EXISTS (
    SELECT 1 FROM public.habits WHERE id = p_habit_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Habit not found or access denied';
  END IF;

  INSERT INTO public.habit_completions (
    habit_id,
    user_id,
    completion_date,
    completed,
    completed_at,
    notes
  )
  VALUES (
    p_habit_id,
    v_user_id,
    p_completion_date,
    p_completed,
    CASE WHEN p_completed THEN NOW() ELSE NULL END,
    COALESCE(p_notes, '')
  )
  ON CONFLICT (habit_id, completion_date)
  DO UPDATE SET
    completed = EXCLUDED.completed,
    completed_at = EXCLUDED.completed_at,
    notes = EXCLUDED.notes,
    updated_at = NOW();

  INSERT INTO public.daily_summaries (
    user_id,
    summary_date,
    scheduled_count,
    completed_count,
    completion_percentage,
    is_successful_day
  )
  VALUES (
    v_user_id,
    p_completion_date,
    p_scheduled_count,
    p_completed_count,
    p_completion_percentage,
    p_is_successful_day
  )
  ON CONFLICT (user_id, summary_date)
  DO UPDATE SET
    scheduled_count = EXCLUDED.scheduled_count,
    completed_count = EXCLUDED.completed_count,
    completion_percentage = EXCLUDED.completion_percentage,
    is_successful_day = EXCLUDED.is_successful_day,
    updated_at = NOW();
END;
$$;

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- RLS Policies: habits
DROP POLICY IF EXISTS "habits_select_own" ON public.habits;
CREATE POLICY "habits_select_own" ON public.habits
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "habits_insert_own" ON public.habits;
CREATE POLICY "habits_insert_own" ON public.habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "habits_update_own" ON public.habits;
CREATE POLICY "habits_update_own" ON public.habits
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "habits_delete_own" ON public.habits;
CREATE POLICY "habits_delete_own" ON public.habits
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies: habit_completions
DROP POLICY IF EXISTS "habit_completions_select_own" ON public.habit_completions;
CREATE POLICY "habit_completions_select_own" ON public.habit_completions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "habit_completions_insert_own" ON public.habit_completions;
CREATE POLICY "habit_completions_insert_own" ON public.habit_completions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.habits h
      WHERE h.id = habit_id AND h.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "habit_completions_update_own" ON public.habit_completions;
CREATE POLICY "habit_completions_update_own" ON public.habit_completions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.habits h
      WHERE h.id = habit_id AND h.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "habit_completions_delete_own" ON public.habit_completions;
CREATE POLICY "habit_completions_delete_own" ON public.habit_completions
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies: daily_summaries
DROP POLICY IF EXISTS "daily_summaries_select_own" ON public.daily_summaries;
CREATE POLICY "daily_summaries_select_own" ON public.daily_summaries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_summaries_insert_own" ON public.daily_summaries;
CREATE POLICY "daily_summaries_insert_own" ON public.daily_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_summaries_update_own" ON public.daily_summaries;
CREATE POLICY "daily_summaries_update_own" ON public.daily_summaries
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_summaries_delete_own" ON public.daily_summaries;
CREATE POLICY "daily_summaries_delete_own" ON public.daily_summaries
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies: user_settings
DROP POLICY IF EXISTS "user_settings_select_own" ON public.user_settings;
CREATE POLICY "user_settings_select_own" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_settings_insert_own" ON public.user_settings;
CREATE POLICY "user_settings_insert_own" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_settings_update_own" ON public.user_settings;
CREATE POLICY "user_settings_update_own" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_settings_delete_own" ON public.user_settings;
CREATE POLICY "user_settings_delete_own" ON public.user_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Explicit role privileges (required when default public privileges are restricted)
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.profiles,
  public.habits,
  public.habit_completions,
  public.daily_summaries,
  public.user_settings
TO authenticated;

GRANT EXECUTE ON FUNCTION public.toggle_habit_completion_tx(
  UUID, DATE, BOOLEAN, INTEGER, INTEGER, NUMERIC, BOOLEAN, TEXT
) TO authenticated;

