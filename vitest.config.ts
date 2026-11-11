import { configDefaults, defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./scripts/vitest-theme-setup.mjs'],
    exclude: [
      ...configDefaults.exclude,
      '**/EOD Charting Platform Source Audit/**',
      '**/backups/**',
      '**/dist/**',
      '**/release/**',
      '**/resources/release/**',
      '**/src-tauri-shell/target/**',
      '**/test-output/**',
      '**/tmp/**',
      // Frozen audit probes describe historical defects, not current acceptance.
      '**/docs/audits/**',
      '**/EOD DATABASE/**',
      '**/EOD Charting Platform/**',
      '**/EOD_Chart_*/**',
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
