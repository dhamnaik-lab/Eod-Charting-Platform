import type { CorporateActionScanResultRow } from '@/platform';

export interface CorporateActionCompoundValidationMetadata {
  combinedFactor: number;
  componentCount: number;
  fingerprint: string;
}

const COMPOUND_METADATA_PATTERN = /\[CA_COMPOUND_V1 factor=([0-9eE+\-.]+) count=(\d+) fingerprint=([^\]]+)\]/;

export function parseCorporateActionCompoundValidation(
  message: string | null | undefined,
): CorporateActionCompoundValidationMetadata | null {
  if (!message) return null;
  const match = COMPOUND_METADATA_PATTERN.exec(message);
  if (!match) return null;
  const combinedFactor = Number(match[1]);
  const componentCount = Number(match[2]);
  if (!Number.isFinite(combinedFactor) || combinedFactor <= 0) return null;
  if (!Number.isInteger(componentCount) || componentCount < 2) return null;
  return { combinedFactor, componentCount, fingerprint: match[3] };
}

export function getCorporateActionEffectiveValidationFactor(
  scan: Pick<CorporateActionScanResultRow, 'expectedFactor' | 'message'> | null | undefined,
): number | null {
  if (!scan) return null;
  return parseCorporateActionCompoundValidation(scan.message)?.combinedFactor ?? scan.expectedFactor ?? null;
}

export function getCorporateActionCompoundSummary(
  scan: Pick<CorporateActionScanResultRow, 'message'> | null | undefined,
): string | null {
  const metadata = parseCorporateActionCompoundValidation(scan?.message);
  if (!metadata) return null;
  return `Compound ${metadata.componentCount}-action factor ×${metadata.combinedFactor.toFixed(6)}`;
}

export interface CorporateActionPriceValidationPresentation {
  isCompound: boolean;
  componentCount: number | null;
  effectiveFactor: number | null;
  theoreticalPrice: number | null;
  openResidualPct: number | null;
  closeResidualPct: number | null;
  summary: string | null;
}

function getPresentationTheoreticalPrice(
  previousClose: number | null | undefined,
  factor: number | null,
): number | null {
  if (
    previousClose == null ||
    factor == null ||
    !Number.isFinite(previousClose) ||
    !Number.isFinite(factor) ||
    factor <= 0
  ) {
    return null;
  }
  return previousClose / factor;
}

function getPresentationResidualPct(
  actual: number | null | undefined,
  theoretical: number | null,
): number | null {
  if (
    actual == null ||
    theoretical == null ||
    !Number.isFinite(actual) ||
    !Number.isFinite(theoretical) ||
    theoretical <= 0
  ) {
    return null;
  }
  return (actual / theoretical - 1) * 100;
}

export function getCorporateActionPriceValidationPresentation(
  scan: Pick<
    CorporateActionScanResultRow,
    'prevClose' | 'exOpen' | 'exClose' | 'expectedFactor' | 'message'
  > | null | undefined,
): CorporateActionPriceValidationPresentation {
  const compound = parseCorporateActionCompoundValidation(scan?.message);
  const effectiveFactor = compound?.combinedFactor ?? scan?.expectedFactor ?? null;
  const theory = getPresentationTheoreticalPrice(scan?.prevClose, effectiveFactor);

  return {
    isCompound: compound != null,
    componentCount: compound?.componentCount ?? null,
    effectiveFactor,
    theoreticalPrice: theory,
    openResidualPct: getPresentationResidualPct(scan?.exOpen, theory),
    closeResidualPct: getPresentationResidualPct(scan?.exClose, theory),
    summary: compound
      ? `Compound ${compound.componentCount}-action factor ×${compound.combinedFactor.toFixed(6)}`
      : null,
  };
}

