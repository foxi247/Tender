import { sendMessage, sendMultipleTenderCards } from '@/lib/telegram/bot';
import { mainMenuKeyboard, filterMainMenuKeyboard } from '@/lib/telegram/keyboards';
import {
  formatWelcomeMessage,
  formatHelpMessage,
  formatNoTendersMessage,
  formatMarketAnalysis,
  formatFilterMenu,
} from '@/lib/telegram/messages';
import { upsertUser, getUserByTelegramId, getUserPreferences } from '@/lib/users/service';
import { getRelevantTendersForUser, getMarketStats } from '@/lib/tenders/service';
import { getUserActions } from '@/lib/favorites/service';
import { logBotEvent } from '@/lib/telegram/handlers/logger';
import { getAIProvider } from '@/lib/ai/provider';
import type { TelegramMessage } from '@/types';

export async function handleStart(message: TelegramMessage): Promise<void> {
  const { from, chat } = message;
  if (!from) return;

  const user = await upsertUser({
    telegram_id: String(from.id),
    username: from.username,
    full_name: [from.first_name, from.last_name].filter(Boolean).join(' '),
  });

  await logBotEvent(user?.id ?? null, 'command_start', { telegram_id: from.id });

  const text = formatWelcomeMessage(from.first_name);
  await sendMessage(chat.id, text, { reply_markup: mainMenuKeyboard() });
}

export async function handleHelp(message: TelegramMessage): Promise<void> {
  const { from, chat } = message;
  if (!from) return;

  await logBotEvent(null, 'command_help', { telegram_id: from.id });
  await sendMessage(chat.id, formatHelpMessage());
}

export async function handleToday(message: TelegramMessage): Promise<void> {
  const { from, chat } = message;
  if (!from) return;

  const telegramId = String(from.id);
  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    await sendMessage(chat.id, 'Пожалуйста, отправьте /start для начала работы\\.', {});
    return;
  }

  const preferences = await getUserPreferences(user.id);
  if (!preferences) {
    await sendMessage(chat.id, 'Настройте фильтры через /filters для получения релевантных тендеров\\.', {});
    return;
  }

  await sendMessage(chat.id, '🔍 _Ищу актуальные тендеры\\.\\.\\._', {});

  const tenders = await getRelevantTendersForUser(user.id, preferences, 5);

  if (tenders.length === 0) {
    await sendMessage(chat.id, formatNoTendersMessage(), { reply_markup: mainMenuKeyboard() });
    return;
  }

  await sendMessage(chat.id, `📋 *Найдено ${tenders.length} тендер(ов)*`, {});
  await sendMultipleTenderCards(chat.id, tenders);

  await logBotEvent(user.id, 'command_today', { count: tenders.length });
}

export async function handleFavorites(message: TelegramMessage): Promise<void> {
  const { from, chat } = message;
  if (!from) return;

  const user = await getUserByTelegramId(String(from.id));
  if (!user) return;

  const actions = await getUserActions(user.id, 'favorite');

  if (actions.length === 0) {
    await sendMessage(chat.id, '❤️ *Избранное пусто*\n\nСохраняйте тендеры кнопкой "Сохранить" под карточкой\\.', {});
    return;
  }

  await sendMessage(chat.id, `❤️ *Избранные тендеры \\(${actions.length}\\)*`, {});

  const tenders = actions
    .slice(0, 5)
    .map((a) => a.tender)
    .filter(Boolean)
    .map((t) => ({ ...t!, score: 0, score_reasons: [], ai_summary: null, ai_why_recommended: null }));

  await sendMultipleTenderCards(chat.id, tenders);
  await logBotEvent(user.id, 'command_favorites', { count: actions.length });
}

export async function handleInWork(message: TelegramMessage): Promise<void> {
  const { from, chat } = message;
  if (!from) return;

  const user = await getUserByTelegramId(String(from.id));
  if (!user) return;

  const actions = await getUserActions(user.id, 'in_work');

  if (actions.length === 0) {
    await sendMessage(chat.id, '🔧 *Нет тендеров в работе*\n\nНажмите "В работу" под карточкой тендера\\.', {});
    return;
  }

  await sendMessage(chat.id, `🔧 *Тендеры в работе \\(${actions.length}\\)*`, {});

  const tenders = actions
    .slice(0, 5)
    .map((a) => a.tender)
    .filter(Boolean)
    .map((t) => ({ ...t!, score: 0, score_reasons: [], ai_summary: null, ai_why_recommended: null }));

  await sendMultipleTenderCards(chat.id, tenders);
  await logBotEvent(user.id, 'command_inwork', { count: actions.length });
}

export async function handleHidden(message: TelegramMessage): Promise<void> {
  const { from, chat } = message;
  if (!from) return;

  const user = await getUserByTelegramId(String(from.id));
  if (!user) return;

  const actions = await getUserActions(user.id, 'hidden');

  if (actions.length === 0) {
    await sendMessage(chat.id, '🙈 *Скрытых тендеров нет*', {});
    return;
  }

  await sendMessage(chat.id, `🙈 *Скрытые тендеры \\(${actions.length}\\)*\n\n_Они не будут показываться в подборках\\._`, {});
  await logBotEvent(user.id, 'command_hidden', { count: actions.length });
}

export async function handleMarket(message: TelegramMessage, category?: string): Promise<void> {
  const { from, chat } = message;
  if (!from) return;

  const user = await getUserByTelegramId(String(from.id));
  if (!user) {
    await sendMessage(chat.id, 'Пожалуйста, отправьте /start для начала работы\\.', {});
    return;
  }

  await sendMessage(chat.id, '📊 _Анализирую рынок\\.\\.\\._', {});

  const [stats, ai] = await Promise.all([
    getMarketStats(category),
    getAIProvider(),
  ]);

  const analysis = await ai.analyzeMarket(stats, category);
  const text = formatMarketAnalysis(stats, analysis, category);

  await sendMessage(chat.id, text, {});
  await logBotEvent(user.id, 'command_market', { category: category ?? null });
}

export async function handleFilters(message: TelegramMessage): Promise<void> {
  const { from, chat } = message;
  if (!from) return;

  const user = await getUserByTelegramId(String(from.id));
  if (!user) {
    await sendMessage(chat.id, 'Пожалуйста, отправьте /start для начала работы\\.', {});
    return;
  }

  const prefs = await getUserPreferences(user.id);
  const categories = (prefs?.categories as string[]) ?? [];
  const regions = (prefs?.regions as string[]) ?? [];
  const maxBudget = prefs?.max_budget ?? null;

  await sendMessage(chat.id, formatFilterMenu(categories, regions, maxBudget), {
    reply_markup: filterMainMenuKeyboard(categories, regions, maxBudget),
  });
  await logBotEvent(user.id, 'command_filters', {});
}
