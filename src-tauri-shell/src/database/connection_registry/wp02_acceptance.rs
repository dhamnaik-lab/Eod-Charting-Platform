use super::*;

pub(crate) struct AcceptanceRegistry(Mutex<DatabaseRegistryFile>);

#[derive(Clone, Copy, serde::Deserialize)]
pub(crate) enum AcceptanceSlot {
    A,
    B,
}

impl AcceptanceRegistry {
    pub(crate) fn new(folders: [PathBuf; 2]) -> AppResult<Self> {
        let [a, b] = &folders;
        for folder in &folders {
            if !folder.is_absolute() || !folder.is_dir() || folder.to_str().is_none() {
                return Err("WP-02 requires two existing absolute database folder paths.".into());
            }
        }
        if fs::canonicalize(a).map_err(|error| error.to_string())?
            == fs::canonicalize(b).map_err(|error| error.to_string())?
        {
            return Err("WP-02 requires two distinct database folders.".into());
        }
        Ok(Self(Mutex::new(DatabaseRegistryFile {
            recent: folders
                .iter()
                .zip(["A", "B"])
                .map(|(folder, label)| KnownDatabase {
                    path: path_to_string(folder),
                    label: label.into(),
                    last_opened_at: String::new(),
                })
                .collect(),
            ..DatabaseRegistryFile::default()
        })))
    }

