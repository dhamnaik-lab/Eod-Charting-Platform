import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/components/ToastContainer.tsx'), 'utf8');

describe('toast accessibility contract', () => {
  it('announces errors and warnings assertively, success and info politely', () => {
    expect(source).toContain("role={isError || isWarning ? 'alert' : 'status'}");
    expect(source).toContain("aria-live={isError || isWarning ? 'assertive' : 'polite'}");
    expect(source).toContain('aria-atomic="true"');
  });

  it('keeps toasts clickable and adds a keyboard-operable named dismiss button', () => {
    expect(source).toContain('onClick={onDismiss}');
    expect(source).toContain('type="button"');
    expect(source).toContain('aria-label={`Dismiss ${toast.type} notification`}');
    expect(source).toContain('event.stopPropagation()');
    expect(source).toContain('onDismiss();');
  });

  it('preserves messages, accent colors, and positioning', () => {
    expect(source).toContain('borderLeft: `3px solid ${accentColor}`');
    expect(source).toContain('toast.title');
    expect(source).toContain('{toast.message}');
    expect(source).toContain('pointerEvents: \'none\'');
    expect(source).toContain("pointerEvents: 'auto'");
  });
});
