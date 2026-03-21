# TenderBot — AI ассистент по тендерам

Telegram-бот для поставщиков строительных материалов в России.
Находит релевантные тендеры, отправляет ежедневную подборку, анализирует через Mistral AI.

---

## Стек

| Слой | Технология |
|------|------------|
| Frontend / Backend | Next.js 15, TypeScript, Tailwind CSS |
| База данных | Supabase (PostgreSQL) |
| AI | Mistral API (medium), абстракция для смены провайдера |
| Telegram | Telegram Bot API (webhook) |
| Деплой | Vercel / любой Node.js хостинг |

---

## Быстрый старт

### 1. Клонирование

```bash
git clone <repo>
cd tender-bot
npm install
```

### 2. Переменные окружения

```bash
cp .env.example .env.local
# Заполните значения в .env.local
```

Обязательные переменные:

| Переменная | Описание |
|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL вашего Supabase проекта |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon ключ Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role ключ (для сервера) |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram бота |
| `TELEGRAM_WEBHOOK_SECRET` | Произвольная строка для верификации |
| `MISTRAL_API_KEY` | API ключ Mistral |
| `ADMIN_PASSWORD` | Пароль для входа в админ-панель |
| `CRON_SECRET` | Секрет для вызова дайджеста |

### 3. Настройка Supabase

