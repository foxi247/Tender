// Sync tenders from bicotender.ru RSS feed
// bicotender.ru aggregates zakupki.gov.ru + other platforms
// and is accessible from any IP (GitHub Actions, Vercel, local)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ALL 25 categories from bicotender.ru — each feed returns up to 100 active tenders
// Total: ~2500 unique tenders per sync run
const RSS_FEEDS = [
  // Main feed (latest across all categories)
  { url: 'https://bicotender.ru/rss', source: 'bicotender' },
  // All 25 bico industry categories (?field=slug)
  { url: 'https://bicotender.ru/rss?field=stroitelstvo-nedvizhimost-i-arhitektura', source: 'bicotender' },   // Строительство
  { url: 'https://bicotender.ru/rss?field=metally-metalloizdeliya', source: 'bicotender' },                   // Металлы
  { url: 'https://bicotender.ru/rss?field=mashinostroenie', source: 'bicotender' },                           // Машиностроение
  { url: 'https://bicotender.ru/rss?field=elektrotehnika', source: 'bicotender' },                            // Электротехника
  { url: 'https://bicotender.ru/rss?field=toplivo-i-energetika', source: 'bicotender' },                      // Топливо и энергетика
  { url: 'https://bicotender.ru/rss?field=himiya', source: 'bicotender' },                                    // Химия
  { url: 'https://bicotender.ru/rss?field=syrye-polufabrikaty', source: 'bicotender' },                       // Сырьё, полуфабрикаты
  { url: 'https://bicotender.ru/rss?field=prodovolstvie-pischevaya-promyshlennost', source: 'bicotender' },   // Продовольствие
  { url: 'https://bicotender.ru/rss?field=selskoe-hozyaystvo', source: 'bicotender' },                        // Сельское хозяйство
  { url: 'https://bicotender.ru/rss?field=legkaya-promyshlennost', source: 'bicotender' },                    // Лёгкая промышленность
  { url: 'https://bicotender.ru/rss?field=derevoobrabotka-les', source: 'bicotender' },                       // Дерево, лес
  { url: 'https://bicotender.ru/rss?field=transport', source: 'bicotender' },                                 // Транспорт
  { url: 'https://bicotender.ru/rss?field=perevozki-logistika-tamozhnya', source: 'bicotender' },             // Перевозки, логистика
  { url: 'https://bicotender.ru/rss?field=medicina-farmakologiya', source: 'bicotender' },                    // Медицина
  { url: 'https://bicotender.ru/rss?field=it-kompyutery-svyaz', source: 'bicotender' },                       // IT, связь
  { url: 'https://bicotender.ru/rss?field=bezopasnost', source: 'bicotender' },                               // Безопасность
  { url: 'https://bicotender.ru/rss?field=ofis-dom', source: 'bicotender' },                                  // Офис, дом
  { url: 'https://bicotender.ru/rss?field=bumazhnoe-proizvodstvo-tara-i-upakovka', source: 'bicotender' },    // Бумага, упаковка
  { url: 'https://bicotender.ru/rss?field=nauka-issledovaniya-obrazovanie', source: 'bicotender' },           // Наука, образование
  { url: 'https://bicotender.ru/rss?field=socialnye-uslugi', source: 'bicotender' },                          // Социальные услуги
  { url: 'https://bicotender.ru/rss?field=sport-otdyh-turizm', source: 'bicotender' },                       // Спорт, туризм
  { url: 'https://bicotender.ru/rss?field=ekologiya', source: 'bicotender' },                                 // Экология
  { url: 'https://bicotender.ru/rss?field=izdatelstvo-poligrafiya', source: 'bicotender' },                   // Издательство
  { url: 'https://bicotender.ru/rss?field=biznes-finansy-strahovanie-marketing-i-reklama', source: 'bicotender' }, // Бизнес, финансы
  { url: 'https://bicotender.ru/rss?field=drugoe', source: 'bicotender' },                                    // Прочее
  // Other platforms (fault-tolerant)
  { url: 'https://www.rts-tender.ru/rss/tender-list.aspx', source: 'rts' },
  { url: 'https://zakaz.gov.ru/zakaz/rss/pub', source: 'zakupki' },
];

