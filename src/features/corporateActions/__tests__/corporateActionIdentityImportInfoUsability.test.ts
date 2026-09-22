import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DATABASE_TOOLS = resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx');

function readUi(): string {
  expect(existsSync(DATABASE_TOOLS), `Missing required file: ${DATABASE_TOOLS}`).toBe(true);
  return readFileSync(DATABASE_TOOLS, 'utf8');
}

describe('Identity ER1-F Identity Import Info usability', () => {
  it('uses a responsive fixed-height dialog with an independently scrollable body', () => {
    const ui = readUi();

    expect(ui).toContain("width: 'min(900px, calc(100vw - 48px))'");
    expect(ui).toContain("height: 'min(760px, calc(100vh - 48px))'");
    expect(ui).toContain("flex: '1 1 auto'");
    expect(ui).toContain("overflowY: 'auto'");
    expect(ui).toContain("overscrollBehavior: 'contain'");
  });

  it('adds deliberate spacing and readable line-height for wrapped NSE/BSE guidance', () => {
    const ui = readUi();

    expect(ui).toContain("padding: '10px 12px'");
    expect(ui).toContain("background: 'var(--bg2)'");
    expect(ui).toContain("display: 'flex'");
    expect(ui).toContain("gap: 7");
    expect(ui).toContain("lineHeight: 1.55");
  });

  it('keeps recovery actions in their own responsive panel and makes the saved path explicit', () => {
    const ui = readUi();

    expect(ui).toContain('identityRecoveryActionPanelStyle');
    expect(ui).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))'");
    expect(ui).toContain('setIdentityRecoveryExportStatus(`Saved: ${result.filePath}`);');
    expect(ui).toContain('identityRecoveryExportStatusStyle');
    expect(ui).toContain("overflowWrap: 'anywhere'");
  });

  it('separates the dialog footer from the scrolling body so OK remains stable', () => {
    const ui = readUi();

    expect(ui).toContain('identityInfoFooterStyle');
    expect(ui).toContain("borderTop: '1px solid var(--border)'");
    expect(ui).toContain("paddingTop: 10");
    expect(ui).toContain("flex: '0 0 auto'");
  });

  it('preserves the provider-neutral recovery export mapping and both close controls', () => {
    const ui = readUi();

    expect(ui).toContain('IDENTITY_RECOVERY_DOCUMENTS.map((document) => (');
    expect(ui).toContain('onClick={() => void exportIdentityRecoveryDocument(document)}');
    expect(ui).toContain(': document.label}');
    expect(ui).toContain('aria-label="Close identity import information"');
    expect(ui).toContain('onClick={() => setIdentityInfoOpen(false)}');
    expect(ui).toMatch(/>\s*OK\s*<\/button>/);
  });
});
