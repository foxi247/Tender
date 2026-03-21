'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface PrefRow {
  id: string;
  user_id: string;
  categories: string[];
  regions: string[];
  min_budget: number | null;
  max_budget: number | null;
  keywords: string[];
  excluded_keywords: string[];
  preferred_laws: string[];
  user: { full_name: string | null; username: string | null; telegram_id: string } | null;
}

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState<PrefRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('user_preferences')
      .select('*, user:users(full_name, username, telegram_id)')
      .then(({ data }) => {
        setPrefs((data as PrefRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-slate-400 text-center py-12">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Предпочтения пользователей</h1>

      <div className="space-y-4">
        {prefs.map((pref) => (
          <div key={pref.id} className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-semibold text-slate-900">
                  {pref.user?.full_name ?? pref.user?.username ?? `ID: ${pref.user_id.slice(0, 8)}`}
                </p>
                {pref.user?.username && (
                  <p className="text-sm text-slate-400">@{pref.user.username}</p>
                )}
              </div>
              <span className="text-xs text-slate-400 font-mono">
                TG: {pref.user?.telegram_id ?? '—'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Категории</p>
                <div className="flex flex-wrap gap-1">
                  {pref.categories.length > 0
                    ? pref.categories.map((c) => (
                        <span key={c} className="badge badge-blue">{c}</span>
                      ))
                    : <span className="text-slate-400 text-sm">Не указаны</span>}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Регионы</p>
                <div className="flex flex-wrap gap-1">
                  {pref.regions.length > 0
                    ? pref.regions.map((r) => (
                        <span key={r} className="badge badge-green">{r}</span>
                      ))
                    : <span className="text-slate-400 text-sm">Не указаны</span>}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Бюджет</p>
                <p className="text-sm text-slate-700">
                  {pref.min_budget || pref.max_budget
                    ? `${pref.min_budget ? `от ${(pref.min_budget / 1000).toFixed(0)}к` : ''} ${pref.max_budget ? `до ${(pref.max_budget / 1_000_000).toFixed(1)}млн` : ''}`
                    : 'Без ограничений'}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Ключевые слова</p>
                <div className="flex flex-wrap gap-1">
                  {pref.keywords.length > 0
                    ? pref.keywords.map((k) => (
                        <span key={k} className="badge badge-purple">{k}</span>
                      ))
                    : <span className="text-slate-400 text-sm">Не указаны</span>}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Законы</p>
                <div className="flex flex-wrap gap-1">
                  {pref.preferred_laws.length > 0
                    ? pref.preferred_laws.map((l) => (
                        <span key={l} className="badge badge-yellow">{l}</span>
                      ))
                    : <span className="text-slate-400 text-sm">Любые</span>}
                </div>
              </div>

              {pref.excluded_keywords.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Исключения</p>
                  <div className="flex flex-wrap gap-1">
                    {pref.excluded_keywords.map((k) => (
                      <span key={k} className="badge badge-red">{k}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {prefs.length === 0 && (
          <div className="card p-12 text-center text-slate-400">
            Нет данных о предпочтениях
          </div>
        )}
      </div>
    </div>
  );
}
