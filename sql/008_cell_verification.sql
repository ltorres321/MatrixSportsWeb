-- cell_verified tracks whether the number in profiles.cell has been
-- confirmed via a real SMS OTP (Supabase Auth's phone-verification
-- flow: auth.updateUser({ phone }) sends the code, auth.verifyOtp
-- with type "phone_change" confirms it) -- not just typed into a
-- text field, which is all profiles.cell ever guaranteed before this.
--
-- Whenever cell changes to a NEW number, this must go back to false
-- until that new number is verified again -- the app layer (profile
-- page) is responsible for that reset, this migration only adds the
-- column.
--
-- Run once against the database DATABASE_URL points at:
--   psql "$DATABASE_URL" -f sql/008_cell_verification.sql

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cell_verified BOOLEAN NOT NULL DEFAULT false;
