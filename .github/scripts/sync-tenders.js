// GitHub Actions sync script: zakupki.gov.ru → Supabase
// Runs outside Vercel (no 10s timeout, different IP)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BASE_URL = 'https://zakupki.gov.ru';
const SEARCH_URL = `${BASE_URL}/epz/order/extendedsearch/results.json`;

const SEARCH_CATEGORIES = [
  'бетон', 'ракушечник', 'кирпич', 'цемент', 'щебень',
  'арматура', 'газобетон', 'песок', 'стройматериал',
  'асфальт', 'щебень', 'трубы пнд', 'металлочерепица',
];

const CATEGORY_KEYWORDS = [
  { keywords: ['бетон', 'железобетон', 'жб'], category: 'Бетон' },
  { keywords: ['ракушечник', 'ракушка'], category: 'Ракушечник' },
  { keywords: ['кирпич'], category: 'Кирпич' },
  { keywords: ['цемент'], category: 'Цемент' },
  { keywords: ['щебень', 'гравий'], category: 'Щебень' },
  { keywords: ['песок'], category: 'Песок' },
  { keywords: ['арматура'], category: 'Арматура' },
  { keywords: ['газобетон', 'газоблок', 'пеноблок'], category: 'Газобетон' },
  { keywords: ['плита', 'перекрытие', 'жби', 'фундамент'], category: 'ЖБИ' },
  { keywords: ['кровля', 'металлочерепица', 'профнастил'], category: 'Кровля' },
  { keywords: ['утеплитель', 'минвата', 'пенополистирол'], category: 'Утеплитель' },
  { keywords: ['асфальт'], category: 'Асфальт' },
  { keywords: ['труба', 'трубопровод'], category: 'Трубы' },
  { keywords: ['стройматериал'], category: 'Стройматериалы' },
];

function inferCategory(title) {
  const lower = title.toLowerCase();
  for (const { keywords, category } of CATEGORY_KEYWORDS) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return 'Стройматериалы';
}

function inferLawType(purchaseTypeName) {
  if (!purchaseTypeName) return 'other';
  const lower = purchaseTypeName.toLowerCase();
  if (lower.includes('44') || lower.includes('электронный аукцион')) return '44-FZ';
  if (lower.includes('223')) return '223-FZ';
  return 'other';
}

async function fetchCategory(category) {
  const publishedAfterDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const dateStr = publishedAfterDate.toISOString().split('T')[0].split('-').reverse().join('.');

  const url = new URL(SEARCH_URL);
  url.searchParams.set('searchString', category);
  url.searchParams.set('morphology', 'on');
  url.searchParams.set('pageNumber', '1');
  url.searchParams.set('recordsPerPage', '_50');
  url.searchParams.set('sortBy', 'UPDATE_DATE');
  url.searchParams.set('sortDirection', 'false');
  url.searchParams.set('fz44', 'on');
  url.searchParams.set('fz223', 'on');
  url.searchParams.set('af', 'on');
  url.searchParams.set('ca', 'on');
  url.searchParams.set('ga', 'on');
  url.searchParams.set('pc', 'on');
  url.searchParams.set('pa', 'on');
  url.searchParams.set('showLotsInfoHidden', 'false');
  url.searchParams.set('updateDateFrom', dateStr);

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://zakupki.gov.ru/epz/order/extendedsearch/search.html',
      'X-Requested-With': 'XMLHttpRequest',
      'Connection': 'keep-alive',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for category "${category}"`);
  }

  const data = await res.json();
  return data.lots ?? [];
}

function mapLot(lot) {
  const purchaseNumber = lot.purchaseNumber ?? lot.id;
  if (!purchaseNumber || !lot.subject) return null;

  const regionName = lot.lot?.regionNames?.[0] ?? null;
  const sourceUrl = lot.href
    ? (lot.href.startsWith('http') ? lot.href : `${BASE_URL}${lot.href}`)
    : null;

  return {
    external_id: `zakupki_${purchaseNumber}`,
    title: lot.subject,
    description: null,
    category: inferCategory(lot.subject),
    region: regionName,
    buyer_name: lot.customer?.fullName ?? null,
    law_type: inferLawType(lot.purchaseTypeName),
    budget: lot.initialSum ?? null,
    published_at: lot.publishDate ? new Date(lot.publishDate).toISOString() : new Date().toISOString(),
    deadline_at: lot.auctionDate ? new Date(lot.auctionDate).toISOString() : null,
    source_url: sourceUrl,
    docs_url: null,
    status: 'active',
    raw_payload: lot,
  };
}

async function upsertToSupabase(tenders) {
  if (tenders.length === 0) return 0;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/tenders`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(tenders),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Supabase upsert failed: ${res.status} ${error}`);
  }

  return tenders.length;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secrets');
    process.exit(1);
  }

  console.log(`🚀 Starting sync at ${new Date().toISOString()}`);
  console.log(`📡 Connecting to: ${SUPABASE_URL}`);

  let totalFetched = 0;
  let totalSaved = 0;
  const errors = [];

  for (const category of SEARCH_CATEGORIES) {
    try {
      console.log(`  🔍 Fetching: "${category}"`);
      const lots = await fetchCategory(category);
      console.log(`     → Got ${lots.length} lots`);

      const tenders = lots.map(mapLot).filter(Boolean);
      if (tenders.length > 0) {
        const saved = await upsertToSupabase(tenders);
        totalSaved += saved;
      }

      totalFetched += lots.length;

      // Polite delay between requests (1 second)
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      const msg = `${category}: ${err.message}`;
      errors.push(msg);
      console.error(`  ❌ ${msg}`);
    }
  }

  console.log(`\n✅ Sync complete:`);
  console.log(`   Fetched: ${totalFetched}`);
  console.log(`   Saved:   ${totalSaved}`);
  if (errors.length > 0) {
    console.log(`   Errors:  ${errors.length}`);
    errors.forEach(e => console.log(`     - ${e}`));
    // Exit with error only if ALL categories failed
    if (errors.length === SEARCH_CATEGORIES.length) {
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
