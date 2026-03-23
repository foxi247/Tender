import { NextRequest, NextResponse } from 'next/server';
import { upsertTender } from '@/lib/tenders/service';
import { ZakupkiGovSource } from '@/lib/tenders/sources/zakupki';
import { syncAllPlatforms } from '@/lib/tenders/sources/rss-platforms';
import { logger } from '@/lib/logger';
import { cookies } from 'next/headers';

const CRON_SECRET = process.env.CRON_SECRET;
const RSS_URL = 'https://bicotender.ru/rss';

const CONSTRUCTION_KEYWORDS = [
  'бетон', 'железобетон', 'жби',
  'ракушечник', 'ракушка', 'ракушняк', 'кормовая ракушка', 'ракушка кормовая',
  'кирпич',
  'цемент',
  'щебень', 'гравий',
  'арматура',
  'газобетон', 'газоблок', 'пеноблок',
  'песок строительный', 'речной песок', 'карьерный песок', 'намывной песок',
  'стройматериал',
  'асфальт', 'асфальтобетон',
  'труб пнд', 'труб пвх', 'трубопровод',
  'металлочерепица',
  'профнастил',
  'утеплитель', 'минвата', 'базальтов',
  'блок фундаментный', 'плита перекрытия', 'фундаментный блок',
  'кровельн',
  'гипсокартон',
  'пиломатериал',
  'керамогранит',
  'геотекстиль',
  'известь', 'известняк',
  'мел кормовой',
  'соль техническая',
];

const CONSTRUCTION_CATEGORIES = [
  'строительные материалы',
  'строительство',
  'дороги, мосты',
  'ремонтные и строительные',
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

function isRelevant(title: string, category: string | null): boolean {
  const t = title.toLowerCase();
  const c = (category || '').toLowerCase();
  return CONSTRUCTION_KEYWORDS.some(kw => t.includes(kw))
    || CONSTRUCTION_CATEGORIES.some(kw => c.includes(kw));
}

function inferCategory(title: string): string {
  const lower = title.toLowerCase();
  for (const { kw, cat } of CATEGORY_MAP) {
    if (kw.some(k => lower.includes(k))) return cat;
  }
  return 'Стройматериалы';
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

async function runSync(): Promise<NextResponse> {
  const startedAt = Date.now();
  logger.info('Sync started from bicotender.ru RSS');

  const res = await fetch(RSS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`bicotender RSS HTTP ${res.status}`);
  const xml = await res.text();

  const items = parseRSS(xml);
  const relevant = items.filter(i => isRelevant(i.title, i.category));

  let saved = 0;
  for (const item of relevant) {
    const idMatch = item.link?.match(/tender(\d+)/);
    const bicotenderId = idMatch?.[1];
    if (!bicotenderId) continue;

    const ok = await upsertTender({
      external_id: `bicotender_${bicotenderId}`,
      source: 'bicotender',
      title: item.title,
      description: null,
      category: inferCategory(item.title),
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

  logger.info('Sync done', { fetched: items.length, matched: relevant.length, saved, zakupkiSaved, platforms: platformResults, ms: Date.now() - startedAt });
  return NextResponse.json({ ok: true, fetched: items.length, matched: relevant.length, saved, zakupkiSaved, platforms: platformResults });
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
