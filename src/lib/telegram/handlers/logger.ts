import { createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function logBotEvent(
  userId: string | null,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('bot_logs').insert({
      user_id: userId,
      event_type: eventType,
      payload,
    });
  } catch (err) {
    logger.error('Failed to log bot event', { err, eventType });
  }
}
