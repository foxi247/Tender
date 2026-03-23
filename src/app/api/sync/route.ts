import { NextRequest, NextResponse } from 'next/server';
import { upsertTender } from '@/lib/tenders/service';
import { ZakupkiGovSource } from '@/lib/tenders/sources/zakupki';
import { syncAllPlatforms } from '@/lib/tenders/sources/rss-platforms';
import { logger } from '@/lib/logger';
import { cookies } from 'next/headers';

const CRON_SECRET = process.env.CRON_SECRET;

// All 25 bico category RSS feeds — each returns up to 100 active tenders
const BICO_RSS_FEEDS = [
  'https://bicotender.ru/rss',
  'https://bicotender.ru/rss?field=stroitelstvo-nedvizhimost-i-arhitektura',
  'https://bicotender.ru/rss?field=metally-metalloizdeliya',
  'https://bicotender.ru/rss?field=mashinostroenie',
  'https://bicotender.ru/rss?field=elektrotehnika',
  'https://bicotender.ru/rss?field=toplivo-i-energetika',
  'https://bicotender.ru/rss?field=himiya',
  'https://bicotender.ru/rss?field=syrye-polufabrikaty',
  'https://bicotender.ru/rss?field=prodovolstvie-pischevaya-promyshlennost',
  'https://bicotender.ru/rss?field=selskoe-hozyaystvo',
  'https://bicotender.ru/rss?field=legkaya-promyshlennost',
  'https://bicotender.ru/rss?field=derevoobrabotka-les',
  'https://bicotender.ru/rss?field=transport',
  'https://bicotender.ru/rss?field=perevozki-logistika-tamozhnya',
  'https://bicotender.ru/rss?field=medicina-farmakologiya',
  'https://bicotender.ru/rss?field=it-kompyutery-svyaz',
  'https://bicotender.ru/rss?field=bezopasnost',
  'https://bicotender.ru/rss?field=ofis-dom',
  'https://bicotender.ru/rss?field=bumazhnoe-proizvodstvo-tara-i-upakovka',
  'https://bicotender.ru/rss?field=nauka-issledovaniya-obrazovanie',
  'https://bicotender.ru/rss?field=socialnye-uslugi',
  'https://bicotender.ru/rss?field=sport-otdyh-turizm',
  'https://bicotender.ru/rss?field=ekologiya',
  'https://bicotender.ru/rss?field=izdatelstvo-poligrafiya',
  'https://bicotender.ru/rss?field=biznes-finansy-strahovanie-marketing-i-reklama',
  'https://bicotender.ru/rss?field=drugoe',
];

// Maps bico hierarchical category paths → our standardized category names.
const BICO_CATEGORY_RULES: Array<{ match: string; cat: string }> = [
  // Construction
  { match: 'строительные материалы',          cat: 'Стройматериалы' },
  { match: 'ремонтные и строительные',        cat: 'Стройматериалы' },
  { match: 'дороги, мосты',                   cat: 'Асфальт' },
  { match: 'полы, окна и двери',              cat: 'Окна ПВХ' },
  { match: 'строительство, недвижимость',     cat: 'Стройматериалы' },
  { match: 'подготовка строительного',        cat: 'Стройматериалы' },
  // Metals
  { match: 'металлы, металлоизделия',         cat: 'Металлопрокат' },
  { match: 'трубы и арматура',                cat: 'Арматура' },
  { match: 'крепёжные изделия',               cat: 'Крепёж' },
  // Electrical
  { match: 'электротехника',                  cat: 'Электрика' },
  { match: 'кабел',                           cat: 'Кабель' },
  // Raw materials
  { match: 'сырьё',                           cat: 'Сырьё' },
  { match: 'сырье',                           cat: 'Сырьё' },
  { match: 'химия',                           cat: 'Химия' },
  { match: 'нефтепродукты',                   cat: 'Битум' },
  // Fuel
  { match: 'топливо',                         cat: 'Топливо' },
  { match: 'уголь',                           cat: 'Топливо' },
  // Agriculture
  { match: 'сельское хозяйство',              cat: 'Сельское хозяйство' },
  { match: 'продовольствие',                  cat: 'Продовольствие' },
  { match: 'пищевая промышленность',          cat: 'Продовольствие' },
  { match: 'корм',                            cat: 'Сельское хозяйство' },
  // Machinery / Transport
  { match: 'машиностроение',                  cat: 'Оборудование' },
  { match: 'транспорт',                       cat: 'Транспорт' },
  { match: 'перевозки',                       cat: 'Транспорт' },
  // Wood / Paper
  { match: 'деревообработка',                 cat: 'Пиломатериалы' },
  { match: 'лес',                             cat: 'Пиломатериалы' },
  { match: 'бумажное производство',           cat: 'Бумага' },
  // Textiles
  { match: 'лёгкая промышленность',           cat: 'Текстиль' },
  { match: 'легкая промышленность',           cat: 'Текстиль' },
  // IT & Services
  { match: 'it, компьютеры',                  cat: 'IT' },
  { match: 'медицина',                        cat: 'Медицина' },
  { match: 'безопасность',                    cat: 'Безопасность' },
  { match: 'наука',                           cat: 'Образование' },
  { match: 'образование',                     cat: 'Образование' },
  { match: 'социальные услуги',               cat: 'Социальные услуги' },
  { match: 'офис',                            cat: 'Офис' },
  { match: 'спорт',                           cat: 'Спорт' },
  { match: 'экология',                        cat: 'Экология' },
  { match: 'бизнес',                          cat: 'Услуги' },
];

