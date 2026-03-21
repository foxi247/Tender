import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

// Vercel runs in UTC; Moscow is UTC+3 (no DST since 2014)
const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

export function toMoscow(date: Date): Date {
  return new Date(date.getTime() + MOSCOW_OFFSET_MS);
}

export function formatMoscow(date: Date | string, fmt: string): string {
  return format(toMoscow(new Date(date)), fmt, { locale: ru });
}
