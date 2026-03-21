import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAllUsers } from '@/lib/users/service';
import { sendMessage } from '@/lib/telegram/bot';
import { mainMenuKeyboard } from '@/lib/telegram/keyboards';
import { logger } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Allow both admin cookie and cron secret
  const authHeader = req.headers.get('authorization');
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('admin_auth')?.value === 'true';
  const isCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (!isAdmin && !isCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const users = await getAllUsers({ activeOnly: true });

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const ok = await sendMessage(
        user.telegram_id,
        '🔄 Бот обновлён\\! Меню обновлено — используйте кнопки ниже\\.',
        { parse_mode: 'MarkdownV2', reply_markup: mainMenuKeyboard() }
      );
      if (ok) sent++;
      else failed++;
    } catch (err) {
      logger.error('Keyboard broadcast failed', { err, telegram_id: user.telegram_id });
      failed++;
    }
    // Rate limit: Telegram allows 30 msg/sec
    await new Promise((r) => setTimeout(r, 50));
  }

  logger.info('Keyboard broadcast complete', { sent, failed, total: users.length });
  return NextResponse.json({ ok: true, sent, failed, total: users.length });
}
