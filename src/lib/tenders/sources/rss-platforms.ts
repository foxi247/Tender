/**
 * RSS-based sync for additional tender platforms.
 * Each platform has a public RSS feed for construction-related tenders.
 */

import { logger } from '@/lib/logger';
import { upsertTender } from '@/lib/tenders/service';

const CONSTRUCTION_KEYWORDS = [
  'бетон', 'железобетон', 'жби', 'ракушечник', 'ракушка',
  'кирпич', 'цемент', 'щебень', 'гравий', 'арматура',
  'газобетон', 'газоблок', 'пеноблок', 'песок строительный',
  'стройматериал', 'асфальт', 'металлочерепица', 'профнастил',
  'утеплитель', 'минвата', 'труб пнд', 'строительн',
];

const CATEGORY_MAP: Array<{ kw: string[]; cat: string }> = [
  { kw: ['бетон', 'железобетон', 'жби'], cat: 'Бетон' },
  { kw: ['ракушечник', 'ракушка'], cat: 'Ракушечник' },
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

export interface PlatformConfig {
  id: string;
  name: string;
  rssUrl: string;
}

export const PLATFORMS: PlatformConfig[] = [
  {
    id: 'rts',
    name: 'РТС-тендер',
    rssUrl: 'https://www.rts-tender.ru/rss/tenders?keywords=стройматериалы',
  },
  {
    id: 'otc',
    name: 'OTC.ru',
    rssUrl: 'https://otc.ru/rss/tenders?query=стройматериалы',
  },
  {
    id: 'sberbank',
    name: 'Сбербанк-АСТ',
    rssUrl: 'https://www.sberbank-ast.ru/rss/tenders.aspx?keywords=стройматериалы',
  },
  {
    id: 'tender_pro',
    name: 'Tender.pro',
    rssUrl: 'https://tender.pro/rss?q=стройматериалы',
  },
  {
    id: 'eetp',
    name: 'ЕЭТП',
    rssUrl: 'https://www.roseltorg.ru/rss/tenders?q=стройматериалы',
  },
];

function isRelevant(title: string): boolean {
  const t = title.toLowerCase();
  return CONSTRUCTION_KEYWORDS.some((kw) => t.includes(kw));
}

function inferCategory(title: string): string {
  const lower = title.toLowerCase();
  for (const { kw, cat } of CATEGORY_MAP) {
    if (kw.some((k) => lower.includes(k))) return cat;
  }
  return 'Стройматериалы';
}

function getXmlField(xml: string, tag: string): string | null {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const plain = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
  const m = cdata.exec(xml) || plain.exec(xml);
  return m ? m[1].trim() : null;
}

function parseRSS(xml: string): Array<{ title: string; link: string | null; pubDate: string | null; description: string | null }> {
  const items: Array<{ title: string; link: string | null; pubDate: string | null; description: string | null }> = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const raw = m[1];
    const title = getXmlField(raw, 'title');
    if (!title) continue;
    const link = getXmlField(raw, 'link') || raw.match(/<link>([^<]+)<\/link>/)?.[1]?.trim() || null;
    const pubDate = getXmlField(raw, 'pubDate');
    const description = getXmlField(raw, 'description');
    items.push({ title, link, pubDate, description });
  }
  return items;
}

function parseBudget(description: string | null): number | null {
  if (!description) return null;
  const clean = description.replace(/<[^>]+>/g, ' ');
  const m = clean.match(/(?:Цена|НМЦ|начальная цена)[:\s]*([0-9\s]+[,.]?\d*)/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
  return isNaN(num) || num === 0 ? null : num;
}

export async function syncPlatform(platform: PlatformConfig): Promise<{ fetched: number; saved: number }> {
  let xml: string;
  try {
    const res = await fetch(platform.rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      logger.warn(`${platform.name} RSS HTTP ${res.status}`);
      return { fetched: 0, saved: 0 };
    }
    xml = await res.text();
  } catch (err) {
    logger.warn(`${platform.name} RSS fetch failed`, { err: err instanceof Error ? err.message : String(err) });
    return { fetched: 0, saved: 0 };
  }

  const items = parseRSS(xml).filter((i) => isRelevant(i.title));
  let saved = 0;

  for (const item of items) {
    // Use URL as external_id fallback
    const externalId = item.link
      ? `${platform.id}_${encodeURIComponent(item.link).slice(-40)}`
      : `${platform.id}_${Buffer.from(item.title).toString('base64').slice(0, 32)}`;

    const ok = await upsertTender({
      external_id: externalId,
      source: platform.id,
      title: item.title,
      description: null,
      category: inferCategory(item.title),
      region: null,
      buyer_name: null,
      law_type: 'other',
      budget: parseBudget(item.description),
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      deadline_at: null,
      source_url: item.link,
      docs_url: null,
      status: 'active',
      raw_payload: item as unknown as Record<string, unknown>,
    });
    if (ok) saved++;
  }

  return { fetched: items.length, saved };
}

export async function syncAllPlatforms(): Promise<Record<string, { fetched: number; saved: number }>> {
  const results: Record<string, { fetched: number; saved: number }> = {};
  for (const platform of PLATFORMS) {
    results[platform.id] = await syncPlatform(platform);
    logger.info(`${platform.name} sync done`, results[platform.id]);
  }
  return results;
}
