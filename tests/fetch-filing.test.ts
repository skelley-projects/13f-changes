import { describe, it, expect, vi } from 'vitest';
import { discoverHoldingsFilename, fetchFiling } from '../scripts/fetch-filing';

describe('discoverHoldingsFilename', () => {
  it('finds the holdings XML by elimination (any .xml that is not primary_doc)', () => {
    const indexJson = {
      directory: {
        item: [
          { name: '0001536411-26-000002-index.html', size: '' },
          { name: 'primary_doc.xml', size: '2027' },
          { name: 'form13f_20251231.xml', size: '24295' },
        ],
      },
    };
    expect(discoverHoldingsFilename(indexJson)).toBe('form13f_20251231.xml');
  });

  it('throws if no holdings XML candidate is found', () => {
    const indexJson = { directory: { item: [{ name: 'primary_doc.xml' }] } };
    expect(() => discoverHoldingsFilename(indexJson)).toThrow(/holdings xml/i);
  });
});

describe('fetchFiling', () => {
  it('downloads index.json, primary_doc, and the discovered holdings file', async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/index.json')) {
        return new Response(JSON.stringify({
          directory: {
            item: [
              { name: 'primary_doc.xml', size: '2039' },
              { name: 'SALP_13FQ425.xml', size: '15809' },
            ],
          },
        }));
      }
      if (url.endsWith('/primary_doc.xml')) return new Response('<primary/>');
      if (url.endsWith('/SALP_13FQ425.xml')) return new Response('<holdings/>');
      throw new Error(`Unexpected URL ${url}`);
    });

    const result = await fetchFiling({
      cik: '0002045724',
      accession: '0002045724-26-000002',
      fetch: fetchMock,
      userAgent: 'test',
    });
    expect(result.primaryDocXml).toBe('<primary/>');
    expect(result.holdingsXml).toBe('<holdings/>');
    expect(result.holdingsFilename).toBe('SALP_13FQ425.xml');
  });
});
