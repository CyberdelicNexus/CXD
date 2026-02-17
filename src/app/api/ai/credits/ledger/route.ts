import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  modelUsed: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  creditsConsumed: number | null;
  transactionType: 'usage' | 'addon_purchase' | 'monthly_reset' | 'manual_adjustment';
  projectId: string | null;
  faceKey: string | null;
  createdAt: string;
}

/**
 * GET /api/ai/credits/ledger
 * Fetch credit transaction history for the authenticated user
 *
 * Query params:
 * - limit: number (default: 50, max: 200)
 * - offset: number (default: 0)
 * - type: filter by transaction_type
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');
    const typeFilter = searchParams.get('type');

    // Build query
    let query = supabase
      .from('ai_credit_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply type filter if provided
    if (typeFilter && ['usage', 'addon_purchase', 'monthly_reset', 'manual_adjustment'].includes(typeFilter)) {
      query = query.eq('transaction_type', typeFilter);
    }

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error('[Credit Ledger GET Error]', error);
      return NextResponse.json(
        { error: 'Failed to fetch transaction history' },
        { status: 500 }
      );
    }

    // Transform to camelCase
    const formattedTransactions: CreditTransaction[] = (transactions || []).map((tx) => ({
      id: tx.id,
      userId: tx.user_id,
      amount: tx.amount,
      balanceAfter: tx.balance_after,
      reason: tx.reason,
      modelUsed: tx.model_used,
      inputTokens: tx.input_tokens,
      outputTokens: tx.output_tokens,
      creditsConsumed: tx.credits_consumed,
      transactionType: tx.transaction_type || 'usage',
      projectId: tx.project_id,
      faceKey: tx.face_key,
      createdAt: tx.created_at,
    }));

    return NextResponse.json({
      transactions: formattedTransactions,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('[Credit Ledger GET Error]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * POST /api/ai/credits/ledger
 * Consume credits for AI usage
 *
 * Body:
 * - credits: number (weighted credits to consume)
 * - model: string (model ID)
 * - inputTokens: number
 * - outputTokens: number
 * - projectId?: string
 * - faceKey?: string
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { credits, model, inputTokens, outputTokens, projectId, faceKey } = body;

    // Validate inputs
    if (!credits || !model || inputTokens === undefined || outputTokens === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: credits, model, inputTokens, outputTokens' },
        { status: 400 }
      );
    }

    if (credits <= 0) {
      return NextResponse.json({ error: 'Credits must be positive' }, { status: 400 });
    }

    // Call the consume_credits database function
    const { data: result, error } = await supabase.rpc('consume_credits', {
      p_user_id: user.id,
      p_credits: credits,
      p_model: model,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_project_id: projectId || null,
      p_face_key: faceKey || null,
    });

    if (error) {
      console.error('[Credit Consumption Error]', error);
      return NextResponse.json(
        { error: 'Failed to consume credits' },
        { status: 500 }
      );
    }

    // Check if consumption was successful
    if (!result?.success) {
      return NextResponse.json(
        {
          error: result?.error || 'insufficient_credits',
          available: result?.available || 0,
          required: result?.required || credits,
        },
        { status: 402 } // Payment Required
      );
    }

    return NextResponse.json({
      success: true,
      balance: result.balance,
      consumed: result.consumed,
    });
  } catch (error) {
    console.error('[Credit Consumption Error]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
