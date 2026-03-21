import { NextResponse } from 'next/server';
import { getAllUsers, getUserStats } from '@/lib/users/service';

export async function GET(): Promise<NextResponse> {
  const [users, stats] = await Promise.all([getAllUsers(), getUserStats()]);
  return NextResponse.json({ users, stats });
}
