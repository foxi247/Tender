// Sync tenders from zakupki.gov.ru RSS feeds into Supabase
// Runs in GitHub Actions (Node.js) where zakupki.gov.ru is reachable

import { ProxyAgent, setGlobalDispatcher } from 'undici';

const HTTP_PROXY = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
if (HTTP_PROXY) {
  setGlobalDispatcher(new ProxyAgent(HTTP_PROXY));
  console.error(`Using proxy: ${HTTP_PROXY}`);
}

const BASE_URL = 'https://zakupki.gov.ru';
const RSS_URL = `${BASE_URL}/epz/order/extendedsearch/rss.xml`;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

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
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return 'Стройматериалы';
}

function getXmlField(xml, tag) {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const plainRe = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
  const m = cdataRe.exec(xml) || plainRe.exec(xml);
  return m ? m[1].trim() : null;
}

function getLinkFromItem(itemXml) {
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
    const numMatch = link.match(/regNumber=([^&\s]+)/);
    const purchaseNumber = numMatch ? numMatch[1] : null;
    items.push({ title, link, pubDate, description, purchaseNumber });
  }
  return items;
}

function parseDescriptionField(description, ...labels) {
  if (!description) return null;
  const clean = description.replace(/<[^>]+>/g, ' ');
  for (const label of labels) {
    const re = new RegExp(`${label}[:\\s]+([^\\n<]{2,80})`, 'i');
    const m = re.exec(clean);
    if (m) return m[1].trim();
  }
  return null;
}

function parseBudget(description) {
  if (!description) return null;
  const clean = description.replace(/<[^>]+>/g, ' ');
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
  const m = clean.match(/[Оо]кончани[ея][^:]*:\s*(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (m) {
    const [, d, mo, y, h = '00', min = '00'] = m;
    return new Date(`${y}-${mo}-${d}T${h}:${min}:00`).toISOString();
  }
  return null;
}

function parseLawType(description, link) {
  const text = ((description || '') + link).toLowerCase();
  if (text.includes('ea44') || text.includes('zk44') || text.includes('/44/')) return '44-FZ';
  if (text.includes('zk223') || text.includes('/223/')) return '223-FZ';
  return 'other';
}

function mapItem(item) {
  if (!item.purchaseNumber || !item.title) return null;
  return {
    external_id: `zakupki_${item.purchaseNumber}`,
    title: item.title,
    description: null,
    category: inferCategory(item.title),
    region: parseDescriptionField(item.description, 'Место доставки', 'Регион'),
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'ru-RU,ru;q=0.9',
        'Referer': 'https://zakupki.gov.ru/epz/order/extendedsearch/search.html',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseRSSItems(xml);
  } finally {
    clearTimeout(timeout);
  }
}

async function upsertTenders(tenders) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tenders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(tenders),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert failed ${res.status}: ${text}`);
  }
}

async function main() {
  const results = {};
  let totalFetched = 0;
  let totalSaved = 0;
  const errors = [];

  const categoryResults = await Promise.allSettled(
    SEARCH_CATEGORIES.map(async (category) => {
      const items = await fetchCategory(category);
      const tenders = items.map(mapItem).filter(Boolean);
      if (tenders.length > 0) {
        await upsertTenders(tenders);
      }
      return { category, fetched: items.length, saved: tenders.length };
    })
  );

  for (let i = 0; i < categoryResults.length; i++) {
    const result = categoryResults[i];
    const category = SEARCH_CATEGORIES[i];
    if (result.status === 'fulfilled') {
      const { fetched, saved } = result.value;
      totalFetched += fetched;
      totalSaved += saved;
      results[category] = { fetched, saved };
    } else {
      const msg = result.reason.message;
      errors.push(`${category}: ${msg}`);
      results[category] = { error: msg };
    }
  }

  const summary = { timestamp: new Date().toISOString(), totalFetched, totalSaved, errors, results };
  console.log(JSON.stringify(summary, null, 2));

  if (errors.length === SEARCH_CATEGORIES.length) {
    console.error('All categories failed');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
