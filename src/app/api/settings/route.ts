import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { invalidateAIProviderCache } from '@/lib/ai/provider';

export async function GET(): Promise<NextResponse> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .order('key');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const body = await req.json() as { key: string; value: string };
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key and value required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('app_settings')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('key', key);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Invalidate AI provider cache if AI settings changed
  if (key.startsWith('ai_') || key.startsWith('mistral_') || key.startsWith('openai_')) {
    invalidateAIProviderCache();
  }

  return NextResponse.json({ success: true });
}
