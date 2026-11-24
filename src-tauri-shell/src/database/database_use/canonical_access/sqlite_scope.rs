use std::fs::{self, File};
use std::io::{ErrorKind, Read};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::{acquire_lock, atomic_write, folder_identity, AppResult, MAX_STATE_BYTES};

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(super) struct SqliteParticipant {
    pub(super) folder: PathBuf,
    pub(super) marker: String,
}

#[derive(Debug)]
pub(super) struct SqliteLease {
    pub(super) key: String,
    pub(super) participants: Vec<SqliteParticipant>,
    _lock: File,
}

impl SqliteLease {
    pub(super) fn acquire(
        sqlite_file: &Path,
        folder: &Path,
        namespace: &Path,
        exclusive: bool,
    ) -> AppResult<Option<Self>> {
        let physical = match fs::canonicalize(sqlite_file) {
            Ok(path) => path,
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(format!("Unable to resolve the SQLite file: {error}")),
        };
        if !physical.is_file() {
            return Err("The canonical SQLite path must be a file.".into());
        }
        if !exclusive && sqlite_link_count(&physical)? != 1 {
            return Err(
                "Canonical history requires a single SQLite filename for its WAL family.".into(),
            );
        }
        let identity = folder_identity(&physical)?;
        let key = format!("{:x}", Sha256::digest(&identity));
        let lock = acquire_lock(namespace, &format!("sqlite-{key}.lock"), exclusive)?;
        if folder_identity(sqlite_file)? != identity {
            return Err("The SQLite file changed during canonical lease admission.".into());
        }
        check_wal_alias(
            &namespace.join(format!("sqlite-{key}.wal-review-required")),
            has_file_reparse_point(sqlite_file)?,
            exclusive,
        )?;

        let registry = namespace.join(format!("sqlite-{key}.participants"));
        let mut participants = read_participants(&registry)?;
        let previous_count = participants.len();
        let physical_folder = physical
            .parent()
            .ok_or("SQLite file has no parent folder.")?;
        for path in [folder, physical_folder] {
            let marker = format!("{:x}.state", Sha256::digest(folder_identity(path)?));
            if !participants.iter().any(|prior| prior.marker == marker) {
                participants.push(SqliteParticipant {
                    folder: path.to_owned(),
                    marker,
                });
            }
        }
        if exclusive && participants.len() != previous_count {
            // Publish membership before any owner can leave a durable mutation intent.
            let bytes = serde_json::to_vec(&participants).map_err(|error| error.to_string())?;
            if bytes.len() as u64 > MAX_STATE_BYTES {
                return Err("Canonical SQLite participant registry is too large.".into());
            }
            atomic_write(&registry, &bytes)?;
        }
        Ok(Some(Self {
            key,
            participants,
            _lock: lock,
        }))
    }
}

pub(super) fn has_file_reparse_point(path: &Path) -> AppResult<bool> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(format!("Unable to inspect the SQLite filename: {error}")),
    };
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
        Ok(metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0)
    }
    #[cfg(not(windows))]
    Ok(metadata.file_type().is_symlink())
}

fn check_wal_alias(marker: &Path, file_alias: bool, exclusive: bool) -> AppResult<()> {
    let observed = marker.try_exists().map_err(|error| error.to_string())?;
    if exclusive && file_alias && !observed {
        atomic_write(marker, b"sqlite-filename-alias-v1\n")?;
    }
    if !exclusive && (file_alias || observed) {
        return Err(
            "Canonical history requires review of an alternate SQLite WAL filename.".into(),
        );
    }
    Ok(())
}

fn read_participants(registry: &Path) -> AppResult<Vec<SqliteParticipant>> {
    let file = match File::open(registry) {
        Ok(file) => file,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => {
            return Err(format!(
                "Unable to read canonical SQLite participants: {error}"
            ))
        }
    };
    let mut bytes = Vec::new();
    file.take(MAX_STATE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Unable to read canonical SQLite participants: {error}"))?;
    if bytes.len() as u64 > MAX_STATE_BYTES {
        return Err("Canonical SQLite participant registry is too large.".into());
    }
    let participants: Vec<SqliteParticipant> = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Unrecognized canonical SQLite participant registry: {error}"))?;
    for participant in &participants {
        if !is_folder_marker(&participant.marker) || !participant.folder.is_absolute() {
            return Err("Unrecognized canonical SQLite participant registry entry.".into());
        }
    }
    Ok(participants)
}

pub(super) fn is_folder_marker(name: &str) -> bool {
    name.strip_suffix(".state")
        .is_some_and(|key| key.len() == 64 && key.bytes().all(|byte| byte.is_ascii_hexdigit()))
}

#[cfg(windows)]
fn sqlite_link_count(path: &Path) -> AppResult<u64> {
    use std::os::windows::io::AsRawHandle;
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::Storage::FileSystem::{
        GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION,
    };

    let file = File::open(path).map_err(|error| error.to_string())?;
    let mut info = BY_HANDLE_FILE_INFORMATION::default();
    // The file remains open for the call and the output is a valid Win32 buffer.
    unsafe { GetFileInformationByHandle(HANDLE(file.as_raw_handle()), &mut info) }
        .map_err(|error| error.to_string())?;
    Ok(u64::from(info.nNumberOfLinks))
}

#[cfg(unix)]
fn sqlite_link_count(path: &Path) -> AppResult<u64> {
    use std::os::unix::fs::MetadataExt;

    fs::metadata(path)
        .map(|metadata| metadata.nlink())
        .map_err(|error| error.to_string())
}

#[cfg(not(any(windows, unix)))]
fn sqlite_link_count(_path: &Path) -> AppResult<u64> {
    Err("Canonical SQLite link verification is unavailable.".into())
}

#[cfg(test)]
#[test]
fn nsr7_v2_wal_alias_observation_fences_later_readers_without_changing_writer_eligibility() {
    let dir = tempfile::tempdir().unwrap();
    let marker = dir.path().join("alias-observed");
    assert!(check_wal_alias(&marker, true, false).is_err());
    assert!(!marker.exists());
    check_wal_alias(&marker, true, true).unwrap();
    assert!(marker.is_file());
    assert!(check_wal_alias(&marker, false, false).is_err());
    assert!(check_wal_alias(&marker, false, true).is_ok());
}
