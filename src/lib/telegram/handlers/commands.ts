import { sendMessage, sendMultipleTenderCards } from '@/lib/telegram/bot';
import { mainMenuKeyboard, filterMainMenuKeyboard, marketCategorySelectKeyboard, marketAllCategoriesKeyboard } from '@/lib/telegram/keyboards';
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
    const { getTenderStats } = await import('@/lib/tenders/service');
    const stats = await getTenderStats();
    let msg: string;
    if (stats.total === 0) {
      msg = '📭 *База тендеров пуста*\n\nТендеры ещё не загружены\\. Администратор должен запустить синхронизацию в панели управления\\.\n\n_Попробуйте позже_ — синхронизация запускается ежедневно в 6:00\\.';
    } else {
      msg = formatNoTendersMessage();
    }
    await sendMessage(chat.id, msg, { reply_markup: mainMenuKeyboard() });
    return;
  }

  await sendMessage(chat.id, `📋 *Найдено ${tenders.length} тендер\\(ов\\)*`, {});
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

  const favoriteIds = actions.map((a) => a.tender_id);
  const tenders = actions
    .slice(0, 5)
    .map((a) => a.tender)
    .filter(Boolean)
    .map((t) => ({ ...t!, score: 0, score_reasons: [], ai_summary: null, ai_why_recommended: null }));

  await sendMultipleTenderCards(chat.id, tenders, 5, favoriteIds);
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

/** Step 1: Show category selection keyboard */
export async function handleMarket(message: TelegramMessage): Promise<void> {
  const { from, chat } = message;
  if (!from) return;

  const user = await getUserByTelegramId(String(from.id));
  if (!user) {
    await sendMessage(chat.id, 'Пожалуйста, отправьте /start для начала работы\\.', {});
    return;
  }

  const prefs = await getUserPreferences(user.id);
  const userCategories = (prefs?.categories as string[] | undefined) ?? [];

  const hint = userCategories.length > 0
    ? `Ваши категории: *${userCategories.slice(0, 5).join(', ')}*\\.`
    : 'Выберите категорию для анализа или нажмите *Общий анализ*\\.';

  await sendMessage(
    chat.id,
    `📊 *Анализ рынка тендеров*\n\n${hint}\n\nПо какой теме сделать анализ?`,
    { parse_mode: 'MarkdownV2', reply_markup: marketCategorySelectKeyboard(userCategories) }
  );
  await logBotEvent(user.id, 'command_market', { step: 'category_select' });
}

/** Step 2: Actually run the market analysis after category is chosen */
export async function handleMarketAnalysis(
  chatId: number | string,
  userId: string,
  category?: string,  // undefined = general (all categories)
  sources?: string[],
  regions?: string[],
): Promise<void> {
  await sendMessage(chatId, `📊 _Анализирую рынок${category ? ` по категории "${category}"` : ''}\\.\\.\\._`, {});

  const [stats, ai] = await Promise.all([
    getMarketStats(
      category,
      sources && sources.length > 0 ? sources : undefined,
      regions && regions.length > 0 ? regions : undefined,
    ),
    getAIProvider(),
  ]);

  const analysis = await ai.analyzeMarket(stats, category);
  const text = formatMarketAnalysis(stats, analysis, category);

  await sendMessage(chatId, text, {});
  await logBotEvent(userId, 'command_market', { category: category ?? 'general', sources });
}

/** Show full category list for picking */
export async function handleMarketAllCategories(
  chatId: number | string,
  messageId: number,
): Promise<void> {
  const { editMessageText } = await import('@/lib/telegram/bot');
  await editMessageText(
    chatId,
    messageId,
    '📂 *Все категории* — выберите для анализа:',
    { parse_mode: 'MarkdownV2', reply_markup: marketAllCategoriesKeyboard() }
  );
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
  const preferredSources = (prefs?.preferred_sources as string[]) ?? [];

  await sendMessage(chat.id, formatFilterMenu(categories, regions, maxBudget, preferredSources), {
    reply_markup: filterMainMenuKeyboard(categories, regions, maxBudget, preferredSources),
  });
  await logBotEvent(user.id, 'command_filters', {});
}
