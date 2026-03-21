import { NextRequest, NextResponse } from 'next/server';
import { handleStart, handleHelp, handleToday, handleFavorites, handleInWork, handleHidden, handleFilters, handleMarket } from '@/lib/telegram/handlers/commands';
import { handleAiChatOpen, handleAiChatClose } from '@/lib/telegram/handlers/aichat';
import { handleTextMessage } from '@/lib/telegram/handlers/messages';
import { handleCallbackQuery } from '@/lib/telegram/handlers/callbacks';
import { logger } from '@/lib/logger';
import type { TelegramUpdate } from '@/types';

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify webhook secret
  const secret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (secret !== WEBHOOK_SECRET) {
    logger.warn('Webhook secret mismatch');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  await processUpdate(update).catch((err) => {
    logger.error('Unhandled update error', { err, update });
  });

  return NextResponse.json({ ok: true });
}

async function processUpdate(update: TelegramUpdate): Promise<void> {
  if (update.message) {
    const { text } = update.message;

    if (!text) return;

    // Route commands
    if (text.startsWith('/start')) return handleStart(update.message);
    if (text.startsWith('/help')) return handleHelp(update.message);
    if (text.startsWith('/today')) return handleToday(update.message);
    if (text.startsWith('/market')) {
      const parts = text.split(' ');
      const category = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
      return handleMarket(update.message, category);
    }
    if (text === '📊 Анализ рынка') return handleMarket(update.message, undefined);
    if (text === '🤖 ИИ Чат') return handleAiChatOpen(update.message);
    if (text === '❌ Завершить ИИ Чат') return handleAiChatClose(update.message);
    if (text.startsWith('/favorites')) return handleFavorites(update.message);
    if (text.startsWith('/inwork')) return handleInWork(update.message);
    if (text.startsWith('/hidden')) return handleHidden(update.message);
    if (text.startsWith('/filters')) return handleFilters(update.message);

    // Regular text messages
    return handleTextMessage(update.message);
  }

  if (update.callback_query) {
    return handleCallbackQuery(update.callback_query);
  }
}

// GET for webhook verification
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: 'Webhook endpoint active' });
}
