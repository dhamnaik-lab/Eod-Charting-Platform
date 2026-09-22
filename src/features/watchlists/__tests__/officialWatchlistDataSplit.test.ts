import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '../../../..');

type CatalogGroup = { id: string; name: string; memberCount: number };

const EXPECTED_SOURCE_IDS = [
  'nse-sectors',
  'nse-indices',
  'bse-sectors',
  'bse-indices',
  'nse-all-stocks-sectors',
  'bse-all-stocks-sectors',
] as const;

function parseGeneratedSnapshot(path: string): { sources: Array<Record<string, any>> } {
  const text = readFileSync(path, 'utf8');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`Snapshot object missing in ${path}`);
  return JSON.parse(text.slice(start, end + 1));
}

function canonicalSources() {
  const official = parseGeneratedSnapshot(resolve(projectRoot, 'src/features/watchlists/officialWatchlistData.generated.ts')).sources;
  const nseAll = parseGeneratedSnapshot(resolve(projectRoot, 'src/features/watchlists/nseSectorUniverseWatchlistData.generated.ts')).sources;
  const bseAll = parseGeneratedSnapshot(resolve(projectRoot, 'src/features/watchlists/bseSectorUniverseWatchlistData.generated.ts')).sources;
  return [...official, ...nseAll, ...bseAll];
}

function hashDirectory(dir: string): string {
  const hash = createHash('sha256');
  for (const name of readdirSync(dir).sort()) {
    hash.update(name);
    hash.update(readFileSync(resolve(dir, name)));
  }
  return hash.digest('hex');
}

describe('official watchlist generated data split', () => {
  it('has exactly the six supported source identities in canonical input', () => {
    expect(canonicalSources().map((source) => source.id)).toEqual(EXPECTED_SOURCE_IDS);
  });

  it('emits metadata-only catalog groups with memberCount and no members arrays', () => {
    const catalogPath = resolve(projectRoot, 'src/features/watchlists/generated/officialWatchlistCatalog.generated.ts');
    expect(existsSync(catalogPath)).toBe(true);
    const text = readFileSync(catalogPath, 'utf8');
    expect(text).not.toContain('"members"');
    const catalog = parseGeneratedSnapshot(catalogPath);
    expect(catalog.sources.map((source) => source.id)).toEqual(EXPECTED_SOURCE_IDS);
    for (const source of catalog.sources) {
      for (const group of source.groups) {
        expect(typeof group.memberCount).toBe('number');
        expect(group.members).toBeUndefined();
      }
    }
  });

  it('preserves exact source/group/member payloads for four split sources', () => {
    const canonicalById = new Map(canonicalSources().map((source) => [source.id, source]));
    const outputs = [
      ['nse-sectors', 'officialWatchlistNseSectors.generated.ts'],
      ['nse-indices', 'officialWatchlistNseIndices.generated.ts'],
      ['bse-sectors', 'officialWatchlistBseSectors.generated.ts'],
      ['bse-indices', 'officialWatchlistBseIndices.generated.ts'],
    ] as const;
    for (const [sourceId, fileName] of outputs) {
      const generated = parseGeneratedSnapshot(resolve(projectRoot, 'src/features/watchlists/generated', fileName)).sources;
      expect(generated).toHaveLength(1);
      expect(generated[0]).toEqual(canonicalById.get(sourceId));
    }
  });

  it('catalog memberCount matches canonical member arrays for all six sources', () => {
    const canonicalById = new Map(canonicalSources().map((source) => [source.id, source]));
    const catalog = parseGeneratedSnapshot(resolve(projectRoot, 'src/features/watchlists/generated/officialWatchlistCatalog.generated.ts'));
    for (const source of catalog.sources) {
      const canonical = canonicalById.get(source.id)!;
      expect(source.groups.map((group: CatalogGroup) => group.id)).toEqual(canonical.groups.map((group: any) => group.id));
      expect(source.groups.map((group: CatalogGroup) => group.name)).toEqual(canonical.groups.map((group: any) => group.name));
      expect(source.groups.map((group: CatalogGroup) => group.memberCount)).toEqual(canonical.groups.map((group: any) => group.members.length));
    }
  });

  it('regenerates deterministic byte-identical outputs', () => {
    const first = mkdtempSync(resolve(tmpdir(), 'w1-3-first-'));
    const second = mkdtempSync(resolve(tmpdir(), 'w1-3-second-'));
    try {
      execFileSync(process.execPath, [resolve(projectRoot, 'scripts/split-official-watchlist-data.mjs'), '--out-dir', first]);
      execFileSync(process.execPath, [resolve(projectRoot, 'scripts/split-official-watchlist-data.mjs'), '--out-dir', second]);
      expect(hashDirectory(first)).toBe(hashDirectory(second));
    } finally {
      rmSync(first, { recursive: true, force: true });
      rmSync(second, { recursive: true, force: true });
    }
  }, 15_000);
});
