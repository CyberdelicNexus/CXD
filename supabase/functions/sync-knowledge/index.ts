// Sync Knowledge Edge Function
// Syncs Notion pages to knowledge_cache with OpenAI embeddings
// Uses Notion API directly (bypasses slow FDW)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_CHUNK_CHARS = 6000;
const EMBEDDING_BATCH_SIZE = 20;
const BATCH_DELAY_MS = 200;
const MAX_PAGES_PER_SYNC = 50;  // Increased from 10 to sync more pages per run

interface ContentChunk {
  text: string;
  index: number;
  tokenEstimate: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
    const notionToken = Deno.env.get('NOTION_API_TOKEN')!;

    if (!supabaseUrl || !supabaseServiceKey || !openaiKey || !notionToken) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const category = body.category || 'general';  // Default: 'general' for all content
    const tags = body.tags || [];                 // Default: empty tags array
    const databaseIds = body.database_ids || [];

    console.log(`[Sync] Starting sync for ${databaseIds.length} databases with category: ${category}...`);

    if (databaseIds.length === 0) {
      return jsonResponse({
        error: 'No database_ids provided. Please specify Notion database IDs to sync.',
      }, 400);
    }

    const report = {
      totalPages: 0,
      synced: 0,
      skipped: 0,
      errors: [] as string[],
      chunksCreated: 0,
    };

    // Fetch pages from each database
    for (const dbId of databaseIds) { // Process all databases
      console.log(`[Sync] Fetching pages from database ${dbId}...`);

      const pages = await fetchPagesFromDatabase(dbId, notionToken);
      console.log(`[Sync] Found ${pages.length} pages in database ${dbId}`);

      // Process pages (limit to avoid timeout)
      const pagesToProcess = pages.slice(0, MAX_PAGES_PER_SYNC);
      report.totalPages += pagesToProcess.length;

      for (const page of pagesToProcess) {
        try {
          console.log(`[Sync] Processing: ${page.title}`);

          // Fetch blocks
          const blocks = await fetchNotionBlocks(page.id, notionToken);
          const content = extractTextFromBlocks(blocks, page.title);

          if (!content.trim()) {
            console.log(`[Sync] Skipping (no content): ${page.title}`);
            report.skipped++;
            continue;
          }

          // Chunk content
          const chunks = chunkContent(content, page.title);
          console.log(`[Sync] Created ${chunks.length} chunks for ${page.title}`);

          // Generate embeddings and upsert
          for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
            const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);

            const embeddings = await generateEmbeddings(
              batch.map(c => c.text),
              openaiKey
            );

            for (let j = 0; j < batch.length; j++) {
              const chunk = batch[j];
              const embedding = embeddings[j];

              try {
                const result = await supabase.rpc('upsert_knowledge_chunk', {
                  p_notion_page_id: page.id,
                  p_chunk_index: chunk.index,
                  p_title: page.title,
                  p_content: chunk.text,
                  p_summary: null,
                  p_category: category,
                  p_tags: tags,
                  p_embedding: embedding,
                  p_token_count: chunk.tokenEstimate,
                  p_total_chunks: chunks.length,
                  p_notion_last_edited: page.last_edited_time,
                });

                if (result?.error) {
                  report.errors.push(`${page.title} chunk ${chunk.index}: ${result.error.message}`);
                } else {
                  report.chunksCreated++;
                }
              } catch (upsertErr) {
                const errMsg = upsertErr instanceof Error ? upsertErr.message : String(upsertErr);
                report.errors.push(`${page.title} chunk ${chunk.index}: ${errMsg}`);
                console.error(`[Sync] Upsert error:`, errMsg);
              }
            }

            if (i + EMBEDDING_BATCH_SIZE < chunks.length) {
              await delay(BATCH_DELAY_MS);
            }
          }

          report.synced++;
          console.log(`[Sync] ✓ Synced: ${page.title}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          report.errors.push(`${page.title}: ${msg}`);
          console.error(`[Sync] Error processing ${page.title}:`, msg);
        }
      }
    }

    console.log('[Sync] Complete:', report);
    return jsonResponse({ success: true, report });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Sync] Fatal error:', msg);
    return jsonResponse({ error: msg }, 500);
  }
});

// ============================================================
// Notion API Functions
// ============================================================

async function fetchPagesFromDatabase(databaseId: string, token: string) {
  const pages: any[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore && pages.length < 50) { // Limit to 50 pages per database
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page_size: 50,
        start_cursor: startCursor,
      }),
    });

    if (!response.ok) {
      throw new Error(`Notion API error: ${response.status}`);
    }

    const data = await response.json();

    for (const page of data.results || []) {
      if (page.archived) continue;

      pages.push({
        id: page.id,
        title: extractPageTitle(page),
        last_edited_time: page.last_edited_time,
        url: page.url,
      });
    }

    hasMore = data.has_more || false;
    startCursor = data.next_cursor;
  }

  return pages;
}

async function fetchNotionBlocks(pageId: string, token: string) {
  const blocks: any[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore && blocks.length < 500) { // Limit to 500 blocks per page
    const url = `https://api.notion.com/v1/blocks/${pageId}/children${startCursor ? `?start_cursor=${startCursor}` : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!response.ok) {
      throw new Error(`Notion blocks API error: ${response.status}`);
    }

    const data = await response.json();
    blocks.push(...(data.results || []));
    hasMore = data.has_more || false;
    startCursor = data.next_cursor;
  }

