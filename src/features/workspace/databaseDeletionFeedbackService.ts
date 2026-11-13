export interface DatabaseDeletionFailure {
  path: string;
  message: string;
  reason?: string;
}

const deletionReasonPattern = /^(DATABASE_(?:DELETION_(?:REFUSED|FAILED(?:_MARKED)?|PARTIAL|REGISTRY_FAILED|INTERRUPTED)|OPERATION_BUSY)|PRICE_STORE_OPERATION_BUSY)(?::\s*|$)/;

function formatDeletionFailure(path: string, error: unknown): DatabaseDeletionFailure {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(deletionReasonPattern);
  if (!match) return { path, message };

  const reason = match[1];
  const detail = message.slice(match[0].length);
  if (reason.endsWith('_BUSY')) {
    return { path, reason, message: 'Database operations are in progress. Try again after they finish.' };
  }
  return { path, reason, message: detail || message };
}

export interface DatabaseDeletionResult {
  deletedPaths: string[];
  failure: DatabaseDeletionFailure | null;
  unattemptedPaths: string[];
}

/**
 * Keep the existing stop-on-first-failure deletion order, returning an
 * explicit record of completed and unattempted operations for the dialog.
 */
export async function deleteDatabasesSequentially(
  paths: readonly string[],
  deleteDatabase: (path: string) => Promise<unknown>,
  onDeleted: (path: string) => void,
): Promise<DatabaseDeletionResult> {
  const deletedPaths: string[] = [];

  for (const path of paths) {
    try {
      await deleteDatabase(path);
    } catch (error) {
      return {
        deletedPaths,
        failure: formatDeletionFailure(path, error),
        unattemptedPaths: paths.slice(deletedPaths.length + 1),
      };
    }

    deletedPaths.push(path);
    onDeleted(path);
  }

  return { deletedPaths, failure: null, unattemptedPaths: [] };
}
