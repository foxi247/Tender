import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAllUsers } from '@/lib/users/service';
import { sendMessage, sendPhoto } from '@/lib/telegram/bot';
import { mainMenuKeyboard } from '@/lib/telegram/keyboards';
import { logger } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET;

interface BroadcastPayload {
  /** Custom update message text (plain, will be MarkdownV2-escaped) */
  updateText?: string;
  /** Optional photo URL to send as photo caption instead of text */
  photoUrl?: string;
  /** Optional inline link button label */
  linkLabel?: string;
  /** Optional inline link button URL */
  linkUrl?: string;
}

function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function buildInlineKeyboard(linkLabel?: string, linkUrl?: string) {
  if (linkLabel && linkUrl) {
    return { inline_keyboard: [[{ text: linkLabel, url: linkUrl }]] };
  }
  return undefined;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('admin_auth')?.value === 'true';
  const isCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (!isAdmin && !isCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as BroadcastPayload;
  const { updateText, photoUrl, linkLabel, linkUrl } = body;

  // Build the message text
  const baseText = updateText?.trim()
    ? `🔄 *Обновление бота*\n\n${escapeMarkdownV2(updateText.trim())}\n\n_Используйте кнопки меню ниже_ 👇`
    : `🔄 *Бот обновлён\\!* Меню обновлено — используйте кнопки ниже\\.`;

  const inlineKb = buildInlineKeyboard(linkLabel, linkUrl);

  const users = await getAllUsers({ activeOnly: true });
  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      let ok: boolean;
      if (photoUrl) {
        // Send photo with caption + optional link button + reply keyboard
        ok = await sendPhoto(user.telegram_id, photoUrl, baseText, {
          reply_markup: inlineKb ?? mainMenuKeyboard(),
        });
        // If there's a link button AND a photo, send a second message with the reply keyboard
        if (ok && inlineKb) {
          await sendMessage(
            user.telegram_id,
            '⬆️ Нажмите кнопку выше или используйте меню:',
            { reply_markup: mainMenuKeyboard() }
          );
        }
      } else {
        // Text-only with optional link button
        ok = await sendMessage(user.telegram_id, baseText, {
          parse_mode: 'MarkdownV2',
          reply_markup: inlineKb
            ? { ...inlineKb }  // send inline keyboard first
            : mainMenuKeyboard(),
        });
        // If inline button sent, also push the reply keyboard
        if (ok && inlineKb) {
          await sendMessage(
            user.telegram_id,
            '👇 Меню обновлено:',
            { reply_markup: mainMenuKeyboard() }
          );
        }
      }
      if (ok) sent++;
      else failed++;
    } catch (err) {
      logger.error('Keyboard broadcast failed', { err, telegram_id: user.telegram_id });
      failed++;
    }
    // Telegram rate limit: max 30 msg/sec per bot
    await new Promise((r) => setTimeout(r, 50));
  }

  logger.info('Keyboard broadcast complete', { sent, failed, total: users.length });
  return NextResponse.json({ ok: true, sent, failed, total: users.length });
}
