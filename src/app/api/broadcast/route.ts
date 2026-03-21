import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAllUsers } from '@/lib/users/service';
import { sendMessage, sendPhoto } from '@/lib/telegram/bot';
import { logger } from '@/lib/logger';

interface BroadcastPayload {
  message: string;
  activeOnly?: boolean;
  photoUrl?: string;
  linkLabel?: string;
  linkUrl?: string;
}

function buildInlineKeyboard(linkLabel?: string, linkUrl?: string) {
  if (linkLabel?.trim() && linkUrl?.trim()) {
    return { inline_keyboard: [[{ text: linkLabel.trim(), url: linkUrl.trim() }]] };
  }
  return undefined;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  if (cookieStore.get('admin_auth')?.value !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { message, activeOnly, photoUrl, linkLabel, linkUrl } = await req.json() as BroadcastPayload;

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const inlineKb = buildInlineKeyboard(linkLabel, linkUrl);
  const users = await getAllUsers({ activeOnly: activeOnly ?? true });

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      let ok: boolean;
      if (photoUrl?.trim()) {
        ok = await sendPhoto(user.telegram_id, photoUrl.trim(), message, {
          reply_markup: inlineKb,
        });
      } else {
        ok = await sendMessage(user.telegram_id, message, {
          parse_mode: 'MarkdownV2',
          reply_markup: inlineKb,
        });
      }
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
