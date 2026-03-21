'use client';

import { useEffect, useState } from 'react';

interface Setting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

const SENSITIVE_KEYS = ['mistral_api_key', 'openai_api_key', 'bot_token'];
const AI_PROVIDERS = ['mistral', 'openai', 'rule-based'];
const MISTRAL_MODELS = ['mistral-medium-latest', 'mistral-large-latest', 'mistral-small-latest', 'open-mistral-7b'];
const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookStatus, setWebhookStatus] = useState('');
  const [botAction, setBotAction] = useState<string | null>(null);
  const [botActionResult, setBotActionResult] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json() as Promise<{ settings: Setting[] }>)
      .then(({ settings }) => {
        setSettings(settings);
        const vals: Record<string, string> = {};
        settings.forEach((s) => { vals[s.key] = s.value; });
        setEditValues(vals);
        setLoading(false);
      });
  }, []);

  async function saveSetting(key: string) {
    setSaving(key);
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: editValues[key] }),
    });
    setSaving(null);
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  }

  async function runBotAction(action: string, label: string) {
    setBotAction(action);
    setBotActionResult('');
    try {
      if (action === 'restart') {
        // Delete then re-set webhook using current URL
        const currentUrl = window.location.origin + '/api/webhook';
        const res = await fetch('/api/webhook/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: currentUrl }),
        });
        const data = await res.json() as { success: boolean };
        setBotActionResult(data.success ? `✅ ${label}: webhook переустановлен на ${currentUrl}` : '❌ Ошибка');
      } else if (action === 'sync') {
        const res = await fetch('/api/sync');
        const data = await res.json() as { ok: boolean; totalFetched: number; totalSaved: number; errors?: string[] };
        if (data.ok) {
          setBotActionResult(`✅ Синхронизация: загружено ${data.totalFetched}, сохранено ${data.totalSaved}${data.errors?.length ? ` (ошибок: ${data.errors.length})` : ''}`);
        } else {
          setBotActionResult('❌ Ошибка синхронизации (zakupki.gov.ru может быть недоступен с серверов Vercel)');
        }
      } else if (action === 'seed') {
        const res = await fetch('/api/seed', { method: 'POST' });
        const data = await res.json() as { ok: boolean; saved: number; total: number };
        setBotActionResult(data.ok ? `✅ Загружено ${data.saved} из ${data.total} тестовых тендеров в базу` : '❌ Ошибка загрузки');
      }
    } catch {
      setBotActionResult('❌ Ошибка выполнения действия');
    } finally {
      setBotAction(null);
    }
  }

  async function setWebhook() {
    setWebhookStatus('Устанавливаю...');
    const res = await fetch('/api/webhook/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = await res.json() as { success: boolean };
    setWebhookStatus(data.success ? '✅ Webhook установлен' : '❌ Ошибка установки');
  }

  if (loading) return <div className="text-slate-400 text-center py-12">Загрузка...</div>;

  const aiSettings = settings.filter((s) => s.key.startsWith('ai_') || s.key.includes('mistral') || s.key.includes('openai') || s.key === 'bot_token');
  const digestSettings = settings.filter((s) => s.key.startsWith('digest'));
  const otherSettings = settings.filter((s) => !aiSettings.includes(s) && !digestSettings.includes(s));

  function renderSettingRow(setting: Setting) {
    const isSensitive = SENSITIVE_KEYS.includes(setting.key);
    const isSelect = setting.key === 'ai_provider' || setting.key === 'mistral_model' || setting.key === 'openai_model';
    const options = setting.key === 'ai_provider' ? AI_PROVIDERS
      : setting.key === 'mistral_model' ? MISTRAL_MODELS
      : setting.key === 'openai_model' ? OPENAI_MODELS : [];

    return (
      <div key={setting.key} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 py-4 border-b border-slate-100 last:border-0">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-semibold text-slate-700">{setting.key}</p>
          {setting.description && (
            <p className="text-xs text-slate-400 mt-0.5">{setting.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 sm:w-80 shrink-0">
          {isSelect ? (
            <select
              className="input flex-1"
              value={editValues[setting.key] ?? ''}
              onChange={(e) => setEditValues((v) => ({ ...v, [setting.key]: e.target.value }))}
            >
              {options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input
              type={isSensitive ? 'password' : 'text'}
              className="input flex-1"
              value={editValues[setting.key] ?? ''}
              onChange={(e) => setEditValues((v) => ({ ...v, [setting.key]: e.target.value }))}
              placeholder={isSensitive ? '••••••••' : ''}
            />
          )}
          <button
            onClick={() => saveSetting(setting.key)}
            disabled={saving === setting.key}
            className={saved === setting.key ? 'btn-secondary text-green-600' : 'btn-secondary'}
          >
            {saving === setting.key ? '...' : saved === setting.key ? '✓' : 'Сохранить'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Настройки</h1>

      {/* AI Provider Section */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-1">AI-провайдер</h2>
        <p className="text-sm text-slate-400 mb-4">
          Смените провайдера или API-ключ — изменения применятся ко всем пользователям немедленно.
        </p>
        <div className="divide-y divide-slate-100">
          {aiSettings.map(renderSettingRow)}
        </div>
      </div>

      {/* Digest Settings */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Рассылка дайджестов</h2>
        <div className="divide-y divide-slate-100">
          {digestSettings.map(renderSettingRow)}
        </div>
      </div>

      {/* Webhook Setup */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-1">Telegram Webhook</h2>
        <p className="text-sm text-slate-400 mb-4">
          Установите webhook URL для получения обновлений от Telegram.
          Формат: <code className="bg-slate-100 px-1 rounded text-xs">https://your-domain.com/api/webhook</code>
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            className="input flex-1"
            placeholder="https://your-domain.com/api/webhook"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
          <button onClick={setWebhook} className="btn-primary">
            Установить
          </button>
        </div>
        {webhookStatus && (
          <p className="text-sm mt-2 text-slate-600">{webhookStatus}</p>
        )}
      </div>

      {/* Bot Management */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-1">Управление ботом</h2>
        <p className="text-sm text-slate-400 mb-4">
          Перезагрузка переустановит webhook на текущий домен. Синхронизация загружает тендеры с zakupki.gov.ru
          <span className="text-amber-600"> (может не работать с серверов Vercel — gov.ru часто блокирует иностранные IP)</span>.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => runBotAction('restart', 'Перезагрузка')}
            disabled={botAction !== null}
            className="btn-primary disabled:opacity-50"
          >
            {botAction === 'restart' ? '⏳ Перезагрузка...' : '🔄 Перезагрузить бота'}
          </button>
          <button
            onClick={() => runBotAction('sync', 'Синхронизация')}
            disabled={botAction !== null}
            className="btn-secondary disabled:opacity-50"
          >
            {botAction === 'sync' ? '⏳ Загрузка...' : '🔃 Синхронизировать тендеры'}
          </button>
          <button
            onClick={() => runBotAction('seed', 'Seed')}
            disabled={botAction !== null}
            className="btn-secondary disabled:opacity-50"
          >
            {botAction === 'seed' ? '⏳ Загрузка...' : '🌱 Загрузить тестовые тендеры'}
          </button>
        </div>
        {botActionResult && (
          <p className="text-sm mt-3 text-slate-600">{botActionResult}</p>
        )}
      </div>

      {/* Other Settings */}
      {otherSettings.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Прочее</h2>
          <div className="divide-y divide-slate-100">
            {otherSettings.map(renderSettingRow)}
          </div>
        </div>
      )}
    </div>
  );
}
