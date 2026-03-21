import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai/provider';
import { getUserByTelegramId } from '@/lib/users/service';
import { MistralProvider } from '@/lib/ai/mistral';
import { createServiceClient } from '@/lib/supabase/server';

// Chat endpoint for AI conversations
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json() as { telegramId: string; message: string };
  const { telegramId, message } = body;

  if (!telegramId || !message) {
    return NextResponse.json({ error: 'telegramId and message required' }, { status: 400 });
  }

  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const ai = await getAIProvider();

  // Use Mistral with history if available
  if (ai instanceof MistralProvider) {
    const response = await (ai as MistralProvider).chatWithHistory(user.id, message);
    return NextResponse.json({ response });
  }

  // Fallback: classify and respond
  const intent = await ai.classifyUserIntent(message);
  return NextResponse.json({ intent, response: 'AI response placeholder' });
}

// Get chat history
export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('chat_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(50);

  return NextResponse.json({ history: data ?? [] });
}
