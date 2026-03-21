import { createServiceClient } from '@/lib/supabase/server';
import { getAllUsers } from '@/lib/users/service';
import { getUserPreferences, getUserByTelegramId } from '@/lib/users/service';
import { getRelevantTendersForUser } from '@/lib/tenders/service';
import { sendDigestToUser } from '@/lib/telegram/bot';
import { getAIProvider } from '@/lib/ai/provider';
import { logger } from '@/lib/logger';
import type { DigestPayload, ScoredTender } from '@/types';

export async function runDailyDigest(): Promise<{ sent: number; failed: number; skipped: number }> {
  const users = await getAllUsers({ activeOnly: true });
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  logger.info(`Starting daily digest for ${users.length} users`);

  for (const user of users) {
    try {
      const result = await sendDigestToSingleUser(user.id, user.telegram_id);
      if (result === 'sent') sent++;
      else if (result === 'skipped') skipped++;
      else failed++;

      // Rate limit: 30 msg/sec Telegram limit
      await new Promise((r) => setTimeout(r, 50));
    } catch (err) {
      logger.error(`Digest failed for user ${user.id}`, { err });
      failed++;
      await recordDigest(user.id, 0, {}, 'failed', String(err));
    }
  }

  logger.info(`Digest complete: sent=${sent}, failed=${failed}, skipped=${skipped}`);
  return { sent, failed, skipped };
}

async function sendDigestToSingleUser(
  userId: string,
  telegramId: string
): Promise<'sent' | 'failed' | 'skipped'> {
  const preferences = await getUserPreferences(userId);
  if (!preferences) return 'skipped';

  const tenders = await getRelevantTendersForUser(userId, preferences, 5);
  if (tenders.length === 0) {
    await recordDigest(userId, 0, {}, 'skipped', 'No relevant tenders');
    return 'skipped';
  }

  // Enrich with AI summaries
  const ai = await getAIProvider();
  const enrichedTenders: ScoredTender[] = await Promise.all(
    tenders.map(async (t) => {
      try {
        const [summary, whyRec] = await Promise.all([
          ai.summarizeTender(t),
          ai.explainWhyRecommended(t, preferences),
        ]);
        return { ...t, ai_summary: summary, ai_why_recommended: whyRec };
      } catch {
        return t;
      }
    })
  );

  const payload: DigestPayload = {
    tenders: enrichedTenders,
    summary: `Найдено ${tenders.length} релевантных тендеров`,
    total_found: tenders.length,
    sent_at: new Date().toISOString(),
  };

  // Send via Telegram
  const success = await sendDigestToUser(telegramId, enrichedTenders);

  if (success) {
    await recordDigest(userId, tenders.length, payload as unknown as Record<string, unknown>, 'sent');
    return 'sent';
  } else {
    await recordDigest(userId, 0, {}, 'failed', 'Telegram send error');
    return 'failed';
  }
}

async function recordDigest(
  userId: string,
  tendersCount: number,
  payload: Record<string, unknown>,
  status: 'sent' | 'failed' | 'skipped',
  errorMessage?: string
): Promise<void> {
  const supabase = createServiceClient();

  await supabase.from('daily_digests').insert({
    user_id: userId,
    tenders_count: tendersCount,
    payload,
    status,
    error_message: errorMessage ?? null,
  });
}

export async function getDigestLogs(limit = 50) {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('daily_digests')
    .select('*, user:users(telegram_id, full_name, username)')
    .order('sent_at', { ascending: false })
    .limit(limit);

  return data ?? [];
}
