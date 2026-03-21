// Sync tenders from zakupki.gov.ru FTP open data
// Uses anonymous FTP (ftp.zakupki.gov.ru) - no IP restrictions

import { Client } from 'basic-ftp';
import unzipper from 'unzipper';
import { PassThrough } from 'stream';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const FTP_HOST = 'ftp.zakupki.gov.ru';
const DAYS_BACK = 3;
const MAX_FILES_PER_REGION = 15;
const REGION_CONCURRENCY = 3;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const CONSTRUCTION_KEYWORDS = [
  'бетон', 'железобетон', 'жби',
  'ракушечник', 'ракушка',
  'кирпич',
  'цемент',
  'щебень', 'гравий',
  'арматура',
  'газобетон', 'газоблок', 'пеноблок',
  'строительный песок', 'речной песок', 'намывной песок', 'карьерный песок',
  'стройматериал',
  'асфальт', 'асфальтобетон',
  'труба пнд', 'трубы пнд',
  'металлочерепица',
  'профнастил',
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
  { kw: ['асфальт'], cat: 'Асфальт' },
  { kw: ['труб'], cat: 'Трубы' },
  { kw: ['стройматериал'], cat: 'Стройматериалы' },
];

function matchesKeywords(text) {
  const lower = text.toLowerCase();
  return CONSTRUCTION_KEYWORDS.some(kw => lower.includes(kw));
}

function inferCategory(text) {
  const lower = text.toLowerCase();
  for (const { kw, cat } of CATEGORY_MAP) {
    if (kw.some(k => lower.includes(k))) return cat;
  }
  return 'Стройматериалы';
}