  return blocks;
}

function extractPageTitle(page: any): string {
  if (page.properties) {
    for (const key of Object.keys(page.properties)) {
      const prop = page.properties[key];
      if (prop.type === 'title' && prop.title?.length > 0) {
        return prop.title.map((t: any) => t.plain_text || '').join('');
      }
    }
  }
  return page.url || 'Untitled';
}

function extractTextFromBlocks(blocks: any[], pageTitle: string): string {
  const textParts: string[] = [];

  for (const block of blocks) {
    let text = '';

    if (block.type === 'paragraph' && block.paragraph?.rich_text) {
      text = block.paragraph.rich_text.map((rt: any) => rt.plain_text || '').join('');
    } else if (block.type === 'heading_1' && block.heading_1?.rich_text) {
      text = '# ' + block.heading_1.rich_text.map((rt: any) => rt.plain_text || '').join('');
    } else if (block.type === 'heading_2' && block.heading_2?.rich_text) {
      text = '## ' + block.heading_2.rich_text.map((rt: any) => rt.plain_text || '').join('');
    } else if (block.type === 'heading_3' && block.heading_3?.rich_text) {
      text = '### ' + block.heading_3.rich_text.map((rt: any) => rt.plain_text || '').join('');
    } else if (block.type === 'bulleted_list_item' && block.bulleted_list_item?.rich_text) {
      text = '• ' + block.bulleted_list_item.rich_text.map((rt: any) => rt.plain_text || '').join('');
    } else if (block.type === 'numbered_list_item' && block.numbered_list_item?.rich_text) {
      text = '- ' + block.numbered_list_item.rich_text.map((rt: any) => rt.plain_text || '').join('');
    } else if (block.type === 'quote' && block.quote?.rich_text) {
      text = '> ' + block.quote.rich_text.map((rt: any) => rt.plain_text || '').join('');
    } else if (block.type === 'code' && block.code?.rich_text) {
      text = '```\n' + block.code.rich_text.map((rt: any) => rt.plain_text || '').join('') + '\n```';
    }

    if (text.trim()) {
      textParts.push(text.trim());
    }
  }

  return textParts.join('\n\n');
}

function chunkContent(content: string, title: string): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  const paragraphs = content.split(/\n\n+/);
  let currentChunk = `# ${title}\n\n`;
  let chunkIndex = 0;

  for (const para of paragraphs) {
    if ((currentChunk + para).length > MAX_CHUNK_CHARS && currentChunk.length > title.length + 4) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex++,
        tokenEstimate: Math.ceil(currentChunk.length / 4),
      });
      currentChunk = `# ${title} (continued)\n\n`;
    }
    currentChunk += para + '\n\n';
  }

  if (currentChunk.trim().length > title.length + 4) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunkIndex,
      tokenEstimate: Math.ceil(currentChunk.length / 4),
    });
  }

  if (chunks.length === 0) {
    chunks.push({
      text: `# ${title}\n\n${content}`.slice(0, MAX_CHUNK_CHARS),
      index: 0,
      tokenEstimate: Math.ceil(Math.min(content.length, MAX_CHUNK_CHARS) / 4),
    });
  }

  return chunks;
}

async function generateEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data.sort((a: any, b: any) => a.index - b.index).map((item: any) => item.embedding);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
