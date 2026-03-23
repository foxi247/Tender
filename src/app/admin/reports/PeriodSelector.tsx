'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

const PERIODS = [
  { key: 'today', label: 'Сегодня' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
];

export default function PeriodSelector({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(searchParams.get('from') ?? '');
  const [to, setTo] = useState(searchParams.get('to') ?? '');

  function navigate(period: string) {
    router.push(`/admin/reports?period=${period}`);
  }

  function applyCustom() {
    if (!from || !to) return;
    router.push(`/admin/reports?period=custom&from=${from}&to=${to}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          onClick={() => navigate(p.key)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            current === p.key
              ? 'bg-brand-600 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          {p.label}
        </button>
      ))}

      {/* Custom date range */}
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="text-sm text-slate-700 outline-none"
        />
        <span className="text-slate-400 text-sm">—</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="text-sm text-slate-700 outline-none"
        />
        <button
          onClick={applyCustom}
          disabled={!from || !to}
          className="ml-1 px-3 py-1 bg-brand-600 text-white text-xs rounded-md disabled:opacity-40 hover:bg-brand-700 transition-colors"
        >
          Применить
        </button>
      </div>
    </div>
  );
}
