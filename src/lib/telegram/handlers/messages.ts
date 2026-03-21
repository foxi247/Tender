import { sendMessage, sendMultipleTenderCards } from '@/lib/telegram/bot';
import { mainMenuKeyboard } from '@/lib/telegram/keyboards';
import { formatUnknownMessage, formatNoTendersMessage, formatAiChatSuggest } from '@/lib/telegram/messages';
import { upsertUser, getUserByTelegramId, getUserPreferences } from '@/lib/users/service';
import { getRelevantTendersForUser, getTenders } from '@/lib/tenders/service';
import { getAIProvider } from '@/lib/ai/provider';
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
    // Re-route to command handlers
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

  // Classify intent using AI
  const ai = await getAIProvider();
  const intent = await ai.classifyUserIntent(text);

  await logBotEvent(user.id, 'text_message', { text, intent });

  switch (intent.type) {
    case 'search':
      await handleSearchIntent(chat.id, user.id, intent.keywords, intent.maxBudget);
      break;

    case 'favorites': {
      const { handleFavorites } = await import('./commands');
      return handleFavorites(message);
    }

    case 'inwork': {
      const { handleInWork } = await import('./commands');
      return handleInWork(message);
    }

    case 'hidden': {
      const { handleHidden } = await import('./commands');
      return handleHidden(message);
    }

    case 'filters': {
      const { handleFilters } = await import('./commands');
      return handleFilters(message);
    }

    case 'help': {
      const { handleHelp } = await import('./commands');
      return handleHelp(message);
    }

    case 'market': {
      const { handleMarket } = await import('./commands');
      return handleMarket(message);
    }

    case 'unknown':
    default:
      if (intent.confidence < 0.4) {
        await sendMessage(chat.id, formatAiChatSuggest(), { reply_markup: mainMenuKeyboard() });
      } else {
        // Try search anyway
        await handleSearchIntent(chat.id, user.id, [text]);
      }
      break;
  }
}

async function handleSearchIntent(
  chatId: number | string,
  userId: string,
  keywords: string[],
  maxBudget?: number
): Promise<void> {
  await sendMessage(chatId, '🔍 _Ищу тендеры\\.\\.\\._', {});

  const preferences = await getUserPreferences(userId);

  let tenders: ScoredTender[] = [];

  if (preferences) {
    // Merge search keywords with preferences
    const searchPrefs: UserPreferences = {
      ...preferences,
      keywords: [...((preferences.keywords as string[]) ?? []), ...keywords],
      max_budget: maxBudget ?? preferences.max_budget,
    };
    ({ tenders } = await getRelevantTendersForUser(userId, searchPrefs, 5));
  } else {
    // Fallback: text search
    const result = await getTenders({
      query: keywords.join(' '),
      maxBudget,
      pageSize: 5,
    });
    tenders = result.items.map((t) => ({
      ...t,
      score: 50,
      score_reasons: ['По вашему запросу'],
      ai_summary: null,
      ai_why_recommended: null,
    }));
  }

  if (tenders.length === 0) {
    await sendMessage(chatId, formatNoTendersMessage(), { reply_markup: mainMenuKeyboard() });
    return;
  }

  await sendMessage(chatId, `📋 *Найдено ${tenders.length} тендер\\(ов\\)*`, {});
  await sendMultipleTenderCards(chatId, tenders);
}
