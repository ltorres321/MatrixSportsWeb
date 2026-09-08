-- Two additions to profiles, both about notifications specifically,
-- not login:
--
-- 1. notification_email -- a SEPARATE address from the sign-in email
--    (auth.users.email). Defaults to whatever email the user signed
--    up with, but can be changed independently. This is a plain data
--    field with no Supabase Auth involvement, unlike login email --
--    changing it doesn't touch how the user signs in.
--
-- 2. notify_teams -- a user can now get alerts for more than one
--    team, not just a single "favorite team" (favorite_team stays as
--    its own separate, single-value field for identity/display).
--
-- Run once against the database DATABASE_URL points at:
--   psql "$DATABASE_URL" -f sql/007_notification_email_and_multi_team.sql

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_teams TEXT[] NOT NULL DEFAULT '{}';

-- Backfill existing rows so notification_email is never blank for an
-- account that already exists.
UPDATE profiles SET notification_email = email WHERE notification_email IS NULL;

-- The on_auth_user_created trigger (sql/004/005) needs to populate
-- notification_email for brand-new signups too, same as email.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, notification_email, first_name, middle_name, last_name, cell,
    address, city, state, zip, favorite_team, notify_win_prob
  )
  VALUES (
    NEW.id,
    NEW.email,
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
