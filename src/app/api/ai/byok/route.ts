import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';
import { encryptAPIKey, decryptAPIKey, validateAPIKeyFormat, maskAPIKey } from '@/lib/encryption';
import { canBringOwnKeys } from '@/lib/ai-credit-config';
import { getPlan } from '@/lib/plans';

type Provider = 'anthropic' | 'google' | 'moonshot';

/**
 * GET /api/ai/byok
 * Retrieve user's API keys (masked for security)
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has BYOK capability
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .single();

    const plan = getPlan(subscription?.plan_id || 'free');
    const hasBYOK = canBringOwnKeys(subscription?.plan_id || 'free');

    if (!hasBYOK) {
      return NextResponse.json(
        { error: 'BYOK is only available for Lifetime users' },
        { status: 403 }
      );
    }

    // Fetch user's API keys
    const { data: keys, error } = await supabase
      .from('user_api_keys')
      .select('id, provider, key_name, is_active, last_used_at, created_at')
      .eq('user_id', user.id);

    if (error) {
      console.error('[BYOK GET Error]', error);
      return NextResponse.json(
        { error: 'Failed to fetch API keys' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      keys: keys || [],
    });
  } catch (error) {
    console.error('[BYOK GET Error]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * POST /api/ai/byok
 * Add or update an API key for a provider
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has BYOK capability
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .single();

    const hasBYOK = canBringOwnKeys(subscription?.plan_id || 'free');

    if (!hasBYOK) {
      return NextResponse.json(
        { error: 'BYOK is only available for Lifetime users' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { provider, apiKey, keyName } = body as {
      provider: Provider;
      apiKey: string;
      keyName?: string;
    };

    // Validate inputs
    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, apiKey' },
        { status: 400 }
      );
    }

    if (!['anthropic', 'google', 'moonshot'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider' },
        { status: 400 }
      );
    }

    // Validate API key format
    try {
      validateAPIKeyFormat(provider, apiKey);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Invalid API key format' },
        { status: 400 }
      );
    }

    // Encrypt the API key
    let encryptedKey: string;
    try {
      encryptedKey = encryptAPIKey(apiKey);
    } catch (error) {
      console.error('[Encryption Error]', error);
      return NextResponse.json(
        { error: 'Failed to encrypt API key' },
        { status: 500 }
      );
    }

    // Upsert the key (replace if exists)
    const { data, error } = await supabase
      .from('user_api_keys')
      .upsert(
        {
          user_id: user.id,
          provider,
          encrypted_key: encryptedKey,
          key_name: keyName || `${provider} API Key`,
          is_active: true,
        },
        {
          onConflict: 'user_id,provider',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('[BYOK POST Error]', error);
      return NextResponse.json(
        { error: 'Failed to save API key' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      key: {
        id: data.id,
        provider: data.provider,
        keyName: data.key_name,
        isActive: data.is_active,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    console.error('[BYOK POST Error]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * DELETE /api/ai/byok
 * Remove an API key for a provider
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') as Provider;

    if (!provider) {
      return NextResponse.json(
        { error: 'Missing provider parameter' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('user_api_keys')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider);

    if (error) {
      console.error('[BYOK DELETE Error]', error);
      return NextResponse.json(
        { error: 'Failed to delete API key' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[BYOK DELETE Error]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * PATCH /api/ai/byok
 * Toggle API key active status
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, isActive } = body as { provider: Provider; isActive: boolean };

    if (!provider || isActive === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, isActive' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('user_api_keys')
      .update({ is_active: isActive })
      .eq('user_id', user.id)
      .eq('provider', provider);

    if (error) {
      console.error('[BYOK PATCH Error]', error);
      return NextResponse.json(
        { error: 'Failed to update API key status' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[BYOK PATCH Error]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
