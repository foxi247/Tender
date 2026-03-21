# Tender Bot — Project Status & Backup Document

> Created: 2026-03-21
> Branch: `claude/telegram-tender-bot-mvp-9akXF`
> Vercel project: `tender` (prj_Fk6u3Fmvfq3lrtBSVeD6iMIE2fPx)

---

## What Was Built

### Core Architecture

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Database | Supabase (PostgreSQL) |
| Deployment | Vercel (serverless) |
| Telegram | Webhook-based bot (no polling) |
| AI | Mistral API (with rule-based fallback) |

### Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Telegram users, tariff, AI chat mode |
| `user_preferences` | Per-user filters: categories, regions, budget, preferred sources |
| `tenders` | Scraped tenders with source tag |
| `user_tender_actions` | favorite / in_work / hidden / viewed per user-tender pair |
| `daily_digests` | Log of daily digest sends |
| `bot_logs` | All bot events (commands, messages, callbacks) |
| `chat_history` | AI chat message history per user |
| `app_settings` | Key-value admin settings (AI provider, API keys) |

### Database Migrations Applied

| File | Description |
|------|-------------|
| `001_initial_schema.sql` | Full initial schema with all tables, indices, RLS, triggers |
| `002_add_ai_chat_mode.sql` | `users.ai_chat_mode BOOLEAN DEFAULT false` |
| `003_add_source_and_platforms.sql` | `tenders.source TEXT DEFAULT 'bicotender'` + `user_preferences.preferred_sources JSONB DEFAULT '[]'` |

> **IMPORTANT**: Run all migrations in Supabase SQL editor in order.

---

## Telegram Bot Features

### Main Menu Buttons
```
📋 Тендеры сегодня  |  ⭐ Лучшие для меня
❤️ Избранное        |  🔧 В работе
📊 Анализ рынка     |  🤖 ИИ Чат
⚙️ Фильтры          |  ❓ Помощь
```

### Commands
- `/start` — Welcome message + instructions
- `/today` — Tenders with filters applied
- `/market` — AI market analysis
- `/favorites` — Saved tenders (with "Remove from favorites" button)
- `/inwork` — Tenders marked as in-work
- `/hidden` — Hidden tenders
- `/filters` — Set categories, regions, budget, platforms
- `/help` — Full help with examples

### Filters (user_preferences)
- **Categories**: 14 predefined construction materials
- **Regions**: 15 predefined Russian regions
- **Budget**: 7 presets from 0 to 50M RUB
- **Platforms**: Bico, Zakupki.gov (filter by tender source)

### AI Chat Mode
- Button `🤖 ИИ Чат` opens conversational mode
- All messages in chat mode go directly to AI (`chatWithHistory`)
- AI has access to last 20 messages of context
- Button `❌ Завершить ИИ Чат` closes the mode and returns to main menu
- If user types unknown text outside chat mode → suggest opening AI chat

### Tender Cards
- Title (numbered), Budget, Region, Deadline (with days remaining), Law type, Category
- Inline buttons: 🔗 Open, 📄 Docs, ❤️/💔 Favorite toggle, 🔧 In Work, 🙈 Hide
- Button shows "💔 Убрать из избранного" when viewing favorites list

---

## Data Sources (Sync)

### 1. Bicotender RSS (`https://bicotender.ru/rss`)
- Source tag: `source = 'bicotender'`, `external_id = 'bicotender_<id>'`
- Filters by 23 construction keywords
- Parses: title, budget (Цена:), deadline (Окончание:), region (Регион:), law type (Тип:)
- Auto-infers category from 12 keyword groups

### 2. Zakupki.gov.ru API
- Source tag: `source = 'zakupki'`, `external_id = 'zakupki_<purchaseNumber>'`
- Endpoint: `https://zakupki.gov.ru/epz/order/extendedsearch/results.json`
- Returns FZ-44 and FZ-223 tenders
- Parses: title, budget (initialSum), region, buyer name, docs url
- Auto-infers category from 14 keyword groups

### Sync Endpoint
- `GET/POST /api/sync?secret=<CRON_SECRET>`
- Configured as Vercel cron job (see `vercel.json`)
- Syncs both sources, skips duplicates via `external_id` upsert

---

## Admin Panel (`/admin`)

### Pages
| URL | Description |
|-----|-------------|
| `/admin` | Dashboard: stats, activity chart, recent events |
| `/admin/tenders` | Browse/filter all tenders |
| `/admin/users` | User list with tariff/status |
| `/admin/digests` | Digest send history |
| `/admin/actions` | User-tender action log |
| `/admin/settings` | AI provider configuration |

### Login
- Cookie-based: set `admin_auth=true` via `/api/auth/login`
- Credentials: `ADMIN_PASSWORD` env variable

---

## Environment Variables

```env
# Required
TELEGRAM_BOT_TOKEN=          # Bot token from @BotFather
TELEGRAM_WEBHOOK_SECRET=     # Random secret for webhook verification
NEXT_PUBLIC_SUPABASE_URL=    # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=   # Supabase service role (admin operations)
ADMIN_PASSWORD=              # Admin panel login password

# Optional
MISTRAL_API_KEY=             # Mistral AI API key (enables AI features)
MISTRAL_MODEL=               # Default: mistral-medium-latest
CRON_SECRET=                 # Secret for cron job authentication
```

---

## How to Restore / Roll Back

### Roll back to last stable commit
```bash
git log --oneline -10
git checkout <commit-hash>
```

### Key file locations
```
src/
  app/
    api/
      webhook/route.ts      — Telegram webhook handler
      sync/route.ts         — Tender sync from sources
      digest/route.ts       — Daily digest sender
    admin/                  — Admin panel pages
  lib/
    telegram/
      bot.ts                — Telegram API calls
      keyboards.ts          — All keyboards
      messages.ts           — All message formatters
      handlers/
        commands.ts         — /start, /today, /market, etc.
        callbacks.ts        — Inline button handlers
        messages.ts         — Text message routing
        aichat.ts           — AI chat mode handlers
    tenders/
      service.ts            — DB queries for tenders
      scorer.ts             — Relevance scoring algorithm
      sources/zakupki.ts    — Zakupki.gov.ru source
    users/service.ts        — User DB operations
    favorites/service.ts    — Favorite/action DB operations
    ai/
      provider.ts           — AI provider selection
      mistral.ts            — Mistral implementation
      rule-based.ts         — Fallback (no API needed)
  types/index.ts            — All TypeScript types
supabase/migrations/        — SQL migrations (run in order)
```

### Reset webhook
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://tender-vert.vercel.app/api/webhook&secret_token=<SECRET>"
```

---

## Planned Features (Not Yet Implemented)
- [ ] Tariff management in admin panel (upgrade user from free → basic → pro)
- [ ] Push notifications on new tender matching user profile (real-time, not just digest)
- [ ] Share tender card with colleague via Telegram
- [ ] `/alert` command — custom keyword alerts

---

## Known Issues / Notes
- Timezone: Vercel runs UTC. Admin dashboard uses `formatMoscow()` (UTC+3). Client-side pages use browser timezone.
- MarkdownV2: All Telegram messages must escape: `_ * [ ] ( ) ~ \` > # + - = | { } . !`
- AI chat mode requires `ai_chat_mode` column in users table (migration 002)
- Platform filtering requires `source` column in tenders and `preferred_sources` in user_preferences (migration 003)
