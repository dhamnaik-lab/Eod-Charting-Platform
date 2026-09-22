import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ChartToolDock drawing tool tooltip contract', () => {
  it('keeps drawing-tool hover text name-only in direct, grouped, and flyout controls', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/ChartToolDock.tsx'), 'utf8');

    expect(source).not.toContain('title={`${tool.title}\\n${tool.hint}`}');
    expect(source).not.toContain('title={`${displayTool.title}\\n');
    expect(source).toContain('title={tool.title}');
    expect(source).toContain('title={displayTool.title}');
  });
});
