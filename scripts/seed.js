#!/usr/bin/env node
/**
 * Seed Supabase with test data
 * Usage: node scripts/seed.js
 */
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing env vars in .env.local');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${SERVICE_KEY}`,
  apikey: SERVICE_KEY,
  Prefer: 'resolution=ignore-duplicates',
};

async function insert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows),
  });
  const text = await res.text();
  if (!res.ok && !text.includes('duplicate')) {
    console.warn(`  ⚠️ ${table}: ${text}`);
  }
}

const tenders = [
  {
    external_id: 'RU-2024-001',
    title: 'Поставка бетона М300 для строительства административного здания',
    description: 'Требуется поставка товарного бетона марки М300 (В22.5) в объеме 450 куб.м.',
    category: 'Бетон',
    region: 'Москва',
    buyer_name: 'ГБУ «Управление капитального строительства»',
    law_type: '44-FZ',
    budget: 4850000,
    published_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    deadline_at: new Date(Date.now() + 12 * 86400000).toISOString(),
    source_url: 'https://zakupki.gov.ru/epz/order/notice/ea44/view/common-info.html?regNumber=0348100020924000123',
    docs_url: 'https://zakupki.gov.ru/epz/order/notice/ea44/view/documents.html?regNumber=0348100020924000123',
    status: 'active',
    raw_payload: {},
  },
  {
    external_id: 'RU-2024-002',
    title: 'Закупка ракушечника (стеновой камень) для жилого комплекса',
    description: 'Поставка ракушечника марки М25 в количестве 10 000 штук.',
    category: 'Ракушечник',
    region: 'Краснодарский край',
    buyer_name: 'ООО «СтройГрупп»',
    law_type: '223-FZ',
    budget: 1250000,
    published_at: new Date(Date.now() - 86400000).toISOString(),
    deadline_at: new Date(Date.now() + 8 * 86400000).toISOString(),
    source_url: 'https://zakupki.gov.ru/epz/order/notice/notice223/view/common-info.html?regNumber=32400213780',
    docs_url: 'https://zakupki.gov.ru/epz/order/notice/notice223/view/documents.html?regNumber=32400213780',
    status: 'active',
    raw_payload: {},
  },
  {
    external_id: 'RU-2024-003',
    title: 'Поставка строительных материалов (кирпич, цемент, арматура)',
    description: 'Комплексная поставка строительных материалов.',
    category: 'Строительные материалы',
    region: 'Ростовская область',
    buyer_name: 'МКУ «Дирекция строительства»',
    law_type: '44-FZ',
    budget: 3200000,
    published_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    deadline_at: new Date(Date.now() + 15 * 86400000).toISOString(),
    source_url: 'https://zakupki.gov.ru/epz/order/notice/ea44/view/common-info.html?regNumber=0158500001824001234',
    docs_url: 'https://zakupki.gov.ru/epz/order/notice/ea44/view/documents.html?regNumber=0158500001824001234',
    status: 'active',
    raw_payload: {},
  },
  {
    external_id: 'RU-2024-004',
    title: 'Поставка бетонных смесей для ремонта автодорог',
    description: 'Поставка бетонной смеси марки М200 в объеме 200 куб.м. Срочная закупка.',
    category: 'Бетон',
    region: 'Московская область',
    buyer_name: 'ГКУ МО «Мосавтодор»',
    law_type: '44-FZ',
    budget: 2100000,
    published_at: new Date(Date.now() - 86400000).toISOString(),
    deadline_at: new Date(Date.now() + 5 * 86400000).toISOString(),
    source_url: 'https://zakupki.gov.ru/epz/order/notice/ea44/view/common-info.html?regNumber=0148200002824000567',
    docs_url: 'https://zakupki.gov.ru/epz/order/notice/ea44/view/documents.html?regNumber=0148200002824000567',
    status: 'active',
    raw_payload: {},
  },
  {
    external_id: 'RU-2024-005',
    title: 'Поставка блоков из ракушняка для реставрации',
    description: '5 000 блоков из природного ракушняка для реставрации исторического здания.',
    category: 'Ракушечник',
    region: 'Республика Крым',
    buyer_name: 'ГБУК РК «Крымское наследие»',
    law_type: '44-FZ',
    budget: 890000,
    published_at: new Date().toISOString(),
    deadline_at: new Date(Date.now() + 20 * 86400000).toISOString(),
    source_url: 'https://zakupki.gov.ru/epz/order/notice/ea44/view/common-info.html?regNumber=0174200001824001890',
    docs_url: 'https://zakupki.gov.ru/epz/order/notice/ea44/view/documents.html?regNumber=0174200001824001890',
    status: 'active',
    raw_payload: {},
  },
  {
    external_id: 'RU-2024-006',
    title: 'Поставка товарного бетона М400 для фундаментных работ',
    description: 'Поставка товарного бетона класса В30 (М400) в объеме 800 куб.м.',
    category: 'Бетон',
    region: 'Санкт-Петербург',
    buyer_name: 'АО «Промстройинвест»',
    law_type: '223-FZ',
    budget: 9600000,
    published_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    deadline_at: new Date(Date.now() + 10 * 86400000).toISOString(),
    source_url: 'https://zakupki.gov.ru/epz/order/notice/notice223/view/common-info.html?regNumber=32400287654',
    docs_url: 'https://zakupki.gov.ru/epz/order/notice/notice223/view/documents.html?regNumber=32400287654',
    status: 'active',
    raw_payload: {},
  },
  {
    external_id: 'RU-2024-007',
    title: 'Закупка сухих строительных смесей и штукатурки',
    description: 'Поставка штукатурки, шпаклевки, плиточного клея.',
    category: 'Строительные материалы',
    region: 'Свердловская область',
    buyer_name: 'МБУ «Управление ЖКХ»',
    law_type: '44-FZ',
    budget: 450000,
    published_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    deadline_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    source_url: 'https://zakupki.gov.ru/epz/order/notice/ea44/view/common-info.html?regNumber=0162200002324000789',
    docs_url: 'https://zakupki.gov.ru/epz/order/notice/ea44/view/documents.html?regNumber=0162200002324000789',
    status: 'active',
    raw_payload: {},
  },
  {
    external_id: 'RU-2024-008',
    title: 'Поставка газобетонных блоков D500',
    description: 'Газобетонные блоки марки D500 класса прочности B2.5 в количестве 400 куб.м.',
    category: 'Строительные материалы',
    region: 'Нижегородская область',
    buyer_name: 'ООО «РегионСтрой»',
    law_type: '223-FZ',
    budget: 1800000,
    published_at: new Date(Date.now() - 86400000).toISOString(),
    deadline_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    source_url: 'https://zakupki.gov.ru/epz/order/notice/notice223/view/common-info.html?regNumber=32400198765',
    docs_url: 'https://zakupki.gov.ru/epz/order/notice/notice223/view/documents.html?regNumber=32400198765',
    status: 'active',
    raw_payload: {},
  },
  {
    external_id: 'RU-2024-009',
    title: 'Поставка щебня, песка и гравия для дорожного строительства',
    description: 'Щебень фракции 20-40 — 500 тонн, песок — 300 тонн, гравий — 200 тонн.',
    category: 'Строительные материалы',
    region: 'Татарстан',
    buyer_name: 'ГКУ «УКС Республики Татарстан»',
    law_type: '44-FZ',
    budget: 5500000,
    published_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    deadline_at: new Date(Date.now() + 9 * 86400000).toISOString(),
    source_url: 'https://zakupki.gov.ru/epz/order/notice/ea44/view/common-info.html?regNumber=0111200040024000345',
    docs_url: 'https://zakupki.gov.ru/epz/order/notice/ea44/view/documents.html?regNumber=0111200040024000345',
    status: 'active',
    raw_payload: {},
  },
  {
    external_id: 'RU-2024-010',
    title: 'Поставка бетона для устройства промышленных полов',
    description: 'Бетонная смесь М200 для промышленных полов складского комплекса.',
    category: 'Бетон',
    region: 'Ленинградская область',
    buyer_name: 'ООО «ЛогистикПарк»',
    law_type: 'commercial',
    budget: 1350000,
    published_at: new Date().toISOString(),
    deadline_at: new Date(Date.now() + 6 * 86400000).toISOString(),
    source_url: 'https://zakupki.gov.ru/epz/order/notice/notice223/view/common-info.html?regNumber=32400312456',
    docs_url: 'https://zakupki.gov.ru/epz/order/notice/notice223/view/documents.html?regNumber=32400312456',
    status: 'active',
    raw_payload: {},
  },
];

