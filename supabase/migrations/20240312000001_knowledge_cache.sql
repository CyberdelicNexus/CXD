-- Knowledge Cache with pgvector Embeddings for RAG Pipeline
-- This migration creates the infrastructure for semantic search over curated cyberdelic knowledge.

-- ============================================================
-- 1. Enable pgvector extension (if not already enabled)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ============================================================
-- 2. Create knowledge_cache table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.knowledge_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source tracking
  notion_page_id TEXT NOT NULL,
  notion_last_edited TIMESTAMPTZ,

  -- Content
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  summary TEXT,                        -- AI-generated summary for context window (future enhancement)
  category TEXT DEFAULT 'general',     -- e.g. 'experience-design', 'consciousness', 'production'
  tags TEXT[] DEFAULT '{}',            -- searchable tags

  -- Embedding
  embedding vector(1536),              -- text-embedding-3-small output (1536 dimensions)

  -- Metadata
  chunk_index INT DEFAULT 0,           -- for multi-chunk pages (0 = first/only chunk)
  total_chunks INT DEFAULT 1,          -- total number of chunks for this page
  token_count INT,                     -- track token usage for budgeting

  -- Sync metadata
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_version INT NOT NULL DEFAULT 1, -- increments on each update (for monitoring)
  is_active BOOLEAN NOT NULL DEFAULT true, -- soft delete flag

  -- Constraints
  CONSTRAINT unique_page_chunk UNIQUE (notion_page_id, chunk_index)
);

-- ============================================================
-- 3. Create indexes
-- ============================================================

