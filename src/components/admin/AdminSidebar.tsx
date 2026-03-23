'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useState } from 'react';

const NAV = [
  { href: '/admin', label: 'Дашборд', icon: '📊', exact: true },
  { href: '/admin/reports', label: 'Отчёты', icon: '📈' },
  { href: '/admin/tenders', label: 'Тендеры', icon: '📋' },
  { href: '/admin/users', label: 'Пользователи', icon: '👥' },
  { href: '/admin/broadcast', label: 'Рассылка', icon: '📣' },
  { href: '/admin/preferences', label: 'Предпочтения', icon: '⚙️' },
  { href: '/admin/actions', label: 'Действия', icon: '🗂' },
  { href: '/admin/digests', label: 'Дайджесты', icon: '📨' },
  { href: '/admin/settings', label: 'Настройки', icon: '🔧' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await fetch('/api/auth/login', { method: 'DELETE' });
    window.location.href = '/login';
  }

  const navItems = NAV.map(({ href, label, icon, exact }) => {
    const active = exact ? pathname === href : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setOpen(false)}
        className={clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          active
            ? 'bg-brand-600 text-white'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        )}
      >
        <span className="text-base shrink-0">{icon}</span>
        {label}
      </Link>
    );
  });

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-slate-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center text-sm">📋</div>
          <span className="text-white font-semibold text-sm">TenderBot</span>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-white text-xl p-1"
          aria-label="Меню"
        >
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed md:static z-40 top-0 left-0 h-full w-64 bg-slate-900 text-white flex flex-col shrink-0 transition-transform duration-200',
          'md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Logo — desktop only (mobile has top bar) */}
        <div className="hidden md:block p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center text-lg shrink-0">
              📋
            </div>
            <div>
              <p className="font-semibold text-sm">TenderBot</p>
              <p className="text-slate-400 text-xs">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Mobile spacer for top bar */}
        <div className="h-14 md:hidden shrink-0" />

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span>🚪</span> Выйти
          </button>
        </div>
      </aside>

    </>
  );
}
