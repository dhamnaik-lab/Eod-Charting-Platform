export interface DatabaseDeletionFailure {
  path: string;
  message: string;
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
        failure: {
          path,
          message: error instanceof Error ? error.message : String(error),
        },
        unattemptedPaths: paths.slice(deletedPaths.length + 1),
      };
    }

    deletedPaths.push(path);
    onDeleted(path);
  }

  return { deletedPaths, failure: null, unattemptedPaths: [] };
}
