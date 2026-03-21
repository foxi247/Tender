-- =============================================
-- Seed Data — Test Tenders and Users
-- =============================================

-- Test tenders (строительные материалы)
INSERT INTO tenders (external_id, title, description, category, region, buyer_name, law_type, budget, published_at, deadline_at, source_url, docs_url, status) VALUES

('RU-2024-001',
 'Поставка бетона М300 для строительства административного здания',
 'Требуется поставка товарного бетона марки М300 (В22.5) в объеме 450 куб.м. Доставка на объект в г. Москва, ул. Ленина, 15. Бетон должен соответствовать ГОСТ 26633-2015.',
 'Бетон', 'Москва', 'ГБУ «Управление капитального строительства»', '44-FZ',
 4850000.00, NOW() - INTERVAL '2 days', NOW() + INTERVAL '12 days',
 'https://zakupki.gov.ru/epz/order/notice/ea44/view/common-info.html?regNumber=0348100020924000123',
 'https://zakupki.gov.ru/epz/order/notice/ea44/view/documents.html?regNumber=0348100020924000123',
 'active'),

('RU-2024-002',
 'Закупка ракушечника (стеновой камень) для жилого комплекса',
 'Поставка ракушечника марки М25 в количестве 10 000 штук для возведения стен жилого дома. Размер блока 380х180х180 мм. Регион доставки — Краснодарский край.',
 'Ракушечник', 'Краснодарский край', 'ООО «СтройГрупп»', '223-FZ',
 1250000.00, NOW() - INTERVAL '1 day', NOW() + INTERVAL '8 days',
 'https://zakupki.gov.ru/epz/order/notice/notice223/view/common-info.html?regNumber=32400213780',
 'https://zakupki.gov.ru/epz/order/notice/notice223/view/documents.html?regNumber=32400213780',
 'active'),

('RU-2024-003',
 'Поставка строительных материалов (кирпич, цемент, арматура)',
 'Комплексная поставка строительных материалов: кирпич керамический рядовой 1NF — 50 000 шт, цемент М500 — 200 мешков, арматура А400 d12 — 5 тонн.',
 'Строительные материалы', 'Ростовская область', 'МКУ «Дирекция строительства»', '44-FZ',
 3200000.00, NOW() - INTERVAL '3 days', NOW() + INTERVAL '15 days',
 'https://zakupki.gov.ru/epz/order/notice/ea44/view/common-info.html?regNumber=0158500001824001234',
 'https://zakupki.gov.ru/epz/order/notice/ea44/view/documents.html?regNumber=0158500001824001234',
 'active'),

('RU-2024-004',
 'Поставка бетонных смесей для ремонта автодорог',
 'Поставка бетонной смеси марки М200 в объеме 200 куб.м для ямочного ремонта автомобильных дорог общего пользования. Срочная закупка.',
 'Бетон', 'Московская область', 'ГКУ МО «Мосавтодор»', '44-FZ',
 2100000.00, NOW() - INTERVAL '1 day', NOW() + INTERVAL '5 days',
 'https://zakupki.gov.ru/epz/order/notice/ea44/view/common-info.html?regNumber=0148200002824000567',
 'https://zakupki.gov.ru/epz/order/notice/ea44/view/documents.html?regNumber=0148200002824000567',
 'active'),

('RU-2024-005',
 'Поставка блоков из ракушняка для реставрации',
 'Требуется поставка блоков из природного ракушняка (ракушечника) для реставрации исторического здания. 5 000 блоков размером 300х150х150 мм. Материал должен соответствовать исторической аутентичности.',
 'Ракушечник', 'Республика Крым', 'ГБУК РК «Крымское наследие»', '44-FZ',
 890000.00, NOW(), NOW() + INTERVAL '20 days',
 'https://zakupki.gov.ru/epz/order/notice/ea44/view/common-info.html?regNumber=0174200001824001890',
 'https://zakupki.gov.ru/epz/order/notice/ea44/view/documents.html?regNumber=0174200001824001890',
 'active'),

