# 🔧 Fix Save to Vault - RLS Policy Update

## Problem
When you try to save a blueprint to the vault, you get:
```
Failed to save to Vault: new row violates row-level security policy for table "blueprints"
```

## Solution - Run These Migrations in Supabase SQL Editor

### Step 1: Run the RLS Policy Fix
Go to your **Supabase Dashboard** → **SQL Editor** and copy-paste this:

```sql
-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can insert own blueprints" ON public.blueprints;
DROP POLICY IF EXISTS "Users can view own blueprints" ON public.blueprints;
DROP POLICY IF EXISTS "Users can delete own blueprints" ON public.blueprints;

-- Recreate policies with proper authentication check
CREATE POLICY "Users can insert own blueprints" 
  ON public.blueprints 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own blueprints" 
  ON public.blueprints 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own blueprints" 
  ON public.blueprints 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own blueprints" 
  ON public.blueprints 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE public.blueprints ENABLE ROW LEVEL SECURITY;
```

Click **Run** and wait for success.

### Step 2: Verify User Profile Exists
Run this to ensure your user profile was created:

```sql
SELECT * FROM public.profiles WHERE id = auth.uid();
```

If no results, run this to create your profile:

```sql
INSERT INTO public.profiles (id, is_pro, is_trial)
VALUES (auth.uid(), false, false)
ON CONFLICT (id) DO NOTHING;
```

### Step 3: Test It
Go back to the app and try saving a blueprint. It should now work! ✅

## What Was Wrong?
- The RLS (Row Level Security) policies weren't properly configured
- The policy couldn't verify that the logged-in user (`auth.uid()`) matched the `user_id` they were trying to insert
- Now the policy explicitly allows authenticated users to insert blueprints where the `user_id` equals their own `auth.uid()`

## Still Not Working?
Make sure:
1. ✅ You are logged in to the app
2. ✅ You completed the Supabase SQL migrations above
3. ✅ Your browser shows "Login" → "Sign Out" (meaning you're authenticated)
