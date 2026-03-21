import { createServiceClient } from '@/lib/supabase/server';
import type { Tender, TenderSearchParams, PaginatedResponse, UserPreferences, ScoredTender } from '@/types';
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

  // Fetch active tenders from last 7 days
  let query = supabase
    .from('tenders')
    .select('*')
    .eq('status', 'active')
    .gte('published_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
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
