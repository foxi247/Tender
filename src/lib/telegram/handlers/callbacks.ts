import { answerCallbackQuery, sendMessage, sendMultipleTenderCards } from '@/lib/telegram/bot';
import { tenderActionsKeyboard } from '@/lib/telegram/keyboards';
import { getUserByTelegramId, getUserPreferences } from '@/lib/users/service';
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

  await answerCallbackQuery(queryId, 'Действие не распознано');
}
