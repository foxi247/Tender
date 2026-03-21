import { createServiceClient } from '@/lib/supabase/server';
import type { ActionType, UserTenderAction } from '@/types';
import { logger } from '@/lib/logger';

export async function toggleTenderAction(
  userId: string,
  tenderId: string,
  actionType: ActionType
): Promise<{ added: boolean }> {
  const supabase = createServiceClient();

  // Check if action exists
  const { data: existing } = await supabase
    .from('user_tender_actions')
    .select('id')
    .eq('user_id', userId)
    .eq('tender_id', tenderId)
    .eq('action_type', actionType)
    .single();

  if (existing) {
    // Remove action (toggle off)
    await supabase
      .from('user_tender_actions')
      .delete()
      .eq('id', existing.id);
    return { added: false };
  } else {
    // Add action
    const { error } = await supabase.from('user_tender_actions').insert({
      user_id: userId,
      tender_id: tenderId,
      action_type: actionType,
    });

    if (error) {
      logger.error('Failed to add tender action', { error });
    }
    return { added: true };
  }
}

export async function addTenderAction(
  userId: string,
  tenderId: string,
  actionType: ActionType
): Promise<void> {
  const supabase = createServiceClient();

  await supabase
    .from('user_tender_actions')
    .upsert(
      { user_id: userId, tender_id: tenderId, action_type: actionType },
      { onConflict: 'user_id,tender_id,action_type', ignoreDuplicates: true }
    );
}

export async function getUserActions(
  userId: string,
  actionType: ActionType
): Promise<UserTenderAction[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('user_tender_actions')
    .select('*, tender:tenders(*)')
    .eq('user_id', userId)
    .eq('action_type', actionType)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to get user actions', { error });
    return [];
  }

  return data ?? [];
}

export async function getUserActionIds(
  userId: string,
  actionType: ActionType
): Promise<string[]> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('user_tender_actions')
    .select('tender_id')
    .eq('user_id', userId)
    .eq('action_type', actionType);

  return (data ?? []).map((a) => a.tender_id);
}

export async function getAllActionsForUser(userId: string): Promise<UserTenderAction[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('user_tender_actions')
    .select('*, tender:tenders(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data ?? [];
}
