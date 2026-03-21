import type { AIProviderInterface, Tender, UserPreferences, UserIntent, MarketStats } from '@/types';
import { formatBudget } from '@/lib/tenders/scorer';

// Rule-based fallback — no external API required
export class RuleBasedProvider implements AIProviderInterface {
  async summarizeTender(tender: Tender): Promise<string> {
    const parts: string[] = [];

    if (tender.budget) {
      parts.push(`Бюджет: ${formatBudget(tender.budget)}`);
    }
    if (tender.region) {
      parts.push(`Регион: ${tender.region}`);
    }
    if (tender.buyer_name) {
      parts.push(`Заказчик: ${tender.buyer_name}`);
    }
    if (tender.law_type) {
      parts.push(`Закон: ${tender.law_type}`);
    }

    return parts.join(' · ') || tender.title;
  }

  async explainWhyRecommended(
    tender: Tender,
    preferences: UserPreferences
  ): Promise<string> {
    const reasons: string[] = [];
    const categories = (preferences.categories as string[]) ?? [];
    const regions = (preferences.regions as string[]) ?? [];

    if (
      tender.category &&
      categories.some((c) => tender.category!.toLowerCase().includes(c.toLowerCase()))
    ) {
      reasons.push(`совпадает с категорией "${tender.category}"`);
    }

    if (
      tender.region &&
      regions.some((r) => tender.region!.toLowerCase().includes(r.toLowerCase()))
    ) {
      reasons.push(`в вашем регионе "${tender.region}"`);
    }

    if (tender.budget && preferences.max_budget && tender.budget <= preferences.max_budget) {
      reasons.push(`бюджет в пределах вашего диапазона`);
    }

    if (reasons.length === 0) return '';
    return `Рекомендуем, так как ${reasons.join(', ')}.`;
  }

  async classifyUserIntent(text: string): Promise<UserIntent> {
    const lower = text.toLowerCase();

    // Pattern matching for common requests
    if (/избранн|сохранен/.test(lower)) {
      return { type: 'favorites', keywords: [], confidence: 0.9 };
    }
    if (/в работ|работаю/.test(lower)) {
      return { type: 'inwork', keywords: [], confidence: 0.9 };
    }
    if (/скрыт/.test(lower)) {
      return { type: 'hidden', keywords: [], confidence: 0.9 };
    }
    if (/фильтр|настройк|предпочтен/.test(lower)) {
      return { type: 'filters', keywords: [], confidence: 0.9 };
    }
    if (/помощ|help|что умеешь/.test(lower)) {
      return { type: 'help', keywords: [], confidence: 0.9 };
    }
    if (/рынок|аналитик|анализ рынк|тренд|спрос/.test(lower)) {
      const categoryMatch = lower.match(/анализ\s+рынк[а-я]*\s+(.+)/) ?? lower.match(/рынок\s+(.+)/);
      return { type: 'market', keywords: [], category: categoryMatch?.[1]?.trim(), confidence: 0.9 };
    }

    // Extract search keywords
    const keywords: string[] = [];
    const keywordPatterns = [
      'бетон', 'ракушечник', 'ракушка', 'стройматериал', 'кирпич', 'цемент',
      'щебень', 'песок', 'арматура', 'плита', 'блок', 'газобетон',
    ];
    for (const kw of keywordPatterns) {
      if (lower.includes(kw)) keywords.push(kw);
    }

    // Budget extraction
    let maxBudget: number | undefined;
    const budgetMatch = lower.match(/до\s*(\d+)\s*(млн|тыс)/);
    if (budgetMatch) {
      const amount = parseInt(budgetMatch[1]);
      const unit = budgetMatch[2];
      maxBudget = unit === 'млн' ? amount * 1_000_000 : amount * 1_000;
    }

    // Time range
    let timeRange: 'today' | '3days' | 'week' | undefined;
    if (/сегодня|today/.test(lower)) timeRange = 'today';
    else if (/3 дня|три дня/.test(lower)) timeRange = '3days';
    else if (/неделю|за неделю/.test(lower)) timeRange = 'week';

    if (keywords.length > 0 || /тендер|закупк|покаж|найди|есть/.test(lower)) {
      return { type: 'search', keywords, maxBudget, timeRange, confidence: 0.7 };
    }

    return { type: 'unknown', keywords: [], confidence: 0.2 };
  }

  async analyzeTenderDocumentation(_docsUrl: string): Promise<string> {
    return '⚠️ Анализ документации доступен в версии с AI-модулем.';
  }

  async chatWithHistory(_userId: string, userMessage: string): Promise<string> {
    const lower = userMessage.toLowerCase();
    if (/привет|здравст|добр/.test(lower)) {
      return 'Здравствуйте! Я помогаю искать тендеры на стройматериалы. Задайте вопрос или опишите, что ищете.';
    }
    if (/как|что|помог|умеешь/.test(lower)) {
      return 'Я могу помочь найти тендеры по категории, региону и бюджету. Например: "покажи бетон в Москве до 5 млн".';
    }
    return 'Для поиска тендеров подключите AI-модуль в настройках. Пока могу принимать запросы через основное меню.';
  }

  async analyzeMarket(stats: MarketStats, category?: string): Promise<string> {
    const parts: string[] = [];

    if (category) {
      parts.push(`Анализ рынка по категории «${category}».`);
    } else {
      parts.push('Анализ рынка стройматериалов.');
    }

    parts.push(`Активных тендеров: ${stats.totalActive}, за неделю добавлено ${stats.newThisWeek}.`);

    if (stats.avgBudget) {
      parts.push(`Средний бюджет тендера: ${formatBudget(stats.avgBudget)}.`);
    }

    if (stats.topCategories.length > 0) {
      const top = stats.topCategories[0];
      parts.push(`Самая активная категория: ${top.name} (${top.count} тендеров).`);
    }

    if (stats.topRegions.length > 0) {
      const topR = stats.topRegions.slice(0, 3).map((r) => r.name).join(', ');
      parts.push(`Лидирующие регионы: ${topR}.`);
    }

    const large = stats.budgetRanges.from5to20m + stats.budgetRanges.over20m;
    if (large > 0) {
      parts.push(`Крупных тендеров (от 5 млн): ${large}.`);
    }

    return parts.join(' ');
  }
}
