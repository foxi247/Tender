import { answerCallbackQuery, sendMessage, sendMultipleTenderCards, editMessageText } from '@/lib/telegram/bot';
import {
  tenderActionsKeyboard,
  filterMainMenuKeyboard,
  filterCategoriesKeyboard,
  filterRegionsKeyboard,
  filterBudgetKeyboard,
  filterPlatformsKeyboard,
  FILTER_CATEGORIES,
  FILTER_REGIONS,
  FILTER_PLATFORMS,
} from '@/lib/telegram/keyboards';
import {
  formatFilterMenu,
  formatFilterCategories,
  formatFilterRegions,
  formatFilterBudget,
  formatFilterSaved,
  formatFilterPlatforms,
} from '@/lib/telegram/messages';
import { getUserByTelegramId, getUserPreferences, updateUserPreferences } from '@/lib/users/service';
import { toggleTenderAction, addTenderAction } from '@/lib/favorites/service';
import { getTenderById, getRelevantTendersForUser } from '@/lib/tenders/service';
import { logBotEvent } from './logger';
import type { TelegramCallbackQuery, ScoredTender } from '@/types';

export async function handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
  const { from, data, message, id: queryId } = query;
  if (!from || !data) return;

  const chatId = message?.chat.id;
  if (!chatId) return;

  const user = await getUserByTelegramId(String(from.id));
  if (!user) {
    await answerCallbackQuery(queryId, 'Сначала отправьте /start');
    return;
  }

  await logBotEvent(user.id, 'callback_query', { data });

  // Parse callback data: action_tenderId
  if (data.startsWith('fav_')) {
    const tenderId = data.slice(4);
    const { added } = await toggleTenderAction(user.id, tenderId, 'favorite');
    await answerCallbackQuery(queryId, added ? '❤️ Добавлено в избранное' : '💔 Убрано из избранного');
    return;
  }

  if (data.startsWith('work_')) {
    const tenderId = data.slice(5);
    await addTenderAction(user.id, tenderId, 'in_work');
    await answerCallbackQuery(queryId, '🔧 Тендер добавлен в работу');
    return;
  }

  if (data.startsWith('hide_')) {
    const tenderId = data.slice(5);
    await addTenderAction(user.id, tenderId, 'hidden');
    await answerCallbackQuery(queryId, '🙈 Тендер скрыт');
    return;
  }

  if (data.startsWith('open_')) {
    const tenderId = data.slice(5);
    const tender = await getTenderById(tenderId);
    if (tender?.source_url) {
      await addTenderAction(user.id, tenderId, 'viewed');
      await answerCallbackQuery(queryId);
      await sendMessage(chatId, `🔗 [Открыть закупку](${tender.source_url})`, {
        parse_mode: 'Markdown',
      });
    } else {
      await answerCallbackQuery(queryId, 'Ссылка недоступна');
    }
    return;
  }

  if (data.startsWith('docs_')) {
    const tenderId = data.slice(5);
    const tender = await getTenderById(tenderId);
    if (tender?.docs_url) {
      await answerCallbackQuery(queryId);
      await sendMessage(chatId, `📄 [Документация](${tender.docs_url})`, {
        parse_mode: 'Markdown',
      });
    } else {
      await answerCallbackQuery(queryId, 'Документация не прикреплена');
    }
    return;
  }

  if (data === 'digest_show_all') {
    await answerCallbackQuery(queryId);
    const preferences = await getUserPreferences(user.id);
    if (!preferences) return;

    const tenders = await getRelevantTendersForUser(user.id, preferences, 10);
    if (tenders.length === 0) return;

    await sendMultipleTenderCards(chatId, tenders.slice(3), 7);
    return;
  }

  // ── Filter navigation ──────────────────────────────────────────────────────

  if (data === 'fm' || data === 'fc' || data === 'fr' || data === 'fb' || data === 'fp') {
    await answerCallbackQuery(queryId);
    const prefs = await getUserPreferences(user.id);
    const categories = (prefs?.categories as string[]) ?? [];
    const regions = (prefs?.regions as string[]) ?? [];
    const maxBudget = prefs?.max_budget ?? null;
    const preferredSources = (prefs?.preferred_sources as string[]) ?? [];
    const msgId = message?.message_id;
    if (!msgId) return;

    if (data === 'fm') {
      await editMessageText(chatId, msgId, formatFilterMenu(categories, regions, maxBudget, preferredSources), {
        reply_markup: filterMainMenuKeyboard(categories, regions, maxBudget, preferredSources),
      });
    } else if (data === 'fc') {
      await editMessageText(chatId, msgId, formatFilterCategories(categories.length), {
        reply_markup: filterCategoriesKeyboard(categories),
      });
    } else if (data === 'fr') {
      await editMessageText(chatId, msgId, formatFilterRegions(regions.length), {
        reply_markup: filterRegionsKeyboard(regions),
      });
    } else if (data === 'fp') {
      await editMessageText(chatId, msgId, formatFilterPlatforms(preferredSources.length), {
        reply_markup: filterPlatformsKeyboard(preferredSources),
      });
    } else {
      await editMessageText(chatId, msgId, formatFilterBudget(maxBudget), {
        reply_markup: filterBudgetKeyboard(maxBudget),
      });
    }
    return;
  }

  // Toggle category: fct_N
  if (data.startsWith('fct_')) {
    const idx = parseInt(data.slice(4), 10);
    const cat = FILTER_CATEGORIES[idx];
    if (!cat) { await answerCallbackQuery(queryId); return; }

    const prefs = await getUserPreferences(user.id);
    const current = (prefs?.categories as string[]) ?? [];
    const updated = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];

    await updateUserPreferences(user.id, { categories: updated });
    await answerCallbackQuery(queryId, updated.includes(cat) ? `✅ ${cat}` : `❌ ${cat} убрана`);

    const msgId = message?.message_id;
    if (msgId) {
      await editMessageText(chatId, msgId, formatFilterCategories(updated.length), {
        reply_markup: filterCategoriesKeyboard(updated),
      });
    }
    return;
  }

  // Toggle region: frt_N
  if (data.startsWith('frt_')) {
    const idx = parseInt(data.slice(4), 10);
    const reg = FILTER_REGIONS[idx];
    if (!reg) { await answerCallbackQuery(queryId); return; }

    const prefs = await getUserPreferences(user.id);
    const current = (prefs?.regions as string[]) ?? [];
    const updated = current.includes(reg)
      ? current.filter((r) => r !== reg)
      : [...current, reg];

    await updateUserPreferences(user.id, { regions: updated });
    await answerCallbackQuery(queryId, updated.includes(reg) ? `✅ ${reg}` : `❌ ${reg} убран`);

    const msgId = message?.message_id;
    if (msgId) {
      await editMessageText(chatId, msgId, formatFilterRegions(updated.length), {
        reply_markup: filterRegionsKeyboard(updated),
      });
    }
    return;
  }

  // Set max budget: fbmax_N
  if (data.startsWith('fbmax_')) {
    const value = parseInt(data.slice(6), 10);
    const maxBudget = value === 0 ? null : value;
    await updateUserPreferences(user.id, { max_budget: maxBudget });
    await answerCallbackQuery(queryId, maxBudget ? `✅ Бюджет: до ${maxBudget / 1_000_000 >= 1 ? `${maxBudget / 1_000_000} млн` : `${maxBudget / 1_000} тыс`}` : '✅ Без лимита');

    const msgId = message?.message_id;
    if (msgId) {
      await editMessageText(chatId, msgId, formatFilterBudget(maxBudget), {
        reply_markup: filterBudgetKeyboard(maxBudget),
      });
    }
    return;
  }

  // Toggle platform: fpt_<sourceId>
  if (data.startsWith('fpt_')) {
    const sourceId = data.slice(4);
    const platform = FILTER_PLATFORMS.find((p) => p.id === sourceId);
    if (!platform) { await answerCallbackQuery(queryId); return; }

    const prefs = await getUserPreferences(user.id);
    const current = (prefs?.preferred_sources as string[]) ?? [];
    const updated = current.includes(sourceId)
      ? current.filter((s) => s !== sourceId)
      : [...current, sourceId];

    await updateUserPreferences(user.id, { preferred_sources: updated });
    await answerCallbackQuery(queryId, updated.includes(sourceId) ? `✅ ${platform.label}` : `❌ ${platform.label} убрана`);

    const msgId = message?.message_id;
    if (msgId) {
      await editMessageText(chatId, msgId, formatFilterPlatforms(updated.length), {
        reply_markup: filterPlatformsKeyboard(updated),
      });
    }
    return;
  }

  // Save and close: fd
  if (data === 'fd') {
    await answerCallbackQuery(queryId, '✅ Фильтры сохранены!');
    const prefs = await getUserPreferences(user.id);
    const categories = (prefs?.categories as string[]) ?? [];
    const regions = (prefs?.regions as string[]) ?? [];
    const maxBudget = prefs?.max_budget ?? null;
    const preferredSources = (prefs?.preferred_sources as string[]) ?? [];

    const msgId = message?.message_id;
    if (msgId) {
      await editMessageText(chatId, msgId, formatFilterSaved(categories, regions, maxBudget, preferredSources), {
        reply_markup: { inline_keyboard: [] },
      });
    }
    await logBotEvent(user.id, 'filter_saved', { categories, regions, maxBudget, preferredSources });
    return;
  }

  await answerCallbackQuery(queryId, 'Действие не распознано');
}
