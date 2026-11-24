//! Per-database canonical source coordination. The existing database-use
//! permit remains the outer lifetime guard against deletion.

use std::fs::{self, File, TryLockError};
use std::io::Read;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::{atomic_write, open_lock, state_dir, AppResult};

mod sqlite_scope;
use sqlite_scope::{SqliteLease, SqliteParticipant};

const BUSY: &str = "CANONICAL_PRICE_STORE_BUSY";
const CLEAN: &[u8] = b"clean-v1\n";
const DIRTY: &[u8] = b"dirty-v1\n";

const STATE_VERSION: u8 = 2;
const MAX_PENDING_QUOTES: usize = 256;
const MAX_STATE_BYTES: u64 = 256 * 1024;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub(in crate::database) struct QuoteIntent {
    pub exchange: String,
    pub symbol: String,
    pub date: String,
    pub price_bits: [u64; 4],
    pub volume: i64,
    pub open_interest: i64,
    pub context: Option<QuoteContext>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub(in crate::database) struct QuoteContext {
    pub previous: Option<(String, u64)>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub(in crate::database) struct QuoteDeletion {
    pub exchange: String,
    pub symbol: String,
    pub date: String,
    pub context: Option<QuoteDeletionContext>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub(in crate::database) struct QuoteDeletionContext {
    pub had_instrument: bool,
    pub previous: Option<(String, u64)>,
    pub binary: BinaryAfterDelete,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub(in crate::database) enum BinaryAfterDelete {
    Absent,
    Present {
        scale: u32,
        count: u32,
        digest: String,
    },
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub(in crate::database) struct BulkQuoteDeletion {
    pub exchanges: Vec<String>,
    pub start_date: String,
    pub end_date: String,
    pub selected_symbols: Option<usize>,
    pub selection_digest: String,
    pub expected_digest: Option<String>,
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct PendingMutations {
    version: u8,
    legacy_interrupted: bool,
    quotes: Vec<QuoteIntent>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    deletions: Vec<QuoteDeletion>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    bulk_deletions: Vec<BulkQuoteDeletion>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    writers: Vec<CanonicalWriterIntent>,
    #[serde(default, skip_serializing_if = "is_false")]
    schema_preparation_pending: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    sqlite_key: Option<String>,
}

fn is_false(value: &bool) -> bool {
    !*value
}

impl PendingMutations {
    fn empty(legacy_interrupted: bool) -> Self {
        Self {
            version: STATE_VERSION,
            legacy_interrupted,
            quotes: Vec::new(),
            deletions: Vec::new(),
            bulk_deletions: Vec::new(),
            writers: Vec::new(),
            schema_preparation_pending: false,
            sqlite_key: None,
        }
    }

    fn interrupted(&self) -> bool {
        self.legacy_interrupted || self.schema_preparation_pending || self.count() > 0
    }

    fn count(&self) -> usize {
        self.quotes.len() + self.deletions.len() + self.bulk_deletions.len() + self.writers.len()
    }

    fn bind_to_sqlite(&mut self, lease: &CanonicalLease) -> AppResult<()> {
        let key = lease.sqlite.as_ref().map(|sqlite| sqlite.key.as_str());
        if !self.interrupted() {
            self.sqlite_key = key.map(str::to_owned);
        } else if self
            .sqlite_key
            .as_deref()
            .is_some_and(|prior| Some(prior) != key)
        {
            return Err("CANONICAL_PRICE_STORE_INTERRUPTED: The pending operation belongs to a different SQLite file.".into());
        }
        Ok(())
    }

    fn migration_intent(&self) -> Option<usize> {
        self.writers
            .iter()
            .position(|intent| matches!(intent, CanonicalWriterIntent::BinaryMigration))
    }

    fn require_completed_migration(&self) -> AppResult<()> {
        if self.migration_intent().is_some() {
            return Err("CANONICAL_PRICE_STORE_INTERRUPTED: Pending binary migration. Retry the migration to complete it.".into());
        }
        Ok(())
    }

    fn persist(&self, path: &Path) -> AppResult<()> {
        if self.count() == 0 && !self.schema_preparation_pending {
            let state = if self.legacy_interrupted {
                DIRTY
            } else {
                CLEAN
            };
            return atomic_write(path, state);
        }
        let bytes = serde_json::to_vec(self).map_err(|error| error.to_string())?;
        if bytes.len() as u64 > MAX_STATE_BYTES {
            return Err("Canonical price store coordination state is too large.".into());
        }
        atomic_write(path, &bytes)
    }
}

pub(crate) struct CanonicalAccess {
    folder: PathBuf,
    sqlite_file: PathBuf,
    namespace: PathBuf,
    lock_name: String,
    marker: PathBuf,
}

impl CanonicalAccess {
    pub(crate) fn sqlite_key_for_file(sqlite_file: &Path) -> AppResult<String> {
        Ok(format!(
            "{:x}",
            Sha256::digest(folder_identity(sqlite_file)?)
        ))
    }

    pub(in crate::database) fn has_file_reparse_point(sqlite_file: &Path) -> AppResult<bool> {
        sqlite_scope::has_file_reparse_point(sqlite_file)
    }

    pub(in crate::database) fn for_database(folder: &Path) -> AppResult<Self> {
        Self::in_namespace(folder, &state_dir()?)
    }

    pub(in crate::database) fn in_namespace(folder: &Path, namespace: &Path) -> AppResult<Self> {
        let (_, sqlite_file) = super::super::connection_registry::load_database_file_info(folder)?;
        Self::in_namespace_for_file(folder, sqlite_file, namespace)
    }

    fn in_namespace_for_file(
        folder: &Path,
        sqlite_file: PathBuf,
        namespace: &Path,
    ) -> AppResult<Self> {
        let canonical = fs::canonicalize(folder)
            .map_err(|error| format!("Unable to resolve the canonical price store: {error}"))?;
        if !canonical.is_dir() {
            return Err("The canonical price store must be a directory.".into());
        }
        let key = format!("{:x}", Sha256::digest(folder_identity(&canonical)?));
        let namespace = namespace.join("canonical-price-store-v1");
        fs::create_dir_all(&namespace)
            .map_err(|error| format!("Unable to prepare price store coordination: {error}"))?;
        Ok(Self {
            folder: canonical,
            sqlite_file,
            marker: namespace.join(format!("{key}.state")),
            lock_name: format!("{key}.lock"),
            namespace,
        })
    }

    pub(in crate::database) fn begin_quote_mutation(
        &self,
        quote: QuoteIntent,
    ) -> AppResult<MutationLease> {
        self.begin_mutation(|pending| pending.quotes.push(quote))
    }

    pub(in crate::database) fn begin_quote_deletion(
        &self,
        deletion: QuoteDeletion,
    ) -> AppResult<QuoteDeletionLease> {
        self.begin_mutation(|pending| pending.deletions.push(deletion))
            .map(QuoteDeletionLease)
    }

    pub(in crate::database) fn begin_bulk_quote_deletion(
        &self,
        deletion: BulkQuoteDeletion,
    ) -> AppResult<BulkQuoteDeletionLease> {
        self.begin_mutation(|pending| pending.bulk_deletions.push(deletion))
            .map(BulkQuoteDeletionLease)
    }

    fn writer_access(folder: &Path) -> AppResult<Self> {
        #[cfg(test)]
        return Self::in_namespace(folder, folder);
        #[cfg(not(test))]
        Self::for_database(folder)
    }

    fn bhavcopy_access(sqlite_file: &Path) -> AppResult<Self> {
        let folder = sqlite_file
            .parent()
            .ok_or("Bhavcopy database file has no parent folder.")?;
        #[cfg(test)]
        let namespace = folder.to_owned();
        #[cfg(not(test))]
        let namespace = state_dir()?;
        Self::in_namespace_for_file(folder, sqlite_file.to_owned(), &namespace)
    }

    pub(crate) fn lock_bhavcopy_recovery(sqlite_file: &Path) -> AppResult<CanonicalLease> {
        let access = Self::bhavcopy_access(sqlite_file)?;
        let lock = access.acquire(true)?;
        access.require_other_migrations_complete(&lock)?;
        access.load_pending()?.require_completed_migration()?;
        Ok(lock)
    }

    pub(crate) fn lock_bhavcopy_apply(sqlite_file: &Path) -> AppResult<CanonicalWriterLease> {
        Self::bhavcopy_access(sqlite_file)?.lock_writer(false)
    }

    pub(crate) fn lock_writer_for_database(folder: &Path) -> AppResult<CanonicalWriterLease> {
        Self::writer_access(folder)?.lock_writer(false)
    }

    pub(in crate::database) fn lock_binary_migration(
        folder: &Path,
    ) -> AppResult<CanonicalWriterLease> {
        Self::writer_access(folder)?.lock_writer(true)
    }

    fn lock_writer(self, resume_binary_migration: bool) -> AppResult<CanonicalWriterLease> {
        let lock = self.acquire(true)?;
        self.require_bhavcopy_checkpoint(&lock)?;
        self.require_other_migrations_complete(&lock)?;
        let mut pending = self.load_pending()?;
        pending.bind_to_sqlite(&lock)?;
        if !resume_binary_migration {
            pending.require_completed_migration()?;
        }
        Ok(CanonicalWriterLease(MutationLease {
            _lock: lock,
            marker: self.marker,
            pending,
        }))
    }

    pub(in crate::database) fn run_schema_preparation<C, T>(
        &self,
        open: impl FnOnce() -> AppResult<C>,
        prepare: impl FnOnce(C) -> AppResult<T>,
    ) -> AppResult<T> {
        let mut lock = self.acquire(true)?;
        let connection = open()?;
        // Creating a database can materialize SQLite's empty file. Schema writes
        // start only after that file has joined the physical lease.
        if lock.sqlite.is_none() {
            lock.sqlite = self.acquire_sqlite(true)?;
        }
        if lock.sqlite.is_none() {
            return Err("The SQLite file must exist before preparing the schema.".into());
        }
        let mut pending = self.load_pending()?;
        pending.bind_to_sqlite(&lock)?;
        pending.schema_preparation_pending = true;
        pending.persist(&self.marker)?;
        let result = prepare(connection)?;
        pending.schema_preparation_pending = false;
        pending.persist(&self.marker)?;
        Ok(result)
    }

    fn begin_mutation(
        &self,
        append: impl FnOnce(&mut PendingMutations),
    ) -> AppResult<MutationLease> {
        let lock = self.acquire(true)?;
        self.require_bhavcopy_checkpoint(&lock)?;
        self.require_other_migrations_complete(&lock)?;
        let mut pending = self.load_pending()?;
        pending.bind_to_sqlite(&lock)?;
        pending.require_completed_migration()?;
        if pending.count() >= MAX_PENDING_QUOTES {
            return Err(
                "Too many pending quote intents. Review recovery before applying another quote."
                    .into(),
            );
        }
        append(&mut pending);
        pending.persist(&self.marker)?;
        Ok(MutationLease {
            _lock: lock,
            marker: self.marker.clone(),
            pending,
        })
    }

    pub(in crate::database) fn begin_read(&self) -> AppResult<CanonicalLease> {
        let lock = self.acquire(false)?;
        if self.load_pending()?.interrupted() {
            return Err("CANONICAL_PRICE_STORE_INTERRUPTED".into());
        }
        for participant in self.other_participants(&lock) {
            if Self::load_marker(&self.namespace.join(&participant.marker))?.interrupted() {
                return Err("CANONICAL_PRICE_STORE_INTERRUPTED".into());
            }
        }
        if let Some(sqlite) = &lock.sqlite {
            self.require_no_unbound_interruption(&sqlite.key)?;
        }
        self.require_bhavcopy_checkpoint(&lock)?;
        Ok(lock)
    }

    fn require_no_unbound_interruption(&self, sqlite_key: &str) -> AppResult<()> {
        for entry in fs::read_dir(&self.namespace).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            if !sqlite_scope::is_folder_marker(&entry.file_name().to_string_lossy()) {
                continue;
            }
            let pending = Self::load_marker(&entry.path())?;
            if pending.interrupted()
                && pending
                    .sqlite_key
                    .as_deref()
                    .is_none_or(|key| key == sqlite_key)
            {
                return Err("CANONICAL_PRICE_STORE_INTERRUPTED".into());
            }
        }
        Ok(())
    }

    fn other_participants<'a>(
        &'a self,
        lock: &'a CanonicalLease,
    ) -> impl Iterator<Item = &'a SqliteParticipant> {
        lock.sqlite
            .iter()
            .flat_map(|sqlite| &sqlite.participants)
            .filter(|participant| {
                self.marker
                    .file_name()
                    .is_some_and(|name| name != participant.marker.as_str())
            })
    }

    fn require_other_migrations_complete(&self, lock: &CanonicalLease) -> AppResult<()> {
        for participant in self.other_participants(lock) {
            Self::load_marker(&self.namespace.join(&participant.marker))?
                .require_completed_migration()?;
        }
        Ok(())
    }

    fn require_bhavcopy_checkpoint(&self, lock: &CanonicalLease) -> AppResult<()> {
        let folders = std::iter::once(self.folder.as_path()).chain(
            self.other_participants(lock)
                .map(|participant| participant.folder.as_path()),
        );
        for folder in folders {
            if !crate::bhavcopy_recovery::has_pending_sessions(folder)? {
                continue;
            }
            return Err("CANONICAL_PRICE_STORE_INTERRUPTED: Pending Bhavcopy recovery. Run a Bhavcopy update to resume recovery.".into());
        }
        Ok(())
    }

    fn acquire(&self, exclusive: bool) -> AppResult<CanonicalLease> {
        let folder = acquire_lock(&self.namespace, &self.lock_name, exclusive)?;
        let sqlite = self.acquire_sqlite(exclusive)?;
        Ok(CanonicalLease {
            sqlite,
            _folder: folder,
        })
    }

    fn acquire_sqlite(&self, exclusive: bool) -> AppResult<Option<SqliteLease>> {
        SqliteLease::acquire(&self.sqlite_file, &self.folder, &self.namespace, exclusive)
    }

    fn load_pending(&self) -> AppResult<PendingMutations> {
        Self::load_marker(&self.marker)
    }

    fn load_marker(marker: &Path) -> AppResult<PendingMutations> {
        let file = match File::open(marker) {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Ok(PendingMutations::empty(false))
            }
            Err(error) => {
                return Err(format!(
                    "Unable to read canonical price store coordination state: {error}"
                ))
            }
        };
        let mut bytes = Vec::new();
        file.take(MAX_STATE_BYTES + 1)
            .read_to_end(&mut bytes)
            .map_err(|error| {
                format!("Unable to read canonical price store coordination state: {error}")
            })?;
        match bytes.as_slice() {
            CLEAN => return Ok(PendingMutations::empty(false)),
            DIRTY => return Ok(PendingMutations::empty(true)),
            _ => {}
        }
        if bytes.len() as u64 > MAX_STATE_BYTES {
            return Err("Canonical price store coordination state is too large.".into());
        }
        let state: PendingMutations = serde_json::from_slice(&bytes).map_err(|error| {
            format!("Unrecognized canonical price store coordination state: {error}")
        })?;
        if state.version != STATE_VERSION
            || state.count() > MAX_PENDING_QUOTES
            || (state.count() == 0 && !state.schema_preparation_pending)
        {
            return Err("Unrecognized canonical price store coordination state.".into());
        }
        Ok(state)
    }

    // This proof path will be called by an explicit recovery workflow when exposed.
    #[cfg(test)]
    pub(in crate::database) fn verify_pending_quote(
        &self,
        mut verify: impl FnMut(&QuoteIntent) -> AppResult<bool>,
    ) -> AppResult<usize> {
        let lock = self.acquire(true)?;
        let mut pending = self.load_pending()?;
        pending.bind_to_sqlite(&lock)?;
        let mut verified = Vec::new();
        for (index, intent) in pending.quotes.iter().enumerate() {
            if verify(intent)? {
                verified.push(index);
            }
        }
        for &index in verified.iter().rev() {
            pending.quotes.remove(index);
        }
        if !verified.is_empty() {
            pending.persist(&self.marker)?;
        }
        Ok(verified.len())
    }
}

#[derive(Debug)]
pub(crate) struct CanonicalLease {
    sqlite: Option<SqliteLease>,
    _folder: File,
}

fn acquire_lock(namespace: &Path, name: &str, exclusive: bool) -> AppResult<File> {
    let lock = open_lock(namespace, name)?;
    let result = if exclusive {
        lock.try_lock()
    } else {
        lock.try_lock_shared()
    };
    result.map_err(|error| match error {
        TryLockError::WouldBlock => BUSY.into(),
        TryLockError::Error(error) => {
            format!("Unable to coordinate the canonical price store: {error}")
        }
    })?;
    Ok(lock)
}

pub(in crate::database) struct MutationLease {
    _lock: CanonicalLease,
    marker: PathBuf,
    pending: PendingMutations,
}

impl MutationLease {
    pub(in crate::database) fn prepare_quote(&mut self, context: QuoteContext) -> AppResult<()> {
        self.pending
            .quotes
            .last_mut()
            .expect("active quote intent")
            .context = Some(context);
        self.pending.persist(&self.marker)
    }

    pub(in crate::database) fn verify_quote(
        mut self,
        verify: impl FnOnce(&QuoteIntent) -> AppResult<bool>,
    ) -> AppResult<bool> {
        let intent = self.pending.quotes.last().expect("active quote intent");
        if !verify(intent)? {
            return Ok(false);
        }
        let intent = self.pending.quotes.pop().expect("verified quote intent");
        // An exact retry may finish the same prepared intent. Other quotes and
        // older intents with different values or context still require review.
        self.pending.quotes.retain(|pending| pending != &intent);
        self.pending.persist(&self.marker)?;
        Ok(true)
    }
}

pub(in crate::database) struct QuoteDeletionLease(MutationLease);

impl QuoteDeletionLease {
    pub(in crate::database) fn prepare(&mut self, context: QuoteDeletionContext) -> AppResult<()> {
        self.0
            .pending
            .deletions
            .last_mut()
            .expect("active deletion intent")
            .context = Some(context);
        self.0.pending.persist(&self.0.marker)
    }

    pub(in crate::database) fn verify(
        mut self,
        verify: impl FnOnce(&QuoteDeletion) -> AppResult<bool>,
    ) -> AppResult<bool> {
        let intents = &mut self.0.pending.deletions;
        if !verify(intents.last().expect("active deletion intent"))? {
            return Ok(false);
        }
        let completed = intents.pop().expect("verified deletion intent");
        // Identical prepared retries can clear their matching deletion. An
        // interrupted upsert or a different deletion remains pending.
        intents.retain(|pending| pending != &completed);
        self.0.pending.persist(&self.0.marker)?;
        Ok(true)
    }
}

pub(in crate::database) struct BulkQuoteDeletionLease(MutationLease);

impl BulkQuoteDeletionLease {
    pub(in crate::database) fn prepare(&mut self, digest: String) -> AppResult<()> {
        self.0
            .pending
            .bulk_deletions
            .last_mut()
            .expect("active bulk delete intent")
            .expected_digest = Some(digest);
        self.0.pending.persist(&self.0.marker)
    }

    pub(in crate::database) fn verify(
        mut self,
        verify: impl FnOnce(&BulkQuoteDeletion) -> AppResult<bool>,
    ) -> AppResult<bool> {
        let intents = &mut self.0.pending.bulk_deletions;
        if !verify(intents.last().expect("active bulk delete intent"))? {
            return Ok(false);
        }
        let completed = intents.pop().expect("verified bulk delete intent");
        intents.retain(|pending| pending != &completed);
        self.0.pending.persist(&self.0.marker)?;
        Ok(true)
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) enum CanonicalWriterIntent {
    ManualCsv,
    ManualUndo {
        session_id: String,
    },
    BinaryMigration,
    SymbolMerge {
        source_symbol: String,
        source_exchange: String,
        target_symbol: String,
        target_exchange: String,
    },
}

pub(crate) struct CanonicalWriterLease(MutationLease);

impl CanonicalWriterLease {
    pub(crate) fn begin_apply(
        mut self,
        intent: CanonicalWriterIntent,
    ) -> AppResult<CanonicalWriterApply> {
        if matches!(intent, CanonicalWriterIntent::BinaryMigration) {
            if let Some(index) = self.0.pending.migration_intent() {
                return Ok(CanonicalWriterApply(self.0, index));
            }
        }
        if self.0.pending.count() >= MAX_PENDING_QUOTES {
            return Err("Too many pending canonical mutations. Review recovery before applying another change.".into());
        }
        let index = self.0.pending.writers.len();
        self.0.pending.writers.push(intent);
        self.0.pending.persist(&self.0.marker)?;
        Ok(CanonicalWriterApply(self.0, index))
    }
}

pub(crate) struct CanonicalWriterApply(MutationLease, usize);

impl CanonicalWriterApply {
    pub(crate) fn finish_known_consistent(mut self) -> AppResult<()> {
        self.0.pending.writers.remove(self.1);
        self.0.pending.persist(&self.0.marker)
    }
}

#[cfg(windows)]
fn folder_identity(folder: &Path) -> AppResult<Vec<u8>> {
    let identity = crate::database::database_deletion::identity(folder)
        .map_err(|error| format!("Unable to identify the canonical price store: {error}"))?;
    serde_json::to_vec(&identity).map_err(|error| error.to_string())
}

#[cfg(unix)]
fn folder_identity(folder: &Path) -> AppResult<Vec<u8>> {
    use std::os::unix::fs::MetadataExt;

    let metadata = fs::metadata(folder)
        .map_err(|error| format!("Unable to identify the canonical price store: {error}"))?;
    let mut identity = metadata.dev().to_le_bytes().to_vec();
    identity.extend_from_slice(&metadata.ino().to_le_bytes());
    Ok(identity)
}

#[cfg(not(any(windows, unix)))]
fn folder_identity(_folder: &Path) -> AppResult<Vec<u8>> {
    Err("Canonical price store coordination is unavailable on this platform.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nsr7_writer_lease_preserves_unresolved_operation_after_another_success() {
        let root = tempfile::tempdir().unwrap();
        let folder = root.path();
        let access = CanonicalAccess::in_namespace(folder, folder).unwrap();
        let writer = CanonicalAccess::lock_writer_for_database(folder).unwrap();
        assert_eq!(
            access.begin_read().unwrap_err(),
            "CANONICAL_PRICE_STORE_BUSY"
        );
        drop(writer);
        assert!(access.begin_read().is_ok());

        let interrupted = CanonicalAccess::lock_writer_for_database(folder)
            .unwrap()
            .begin_apply(CanonicalWriterIntent::ManualCsv)
            .unwrap();
        drop(interrupted);
        assert_eq!(
            access.begin_read().unwrap_err(),
            "CANONICAL_PRICE_STORE_INTERRUPTED"
        );

        CanonicalAccess::lock_writer_for_database(folder)
            .unwrap()
            .begin_apply(CanonicalWriterIntent::ManualUndo {
                session_id: "other".into(),
            })
            .unwrap()
            .finish_known_consistent()
            .unwrap();
        assert_eq!(access.load_pending().unwrap().writers.len(), 1);
        assert_eq!(
            access.begin_read().unwrap_err(),
            "CANONICAL_PRICE_STORE_INTERRUPTED"
        );
    }
}
