import type { CorporateActionImportRow } from '@/platform';

type Announcement = Pick<CorporateActionImportRow, 'actionType'> & Partial<Pick<CorporateActionImportRow,
  'purposeRaw' | 'cashAmount' | 'factor' | 'priceFactor' | 'ratioNum' | 'ratioDen' | 'oldFaceValue' | 'newFaceValue'>>;

// Mirror informational_closure.rs. Both classifiers run the shared parity fixture.
const MEETING_BODIES = ['AGM', 'EGM', 'ANNUALGENERAL MEETING', 'ADJOURNED ANNUAL GENERAL MEETING',
  'MEETING OF EQUITY SHAREHOLDERS'];
const CLOSURE_BODIES = ['ANNUAL CLOSURE', 'ANNUAL BOOK CLOSURE'];
const NOTICE_BODIES = ['INTEREST PAYMENT', 'INTEREST PAYEMENT', 'E VOTING', 'E-VOTING', 'EVOTING', 'NIL',
  'BUY-BACK', 'BUYBACK', 'BUY BACK', 'BUYBACK OF SHARES', 'BUY BACK OF SHARES', 'BUY BACK-TENDER OFFER',
  'BUYBACK-TENDER OFFER', 'BUY-BACK OF SHARES', 'BUY BACK - TENDER OFFER', 'REDEMPTION', 'ELECTION OF DIRECTORS', 'EGM-ELECTION OF DIRECTORS', 'UPDATION OF RECORDS', '-'];
