-- Run this in Supabase Dashboard -> SQL Editor to grant role privileges and backfill missing user rows

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

-- Safe backfill for profiles (skips any user that already has a profile)
INSERT INTO public.profiles (id, full_name, timezone)
SELECT
  u.id,
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1), 'Habit Builder'),
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'timezone'), ''), 'UTC')
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT DO NOTHING;

-- Safe backfill for user_settings (skips any user that already has settings)
INSERT INTO public.user_settings (user_id, timezone)
SELECT
  u.id,
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'timezone'), ''), 'UTC')
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_settings us WHERE us.user_id = u.id
)
ON CONFLICT DO NOTHING;