const CATEGORY_MAP: Array<{ kw: string[]; cat: string }> = [
  { kw: ['бетон', 'железобетон', 'жби'], cat: 'Бетон' },
  { kw: ['ракушечник', 'ракушняк'], cat: 'Ракушечник' },
  { kw: ['ракушка кормовая', 'кормовая ракушка', 'ракушка дробленая'], cat: 'Ракушка кормовая' },
  { kw: ['ракушка'], cat: 'Ракушечник' },
  { kw: ['кирпич'], cat: 'Кирпич' },
  { kw: ['цемент'], cat: 'Цемент' },
  { kw: ['щебень', 'гравий'], cat: 'Щебень' },
  { kw: ['арматура'], cat: 'Арматура' },
  { kw: ['газобетон', 'газоблок', 'пеноблок'], cat: 'Газобетон' },
  { kw: ['песок'], cat: 'Песок' },
  { kw: ['металлочерепица', 'профнастил'], cat: 'Кровля' },
  { kw: ['утеплитель', 'минвата'], cat: 'Утеплитель' },
  { kw: ['асфальт'], cat: 'Асфальт' },
  { kw: ['труб'], cat: 'Трубы' },
];

/**
 * Infer category:
 * 1. Title keyword match (CATEGORY_MAP) — most specific
 * 2. Bico hierarchical category path match (BICO_CATEGORY_RULES)
 * 3. Use subcategory part of bico path as-is
 * 4. 'Прочее'
 */
function inferCategory(title: string, rssCategory: string | null): string {
  const lower = title.toLowerCase();
  for (const { kw, cat } of CATEGORY_MAP) {
    if (kw.some(k => lower.includes(k))) return cat;
  }
  if (rssCategory) {
    const catLower = rssCategory.toLowerCase();
    for (const { match, cat } of BICO_CATEGORY_RULES) {
      if (catLower.includes(match)) return cat;
    }
    // Use subcategory (part after "/") as-is if present
    const parts = rssCategory.split('/').map((p: string) => p.trim()).filter(Boolean);
    const sub = parts[parts.length - 1];
    if (sub && sub.length >= 3 && sub.length <= 100) return sub;
  }
  return 'Прочее';
}

function getXmlField(xml: string, tag: string): string | null {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const plain = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
  const m = cdata.exec(xml) || plain.exec(xml);
  return m ? m[1].trim() : null;
}

function parseBudget(description: string | null): number | null {
  const clean = (description || '').replace(/&lt;[^&]*&gt;/g, ' ').replace(/<[^>]+>/g, ' ');
  const m = clean.match(/Цена:\s*([\d\s]+[,.]?\d*)/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
  return isNaN(num) || num === 0 ? null : num;
}

function parseDeadline(description: string | null): string | null {
  const clean = (description || '').replace(/&lt;[^&]*&gt;/g, ' ').replace(/<[^>]+>/g, ' ');
  const m = clean.match(/Окончание:\s*(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})/i);
  if (!m) return null;
  try { return new Date(m[1]).toISOString(); } catch { return null; }
}

function parseRegion(description: string | null): string | null {
  const clean = (description || '').replace(/&lt;[^&]*&gt;/g, ' ').replace(/<[^>]+>/g, ' ');
  const m = clean.match(/Регион:\s*([^\n<]+)/i);
  if (!m) return null;
  let raw = m[1];
  // Cut off at the next field (Цена:, Начало:, Окончание:, Тип:)
  const cutIdx = raw.search(/\s+(?:Цена|Начало|Окончание|Тип):/i);
  if (cutIdx > 0) raw = raw.slice(0, cutIdx);
  const parts = raw.split('/').map((s: string) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] || parts[0] || null;
}

