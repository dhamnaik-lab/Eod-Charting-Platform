import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { build, preview } from 'vite';

const [chrome, scratch] = process.argv.slice(2);
if (!chrome || !scratch) {
  throw new Error('Usage: node scripts/test-market-movers-sidebar.mjs <chromium executable> <new scratch directory>');
}
const profile = resolve(scratch, 'market-movers-browser-profile');
await mkdir(profile); // Refuse to reuse an existing browser profile.

const fixture = 'src/features/marketMovers/__tests__/marketMoversSidebar.browser.html';
const outDir = resolve(scratch, 'market-movers-browser-fixture');
await mkdir(outDir);
await build({
  build: { outDir, emptyOutDir: false, rollupOptions: { input: fixture } },
});
const server = await preview({
  build: { outDir },
  preview: { host: '127.0.0.1', port: 0 },
});
try {
  const { port } = server.httpServer.address();
  const { stdout } = await promisify(execFile)(chrome, [
    '--headless',
    '--disable-background-networking',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profile}`,
    '--dump-dom',
    '--timeout=12000',
    `http://127.0.0.1:${port}/${fixture}`,
  ], { timeout: 45000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  if (!stdout.includes('data-result="pass"')) {
    throw new Error(`Mounted regression failed or did not finish: ${stdout.slice(-2000)}`);
  }
  console.log('PASS IA-03: Filters edit, Cancel, Apply, context menu, and main-content collapse');
} finally {
  await server.close();
}
