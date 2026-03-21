import { sendMessage, sendMultipleTenderCards } from '@/lib/telegram/bot';
import { mainMenuKeyboard, aiChatKeyboard } from '@/lib/telegram/keyboards';
import { formatNoTendersMessage, escapeMarkdown } from '@/lib/telegram/messages';
import { upsertUser, getUserByTelegramId, getUserPreferences } from '@/lib/users/service';
import { getRelevantTendersForUser, getTenders } from '@/lib/tenders/service';
import { logBotEvent } from './logger';
import type { TelegramMessage, ScoredTender, UserPreferences } from '@/types';

// Map menu buttons to commands
const MENU_BUTTONS: Record<string, string> = {
  '📋 Тендеры сегодня': '/today',
  '⭐ Лучшие для меня': '/today',
  '❤️ Избранное': '/favorites',
  '🔧 В работе': '/inwork',
  '⚙️ Фильтры': '/filters',
  '❓ Помощь': '/help',
};

export async function handleTextMessage(message: TelegramMessage): Promise<void> {
  const { from, chat, text } = message;
  if (!from || !text) return;

  // Handle menu button presses
  if (MENU_BUTTONS[text]) {
    const { handleStart, handleToday, handleFavorites, handleInWork, handleFilters, handleHelp } =
      await import('./commands');

    const syntheticMessage = { ...message, text: MENU_BUTTONS[text] };
    switch (MENU_BUTTONS[text]) {
      case '/today': return handleToday(syntheticMessage);
      case '/favorites': return handleFavorites(syntheticMessage);
      case '/inwork': return handleInWork(syntheticMessage);
      case '/filters': return handleFilters(syntheticMessage);
      case '/help': return handleHelp(syntheticMessage);
    }
    return;
  }

  // Ensure user exists
  const user = await upsertUser({
    telegram_id: String(from.id),
    username: from.username,
    full_name: [from.first_name, from.last_name].filter(Boolean).join(' '),
  });

  if (!user) return;

  // If AI chat mode is active — route to AI chat handler
  if (user.ai_chat_mode) {
    const { handleAiChatMessage } = await import('./aichat');
    return handleAiChatMessage(message);
  }

  // ── AI chat mode NOT active ──────────────────────────────────────────────
  // Any free text → suggest opening AI chat. Do NOT try to search tenders.
  await logBotEvent(user.id, 'text_message', { text });

  await sendMessage(
    chat.id,
    escapeMarkdown(
      `💬 Хотите что-то найти или спросить?\n\n` +
      `Нажмите *🤖 ИИ Чат* — там можно:\n` +
      `• 🔍 Найти тендеры: _"найди бетон в Дагестане"_\n` +
      `• 📊 Спросить про рынок: _"как дела с арматурой?"_\n` +
      `• 💡 Получить совет по тендеру\n\n` +
      `Или используйте кнопки меню ниже 👇`
    ),
    { parse_mode: 'MarkdownV2', reply_markup: mainMenuKeyboard() }
  );
}
