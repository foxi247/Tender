// Supabase Edge Function: zakupki.gov.ru RSS → Supabase
// Runs on Deno Deploy (EU servers) — not blocked by zakupki.gov.ru

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

function inferCategory(title: string): string {
  const lower = title.toLowerCase();
  for (const { keywords, category } of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return 'Стройматериалы';
}

function getXmlField(xml: string, tag: string): string | null {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const plainRe = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
  const m = cdataRe.exec(xml) || plainRe.exec(xml);
  return m ? m[1].trim() : null;
}

function getLinkFromItem(itemXml: string): string | null {
  const plainRe = /<link>([^<]+)<\/link>/i;
  const hrefRe = /<link[^>]+href="([^"]+)"/i;
  const m = plainRe.exec(itemXml) || hrefRe.exec(itemXml);
  return m ? m[1].trim() : null;
}

function parseRSSItems(xml: string) {
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

function parseDescriptionField(description: string | null, ...labels: string[]): string | null {
  if (!description) return null;
  const clean = description.replace(/<[^>]+>/g, ' ');
  for (const label of labels) {
    const re = new RegExp(`${label}[:\\s]+([^\\n<]{2,80})`, 'i');
    const m = re.exec(clean);
    if (m) return m[1].trim();
  }
  return null;
}

function parseBudget(description: string | null): number | null {
  if (!description) return null;
  const clean = description.replace(/<[^>]+>/g, ' ');
  const m = clean.match(/[Нн]ачальн[а-я]+\s+(?:[а-яА-Я\s(]+)?\s*[\s:]+\s*([\d\s]+[,.]?\d*)\s*[Рр]уб/);
  if (m) {
    const num = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
    return isNaN(num) ? null : num;
  }
  return null;
}

function parseDeadline(description: string | null): string | null {
  if (!description) return null;
  const clean = description.replace(/<[^>]+>/g, ' ');
  const m = clean.match(/[Оо]кончани[ея][^:]*:\s*(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (m) {
    const [, d, mo, y, h = '00', min = '00'] = m;
    return new Date(`${y}-${mo}-${d}T${h}:${min}:00`).toISOString();
  }
  return null;
}

function parseLawType(description: string | null, link: string): string {
  const text = ((description || '') + link).toLowerCase();
  if (text.includes('ea44') || text.includes('zk44') || text.includes('/44/')) return '44-FZ';
  if (text.includes('zk223') || text.includes('/223/')) return '223-FZ';
  return 'other';
}

function mapItem(item: ReturnType<typeof parseRSSItems>[number]) {
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

async function fetchCategory(category: string) {
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
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const xml = await res.text();
  return parseRSSItems(xml);
}

Deno.serve(async (req: Request) => {
  // Only allow POST (or GET for manual test)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const results: Record<string, unknown> = {};
  let totalFetched = 0;
  let totalSaved = 0;
  const errors: string[] = [];

  const categoryResults = await Promise.allSettled(
    SEARCH_CATEGORIES.map(async (category) => {
      const items = await fetchCategory(category);
      const tenders = items.map(mapItem).filter(Boolean);

      if (tenders.length > 0) {
        const { error } = await supabase
          .from('tenders')
          .upsert(tenders, { onConflict: 'external_id' });

        if (error) throw new Error(`Supabase: ${error.message}`);
      }

      return { category, fetched: items.length, saved: tenders.length };
    })
  );

  for (const result of categoryResults) {
    if (result.status === 'fulfilled') {
      const { category, fetched, saved } = result.value;
      totalFetched += fetched;
      totalSaved += saved;
      results[category] = { fetched, saved };
    } else {
      const msg = (result.reason as Error).message;
      const category = SEARCH_CATEGORIES[categoryResults.indexOf(result)];
      errors.push(`${category}: ${msg}`);
      results[category] = { error: msg };
    }
  }

  const summary = {
    timestamp: new Date().toISOString(),
    totalFetched,
    totalSaved,
    errors,
    results,
  };

  console.log(JSON.stringify(summary));

  const status = errors.length === SEARCH_CATEGORIES.length ? 500 : 200;
  return new Response(JSON.stringify(summary), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
});