    fn lock(&self) -> AppResult<std::sync::MutexGuard<'_, DatabaseRegistryFile>> {
        self.0
            .lock()
            .map_err(|_| "WP-02 selection registry is unavailable.".into())
    }

    pub(super) fn snapshot(&self) -> AppResult<DatabaseRegistryFile> {
        Ok(self.lock()?.clone())
    }

    pub(crate) fn select(&self, slot: AcceptanceSlot) -> AppResult<String> {
        let _permit = database_use::acquire_use()?;
        let _registry = database_use::lock_registry()?;
        let mut registry = self.lock()?;
        let mut candidate = registry.clone();
        let index = match slot {
            AcceptanceSlot::A => 0,
            AcceptanceSlot::B => 1,
        };
        candidate.last_active_path = Some(candidate.recent[index].path.clone());
        advance_selection_revision(&mut candidate)?;
        let selection = native_selection_from_registry(&candidate)?
            .ok_or("WP-02 database selection is unavailable.")?;
        database_deletion::require_unblocked(&selection.folder)?;
        let _canonical =
            database_use::CanonicalAccess::for_database(&selection.folder)?.begin_read()?;
        require_registry_wal_family(&candidate, &selection)?;
        let (_guard, connection) = open_wp02_acceptance_connection(&selection.folder)?;
        connection
            .prepare("SELECT symbol, exchange FROM instruments LIMIT 0")
            .map_err(|error| format!("WP-02 read-only database verification failed: {error}"))?;
        drop(connection);
        if native_selection_from_registry(&candidate)?.as_ref() != Some(&selection) {
            return Err("NUMERIC_HISTORY_DATABASE_CHANGED".into());
        }
        *registry = candidate;
        Ok(selection.database_identity)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seed(folder: &Path, schema: bool) -> PathBuf {
        fs::create_dir(folder).unwrap();
        let path = folder.join(DATABASE_FILE_NAME);
        let connection = Connection::open(&path).unwrap();
        if schema {
            connection
                .execute_batch("CREATE TABLE instruments (symbol TEXT, exchange TEXT);")
                .unwrap();
        }
        path
    }

    #[test]
    fn wp02_acceptance_reselection_updates_only_the_memory_registry() {
        let root = tempfile::tempdir().unwrap();
        let [a, b] = [root.path().join("A"), root.path().join("B")];
        let files = [seed(&a, true), seed(&b, true)];
        let before = files.each_ref().map(|file| fs::read(file).unwrap());
        let registry = AcceptanceRegistry::new([a.clone(), b.clone()]).unwrap();
        assert!(registry.snapshot().unwrap().last_active_path.is_none());
        let first = registry.select(AcceptanceSlot::A).unwrap();
        let second = registry.select(AcceptanceSlot::B).unwrap();
        let third = registry.select(AcceptanceSlot::A).unwrap();
        assert_eq!(
            [first, second, third],
            [
                format!("{}#1", a.display()),
                format!("{}#2", b.display()),
                format!("{}#3", a.display()),
            ]
        );
        for (path, bytes) in files.into_iter().zip(before) {
            assert_eq!(fs::read(&path).unwrap(), bytes);
            let entries = fs::read_dir(path.parent().unwrap()).unwrap().count();
            assert_eq!(entries, 1, "Selection should create no database sidecars");
        }
    }

    #[test]
    fn wp02_acceptance_refuses_missing_schema_without_preparing_it() {
        let root = tempfile::tempdir().unwrap();
        let [a, b] = [root.path().join("A"), root.path().join("B")];
        seed(&a, true);
        let incomplete = seed(&b, false);
        let registry = AcceptanceRegistry::new([a, b]).unwrap();
        registry.select(AcceptanceSlot::A).unwrap();
        let before = fs::read(&incomplete).unwrap();
        assert!(registry.select(AcceptanceSlot::B).is_err());
        assert_eq!(registry.snapshot().unwrap().active_selection_revision, 1);
        assert_eq!(fs::read(incomplete).unwrap(), before);
    }

    #[test]
    fn wp02_acceptance_reads_clean_wal_database_without_writers_or_sidecars() {
        let root = tempfile::tempdir().unwrap();
        let folder = root.path().join("wal");
        let file = seed(&folder, true);
        let writer = Connection::open(&file).unwrap();
        assert_eq!(
            writer
                .query_row("PRAGMA journal_mode=WAL", [], |row| row.get::<_, String>(0))
                .unwrap(),
            "wal"
        );
        drop(writer);
        let before = fs::read(&file).unwrap();
        let (guard, reader) = open_wp02_acceptance_connection(&folder).unwrap();
        assert!(fs::OpenOptions::new().write(true).open(&file).is_err());
        assert_eq!(
            reader
                .query_row("SELECT count(*) FROM instruments", [], |row| row
                    .get::<_, usize>(0))
                .unwrap(),
            0
        );
        drop(reader);
        drop(guard);
        assert!(fs::OpenOptions::new().write(true).open(&file).is_ok());
        assert_eq!(fs::read(file).unwrap(), before);
        assert_eq!(fs::read_dir(folder).unwrap().count(), 1);
    }

    #[test]
    fn wp02_acceptance_refuses_sidecars_before_sqlite_opens() {
        let root = tempfile::tempdir().unwrap();
        let folder = root.path().join("sidecars");
        let file = seed(&folder, true);
        let sidecar = folder.join(format!("{DATABASE_FILE_NAME}-wal"));
        fs::write(&sidecar, b"sidecar fixture").unwrap();
        let before = fs::read(&file).unwrap();
        let error = open_wp02_acceptance_connection(&folder).unwrap_err();
        assert!(error.contains("-wal sidecar"), "{error}");
        assert_eq!(fs::read(file).unwrap(), before);
        assert_eq!(fs::read(sidecar).unwrap(), b"sidecar fixture");
        assert_eq!(fs::read_dir(folder).unwrap().count(), 2);
    }

    #[test]
    fn wp02_acceptance_refuses_shared_sqlite_hardlink_without_reselection() {
        let root = tempfile::tempdir().unwrap();
        let [a, b] = [root.path().join("A"), root.path().join("B")];
        let file = seed(&a, true);
        fs::create_dir(&b).unwrap();
        fs::hard_link(&file, b.join(DATABASE_FILE_NAME)).unwrap();
        let registry = AcceptanceRegistry::new([a, b]).unwrap();
        let error = registry.select(AcceptanceSlot::A).unwrap_err();
        assert!(error.contains("single SQLite filename"), "{error}");
        assert!(registry.snapshot().unwrap().last_active_path.is_none());
    }
}
