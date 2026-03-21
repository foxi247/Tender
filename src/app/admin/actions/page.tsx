'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { clsx } from 'clsx';
import { formatBudget } from '@/lib/tenders/scorer';

const ACTION_CONFIG: Record<string, { label: string; badge: string; icon: string }> = {
  favorite: { label: 'Избранное', badge: 'badge-yellow', icon: '❤️' },
  in_work: { label: 'В работе', badge: 'badge-blue', icon: '🔧' },
  hidden: { label: 'Скрыт', badge: 'badge-gray', icon: '🙈' },
  viewed: { label: 'Просмотрен', badge: 'badge-green', icon: '👁' },
};

interface ActionRow {
  id: string;
  action_type: string;
  created_at: string;
  user: { full_name: string | null; username: string | null; telegram_id: string } | null;
  tender: { title: string; budget: number | null; region: string | null; source_url: string | null } | null;
}

export default function ActionsPage() {
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let query = supabase
      .from('user_tender_actions')
      .select('*, user:users(full_name, username, telegram_id), tender:tenders(title, budget, region, source_url)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filterType !== 'all') {
      query = query.eq('action_type', filterType);
    }

    query.then(({ data }) => {
      setActions((data as ActionRow[]) ?? []);
      setLoading(false);
    });
  }, [filterType]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Действия пользователей</h1>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: 'Все' },
          { value: 'favorite', label: '❤️ Избранное' },
          { value: 'in_work', label: '🔧 В работе' },
          { value: 'hidden', label: '🙈 Скрытые' },
          { value: 'viewed', label: '👁 Просмотры' },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => { setFilterType(value); setLoading(true); }}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filterType === value
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Загрузка...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-header">Пользователь</th>
                  <th className="table-header">Действие</th>
                  <th className="table-header">Тендер</th>
                  <th className="table-header">Бюджет</th>
                  <th className="table-header">Регион</th>
                  <th className="table-header">Время</th>
                  <th className="table-header">Ссылка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actions.map((action) => {
                  const cfg = ACTION_CONFIG[action.action_type];
                  return (
                    <tr key={action.id} className="hover:bg-slate-50">
                      <td className="table-cell">
                        <p className="font-medium text-sm">
                          {action.user?.full_name ?? action.user?.username ?? '—'}
                        </p>
                        <p className="text-xs text-slate-400">@{action.user?.username ?? action.user?.telegram_id}</p>
                      </td>
                      <td className="table-cell">
                        <span className={clsx('badge', cfg?.badge)}>
                          {cfg?.icon} {cfg?.label}
                        </span>
                      </td>
                      <td className="table-cell max-w-xs">
                        <p className="text-sm line-clamp-2">{action.tender?.title ?? '—'}</p>
                      </td>
                      <td className="table-cell font-semibold whitespace-nowrap">
                        {action.tender?.budget ? formatBudget(action.tender.budget) : '—'}
                      </td>
                      <td className="table-cell">{action.tender?.region ?? '—'}</td>
                      <td className="table-cell whitespace-nowrap text-slate-400">
                        {format(new Date(action.created_at), 'd MMM, HH:mm', { locale: ru })}
                      </td>
                      <td className="table-cell">
                        {action.tender?.source_url && (
                          <a
                            href={action.tender.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-600 text-xs hover:underline"
                          >
                            Открыть ↗
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {actions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="table-cell text-center text-slate-400 py-8">
                      Нет данных
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
