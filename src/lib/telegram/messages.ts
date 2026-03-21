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
  return `👋 *Привет, ${name}\\!*

Я — ваш персональный помощник по тендерам на строительные материалы\\.

*🚀 Быстрый старт — 3 шага:*

*1️⃣ Настройте фильтры* ⚙️
_Укажите ваш регион, категории товаров и диапазон бюджета_
→ Нажмите кнопку *«Фильтры»* в меню ниже

*2️⃣ Смотрите тендеры* 📋
_Свежие закупки с AI\\-оценкой релевантности именно для вас_
→ Кнопка *«Тендеры сегодня»* или *«Лучшие для меня»*

*3️⃣ Управляйте тендерами* ❤️ 🔧
_Прямо из карточки тендера:_
• ❤️ *Сохранить* — добавить в избранное
• 🔧 *В работу* — отметить как активный
• 🙈 *Скрыть* — убрать из выдачи


*💡 Умные возможности:*

🤖 AI объясняет почему каждый тендер подходит именно вам
💬 Пишите запросы текстом: _"бетон в Москве до 3 млн"_
📊 /market — анализ рынка стройматериалов
🌅 Ежедневная рассылка лучших тендеров каждое утро


👇 _Начните прямо сейчас — нажмите_ *«Фильтры»*_\\!_`;
}

export function formatHelpMessage(): string {
  return `📖 *Справка по боту*


*⌨️ Команды:*

/start — Главное меню
/today — Тендеры за сегодня
/market — AI\\-анализ рынка стройматериалов
/favorites — Избранные тендеры
/inwork — Тендеры в работе
/hidden — Скрытые тендеры
/filters — Настройки фильтров
/help — Эта справка


*💬 Поиск текстом:*

• _"покажи по бетону"_ — поиск по категории
• _"тендеры в Москве"_ — поиск по региону
• _"до 5 млн"_ — фильтр по бюджету
• _"срочные"_ — тендеры с дедлайном до 7 дней
• _"что новое за 3 дня"_ — свежие тендеры
• _"анализ рынка бетона"_ — AI\\-анализ по категории
• _"бетон в Москве до 3 млн"_ — комбинированный запрос


*🃏 Кнопки в карточке тендера:*

🔗 *Открыть закупку* — перейти на zakupki\\.gov\\.ru
📄 *Документация* — скачать документы
❤️ *Сохранить* — добавить в избранное
🔧 *В работу* — пометить как активный
🙈 *Скрыть* — убрать из выдачи`;
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

export function formatFilterMenu(
  categories: string[],
  regions: string[],
  maxBudget: number | null,
  preferredSources: string[] = []
): string {
  const cats = categories.length > 0 ? escapeMarkdown(categories.join(', ')) : '_не выбраны_';
  const regs = regions.length > 0 ? escapeMarkdown(regions.join(', ')) : '_не выбраны_';
  const budget = maxBudget ? `до ${escapeMarkdown(formatBudgetShort(maxBudget))}` : '_без ограничений_';
  const platforms = preferredSources.length > 0
    ? escapeMarkdown(preferredSources.map((s) => s === 'bicotender' ? 'Bico' : 'Zakupki\\.gov').join(', '))
    : '_все площадки_';

  return [
    '⚙️ *Настройка фильтров*',
    '',
    `📦 *Категории:* ${cats}`,
    `📍 *Регионы:* ${regs}`,
    `💰 *Бюджет:* ${budget}`,
    `🌐 *Площадки:* ${platforms}`,
    '',
    'Нажмите кнопку для изменения параметра:',
  ].join('\n');
}

export function formatFilterPlatforms(selectedCount: number): string {
  return [
    '🌐 *Выберите площадки*',
    '',
    selectedCount > 0
      ? `Выбрано: *${selectedCount}*`
      : '_Пусто \\= все площадки_',
    '_Нажмите для включения/отключения:_',
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

export function formatFilterSaved(
  categories: string[],
  regions: string[],
  maxBudget: number | null,
  preferredSources: string[] = []
): string {
  const cats = categories.length > 0 ? escapeMarkdown(categories.join(', ')) : '_все категории_';
  const regs = regions.length > 0 ? escapeMarkdown(regions.join(', ')) : '_все регионы_';
  const budget = maxBudget ? `до ${escapeMarkdown(formatBudgetShort(maxBudget))}` : '_без ограничений_';
  const platforms = preferredSources.length > 0
    ? escapeMarkdown(preferredSources.map((s) => s === 'bicotender' ? 'Bico' : 'Zakupki.gov').join(', '))
    : '_все площадки_';

  return [
    '✅ *Фильтры сохранены\\!*',
    '',
    `📦 *Категории:* ${cats}`,
    `📍 *Регионы:* ${regs}`,
    `💰 *Бюджет:* ${budget}`,
    `🌐 *Площадки:* ${platforms}`,
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

Или воспользуйтесь кнопками меню ниже\\.

💬 Хотите пообщаться с ИИ\\-ассистентом? Нажмите *«🤖 ИИ Чат»*`;
}

export function formatAiChatOpened(firstName: string): string {
  const name = escapeMarkdown(firstName);
  return `🤖 *ИИ\\-чат открыт, ${name}\\!*

Я ваш AI\\-ассистент по тендерам и закупкам стройматериалов\\.

Вы можете спросить меня:
• 🔍 _"Какие тендеры сейчас актуальны по бетону?"_
• 💡 _"Как правильно участвовать в тендере по 44\\-ФЗ?"_
• 📊 _"Что происходит на рынке стройматериалов?"_
• ⚡ _"Найди срочные тендеры в Москве"_

Просто напишите ваш вопрос\\!

_Нажмите_ *«❌ Завершить ИИ Чат»* _чтобы вернуться в меню\\._`;
}

export function formatAiChatClosed(): string {
  return `✅ *ИИ\\-чат завершён*

Возвращаемся в главное меню\\.`;
}

export function formatAiChatSuggest(): string {
  return `💬 *Хотите поговорить с ИИ\\-ассистентом?*

Нажмите *«🤖 ИИ Чат»* в меню ниже — я помогу разобраться с тендерами, ответить на вопросы и найти выгодные закупки\\.`;
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