async function main() {
  console.log('🌱 Seeding database...');

  // Insert tenders
  console.log('  📋 Inserting tenders...');
  await insert('tenders', tenders);
  console.log(`  ✅ ${tenders.length} tenders inserted`);

  // Insert test user
  console.log('  👤 Inserting test user...');
  const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation,resolution=ignore-duplicates' },
    body: JSON.stringify({
      telegram_id: '123456789',
      username: 'test_supplier',
      full_name: 'Тест Поставщик',
      is_active: true,
      tariff_plan: 'pro',
    }),
  });

  const userData = await userRes.json();
  const userId = Array.isArray(userData) ? userData[0]?.id : userData?.id;

  if (userId) {
    console.log(`  ✅ Test user created: ${userId}`);

    // Insert preferences
    await insert('user_preferences', [{
      user_id: userId,
      categories: ['Бетон', 'Ракушечник', 'Строительные материалы'],
      regions: ['Москва', 'Московская область', 'Краснодарский край'],
      min_budget: 500000,
      max_budget: 10000000,
      keywords: ['бетон', 'ракушечник', 'стройматериалы'],
      excluded_keywords: [],
      preferred_laws: ['44-FZ', '223-FZ'],
    }]);
    console.log('  ✅ Preferences inserted');
  }

  console.log('\n✅ Seed complete!');
}

main().catch(console.error);
