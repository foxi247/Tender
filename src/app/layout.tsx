import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TenderBot — AI ассистент по тендерам',
  description: 'Умный помощник для поставщиков строительных материалов',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
