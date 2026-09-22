import { describe, expect, it } from 'vitest';
import {
  buildFullDnnResearchDatasetExportInput,
  resolveDnnResearchDatasetOutputDirectory,
  summarizeDnnResearchDatasetExport,
} from '@/plugins/forecast/dnnTrend/dnnResearchDatasetExportService';

describe('DNN research dataset export service', () => {
  it('builds the safe full-database export defaults', () => {
    expect(buildFullDnnResearchDatasetExportInput(' E:\\DNN Exports ')).toEqual({
      outputParentDirectory: 'E:\\DNN Exports',
      exchange: 'all',
      adjusted: true,
      includeDividendAdjustments: false,
      includeRightsAdjustments: false,
      includeInactive: true,
    });
  });

  it('rejects an empty output directory', () => {
    expect(() => buildFullDnnResearchDatasetExportInput('   ')).toThrow(
      'Choose an output parent directory',
    );
  });

  it('surfaces partial-export failures in the completion summary', () => {
    expect(
      summarizeDnnResearchDatasetExport({
        status: 'completeWithFailures',
        datasetDirectory: 'E:\\DNN Exports\\dataset',
        manifestPath: 'E:\\DNN Exports\\dataset\\dataset-manifest.json',
        databaseRevision: 'revision',
        fromDate: '2020-01-01',
        toDate: '2026-08-05',
        targetInstrumentCount: 100,
        exportedInstrumentCount: 99,
        exportedBarCount: 1000,
        exportedCorporateActionCount: 5,
        failureCount: 1,
      }),
    ).toContain('1 failures are recorded in failures.csv');
  });

  it('reuses a configured output directory without opening the picker', async () => {
    let pickerCalls = 0;
    const result = await resolveDnnResearchDatasetOutputDirectory(
      '  E:\\DNN Research\\raw  ',
      async () => {
        pickerCalls += 1;
        return 'E:\\other';
      },
    );

    expect(result).toBe('E:\\DNN Research\\raw');
    expect(pickerCalls).toBe(0);
  });

  it('opens the picker when no output directory is configured', async () => {
    let pickerCalls = 0;
    const result = await resolveDnnResearchDatasetOutputDirectory('   ', async () => {
      pickerCalls += 1;
      return '  E:\\DNN Research\\raw  ';
    });

    expect(result).toBe('E:\\DNN Research\\raw');
    expect(pickerCalls).toBe(1);
  });
});
