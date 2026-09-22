import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function normalizeModuleId(id: string): string {
  return id.replace(/\\/g, '/');
}

export function classifyManualChunk(id: string): string | undefined {
  const normalizedId = normalizeModuleId(id);

  if (normalizedId.includes('/node_modules/')) {
    if (normalizedId.includes('/node_modules/technicalindicators/')) {
      return 'vendor-technicalindicators';
    }

    if (
      normalizedId.includes('/react/') ||
      normalizedId.includes('/react-dom/') ||
      normalizedId.includes('/scheduler/')
    ) {
      return 'vendor-react';
    }

    if (normalizedId.includes('/zustand/')) {
      return 'vendor-zustand';
    }

    if (normalizedId.includes('/date-fns/')) {
      return 'vendor-date-fns';
    }
  }

  if (
    normalizedId.includes('/src/features/watchlists/officialWatchlist') ||
    normalizedId.includes('/src/components/OfficialWatchlistImportDialog.tsx')
  ) {
    return 'feature-official-watchlists';
  }

  if (
    normalizedId.includes('/src/components/DatabaseToolsDialogs.tsx') ||
    normalizedId.includes('/src/components/ImportCsvDialog.tsx') ||
    normalizedId.includes('/src/components/BhavcopyDownloadWindow.tsx') ||
    normalizedId.includes('/src/components/LayoutManagerDialog.tsx') ||
    normalizedId.includes('/src/components/DeleteDatabaseDialog.tsx') ||
    normalizedId.includes('/src/components/WatchlistManagerDialog.tsx')
  ) {
    return 'feature-utility-dialogs';
  }

  if (
    normalizedId.includes('/src/indicators/') ||
    normalizedId.endsWith('/src/engine/Patterns.ts') ||
    normalizedId.includes('/src/engine/candlestick/')
  ) {
    return 'feature-chart-analysis';
  }

  if (normalizedId.endsWith('/src/components/ChartCanvas.tsx')) {
    return 'feature-chart-canvas';
  }

  if (
    normalizedId.includes('/src/engine/') ||
    normalizedId.endsWith('/src/store/chartStore.ts') ||
    normalizedId.includes('/src/features/charts/')
  ) {
    return 'feature-chart-core';
  }

  if (
    normalizedId.includes('/src/components/Sidebar.tsx') ||
    normalizedId.includes('/src/components/ChartToolDock.tsx') ||
    normalizedId.includes('/src/components/ChartTabs.tsx') ||
    normalizedId.includes('/src/components/SheetTabs.tsx') ||
    normalizedId.includes('/src/components/Toolbar.tsx') ||
    normalizedId.includes('/src/components/TileHeader.tsx')
  ) {
    return 'feature-shell-ui';
  }

  return undefined;
}

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: classifyManualChunk,
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
