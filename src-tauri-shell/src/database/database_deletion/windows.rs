use std::fs::{self, File, OpenOptions};
use std::io;
use std::os::windows::fs::{MetadataExt, OpenOptionsExt};
use std::os::windows::io::{AsRawHandle, FromRawHandle};
use std::path::{Component, Path, PathBuf, Prefix};
use windows::Win32::Foundation::HANDLE;
use windows::Win32::Storage::FileSystem::{
    FileDispositionInfoEx, FileIdInfo, GetDriveTypeW, GetFileInformationByHandleEx,
    GetFinalPathNameByHandleW, GetVolumeInformationByHandleW, SetFileInformationByHandle, DELETE,
    FILE_DISPOSITION_FLAG_DELETE, FILE_DISPOSITION_FLAG_POSIX_SEMANTICS, FILE_DISPOSITION_INFO_EX,
    FILE_DISPOSITION_INFO_EX_FLAGS, FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT,
    FILE_ID_INFO, FILE_READ_ATTRIBUTES, FILE_READ_DATA, FILE_SHARE_DELETE, FILE_SHARE_READ,
    FILE_SHARE_WRITE, VOLUME_NAME_GUID,
};

use super::{Identity, RemovalFailure};

const REPARSE_POINT: u32 = 0x400;

fn handle(file: &File) -> HANDLE {
    HANDLE(file.as_raw_handle())
}

fn volume_path(file: &File) -> io::Result<PathBuf> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    let mut buffer = vec![0u16; 512];
    loop {
        // The buffer is live and sized in UTF-16 code units.
        let length =
            unsafe { GetFinalPathNameByHandleW(handle(file), &mut buffer, VOLUME_NAME_GUID) }
                as usize;
        if length == 0 {
            return Err(io::Error::last_os_error());
        }
        if length < buffer.len() {
            return Ok(PathBuf::from(OsString::from_wide(&buffer[..length])));
        }
        buffer.resize(length + 1, 0);
    }
}

fn open(path: &Path, access: u32, share: u32, no_follow: bool) -> io::Result<File> {
    let flags = if no_follow {
        FILE_FLAG_OPEN_REPARSE_POINT.0
    } else {
        0
    };
    OpenOptions::new()
        .access_mode(access)
        .share_mode(share)
        .custom_flags(FILE_FLAG_BACKUP_SEMANTICS.0 | flags)
        .open(path)
}

fn identity_from(file: &File) -> io::Result<Identity> {
    let mut id = FILE_ID_INFO::default();
    // The handle is live and the output buffer matches FileIdInfo.
    unsafe {
        GetFileInformationByHandleEx(
            handle(file),
            FileIdInfo,
            (&mut id as *mut FILE_ID_INFO).cast(),
            std::mem::size_of::<FILE_ID_INFO>() as u32,
        )
    }
    .map_err(io::Error::other)?;
    if id.FileId.Identifier == [0; 16] {
        return Err(io::Error::other(
            "Windows did not return a stable file identity",
        ));
    }
    Ok(Identity {
        volume: id.VolumeSerialNumber,
        file: id.FileId.Identifier,
    })
}

pub(in crate::database) fn identity(path: &Path) -> io::Result<Identity> {
    let file = open(
        path,
        FILE_READ_ATTRIBUTES.0,
        FILE_SHARE_READ.0 | FILE_SHARE_WRITE.0 | FILE_SHARE_DELETE.0,
        false,
    )?;
    identity_from(&file)
}

pub(in crate::database) fn verify_file(
    path: &Path,
    deny_writes: bool,
) -> io::Result<(File, Identity)> {
    let share = FILE_SHARE_READ.0
        | if deny_writes {
            FILE_SHARE_DELETE.0
        } else {
            FILE_SHARE_WRITE.0
        };
    let file = open(path, FILE_READ_ATTRIBUTES.0 | FILE_READ_DATA.0, share, true)?;
    if !check_entry(&file)?.is_file() {
        return Err(io::Error::other("Expected a regular database file"));
    }
    let id = identity_from(&file)?;
    Ok((file, id))
}

pub(in crate::database) fn has_redirect(path: &Path) -> io::Result<bool> {
    for component in path.ancestors() {
        if fs::symlink_metadata(component)?.file_attributes() & REPARSE_POINT != 0 {
            return Ok(true);
        }
    }
    Ok(false)
}

