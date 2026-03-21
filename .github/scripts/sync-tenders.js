// Sync tenders from bicotender.ru RSS feed
// bicotender.ru aggregates zakupki.gov.ru + other platforms
// and is accessible from any IP (GitHub Actions, Vercel, local)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const RSS_URL = 'https://bicotender.ru/rss';

const CONSTRUCTION_KEYWORDS = [
  'бетон', 'железобетон', 'жби',
  'ракушечник', 'ракушка',
  'кирпич',
  'цемент',
  'щебень', 'гравий',
  'арматура',
  'газобетон', 'газоблок', 'пеноблок',
  'песок строительный', 'речной песок', 'карьерный песок',
  'стройматериал',
  'асфальт', 'асфальтобетон',
  'труб пнд',
  'металлочерепица',
  'профнастил',
  'утеплитель', 'минвата',
  'блок фундаментный', 'плита перекрытия',
];

const CONSTRUCTION_CATEGORIES = [
  'строительные материалы',
  'строительство',
  'дороги, мосты',
  'ремонтные и строительные',
];

const CATEGORY_MAP = [
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
  // Take last meaningful part: "Воронежская область"
  const parts = m[1].split('/').map(s => s.trim()).filter(Boolean);
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

function mapItem(item) {
  const { title, link, description, category, pubDate } = item;

  if (!isRelevant(title, category)) return null;

  // Extract bicotender ID from URL: tender326284030.html → 326284030
  const idMatch = link && link.match(/tender(\d+)/);
  const bicotenderId = idMatch ? idMatch[1] : parseNumber(description);
  if (!bicotenderId) return null;

  return {
    external_id: `bicotender_${bicotenderId}`,
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
    raw_payload: { title, link, category, pubDate, bicotenderId },
  };
}

async function fetchRSS() {
  const res = await fetch(RSS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function upsertToSupabase(tenders) {
  if (tenders.length === 0) return 0;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tenders`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(tenders),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${res.status}: ${err}`);
  }
  return tenders.length;
}

async function main() {
  console.log(`Starting bicotender.ru sync at ${new Date().toISOString()}`);

  const xml = await fetchRSS();
  const items = parseRSS(xml);
  console.log(`Fetched ${items.length} items from RSS`);

  const tenders = items.map(mapItem).filter(Boolean);
  console.log(`Matched ${tenders.length} construction material tenders`);

  if (tenders.length > 0) {
    const saved = await upsertToSupabase(tenders);
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
