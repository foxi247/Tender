import { NextRequest, NextResponse } from 'next/server';
import { runDailyDigest } from '@/lib/digest/service';
import { logger } from '@/lib/logger';
import { cookies } from 'next/headers';

const CRON_SECRET = process.env.CRON_SECRET;

function isAuthorized(req: NextRequest, isAdmin: boolean): boolean {
  if (!CRON_SECRET) return true;
  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${CRON_SECRET}`) return true;
  if (req.nextUrl.searchParams.get('secret') === CRON_SECRET) return true;
  return isAdmin;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('admin_auth')?.value === 'true';
  if (!isAuthorized(req, isAdmin)) {
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('admin_auth')?.value === 'true';
  if (!isAuthorized(req, isAdmin)) {
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
