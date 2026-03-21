'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { User } from '@/types';
import { clsx } from 'clsx';

const TARIFF_BADGE: Record<string, string> = {
  free: 'badge-gray',
  basic: 'badge-blue',
  pro: 'badge-purple',
};

const TARIFF_LABEL: Record<string, string> = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, newToday: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json() as Promise<{ users: User[]; stats: typeof stats }>)
      .then(({ users, stats }) => {
        setUsers(users);
        setStats(stats);
        setLoading(false);
      });
  }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      !q ||
      u.full_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.telegram_id.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Пользователи</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-slate-500 text-sm">Всего</p>
          <p className="text-3xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="stat-card">
          <p className="text-slate-500 text-sm">Активных</p>
          <p className="text-3xl font-bold mt-1">{stats.active}</p>
        </div>
        <div className="stat-card">
          <p className="text-slate-500 text-sm">Новых сегодня</p>
          <p className="text-3xl font-bold mt-1">{stats.newToday}</p>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <input
            type="text"
            className="input max-w-sm"
            placeholder="Поиск по имени, username, Telegram ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Загрузка...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-header">Пользователь</th>
                  <th className="table-header">Telegram ID</th>
                  <th className="table-header">Зарегистрирован</th>
                  <th className="table-header">Последняя активность</th>
                  <th className="table-header">Тариф</th>
                  <th className="table-header">Статус</th>
                  <th className="table-header">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-sm font-semibold">
                          {(user.full_name ?? user.username ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{user.full_name ?? '—'}</p>
                          {user.username && <p className="text-xs text-slate-400">@{user.username}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell font-mono text-xs text-slate-600">
                      {user.telegram_id}
                    </td>
                    <td className="table-cell text-slate-500">
                      {format(new Date(user.created_at), 'd MMM yyyy', { locale: ru })}
                    </td>
                    <td className="table-cell text-slate-500">
                      {user.last_active_at
                        ? format(new Date(user.last_active_at), 'd MMM, HH:mm', { locale: ru })
                        : '—'}
                    </td>
                    <td className="table-cell">
                      <span className={clsx('badge', TARIFF_BADGE[user.tariff_plan])}>
                        {TARIFF_LABEL[user.tariff_plan]}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={clsx('badge', user.is_active ? 'badge-green' : 'badge-red')}>
                        {user.is_active ? 'Активен' : 'Заблокирован'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <a
                        href={`https://t.me/${user.username ?? user.telegram_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:text-brand-700 text-xs font-medium"
                      >
                        Открыть в TG ↗
                      </a>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="table-cell text-center text-slate-400 py-8">
                      Пользователи не найдены
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
