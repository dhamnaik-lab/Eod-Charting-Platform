import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Toolbar } from '../Toolbar';

describe('Toolbar Corporate Action Adjustment control', () => {
  it('keeps Adj while dividend options remain outside the toolbar', () => {
    const html = renderToStaticMarkup(<Toolbar />);

    expect(html).toContain('>Adj</button>');
    expect(html).not.toContain('>TRI</button>');
    expect(html).toContain('Capital adjustment');
    expect(html).not.toContain('Dividend TRI adjustment');
  });

  it('retains the adjusted-mode toggle without a dividend toggle', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/Toolbar.tsx'),
      'utf8',
    );

    expect(source).toContain('state.adjustedMode');
    expect(source).toContain('state.setAdjustedMode');
    expect(source).toContain('setAdjustedMode(next)');
    expect(source).not.toContain('setIncludeDividendAdjustments');
  });
});
