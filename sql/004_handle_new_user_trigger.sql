-- Auto-creates a profiles row the moment a new auth.users row is
-- inserted (i.e. right at signUp(), before email confirmation even
-- happens) by reading the extra fields the signup form passed in via
-- supabase.auth.signUp({ options: { data: {...} } }).
--
-- Why a trigger and not app code: this project has "Confirm email" ON,
-- so signUp() returns no session until the confirmation link is
-- clicked -- the app has no authenticated request to attach a
-- profiles insert to yet. SECURITY DEFINER makes this trigger run
-- with the function owner's privileges, bypassing the profiles RLS
-- insert policy (auth.uid() = id) entirely, which is fine: this is
-- trusted server-side code, not a user-supplied request.
--
-- Run once against the database DATABASE_URL points at:
--   psql "$DATABASE_URL" -f sql/004_handle_new_user_trigger.sql

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, first_name, middle_name, last_name, cell, address, city, state, zip,
    favorite_team, notify_win_prob
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'middle_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'cell', ''),
    NULLIF(NEW.raw_user_meta_data->>'address', ''),
    NULLIF(NEW.raw_user_meta_data->>'city', ''),
    NULLIF(NEW.raw_user_meta_data->>'state', ''),
    NULLIF(NEW.raw_user_meta_data->>'zip', ''),
    NULLIF(NEW.raw_user_meta_data->>'favorite_team', ''),
    COALESCE((NEW.raw_user_meta_data->>'notify_win_prob')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
