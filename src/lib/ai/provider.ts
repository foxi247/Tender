import { createServiceClient } from '@/lib/supabase/server';
import type { AIProviderInterface } from '@/types';
import { MistralProvider } from './mistral';
import { RuleBasedProvider } from './rule-based';
import { logger } from '@/lib/logger';

// Cached provider to avoid DB calls on every request
let cachedProvider: AIProviderInterface | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getAIProvider(): Promise<AIProviderInterface> {
  if (cachedProvider && Date.now() < cacheExpiry) {
    return cachedProvider;
  }

  cachedProvider = await resolveProvider();
  cacheExpiry = Date.now() + CACHE_TTL;
  return cachedProvider;
}

async function resolveProvider(): Promise<AIProviderInterface> {
  try {
    const supabase = createServiceClient();

    // Get settings from DB (admin can override via dashboard)
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['ai_provider', 'mistral_api_key', 'mistral_model', 'openai_api_key', 'openai_model']);

    const settingsMap = Object.fromEntries(
      (settings ?? []).map((s: { key: string; value: string }) => [s.key, s.value])
    );

    const provider = settingsMap['ai_provider'] || process.env.AI_PROVIDER || 'rule-based';

    logger.info(`Using AI provider: ${provider}`);

    switch (provider) {
      case 'mistral': {
        const apiKey =
          settingsMap['mistral_api_key'] ||
          process.env.MISTRAL_API_KEY ||
          '';
        const model =
          settingsMap['mistral_model'] ||
          process.env.MISTRAL_MODEL ||
          'mistral-medium-latest';

        if (!apiKey) {
          logger.warn('Mistral API key not found, falling back to rule-based');
          return new RuleBasedProvider();
        }

        return new MistralProvider(apiKey, model);
      }

      case 'openai': {
        // OpenAI provider placeholder
        logger.warn('OpenAI provider not implemented yet, using rule-based');
        return new RuleBasedProvider();
      }

      case 'rule-based':
      default:
        return new RuleBasedProvider();
    }
  } catch (err) {
    logger.error('Failed to resolve AI provider', { err });
    return new RuleBasedProvider();
  }
}

// Invalidate cache when settings change
export function invalidateAIProviderCache(): void {
  cachedProvider = null;
  cacheExpiry = 0;
}
