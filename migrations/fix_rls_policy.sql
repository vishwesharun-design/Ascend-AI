-- Migration: Fix RLS Policy for Blueprints Table
-- This ensures authenticated users can save their blueprints

BEGIN;

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

COMMIT;
