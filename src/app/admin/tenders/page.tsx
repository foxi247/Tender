'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatBudget } from '@/lib/tenders/scorer';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Tender, PaginatedResponse } from '@/types';
import { clsx } from 'clsx';

const LAW_BADGE: Record<string, string> = {
  '44-FZ': 'badge-blue',
  '223-FZ': 'badge-purple',
  commercial: 'badge-green',
  other: 'badge-gray',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-green',
  closed: 'badge-gray',
  cancelled: 'badge-red',
  awarded: 'badge-yellow',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Активный',
  closed: 'Закрыт',
  cancelled: 'Отменён',
  awarded: 'Заключён',
};

export default function TendersPage() {
  const [data, setData] = useState<PaginatedResponse<Tender> | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [region, setRegion] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchTenders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '15',
      status,
      ...(query && { query }),
      ...(category && { category }),
      ...(region && { region }),
    });
    const res = await fetch(`/api/tenders?${params}`);
    const json = await res.json() as PaginatedResponse<Tender>;
    setData(json);
    setLoading(false);
  }, [page, status, query, category, region]);

  useEffect(() => {
    fetchTenders();
  }, [fetchTenders]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchTenders();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Тендеры</h1>
        {data && (
          <span className="badge badge-blue">{data.total} тендеров</span>
        )}
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            className="input"
            placeholder="Поиск по названию..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <input
            type="text"
            className="input"
            placeholder="Категория"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <input
            type="text"
            className="input"
            placeholder="Регион"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="active">Активные</option>
            <option value="closed">Закрытые</option>
            <option value="cancelled">Отменённые</option>
            <option value="awarded">Заключённые</option>
          </select>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="submit" className="btn-primary">🔍 Найти</button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => { setQuery(''); setCategory(''); setRegion(''); setStatus('active'); setPage(1); }}
          >
            Сбросить
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Загрузка...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="table-header">Название</th>
                    <th className="table-header">Бюджет</th>
                    <th className="table-header">Регион</th>
                    <th className="table-header">Дедлайн</th>
                    <th className="table-header">Закон</th>
                    <th className="table-header">Статус</th>
                    <th className="table-header">Ссылки</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.items.map((tender) => {
                    const daysLeft = tender.deadline_at
                      ? Math.ceil((new Date(tender.deadline_at).getTime() - Date.now()) / 86400000)
                      : null;
                    return (
                      <tr key={tender.id} className="hover:bg-slate-50 transition-colors">
                        <td className="table-cell max-w-xs">
                          <p className="font-medium text-slate-800 line-clamp-2 text-sm">
                            {tender.title}
                          </p>
                          {tender.buyer_name && (
                            <p className="text-xs text-slate-400 mt-0.5">{tender.buyer_name}</p>
                          )}
                        </td>
                        <td className="table-cell font-semibold text-slate-900 whitespace-nowrap">
                          {tender.budget ? formatBudget(tender.budget) : '—'}
                        </td>
                        <td className="table-cell text-slate-600 whitespace-nowrap">
                          {tender.region ?? '—'}
                        </td>
                        <td className="table-cell whitespace-nowrap">
                          {tender.deadline_at ? (
                            <div>
                              <p className="text-sm">{format(new Date(tender.deadline_at), 'd MMM', { locale: ru })}</p>
                              <p className={clsx('text-xs', daysLeft !== null && daysLeft <= 3 ? 'text-red-500 font-medium' : 'text-slate-400')}>
                                {daysLeft !== null ? (daysLeft > 0 ? `${daysLeft} дн.` : 'Истёк') : ''}
                              </p>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="table-cell">
                          {tender.law_type && (
                            <span className={clsx('badge', LAW_BADGE[tender.law_type] ?? 'badge-gray')}>
                              {tender.law_type}
                            </span>
                          )}
                        </td>
                        <td className="table-cell">
                          <span className={clsx('badge', STATUS_BADGE[tender.status] ?? 'badge-gray')}>
                            {STATUS_LABEL[tender.status] ?? tender.status}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex gap-1.5">
                            {tender.source_url && (
                              <a
                                href={tender.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-brand-600 hover:text-brand-700 text-xs font-medium"
                              >
                                Закупка ↗
                              </a>
                            )}
                            {tender.docs_url && (
                              <a
                                href={tender.docs_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-500 hover:text-slate-700 text-xs"
                              >
                                Доки ↗
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {data?.items.length === 0 && (
                    <tr>
                      <td colSpan={7} className="table-cell text-center text-slate-400 py-8">
                        Тендеры не найдены
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Страница {data.page} из {data.totalPages} · {data.total} тендеров
                </p>
                <div className="flex gap-2">
                  <button
                    className="btn-secondary"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    ← Назад
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Вперёд →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