-- HNSW index for fast cosine similarity vector search
-- m = 16: number of connections per layer (higher = better recall, slower build)
-- ef_construction = 64: size of dynamic candidate list during build (higher = better quality, slower build)
CREATE INDEX IF NOT EXISTS idx_knowledge_cache_embedding
  ON public.knowledge_cache
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Filtered search indexes (only on active entries)
CREATE INDEX IF NOT EXISTS idx_knowledge_cache_category
  ON public.knowledge_cache (category) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_knowledge_cache_tags
  ON public.knowledge_cache USING gin (tags) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_knowledge_cache_notion_page
  ON public.knowledge_cache (notion_page_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_cache_synced_at
  ON public.knowledge_cache (synced_at DESC) WHERE is_active = true;

-- ============================================================
-- 4. Create search_knowledge RPC function
-- ============================================================

-- Vector similarity search with optional category and tag filters
-- Returns top-N matches above similarity threshold, ordered by cosine similarity
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  similarity_threshold FLOAT DEFAULT 0.7,
  filter_category TEXT DEFAULT NULL,
  filter_tags TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  summary TEXT,
  category TEXT,
  tags TEXT[],
  similarity FLOAT,
  notion_page_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.title,
    kc.content,
    kc.summary,
    kc.category,
    kc.tags,
    1 - (kc.embedding <=> query_embedding) AS similarity,  -- Cosine similarity (1 - cosine_distance)
    kc.notion_page_id
  FROM public.knowledge_cache kc
  WHERE kc.is_active = true
    AND kc.embedding IS NOT NULL
    AND (filter_category IS NULL OR kc.category = filter_category)
    AND (filter_tags IS NULL OR kc.tags && filter_tags)  -- Array overlap operator
    AND 1 - (kc.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY kc.embedding <=> query_embedding  -- Order by cosine distance (ascending = most similar first)
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION search_knowledge TO service_role;
GRANT EXECUTE ON FUNCTION search_knowledge TO authenticated;

COMMENT ON FUNCTION search_knowledge IS
'Vector similarity search over knowledge cache.
Returns top-N matches above similarity threshold with optional category/tag filters.
Uses cosine similarity (1 - cosine_distance) for ranking.';

-- ============================================================
-- 5. Create FDW wrapper RPCs
-- ============================================================

-- Wrapper RPC to query public.page table
-- (Reads Notion page data from public schema)
CREATE OR REPLACE FUNCTION fetch_notion_pages()
RETURNS TABLE (
  id TEXT,
  title TEXT,
  last_edited_time TIMESTAMPTZ,
  url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id::TEXT,
    COALESCE(p.url, 'Untitled')::TEXT as title,  -- Use url as title if title column doesn't exist
    p.last_edited_time,
    p.url::TEXT
  FROM public.page p
  WHERE p.archived = false;  -- Only fetch non-archived pages
END;
$$;

GRANT EXECUTE ON FUNCTION fetch_notion_pages TO service_role;

COMMENT ON FUNCTION fetch_notion_pages IS
'Wrapper RPC to query public.page table.
Returns all non-archived Notion pages.';

-- Wrapper RPC to query public.block table for a specific page
-- IMPORTANT: page_id parameter is REQUIRED (never query public.block without a filter)
-- Extracts text content from JSONB attrs column
CREATE OR REPLACE FUNCTION fetch_notion_blocks(p_page_id TEXT)
RETURNS TABLE (
  id TEXT,
  type TEXT,
  content TEXT,
  page_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Safety check: page_id is required
  IF p_page_id IS NULL OR p_page_id = '' THEN
    RAISE EXCEPTION 'page_id is required - never query public.block without a page_id filter';
  END IF;

  RETURN QUERY
  SELECT
    b.id::TEXT,
    COALESCE(b.type, 'paragraph')::TEXT as type,
    -- Extract text from attrs JSONB column
    -- Try multiple paths to find the text content
    COALESCE(
      -- Try [block_type].rich_text[0].plain_text (most common Notion format)
      b.attrs -> b.type -> 'rich_text' -> 0 ->> 'plain_text',
      -- Try [block_type].text.content
      b.attrs -> b.type -> 'text' ->> 'content',
      -- Try direct plain_text
      b.attrs ->> 'plain_text',
      -- Try direct text
      b.attrs ->> 'text',
      -- Fallback: convert entire attrs to text (will show JSON if nothing else works)
      ''
    )::TEXT as content,
    b.page_id::TEXT
  FROM public.block b
  WHERE b.page_id = p_page_id
    AND b.archived = false
  LIMIT 1000;  -- Safety limit to prevent massive queries
END;
$$;

GRANT EXECUTE ON FUNCTION fetch_notion_blocks TO service_role;

COMMENT ON FUNCTION fetch_notion_blocks IS
'Wrapper RPC to query public.block table.
Requires page_id parameter to prevent full-table scans.';

-- ============================================================
-- 6. Create upsert helper RPC
-- ============================================================

-- Upsert a knowledge chunk (handles INSERT or UPDATE based on UNIQUE constraint)
CREATE OR REPLACE FUNCTION upsert_knowledge_chunk(
  p_notion_page_id TEXT,
  p_chunk_index INT,
  p_title TEXT,
  p_content TEXT,
  p_summary TEXT,
  p_category TEXT,
  p_tags TEXT[],
  p_embedding vector(1536),
  p_token_count INT,
  p_total_chunks INT,
  p_notion_last_edited TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.knowledge_cache (
    notion_page_id, chunk_index, title, content, summary,
    category, tags, embedding, token_count, total_chunks,
    notion_last_edited, synced_at, sync_version, is_active
  )
  VALUES (
    p_notion_page_id, p_chunk_index, p_title, p_content, p_summary,
    p_category, p_tags, p_embedding, p_token_count, p_total_chunks,
    p_notion_last_edited, NOW(), 1, true
  )
  ON CONFLICT (notion_page_id, chunk_index) DO UPDATE SET
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    summary = EXCLUDED.summary,
    category = EXCLUDED.category,
    tags = EXCLUDED.tags,
    embedding = EXCLUDED.embedding,
    token_count = EXCLUDED.token_count,
    total_chunks = EXCLUDED.total_chunks,
    notion_last_edited = EXCLUDED.notion_last_edited,
    synced_at = NOW(),
    sync_version = knowledge_cache.sync_version + 1,
    is_active = true
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_knowledge_chunk TO service_role;

COMMENT ON FUNCTION upsert_knowledge_chunk IS
'Upsert a knowledge chunk into the cache.
Increments sync_version on updates for operational monitoring.';

-- ============================================================
-- 7. Enable RLS
-- ============================================================

ALTER TABLE public.knowledge_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read active knowledge
CREATE POLICY "Authenticated users can read active knowledge"
  ON public.knowledge_cache FOR SELECT
  USING (is_active = true);

-- Write operations only via service_role (through Edge Functions/RPCs)

-- ============================================================
-- 8. Table comments
-- ============================================================

COMMENT ON TABLE public.knowledge_cache IS
'Cached knowledge from Notion with pgvector embeddings for RAG retrieval.
Synced via sync-knowledge Edge Function.
Each row represents a chunk of a Notion page (pages may span multiple chunks).';

COMMENT ON COLUMN public.knowledge_cache.embedding IS
'OpenAI text-embedding-3-small (1536 dimensions) vector representation of the content.';

COMMENT ON COLUMN public.knowledge_cache.chunk_index IS
'Chunk index for multi-chunk pages (0 = first chunk).
Combined with notion_page_id for unique constraint.';

COMMENT ON COLUMN public.knowledge_cache.is_active IS
'Soft delete flag. Inactive entries are excluded from search but preserved for operational history.';

COMMENT ON COLUMN public.knowledge_cache.sync_version IS
'Increments on each update. Used for operational monitoring and troubleshooting.';
