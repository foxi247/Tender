import { NextRequest, NextResponse } from 'next/server';
import { setWebhook, deleteWebhook, getWebhookInfo } from '@/lib/telegram/bot';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { url } = await req.json() as { url: string };

  if (!url) {
    return NextResponse.json({ error: 'URL required' }, { status: 400 });
  }

  const success = await setWebhook(url, process.env.TELEGRAM_WEBHOOK_SECRET!);
  return NextResponse.json({ success });
}

export async function DELETE(): Promise<NextResponse> {
  await deleteWebhook();
  return NextResponse.json({ success: true });
}

export async function GET(): Promise<NextResponse> {
  const info = await getWebhookInfo();
  return NextResponse.json({ info });
}
