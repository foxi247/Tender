// Sync tenders from bicotender.ru RSS feed
// bicotender.ru aggregates zakupki.gov.ru + other platforms
// and is accessible from any IP (GitHub Actions, Vercel, local)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Multiple RSS feeds: bicotender (main + category pages) + РТС-тендер
const RSS_FEEDS = [
  { url: 'https://bicotender.ru/rss', source: 'bicotender' },
  // Bicotender category-filtered pages (same aggregator, broader coverage per keyword)
  { url: 'https://bicotender.ru/rss?cat=building_materials', source: 'bicotender' },
  { url: 'https://bicotender.ru/rss?cat=construction', source: 'bicotender' },
  // РТС-тендер public RSS
  { url: 'https://www.rts-tender.ru/rss/tender-list.aspx', source: 'rts' },
  // ЗаказГосударства (aggregator, free RSS)
  { url: 'https://zakaz.gov.ru/zakaz/rss/pub', source: 'zakupki' },
];

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
  'пиломатериал', 'доска обрезн', 'брус строит',
  'керамогранит', 'плитка керамич',
  'геотекстиль',
  'известь', 'известняк',
  'мел кормовой', 'мел технический',
  'соль техническая', 'соль поваренная',
];

const CONSTRUCTION_CATEGORIES = [
  'строительные материалы',
  'строительство',
  'дороги, мосты',
  'ремонтные и строительные',
];

const CATEGORY_MAP = [
  { kw: ['железобетон'], cat: 'Железобетон' },
  { kw: ['жби', 'плита перекрытия', 'фундаментный блок'], cat: 'ЖБИ' },
  { kw: ['газобетон', 'газоблок', 'газосиликат'], cat: 'Газобетон' },
  { kw: ['пеноблок', 'пенобетон'], cat: 'Пеноблок' },
  { kw: ['бетон'], cat: 'Бетон' },
  { kw: ['ракушечник', 'ракушняк'], cat: 'Ракушечник' },
  { kw: ['ракушка кормовая', 'кормовая ракушка', 'ракушка дробленая', 'ракушка морская'], cat: 'Ракушка кормовая' },
  { kw: ['ракушка'], cat: 'Ракушечник' },  // generic fallback for "ракушка" alone
  { kw: ['кирпич'], cat: 'Кирпич' },
  { kw: ['цемент'], cat: 'Цемент' },
  { kw: ['сухие смеси', 'сухая смесь'], cat: 'Сухие смеси' },
  { kw: ['щебень'], cat: 'Щебень' },
  { kw: ['гравий'], cat: 'Гравий' },
  { kw: ['песок'], cat: 'Песок' },
  { kw: ['асфальт', 'асфальтобетон'], cat: 'Асфальт' },
  { kw: ['битум'], cat: 'Битум' },
  { kw: ['арматура'], cat: 'Арматура' },
  { kw: ['металлопрокат', 'металлоконструкц'], cat: 'Металлопрокат' },
  { kw: ['стальная труба', 'трубы стальн'], cat: 'Трубы стальные' },
  { kw: ['профнастил'], cat: 'Профнастил' },
  { kw: ['металлочерепица'], cat: 'Металлочерепица' },
  { kw: ['трубы пнд', 'труб пнд', 'полиэтиленовая труба'], cat: 'Трубы ПНД' },
  { kw: ['трубы пвх', 'труб пвх'], cat: 'Трубы ПВХ' },
  { kw: ['труб чугун'], cat: 'Трубы чугунные' },
  { kw: ['сантехник'], cat: 'Сантехника' },
  { kw: ['кровельн', 'кровля'], cat: 'Кровля' },
  { kw: ['рубероид'], cat: 'Рубероид' },
  { kw: ['гидроизоляц'], cat: 'Гидроизоляция' },
  { kw: ['утеплитель', 'базальтовый утеп'], cat: 'Утеплитель' },
  { kw: ['минвата', 'минераловатн', 'минеральная вата'], cat: 'Минвата' },
  { kw: ['пеноплекс', 'эппс', 'экструзион'], cat: 'Пеноплекс' },
  { kw: ['гипсокартон', ' гкл '], cat: 'Гипсокартон' },
  { kw: ['штукатурк'], cat: 'Штукатурка' },
  { kw: ['шпаклёвк', 'шпаклевк'], cat: 'Шпаклёвка' },
  { kw: ['краска', 'лакокрасочн'], cat: 'Краска' },
  { kw: ['керамогранит'], cat: 'Керамогранит' },
  { kw: ['плитка', 'плитк'], cat: 'Плитка' },
  { kw: ['ламинат'], cat: 'Ламинат' },
  { kw: ['линолеум'], cat: 'Линолеум' },
  { kw: ['паркет'], cat: 'Паркет' },
  { kw: ['окна пвх', 'пластиковые окна', 'оконный блок'], cat: 'Окна ПВХ' },
  { kw: ['дверн блок', 'двери стальн', 'двери деревянн'], cat: 'Двери' },
  { kw: ['ворота'], cat: 'Ворота' },
  { kw: ['пиломатериал', 'доска обрезн', 'брус строит'], cat: 'Пиломатериалы' },
  { kw: ['фанера'], cat: 'Фанера' },
  { kw: ['кабель', 'провод электр'], cat: 'Кабель' },
  { kw: ['геотекстиль'], cat: 'Геотекстиль' },
  { kw: ['труб'], cat: 'Трубы ПНД' },  // generic pipe fallback
  { kw: ['стройматериал', 'строительный материал'], cat: 'Стройматериалы' },
];