function getTag(xml, tagName) {
  const re = new RegExp(
    `<(?:[\\w]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]{0,1000}?)</(?:[\\w]+:)?${tagName}>`,
    'i'
  );
  const m = re.exec(xml);
  if (!m) return null;
  return m[1]
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

function parseBudget(xml) {
  const raw = getTag(xml, 'maxPrice') || getTag(xml, 'nmck') || getTag(xml, 'startPrice');
  if (!raw) return null;
  const num = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
  return isNaN(num) ? null : num;
}

function parseDeadline(xml) {
  const raw = getTag(xml, 'collectingEndDate') || getTag(xml, 'endDate') || getTag(xml, 'submissionCloseDateTime');
  if (!raw) return null;
  try { return new Date(raw).toISOString(); } catch { return null; }
}

function getFileDateFromName(filename) {
  const m = filename.match(/_(\d{8})_/);
  if (!m) return null;
  const s = m[1];
  return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
}

function parseLawType(filename) {
  if (/EA44|ZK44|OK44/i.test(filename)) return '44-FZ';
  if (/EP223|ZK223|OK223/i.test(filename)) return '223-FZ';
  return 'other';
}

function getNoticeType(filename) {
  const m = filename.match(/notification_([A-Z0-9]+)_/i);
  return m ? m[1].toLowerCase() : 'notice';
}

const REGION_NAME_MAP = {
  'Adygeya_Resp': 'Республика Адыгея',
  'Altayskiy_Kray': 'Алтайский край',
  'Altay_Resp': 'Республика Алтай',
  'Amurskaya_Obl': 'Амурская область',
  'Arhangelskaya_Obl': 'Архангельская область',
  'Astrahanskaya_Obl': 'Астраханская область',
  'Bashkortostan_Resp': 'Республика Башкортостан',
  'Belgorodskaya_Obl': 'Белгородская область',
  'Bryanskaya_Obl': 'Брянская область',
  'Buryatiya_Resp': 'Республика Бурятия',
  'Chechenskaya_Resp': 'Чеченская Республика',
  'Chelyabinskaya_Obl': 'Челябинская область',
  'Chukotskiy_AO': 'Чукотский АО',
  'Chuvashskaya_Resp': 'Чувашская Республика',
  'Dagestan_Resp': 'Республика Дагестан',
  'Evreiskaya_AO': 'Еврейская АО',
  'Habarovskiy_Kray': 'Хабаровский край',
  'Hakasiya_Resp': 'Республика Хакасия',
  'Hanty-Mansiyskiy_AO': 'Ханты-Мансийский АО',
  'Ingushetiya_Resp': 'Республика Ингушетия',
  'Irkutskaya_Obl': 'Иркутская область',
  'Ivanovskaya_Obl': 'Ивановская область',
  'Kabardino-Balkarskaya_Resp': 'Кабардино-Балкарская Республика',
  'Kaliningradskaya_Obl': 'Калининградская область',
  'Kalmykiya_Resp': 'Республика Калмыкия',
  'Kaluzhskaya_Obl': 'Калужская область',
  'Kamchatskiy_Kray': 'Камчатский край',
  'Karachaevo-Cherkesskaya_Resp': 'Карачаево-Черкесская Республика',
  'Kareliya_Resp': 'Республика Карелия',
  'Kemerovskaya_Obl': 'Кемеровская область',
  'Kirovskaya_Obl': 'Кировская область',
  'Komi_Resp': 'Республика Коми',
  'Kostromskaya_Obl': 'Костромская область',
  'Krasnodarskiy_Kray': 'Краснодарский край',
  'Krasnoyarskiy_Kray': 'Красноярский край',
  'Kurganskaya_Obl': 'Курганская область',
  'Kurskaya_Obl': 'Курская область',
  'Leningradskaya_Obl': 'Ленинградская область',
  'Lipetskaya_Obl': 'Липецкая область',
  'Magadanskaya_Obl': 'Магаданская область',
  'Mariy_El_Resp': 'Республика Марий Эл',
  'Mordoviya_Resp': 'Республика Мордовия',
  'Moskovskaya_Obl': 'Московская область',
  'Moskva': 'Москва',
  'Murmanskaya_Obl': 'Мурманская область',
  'Nenetskiy_AO': 'Ненецкий АО',
  'Nizhegorodskaya_Obl': 'Нижегородская область',
  'Novgorodskaya_Obl': 'Новгородская область',
  'Novosibirskaya_Obl': 'Новосибирская область',
  'Omskaya_Obl': 'Омская область',
  'Orenburgskaya_Obl': 'Оренбургская область',
  'Orlovskaya_Obl': 'Орловская область',
  'Penzenskaya_Obl': 'Пензенская область',
  'Permskiy_Kray': 'Пермский край',
  'Primorskiy_Kray': 'Приморский край',
  'Pskovskaya_Obl': 'Псковская область',
  'Rostovskaya_Obl': 'Ростовская область',
  'Ryazanskaya_Obl': 'Рязанская область',
  'Sahalinskaya_Obl': 'Сахалинская область',
  'Samarskaya_Obl': 'Самарская область',
  'Sankt-Peterburg': 'Санкт-Петербург',
  'Saratovskaya_Obl': 'Саратовская область',
  'Severnaya_Osetiya_Resp': 'Республика Северная Осетия',
  'Smolenskaya_Obl': 'Смоленская область',
  'Stavropolskiy_Kray': 'Ставропольский край',
  'Sverdlovskaya_Obl': 'Свердловская область',
  'Tambovskaya_Obl': 'Тамбовская область',
  'Tatarstan_Resp': 'Республика Татарстан',
  'Tomskaya_Obl': 'Томская область',
  'Tulskaya_Obl': 'Тульская область',
  'Tverskaya_Obl': 'Тверская область',
  'Tyumenskaya_Obl': 'Тюменская область',
  'Tyva_Resp': 'Республика Тыва',
  'Udmurtskaya_Resp': 'Удмуртская Республика',
  'Ulyanovskaya_Obl': 'Ульяновская область',
  'Vladimirskaya_Obl': 'Владимирская область',
  'Volgogradskaya_Obl': 'Волгоградская область',
  'Vologodskaya_Obl': 'Вологодская область',
  'Voronezhskaya_Obl': 'Воронежская область',
  'Yamalo-Nenetskiy_AO': 'Ямало-Ненецкий АО',
  'Yaroslavskaya_Obl': 'Ярославская область',
  'Zabaykalskiy_Kray': 'Забайкальский край',
};

function regionToRu(name) {
  return REGION_NAME_MAP[name] || name.replace(/_/g, ' ');
}

async function downloadToBuffer(client, remotePath) {
  const pass = new PassThrough();
  const bufPromise = new Promise((resolve, reject) => {
    const chunks = [];
    pass.on('data', chunk => chunks.push(chunk));
    pass.on('end', () => resolve(Buffer.concat(chunks)));
    pass.on('error', reject);
  });
  await client.downloadTo(pass, remotePath);
  return bufPromise;
}

async function extractXmlFromZipBuffer(zipBuffer) {
  const dir = await unzipper.Open.buffer(zipBuffer);
  const xmlFile = dir.files.find(f => f.path.endsWith('.xml'));
  if (!xmlFile) return null;
  const content = await xmlFile.buffer();
  return content.toString('utf-8');
}

function parseNotification(xml, filename, regionName) {
  const purchaseNumber = getTag(xml, 'purchaseNumber');
  if (!purchaseNumber) return null;

  const title = getTag(xml, 'purchaseObjectInfo') || getTag(xml, 'objectInfo');
  if (!title || !matchesKeywords(title)) return null;

  const noticeType = getNoticeType(filename);
  const sourceUrl = `https://zakupki.gov.ru/epz/order/notice/${noticeType}/view/common-info.html?regNumber=${purchaseNumber}`;

  return {
    external_id: `zakupki_${purchaseNumber}`,
    title,
    description: null,
    category: inferCategory(title),
    region: regionToRu(regionName),
    buyer_name: getTag(xml, 'fullName'),
    law_type: parseLawType(filename),
    budget: parseBudget(xml),
    published_at: new Date().toISOString(),
    deadline_at: parseDeadline(xml),
    source_url: sourceUrl,
    docs_url: null,
    status: 'active',
    raw_payload: { purchaseNumber, filename, regionFolder: regionName },
  };
}

async function processRegion(regionName) {
  const client = new Client(30000);
  client.ftp.verbose = false;
  const tenders = [];

  try {
    await client.access({ host: FTP_HOST, user: 'anonymous', password: 'anonymous@', secure: false });
    await client.cd(`/fcs_regions/${regionName}/notifications/currMonth/`);
    const files = await client.list();

    const cutoff = Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000;
    const recent = files
      .filter(f => {
        if (!f.isFile || !f.name.startsWith('notification_') || !f.name.endsWith('.zip')) return false;
        if (f.size && f.size > MAX_FILE_SIZE_BYTES) return false;
        const d = getFileDateFromName(f.name);
        return d && d.getTime() >= cutoff;
      })
      .slice(0, MAX_FILES_PER_REGION);

    for (const file of recent) {
      try {
        const zipBuf = await downloadToBuffer(client, file.name);
        const xml = await extractXmlFromZipBuffer(zipBuf);
        if (!xml || !matchesKeywords(xml)) continue;
        const tender = parseNotification(xml, file.name, regionName);
        if (tender) tenders.push(tender);
      } catch {
        // skip individual file errors
      }
    }
  } catch {
    // region unavailable or FTP error
  } finally {
    client.close();
  }

  return tenders;
}

async function upsertTenders(tenders) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tenders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(tenders),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert failed ${res.status}: ${text}`);
  }
}

async function main() {
  console.error('Connecting to FTP to get region list...');
  let regions;
  {
    const client = new Client(30000);
    try {
      await client.access({ host: FTP_HOST, user: 'anonymous', password: 'anonymous@', secure: false });
      await client.cd('/fcs_regions/');
      const list = await client.list();
      regions = list.filter(f => f.isDirectory).map(f => f.name);
    } finally {
      client.close();
    }
  }
  console.error(`Found ${regions.length} regions`);

  const allTenders = [];
  let regionErrors = 0;

  for (let i = 0; i < regions.length; i += REGION_CONCURRENCY) {
    const batch = regions.slice(i, i + REGION_CONCURRENCY);
    const results = await Promise.allSettled(batch.map(processRegion));
    for (const r of results) {
      if (r.status === 'fulfilled') allTenders.push(...r.value);
      else regionErrors++;
    }
    process.stderr.write(
      `\rProcessed ${Math.min(i + REGION_CONCURRENCY, regions.length)}/${regions.length} regions, found ${allTenders.length} tenders`
    );
  }
  process.stderr.write('\n');

  let totalSaved = 0;
  for (let i = 0; i < allTenders.length; i += 100) {
    await upsertTenders(allTenders.slice(i, i + 100));
    totalSaved += Math.min(100, allTenders.length - i);
  }

  const summary = {
    timestamp: new Date().toISOString(),
    regions: regions.length,
    regionErrors,
    totalFetched: allTenders.length,
    totalSaved,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (totalSaved === 0) {
    console.error('No tenders saved');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