fn check_entry(file: &File) -> io::Result<fs::Metadata> {
    let metadata = file.metadata()?;
    if metadata.file_attributes() & REPARSE_POINT != 0 {
        return Err(io::Error::other("Reparse points are refused"));
    }
    Ok(metadata)
}

fn pin_child(
    parent: &File,
    name: &std::ffi::OsStr,
    directory: bool,
    delete: bool,
) -> io::Result<File> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PWSTR;
    use windows::Wdk::Foundation::OBJECT_ATTRIBUTES;
    use windows::Wdk::Storage::FileSystem::{
        NtOpenFile, FILE_DIRECTORY_FILE, FILE_NON_DIRECTORY_FILE, FILE_OPEN_REPARSE_POINT,
        FILE_SYNCHRONOUS_IO_NONALERT,
    };
    use windows::Win32::Foundation::{
        RtlNtStatusToDosError, OBJECT_ATTRIBUTE_FLAGS, OBJ_CASE_INSENSITIVE, OBJ_DONT_REPARSE,
        UNICODE_STRING,
    };
    use windows::Win32::Storage::FileSystem::SYNCHRONIZE;
    use windows::Win32::System::IO::IO_STATUS_BLOCK;

    if !super::safe_component(name) {
        return Err(io::Error::other(
            "Unsafe name inside the database directory",
        ));
    }
    let mut name: Vec<_> = name.encode_wide().collect();
    let length = u16::try_from(name.len() * 2).map_err(io::Error::other)?;
    let name = UNICODE_STRING {
        Length: length,
        MaximumLength: length,
        Buffer: PWSTR(name.as_mut_ptr()),
    };
    let object = OBJECT_ATTRIBUTES {
        Length: std::mem::size_of::<OBJECT_ATTRIBUTES>() as u32,
        RootDirectory: handle(parent),
        ObjectName: &name,
        Attributes: OBJECT_ATTRIBUTE_FLAGS(OBJ_CASE_INSENSITIVE.0 | OBJ_DONT_REPARSE.0),
        ..Default::default()
    };
    let mut opened = HANDLE::default();
    let mut status_block = IO_STATUS_BLOCK::default();
    let access = FILE_READ_ATTRIBUTES.0
        | SYNCHRONIZE.0
        | if delete { DELETE.0 } else { 0 }
        | if directory { FILE_READ_DATA.0 } else { 0 };
    let share = FILE_SHARE_READ.0 | if directory { FILE_SHARE_WRITE.0 } else { 0 };
    let kind = if directory {
        FILE_DIRECTORY_FILE
    } else {
        FILE_NON_DIRECTORY_FILE
    };
    // The name is a single validated component and the root handle and
    // buffers remain alive. Only this verified parent can resolve the child.
    let status = unsafe {
        NtOpenFile(
            &mut opened,
            access,
            &object,
            &mut status_block,
            share,
            FILE_OPEN_REPARSE_POINT.0 | FILE_SYNCHRONOUS_IO_NONALERT.0 | kind.0,
        )
    };
    if status.0 < 0 {
        return Err(io::Error::from_raw_os_error(
            unsafe { RtlNtStatusToDosError(status) } as i32,
        ));
    }
    // NtOpenFile returned an owned handle on success.
    let file = unsafe { File::from_raw_handle(opened.0) };
    check_entry(&file)?;
    Ok(file)
}

pub(in crate::database) struct PinnedTree {
    pub(in crate::database) path: PathBuf,
    pub(in crate::database) id: Identity,
    root: File,
    _ancestors: Vec<File>,
}

impl PinnedTree {
    pub(in crate::database) fn open(path: &Path) -> io::Result<Self> {
        Self::open_with_root_access(path, true)
    }

    pub(in crate::database) fn pin_marker_store(path: &Path) -> io::Result<Self> {
        // Deny delete sharing to pin the directory, but request no DELETE
        // access ourselves so Windows can atomically replace its marker file.
        Self::open_with_root_access(path, false)
    }

