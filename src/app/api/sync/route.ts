import { NextRequest, NextResponse } from 'next/server';
import { getTenderSource } from '@/lib/tenders/sources/provider';
import { upsertTender } from '@/lib/tenders/service';
import { logger } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET;

// Categories to search across
const SEARCH_CATEGORIES = [
  'бетон', 'ракушечник', 'кирпич', 'цемент', 'щебень',
  'арматура', 'газобетон', 'песок', 'стройматериал',
];

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runSync();
}

// GET for manual trigger from admin or cron
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runSync();
}

async function runSync(): Promise<NextResponse> {
  const startedAt = Date.now();
  logger.info('Sync started');

  const source = getTenderSource();
  const publishedAfter = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // last 3 days

  let totalFetched = 0;
  let totalSaved = 0;
  const errors: string[] = [];

  for (const category of SEARCH_CATEGORIES) {
    try {
      const tenders = await source.fetchTenders({ category, publishedAfter, limit: 20 });
      totalFetched += tenders.length;

      for (const tender of tenders) {
        const saved = await upsertTender({
          external_id: tender.external_id,
          title: tender.title,
          description: tender.description,
          category: tender.category,
          region: tender.region,
          buyer_name: tender.buyer_name,
          law_type: tender.law_type,
          budget: tender.budget,
          published_at: tender.published_at,
          deadline_at: tender.deadline_at,
          source_url: tender.source_url,
          docs_url: tender.docs_url,
          status: tender.status,
          raw_payload: tender.raw_payload,
        });

        if (saved) totalSaved++;
      }

      // Polite delay between category requests
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${category}: ${msg}`);
      logger.error('Sync error for category', { category, err });
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.info('Sync completed', { totalFetched, totalSaved, durationMs, errors: errors.length });

  return NextResponse.json({
    ok: true,
    totalFetched,
    totalSaved,
    durationMs,
    errors: errors.length > 0 ? errors : undefined,
  });
}
