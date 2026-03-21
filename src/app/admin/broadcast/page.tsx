'use client';

import { useState } from 'react';

interface Result {
  sent: number;
  failed: number;
  total: number;
}

export default function BroadcastPage() {
  const [message, setMessage] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [photoUrl, setPhotoUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  async function handleSend() {
    if (!message.trim()) return;
    const audience = activeOnly ? 'активным' : 'всем';
    if (!confirm(`Отправить сообщение ${audience} пользователям?`)) return;

    setLoading(true);
    setResult(null);
    setError('');

    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          activeOnly,
          photoUrl: photoUrl.trim() || undefined,
          linkLabel: linkLabel.trim() || undefined,
          linkUrl: linkUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка отправки');
      setResult(data);
      setMessage('');
      setPhotoUrl('');
      setLinkLabel('');
      setLinkUrl('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Рассылка</h1>
        <p className="text-slate-500 text-sm mt-1">Отправка сообщения всем пользователям бота</p>
      </div>

      <div className="card p-6 space-y-5">
        {/* Message text */}
        <div>
          <label className="label">Текст сообщения <span className="text-red-500">*</span></label>
          <textarea
            className="input mt-1 w-full h-36 resize-none font-mono text-sm"
            placeholder={'Напишите текст рассылки...\n\nПоддерживается Markdown:\n*жирный*, _курсив_'}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={loading}
          />
          <p className="text-xs text-slate-400 mt-1">{message.length} символов</p>
        </div>

        {/* Photo */}
        <div>
          <label className="label">
            📷 Фото{' '}
            <span className="text-slate-400 font-normal text-xs">(URL — опционально)</span>
          </label>
          <input
            type="url"
            className="input mt-1 w-full"
            placeholder="https://example.com/image.jpg"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Link button */}
        <div>
          <label className="label">
            🔗 Кнопка-ссылка{' '}
            <span className="text-slate-400 font-normal text-xs">(для рекламы/анонса)</span>
          </label>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <input
              type="text"
              className="input"
              placeholder="Текст кнопки: 🌐 Наш сайт"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              disabled={loading}
            />
            <input
              type="url"
              className="input"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              disabled={loading}
            />
          </div>
          {linkLabel && linkUrl && (
            <p className="text-xs text-brand-600 mt-1">
              ✅ Кнопка: <strong>{linkLabel}</strong> → {linkUrl}
            </p>
          )}
        </div>

        {/* Active only */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="activeOnly"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="w-4 h-4 text-brand-600 rounded"
            disabled={loading}
          />
          <label htmlFor="activeOnly" className="text-sm text-slate-700 cursor-pointer">
            Только активные пользователи
          </label>
        </div>

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-medium text-sm">✅ Рассылка отправлена</p>
            <p className="text-green-700 text-sm mt-1">
              Доставлено: <strong>{result.sent}</strong> из {result.total} · Ошибок: {result.failed}
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 text-sm">❌ {error}</p>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={loading || !message.trim()}
          className="btn-primary w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '⏳ Отправка...' : '📣 Отправить рассылку'}
        </button>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-3 text-sm">Примеры форматирования</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
          <div className="bg-slate-50 rounded p-3 font-mono">*жирный текст*</div>
          <div className="bg-slate-50 rounded p-3 font-mono">_курсивный текст_</div>
          <div className="bg-slate-50 rounded p-3 font-mono">`inline код`</div>
          <div className="bg-slate-50 rounded p-3 font-mono">[ссылка](https://...)</div>
        </div>
        <p className="text-xs text-amber-600 mt-3">
          ⚠️ Спецсимволы ( . ! - ( ) ) нужно экранировать: <code className="bg-slate-100 px-1 rounded">\.</code>
        </p>
      </div>
    </div>
  );
}
