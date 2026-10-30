/** Called only by a deliberate Copy action; no database or receipt mutations. */
export async function copyTextToClipboard(text: string, clipboard: Pick<Clipboard,'writeText'> | null = typeof navigator === 'undefined' ? null : navigator.clipboard) {
  if (!clipboard?.writeText) throw new Error('Clipboard is unavailable. Select the value and copy it manually.');
  await clipboard.writeText(text);
}
