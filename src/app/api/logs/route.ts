import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getDigestLogs } from '@/lib/digest/service';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get('type') ?? 'bot';

  if (type === 'digest') {
    const logs = await getDigestLogs(50);
    return NextResponse.json({ logs });
  }

  // Bot logs
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('bot_logs')
    .select('*, user:users(telegram_id, full_name, username)')
    .order('created_at', { ascending: false })
    .limit(100);

  return NextResponse.json({ logs: data ?? [] });
}
