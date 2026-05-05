// Knowledge Retrieval Service
// Server-side module for semantic search over the knowledge cache.
// Generates query embeddings and performs vector similarity search.
//
// Key Design Principles:
// - NEVER throws exceptions (always returns valid KnowledgeContext)
// - Graceful degradation (empty context on any error)
// - Non-blocking (failures must never break chat)

import { getSupabaseAdmin } from '@/supabase/admin';

// ============================================================
// Types
// ============================================================

export interface KnowledgeResult {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  category: string;
  tags: string[];
  similarity: number;
  notion_page_id: string;
}

export interface KnowledgeContext {
  results: KnowledgeResult[];
  contextBlock: string; // Formatted for system prompt injection
  retrievalMeta: {
    queryUsed: string;
    resultCount: number;
    avgSimilarity: number;
    retrievedAt: string;
    error?: string;
  };
}

export interface RetrievalOptions {
  matchCount?: number; // Default: 5
  similarityThreshold?: number; // Default: 0.7
  category?: string; // Optional filter
  tags?: string[]; // Optional filter
}

// ============================================================
// Embedding Generation
// ============================================================

/**
 * Generate query embedding for semantic search.
 *
 * TODO: Integrate a non-OpenAI embeddings provider (e.g. Google Generative AI
 * text-embedding-004 via @ai-sdk/google, or a local model). Until then this
 * function is disabled and always throws so the caller falls back to the empty
 * KnowledgeContext path.
 */
async function generateQueryEmbedding(_query: string): Promise<number[]> {
  throw new Error(
    'Embeddings are currently disabled — no embeddings provider configured. ' +
    'See TODO in knowledge-retrieval.ts to wire up a replacement.'
  );
}

// ============================================================
// Main Retrieval Function
// ============================================================

/**
 * Retrieve relevant knowledge for a query.
 * ALWAYS returns a KnowledgeContext -- never throws.
 * On any error, returns an empty context with error metadata.
 */
export async function retrieveKnowledge(
  query: string,
  options: RetrievalOptions = {}
): Promise<KnowledgeContext> {
  const {
    matchCount = 5,
    similarityThreshold = 0.7,
    category = null,
    tags = null,
  } = options;

  const emptyContext: KnowledgeContext = {
    results: [],
    contextBlock: '',
    retrievalMeta: {
      queryUsed: query,
      resultCount: 0,
      avgSimilarity: 0,
      retrievedAt: new Date().toISOString(),
    },
  };

  try {
    // 1. Generate query embedding
    const embedding = await generateQueryEmbedding(query);

    // 2. Search knowledge cache via RPC
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('search_knowledge', {
      query_embedding: embedding,
      match_count: matchCount,
      similarity_threshold: similarityThreshold,
      filter_category: category,
      filter_tags: tags,
    });

    if (error) {
      console.warn('[Knowledge Retrieval] RPC error:', error.message);
      return {
        ...emptyContext,
        retrievalMeta: { ...emptyContext.retrievalMeta, error: error.message },
      };
    }

    if (!data || data.length === 0) {
      console.log('[Knowledge Retrieval] No results found for query:', query.slice(0, 100));
      return emptyContext;
    }

    // 3. Format results
    const results: KnowledgeResult[] = data;
    const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;

    // 4. Build context block for system prompt
    const contextBlock = formatKnowledgeContextBlock(results);

    console.log(
      `[Knowledge Retrieval] Found ${results.length} results, avg similarity: ${avgSimilarity.toFixed(2)}`
    );

    return {
      results,
      contextBlock,
      retrievalMeta: {
        queryUsed: query,
        resultCount: results.length,
        avgSimilarity,
        retrievedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('[Knowledge Retrieval] Error:', errorMsg);
    return {
      ...emptyContext,
      retrievalMeta: {
        ...emptyContext.retrievalMeta,
        error: errorMsg,
      },
    };
  }
}

// ============================================================
// Context Formatting
// ============================================================

/**
 * Format knowledge results into a context block for system prompt injection.
 * The block includes behavioral instructions to prevent recommendation behavior.
 */
function formatKnowledgeContextBlock(results: KnowledgeResult[]): string {
  if (results.length === 0) return '';

  const entries = results.map((r, i) => {
    const summary = r.summary || r.content.slice(0, 300);
    const similarityPct = Math.round(r.similarity * 100);
    return `**[${i + 1}] ${r.title}** (${r.category}, relevance: ${similarityPct}%)
${summary}`;
  });

  return `## Background Knowledge

The following reference material from the Cyberdelic knowledge base is relevant to this conversation. Use this as **background context** to inform your expertise — it deepens your understanding of the domain.

**Important behavioral rules for knowledge context:**
- NEVER recommend specific experiences, venues, technologies, or resources from this knowledge to the user.
- NEVER say "based on our knowledge base" or "according to our references" — this knowledge is part of your training, not a separate source.
- Use insights from this material to ask better questions, give more informed guidance, and provide deeper analysis.
- If the knowledge contradicts the user's design choices, frame your guidance as expert perspective, not citation.

---

${entries.join('\n\n---\n\n')}`;
}

// ============================================================
// Query Building Helper
// ============================================================

/**
 * Build a search query from the conversation context.
 * Extracts the user's latest message and combines with project context keywords
 * for a richer semantic search.
 */
export function buildSearchQuery(
  latestUserMessage: string,
  projectContext: { projectName?: string; coreMessage?: string; faceKey?: string }
): string {
  const parts = [latestUserMessage];

  if (projectContext.coreMessage) {
    parts.push(projectContext.coreMessage);
  }

  // Keep query focused -- don't exceed ~200 words for embedding quality
  return parts.join(' ').slice(0, 800);
}
