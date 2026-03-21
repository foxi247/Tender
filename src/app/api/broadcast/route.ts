import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAllUsers } from '@/lib/users/service';
import { sendMessage } from '@/lib/telegram/bot';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  if (cookieStore.get('admin_auth')?.value !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { message, activeOnly } = await req.json() as { message: string; activeOnly?: boolean };

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const users = await getAllUsers({ activeOnly: activeOnly ?? true });

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const ok = await sendMessage(user.telegram_id, message, { parse_mode: 'MarkdownV2' });
      if (ok) sent++;
      else failed++;
    } catch (err) {
      logger.error('Broadcast send failed', { err, telegram_id: user.telegram_id });
      failed++;
    }
    // Rate limit: 30 msg/sec max
    await new Promise((r) => setTimeout(r, 50));
  }

  logger.info('Broadcast complete', { sent, failed, total: users.length });
  return NextResponse.json({ ok: true, sent, failed, total: users.length });
}
