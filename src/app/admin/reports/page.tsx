import { createServiceClient } from '@/lib/supabase/server';
import { formatMoscow } from '@/lib/utils/date';
import PeriodSelector from './PeriodSelector';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

type Period = 'today' | 'week' | 'month' | 'custom';

function getPeriodRange(period: Period, from?: string, to?: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (period === 'custom' && from && to) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const customEnd = new Date(to);
    customEnd.setHours(23, 59, 59, 999);
    return { start, end: customEnd, label: `${from} — ${to}` };
  }
  if (period === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end, label: 'Последние 7 дней' };
  }
  if (period === 'month') {
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { start, end, label: 'Последние 30 дней' };
  }
  // today
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { start, end, label: 'Сегодня' };
}

const EVENT_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  sync:              { label: 'Синхронизация', icon: '🔄', color: 'bg-blue-100 text-blue-700' },
  command_today:     { label: 'Тендеры сегодня', icon: '📋', color: 'bg-green-100 text-green-700' },
  command_market:    { label: 'Анализ рынка', icon: '📊', color: 'bg-purple-100 text-purple-700' },
  ai_chat_open:      { label: 'ИИ чат открыт', icon: '🤖', color: 'bg-orange-100 text-orange-700' },
  ai_chat_message:   { label: 'ИИ сообщение', icon: '💬', color: 'bg-orange-100 text-orange-700' },
  ai_chat_close:     { label: 'ИИ чат закрыт', icon: '🤖', color: 'bg-slate-100 text-slate-600' },
  command_start:     { label: '/start', icon: '👋', color: 'bg-teal-100 text-teal-700' },
  command_favorites: { label: 'Избранное', icon: '❤️', color: 'bg-red-100 text-red-700' },
  command_inwork:    { label: 'В работе', icon: '🔧', color: 'bg-yellow-100 text-yellow-700' },
  command_filters:   { label: 'Фильтры', icon: '⚙️', color: 'bg-slate-100 text-slate-600' },
  command_help:      { label: 'Помощь', icon: '❓', color: 'bg-slate-100 text-slate-600' },
  digest_sent:       { label: 'Дайджест отправлен', icon: '📨', color: 'bg-indigo-100 text-indigo-700' },
};

async function getReportData(start: Date, end: Date) {
  const supabase = createServiceClient();
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const [{ data: logs }, { data: digests }, { count: syncCount }] = await Promise.all([
    supabase
      .from('bot_logs')
      .select('id, event_type, payload, created_at, user:users(full_name, username, telegram_id)')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('daily_digests')
      .select('id, user_id, tenders_count, status, sent_at, user:users(full_name, username)')
      .gte('sent_at', startIso)
      .lte('sent_at', endIso)
      .order('sent_at', { ascending: false })
      .limit(100),
    supabase
      .from('bot_logs')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'sync')
      .gte('created_at', startIso)
      .lte('created_at', endIso),
  ]);

  const allLogs = logs ?? [];
  const allDigests = digests ?? [];

  // Summary counts
  const syncRuns = syncCount ?? 0;
  const aiMessages = allLogs.filter((l) => l.event_type === 'ai_chat_message').length;
  const marketAnalyses = allLogs.filter((l) => l.event_type === 'command_market').length;
  const digestsSent = allDigests.filter((d) => d.status === 'sent').length;
  const uniqueUsers = new Set(allLogs.filter((l) => l.user).map((l) => (l.user as Record<string, string>)?.telegram_id)).size;

  // Last sync details
  const lastSync = allLogs.find((l) => l.event_type === 'sync');
  const lastSyncPayload = lastSync?.payload as Record<string, unknown> | null;

  return { allLogs, allDigests, syncRuns, aiMessages, marketAnalyses, digestsSent, uniqueUsers, lastSync, lastSyncPayload };
}

interface PageProps {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = (params.period ?? 'today') as Period;
  const { start, end, label } = getPeriodRange(period, params.from, params.to);

  const {
    allLogs, allDigests, syncRuns, aiMessages, marketAnalyses, digestsSent, uniqueUsers, lastSyncPayload,
  } = await getReportData(start, end);

