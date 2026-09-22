import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DATABASE_TOOLS = resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx');
const DOCUMENTS_MODULE = resolve(
  process.cwd(),
  'src/features/identityRecovery/identityRecoveryDocuments.ts',
);
const SOURCE_RECOVERY = resolve(
  process.cwd(),
  'src/features/identityRecovery/resources/Official-Source-Recovery-Brief-For-Any-AI.md',
);
const IDENTITY_INVESTIGATION = resolve(
  process.cwd(),
  'src/features/identityRecovery/resources/Identity-Investigation-Brief-For-Any-AI.md',
);
const RECOVERY_GUIDE = resolve(
  process.cwd(),
  'src/features/identityRecovery/resources/Identity-Recovery-Guide.md',
);

function readRequired(path: string): string {
  const exists = existsSync(path);
  expect(exists, `Missing required file: ${path}`).toBe(true);
  return exists ? readFileSync(path, 'utf8') : '';
}

function sliceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  expect(start, `Missing start marker: ${startMarker}`).toBeGreaterThanOrEqual(0);
  if (start < 0) {
    return '';
  }
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(end, `Missing end marker after ${startMarker}: ${endMarker}`).toBeGreaterThan(start);
  return end > start ? source.slice(start, end) : '';
}

describe('Identity Recovery & AI Handoff export', () => {
  it('adds a compact Recovery & AI Handoff section to the existing Identity Import Info dialog', () => {
    const source = readRequired(DATABASE_TOOLS);
    const info = sliceBetween(source, 'const renderIdentityInfoDialog = () => {', 'const identitySelectedSourceReady');

    expect(info).toContain('Recovery &amp; AI Handoff');
    expect(info).toContain('IDENTITY_RECOVERY_DOCUMENTS.map');
    expect(info).toContain('exportIdentityRecoveryDocument(document)');
  });

  it('exports the bundled Markdown through the existing saveTextExport bridge without database or network operations', () => {
    const source = readRequired(DATABASE_TOOLS);
    const handler = sliceBetween(
      source,
      'const exportIdentityRecoveryDocument = async',
      'const renderOfficialSourceUrlDialog = () => {',
    );

    expect(handler).toContain('api.saveTextExport({');
    expect(handler).toContain("defaultExtension: 'md'");
    expect(handler).toContain("filterName: 'Markdown Files'");
    expect(handler).toContain("filterExtensions: ['md', 'txt']");
    expect(handler).not.toContain('getSetting(');
    expect(handler).not.toContain('setSetting(');
    expect(handler).not.toContain('downloadNse');
    expect(handler).not.toContain('downloadBse');
    expect(handler).not.toContain('fetch(');
    expect(handler).not.toContain('applyNse');
    expect(handler).not.toContain('applyBse');
    expect(handler).toContain("document.key === 'source-recovery'");
    expect(handler).toContain('formatOfficialSourceHealthMarkdown(officialSourceHealthReport)');
    expect(handler).toContain(': document.content;');
  });

  it('bundles three provider-neutral recovery documents with explicit non-authority boundaries', () => {
    const moduleSource = readRequired(DOCUMENTS_MODULE);
    const sourceRecovery = readRequired(SOURCE_RECOVERY);
    const identityInvestigation = readRequired(IDENTITY_INVESTIGATION);
    const recoveryGuide = readRequired(RECOVERY_GUIDE);

    expect(moduleSource).toContain("Official-Source-Recovery-Brief-For-Any-AI.md?raw");
    expect(moduleSource).toContain("Identity-Investigation-Brief-For-Any-AI.md?raw");
    expect(moduleSource).toContain("Identity-Recovery-Guide.md?raw");
    expect(moduleSource).toContain('IDENTITY_RECOVERY_DOCUMENTS');
    expect(moduleSource).toContain('Export Source Recovery Brief');
    expect(moduleSource).toContain('Export Identity Investigation Brief');
    expect(moduleSource).toContain('Export Recovery Guide');

    expect(sourceRecovery).toContain('Find the current official replacement source URL');
    expect(sourceRecovery).toContain('Do not invent a URL');
    expect(sourceRecovery).toContain('candidate evidence only');
    expect(sourceRecovery).toContain('Allowed official domains');

    expect(identityInvestigation).toContain('Identity Investigation Brief');
    expect(identityInvestigation).toContain('symbol / ISIN / company-name continuity');
    expect(identityInvestigation).toContain('Do not propose database SQL');
    expect(identityInvestigation).toContain('candidate evidence only');

    expect(recoveryGuide).toContain('AI is optional');
    expect(recoveryGuide).toContain('AI never becomes Identity authority');
    expect(recoveryGuide).toContain('existing reviewed Preview');
    expect(recoveryGuide).toContain('existing reviewed Apply');
  });
});
