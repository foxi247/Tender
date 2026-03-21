import { getTenderStats } from '@/lib/tenders/service';
import { getUserStats } from '@/lib/users/service';
import { createServiceClient } from '@/lib/supabase/server';
import { formatMoscow } from '@/lib/utils/date';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getRecentActivity() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('bot_logs')
    .select('*, user:users(full_name, username, telegram_id)')
    .order('created_at', { ascending: false })
    .limit(10);
  return data ?? [];
}

async function getActivityByDay(): Promise<{ date: string; count: number }[]> {
  const supabase = createServiceClient();
  const days: { date: string; count: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - i);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const { count } = await supabase
      .from('bot_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString());

    const label = start.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric', timeZone: 'Europe/Moscow' });
    days.push({ date: label, count: count ?? 0 });
  }

  return days;
}

async function getDigestStats() {
  const supabase = createServiceClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('daily_digests')
    .select('*', { count: 'exact', head: true })
    .gte('sent_at', today.toISOString())
    .eq('status', 'sent');
  return count ?? 0;
}

export default async function AdminDashboard() {
  const [tenderStats, userStats, activity, digestSent, activityByDay] = await Promise.all([
    getTenderStats(),
    getUserStats(),
    getRecentActivity(),
    getDigestStats(),
    getActivityByDay(),
  ]);

  const stats = [
    { label: 'Всего тендеров', value: tenderStats.total, sub: `+${tenderStats.newToday} сегодня`, color: 'bg-blue-500', icon: '📋' },
    { label: 'Активных тендеров', value: tenderStats.active, sub: 'в базе прямо сейчас', color: 'bg-green-500', icon: '✅' },
    { label: 'Пользователей', value: userStats.total, sub: `${userStats.active} активных`, color: 'bg-purple-500', icon: '👥' },
    { label: 'Дайджестов сегодня', value: digestSent, sub: 'успешно отправлено', color: 'bg-orange-500', icon: '📨' },
  ];

  const eventLabels: Record<string, string> = {
    command_start: '/start',
    command_today: '/today',
    command_favorites: '/favorites',
    command_inwork: '/inwork',
    command_help: '/help',
    text_message: 'Сообщение',
    callback_query: 'Действие',
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Дашборд</h1>
          <p className="text-slate-500 text-sm mt-1">
            {formatMoscow(new Date(), "d MMMM yyyy, HH:mm")}
          </p>
        </div>
        <Link href="/admin/tenders" className="btn-primary">
          📋 Все тендеры
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-500 text-sm">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value.toLocaleString('ru')}</p>
                <p className="text-slate-400 text-xs mt-1">{stat.sub}</p>
              </div>
              <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center text-xl`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Быстрые действия</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/api/digest?secret=${process.env.CRON_SECRET ?? ''}`}
            target="_blank"
            className="btn-secondary"
          >
            📨 Запустить дайджест
          </a>
          <Link href="/admin/settings" className="btn-secondary">
            🔧 Настройки AI
          </Link>
          <Link href="/admin/digests" className="btn-secondary">
            📊 История рассылок
          </Link>
        </div>
      </div>

      {/* Activity chart */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-4">📈 Активность пользователей (7 дней)</h2>
        {(() => {
          const maxCount = Math.max(...activityByDay.map((d) => d.count), 1);
          return (
            <div className="flex items-end gap-2 h-32">
              {activityByDay.map((day) => {
                const heightPct = Math.max((day.count / maxCount) * 100, 2);
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-slate-500 font-medium">{day.count}</span>
                    <div
                      className="w-full bg-brand-500 rounded-t-sm transition-all"
                      style={{ height: `${heightPct}%` }}
                      title={`${day.date}: ${day.count} событий`}
                    />
                    <span className="text-xs text-slate-400 truncate w-full text-center">{day.date}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}
        <p className="text-xs text-slate-400 mt-2">События бота: команды, сообщения, нажатия кнопок</p>
      </div>

      {/* Recent activity */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Последняя активность</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {activity.length === 0 && (
            <p className="text-slate-400 text-sm text-center py-8">Нет активности</p>
          )}
          {activity.map((log: Record<string, unknown>) => {
            const user = log.user as Record<string, string> | null;
            const createdAt = log.created_at as string;
            const eventType = log.event_type as string;
            return (
              <div key={log.id as string} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-sm">
                    {user ? (user.full_name ?? user.username ?? '?').charAt(0).toUpperCase() : '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {user?.full_name ?? user?.username ?? `@${user?.telegram_id ?? 'unknown'}`}
                    </p>
                    <p className="text-xs text-slate-400">{eventLabels[eventType] ?? eventType}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-400">
                  {formatMoscow(createdAt, 'HH:mm')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
