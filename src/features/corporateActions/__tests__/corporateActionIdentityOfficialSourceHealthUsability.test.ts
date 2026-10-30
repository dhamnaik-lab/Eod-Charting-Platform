import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const ui = read('src/components/DatabaseToolsDialogs.tsx');
const health = read('src/features/corporateActions/identity/IdentitySourceHealth.tsx');
const workspace = read('src/features/corporateActions/identity/IdentityImportWorkspace.tsx');
const styles = read('src/features/corporateActions/identity/identityImportWorkspace.css');

describe('Identity source diagnostics usability after workspace redesign', () => {
  it('keeps diagnostics in its own workspace view', () => {
    expect(workspace).toContain("label: 'Source diagnostics'");
    expect(workspace).toContain('props.diagnostics');
    expect(styles).toContain('.identity-diagnostics-content');
    expect(styles).toContain('overflow:auto');
  });
  it('uses a compact semantic table with bounded explanations', () => {
    expect(health).toContain('<table className="identity-source-table">');
    expect(health).toContain('<th scope="row">');
    expect(styles).toContain('-webkit-line-clamp:2');
    expect(health).not.toContain('repeat(6');
  });
  it('puts evidence in a focus-managed inspector with raw JSON collapsed', () => {
    expect(health).toContain('<CorporateActionClassicDialog');
    expect(health).toContain('selectedId');
    expect(health).toContain('<summary>Raw diagnostic JSON</summary>');
    expect(health).toContain('Observed CSV columns');
    expect(ui).not.toContain('<details style={officialSourceHealthDetailsStyle}>');
  });
  it('labels exchange scope and separates health checks from source refresh', () => {
    expect(health).toContain('identityHealthSummary(report, exchange)');
    expect(health).toContain('All exchanges');
    expect(ui).toContain('Checks all exchanges. Results initially show');
    expect(ui).toContain('does not refresh saved import files');
    expect(ui).toContain('onClick={() => void checkOfficialSourceHealth()}');
  });
});
