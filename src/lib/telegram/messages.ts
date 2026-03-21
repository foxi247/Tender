import type { ScoredTender, MarketStats } from '@/types';
import { formatBudget } from '@/lib/tenders/scorer';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export function formatTenderCard(tender: ScoredTender, index?: number): string {
  const lines: string[] = [];

  if (index !== undefined) {
    lines.push(`*${index + 1}\\. ${escapeMarkdown(tender.title)}*`);
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
    const urgency = daysLeft <= 3 ? ` ⚠️ \\(${daysLeft} дн\\.\\)` : ` \\(${daysLeft} дн\\.\\)`;
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
/market — AI\\-анализ рынка стройматериалов
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
• "что новое за 3 дня" — свежие тендеры
• "анализ рынка бетона" — AI\\-анализ по категории`;
}

export function formatNoTendersMessage(): string {
  return `📭 *Тендеры не найдены*

По вашим текущим фильтрам ничего не найдено\\.
Попробуйте расширить критерии поиска или обновите фильтры\\.`;
}

export function formatMarketAnalysis(stats: MarketStats, aiAnalysis: string, category?: string): string {
  const lines: string[] = [];

  lines.push(category
    ? `📊 *Анализ рынка: ${escapeMarkdown(category)}*`
    : '📊 *Анализ рынка стройматериалов*');
  lines.push('');

  lines.push(`🔢 *Статистика за 30 дней:*`);
  lines.push(`• Активных тендеров: *${stats.totalActive}*`);
  lines.push(`• Новых за неделю: *${stats.newThisWeek}*`);

  if (stats.avgBudget) {
    lines.push(`• Средний бюджет: *${escapeMarkdown(formatBudget(stats.avgBudget))}*`);
  }
  if (stats.medianBudget) {
    lines.push(`• Медианный бюджет: *${escapeMarkdown(formatBudget(stats.medianBudget))}*`);
  }
  if (stats.maxBudget) {
    lines.push(`• Максимальный: *${escapeMarkdown(formatBudget(stats.maxBudget))}*`);
  }

  lines.push('');
  lines.push(`💰 *Распределение по бюджету:*`);
  lines.push(`• до 1 млн: ${stats.budgetRanges.under1m}`);
  lines.push(`• 1–5 млн: ${stats.budgetRanges.from1to5m}`);
  lines.push(`• 5–20 млн: ${stats.budgetRanges.from5to20m}`);
  lines.push(`• свыше 20 млн: ${stats.budgetRanges.over20m}`);

  if (stats.topCategories.length > 0) {
    lines.push('');
    lines.push('🏷 *Топ категории:*');
    for (const cat of stats.topCategories.slice(0, 5)) {
      const avg = cat.avgBudget ? ` — ср\\. ${escapeMarkdown(formatBudget(cat.avgBudget))}` : '';
      lines.push(`• ${escapeMarkdown(cat.name)}: ${cat.count} тенд\\.${avg}`);
    }
  }

  if (stats.topRegions.length > 0) {
    lines.push('');
    lines.push('📍 *Топ регионы:*');
    const regionStr = stats.topRegions
      .slice(0, 5)
      .map((r) => `${escapeMarkdown(r.name)} \\(${r.count}\\)`)
      .join(', ');
    lines.push(regionStr);
  }

  lines.push('');
  lines.push('🤖 *AI\\-анализ:*');
  lines.push(escapeMarkdown(aiAnalysis));

  return lines.join('\n');
}

export function formatFilterMenu(categories: string[], regions: string[], maxBudget: number | null): string {
  const cats = categories.length > 0 ? escapeMarkdown(categories.join(', ')) : '_не выбраны_';
  const regs = regions.length > 0 ? escapeMarkdown(regions.join(', ')) : '_не выбраны_';
  const budget = maxBudget ? `до ${escapeMarkdown(formatBudgetShort(maxBudget))}` : '_без ограничений_';

  return [
    '⚙️ *Настройка фильтров*',
    '',
    `📦 *Категории:* ${cats}`,
    `📍 *Регионы:* ${regs}`,
    `💰 *Бюджет:* ${budget}`,
    '',
    'Нажмите кнопку для изменения параметра:',
  ].join('\n');
}

export function formatFilterCategories(selectedCount: number): string {
  return [
    '📦 *Выберите категории материалов*',
    '',
    `Выбрано: *${selectedCount}*`,
    '_Нажмите для включения/отключения:_',
  ].join('\n');
}

export function formatFilterRegions(selectedCount: number): string {
  return [
    '📍 *Выберите регионы*',
    '',
    `Выбрано: *${selectedCount}*`,
    '_Нажмите для включения/отключения:_',
  ].join('\n');
}

export function formatFilterBudget(currentMax: number | null): string {
  const current = currentMax ? `до ${escapeMarkdown(formatBudgetShort(currentMax))}` : '_без ограничений_';
  return [
    '💰 *Максимальный бюджет тендера*',
    '',
    `Текущий лимит: ${current}`,
    '_Выберите верхнюю границу:_',
  ].join('\n');
}

export function formatFilterSaved(categories: string[], regions: string[], maxBudget: number | null): string {
  const cats = categories.length > 0 ? escapeMarkdown(categories.join(', ')) : '_все категории_';
  const regs = regions.length > 0 ? escapeMarkdown(regions.join(', ')) : '_все регионы_';
  const budget = maxBudget ? `до ${escapeMarkdown(formatBudgetShort(maxBudget))}` : '_без ограничений_';

  return [
    '✅ *Фильтры сохранены\\!*',
    '',
    `📦 *Категории:* ${cats}`,
    `📍 *Регионы:* ${regs}`,
    `💰 *Бюджет:* ${budget}`,
    '',
    '_Подборки будут учитывать ваши настройки\\._',
  ].join('\n');
}

function formatBudgetShort(budget: number): string {
  if (budget >= 1_000_000) return `${budget / 1_000_000} млн`;
  if (budget >= 1_000) return `${budget / 1_000} тыс`;
  return `${budget} руб`;
}

export function formatUnknownMessage(): string {
  return `🤔 *Не совсем понял ваш запрос*

Попробуйте:
• Написать название материала \\(бетон, ракушечник\\)
• Указать регион
• Задать бюджет \\("до 3 млн"\\)

Или воспользуйтесь кнопками меню ниже\\.`;
}

export function escapeMarkdown(text: string): string {
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
