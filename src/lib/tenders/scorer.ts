import type { Tender, UserPreferences, ScoredTender } from '@/types';

interface ScoreResult {
  score: number;
  reasons: string[];
}

function calculateScore(tender: Tender, preferences: UserPreferences): ScoreResult {
  let score = 0;
  const reasons: string[] = [];

  const categories = (preferences.categories as string[]) ?? [];
  const regions = (preferences.regions as string[]) ?? [];
  const keywords = (preferences.keywords as string[]) ?? [];

  // +40 — category match
  if (tender.category && categories.length > 0) {
    const matched = categories.some(
      (cat) =>
        tender.category!.toLowerCase().includes(cat.toLowerCase()) ||
        cat.toLowerCase().includes(tender.category!.toLowerCase())
    );
    if (matched) {
      score += 40;
      reasons.push(`Совпадает категория: ${tender.category}`);
    }
  }

  // +25 — region match
  if (tender.region && regions.length > 0) {
    const matched = regions.some(
      (r) =>
        tender.region!.toLowerCase().includes(r.toLowerCase()) ||
        r.toLowerCase().includes(tender.region!.toLowerCase())
    );
    if (matched) {
      score += 25;
      reasons.push(`Ваш регион: ${tender.region}`);
    }
  }

  // +15 — budget in range
  if (tender.budget !== null) {
    const minOk = preferences.min_budget === null || tender.budget >= preferences.min_budget;
    const maxOk = preferences.max_budget === null || tender.budget <= preferences.max_budget;
    if (minOk && maxOk) {
      score += 15;
      reasons.push(`Бюджет в диапазоне: ${formatBudget(tender.budget)}`);
    }
  }

  // +10 — freshness (published within 48h)
  if (tender.published_at) {
    const hoursAgo = (Date.now() - new Date(tender.published_at).getTime()) / 3600000;
    if (hoursAgo <= 48) {
      score += 10;
      reasons.push('Свежий тендер (< 48 часов)');
    } else if (hoursAgo <= 96) {
      score += 5;
    }
  }

  // +10 — keyword matches in title/description
  if (keywords.length > 0) {
    const text = `${tender.title} ${tender.description ?? ''}`.toLowerCase();
    const matchedKeywords = keywords.filter((kw) => text.includes(kw.toLowerCase()));
    if (matchedKeywords.length > 0) {
      score += Math.min(10, matchedKeywords.length * 3);
      reasons.push(`Ключевые слова: ${matchedKeywords.slice(0, 3).join(', ')}`);
    }
  }

  // -20 — excluded keywords
  const excludedKeywords = (preferences.excluded_keywords as string[]) ?? [];
  if (excludedKeywords.length > 0) {
    const text = `${tender.title} ${tender.description ?? ''}`.toLowerCase();
    const hasExcluded = excludedKeywords.some((kw) => text.includes(kw.toLowerCase()));
    if (hasExcluded) {
      score -= 20;
    }
  }

  // +5 — preferred law type
  const preferredLaws = (preferences.preferred_laws as string[]) ?? [];
  if (tender.law_type && preferredLaws.includes(tender.law_type)) {
    score += 5;
    reasons.push(`Предпочтительный закон: ${tender.law_type}`);
  }

  // -10 — deadline is very soon (< 3 days) — urgent but risky
  if (tender.deadline_at) {
    const daysLeft = (new Date(tender.deadline_at).getTime() - Date.now()) / 86400000;
    if (daysLeft < 0) {
      score = -1; // expired
    } else if (daysLeft < 3) {
      score -= 5;
      reasons.push(`Срочно: ${Math.ceil(daysLeft)} дн. до дедлайна`);
    }
  }

  return { score: Math.max(0, score), reasons };
}

export function scoreTenders(
  tenders: Tender[],
  preferences: UserPreferences
): ScoredTender[] {
  return tenders
    .map((tender) => {
      const { score, reasons } = calculateScore(tender, preferences);
      return {
        ...tender,
        score,
        score_reasons: reasons,
        ai_summary: null,
        ai_why_recommended: reasons.length > 0 ? reasons.join('. ') : null,
      };
    })
    .filter((t) => t.score >= 0)
    .sort((a, b) => b.score - a.score);
}

export function formatBudget(budget: number): string {
  if (budget >= 1_000_000) {
    return `${(budget / 1_000_000).toFixed(1)} млн ₽`;
  }
  if (budget >= 1_000) {
    return `${(budget / 1_000).toFixed(0)} тыс. ₽`;
  }
  return `${budget.toFixed(0)} ₽`;
}