// Maps bico hierarchical category paths → our standardized category names.
// Bico sends: "Строительство, недвижимость и архитектура / Строительные материалы..."
// We match substrings (lowercase) of that path.
const BICO_CATEGORY_RULES = [
  // ── Construction materials (most specific first) ──────────────────────────
  { match: 'строительные материалы',          cat: 'Стройматериалы' },
  { match: 'ремонтные и строительные',        cat: 'Стройматериалы' },
  { match: 'дороги, мосты',                   cat: 'Асфальт' },
  { match: 'полы, окна и двери',              cat: 'Окна ПВХ' },
  { match: 'водолазные работы',               cat: 'Стройматериалы' },
  { match: 'подготовка строительного',        cat: 'Стройматериалы' },
  { match: 'строительство, ремонт и обслуж',  cat: 'Стройматериалы' },
  { match: 'строительство, недвижимость',     cat: 'Стройматериалы' },
  // ── Metals ────────────────────────────────────────────────────────────────
  { match: 'металлы, металлоизделия',         cat: 'Металлопрокат' },
  { match: 'металлоконструкц',                cat: 'Металлопрокат' },
  { match: 'трубы и арматура',                cat: 'Арматура' },
  { match: 'крепёжные изделия',               cat: 'Крепёж' },
  // ── Electrical ────────────────────────────────────────────────────────────
  { match: 'электротехника',                  cat: 'Электрика' },
  { match: 'кабел',                           cat: 'Кабель' },
  { match: 'светотехник',                     cat: 'Электрика' },
  // ── Raw materials / Chemistry ─────────────────────────────────────────────
  { match: 'сырьё',                           cat: 'Сырьё' },
  { match: 'сырье',                           cat: 'Сырьё' },
  { match: 'полуфабрикаты',                   cat: 'Сырьё' },
  { match: 'химия',                           cat: 'Химия' },
  { match: 'нефтепродукты',                   cat: 'Битум' },
  // ── Fuel & Energy ─────────────────────────────────────────────────────────
  { match: 'топливо',                         cat: 'Топливо' },
  { match: 'нефть и газ',                     cat: 'Топливо' },
  { match: 'уголь',                           cat: 'Топливо' },
  { match: 'энергетика',                      cat: 'Электрика' },
  // ── Agriculture & Food ────────────────────────────────────────────────────
  { match: 'сельское хозяйство',              cat: 'Сельское хозяйство' },
  { match: 'продовольствие',                  cat: 'Продовольствие' },
  { match: 'пищевая промышленность',          cat: 'Продовольствие' },
  { match: 'корм',                            cat: 'Сельское хозяйство' },
  // ── Machinery / Transport ─────────────────────────────────────────────────
  { match: 'машиностроение',                  cat: 'Оборудование' },
  { match: 'промышленное оборудование',       cat: 'Оборудование' },
  { match: 'транспортные средства',           cat: 'Транспорт' },
  { match: 'транспорт',                       cat: 'Транспорт' },
  { match: 'перевозки',                       cat: 'Транспорт' },
  // ── Wood & Paper ──────────────────────────────────────────────────────────
  { match: 'деревообработка',                 cat: 'Пиломатериалы' },
  { match: 'лес',                             cat: 'Пиломатериалы' },
  { match: 'бумажное производство',           cat: 'Бумага' },
  { match: 'тара и упаковка',                 cat: 'Упаковка' },
  // ── Textiles ──────────────────────────────────────────────────────────────
  { match: 'лёгкая промышленность',           cat: 'Текстиль' },
  { match: 'легкая промышленность',           cat: 'Текстиль' },
  { match: 'одежда',                          cat: 'Текстиль' },
  { match: 'ткани',                           cat: 'Текстиль' },
  // ── IT & Services ─────────────────────────────────────────────────────────
  { match: 'it, компьютеры',                  cat: 'IT' },
  { match: 'информационные технологии',       cat: 'IT' },
  { match: 'медицина',                        cat: 'Медицина' },
  { match: 'фармакология',                    cat: 'Медицина' },
  { match: 'безопасность',                    cat: 'Безопасность' },
  { match: 'наука',                           cat: 'Образование' },
  { match: 'образование',                     cat: 'Образование' },
  { match: 'социальные услуги',               cat: 'Социальные услуги' },
  { match: 'офис',                            cat: 'Офис' },
  { match: 'спорт',                           cat: 'Спорт' },
  { match: 'экология',                        cat: 'Экология' },
  { match: 'бизнес',                          cat: 'Услуги' },
  { match: 'финансы',                         cat: 'Услуги' },
  { match: 'издательство',                    cat: 'Услуги' },
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

/**
 * Infer category:
 * 1. Title keyword match (CATEGORY_MAP) — most specific
 * 2. Bico hierarchical category path match (BICO_CATEGORY_RULES)
 * 3. Use subcategory part of bico path as-is
 * 4. 'Прочее'
 */
function inferCategory(title, rssCategory) {
  // 1. Title keywords — highest precision
  const lower = title.toLowerCase();
  for (const { kw, cat } of CATEGORY_MAP) {
    if (kw.some(k => lower.includes(k))) return cat;
  }

  // 2. Match bico's hierarchical category path
  if (rssCategory) {
    const catLower = rssCategory.toLowerCase();
    for (const { match, cat } of BICO_CATEGORY_RULES) {
      if (catLower.includes(match)) return cat;
    }

    // 3. Use the subcategory part (after "/") if present and short enough
    const parts = rssCategory.split('/').map(p => p.trim()).filter(Boolean);
    const sub = parts[parts.length - 1];  // last part = most specific
    if (sub && sub.length >= 3 && sub.length <= 100) return sub;
  }

  return 'Прочее';
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

  // Extract ID from URL or description
  const idMatch = link && (
    link.match(/tender(\d+)/) ||     // bicotender
    link.match(/[?&]id=(\d+)/) ||    // RTS / others
    link.match(/\/(\d{15,})/)         // EIS 19-digit number
  );
  const tenderId = idMatch ? idMatch[1] : parseNumber(description);
  if (!tenderId) return null;  // skip if we can't identify the tender

  return {
    external_id: `${feedSource}_${tenderId}`,
    source: feedSource,
    title,
    description: null,
    category: inferCategory(title, category),  // RSS category as fallback
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

      console.log(`  Saved ${mapped.length} tenders (all categories)`);
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
