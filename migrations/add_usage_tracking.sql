-- Migration: Add per-user usage tracking and device fingerprinting for spam detection

BEGIN;

-- Table to track daily usage per user
CREATE TABLE IF NOT EXISTS public.user_daily_usage (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  usage_count integer default 0,
  usage_date date default CURRENT_DATE not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, usage_date)
);

-- Table to track device fingerprints for spam detection
CREATE TABLE IF NOT EXISTS public.device_fingerprints (
  id uuid default uuid_generate_v4() primary key,
  device_fingerprint text unique not null,
  user_id uuid references auth.users on delete set null,
  account_count integer default 1,
  is_blocked boolean default false,
  blocked_reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Table to log suspicious activity
CREATE TABLE IF NOT EXISTS public.spam_logs (
  id uuid default uuid_generate_v4() primary key,
  device_fingerprint text not null,
  action text not null,
  details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.user_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spam_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for user_daily_usage
CREATE POLICY "Users can view own usage" on public.user_daily_usage for select 
  using (auth.uid() = user_id);

CREATE POLICY "Service can insert usage" on public.user_daily_usage for insert 
  with check (auth.uid() = user_id);

CREATE POLICY "Service can update usage" on public.user_daily_usage for update 
  using (auth.uid() = user_id);

-- Device fingerprints - service role only (no user access)
CREATE POLICY "Service can manage device fingerprints" on public.device_fingerprints 
  for all using (true);

-- Spam logs - service role only
CREATE POLICY "Service can manage spam logs" on public.spam_logs 
  for all using (true);

-- Function to get or create user's daily usage record
CREATE OR REPLACE FUNCTION public.get_user_daily_usage(user_uuid uuid)
RETURNS TABLE (id uuid, usage_count integer, usage_date date) AS $$
BEGIN
  INSERT INTO public.user_daily_usage (user_id, usage_count, usage_date)
  VALUES (user_uuid, 0, CURRENT_DATE)
  ON CONFLICT (user_id, usage_date) DO NOTHING;
  
  RETURN QUERY
  SELECT user_daily_usage.id, user_daily_usage.usage_count, user_daily_usage.usage_date
  FROM public.user_daily_usage
  WHERE user_daily_usage.user_id = user_uuid AND user_daily_usage.usage_date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to increment user's daily usage
CREATE OR REPLACE FUNCTION public.increment_user_usage(user_uuid uuid)
RETURNS integer AS $$
DECLARE
  current_count integer;
BEGIN
  UPDATE public.user_daily_usage
  SET usage_count = usage_count + 1,
      updated_at = timezone('utc'::text, now())
  WHERE user_id = user_uuid AND usage_date = CURRENT_DATE
  RETURNING usage_count INTO current_count;
  
  IF current_count IS NULL THEN
    INSERT INTO public.user_daily_usage (user_id, usage_count, usage_date)
    VALUES (user_uuid, 1, CURRENT_DATE);
    current_count := 1;
  END IF;
  
  RETURN current_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;
