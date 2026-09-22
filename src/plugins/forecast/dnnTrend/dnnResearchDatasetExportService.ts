import { requireDesktopApi } from '@/platform';
import type {
  DnnResearchDatasetExportInput,
  DnnResearchDatasetExportProgressEvent,
  DnnResearchDatasetExportResult,
} from '@/types/desktop';

export const DNN_RESEARCH_DATASET_EXPORT_DEFAULTS = {
  exchange: 'all',
  adjusted: true,
  includeDividendAdjustments: false,
  includeRightsAdjustments: false,
  includeInactive: true,
} as const;

export function buildFullDnnResearchDatasetExportInput(
  outputParentDirectory: string,
): DnnResearchDatasetExportInput {
  const normalizedDirectory = outputParentDirectory.trim();
  if (!normalizedDirectory) {
    throw new Error('Choose an output parent directory for the DNN research dataset.');
  }

  return {
    outputParentDirectory: normalizedDirectory,
    ...DNN_RESEARCH_DATASET_EXPORT_DEFAULTS,
  };
}

export async function pickDnnResearchDatasetOutputDirectory(): Promise<string | null> {
  return requireDesktopApi().pickPluginOutputDirectory({
    title: 'Choose DNN Research Dataset Output Folder',
  });
}

export async function resolveDnnResearchDatasetOutputDirectory(
  configuredDirectory: string,
  picker: () => Promise<string | null> = pickDnnResearchDatasetOutputDirectory,
): Promise<string | null> {
  const normalizedConfiguredDirectory = configuredDirectory.trim();
  if (normalizedConfiguredDirectory) {
    return normalizedConfiguredDirectory;
  }

  const selectedDirectory = await picker();
  const normalizedSelectedDirectory = selectedDirectory?.trim() ?? '';
  return normalizedSelectedDirectory || null;
}

export async function exportFullDnnResearchDataset(
  outputParentDirectory: string,
): Promise<DnnResearchDatasetExportResult> {
  return requireDesktopApi().exportDnnResearchDataset(
    buildFullDnnResearchDatasetExportInput(outputParentDirectory),
  );
}

export function onDnnResearchDatasetExportProgress(
  callback: (event: DnnResearchDatasetExportProgressEvent) => void,
): () => void {
  return requireDesktopApi().onDnnResearchExportProgress(callback);
}

export function summarizeDnnResearchDatasetExport(
  result: DnnResearchDatasetExportResult,
): string {
  const base = `Exported ${result.exportedInstrumentCount.toLocaleString()} instruments, ${result.exportedBarCount.toLocaleString()} daily bars, and ${result.exportedCorporateActionCount.toLocaleString()} corporate actions.`;
  if (result.failureCount > 0) {
    return `${base} ${result.failureCount.toLocaleString()} failures are recorded in failures.csv. Output: ${result.datasetDirectory}`;
  }
  return `${base} Output: ${result.datasetDirectory}`;
}
