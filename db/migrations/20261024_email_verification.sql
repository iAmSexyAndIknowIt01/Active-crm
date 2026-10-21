-- Бүртгүүлэх үеийн имэйл баталгаажуулалт.
--   mt_user.email_verified_at: имэйлийг баталгаажуулсан огноо. NULL бол нэвтрэх боломжгүй.
--   Одоо байгаа бүх хэрэглэгчийг баталгаажсан гэж тэмдэглэнэ (хэнийг ч түгжихгүй).
--
-- Шинэ кодыг deploy хийхээс ӨМНӨ ажиллуулна.

BEGIN;

ALTER TABLE mt_user ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
UPDATE mt_user SET email_verified_at = COALESCE(create_date, now()) WHERE email_verified_at IS NULL;

COMMIT;
