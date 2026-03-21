import { Mistral } from '@mistralai/mistralai';
import { createServiceClient } from '@/lib/supabase/server';
import type { AIProviderInterface, Tender, UserPreferences, UserIntent, MarketStats } from '@/types';
import { formatBudget } from '@/lib/tenders/scorer';
import { logger } from '@/lib/logger';

export class MistralProvider implements AIProviderInterface {
  private client: Mistral;
  private model: string;

  constructor(apiKey: string, model: string = 'mistral-medium-latest') {
    this.client = new Mistral({ apiKey });
    this.model = model;
  }

  async summarizeTender(tender: Tender): Promise<string> {
    try {
      const prompt = `Ты помощник по тендерам для поставщиков стройматериалов в России.
Сделай краткое резюме тендера в 1-2 предложениях на русском языке.
Тендер: ${tender.title}
Сумма: ${tender.budget ? formatBudget(tender.budget) : 'не указана'}
Регион: ${tender.region ?? 'не указан'}
Заказчик: ${tender.buyer_name ?? 'не указан'}
Описание: ${tender.description?.slice(0, 500) ?? 'нет описания'}
Ответ должен быть кратким и деловым, без лишних слов.`;

      const response = await this.client.chat.complete({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 150,
      });

      return response.choices?.[0]?.message?.content?.toString() ?? this.fallbackSummary(tender);
    } catch (err) {
      logger.error('Mistral summarizeTender failed', { err });
      return this.fallbackSummary(tender);
    }
  }

  async explainWhyRecommended(tender: Tender, preferences: UserPreferences): Promise<string> {
    try {
      const categories = (preferences.categories as string[]).join(', ') || 'не указаны';
      const regions = (preferences.regions as string[]).join(', ') || 'не указаны';

      const prompt = `Объясни в 1 предложении, почему этот тендер подходит поставщику.
Тендер: ${tender.title}
Категория тендера: ${tender.category ?? 'не указана'}
Регион тендера: ${tender.region ?? 'не указан'}
Интересы поставщика: категории — ${categories}, регионы — ${regions}
Будь кратким и конкретным.`;

      const response = await this.client.chat.complete({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 100,
      });

      return response.choices?.[0]?.message?.content?.toString() ?? '';
    } catch (err) {
      logger.error('Mistral explainWhyRecommended failed', { err });
      return '';
    }
  }

  async classifyUserIntent(text: string): Promise<UserIntent> {
    try {
      const prompt = `Ты NLP-классификатор для Telegram-бота по тендерам.
Проанализируй запрос пользователя и верни JSON:
{
  "type": "search" | "favorites" | "inwork" | "hidden" | "filters" | "help" | "market" | "unknown",
  "keywords": ["список", "ключевых", "слов"],
  "category": "категория если указана или null",
  "region": "регион если указан или null",
  "maxBudget": число или null,
  "timeRange": "today" | "3days" | "week" | null,
  "confidence": 0.0-1.0
}
Запрос: "${text}"
Верни только JSON без пояснений.`;

      const response = await this.client.chat.complete({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 200,
      });

      const content = response.choices?.[0]?.message?.content?.toString() ?? '{}';
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
      return {
        type: parsed.type ?? 'unknown',
        keywords: parsed.keywords ?? [],
        category: parsed.category,
        region: parsed.region,
        maxBudget: parsed.maxBudget,
        timeRange: parsed.timeRange,
        confidence: parsed.confidence ?? 0.5,
      };
    } catch (err) {
      logger.error('Mistral classifyUserIntent failed', { err });
      return this.fallbackClassify(text);
    }
  }

  async analyzeTenderDocumentation(docsUrl: string): Promise<string> {
    // In V2: fetch and parse docs, then analyze
    return `Анализ документации по ссылке: ${docsUrl}\n\n⚠️ Глубокий анализ документов будет доступен в следующей версии.`;
  }

