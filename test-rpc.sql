-- Quick test to verify RPC functions exist
-- Run this in Supabase SQL Editor to check if everything is set up correctly

-- 1. Check if upsert_knowledge_chunk function exists
SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'upsert_knowledge_chunk';

-- 2. Check if knowledge_cache table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'knowledge_cache'
) as table_exists;

-- 3. Check if vector extension is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 4. Count current knowledge cache entries
SELECT
  category,
  COUNT(*) as count,
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_count
FROM knowledge_cache
GROUP BY category;
