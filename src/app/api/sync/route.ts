import { NextRequest, NextResponse } from 'next/server';
import { upsertTender } from '@/lib/tenders/service';
import { logger } from '@/lib/logger';
import { cookies } from 'next/headers';

const CRON_SECRET = process.env.CRON_SECRET;

// One category per call → fits in Vercel's 10s limit
// cron-job.org calls ?slot=0, ?slot=1 ... ?slot=12 every 30 min
const SEARCH_CATEGORIES = [
  'бетон', 'ракушечник', 'кирпич', 'цемент', 'щебень',
  'арматура', 'газобетон', 'песок', 'стройматериал',
  'асфальт', 'трубы пнд', 'металлочерепица', 'утеплитель',
];

const CATEGORY_MAP = [
  { keywords: ['бетон', 'железобетон', 'жб'], category: 'Бетон' },
  { keywords: ['ракушечник', 'ракушка'], category: 'Ракушечник' },
  { keywords: ['кирпич'], category: 'Кирпич' },
  { keywords: ['цемент'], category: 'Цемент' },
  { keywords: ['щебень', 'гравий'], category: 'Щебень' },
  { keywords: ['песок'], category: 'Песок' },
  { keywords: ['арматура'], category: 'Арматура' },
  { keywords: ['газобетон', 'газоблок', 'пеноблок'], category: 'Газобетон' },
  { keywords: ['кровля', 'металлочерепица', 'профнастил'], category: 'Кровля' },
  { keywords: ['утеплитель', 'минвата', 'пенополистирол'], category: 'Утеплитель' },
  { keywords: ['асфальт'], category: 'Асфальт' },
  { keywords: ['труба', 'трубопровод'], category: 'Трубы' },
  { keywords: ['стройматериал'], category: 'Стройматериалы' },
];

function inferCategory(title: string): string {
  const lower = title.toLowerCase();
  for (const { keywords, category } of CATEGORY_MAP) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return 'Стройматериалы';
}

function inferLawType(purchaseTypeName?: string): '44-FZ' | '223-FZ' | 'commercial' | 'other' {
  if (!purchaseTypeName) return 'other';
  const lower = purchaseTypeName.toLowerCase();
  if (lower.includes('44') || lower.includes('электронный аукцион')) return '44-FZ';
  if (lower.includes('223')) return '223-FZ';
  return 'other';
}

async function fetchLotsFromZakupki(keyword: string): Promise<Record<string, unknown>[]> {
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const dateStr = [
    String(since.getDate()).padStart(2, '0'),
    String(since.getMonth() + 1).padStart(2, '0'),
    since.getFullYear(),
  ].join('.');

  const url = new URL('https://zakupki.gov.ru/epz/order/extendedsearch/results.json');
  url.searchParams.set('searchString', keyword);
  url.searchParams.set('morphology', 'on');
  url.searchParams.set('pageNumber', '1');
  url.searchParams.set('recordsPerPage', '_50');
  url.searchParams.set('sortBy', 'UPDATE_DATE');
  url.searchParams.set('sortDirection', 'false');
  url.searchParams.set('fz44', 'on');
  url.searchParams.set('fz223', 'on');
  url.searchParams.set('af', 'on');
  url.searchParams.set('showLotsInfoHidden', 'false');
  url.searchParams.set('updateDateFrom', dateStr);

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/javascript, */*',
      'Accept-Language': 'ru-RU,ru;q=0.9',
      'Referer': 'https://zakupki.gov.ru/epz/order/extendedsearch/search.html',
      'X-Requested-With': 'XMLHttpRequest',
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`zakupki HTTP ${res.status}`);
  const data = await res.json() as { lots?: Record<string, unknown>[] };
  return data.lots ?? [];
}

async function runSync(slot: number): Promise<NextResponse> {
  const keyword = SEARCH_CATEGORIES[slot % SEARCH_CATEGORIES.length];
  const startedAt = Date.now();
  logger.info('Sync started', { slot, keyword });

  try {
    const lots = await fetchLotsFromZakupki(keyword);
    let saved = 0;

    for (const lot of lots) {
      const purchaseNumber = lot.purchaseNumber ?? lot.id;
      if (!purchaseNumber || !lot.subject) continue;

      const lotData = lot.lot as Record<string, unknown> | undefined;
      const customer = lot.customer as Record<string, unknown> | undefined;
      const regionNames = lotData?.regionNames as string[] | undefined;
      const href = lot.href as string | undefined;

      const ok = await upsertTender({
        external_id: `zakupki_${purchaseNumber}`,
        title: lot.subject as string,
        description: null,
        category: inferCategory(lot.subject as string),
        region: regionNames?.[0] ?? null,
        buyer_name: (customer?.fullName as string) ?? null,
        law_type: inferLawType(lot.purchaseTypeName as string | undefined),
        budget: (lot.initialSum as number) ?? null,
        published_at: lot.publishDate
          ? new Date(lot.publishDate as string).toISOString()
          : new Date().toISOString(),
        deadline_at: lot.auctionDate ? new Date(lot.auctionDate as string).toISOString() : null,
        source_url: href ? (href.startsWith('http') ? href : `https://zakupki.gov.ru${href}`) : null,
        docs_url: null,
        status: 'active',
        raw_payload: lot,
      });
      if (ok) saved++;
    }

    logger.info('Sync done', { slot, keyword, fetched: lots.length, saved, ms: Date.now() - startedAt });
    return NextResponse.json({ ok: true, slot, keyword, fetched: lots.length, saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Sync error', { slot, keyword, err });
    return NextResponse.json({ ok: false, slot, keyword, error: message }, { status: 500 });
  }
}

// Called by cron-job.org: GET /api/sync?slot=0 (no auth needed — URL is the secret)
// Called manually by admin panel (cookie auth)
export async function GET(req: NextRequest): Promise<NextResponse> {
  const slotParam = req.nextUrl.searchParams.get('slot');
  const secret = req.nextUrl.searchParams.get('secret');

  // Allow access with CRON_SECRET in query OR admin cookie
  if (CRON_SECRET && secret !== CRON_SECRET) {
    const cookieStore = await cookies();
    const isAdmin = cookieStore.get('admin_auth')?.value === 'true';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Auto-rotate slot based on time if not provided
  const slot = slotParam !== null
    ? parseInt(slotParam, 10)
    : Math.floor(Date.now() / (30 * 60 * 1000)) % SEARCH_CATEGORIES.length;

  return runSync(slot);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const slotParam = req.nextUrl.searchParams.get('slot');
  const slot = slotParam !== null
    ? parseInt(slotParam, 10)
    : Math.floor(Date.now() / (30 * 60 * 1000)) % SEARCH_CATEGORIES.length;
  return runSync(slot);
}
