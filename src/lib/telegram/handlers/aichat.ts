import { sendMessage } from '@/lib/telegram/bot';
import { mainMenuKeyboard, aiChatKeyboard } from '@/lib/telegram/keyboards';
import {
  formatAiChatOpened,
  formatAiChatClosed,
  escapeMarkdown,
} from '@/lib/telegram/messages';
import { upsertUser, setAiChatMode } from '@/lib/users/service';
import { getAIProvider } from '@/lib/ai/provider';
import { logBotEvent } from './logger';
import type { TelegramMessage } from '@/types';

export async function handleAiChatOpen(message: TelegramMessage): Promise<void> {
  const { from, chat } = message;
  if (!from) return;

  const user = await upsertUser({
    telegram_id: String(from.id),
    username: from.username,
    full_name: [from.first_name, from.last_name].filter(Boolean).join(' '),
  });
  if (!user) return;

  await setAiChatMode(user.id, true);
  await logBotEvent(user.id, 'ai_chat_open', {});

  await sendMessage(chat.id, formatAiChatOpened(from.first_name), {
    reply_markup: aiChatKeyboard(),
  });
}

export async function handleAiChatClose(message: TelegramMessage): Promise<void> {
  const { from, chat } = message;
  if (!from) return;

  const user = await upsertUser({
    telegram_id: String(from.id),
    username: from.username,
    full_name: [from.first_name, from.last_name].filter(Boolean).join(' '),
  });
  if (!user) return;

  await setAiChatMode(user.id, false);
  await logBotEvent(user.id, 'ai_chat_close', {});

  await sendMessage(chat.id, formatAiChatClosed(), {
    reply_markup: mainMenuKeyboard(),
  });
}

export async function handleAiChatMessage(message: TelegramMessage): Promise<void> {
  const { from, chat, text } = message;
  if (!from || !text) return;

  const user = await upsertUser({
    telegram_id: String(from.id),
    username: from.username,
    full_name: [from.first_name, from.last_name].filter(Boolean).join(' '),
  });
  if (!user) return;

  await logBotEvent(user.id, 'ai_chat_message', { text });

  // Show typing indicator
  await sendMessage(chat.id, '🤖 _Думаю\\.\\.\\._', {});

  try {
    const ai = await getAIProvider();
    const response = await ai.chatWithHistory(user.id, text);
    await sendMessage(chat.id, escapeMarkdown(response), {
      reply_markup: aiChatKeyboard(),
    });
  } catch {
    await sendMessage(
      chat.id,
      '⚠️ _Не удалось получить ответ от ИИ\\. Попробуйте ещё раз\\._',
      { reply_markup: aiChatKeyboard() }
    );
  }
}
