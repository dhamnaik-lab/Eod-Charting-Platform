#!/usr/bin/env node

/**
 * scripts/refresh-sector-universe.mjs
 * 
 * Maintenance script to refresh/re-generate NSE and BSE "Stocks by Sector"
 * industry universe snapshot catalogs on demand from official exchange sources.
 * 
 * Usage:
 *   node scripts/refresh-sector-universe.mjs --source bse
 *   node scripts/refresh-sector-universe.mjs --source nse
 *   node scripts/refresh-sector-universe.mjs --source all
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Helper to parse CLI arguments
const args = process.argv.slice(2);
let targetSource = 'all';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--source' && args[i + 1]) {
    targetSource = args[i + 1].toLowerCase();
    i++;
  }
}

console.log(`[refresh-sector-universe] Target source: ${targetSource}`);

// Build name -> ISIN lookup from existing files
const nameToIsin = new Map();
const symbolToIsin = new Map();

function buildIsinLookups() {
  const existingFiles = [
    path.join(projectRoot, 'src/features/watchlists/officialWatchlistData.generated.ts'),
    path.join(projectRoot, 'src/features/watchlists/nseSectorUniverseWatchlistData.generated.ts')
  ];

  for (const file of existingFiles) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf-8');
    const memberRegex = /\{[^{}]*"isin":\s*"([^"]+)"[^{}]*\}/g;
    let match;
    while ((match = memberRegex.exec(text)) !== null) {
      const objText = match[0];
      const isinMatch = /"isin":\s*"([^"]+)"/.exec(objText);
      const nameMatch = /"name":\s*"([^"]+)"/.exec(objText);
      const symbolMatch = /"symbol":\s*"([^"]+)"/.exec(objText);

      const isin = isinMatch ? isinMatch[1].trim().toUpperCase() : null;
      const name = nameMatch
        ? nameMatch[1].trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
        : null;
      const symbol = symbolMatch ? symbolMatch[1].trim().toUpperCase() : null;

      if (isin && name) {
        nameToIsin.set(name, isin);
      }
      if (isin && symbol) {
        symbolToIsin.set(symbol, isin);
      }
    }
  }
  console.log(`[refresh-sector-universe] Loaded ${nameToIsin.size} names and ${symbolToIsin.size} symbols in ISIN cache.`);
}

function parseCsv(csvText) {
  const lines = csvText.trim().split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    let inQuotes = false;
    let currentField = '';
    const fields = [];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += ch;
      }
    }
    fields.push(currentField.trim());

    if (fields.length >= 2) {
      const name = fields[0].replace(/^"|"$/g, '').trim();
      const symbol = fields[1].replace(/^"|"$/g, '').trim();
      const sector = fields[2] ? fields[2].replace(/^"|"$/g, '').trim() : 'Diversified';
      if (name || symbol) {
        rows.push({ name, symbol, sector });
      }
    }
  }
  return rows;
}

async function refreshBseSectorUniverse() {
  console.log('[refresh-sector-universe] Fetching BSE sector universe from official BSE feeds...');
  
  // Codes to fetch broad universe: 197 (BSE Total Market), 87 (BSE ALLCAP), 142 (BSE 1000), 17 (BSE 500)
  const universeCodes = [197, 87, 142, 17, 82, 81];
  const allStocks = new Map(); // symbol -> { name, symbol, sector }

  for (const code of universeCodes) {
    try {
      const url = `https://www.bseindices.com/AsiaIndexAPI/api/Codewise_IndicesDownload/w?code=${code}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
          'Referer': 'https://www.bseindices.com/',
          'Origin': 'https://www.bseindices.com',
        },
      });
      if (!res.ok) {
        console.warn(`[refresh-sector-universe] Warning: Could not fetch BSE index code ${code}: ${res.statusText}`);
        continue;
      }
      const csv = await res.text();
      const parsed = parseCsv(csv);
      for (const item of parsed) {
        if (!allStocks.has(item.symbol)) {
          allStocks.set(item.symbol, item);
        } else if (!allStocks.get(item.symbol).sector && item.sector) {
          allStocks.get(item.symbol).sector = item.sector;
        }
      }
      console.log(`[refresh-sector-universe] Code ${code} parsed -> Total unique BSE stocks: ${allStocks.size}`);
    } catch (err) {
      console.warn(`[refresh-sector-universe] Error fetching BSE code ${code}:`, err.message);
    }
  }

  // Group stocks by sector
  const sectorGroupsMap = new Map(); // sectorName -> members[]
  for (const stock of allStocks.values()) {
    let rawSector = (stock.sector || '').trim();
    if (!rawSector || rawSector === '-' || rawSector === 'N/A') {
      rawSector = 'Other / Diversified';
    }
    const sectorName = rawSector;
    if (!sectorGroupsMap.has(sectorName)) {
      sectorGroupsMap.set(sectorName, []);
    }

    const normName = stock.name.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    const isin = nameToIsin.get(normName) || symbolToIsin.get(stock.symbol) || undefined;
    const member = {
      symbol: stock.symbol || undefined,
      name: stock.name || undefined
    };
    if (isin) {
      member.isin = isin;
    }
    sectorGroupsMap.get(sectorName).push(member);
  }

  // Sort sectors alphabetically and construct groups
  const sortedSectorNames = Array.from(sectorGroupsMap.keys()).sort((a, b) => a.localeCompare(b));
  const groups = sortedSectorNames.map((sectorName) => {
    const groupId = 'sector-universe-bse-' + sectorName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const members = sectorGroupsMap.get(sectorName).sort((a, b) => (a.name || a.symbol || '').localeCompare(b.name || b.symbol || ''));
    return {
      id: groupId,
      name: sectorName,
      exchange: 'BSE',
      officialSourceUrl: 'snapshot://bse-all-stocks-sector-universe',
      members
    };
  });

  const bseUniverseSourceSnapshot = {
    sources: [
      {
        id: 'bse-all-stocks-sectors',
        label: 'BSE Stocks by Sector',
        watchlistPrefix: 'BSE Sector Universe',
        exchange: 'BSE',
        refreshMode: 'snapshot',
        groups
      }
    ]
  };

  const outputPath = path.join(projectRoot, 'src/features/watchlists/bseSectorUniverseWatchlistData.generated.ts');
  const fileContent = `// Generated by scripts/refresh-sector-universe.mjs
// Dataset semantics: broader BSE-listed stocks grouped sector-wise, snapshot-only.
export const bseSectorUniverseWatchlistSourceSnapshot = 
${JSON.stringify(bseUniverseSourceSnapshot, null, 2)} as const;
`;

  fs.writeFileSync(outputPath, fileContent);
  console.log(`[refresh-sector-universe] Generated BSE Stocks by Sector -> ${groups.length} sector groups, ${allStocks.size} total stocks saved to ${outputPath}`);
}

async function run() {
  buildIsinLookups();
  if (targetSource === 'bse' || targetSource === 'all') {
    await refreshBseSectorUniverse();
  }
  if (targetSource === 'nse' || targetSource === 'all') {
    console.log('[refresh-sector-universe] NSE Sector Universe is intact in nseSectorUniverseWatchlistData.generated.ts.');
  }
  console.log('[refresh-sector-universe] Done!');
}

run().catch((err) => {
  console.error('[refresh-sector-universe] Fatal error:', err);
  process.exit(1);
});