  const stats = [
    { label: 'Синхронизаций', value: syncRuns, icon: '🔄', color: 'bg-blue-500', sub: lastSyncPayload ? `+${(lastSyncPayload.bico as Record<string,number>)?.saved ?? 0} тендеров последний раз` : 'нет данных' },
    { label: 'ИИ сообщений', value: aiMessages, icon: '🤖', color: 'bg-orange-500', sub: 'запросов через ИИ Чат' },
    { label: 'Анализов рынка', value: marketAnalyses, icon: '📊', color: 'bg-purple-500', sub: 'запущено пользователями' },
    { label: 'Дайджестов', value: digestsSent, icon: '📨', color: 'bg-green-500', sub: 'успешно отправлено' },
    { label: 'Активных польз.', value: uniqueUsers, icon: '👥', color: 'bg-teal-500', sub: 'за выбранный период' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Отчёты</h1>
        <p className="text-slate-500 text-sm mt-1">Активность ИИ и бота — {label}</p>
      </div>

      {/* Period selector */}
      <Suspense>
        <PeriodSelector current={period} />
      </Suspense>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-start justify-between mb-2">
              <div className={`w-9 h-9 ${stat.color} rounded-xl flex items-center justify-center text-lg`}>
                {stat.icon}
              </div>
              <span className="text-2xl font-bold text-slate-900">{stat.value}</span>
            </div>
            <p className="text-slate-600 text-sm font-medium">{stat.label}</p>
            <p className="text-slate-400 text-xs mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Digest results */}
      {allDigests.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">📨 Утренние дайджесты</h2>
            <span className="text-sm text-slate-400">{allDigests.length} записей</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Пользователь</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Тендеров</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Статус</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Время</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allDigests.slice(0, 50).map((d) => {
                  const user = d.user as Record<string, string> | null;
                  return (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 text-slate-700">
                        {user?.full_name ?? user?.username ?? '—'}
                      </td>
                      <td className="px-6 py-3 text-slate-600">{d.tenders_count}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          d.status === 'sent' ? 'bg-green-100 text-green-700' :
                          d.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {d.status === 'sent' ? '✓ Отправлен' : d.status === 'failed' ? '✗ Ошибка' : 'Пропущен'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-400 text-xs">
                        {d.sent_at ? formatMoscow(d.sent_at, 'dd.MM HH:mm') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sync history */}
      {(() => {
        const syncLogs = allLogs.filter((l) => l.event_type === 'sync');
        if (syncLogs.length === 0) return null;
        return (
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">🔄 История синхронизаций</h2>
              <span className="text-sm text-slate-400">{syncLogs.length} запусков</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Время</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Получено</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Сохранено</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Время (мс)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {syncLogs.slice(0, 30).map((log) => {
                    const p = log.payload as Record<string, unknown> | null;
                    const bico = p?.bico as Record<string, number> | null;
                    return (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-slate-500 text-xs">
                          {formatMoscow(log.created_at, 'dd.MM.yy HH:mm')}
                        </td>
                        <td className="px-6 py-3 text-slate-700 font-medium">{bico?.fetched ?? '—'}</td>
                        <td className="px-6 py-3 text-green-600 font-medium">+{bico?.saved ?? '—'}</td>
                        <td className="px-6 py-3 text-slate-400 text-xs">{p?.ms ? `${p.ms}ms` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* All events log */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">📋 Все события бота</h2>
          <span className="text-sm text-slate-400">{allLogs.filter((l) => l.event_type !== 'sync').length} событий</span>
        </div>
        <div className="divide-y divide-slate-50">
          {allLogs.filter((l) => l.event_type !== 'sync').slice(0, 100).map((log) => {
            const user = log.user as Record<string, string> | null;
            const meta = EVENT_LABELS[log.event_type] ?? { label: log.event_type, icon: '•', color: 'bg-slate-100 text-slate-600' };
            const payload = log.payload as Record<string, unknown> | null;
            return (
              <div key={log.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${meta.color}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 truncate">
                      {user?.full_name ?? user?.username ?? `tg:${user?.telegram_id ?? '—'}`}
                    </p>
                    {payload?.text && (
                      <p className="text-xs text-slate-400 truncate max-w-xs">
                        &ldquo;{String(payload.text).slice(0, 80)}&rdquo;
                      </p>
                    )}
                    {payload?.category && (
                      <p className="text-xs text-slate-400">Категория: {String(payload.category)}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-slate-400 shrink-0 ml-4">
                  {formatMoscow(log.created_at, 'dd.MM HH:mm')}
                </span>
              </div>
            );
          })}
          {allLogs.filter((l) => l.event_type !== 'sync').length === 0 && (
            <p className="text-slate-400 text-sm text-center py-10">Нет событий за выбранный период</p>
          )}
        </div>
      </div>
    </div>
  );
}
