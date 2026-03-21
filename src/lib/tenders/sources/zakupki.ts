import type { Tender, TenderSourceProvider, FetchTendersParams, LawType } from '@/types';
import { logger } from '@/lib/logger';

const BASE_URL = 'https://zakupki.gov.ru';
const SEARCH_URL = `${BASE_URL}/epz/order/extendedsearch/results.json`;

// Raw shape from zakupki.gov.ru JSON API
interface ZakupkiLot {
  id?: string;
  purchaseNumber?: string;
  subject?: string;
  initialSum?: number;
  publishDate?: string;
  auctionDate?: string;
  href?: string;
  lot?: {
    regionCodes?: string[];
    regionNames?: string[];
  };
  customer?: {
    fullName?: string;
    inn?: string;
    regNum?: string;
  };
  purchaseTypeName?: string;
  modificationDate?: string;
  links?: Array<{ rel?: string; href?: string }>;
}

interface ZakupkiResponse {
  totalCount?: number;
  lots?: ZakupkiLot[];
}

// Maps Russian tender categories based on title keywords
const CATEGORY_KEYWORDS: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['бетон', 'железобетон', 'жб'], category: 'Бетон' },
  { keywords: ['ракушечник', 'ракушка', 'ракушняк'], category: 'Ракушечник' },
  { keywords: ['кирпич'], category: 'Кирпич' },
  { keywords: ['цемент'], category: 'Цемент' },
  { keywords: ['щебень', 'гравий'], category: 'Щебень' },
  { keywords: ['песок', 'песчаник'], category: 'Песок' },
  { keywords: ['арматура', 'арматурный'], category: 'Арматура' },
  { keywords: ['газобетон', 'газоблок', 'пеноблок', 'пенобетон'], category: 'Газобетон' },
  { keywords: ['плита', 'перекрытие', 'фундамент'], category: 'ЖБИ' },
  { keywords: ['кровля', 'металлочерепица', 'профнастил'], category: 'Кровля' },
  { keywords: ['утеплитель', 'минвата', 'пенополистирол', 'пеноплекс'], category: 'Утеплитель' },
  { keywords: ['асфальт', 'асфальтобетон'], category: 'Асфальт' },
  { keywords: ['труба', 'трубопровод'], category: 'Трубы' },
  { keywords: ['стройматериал', 'строительный материал', 'строй материал'], category: 'Стройматериалы' },
];

function inferCategory(title: string): string | null {
  const lower = title.toLowerCase();
  for (const { keywords, category } of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return null;
}

function inferLawType(purchaseTypeName?: string): LawType | null {
  if (!purchaseTypeName) return null;
  const lower = purchaseTypeName.toLowerCase();
  if (lower.includes('44') || lower.includes('электронный аукцион') || lower.includes('запрос котировок')) {
    return '44-FZ';
  }
  if (lower.includes('223')) {
    return '223-FZ';
  }
  return 'other';
}

function mapZakupkiLot(lot: ZakupkiLot): Tender | null {
  const purchaseNumber = lot.purchaseNumber ?? lot.id;
  if (!purchaseNumber || !lot.subject) return null;

  const regionName =
    lot.lot?.regionNames?.[0] ?? null;

  const sourceUrl = lot.href
    ? lot.href.startsWith('http')
      ? lot.href
      : `${BASE_URL}${lot.href}`
    : null;

  const docsLink = lot.links?.find((l) => l.rel === 'docs')?.href ?? null;
  const docsUrl = docsLink
    ? docsLink.startsWith('http') ? docsLink : `${BASE_URL}${docsLink}`
    : null;

  return {
    id: '', // will be assigned by DB
    external_id: `zakupki_${purchaseNumber}`,
    title: lot.subject,
    description: null,
    category: inferCategory(lot.subject),
    region: regionName,
    buyer_name: lot.customer?.fullName ?? null,
    law_type: inferLawType(lot.purchaseTypeName),
    budget: lot.initialSum ?? null,
    published_at: lot.publishDate ? new Date(lot.publishDate).toISOString() : null,
    deadline_at: lot.auctionDate ? new Date(lot.auctionDate).toISOString() : null,
    source_url: sourceUrl,
    docs_url: docsUrl,
    status: 'active',
    raw_payload: lot as unknown as Record<string, unknown>,
    created_at: '',
    updated_at: '',
  };
}

export class ZakupkiGovSource implements TenderSourceProvider {
  async fetchTenders(params?: FetchTendersParams): Promise<Tender[]> {
    try {
      const searchString = [
        params?.category,
        ...(params?.category ? [] : ['стройматериал', 'бетон', 'кирпич', 'щебень', 'арматура', 'цемент']),
      ]
        .filter(Boolean)
        .join(' ');

      const url = new URL(SEARCH_URL);
      url.searchParams.set('searchString', searchString);
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

      if (params?.publishedAfter) {
        const dateStr = params.publishedAfter.toISOString().split('T')[0].split('-').reverse().join('.');
        url.searchParams.set('updateDateFrom', dateStr);
      }

      if (params?.region) {
        url.searchParams.set('customerPlace', params.region);
      }

      logger.info('Fetching from zakupki.gov.ru', { url: url.toString() });

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TenderBot/1.0)',
          Accept: 'application/json, text/javascript, */*',
          'Accept-Language': 'ru-RU,ru;q=0.9',
          Referer: 'https://zakupki.gov.ru/epz/order/extendedsearch/search.html',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        logger.error('zakupki.gov.ru returned non-200', { status: response.status });
        return [];
      }

      const data: ZakupkiResponse = await response.json();
      const lots = data.lots ?? [];

      logger.info('zakupki.gov.ru response', { totalCount: data.totalCount, lotsReturned: lots.length });

      const tenders = lots
        .map(mapZakupkiLot)
        .filter((t): t is Tender => t !== null);

      return params?.limit ? tenders.slice(0, params.limit) : tenders;
    } catch (err) {
      logger.error('ZakupkiGovSource.fetchTenders failed', { err });
      return [];
    }
  }

  async fetchTenderById(externalId: string): Promise<Tender | null> {
    // externalId format: "zakupki_<purchaseNumber>"
    const purchaseNumber = externalId.replace(/^zakupki_/, '');
    try {
      const url = `${BASE_URL}/epz/order/notice/ea44/view/common-info.html?regNumber=${purchaseNumber}`;
      // For now return null — individual lookup requires parsing HTML
      // Full document analysis is available via analyzeTenderDocumentation()
      logger.info('fetchTenderById not implemented for zakupki', { purchaseNumber, url });
      return null;
    } catch (err) {
      logger.error('ZakupkiGovSource.fetchTenderById failed', { err });
      return null;
    }
  }
}
