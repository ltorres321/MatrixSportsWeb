-- NBA counterpart to favorite_team (sql/003): a user can now pick one
-- favorite NFL team AND one favorite NBA team, not just a single
-- cross-sport favorite. Same "its own separate, single-value field"
-- reasoning as notify_teams' own comment in sql/007 -- favorite_team
-- stays NFL-only and untouched, this is purely additive.
--
-- Run once against the database DATABASE_URL points at:
--   psql "$DATABASE_URL" -f sql/015_favorite_nba_team.sql

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorite_nba_team TEXT;

-- Keep handle_new_user in sync so a signup that passes
-- favorite_nba_team in raw_user_meta_data (mirroring favorite_team)
-- populates it on insert too, same as every other optional field here.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, notification_email, first_name, middle_name, last_name, cell,
    address, city, state, zip, favorite_team, favorite_nba_team, notify_win_prob
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
    NULLIF(NEW.raw_user_meta_data->>'favorite_nba_team', ''),
    COALESCE((NEW.raw_user_meta_data->>'notify_win_prob')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