function isRelevant(title, category) {
  const titleLower = title.toLowerCase();
  const catLower = (category || '').toLowerCase();

  if (CONSTRUCTION_KEYWORDS.some(kw => titleLower.includes(kw))) return true;
  if (CONSTRUCTION_CATEGORIES.some(kw => catLower.includes(kw))) return true;
  return false;
}

function inferCategory(title) {
  const lower = title.toLowerCase();
  for (const { kw, cat } of CATEGORY_MAP) {
    if (kw.some(k => lower.includes(k))) return cat;
  }
  return 'Стройматериалы';
}

function getXmlField(xml, tag) {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const plain = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
  const m = cdata.exec(xml) || plain.exec(xml);
  return m ? m[1].trim() : null;
}

// Parse: "Заявка № 326284030" from description
function parseNumber(description) {
  const m = description && description.match(/Заявка\s*[№#]\s*(\d+)/i);
  return m ? m[1] : null;
}

// Parse: "Цена: 532785.6" from description
function parseBudget(description) {
  const clean = (description || '').replace(/&lt;[^&]*&gt;/g, ' ').replace(/<[^>]+>/g, ' ');
  const m = clean.match(/Цена:\s*([\d\s]+[,.]?\d*)/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
  return isNaN(num) || num === 0 ? null : num;
}

// Parse: "Окончание: 2026-03-25 09:00:00"
function parseDeadline(description) {
  const clean = (description || '').replace(/&lt;[^&]*&gt;/g, ' ').replace(/<[^>]+>/g, ' ');
  const m = clean.match(/Окончание:\s*(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})/i);
  if (!m) return null;
  try { return new Date(m[1]).toISOString(); } catch { return null; }
}

// Parse: "Регион: Россия / Центральный ФО / Воронежская область"
function parseRegion(description) {
  const clean = (description || '').replace(/&lt;[^&]*&gt;/g, ' ').replace(/<[^>]+>/g, ' ');
  const m = clean.match(/Регион:\s*([^\n<]+)/i);
  if (!m) return null;
  let raw = m[1];
  // Cut off at next field marker so region text doesn't bleed into "Цена:", "Начало:", etc.
  const cutIdx = raw.search(/\s+(?:Цена|Начало|Окончание|Тип):/i);
  if (cutIdx > 0) raw = raw.slice(0, cutIdx);
  const parts = raw.split('/').map(s => s.trim()).filter(Boolean);
  return parts[parts.length - 1] || parts[0] || null;
}

// Parse: "Тип: Электронный аукцион"
function parseLawType(description) {
  const clean = (description || '').replace(/<[^>]+>/g, ' ');
  const type = clean.match(/Тип:\s*([^\n<&]+)/i)?.[1]?.toLowerCase() || '';
  if (type.includes('аукцион') || type.includes('44')) return '44-FZ';
  if (type.includes('223')) return '223-FZ';
  return 'other';
}

function parseRSS(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const raw = m[1];
    const title = getXmlField(raw, 'title');
    const link = getXmlField(raw, 'link') || raw.match(/<link>([^<]+)<\/link>/)?.[1]?.trim();
    const description = getXmlField(raw, 'description');
    const category = getXmlField(raw, 'category');
    const pubDate = getXmlField(raw, 'pubDate');

    if (!title) continue;
    items.push({ title, link, description, category, pubDate });
  }
  return items;
}

function mapItem(item, feedSource = 'bicotender') {
  const { title, link, description, category, pubDate } = item;

  if (!isRelevant(title, category)) return null;

  // Extract ID from URL or description
  const idMatch = link && (
    link.match(/tender(\d+)/) ||     // bicotender
    link.match(/[?&]id=(\d+)/) ||    // RTS / others
    link.match(/\/(\d{15,})/)         // EIS 19-digit number
  );
  const tenderId = idMatch ? idMatch[1] : parseNumber(description);
  if (!tenderId) return null;

  return {
    external_id: `${feedSource}_${tenderId}`,
    source: feedSource,
    title,
    description: null,
    category: inferCategory(title),
    region: parseRegion(description),
    buyer_name: null,
    law_type: parseLawType(description),
    budget: parseBudget(description),
    published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
    deadline_at: parseDeadline(description),
    source_url: link || null,
    docs_url: null,
    status: 'active',
    raw_payload: { title, link, category, pubDate, tenderId },
  };
}

async function fetchRSS(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function upsertToSupabase(tenders) {
  if (tenders.length === 0) return 0;

  // Send in batches of 50 to avoid payload size limits
  let saved = 0;
  const batchSize = 50;
  for (let i = 0; i < tenders.length; i += batchSize) {
    const batch = tenders.slice(i, i + batchSize);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tenders`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`Supabase batch ${i}-${i + batch.length} failed: ${res.status}`, err.slice(0, 500));
      throw new Error(`Supabase ${res.status}: ${err.slice(0, 200)}`);
    }
    saved += batch.length;
    console.log(`  Batch ${Math.floor(i / batchSize) + 1}: saved ${batch.length} tenders`);
  }
  return saved;
}

async function main() {
  console.log(`Starting multi-platform sync at ${new Date().toISOString()}`);

  const allTenders = [];
  const seen = new Set(); // dedup by external_id

  for (const feed of RSS_FEEDS) {
    try {
      console.log(`Fetching ${feed.source}: ${feed.url}`);
      const xml = await fetchRSS(feed.url);
      const items = parseRSS(xml);
      console.log(`  Got ${items.length} items`);

      const mapped = items
        .map(item => mapItem(item, feed.source))
        .filter(Boolean)
        .filter(t => {
          if (seen.has(t.external_id)) return false;
          seen.add(t.external_id);
          return true;
        });

      console.log(`  Matched ${mapped.length} construction tenders`);
      allTenders.push(...mapped);
    } catch (err) {
      console.warn(`  Failed: ${err.message} (skipping this feed)`);
    }
  }

  console.log(`Total unique tenders: ${allTenders.length}`);

  if (allTenders.length > 0) {
    const saved = await upsertToSupabase(allTenders);
    console.log(`Saved ${saved} tenders to Supabase`);
  } else {
    console.log('No matching tenders in this batch (will try again next run)');
  }

  console.log('Done');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
