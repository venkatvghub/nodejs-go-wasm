-- Migration to add key_version columns and increase column sizes for encrypted data
-- This change allows storing encryption key versions separately from the encrypted data
-- Each encrypted field has its own key version for individual rotation capabilities
-- Column sizes are increased to accommodate Base64 encoded encrypted data

BEGIN;

-- First modify users table to add key_version columns and increase column sizes
ALTER TABLE public.users
  ADD COLUMN first_name_key_version VARCHAR(100),
  ADD COLUMN last_name_key_version VARCHAR(100),
  ADD COLUMN email_key_version VARCHAR(100),
  ALTER COLUMN first_name TYPE VARCHAR(200),
  ALTER COLUMN last_name TYPE VARCHAR(200),
  ALTER COLUMN email TYPE VARCHAR(300);
  
-- We're keeping the original TEXT/VARCHAR types for the encrypted fields but with increased sizes
-- ALTER COLUMN first_name TYPE bytea USING first_name::bytea,
-- ALTER COLUMN last_name TYPE bytea USING last_name::bytea,
-- ALTER COLUMN email TYPE bytea USING email::bytea;

-- Add indexes for key version lookups in users table
CREATE INDEX idx_users_first_name_key_version ON public.users(first_name_key_version);
CREATE INDEX idx_users_email_key_version ON public.users(email_key_version);

-- Then modify payments table to add key_version columns and increase column sizes
ALTER TABLE public.payments
  ADD COLUMN card_number_key_version VARCHAR(100),
  ADD COLUMN cvv_key_version VARCHAR(100),
  ALTER COLUMN card_number TYPE VARCHAR(200),
  ALTER COLUMN cvv TYPE VARCHAR(200);
  
-- We're keeping the original TEXT/VARCHAR types for the encrypted fields but with increased sizes
-- ALTER COLUMN card_number TYPE bytea USING card_number::bytea,
-- ALTER COLUMN cvv TYPE bytea USING cvv::bytea;

-- Add indexes for key version lookups in payments table
CREATE INDEX idx_payments_card_number_key_version ON public.payments(card_number_key_version);

COMMIT;
