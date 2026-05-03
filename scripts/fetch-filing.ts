export interface FetchFilingInput {
  cik: string;            // 10-digit, leading zeros
  accession: string;      // e.g. "0002045724-26-000002"
  fetch?: typeof fetch;
  userAgent: string;      // SEC requires a contact identifier
}

export interface FetchFilingResult {
  primaryDocXml: string;
  holdingsXml: string;
  holdingsFilename: string;
  edgarUrl: string;
}

export interface IndexJson {
  directory: { item: Array<{ name: string; size?: string }> };
}

export function discoverHoldingsFilename(idx: IndexJson): string {
  const xmlFiles = idx.directory.item
    .map(i => i.name)
    .filter(n => n.endsWith('.xml') && n !== 'primary_doc.xml');
  if (xmlFiles.length === 0) throw new Error('No holdings xml in filing index');
  // In practice there's exactly one non-primary XML in a 13F-HR filing.
  // If a filing ever has multiple, the first one wins; revisit if this fires in production.
  return xmlFiles[0];
}

export async function fetchFiling(input: FetchFilingInput): Promise<FetchFilingResult> {
  const f = input.fetch ?? globalThis.fetch;
  const cikNoZeros = String(parseInt(input.cik, 10));
  const accNoDashes = input.accession.replace(/-/g, '');
  const base = `https://www.sec.gov/Archives/edgar/data/${cikNoZeros}/${accNoDashes}`;
  const headers = { 'User-Agent': input.userAgent };

  const idxRes = await f(`${base}/index.json`, { headers });
  if (!idxRes.ok) throw new Error(`index.json HTTP ${idxRes.status}`);
  const idx = (await idxRes.json()) as IndexJson;

  const holdingsFilename = discoverHoldingsFilename(idx);

  const [primaryRes, holdingsRes] = await Promise.all([
    f(`${base}/primary_doc.xml`, { headers }),
    f(`${base}/${holdingsFilename}`, { headers }),
  ]);
  if (!primaryRes.ok) throw new Error(`primary_doc HTTP ${primaryRes.status}`);
  if (!holdingsRes.ok) throw new Error(`holdings HTTP ${holdingsRes.status}`);

  return {
    primaryDocXml: await primaryRes.text(),
    holdingsXml: await holdingsRes.text(),
    holdingsFilename,
    edgarUrl: `${base}/`,
  };
}