function parseLawType(description: string | null): '44-FZ' | '223-FZ' | 'other' {
  const clean = (description || '').replace(/<[^>]+>/g, ' ');
  const type = clean.match(/Тип:\s*([^\n<&]+)/i)?.[1]?.toLowerCase() || '';
  if (type.includes('аукцион') || type.includes('44')) return '44-FZ';
  if (type.includes('223')) return '223-FZ';
  return 'other';
}

interface RSSItem {
  title: string;
  link: string | null;
  description: string | null;
  category: string | null;
  pubDate: string | null;
}

function parseRSS(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const raw = m[1];
    const title = getXmlField(raw, 'title');
    const link = getXmlField(raw, 'link') || raw.match(/<link>([^<]+)<\/link>/)?.[1]?.trim() || null;
    const description = getXmlField(raw, 'description');
    const category = getXmlField(raw, 'category');
    const pubDate = getXmlField(raw, 'pubDate');
    if (!title) continue;
    items.push({ title, link, description, category, pubDate });
  }
  return items;
}

async function fetchAndSaveFeed(url: string): Promise<{ fetched: number; saved: number }> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  const items = parseRSS(xml);

  let saved = 0;
  for (const item of items) {
    const idMatch = item.link?.match(/tender(\d+)/);
    const bicotenderId = idMatch?.[1];
    if (!bicotenderId) continue;

    const ok = await upsertTender({
      external_id: `bicotender_${bicotenderId}`,
      source: 'bicotender',
      title: item.title,
      description: null,
      category: inferCategory(item.title, item.category),
      region: parseRegion(item.description),
      buyer_name: null,
      law_type: parseLawType(item.description),
      budget: parseBudget(item.description),
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      deadline_at: parseDeadline(item.description),
      source_url: item.link,
      docs_url: null,
      status: 'active',
      raw_payload: item as unknown as Record<string, unknown>,
    });
    if (ok) saved++;
  }
  return { fetched: items.length, saved };
}

async function runSync(): Promise<NextResponse> {
  const startedAt = Date.now();
  logger.info('Sync started — fetching all 26 bico category feeds');

  // Fetch all bico category feeds in parallel (groups of 5 to avoid rate limits)
  let totalFetched = 0;
  let totalSaved = 0;
  const feedResults: Record<string, number> = {};

  for (let i = 0; i < BICO_RSS_FEEDS.length; i += 5) {
    const batch = BICO_RSS_FEEDS.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(url => fetchAndSaveFeed(url))
    );
    results.forEach((result, idx) => {
      const url = batch[idx];
      const label = url.split('field=')[1] ?? 'main';
      if (result.status === 'fulfilled') {
        totalFetched += result.value.fetched;
        totalSaved += result.value.saved;
        feedResults[label] = result.value.saved;
      } else {
        logger.warn(`Feed failed: ${url}`, { err: result.reason?.message });
        feedResults[label] = -1;
      }
    });
  }

  logger.info('Bico sync done', { totalFetched, totalSaved, feeds: Object.keys(feedResults).length });

  // Sync from Zakupki.gov.ru
  let zakupkiSaved = 0;
  try {
    const zakupki = new ZakupkiGovSource();
    const zakupkiTenders = await zakupki.fetchTenders({
      publishedAfter: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // last 3 days
      limit: 50,
    });

    for (const tender of zakupkiTenders) {
      const ok = await upsertTender({ ...tender, source: 'zakupki' });
      if (ok) zakupkiSaved++;
    }
    logger.info('Zakupki sync done', { fetched: zakupkiTenders.length, saved: zakupkiSaved });
  } catch (err) {
    logger.warn('Zakupki sync failed (non-fatal)', { err: err instanceof Error ? err.message : String(err) });
  }

  // Sync from additional RSS platforms (fault-tolerant)
  let platformResults: Record<string, { fetched: number; saved: number }> = {};
  try {
    platformResults = await syncAllPlatforms();
  } catch (err) {
    logger.warn('Platform RSS sync failed (non-fatal)', { err: err instanceof Error ? err.message : String(err) });
  }

  logger.info('Sync done', { bico: { fetched: totalFetched, saved: totalSaved }, zakupkiSaved, platforms: platformResults, ms: Date.now() - startedAt });
  return NextResponse.json({ ok: true, bico: { fetched: totalFetched, saved: totalSaved }, zakupkiSaved, platforms: platformResults });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.nextUrl.searchParams.get('secret');

  if (CRON_SECRET && secret !== CRON_SECRET) {
    const cookieStore = await cookies();
    const isAdmin = cookieStore.get('admin_auth')?.value === 'true';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    return await runSync();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Sync error', { err });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return await runSync();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Sync error', { err });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
