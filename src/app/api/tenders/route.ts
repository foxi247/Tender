import { NextRequest, NextResponse } from 'next/server';
import { getTenders } from '@/lib/tenders/service';
import type { TenderSearchParams } from '@/types';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;

  const params: TenderSearchParams = {
    query: searchParams.get('query') ?? undefined,
    category: searchParams.get('category') ?? undefined,
    region: searchParams.get('region') ?? undefined,
    minBudget: searchParams.get('minBudget') ? Number(searchParams.get('minBudget')) : undefined,
    maxBudget: searchParams.get('maxBudget') ? Number(searchParams.get('maxBudget')) : undefined,
    lawType: (searchParams.get('lawType') as TenderSearchParams['lawType']) ?? undefined,
    status: (searchParams.get('status') as TenderSearchParams['status']) ?? 'active',
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
    pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 20,
    sortBy: (searchParams.get('sortBy') as TenderSearchParams['sortBy']) ?? 'published_at',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') ?? 'desc',
  };

  const result = await getTenders(params);
  return NextResponse.json(result);
}
