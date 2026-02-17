-- Migration: add_blueprint_column.sql
-- Adds a JSONB `blueprint` column to the `blueprints` table (if missing)

BEGIN;

-- Only add the column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'blueprints'
      AND column_name = 'blueprint'
  ) THEN
    ALTER TABLE public.blueprints
    ADD COLUMN blueprint JSONB;
  END IF;
END$$;

COMMIT;

-- Optional: update existing text column `data`/`content` to JSONB if present
-- Example: copy text JSON stored in `data` into `blueprint` (only run if `data` contains JSON strings)
-- UPDATE public.blueprints SET blueprint = (data::jsonb) WHERE blueprint IS NULL AND data IS NOT NULL;

-- Note: Run this migration from the Supabase SQL editor or via psql with proper DB credentials.
