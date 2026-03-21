import { createServiceClient } from '@/lib/supabase/server';
import type { User, UserPreferences } from '@/types';
import { logger } from '@/lib/logger';

export async function upsertUser(data: {
  telegram_id: string;
  username?: string;
  full_name?: string;
}): Promise<User | null> {
  const supabase = createServiceClient();

  const { data: user, error } = await supabase
    .from('users')
    .upsert(
      {
        telegram_id: data.telegram_id,
        username: data.username ?? null,
        full_name: data.full_name ?? null,
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'telegram_id' }
    )
    .select()
    .single();

  if (error) {
    logger.error('Failed to upsert user', { error, data });
    return null;
  }

  // Create default preferences if not exist
  await ensureDefaultPreferences(user.id);

  return user;
}

export async function getUserByTelegramId(telegramId: string): Promise<User | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (error) return null;
  return data;
}

export async function getAllUsers(opts?: { activeOnly?: boolean }): Promise<User[]> {
  const supabase = createServiceClient();

  let query = supabase.from('users').select('*').order('created_at', { ascending: false });

  if (opts?.activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) {
    logger.error('Failed to get users', { error });
    return [];
  }

  return data ?? [];
}

export async function getUserWithPreferences(
  telegramId: string
): Promise<{ user: User; preferences: UserPreferences } | null> {
  const user = await getUserByTelegramId(telegramId);
  if (!user) return null;

  const preferences = await getUserPreferences(user.id);
  return { user, preferences: preferences! };
}

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) return null;
  return data;
}

export async function updateUserPreferences(
  userId: string,
  updates: Partial<UserPreferences>
): Promise<UserPreferences | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('user_preferences')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update preferences', { error });
    return null;
  }

  return data;
}

async function ensureDefaultPreferences(userId: string): Promise<void> {
  const supabase = createServiceClient();

  await supabase.from('user_preferences').upsert(
    {
      user_id: userId,
      categories: [],
      regions: [],
      keywords: [],
      excluded_keywords: [],
      preferred_laws: [],
    },
    { onConflict: 'user_id', ignoreDuplicates: true }
  );
}

export async function updateUserActivity(telegramId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('telegram_id', telegramId);
}

export async function getUserStats(): Promise<{
  total: number;
  active: number;
  newToday: number;
}> {
  const supabase = createServiceClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [{ count: total }, { count: active }, { count: newToday }] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString()),
  ]);

  return { total: total ?? 0, active: active ?? 0, newToday: newToday ?? 0 };
}
