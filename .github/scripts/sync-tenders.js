// GitHub Actions sync script: zakupki.gov.ru RSS → Supabase
// Uses RSS feed instead of JSON API (better availability from foreign IPs)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BASE_URL = 'https://zakupki.gov.ru';
const RSS_URL = `${BASE_URL}/epz/order/extendedsearch/rss.xml`;

const SEARCH_CATEGORIES = [
  'бетон', 'ракушечник', 'кирпич', 'цемент', 'щебень',
  'арматура', 'газобетон', 'песок', 'стройматериал',
  'асфальт', 'трубы пнд', 'металлочерепица',
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

// Simple RSS/XML parser without external dependencies
function getXmlField(xml, tag) {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const plainRe = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
  const m = cdataRe.exec(xml) || plainRe.exec(xml);
  return m ? m[1].trim() : null;
}

function getLinkFromItem(itemXml) {
  // <link> in RSS 2.0 can be tricky — try plain text first, then href attribute
  const plainRe = /<link>([^<]+)<\/link>/i;
  const hrefRe = /<link[^>]+href="([^"]+)"/i;
  const m = plainRe.exec(itemXml) || hrefRe.exec(itemXml);
  return m ? m[1].trim() : null;
}

function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = getXmlField(itemXml, 'title');
    const link = getLinkFromItem(itemXml) || getXmlField(itemXml, 'link');
    const pubDate = getXmlField(itemXml, 'pubDate');
    const description = getXmlField(itemXml, 'description');

    if (!title || !link) continue;

    // Extract purchase number from URL: regNumber=0123456789012345678
    const numMatch = link.match(/regNumber=([^&\s]+)/);
    const purchaseNumber = numMatch ? numMatch[1] : null;

    items.push({ title, link, pubDate, description, purchaseNumber });
  }

  return items;
}

function parseDescriptionField(description, ...labels) {
  if (!description) return null;
  for (const label of labels) {
    // Strip HTML tags and look for label: value pattern
    const clean = description.replace(/<[^>]+>/g, ' ');
    const re = new RegExp(`${label}[:\\s]+([^\\n<]+)`, 'i');
    const m = re.exec(clean);
    if (m) return m[1].trim();
  }
  return null;
}

function parseBudget(description) {
  if (!description) return null;
  const clean = description.replace(/<[^>]+>/g, ' ');
  // Match "1 234 567,89 Руб" or "1234567.89"
  const m = clean.match(/[Нн]ачальн[а-я]+\s+(?:[а-яА-Я\s(]+)?\s*[\s:]+\s*([\d\s]+[,.]?\d*)\s*[Рр]уб/);
  if (m) {
    const num = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
    return isNaN(num) ? null : num;
  }
  return null;
}

function parseDeadline(description) {
  if (!description) return null;
  const clean = description.replace(/<[^>]+>/g, ' ');
  // Look for "Окончание подачи заявок: 15.01.2026 10:00"
  const m = clean.match(/[Оо]кончани[ея][^:]*:\s*(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (m) {
    const [, d, mo, y, h = '00', min = '00'] = m;
    return new Date(`${y}-${mo}-${d}T${h}:${min}:00`).toISOString();
  }
  return null;
}

function parseRegion(description) {
  if (!description) return null;
  const clean = description.replace(/<[^>]+>/g, ' ');
  const m = clean.match(/[Мм]есто[^:]*:\s*([^\n,]+)/);
  return m ? m[1].trim() : null;
}

function parseLawType(description, link) {
  const text = ((description || '') + (link || '')).toLowerCase();
  if (text.includes('ea44') || text.includes('zk44') || text.includes('44')) return '44-FZ';
  if (text.includes('zk223') || text.includes('223')) return '223-FZ';
  return 'other';
}

function mapItem(item) {
  if (!item.purchaseNumber || !item.title) return null;

  return {
    external_id: `zakupki_${item.purchaseNumber}`,
    title: item.title,
    description: null,
    category: inferCategory(item.title),
    region: parseRegion(item.description),
    buyer_name: parseDescriptionField(item.description, 'Заказчик', 'Организация'),
    law_type: parseLawType(item.description, item.link),
    budget: parseBudget(item.description),
    published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    deadline_at: parseDeadline(item.description),
    source_url: item.link,
    docs_url: null,
    status: 'active',
    raw_payload: {
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      purchaseNumber: item.purchaseNumber,
    },
  };
}

async function fetchCategory(category) {
  const publishedAfterDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const dateStr = publishedAfterDate.toISOString().split('T')[0].split('-').reverse().join('.');

  const url = new URL(RSS_URL);
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
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      'Accept-Language': 'ru-RU,ru;q=0.9',
      'Referer': 'https://zakupki.gov.ru/epz/order/extendedsearch/search.html',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for category "${category}"`);
  }

  const xml = await res.text();
  console.log(`     → Response size: ${xml.length} bytes`);

  return parseRSSItems(xml);
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

  console.log(`🚀 Starting RSS sync at ${new Date().toISOString()}`);
  console.log(`📡 Supabase: ${SUPABASE_URL}`);
  console.log(`📰 Source: ${RSS_URL}`);

  let totalFetched = 0;
  let totalSaved = 0;
  const errors = [];

  for (const category of SEARCH_CATEGORIES) {
    try {
      console.log(`  🔍 Fetching RSS: "${category}"`);
      const items = await fetchCategory(category);
      console.log(`     → Parsed ${items.length} items`);

      const tenders = items.map(mapItem).filter(Boolean);
      console.log(`     → Mapped ${tenders.length} tenders`);

      if (tenders.length > 0) {
        const saved = await upsertToSupabase(tenders);
        totalSaved += saved;
      }

      totalFetched += items.length;

      // Polite delay between requests
      await new Promise(r => setTimeout(r, 1500));
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
    if (errors.length === SEARCH_CATEGORIES.length) {
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
