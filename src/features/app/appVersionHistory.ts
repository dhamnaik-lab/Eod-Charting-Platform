export interface AppVersionHistoryEntry {
  version: string;
  releasedOn: string;
  title: string;
  notes: string[];
}

export const APP_VERSION_HISTORY: AppVersionHistoryEntry[] = [
  {
    version: '0.1.0',
    releasedOn: '2026-06-08',
    title: 'Import and build-info baseline',
    notes: [
      'Builds now stamp a build number and build time, and About shows version, build info, runtime paths, and recorded version notes.',
    ],
  },
];
