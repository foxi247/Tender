'use client';

import { useState } from 'react';

interface BroadcastResult {
  ok: boolean;
  sent: number;
  failed: number;
  total: number;
}

export default function BroadcastKeyboardButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);

  const [updateText, setUpdateText] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  function reset() {
    setUpdateText('');
    setPhotoUrl('');
    setLinkLabel('');
    setLinkUrl('');
    setResult(null);
  }

  async function handleSend() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/broadcast-keyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateText: updateText.trim() || undefined,
          photoUrl: photoUrl.trim() || undefined,
          linkLabel: linkLabel.trim() || undefined,
          linkUrl: linkUrl.trim() || undefined,
        }),
      });
      const data: BroadcastResult = await res.json();
      setResult(data);
    } catch {
      setResult({ ok: false, sent: 0, failed: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={() => { setOpen(true); reset(); }} className="btn-secondary">
        📲 Обновить клавиатуру
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">📲 Рассылка обновления</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ×
              </button>
            </div>

            {result ? (
              <div className={`rounded-xl p-4 text-center space-y-2 ${result.sent > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-2xl">{result.sent > 0 ? '✅' : '❌'}</p>
                <p className="font-semibold text-slate-800">
                  Отправлено: {result.sent} / {result.total}
                </p>
                {result.failed > 0 && (
                  <p className="text-sm text-red-600">Не доставлено: {result.failed}</p>
                )}
                <div className="flex gap-2 justify-center mt-3">
                  <button
                    onClick={() => { setResult(null); reset(); }}
                    className="btn-secondary text-sm"
                  >
                    Новая рассылка
                  </button>
                  <button onClick={() => setOpen(false)} className="btn-primary text-sm">
                    Закрыть
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* What changed */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Что обновилось? <span className="text-slate-400 font-normal">(опционально)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={updateText}
                    onChange={(e) => setUpdateText(e.target.value)}
                    placeholder="Например: добавили новые площадки, исправили фильтр категорий, ускорили поиск..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Если оставить пустым — будет стандартное сообщение об обновлении
                  </p>
                </div>

                {/* Photo URL */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Фото <span className="text-slate-400 font-normal">(URL, опционально)</span>
                  </label>
                  <input
                    type="url"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Link button */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Кнопка-ссылка
                    </label>
                    <input
                      type="text"
                      value={linkLabel}
                      onChange={(e) => setLinkLabel(e.target.value)}
                      placeholder="Например: 🌐 Наш сайт"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      URL кнопки
                    </label>
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                {/* Preview hint */}
                <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
                  <p className="font-medium text-slate-600">Превью сообщения:</p>
                  <p>
                    {updateText.trim()
                      ? `🔄 Обновление бота\n\n${updateText.trim()}`
                      : '🔄 Бот обновлён! Меню обновлено — используйте кнопки ниже.'}
                  </p>
                  {linkLabel && linkUrl && (
                    <p className="mt-1">
                      <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">{linkLabel}</span>
                      {' '}→ {linkUrl}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setOpen(false)}
                    className="btn-secondary flex-1"
                    disabled={loading}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleSend}
                    className="btn-primary flex-1"
                    disabled={loading}
                  >
                    {loading ? '⏳ Отправка...' : '📤 Отправить всем'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
