-- ============================================================
--  Fix: deduplicate hubs table + add UNIQUE constraint on name
--  Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- Step 1: Keep only the OLDEST row per hub name, delete duplicates
DELETE FROM public.hubs
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM public.hubs
  ORDER BY name, created_at ASC
);

-- Step 2: Add UNIQUE constraint so this never happens again
ALTER TABLE public.hubs
  DROP CONSTRAINT IF EXISTS hubs_name_unique;

ALTER TABLE public.hubs
  ADD CONSTRAINT hubs_name_unique UNIQUE (name);

-- Verify: should show exactly 3 rows
-- SELECT name, location, city FROM public.hubs ORDER BY name;
