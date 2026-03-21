'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { clsx } from 'clsx';

interface DigestRow {
  id: string;
  sent_at: string;
  tenders_count: number;
  status: string;
  error_message: string | null;
  user: { full_name: string | null; username: string | null; telegram_id: string } | null;
}

const STATUS_BADGE: Record<string, string> = {
  sent: 'badge-green',
  failed: 'badge-red',
  skipped: 'badge-yellow',
};

const STATUS_LABEL: Record<string, string> = {
  sent: '✅ Отправлен',
  failed: '❌ Ошибка',
  skipped: '⏭ Пропущен',
};

export default function DigestsPage() {
  const [logs, setLogs] = useState<DigestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function loadLogs() {
    const res = await fetch('/api/logs?type=digest');
    const { logs } = await res.json() as { logs: DigestRow[] };
    setLogs(logs);
    setLoading(false);
  }

  useEffect(() => { loadLogs(); }, []);

  async function triggerDigest() {
    setSending(true);
    await fetch('/api/digest', {
      method: 'POST',
      headers: { Authorization: `Bearer ${prompt('Введите CRON_SECRET:') ?? ''}` },
    });
    setSending(false);
    loadLogs();
  }

  const stats = {
    total: logs.length,
    sent: logs.filter((l) => l.status === 'sent').length,
    failed: logs.filter((l) => l.status === 'failed').length,
    totalTenders: logs.reduce((sum, l) => sum + l.tenders_count, 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Дайджесты</h1>
        <button
          onClick={triggerDigest}
          disabled={sending}
          className="btn-primary"
        >
          {sending ? 'Отправляю...' : '📨 Запустить рассылку'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Всего отправок', value: stats.total },
          { label: 'Успешно', value: stats.sent },
          { label: 'Ошибок', value: stats.failed },
          { label: 'Тендеров доставлено', value: stats.totalTenders },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card">
            <p className="text-slate-500 text-sm">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Загрузка...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-header">Пользователь</th>
                  <th className="table-header">Статус</th>
                  <th className="table-header">Тендеров</th>
                  <th className="table-header">Время</th>
                  <th className="table-header">Ошибка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="table-cell">
                      <p className="font-medium">{log.user?.full_name ?? log.user?.username ?? '—'}</p>
                      <p className="text-xs text-slate-400">TG: {log.user?.telegram_id}</p>
                    </td>
                    <td className="table-cell">
                      <span className={clsx('badge', STATUS_BADGE[log.status])}>
                        {STATUS_LABEL[log.status] ?? log.status}
                      </span>
                    </td>
                    <td className="table-cell font-semibold">{log.tenders_count}</td>
                    <td className="table-cell text-slate-400">
                      {format(new Date(log.sent_at), 'd MMM yyyy, HH:mm', { locale: ru })}
                    </td>
                    <td className="table-cell">
                      {log.error_message && (
                        <span className="text-red-500 text-xs">{log.error_message}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table-cell text-center text-slate-400 py-8">
                      История рассылок пуста
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
