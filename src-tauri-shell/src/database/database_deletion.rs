use std::ffi::OsStr;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::{database_use, AppResult};

#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub(super) use self::windows::{has_redirect, identity, verify_file, PinnedTree};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub(super) struct Identity {
    volume: u64,
    file: [u8; 16],
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub(super) struct Marker {
    pub(super) id: Identity,
    pub(super) path: PathBuf,
}

pub(super) const REFUSED: &str = "DATABASE_DELETION_REFUSED";
pub(super) const BLOCKED: &str = "DATABASE_DELETION_INTERRUPTED";
pub(super) const FAILED: &str = "DATABASE_DELETION_FAILED";
pub(super) const FAILED_MARKED: &str = "DATABASE_DELETION_FAILED_MARKED";
pub(super) const PARTIAL: &str = "DATABASE_DELETION_PARTIAL";
pub(super) const REGISTRY_FAILED: &str = "DATABASE_DELETION_REGISTRY_FAILED";

#[derive(Debug)]
pub(super) struct RemovalFailure {
    pub(super) removed: usize,
    pub(super) error: io::Error,
}

pub(super) fn refuse(message: impl std::fmt::Display) -> String {
    format!("{REFUSED}: {message}")
}

pub(super) fn validate_path(input: &str) -> AppResult<&Path> {
    if input.trim().is_empty() || input.chars().any(char::is_control) {
        return Err(refuse("A nonempty database folder path is required."));
    }
    if input
        .split(['/', '\\'])
        .any(|part| matches!(part, "." | ".."))
    {
        return Err(refuse("Relative path components are refused."));
    }
    let path = Path::new(input);
    if !path.is_absolute() || path.parent().is_none() {
        return Err(refuse(
            "A fully qualified database folder below the volume root is required.",
        ));
    }
    Ok(path)
}

pub(super) fn safe_component(name: &OsStr) -> bool {
    let Some(name) = name.to_str() else {
        return false;
    };
    if name.trim().is_empty()
        || name.ends_with(['.', ' '])
        || name.chars().any(|ch| {
            ch.is_control() || matches!(ch, '/' | '\\' | ':' | '<' | '>' | '"' | '|' | '?' | '*')
        })
    {
        return false;
    }
    let stem = name
        .split('.')
        .next()
        .unwrap_or_default()
        .trim_end()
        .to_ascii_uppercase();
    !matches!(
        stem.as_str(),
        "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$"
    ) && !["COM", "LPT"].iter().any(|prefix| {
        stem.strip_prefix(prefix).is_some_and(|suffix| {
            matches!(
                suffix,
                "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"
            )
        })
    })
}

fn marker_path(state: &Path) -> PathBuf {
    state.join("interrupted-deletions.json")
}

pub(super) fn read_markers(state: &Path) -> AppResult<Vec<Marker>> {
    let path = marker_path(state);
    match fs::read(&path) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(|error| {
            format!(
                "{BLOCKED}: Unable to read the deletion safety records at {}: {error}",
                path.display()
            )
        }),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(error) => Err(format!(
            "{BLOCKED}: Unable to read {}: {error}",
            path.display()
        )),
    }
}

pub(super) fn write_markers(state: &Path, markers: &[Marker]) -> AppResult<()> {
    let bytes = serde_json::to_vec_pretty(markers).map_err(|e| e.to_string())?;
    database_use::atomic_write(&marker_path(state), &bytes)
}

pub(super) fn blocked(path: &Path) -> AppResult<bool> {
    blocked_in(&database_use::state_dir()?, path)
}

pub(super) fn blocked_in(state: &Path, path: &Path) -> AppResult<bool> {
    let markers = read_markers(state)?;
    if markers.is_empty() {
        return Ok(false);
    }
    for ancestor in path.ancestors() {
        let canonical = match ancestor.canonicalize() {
            Ok(canonical) => canonical,
            Err(error) if error.kind() == io::ErrorKind::NotFound => continue,
            Err(error) => {
                return Err(format!(
                    "{BLOCKED}: Cannot verify database identity: {error}"
                ))
            }
        };
        let suffix = path
            .strip_prefix(ancestor)
            .map_err(|error| error.to_string())?;
        let candidate = if suffix.as_os_str().is_empty() {
            canonical.clone()
        } else {
            canonical.join(suffix)
        };
        if markers
            .iter()
            .any(|marker| candidate.starts_with(&marker.path))
        {
            return Ok(true);
        }
        #[cfg(windows)]
        for parent in canonical.ancestors() {
            let id = identity(parent)
                .map_err(|error| format!("{BLOCKED}: Cannot verify database identity: {error}"))?;
            if markers.iter().any(|marker| marker.id == id) {
                return Ok(true);
            }
        }
        return Ok(false);
    }
    Ok(false)
}

pub(crate) fn require_unblocked(path: &Path) -> AppResult<()> {
    if blocked(path)? {
        return Err(format!(
            "{BLOCKED}: {} was marked during a deletion and needs review before it can be opened.",
            path.display()
        ));
    }
    Ok(())
}

#[cfg(all(test, windows))]
mod tests;
