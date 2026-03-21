import { sendMessage, sendMultipleTenderCards } from '@/lib/telegram/bot';
import { mainMenuKeyboard, aiChatKeyboard } from '@/lib/telegram/keyboards';
import { FILTER_CATEGORIES, FILTER_REGIONS } from '@/lib/telegram/keyboards';
import {
  formatAiChatOpened,
  formatAiChatClosed,
  escapeMarkdown,
} from '@/lib/telegram/messages';
import { upsertUser, setAiChatMode, getUserPreferences } from '@/lib/users/service';
import { getAIProvider } from '@/lib/ai/provider';
import { searchTendersByText } from '@/lib/tenders/service';
import { logBotEvent } from './logger';
import type { TelegramMessage } from '@/types';

// ──────────────────────────────────────────────────────────────────────────────
// Intent detection: is the message asking to search tenders?
// ──────────────────────────────────────────────────────────────────────────────

const SEARCH_TRIGGERS = [
  'найди', 'найти', 'покажи', 'показать', 'ищи', 'искать', 'ищу',
  'поищи', 'подбери', 'подобрать', 'есть тендер', 'тендеры по', 'тендер на',
  'закупки по', 'закупки на', 'закупку', 'тендер',
];

function isTenderSearchRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return SEARCH_TRIGGERS.some((t) => lower.includes(t));
}

/** Extract category keywords from user message */
function extractCategories(text: string): string[] {
  const lower = text.toLowerCase();
  return FILTER_CATEGORIES.filter((cat) => lower.includes(cat.toLowerCase()));
}

/** Extract region keywords from user message */
function extractRegions(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const reg of FILTER_REGIONS) {
    if (lower.includes(reg.toLowerCase())) {
      found.push(reg);
    }
  }

  // Also check short forms that might not be in FILTER_REGIONS
  const extraMap: Record<string, string> = {
    'дагестан': 'Республика Дагестан',
    'дербент': 'Дербент',
    'махачкала': 'Махачкала',
    'москва': 'Москва',
    'питер': 'Санкт-Петербург',
    'краснодар': 'Краснодарский край',
    'ростов': 'Ростовская область',
    'казань': 'Республика Татарстан',
    'чечня': 'Чеченская Республика',
  };
  for (const [short, full] of Object.entries(extraMap)) {
    if (lower.includes(short) && !found.includes(full)) {
      found.push(full);
    }
  }

  return found;
}

// ──────────────────────────────────────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────────────────────────────────────

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

  // ── Check if user is searching for tenders ──────────────────────────────
  if (isTenderSearchRequest(text)) {
    const categories = extractCategories(text);
    const regions = extractRegions(text);

    if (categories.length > 0 || regions.length > 0) {
      await sendMessage(chat.id, '🔍 _Ищу тендеры по вашему запросу\\.\\.\\._', {
        reply_markup: aiChatKeyboard(),
      });

      // Use direct text search (no source filter, no scoring) so all DB data is accessible
      const basePrefs = await getUserPreferences(user.id);
      const searchCats = categories.length > 0 ? categories : ((basePrefs?.categories as string[]) ?? []);
      const searchRegs = regions.length > 0 ? regions : ((basePrefs?.regions as string[]) ?? []);

      const tenders = await searchTendersByText({ categories: searchCats, regions: searchRegs, limit: 5 });

      if (tenders.length > 0) {
        const catStr = categories.length > 0 ? categories.join(', ') : 'по вашим фильтрам';
        const regStr = regions.length > 0 ? ` в ${regions.join(', ')}` : '';
        await sendMessage(
          chat.id,
          escapeMarkdown(`🎯 Нашёл ${tenders.length} тендеров по "${catStr}"${regStr}:`),
          { reply_markup: aiChatKeyboard() }
        );
        await sendMultipleTenderCards(chat.id, tenders, 5);
      } else {
        const catStr = categories.length > 0 ? categories.join(', ') : '';
        const regStr = regions.length > 0 ? ` в ${regions.join(', ')}` : '';
        await sendMessage(
          chat.id,
          escapeMarkdown(`😔 По запросу "${catStr}${regStr}" тендеров не найдено. Попробуйте другие параметры или проверьте через 📋 Тендеры сегодня.`),
          { reply_markup: aiChatKeyboard() }
        );
      }
      return;
    }
  }

  // ── Regular AI chat ──────────────────────────────────────────────────────
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
