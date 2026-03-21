import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { upsertTender } from '@/lib/tenders/service';

// Realistic construction tenders seed data
const SEED_TENDERS = [
  {
    external_id: 'seed_0317001', title: 'Поставка бетона М300 для строительства жилого комплекса',
    description: 'Требуется поставка товарного бетона М300 объемом 500 куб.м. для строительства 9-этажного жилого дома.',
    category: 'Бетон', region: 'Москва', buyer_name: 'ООО СтройГрупп Плюс',
    law_type: '44-FZ' as const, budget: 4_500_000,
    published_at: daysAgo(1), deadline_at: daysAgo(-14), source_url: 'https://zakupki.gov.ru', docs_url: null,
    status: 'active' as const, raw_payload: {},
  },
  {
    external_id: 'seed_0317002', title: 'Поставка кирпича керамического полнотелого М150',
    description: 'Закупка кирпича керамического полнотелого М150 в количестве 200 000 штук для кладочных работ.',
    category: 'Кирпич', region: 'Краснодарский край', buyer_name: 'ГКУ Краснодарстрой',
    law_type: '44-FZ' as const, budget: 2_800_000,
    published_at: daysAgo(2), deadline_at: daysAgo(-10), source_url: 'https://zakupki.gov.ru', docs_url: null,
    status: 'active' as const, raw_payload: {},
  },
  {
    external_id: 'seed_0317003', title: 'Поставка цемента М500 Д0 для нужд строительного предприятия',
    description: 'Портландцемент ПЦ500-Д0 в мешках по 50 кг, общий объем 1000 тонн.',
    category: 'Цемент', region: 'Ростовская область', buyer_name: 'АО РостовДорСтрой',
    law_type: '223-FZ' as const, budget: 8_200_000,
    published_at: daysAgo(0), deadline_at: daysAgo(-21), source_url: 'https://zakupki.gov.ru', docs_url: null,
    status: 'active' as const, raw_payload: {},
  },
  {
    external_id: 'seed_0317004', title: 'Поставка щебня гранитного фракции 20-40 мм',
    description: 'Щебень гранитный фракции 20-40 мм, объем 3000 тонн для дорожного строительства.',
    category: 'Щебень', region: 'Московская область', buyer_name: 'ГБУ МО ДорСервис',
    law_type: '44-FZ' as const, budget: 12_000_000,
    published_at: daysAgo(3), deadline_at: daysAgo(-7), source_url: 'https://zakupki.gov.ru', docs_url: null,
    status: 'active' as const, raw_payload: {},
  },
  {
    external_id: 'seed_0317005', title: 'Закупка арматуры строительной А500С диаметр 12мм',
    description: 'Арматурный прокат А500С диаметр 12 мм, длина 12 м, объем 500 тонн.',
    category: 'Арматура', region: 'Свердловская область', buyer_name: 'МУП УралСпецСтрой',
    law_type: '223-FZ' as const, budget: 31_500_000,
    published_at: daysAgo(1), deadline_at: daysAgo(-28), source_url: 'https://zakupki.gov.ru', docs_url: null,
    status: 'active' as const, raw_payload: {},
  },
  {
    external_id: 'seed_0317006', title: 'Поставка газобетонных блоков D400 размер 600x300x200',
    description: 'Газобетонные блоки автоклавного твердения D400 B2.5 для строительства малоэтажных объектов.',
    category: 'Газобетон', region: 'Краснодарский край', buyer_name: 'ООО КубаньСтрой',
    law_type: 'commercial' as const, budget: 1_850_000,
    published_at: daysAgo(0), deadline_at: daysAgo(-12), source_url: 'https://zakupki.gov.ru', docs_url: null,
    status: 'active' as const, raw_payload: {},
  },
  {
    external_id: 'seed_0317007', title: 'Поставка песка строительного речного ГОСТ 8736-2014',
    description: 'Песок речной строительный средний по ГОСТ 8736-2014, объем 2000 куб.м., доставка включена.',
    category: 'Песок', region: 'Ростовская область', buyer_name: 'АО ДонСтройМатериалы',
    law_type: '44-FZ' as const, budget: 2_400_000,
    published_at: daysAgo(2), deadline_at: daysAgo(-9), source_url: 'https://zakupki.gov.ru', docs_url: null,
    status: 'active' as const, raw_payload: {},
  },
  {
    external_id: 'seed_0317008', title: 'Поставка ЖБИ плит перекрытия ПК 60-15-8',
    description: 'Железобетонные плиты перекрытия ПК 60-15-8, количество 120 штук для жилого строительства.',
    category: 'ЖБИ', region: 'Москва', buyer_name: 'ФКУ Главное управление',
    law_type: '44-FZ' as const, budget: 9_600_000,
    published_at: daysAgo(1), deadline_at: daysAgo(-18), source_url: 'https://zakupki.gov.ru', docs_url: null,
    status: 'active' as const, raw_payload: {},
  },
  {
    external_id: 'seed_0317009', title: 'Поставка металлочерепицы Монтеррей с покрытием Полиэстер',
    description: 'Металлочерепица Монтеррей 0.5 мм Полиэстер RAL 3005 вишня, площадь 8000 кв.м.',
    category: 'Кровля', region: 'Новосибирская область', buyer_name: 'ООО СибКровля',
    law_type: '223-FZ' as const, budget: 7_200_000,
    published_at: daysAgo(3), deadline_at: daysAgo(-20), source_url: 'https://zakupki.gov.ru', docs_url: null,
    status: 'active' as const, raw_payload: {},
  },
  {
    external_id: 'seed_0317010', title: 'Поставка утеплителя минераловатного Rockwool Лайт Баттс',
    description: 'Утеплитель минераловатный Rockwool Лайт Баттс 100 мм, объем 15000 кв.м для утепления фасадов.',
    category: 'Утеплитель', region: 'Санкт-Петербург', buyer_name: 'ГКУ СПб СтройЗаказ',
    law_type: '44-FZ' as const, budget: 5_400_000,
    published_at: daysAgo(0), deadline_at: daysAgo(-15), source_url: 'https://zakupki.gov.ru', docs_url: null,
    status: 'active' as const, raw_payload: {},
  },
  {
    external_id: 'seed_0317011', title: 'Поставка асфальтобетонной смеси тип Б марка II',
    description: 'Асфальтобетонная смесь горячая тип Б марка II, объем 5000 тонн для ремонта дорог.',
    category: 'Асфальт', region: 'Ставропольский край', buyer_name: 'КУ Ставропольские дороги',
    law_type: '44-FZ' as const, budget: 35_000_000,
    published_at: daysAgo(1), deadline_at: daysAgo(-30), source_url: 'https://zakupki.gov.ru', docs_url: null,
    status: 'active' as const, raw_payload: {},
  },
  {
    external_id: 'seed_0317012', title: 'Поставка труб ПНД SDR 17 диаметр 110 мм',
    description: 'Трубы полиэтиленовые ПНД SDR 17 диаметр 110 мм, длина 12 м, объем 5000 пог.м.',
    category: 'Трубы', region: 'Республика Татарстан', buyer_name: 'МУП Казводоканал',
    law_type: '223-FZ' as const, budget: 4_200_000,
    published_at: daysAgo(2), deadline_at: daysAgo(-11), source_url: 'https://zakupki.gov.ru', docs_url: null,
    status: 'active' as const, raw_payload: {},
  },
  {
    external_id: 'seed_0317013', title: 'Комплексная поставка строительных материалов для реконструкции школы',
    description: 'Кирпич, цемент, ЖБИ, утеплитель, сухие смеси для реконструкции МБОУ СОШ №14.',
    category: 'Стройматериалы', region: 'Самарская область', buyer_name: 'МБОУ СОШ №14',
    law_type: '44-FZ' as const, budget: 18_500_000,
    published_at: daysAgo(0), deadline_at: daysAgo(-25), source_url: 'https://zakupki.gov.ru', docs_url: null,
    status: 'active' as const, raw_payload: {},
  },
  {
    external_id: 'seed_0317014', title: 'Поставка ракушечника известнякового СК-1',
    description: 'Ракушечник известняковый СК-1 размер 390x190x188 мм для строительства жилых домов, 50 000 шт.',
    category: 'Ракушечник', region: 'Республика Крым', buyer_name: 'ООО КрымСтройГрупп',
    law_type: 'commercial' as const, budget: 1_200_000,
    published_at: daysAgo(1), deadline_at: daysAgo(-8), source_url: 'https://zakupki.gov.ru', docs_url: null,
    status: 'active' as const, raw_payload: {},
  },
  {
    external_id: 'seed_0317015', title: 'Поставка бетона В25 П4 F150 W6 для фундаментных работ',
    description: 'Товарный бетон класса В25 подвижность П4 морозостойкость F150 водонепроницаемость W6, объем 800 куб.м.',
    category: 'Бетон', region: 'Ленинградская область', buyer_name: 'ООО ЛенСтройМонтаж',
    law_type: '223-FZ' as const, budget: 7_800_000,
    published_at: daysAgo(0), deadline_at: daysAgo(-17), source_url: 'https://zakupki.gov.ru', docs_url: null,
    status: 'active' as const, raw_payload: {},
  },
];

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('admin_auth')?.value === 'true';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let saved = 0;
  for (const tender of SEED_TENDERS) {
    const result = await upsertTender({ ...tender, source: 'zakupki' });
    if (result) saved++;
  }

  return NextResponse.json({ ok: true, saved, total: SEED_TENDERS.length });
}
