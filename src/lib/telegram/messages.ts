import type { ScoredTender } from '@/types';
import { formatBudget } from '@/lib/tenders/scorer';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export function formatTenderCard(tender: ScoredTender, index?: number): string {
  const lines: string[] = [];

  if (index !== undefined) {
    lines.push(`*${index + 1}. ${escapeMarkdown(tender.title)}*`);
  } else {
    lines.push(`*${escapeMarkdown(tender.title)}*`);
  }

  lines.push('');

  if (tender.budget) {
    lines.push(`💰 *Сумма:* ${escapeMarkdown(formatBudget(tender.budget))}`);
  }

  if (tender.region) {
    lines.push(`📍 *Регион:* ${escapeMarkdown(tender.region)}`);
  }

  if (tender.deadline_at) {
    const deadline = new Date(tender.deadline_at);
    const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / 86400000);
    const dateStr = format(deadline, 'd MMMM yyyy', { locale: ru });
    const urgency = daysLeft <= 3 ? ` ⚠️ (${daysLeft} дн.)` : ` (${daysLeft} дн.)`;
    lines.push(`⏰ *Дедлайн:* ${escapeMarkdown(dateStr)}${urgency}`);
  }

  if (tender.buyer_name) {
    lines.push(`🏛 *Заказчик:* ${escapeMarkdown(tender.buyer_name)}`);
  }

  if (tender.law_type) {
    lines.push(`📋 *Закон:* ${escapeMarkdown(tender.law_type)}`);
  }

  if (tender.category) {
    lines.push(`🏷 *Категория:* ${escapeMarkdown(tender.category)}`);
  }

  if (tender.ai_why_recommended) {
    lines.push('');
    lines.push(`✅ _${escapeMarkdown(tender.ai_why_recommended)}_`);
  } else if (tender.score_reasons && tender.score_reasons.length > 0) {
    lines.push('');
    lines.push(`✅ _${escapeMarkdown(tender.score_reasons[0])}_`);
  }

  return lines.join('\n');
}

export function formatDigestHeader(count: number): string {
  return `🌅 *Ежедневная подборка тендеров*\n\nДоброе утро\\! Для вас найдено *${count}* релевантных тендер${pluralize(count, 'а', 'ов', 'ов')}\\.`;
}

export function formatWelcomeMessage(firstName: string): string {
  const name = escapeMarkdown(firstName);
  return `👋 *Добро пожаловать, ${name}\\!*

Я ваш персональный ассистент по тендерам на строительные материалы\\.

🔍 Нахожу свежие тендеры и фильтрую по вашим интересам
📊 Присылаю ежедневную подборку лучших закупок
⭐ Сохраняю избранное и статусы
🤖 Анализирую тендеры с помощью AI

Используйте меню ниже или напишите запрос свободным текстом\\.`;
}

export function formatHelpMessage(): string {
  return `📖 *Справка*

*Команды:*
/start — Главное меню
/today — Тендеры за сегодня
/favorites — Избранные тендеры
/inwork — Тендеры в работе
/hidden — Скрытые тендеры
/filters — Настройки фильтров
/help — Эта справка

*Текстовые запросы:*
• "покажи по бетону" — поиск по категории
• "тендеры в Москве" — поиск по региону
• "до 5 млн" — фильтр по бюджету
• "срочные" — скоро дедлайн
• "что новое за 3 дня" — свежие тендеры`;
}

export function formatNoTendersMessage(): string {
  return `📭 *Тендеры не найдены*

По вашим текущим фильтрам ничего не найдено\\.
Попробуйте расширить критерии поиска или обновите фильтры\\.`;
}

export function formatUnknownMessage(): string {
  return `🤔 *Не совсем понял ваш запрос*

Попробуйте:
• Написать название материала \\(бетон, ракушечник\\)
• Указать регион
• Задать бюджет \\("до 3 млн"\\)

Или воспользуйтесь кнопками меню ниже\\.`;
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

function pluralize(n: number, one: string, few: string, many: string): string {
  if (n % 100 >= 11 && n % 100 <= 14) return many;
  switch (n % 10) {
    case 1: return one;
    case 2:
    case 3:
    case 4: return few;
    default: return many;
  }
}
