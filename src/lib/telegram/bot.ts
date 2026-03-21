import { logger } from '@/lib/logger';
import type { ScoredTender } from '@/types';
import { formatTenderCard, formatDigestHeader } from './messages';
import { tenderActionsKeyboard, mainMenuKeyboard } from './keyboards';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function callTelegram(method: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${API_BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { ok: boolean; description?: string; result?: unknown };
  if (!data.ok) {
    logger.error(`Telegram API error [${method}]`, { error: data.description, body });
  }
  return data.result;
}

export async function sendMessage(
  chatId: number | string,
  text: string,
  options: Record<string, unknown> = {}
): Promise<boolean> {
  try {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'MarkdownV2',
      ...options,
    });
    return true;
  } catch (err) {
    logger.error('sendMessage failed', { err, chatId });
    return false;
  }
}

export async function sendTenderCard(
  chatId: number | string,
  tender: ScoredTender,
  index?: number,
  isFavorited = false
): Promise<boolean> {
  const text = formatTenderCard(tender, index);
  const keyboard = tenderActionsKeyboard(tender.id, isFavorited);

  return sendMessage(chatId, text, { reply_markup: keyboard });
}

export async function sendMultipleTenderCards(
  chatId: number | string,
  tenders: ScoredTender[],
  maxCount = 5,
  favoriteIds: string[] = []
): Promise<void> {
  const toSend = tenders.slice(0, maxCount);
  const favSet = new Set(favoriteIds);

  for (let i = 0; i < toSend.length; i++) {
    await sendTenderCard(chatId, toSend[i], i, favSet.has(toSend[i].id));
    // Small delay to avoid rate limiting
    if (i < toSend.length - 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

export async function sendDigestToUser(
  telegramId: string,
  tenders: ScoredTender[]
): Promise<boolean> {
  try {
    if (tenders.length === 0) return true;

    const header = formatDigestHeader(tenders.length);
    await sendMessage(telegramId, header);

    await sendMultipleTenderCards(telegramId, tenders, 3);

    if (tenders.length > 3) {
      await sendMessage(telegramId, `_\\.\\.\\. и ещё ${tenders.length - 3} тендер(а)_`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Показать все', callback_data: 'digest_show_all' }],
          ],
        },
      });
    }

    return true;
  } catch (err) {
    logger.error('sendDigestToUser failed', { err, telegramId });
    return false;
  }
}

export async function sendPhoto(
  chatId: number | string,
  photoUrl: string,
  caption: string,
  options: Record<string, unknown> = {}
): Promise<boolean> {
  try {
    await callTelegram('sendPhoto', {
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: 'MarkdownV2',
      ...options,
    });
    return true;
  } catch (err) {
    logger.error('sendPhoto failed', { err, chatId });
    return false;
  }
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  await callTelegram('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text ?? '',
    show_alert: false,
  });
}

export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  options: Record<string, unknown> = {}
): Promise<void> {
  try {
    await callTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'MarkdownV2',
      ...options,
    });
  } catch (err) {
    logger.error('editMessageText failed', { err });
  }
}

export async function setWebhook(webhookUrl: string, secret: string): Promise<boolean> {
  try {
    const result = await callTelegram('setWebhook', {
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    }) as boolean;

    logger.info('Webhook set', { url: webhookUrl });
    return result;
  } catch (err) {
    logger.error('Failed to set webhook', { err });
    return false;
  }
}

export async function deleteWebhook(): Promise<void> {
  await callTelegram('deleteWebhook', { drop_pending_updates: true });
}

export async function getWebhookInfo(): Promise<unknown> {
  return callTelegram('getWebhookInfo', {});
}

export { mainMenuKeyboard };