    fn open_with_root_access(path: &Path, delete_root: bool) -> io::Result<Self> {
        use std::os::windows::ffi::OsStrExt;
        use windows::core::PCWSTR;
        let mut components = path.components();
        let Some(Component::Prefix(prefix)) = components.next() else {
            return Err(io::Error::other(
                "A fully qualified local Windows path is required",
            ));
        };
        let letter = match prefix.kind() {
            Prefix::Disk(letter) | Prefix::VerbatimDisk(letter) => letter,
            _ => {
                return Err(io::Error::other(
                    "Only local Windows drive paths support safe deletion",
                ))
            }
        };
        if components.next() != Some(Component::RootDir) {
            return Err(io::Error::other(
                "A fully qualified local Windows path is required",
            ));
        }
        let mut current = PathBuf::from(format!("{}:\\", char::from(letter)));
        let drive: Vec<_> = current.as_os_str().encode_wide().chain([0]).collect();
        // DRIVE_FIXED is 3. Remote and substituted paths are checked again by identity.
        if unsafe { GetDriveTypeW(PCWSTR(drive.as_ptr())) } != 3 {
            return Err(io::Error::other(
                "Deletion requires a fixed local NTFS volume",
            ));
        }
        let mut components = components.peekable();
        if components.peek().is_none() {
            return Err(io::Error::other("A volume root cannot be deleted"));
        }
        let volume = open(
            &current,
            FILE_READ_DATA.0 | FILE_READ_ATTRIBUTES.0,
            FILE_SHARE_READ.0 | FILE_SHARE_WRITE.0,
            true,
        )?;
        check_entry(&volume)?;
        let mut ancestors = vec![volume];
        // Resolve the held drive-root handle to the volume GUID namespace. A
        // drive letter can be remapped while the directory handles stay open.
        current = volume_path(&ancestors[0])?;
        let volume_name = current.to_string_lossy();
        if !volume_name.starts_with(r"\\?\Volume{") || !volume_name.ends_with("}\\") {
            return Err(io::Error::other(
                "A fixed NTFS volume root could not be verified",
            ));
        }
        let mut filesystem = [0u16; 16];
        // Query the filesystem for the live root handle.
        unsafe {
            GetVolumeInformationByHandleW(
                handle(&ancestors[0]),
                None,
                None,
                None,
                None,
                Some(&mut filesystem),
            )
        }
        .map_err(io::Error::other)?;
        if !filesystem.starts_with(&[78, 84, 70, 83, 0]) {
            return Err(io::Error::other("Deletion requires NTFS"));
        }
        while let Some(Component::Normal(name)) = components.next() {
            if !super::safe_component(name) {
                return Err(io::Error::other("Invalid Windows path component"));
            }
            current.push(name);
            let last = components.peek().is_none();
            let file = pin_child(
                ancestors.last().expect("pinned volume"),
                name,
                true,
                last && delete_root,
            )?;
            if last {
                let id = identity_from(&file)?;
                if id.volume != identity_from(&ancestors[0])?.volume {
                    return Err(io::Error::other(
                        "The requested path crosses a volume boundary",
                    ));
                }
                return Ok(Self {
                    path: current,
                    id,
                    root: file,
                    _ancestors: ancestors,
                });
            }
            ancestors.push(file);
        }
        Err(io::Error::other(
            "The requested path contains an invalid component",
        ))
    }

    pub(in crate::database) fn preflight(&self, database: &Path) -> io::Result<()> {
        let (file, _) = verify_file(database, true)?;
        let actual = volume_path(&file)?;
        let name = actual
            .file_name()
            .ok_or_else(|| io::Error::other("Missing SQLite filename"))?;
        inspect_tree(
            &self.root,
            &self.path,
            Some((name, false)),
            0,
            &mut |_, _| Ok(()),
        )
    }

    pub(in crate::database) fn pin_database(
        &self,
        path: &Path,
        expected: Identity,
    ) -> io::Result<File> {
        let name = path
            .file_name()
            .ok_or_else(|| io::Error::other("Missing SQLite filename"))?;
        let db = pin_child(&self.root, name, false, true)?;
        if identity_from(&db)? != expected || !db.metadata()?.is_file() {
            return Err(io::Error::other("The verified SQLite file changed"));
        }
        Ok(db)
    }