('RU-2024-006',
 'Поставка товарного бетона М400 для фундаментных работ',
 'Поставка товарного бетона класса В30 (М400) в объеме 800 куб.м для устройства монолитного фундамента производственного здания. Доставка миксерами заказчика.',
 'Бетон', 'Санкт-Петербург', 'АО «Промстройинвест»', '223-FZ',
 9600000.00, NOW() - INTERVAL '4 days', NOW() + INTERVAL '10 days',
 'https://zakupki.gov.ru/epz/order/notice/notice223/view/common-info.html?regNumber=32400287654',
 'https://zakupki.gov.ru/epz/order/notice/notice223/view/documents.html?regNumber=32400287654',
 'active'),

('RU-2024-007',
 'Закупка сухих строительных смесей и штукатурки',
 'Поставка: штукатурка гипсовая Ротбанд — 500 мешков, шпаклевка финишная — 300 мешков, плиточный клей — 200 мешков, грунтовка концентрат — 50 канистр.',
 'Строительные материалы', 'Свердловская область', 'МБУ «Управление ЖКХ»', '44-FZ',
 450000.00, NOW() - INTERVAL '2 days', NOW() + INTERVAL '7 days',
 'https://zakupki.gov.ru/epz/order/notice/ea44/view/common-info.html?regNumber=0162200002324000789',
 'https://zakupki.gov.ru/epz/order/notice/ea44/view/documents.html?regNumber=0162200002324000789',
 'active'),

('RU-2024-008',
 'Поставка газобетонных блоков D500',
 'Требуется поставка газобетонных блоков марки D500 класса прочности B2.5 в количестве 400 куб.м (размер 600х300х200 мм). Доставка на объект в Нижегородской области.',
 'Строительные материалы', 'Нижегородская область', 'ООО «РегионСтрой»', '223-FZ',
 1800000.00, NOW() - INTERVAL '1 day', NOW() + INTERVAL '14 days',
 'https://zakupki.gov.ru/epz/order/notice/notice223/view/common-info.html?regNumber=32400198765',
 'https://zakupki.gov.ru/epz/order/notice/notice223/view/documents.html?regNumber=32400198765',
 'active'),

('RU-2024-009',
 'Поставка щебня, песка и гравия для дорожного строительства',
 'Щебень фракции 20-40 — 500 тонн, песок строительный намывной — 300 тонн, гравий фракции 5-20 — 200 тонн. Доставка автотранспортом на объект.',
 'Строительные материалы', 'Татарстан', 'ГКУ «УКС Республики Татарстан»', '44-FZ',
 5500000.00, NOW() - INTERVAL '5 days', NOW() + INTERVAL '9 days',
 'https://zakupki.gov.ru/epz/order/notice/ea44/view/common-info.html?regNumber=0111200040024000345',
 'https://zakupki.gov.ru/epz/order/notice/ea44/view/documents.html?regNumber=0111200040024000345',
 'active'),

('RU-2024-010',
 'Поставка бетона для устройства полов',
 'Поставка бетонной смеси М200 для устройства промышленных полов в складском комплексе. Объем — 150 куб.м. Требования: подвижность П3, W4.',
 'Бетон', 'Ленинградская область', 'ООО «ЛогистикПарк»', 'commercial',
 1350000.00, NOW(), NOW() + INTERVAL '6 days',
 'https://zakupki.gov.ru/epz/order/notice/notice223/view/common-info.html?regNumber=32400312456',
 'https://zakupki.gov.ru/epz/order/notice/notice223/view/documents.html?regNumber=32400312456',
 'active')

ON CONFLICT (external_id) DO NOTHING;

-- Test user
INSERT INTO users (telegram_id, username, full_name, is_active, tariff_plan) VALUES
  ('123456789', 'test_supplier', 'Тест Поставщик', true, 'pro')
ON CONFLICT (telegram_id) DO NOTHING;

-- Default preferences for test user
INSERT INTO user_preferences (user_id, categories, regions, min_budget, max_budget, keywords, excluded_keywords, preferred_laws)
SELECT
  id,
  '["Бетон", "Ракушечник", "Строительные материалы"]',
  '["Москва", "Московская область", "Краснодарский край"]',
  500000,
  10000000,
  '["бетон", "ракушечник", "стройматериалы"]',
  '[]',
  '["44-FZ", "223-FZ"]'
FROM users WHERE telegram_id = '123456789'
ON CONFLICT (user_id) DO NOTHING;