const REVISED_TOKENS = ['PURPOSE', 'BC', 'BOOK', 'CLOSURE', 'DATE', 'DATES', 'DT', 'START', 'END', 'RECORD', 'AGM', 'AND'];
const FINANCIAL_WORDS = ['RS', 'RE', 'INR', 'BONUS', 'BON', 'SPLIT', 'SPL', 'RIGHT', 'RIGHTS', 'MERGER',
  'REDUCTION', 'DISTRIBUTION', 'INTEREST', 'REDEMPTION'];
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();
const meetingText = (value: string) => normalize(value.replace(/[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/g, ' '));
const stripOrdinal = (value: string) => value.match(/^\d{1,3}(?:ST|ND|RD|TH) (.*)$/)?.[1];

function isRevisedNote(rest: string): boolean {
  const words = normalize(rest.replace(/[()[\]\/&]/g, ' ')).split(' ');
  if (words.join(' ') === 'RD CHANGED TO BC') return true;
  return words.length > 1 && words.at(-1) === 'REVISED'
    && words.slice(0, -1).every(word => REVISED_TOKENS.includes(word));
}

function isMeetingNote(rest: string, bracketedRevised: boolean): boolean {
  const cleaned = meetingText(rest);
  if (cleaned === 'REVISED') return bracketedRevised;
  if (isRevisedNote(rest)) return true;
  const words = cleaned.split(' ');
  return words.some((word, i) => word === 'BOOK' && words[i + 1] === 'CLOSURE')
    && words.every(word => REVISED_TOKENS.includes(word));
}

function isBondNotice(text: string): boolean {
  const cleaned = meetingText(text);
  if (/\d|₹|\b(?:RS|RE|INR)\b/.test(cleaned)) return false;
  return ['BUYBACK OF BONDS', 'BUY BACK OF BONDS', 'PAYMENT OF AMT OF BUYBACK', 'PAYMENT OF AMOUNT OF BUYBACK',
    'PAYMENT OF AMT OF BUYBACK TO BONDHOLDERS', 'PAYMENT OF AMOUNT OF BUYBACK TO BONDHOLDERS',
    'PAYMENT OF INTEREST BUYBACK AMOUNT TO BONDHOLDERS',
    'PAYMENT OF INTEREST AND BUYBACK AMOUNT TO BONDHOLDERS'].includes(cleaned);
}

function matchesBodies(text: string, bodies: readonly string[]): boolean {
  return bodies.some(body => {
    if (!text.startsWith(body)) return false;
    const rest = text.slice(body.length).replace(/^\./, '');
    return !rest || isRevisedNote(rest);
  });
}

function meetingLike(word: string, expected: string): boolean {
  if (word[0] !== expected[0] || /[^\x00-\x7f]/.test(word) || Math.abs(word.length - expected.length) > 2) return false;
  let previous = Array.from({ length: expected.length + 1 }, (_, i) => i);
  for (let i = 0; i < word.length; i += 1) {
    const next = [i + 1];
    for (let j = 0; j < expected.length; j += 1) {
      next.push(Math.min(previous[j + 1] + 1, next[j] + 1, previous[j] + Number(word[i] !== expected[j])));
    }
    previous = next;
  }
  return previous[expected.length] <= 2;
}

function isMeetingPurpose(value: string): boolean {
  if (value.split('/').some(part => !part.trim())) return false;
  const bracketedRevised = /(?:\(\s*REVISED\s*\)|\[\s*REVISED\s*\])$/i.test(value.trim());
  const cleaned = meetingText(value);
  const text = stripOrdinal(cleaned) ?? cleaned;
  if (/\d|₹/.test(text) || text.split(/[^A-Z]+/).some(word => FINANCIAL_WORDS.includes(word)
    || ['DIV', 'DEMERG', 'AMALGAM', 'CONSOLID'].some(prefix => word.startsWith(prefix)))) return false;
  const words = text.split(' ');
  for (let end = 1; end <= words.length; end += 1) {
    if (end < words.length && !isMeetingNote(words.slice(end).join(' '), bracketedRevised)) continue;
    const core = words.slice(0, end);
    if (['AGM', 'EGM'].includes(core.at(-1) ?? '')) {
      core.pop();
      if (!core.length) return true;
    }
    const last = (core.pop() ?? '').replace(/(?:AGM|EGM)$/, '');
    if (!meetingLike(last, 'MEETING') || !meetingLike(core.pop() ?? '', 'GENERAL')) continue;
    if (meetingLike(core.at(-1) ?? '', 'ANNUAL')) core.pop();
    if (meetingLike(core.at(-1) ?? '', 'ORDINARY')) {
      core.pop();
      if (!meetingLike(core.at(-1) ?? '', 'EXTRA')) continue;
      core.pop();
    } else if (meetingLike(core.at(-1) ?? '', 'EXTRA') || meetingLike(core.at(-1) ?? '', 'EXTRAORDINARY')) core.pop();
    if (!core.length) return true;
  }
  return false;
}

function isSingleNotice(text: string): boolean {
  return isMeetingPurpose(text) || matchesBodies(text, MEETING_BODIES)
    || matchesBodies(stripOrdinal(text) ?? text, MEETING_BODIES)
    || matchesBodies(text, CLOSURE_BODIES) || matchesBodies(text, NOTICE_BODIES) || isBondNotice(text);
}

export function isInformationalCorporateAnnouncement(row: Announcement): boolean {
  if (row.actionType !== 'OTHER' || [row.cashAmount, row.factor, row.priceFactor, row.ratioNum, row.ratioDen,
    row.oldFaceValue, row.newFaceValue].some(value => value != null)) return false;
  const purpose = normalize(row.purposeRaw ?? '');
  if (meetingText(purpose) === 'BUY BACK OF SHARE' || isSingleNotice(purpose)) return true;
  const parts = purpose.split('/').map(part => part.trim());
  return parts.length > 1 && parts.every(part => !!part && isSingleNotice(part));
}

export function needsCorporateActionClassificationRefresh(row: CorporateActionImportRow): boolean {
  if (row.reviewStatus === 'APPROVED' || row.approvedCorporateActionId != null) return false;
  // Let the backend parser classify unfamiliar Other wording; avoid a second
  // financial-keyword grammar drifting from the canonical parser.
  return (row.actionType === 'OTHER' && !isInformationalCorporateAnnouncement(row))
    || ['SPLIT', 'BONUS'].includes(row.actionType)
    || /^(Quick-resolved|Awaiting verified historical identity evidence)/.test(row.message ?? '')
    || (row.actionType === 'DIVIDEND' &&
      (['UNSUPPORTED', 'NEEDS_REVIEW'].includes(row.reviewStatus) || row.purposeRaw.includes('%')));
}

export function hasCombinedSplitBonusAnnouncement(row: CorporateActionImportRow): boolean {
  return ['SPLIT', 'BONUS'].includes(row.actionType)
    && /\bBON(?:US)?\b/i.test(row.purposeRaw)
    && /\b(SPLIT|SPLT|SPL|SUB[ -]?DIVISION)\b/i.test(row.purposeRaw);
}
