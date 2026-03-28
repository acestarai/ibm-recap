-- Update the users table email domain constraint to allow both
-- @ibm.com and @us.ibm.com addresses.

ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS email_format;

ALTER TABLE public.users
ADD CONSTRAINT email_format
CHECK (email ~* '^[A-Za-z0-9._%+-]+@(ibm\.com|us\.ibm\.com)$');
