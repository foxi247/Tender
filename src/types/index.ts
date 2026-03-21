// =============================================
// Core Domain Types
// =============================================

export type TariffPlan = 'free' | 'basic' | 'pro';
export type TenderStatus = 'active' | 'closed' | 'cancelled' | 'awarded';
export type ActionType = 'favorite' | 'in_work' | 'hidden' | 'viewed';
export type DigestStatus = 'sent' | 'failed' | 'skipped';
export type LawType = '44-FZ' | '223-FZ' | 'commercial' | 'other';
export type AIProvider = 'mistral' | 'openai' | 'rule-based';

// =============================================
// Database Models (mirrors Supabase tables)
// =============================================

export interface User {
  id: string;
  telegram_id: string;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  tariff_plan: TariffPlan;
  last_active_at: string | null;
  ai_chat_mode: boolean;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  categories: string[];
  regions: string[];
  min_budget: number | null;
  max_budget: number | null;
  keywords: string[];
  excluded_keywords: string[];
  preferred_laws: LawType[];
  delivery_radius: number | null;
  created_at: string;
  updated_at: string;
}

export interface Tender {
  id: string;
  external_id: string;
  title: string;
  description: string | null;
  category: string | null;
  region: string | null;
  buyer_name: string | null;
  law_type: LawType | null;
  budget: number | null;
  published_at: string | null;
  deadline_at: string | null;
  source_url: string | null;
  docs_url: string | null;
  status: TenderStatus;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserTenderAction {
  id: string;
  user_id: string;
  tender_id: string;
  action_type: ActionType;
  created_at: string;
  tender?: Tender;
}

export interface DailyDigest {
  id: string;
  user_id: string;
  sent_at: string;
  tenders_count: number;
  payload: Record<string, unknown>;
  status: DigestStatus;
  error_message: string | null;
}

export interface BotLog {
  id: string;
  user_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AppSettings {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

// =============================================
// Scored Tender (with relevance score)
// =============================================

export interface ScoredTender extends Tender {
  score: number;
  score_reasons: string[];
  ai_summary: string | null;
  ai_why_recommended: string | null;
}

// =============================================
// Telegram types
// =============================================

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
  date: number;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
}

// =============================================
// AI Provider Interface
// =============================================

export interface MarketStats {
  totalActive: number;
  newThisWeek: number;
  avgBudget: number | null;
  medianBudget: number | null;
  maxBudget: number | null;
  topCategories: Array<{ name: string; count: number; avgBudget: number | null }>;
  topRegions: Array<{ name: string; count: number }>;
  budgetRanges: {
    under1m: number;
    from1to5m: number;
    from5to20m: number;
    over20m: number;
  };
  fetchedAt: string;
}

export interface AIProviderInterface {
  summarizeTender(tender: Tender): Promise<string>;
  explainWhyRecommended(tender: Tender, preferences: UserPreferences): Promise<string>;
  classifyUserIntent(text: string): Promise<UserIntent>;
  analyzeTenderDocumentation(docsUrl: string): Promise<string>;
  analyzeMarket(stats: MarketStats, category?: string): Promise<string>;
  chatWithHistory(userId: string, userMessage: string): Promise<string>;
}

export interface UserIntent {
  type: 'search' | 'favorites' | 'inwork' | 'hidden' | 'filters' | 'help' | 'market' | 'unknown';
  keywords: string[];
  category?: string;
  region?: string;
  maxBudget?: number;
  timeRange?: 'today' | '3days' | 'week';
  confidence: number;
}

// =============================================
// API Request/Response types
// =============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TenderSearchParams {
  query?: string;
  category?: string;
  region?: string;
  minBudget?: number;
  maxBudget?: number;
  lawType?: LawType;
  status?: TenderStatus;
  page?: number;
  pageSize?: number;
  sortBy?: 'budget' | 'deadline_at' | 'published_at' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

// =============================================
// Digest types
// =============================================

export interface DigestPayload {
  tenders: ScoredTender[];
  summary: string;
  total_found: number;
  sent_at: string;
}

// =============================================
// Tender Source Provider
// =============================================

export interface TenderSourceProvider {
  fetchTenders(params?: FetchTendersParams): Promise<Tender[]>;
  fetchTenderById(externalId: string): Promise<Tender | null>;
}

export interface FetchTendersParams {
  category?: string;
  region?: string;
  publishedAfter?: Date;
  limit?: number;
}
