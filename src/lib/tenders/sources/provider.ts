import type { Tender, TenderSourceProvider, FetchTendersParams } from '@/types';
import { MockTenderSource } from './mock';
import { ZakupkiGovSource } from './zakupki';

// Factory — returns the configured source
export function getTenderSource(): TenderSourceProvider {
  const source = process.env.TENDER_SOURCE ?? 'zakupki';

  switch (source) {
    case 'zakupki':
      return new ZakupkiGovSource();
    case 'mock':
      return new MockTenderSource();
    default:
      return new ZakupkiGovSource();
  }
}

export type { TenderSourceProvider, FetchTendersParams, Tender };
