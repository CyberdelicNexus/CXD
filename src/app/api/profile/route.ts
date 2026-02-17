import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';

// GET /api/profile - Get current user's profile
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user profile from users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, name, email, profile_picture')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Profile GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/profile - Update current user's profile
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, profile_picture } = body;

    // Build update object with only provided fields
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (profile_picture !== undefined) updates.profile_picture = profile_picture;

    // Update user profile
    const { data: profile, error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select('id, name, email, profile_picture')
      .single();

    if (updateError) {
      console.error('Profile update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Profile PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