Откройте [Supabase Dashboard](https://app.supabase.com) → SQL Editor и выполните:

```sql
-- Вставьте содержимое файла:
supabase/migrations/001_initial_schema.sql
```

Или используйте скрипт:
```bash
node scripts/migrate.js
```

### 4. Загрузка тестовых данных

```bash
node scripts/seed.js
```

### 5. Локальный запуск

```bash
npm run dev
```

Открыть: http://localhost:3000/admin
Пароль: значение из `ADMIN_PASSWORD`

### 6. Настройка Telegram Webhook

Для локальной разработки используйте [ngrok](https://ngrok.com):

```bash
ngrok http 3000
# Скопируйте HTTPS URL
```

Установите webhook:
```bash
node scripts/set-webhook.js https://your-ngrok-url.ngrok.io
```

Или через админ-панель: **Настройки → Telegram Webhook**

---

## Структура проекта

```
tender-bot/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── admin/               # Веб-панель управления
│   │   │   ├── page.tsx         # Дашборд
│   │   │   ├── tenders/         # Список тендеров
│   │   │   ├── users/           # Пользователи
│   │   │   ├── preferences/     # Предпочтения
│   │   │   ├── actions/         # Действия (избранное, в работе)
│   │   │   ├── digests/         # История рассылок
│   │   │   └── settings/        # Настройки (AI, webhook)
│   │   ├── api/
│   │   │   ├── webhook/         # Telegram webhook endpoint
│   │   │   ├── digest/          # Ручной запуск дайджеста
│   │   │   ├── tenders/         # REST API тендеров
│   │   │   ├── users/           # REST API пользователей
│   │   │   ├── settings/        # REST API настроек
│   │   │   ├── logs/            # Логи и история
│   │   │   └── auth/            # Аутентификация
│   │   └── login/               # Страница входа
│   ├── lib/
│   │   ├── ai/                  # AI провайдеры
│   │   │   ├── provider.ts      # Фабрика (Mistral/OpenAI/rule-based)
│   │   │   ├── mistral.ts       # Mistral Medium интеграция
│   │   │   └── rule-based.ts    # Правила без AI
│   │   ├── telegram/            # Telegram бот
│   │   │   ├── bot.ts           # API вызовы
│   │   │   ├── messages.ts      # Форматирование сообщений
│   │   │   ├── keyboards.ts     # Клавиатуры и кнопки
│   │   │   └── handlers/        # Обработчики
│   │   │       ├── commands.ts  # /start, /today, etc.
│   │   │       ├── messages.ts  # Текстовые сообщения
│   │   │       └── callbacks.ts # Inline кнопки
│   │   ├── tenders/
│   │   │   ├── service.ts       # CRUD тендеров
│   │   │   ├── scorer.ts        # Алгоритм ранжирования
│   │   │   └── sources/         # Источники тендеров
│   │   │       ├── provider.ts  # Абстракция
│   │   │       └── mock.ts      # Мок данные
│   │   ├── users/service.ts     # Пользователи
│   │   ├── favorites/service.ts # Избранное, действия
│   │   ├── digest/service.ts    # Ежедневный дайджест
│   │   └── supabase/            # Supabase клиенты
│   └── types/index.ts           # TypeScript типы
├── supabase/
│   ├── migrations/              # SQL схема
│   └── seed.sql                 # Тестовые данные
├── scripts/
│   ├── migrate.js               # Применить миграции
│   ├── seed.js                  # Загрузить тестовые данные
│   ├── set-webhook.js           # Настроить webhook
│   └── delete-webhook.js        # Удалить webhook
└── .env.example                 # Пример env переменных
```

---

## Telegram Bot — Команды

| Команда | Действие |
|---------|---------|
| `/start` | Приветствие и главное меню |
| `/today` | Актуальные тендеры |
| `/favorites` | Избранное |
| `/inwork` | Тендеры в работе |
| `/hidden` | Скрытые тендеры |
| `/filters` | Текущие фильтры |
| `/help` | Справка |

**Текстовые запросы:**
- "покажи по бетону"
- "тендеры в Москве"
- "до 5 млн"
- "срочные"
- "что новое за 3 дня"

**Кнопки под карточкой тендера:**
- 🔗 Открыть закупку
- 📄 Документация
- ❤️ Сохранить / Убрать из избранного
- 🔧 В работу
- 🙈 Скрыть

---

## AI Провайдер

Смена провайдера в реальном времени — без перезапуска:

1. Откройте **Админ-панель → Настройки**
2. Измените `ai_provider`: `mistral` / `openai` / `rule-based`
3. Вставьте API ключ и выберите модель
4. Нажмите **Сохранить** — изменения применятся немедленно ко всем пользователям

Кэш провайдера сбрасывается автоматически.

Доступные модели Mistral:
- `mistral-medium-latest` (рекомендован)
- `mistral-large-latest`
- `mistral-small-latest`

---

## Ежедневный дайджест

**Автоматически** (через Vercel Cron):

Добавьте в `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/digest?secret=YOUR_CRON_SECRET",
    "schedule": "0 6 * * *"
  }]
}
```

**Вручную:**
```bash
curl -X POST https://your-domain.com/api/digest \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Или через кнопку в **Дашборде → Быстрые действия**.

---

## Алгоритм ранжирования тендеров

| Условие | Очков |
|---------|-------|
| Совпадение категории | +40 |
| Совпадение региона | +25 |
| Бюджет в диапазоне | +15 |
| Свежий тендер (< 48ч) | +10 |
| Ключевые слова | +10 |
| Предпочтительный закон | +5 |
| Исключённые ключевые слова | -20 |

Скрытые тендеры не показываются повторно.

---

## Деплой на Vercel

```bash
# Установите Vercel CLI
npm i -g vercel

# Деплой
vercel

# Установите webhook (после получения URL)
node scripts/set-webhook.js https://your-project.vercel.app
```

---

## Расширение

### Подключение реального источника тендеров

Реализуйте интерфейс `TenderSourceProvider`:

```typescript
// src/lib/tenders/sources/your-source.ts
export class ZakupkiGovSource implements TenderSourceProvider {
  async fetchTenders(params?: FetchTendersParams): Promise<Tender[]> {
    // Интеграция с API zakupki.gov.ru
  }
  async fetchTenderById(externalId: string): Promise<Tender | null> { ... }
}
```

Зарегистрируйте в `src/lib/tenders/sources/provider.ts`.

### AI функции (интерфейс)

```typescript
interface AIProviderInterface {
  summarizeTender(tender): Promise<string>
  explainWhyRecommended(tender, preferences): Promise<string>
  classifyUserIntent(text): Promise<UserIntent>
  analyzeTenderDocumentation(docsUrl): Promise<string>
}
```

---

## Чеклист запуска

- [ ] Создан Supabase проект
- [ ] Выполнены SQL миграции (`supabase/migrations/001_initial_schema.sql`)
- [ ] Загружены тестовые данные (`node scripts/seed.js`)
- [ ] Заполнен `.env.local`
- [ ] Запущен сервер (`npm run dev`)
- [ ] Установлен Telegram webhook (`node scripts/set-webhook.js <url>`)
- [ ] Проверена авторизация в `/admin`
- [ ] Бот отвечает на `/start`
- [ ] Настроен AI провайдер в Настройках
- [ ] Проверена отправка дайджеста
