import type { Tender, TenderSourceProvider, FetchTendersParams } from '@/types';
import { MockTenderSource } from './mock';

// Factory — returns the configured source
export function getTenderSource(): TenderSourceProvider {
  const source = process.env.TENDER_SOURCE ?? 'mock';

  switch (source) {
    case 'mock':
      return new MockTenderSource();
    // Future integrations:
    // case 'zakupki':
    //   return new ZakupkiGovSource();
    // case 'rts':
    //   return new RtsTenderSource();
    default:
      return new MockTenderSource();
  }
}

export type { TenderSourceProvider, FetchTendersParams, Tender };
