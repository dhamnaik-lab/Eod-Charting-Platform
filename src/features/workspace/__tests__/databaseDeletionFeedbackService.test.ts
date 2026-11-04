import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { deleteDatabasesSequentially } from '../databaseDeletionFeedbackService';

describe('database deletion feedback and partial completion', () => {
  it('deletes selected paths in order and reports complete success', async () => {
    const deleteDatabase = vi.fn(async (_path: string) => ({ success: true }));
    const onDeleted = vi.fn();

    const result = await deleteDatabasesSequentially(['first', 'second'], deleteDatabase, onDeleted);

    expect(deleteDatabase.mock.calls.map(([path]) => path)).toEqual(['first', 'second']);
    expect(onDeleted.mock.calls.map(([path]) => path)).toEqual(['first', 'second']);
    expect(result).toEqual({ deletedPaths: ['first', 'second'], failure: null, unattemptedPaths: [] });
  });

  it('stops at the first failure, distinguishes deleted and unattempted paths', async () => {
    const calls: string[] = [];
    const deleteDatabase = vi.fn(async (path: string) => {
      calls.push(path);
      if (path === 'second') throw new Error('Access denied');
    });
    const onDeleted = vi.fn();

    const result = await deleteDatabasesSequentially(
      ['first', 'second', 'third'],
      deleteDatabase,
      onDeleted,
    );

    expect(calls).toEqual(['first', 'second']);
    expect(onDeleted.mock.calls.map(([path]) => path)).toEqual(['first']);
    expect(result).toEqual({
      deletedPaths: ['first'],
      failure: { path: 'second', message: 'Access denied' },
      unattemptedPaths: ['third'],
    });
  });

  it('reports a failure on the first path without claiming a deletion', async () => {
    const onDeleted = vi.fn();
    const result = await deleteDatabasesSequentially(
      ['first', 'second'],
      async () => { throw new Error('Database busy'); },
      onDeleted,
    );

    expect(onDeleted).not.toHaveBeenCalled();
    expect(result).toEqual({
      deletedPaths: [],
      failure: { path: 'first', message: 'Database busy' },
      unattemptedPaths: ['second'],
    });
  });

  it('handles non-Error rejection messages without retrying operations', async () => {
    const result = await deleteDatabasesSequentially(
      ['first'],
      async () => Promise.reject('Delete rejected'),
      vi.fn(),
    );
    expect(result.failure).toEqual({ path: 'first', message: 'Delete rejected' });
    expect(result.deletedPaths).toEqual([]);
    expect(result.unattemptedPaths).toEqual([]);
  });

  it('does nothing for an empty pending selection', async () => {
    const deleteDatabase = vi.fn();
    const onDeleted = vi.fn();
    expect(await deleteDatabasesSequentially([], deleteDatabase, onDeleted)).toEqual({
      deletedPaths: [],
      failure: null,
      unattemptedPaths: [],
    });
    expect(deleteDatabase).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('keeps completion, re-confirmation and active-run close guards wired in the dialog', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/DeleteDatabaseDialog.tsx'), 'utf8');
    expect(source).toContain('!deletedPaths.has(path)');
    expect(source).toContain("setConfirmText('')");
    expect(source).toContain('disabled={isDeleting || deletedPaths.has(db.path)}');
    expect(source).toContain('onClick={requestClose} disabled={isDeleting}');
    expect(source).toContain('role="alert"');
    expect(source).toContain('role="status"');
    expect(source).toContain('deletionInFlightRef.current');
    expect(source).not.toContain("console.error('Failed to delete databases:'");
  });
});
