-- ==============================================================================
-- PackSure Supabase Database Schema
-- Adds 'creator_id' (Unique Profile ID) column to track the exact user who uploaded each inspection
-- ==============================================================================

-- 1. Add 'creator_id' column to the inspections table
ALTER TABLE inspections 
ADD COLUMN IF NOT EXISTS creator_id TEXT;

-- 2. Backfill existing records with creator_id from metadata or created_by string
UPDATE inspections 
SET creator_id = COALESCE(
  detected_declarations->>'creatorId',
  SUBSTRING(created_by FROM '\((.*?)\)'),
  'PS-CIT-00001'
)
WHERE creator_id IS NULL;

-- 3. Create high-performance index for fast user-isolated querying
CREATE INDEX IF NOT EXISTS idx_inspections_creator_id ON inspections(creator_id);
