import { NextRequest, NextResponse } from 'next/server';
import { runDailyDigest } from '@/lib/digest/service';
import { logger } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET!;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    logger.info('Manual digest triggered');
    const result = await runDailyDigest();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    logger.error('Digest endpoint error', { err });
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDailyDigest();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    logger.error('Digest GET error', { err });
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