  async analyzeMarket(stats: MarketStats, category?: string): Promise<string> {
    try {
      const topCats = stats.topCategories
        .slice(0, 5)
        .map((c) => `${c.name}: ${c.count} тенд., ср. бюджет ${c.avgBudget ? formatBudget(c.avgBudget) : 'н/д'}`)
        .join('\n');

      const topRegs = stats.topRegions
        .slice(0, 5)
        .map((r) => `${r.name}: ${r.count}`)
        .join(', ');

      const prompt = `Ты аналитик рынка тендеров на стройматериалы в России.
Проанализируй данные рынка и дай краткое профессиональное заключение (3-5 предложений).
${category ? `Фокус на категории: ${category}` : ''}

Данные за последние 30 дней:
- Активных тендеров: ${stats.totalActive}
- Новых за неделю: ${stats.newThisWeek}
- Средний бюджет: ${stats.avgBudget ? formatBudget(stats.avgBudget) : 'нет данных'}
- Медианный бюджет: ${stats.medianBudget ? formatBudget(stats.medianBudget) : 'нет данных'}
- Максимальный бюджет: ${stats.maxBudget ? formatBudget(stats.maxBudget) : 'нет данных'}

Распределение по бюджету:
- до 1 млн: ${stats.budgetRanges.under1m} тендеров
- 1-5 млн: ${stats.budgetRanges.from1to5m} тендеров
- 5-20 млн: ${stats.budgetRanges.from5to20m} тендеров
- свыше 20 млн: ${stats.budgetRanges.over20m} тендеров

Топ категории:
${topCats || 'нет данных'}

Топ регионы: ${topRegs || 'нет данных'}

Дай оценку активности рынка, укажи на возможности для поставщика и возможные риски.
Ответь на русском языке, кратко и по делу.`;

      const response = await this.client.chat.complete({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 400,
      });

      return response.choices?.[0]?.message?.content?.toString() ?? this.fallbackMarketAnalysis(stats);
    } catch (err) {
      logger.error('Mistral analyzeMarket failed', { err });
      return this.fallbackMarketAnalysis(stats);
    }
  }

  private fallbackMarketAnalysis(stats: MarketStats): string {
    return `На рынке активно ${stats.totalActive} тендеров, за неделю появилось ${stats.newThisWeek} новых. Средний бюджет: ${stats.avgBudget ? formatBudget(stats.avgBudget) : 'н/д'}.`;
  }

  // Mistral with chat history support
  async chatWithHistory(
    userId: string,
    userMessage: string
  ): Promise<string> {
    const supabase = createServiceClient();

    // Load last 20 messages for context
    const { data: history } = await supabase
      .from('chat_history')
      .select('role, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    const messages = [
      {
        role: 'system' as const,
        content: `Ты профессиональный AI-ассистент по тендерам для поставщиков строительных материалов в России.
Ты помогаешь находить выгодные тендеры, разбираться в условиях закупок, оценивать риски.
Отвечай кратко, по-деловому, на русском языке.
Используй данные о тендерах из базы системы когда нужно.`,
      },
      ...(history ?? []).reverse().map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    const response = await this.client.chat.complete({
      model: this.model,
      messages,
      maxTokens: 500,
    });

    const assistantMessage = response.choices?.[0]?.message?.content?.toString() ?? 'Не могу ответить на этот вопрос.';

    // Save to history
    await supabase.from('chat_history').insert([
      { user_id: userId, role: 'user', content: userMessage },
      { user_id: userId, role: 'assistant', content: assistantMessage },
    ]);

    return assistantMessage;
  }

  private fallbackSummary(tender: Tender): string {
    const budget = tender.budget ? formatBudget(tender.budget) : 'сумма не указана';
    return `${tender.title}. Бюджет: ${budget}. Регион: ${tender.region ?? 'не указан'}.`;
  }

  private fallbackClassify(text: string): UserIntent {
    const lower = text.toLowerCase();

    if (lower.includes('избран') || lower.includes('сохранен')) {
      return { type: 'favorites', keywords: [], confidence: 0.8 };
    }
    if (lower.includes('работ') || lower.includes('в работе')) {
      return { type: 'inwork', keywords: [], confidence: 0.8 };
    }
    if (lower.includes('скрыт')) {
      return { type: 'hidden', keywords: [], confidence: 0.8 };
    }
    if (lower.includes('фильтр') || lower.includes('настройк')) {
      return { type: 'filters', keywords: [], confidence: 0.8 };
    }

    const searchWords = ['тендер', 'бетон', 'ракушк', 'строй', 'поставк', 'покаж', 'найди', 'есть'];
    if (searchWords.some((w) => lower.includes(w))) {
      return {
        type: 'search',
        keywords: [],
        confidence: 0.7,
      };
    }

    return { type: 'unknown', keywords: [], confidence: 0.3 };
  }
}
