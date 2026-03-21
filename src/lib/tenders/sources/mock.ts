import type { Tender, TenderSourceProvider, FetchTendersParams } from '@/types';

// Mock source — returns static tenders for demo/testing
// Replace with real API integration (zakupki.gov.ru, etc.)
export class MockTenderSource implements TenderSourceProvider {
  async fetchTenders(_params?: FetchTendersParams): Promise<Tender[]> {
    // In production, this would call the real API
    // For now, return empty — seed data is loaded directly into DB
    return [];
  }

  async fetchTenderById(_externalId: string): Promise<Tender | null> {
    return null;
  }
}

// Zakupki.gov.ru integration stub
// export class ZakupkiGovSource implements TenderSourceProvider {
//   private apiUrl = 'https://zakupki.gov.ru/api/v1';
//
//   async fetchTenders(params?: FetchTendersParams): Promise<Tender[]> {
//     const response = await fetch(`${this.apiUrl}/tenders`, {
//       headers: { 'Authorization': `Bearer ${process.env.ZAKUPKI_API_KEY}` }
//     });
//     const data = await response.json();
//     return data.items.map(mapZakupkiTender);
//   }
//
//   async fetchTenderById(externalId: string): Promise<Tender | null> {
//     const response = await fetch(`${this.apiUrl}/tenders/${externalId}`);
//     if (!response.ok) return null;
//     return mapZakupkiTender(await response.json());
//   }
// }
