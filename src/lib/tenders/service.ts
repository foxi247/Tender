import { createServiceClient } from '@/lib/supabase/server';
import type { Tender, TenderSearchParams, PaginatedResponse, UserPreferences, ScoredTender, MarketStats } from '@/types';
import { scoreTenders } from './scorer';
import { logger } from '@/lib/logger';

export async function getTenders(
  params: TenderSearchParams = {}
): Promise<PaginatedResponse<Tender>> {
  const supabase = createServiceClient();
  const {
    query,
    category,
    region,
    minBudget,
    maxBudget,
    lawType,
    status = 'active',
    page = 1,
    pageSize = 20,
    sortBy = 'published_at',
    sortOrder = 'desc',
  } = params;

  let dbQuery = supabase
    .from('tenders')
    .select('*', { count: 'exact' })
    .eq('status', status);

  if (query) {
    dbQuery = dbQuery.ilike('title', `%${query}%`);
  }
  if (category) {
    dbQuery = dbQuery.eq('category', category);
  }
  if (region) {
    dbQuery = dbQuery.eq('region', region);
  }
  if (minBudget !== undefined) {
    dbQuery = dbQuery.gte('budget', minBudget);
  }
  if (maxBudget !== undefined) {
    dbQuery = dbQuery.lte('budget', maxBudget);
  }
  if (lawType) {
    dbQuery = dbQuery.eq('law_type', lawType);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await dbQuery
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(from, to);

  if (error) {
    logger.error('Failed to fetch tenders', { error });
    return { items: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const total = count ?? 0;
  return {
    items: data ?? [],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getTenderById(id: string): Promise<Tender | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('tenders')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

export async function getRelevantTendersForUser(
  userId: string,
  preferences: UserPreferences,
  limit = 10
): Promise<ScoredTender[]> {
  const supabase = createServiceClient();

  // Get hidden tender IDs for this user
  const { data: hiddenActions } = await supabase
    .from('user_tender_actions')
    .select('tender_id')
    .eq('user_id', userId)
    .eq('action_type', 'hidden');

  const hiddenIds = (hiddenActions ?? []).map((a) => a.tender_id);

  // Fetch active tenders from last 30 days
  let query = supabase
    .from('tenders')
    .select('*')
    .eq('status', 'active')
    .gte('published_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('published_at', { ascending: false })
    .limit(100);

  if (hiddenIds.length > 0) {
    query = query.not('id', 'in', `(${hiddenIds.join(',')})`);
  }

  const { data: tenders, error } = await query;
  if (error || !tenders) return [];

  const scored = scoreTenders(tenders, preferences);
  return scored.slice(0, limit);
}

export async function upsertTender(tender: Omit<Tender, 'id' | 'created_at' | 'updated_at'>): Promise<Tender | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('tenders')
    .upsert(tender, { onConflict: 'external_id' })
    .select()
    .single();

  if (error) {
    logger.error('Failed to upsert tender', { error });
    return null;
  }

  return data;
}

export async function getMarketStats(category?: string): Promise<MarketStats> {
  const supabase = createServiceClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let baseQuery = supabase
    .from('tenders')
    .select('budget, category, region, published_at')
    .eq('status', 'active')
    .gte('published_at', thirtyDaysAgo);

  if (category) {
    baseQuery = baseQuery.eq('category', category);
  }

  const { data: tenders, error } = await baseQuery.order('published_at', { ascending: false });

  if (error || !tenders) {
    logger.error('getMarketStats query failed', { error });
    return {
      totalActive: 0, newThisWeek: 0, avgBudget: null, medianBudget: null, maxBudget: null,
      topCategories: [], topRegions: [],
      budgetRanges: { under1m: 0, from1to5m: 0, from5to20m: 0, over20m: 0 },
      fetchedAt: new Date().toISOString(),
    };
  }

  const withBudget = tenders.filter((t) => t.budget != null).map((t) => t.budget as number);
  const newThisWeek = tenders.filter((t) => t.published_at && t.published_at >= sevenDaysAgo).length;

  const avgBudget = withBudget.length > 0
    ? Math.round(withBudget.reduce((sum, b) => sum + b, 0) / withBudget.length)
    : null;

  const sorted = [...withBudget].sort((a, b) => a - b);
  const medianBudget = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : null;
  const maxBudget = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  // Budget ranges
  const budgetRanges = {
    under1m: withBudget.filter((b) => b < 1_000_000).length,
    from1to5m: withBudget.filter((b) => b >= 1_000_000 && b < 5_000_000).length,
    from5to20m: withBudget.filter((b) => b >= 5_000_000 && b < 20_000_000).length,
    over20m: withBudget.filter((b) => b >= 20_000_000).length,
  };

  // Top categories
  const categoryMap = new Map<string, { count: number; budgets: number[] }>();
  for (const t of tenders) {
    if (!t.category) continue;
    const existing = categoryMap.get(t.category) ?? { count: 0, budgets: [] };
    existing.count++;
    if (t.budget) existing.budgets.push(t.budget);
    categoryMap.set(t.category, existing);
  }
  const topCategories = Array.from(categoryMap.entries())
    .map(([name, { count, budgets }]) => ({
      name,
      count,
      avgBudget: budgets.length > 0 ? Math.round(budgets.reduce((s, b) => s + b, 0) / budgets.length) : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top regions
  const regionMap = new Map<string, number>();
  for (const t of tenders) {
    if (!t.region) continue;
    regionMap.set(t.region, (regionMap.get(t.region) ?? 0) + 1);
  }
  const topRegions = Array.from(regionMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalActive: tenders.length,
    newThisWeek,
    avgBudget,
    medianBudget,
    maxBudget,
    topCategories,
    topRegions,
    budgetRanges,
    fetchedAt: new Date().toISOString(),
  };
}

export async function getTenderStats(): Promise<{
  total: number;
  active: number;
  newToday: number;
}> {
  const supabase = createServiceClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [{ count: total }, { count: active }, { count: newToday }] = await Promise.all([
    supabase.from('tenders').select('*', { count: 'exact', head: true }),
    supabase.from('tenders').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase
      .from('tenders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString()),
  ]);

  return { total: total ?? 0, active: active ?? 0, newToday: newToday ?? 0 };
}
