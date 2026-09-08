-- Two fixes to handle_new_user (sql/004), prompted by adding Google
-- OAuth sign-in:
--
-- 1. profiles never stored email at all -- it only lived on the
--    internal auth.users table. The user wants it saved somewhere the
--    app can actually query. NEW.email is the reliable source (set by
--    every provider, unlike anything in raw_user_meta_data).
--
-- 2. The trigger only knew how to read *our own* signup form's
--    metadata shape (first_name/last_name). A brand-new Google
--    sign-in never passes through that form -- Google's metadata uses
--    given_name/family_name/name instead -- so without this, a fresh
--    Google signup would get a profiles row with blank names.
--
-- Run once against the database DATABASE_URL points at:
--   psql "$DATABASE_URL" -f sql/005_profiles_email_and_google_signup.sql

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, first_name, middle_name, last_name, cell, address, city, state, zip,
    favorite_team, notify_win_prob
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'given_name',
      NULLIF(split_part(NEW.raw_user_meta_data->>'name', ' ', 1), ''),
      ''
    ),
    NULLIF(NEW.raw_user_meta_data->>'middle_name', ''),
    COALESCE(
      NEW.raw_user_meta_data->>'last_name',
      NEW.raw_user_meta_data->>'family_name',
      ''
    ),
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

-- Backfill email for any rows the old trigger version already created.
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;
