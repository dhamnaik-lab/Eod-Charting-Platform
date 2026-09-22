import identityInvestigationBrief from './resources/Identity-Investigation-Brief-For-Any-AI.md?raw';
import recoveryGuide from './resources/Identity-Recovery-Guide.md?raw';
import sourceRecoveryBrief from './resources/Official-Source-Recovery-Brief-For-Any-AI.md?raw';

export interface IdentityRecoveryDocument {
  key: 'source-recovery' | 'identity-investigation' | 'recovery-guide';
  label: string;
  dialogTitle: string;
  suggestedFileName: string;
  description: string;
  content: string;
}

export const IDENTITY_RECOVERY_DOCUMENTS: readonly IdentityRecoveryDocument[] = [
  {
    key: 'source-recovery',
    label: 'Export Source Recovery Brief',
    dialogTitle: 'Export Official Source Recovery Brief',
    suggestedFileName: 'Official-Source-Recovery-Brief-For-Any-AI.md',
    description: 'Use when an official NSE/BSE source URL moves, fails, or changes format.',
    content: sourceRecoveryBrief,
  },
  {
    key: 'identity-investigation',
    label: 'Export Identity Investigation Brief',
    dialogTitle: 'Export Identity Investigation Brief',
    suggestedFileName: 'Identity-Investigation-Brief-For-Any-AI.md',
    description: 'Use when symbol, ISIN, or company-name continuity needs official evidence.',
    content: identityInvestigationBrief,
  },
  {
    key: 'recovery-guide',
    label: 'Export Recovery Guide',
    dialogTitle: 'Export Identity Recovery Guide',
    suggestedFileName: 'Identity-Recovery-Guide.md',
    description: 'Portable guide to the recovery and external-research workflow.',
    content: recoveryGuide,
  },
];