    pub(in crate::database) fn remove(
        self,
        database: (&Path, File),
        mut before_entry: impl FnMut(&Path) -> io::Result<()>,
    ) -> Result<(), RemovalFailure> {
        let mut removed = 0;
        // Take the main SQLite file with DELETE access before removing any contents.
        // The bundled SQLite VFS does not share DELETE access.
        let result = (|| {
            let actual_database = volume_path(&database.1)?;
            let name = actual_database
                .file_name()
                .ok_or_else(|| io::Error::other("Missing SQLite filename"))?;
            inspect_tree(
                &self.root,
                &self.path,
                Some((name, true)),
                0,
                &mut |entry, file| {
                    before_entry(entry)?;
                    dispose(file)?;
                    removed += 1;
                    Ok(())
                },
            )?;
            before_entry(database.0)?;
            dispose(database.1)?;
            removed += 1;
            before_entry(&self.path)?;
            dispose(self.root)?;
            removed += 1;
            match fs::symlink_metadata(&self.path) {
                Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
                Err(error) => Err(error),
                Ok(_) => Err(io::Error::other("The database directory still exists")),
            }
        })();
        result.map_err(|error| RemovalFailure { removed, error })
    }
}

// Every directory above an enumerated entry is pinned, and the final open refuses
// reparse points. Directory pins are retained until their contents have been visited.
fn inspect_tree(
    directory: &File,
    folder: &Path,
    root_database: Option<(&std::ffi::OsStr, bool)>,
    depth: usize,
    visit: &mut impl FnMut(&Path, File) -> io::Result<()>,
) -> io::Result<()> {
    if depth >= 128 {
        return Err(io::Error::other(
            "Database directory nesting exceeds the safe traversal limit",
        ));
    }
    if depth > 0 {
        for name in [
            super::super::DATABASE_MANIFEST_FILE,
            super::super::DATABASE_FILE_NAME,
        ] {
            match fs::symlink_metadata(folder.join(name)) {
                Ok(_) => return Err(io::Error::other("A nested database boundary was found")),
                Err(error) if error.kind() == io::ErrorKind::NotFound => {}
                Err(error) => return Err(error),
            }
        }
    }
    for entry in fs::read_dir(folder)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name();
        if root_database.is_some_and(|(db, skip)| skip && db == name) {
            continue;
        }
        if !super::safe_component(&name) {
            return Err(io::Error::other(
                "Unsafe name inside the database directory",
            ));
        }
        let file = pin_child(directory, &name, entry.file_type()?.is_dir(), true)?;
        let is_dir = file.metadata()?.is_dir();
        if let Some((db, _)) = root_database {
            if !managed_root_entry(&name, db, is_dir) {
                return Err(io::Error::other(format!(
                    "Unrecognized entry in the database folder: {}",
                    name.to_string_lossy()
                )));
            }
        }
        if is_dir {
            inspect_tree(&file, &path, None, depth + 1, visit)?;
        }
        visit(&path, file)?;
    }
    Ok(())
}

fn managed_root_entry(name: &std::ffi::OsStr, database: &std::ffi::OsStr, directory: bool) -> bool {
    let name = name.to_string_lossy().to_ascii_lowercase();
    if directory {
        return matches!(
            name.as_str(),
            "eod_data"
                | "reference-data"
                | "manual_import_recovery"
                | "bhavcopy_recovery"
                | "bhavcopy_admission"
                | "bhavcopy_index_evidence"
                | "historical_index_review"
        );
    }
    let database = database.to_string_lossy().to_ascii_lowercase();
    let index = "eod_binary_state.sqlite";
    name == super::super::DATABASE_MANIFEST_FILE
        || [&database[..], index].into_iter().any(|stem| {
            name.strip_prefix(stem)
                .is_some_and(|suffix| matches!(suffix, "" | "-wal" | "-shm" | "-journal"))
        })
}

fn dispose(file: File) -> io::Result<()> {
    let disposition = FILE_DISPOSITION_INFO_EX {
        Flags: FILE_DISPOSITION_INFO_EX_FLAGS(
            FILE_DISPOSITION_FLAG_DELETE.0 | FILE_DISPOSITION_FLAG_POSIX_SEMANTICS.0,
        ),
    };
    // The same no-follow handle that was verified is used for disposition.
    unsafe {
        SetFileInformationByHandle(
            handle(&file),
            FileDispositionInfoEx,
            (&disposition as *const FILE_DISPOSITION_INFO_EX).cast(),
            std::mem::size_of::<FILE_DISPOSITION_INFO_EX>() as u32,
        )
    }
    .map_err(io::Error::other)?;
    drop(file);
    Ok(())
}
