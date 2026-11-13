use std::fs::{self, File, OpenOptions, TryLockError};
use std::io::Write;
use std::ops::Deref;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};

use super::AppResult;

pub(crate) const BUSY: &str = "DATABASE_OPERATION_BUSY";

#[derive(Clone, Debug)]
pub(crate) struct DatabasePath {
    path: PathBuf,
    permit: Arc<File>,
}

impl DatabasePath {
    pub(super) fn new(path: PathBuf, permit: File) -> Self {
        Self {
            path,
            permit: Arc::new(permit),
        }
    }

    pub(super) fn with_path(self, path: PathBuf) -> Self {
        Self {
            path,
            permit: self.permit,
        }
    }
}

impl Deref for DatabasePath {
    type Target = Path;

    fn deref(&self) -> &Path {
        &self.path
    }
}

impl AsRef<Path> for DatabasePath {
    fn as_ref(&self) -> &Path {
        &self.path
    }
}

impl PartialEq for DatabasePath {
    fn eq(&self, other: &Self) -> bool {
        self.path == other.path
    }
}

impl serde::Serialize for DatabasePath {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.path.serialize(serializer)
    }
}

pub(super) fn state_dir() -> AppResult<PathBuf> {
    #[cfg(windows)]
    let base = Some(windows_local_app_data()?);
    #[cfg(not(windows))]
    let base = std::env::var_os("XDG_STATE_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/state")));
    let dir = base
        .filter(|p| p.is_absolute())
        .ok_or("Database safety state directory is unavailable.")?
        .join("EOD Chart Database Safety");
    fs::create_dir_all(&dir).map_err(|e| format!("Database safety state is unavailable: {e}"))?;
    Ok(dir)
}

#[cfg(windows)]
fn windows_local_app_data() -> AppResult<PathBuf> {
    use std::os::windows::ffi::OsStringExt;
    use windows::Win32::System::Com::CoTaskMemFree;
    use windows::Win32::UI::Shell::{FOLDERID_LocalAppData, SHGetKnownFolderPath, KF_FLAG_DEFAULT};

    // Query the effective user's Windows known folder independently of the
    // environment inherited by a particular desktop or maintenance launch.
    let path = unsafe { SHGetKnownFolderPath(&FOLDERID_LocalAppData, KF_FLAG_DEFAULT, None) }
        .map_err(|error| format!("Unable to resolve Windows Local AppData: {error}"))?;
    // The shell returns a NUL-terminated buffer owned by the COM allocator.
    let result = unsafe { std::ffi::OsString::from_wide(path.as_wide()) };
    unsafe { CoTaskMemFree(Some(path.0.cast())) };
    Ok(PathBuf::from(result))
}

fn open_lock(dir: &Path, name: &str) -> AppResult<File> {
    let mut options = OpenOptions::new();
    options.read(true).write(true).create(true).truncate(false);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        use windows::Win32::Storage::FileSystem::{FILE_SHARE_READ, FILE_SHARE_WRITE};
        options.share_mode((FILE_SHARE_READ | FILE_SHARE_WRITE).0);
    }
    options
        .open(dir.join(name))
        .map_err(|e| format!("Unable to open database coordination lock: {e}"))
}

pub(crate) fn acquire_use() -> AppResult<File> {
    acquire_in(&state_dir()?, false)
}

pub(super) fn acquire_deletion(dir: &Path) -> AppResult<File> {
    acquire_in(dir, true)
}

pub(super) fn acquire_in(dir: &Path, exclusive: bool) -> AppResult<File> {
    let lock = open_lock(dir, "database-use.lock")?;
    let result = if exclusive {
        lock.try_lock()
    } else {
        lock.try_lock_shared()
    };
    result.map_err(|error| match error {
        TryLockError::WouldBlock => BUSY.to_string(),
        TryLockError::Error(error) => format!("Unable to lock database use: {error}"),
    })?;
    Ok(lock)
}

// Always taken after a database-use permit and before the cached connection lock.
pub(crate) fn lock_registry() -> AppResult<File> {
    let file = open_lock(&state_dir()?, "registry.lock")?;
    file.lock()
        .map_err(|e| format!("Unable to serialize database registry access: {e}"))?;
    Ok(file)
}

pub(super) fn atomic_write(path: &Path, content: &[u8]) -> AppResult<()> {
    static NEXT: AtomicU64 = AtomicU64::new(0);
    let (temporary, mut file) = loop {
        let suffix = NEXT.fetch_add(1, Ordering::Relaxed);
        let temporary = path.with_extension(format!("{}.{}.tmp", std::process::id(), suffix));
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
        {
            Ok(file) => break (temporary, file),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.to_string()),
        }
    };
    let written = file.write_all(content).and_then(|()| file.sync_all());
    drop(file);
    let result = written
        .map_err(|error| error.to_string())
        .and_then(|()| replace(&temporary, path));
    if result.is_err() {
        let _ = fs::remove_file(temporary);
    }
    result
}

#[cfg(windows)]
fn replace(from: &Path, to: &Path) -> AppResult<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    let from: Vec<_> = from.as_os_str().encode_wide().chain([0]).collect();
    let to: Vec<_> = to.as_os_str().encode_wide().chain([0]).collect();
    // Both strings are NUL-terminated and stay alive for the call.
    unsafe {
        MoveFileExW(
            PCWSTR(from.as_ptr()),
            PCWSTR(to.as_ptr()),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    }
    .map_err(|error| error.to_string())
}

#[cfg(not(windows))]
fn replace(from: &Path, to: &Path) -> AppResult<()> {
    fs::rename(from, to).map_err(|error| error.to_string())
}
