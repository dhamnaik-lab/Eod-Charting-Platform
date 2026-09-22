import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DATABASE_TOOLS = resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx');

function readUi(): string {
  expect(existsSync(DATABASE_TOOLS), `Missing required file: ${DATABASE_TOOLS}`).toBe(true);
  return readFileSync(DATABASE_TOOLS, 'utf8');
}

describe('Identity ER1-F Source Health usability', () => {
  it('provides a bounded visible vertical scrollbar with a sticky header', () => {
    const ui = readUi();

    expect(ui).toContain("maxHeight: 'min(52vh, 520px)'");
    expect(ui).toContain("overflowY: 'scroll'");
    expect(ui).toContain("scrollbarGutter: 'stable'");
    expect(ui).toContain("position: header ? 'sticky' : 'relative'");
    expect(ui).toContain('top: header ? 0 : undefined');
  });

  it('uses a responsive compact grid instead of the fixed 1220px result width', () => {
    const ui = readUi();

    expect(ui).toContain(
      "gridTemplateColumns: 'minmax(180px, 1.25fr) repeat(6, minmax(72px, 0.55fr)) minmax(220px, 1.75fr)'",
    );
    expect(ui).toContain('minWidth: 920');
    expect(ui).not.toContain('minWidth: 1220');
    expect(ui).toContain("padding: header ? '5px 8px' : '4px 8px'");
  });

  it('keeps reasons visible but collapses verbose request/final/SHA evidence per row', () => {
    const ui = readUi();

    expect(ui).toContain('<details style={officialSourceHealthDetailsStyle}>');
    expect(ui).toContain('<summary style={officialSourceHealthEvidenceSummaryStyle}>Show evidence</summary>');
    expect(ui).toContain('officialSourceHealthEvidenceDetailsBodyStyle');
    expect(ui).toContain('<span>{result.reason}</span>');
  });

  it('shows total/healthy/attention counts and a visibly enabled Source Health action', () => {
    const ui = readUi();

    expect(ui).toContain('const needsAttentionCount = Math.max(0, totalCount - healthyCount);');
    expect(ui).toContain('`${totalCount} total · ${healthyCount} healthy · ${needsAttentionCount} needs attention · ${officialSourceHealthReport.assessedAtUtc}`');
    expect(ui).toContain('identitySourceHealthButtonStyle');
    expect(ui).toContain(
      'style={busy || !hasDatabase ? identitySecondaryButtonStyle : identitySourceHealthButtonStyle}',
    );
  });
});
