use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use super::AppResult;

pub(crate) fn validate_component(name: &str) -> AppResult<()> {
    let stem = name
        .split('.')
        .next()
        .unwrap_or_default()
        .trim_end()
        .to_ascii_uppercase();
    let device = matches!(
        stem.as_str(),
        "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$"
    ) || ["COM", "LPT"].iter().any(|&prefix| {
        stem.strip_prefix(prefix).is_some_and(|suffix| {
            matches!(
                suffix,
                "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"
            )
        })
    });
    if name.is_empty()
        || name.ends_with(['.', ' '])
        || name.chars().any(|c| {
            c.is_control() || matches!(c, '/' | '\\' | ':' | '<' | '>' | '"' | '|' | '?' | '*')
        })
        || device
    {
        return Err(format!("Invalid storage path component: {name:?}"));
    }
    Ok(())
}

fn check_entry(path: &Path, directory: bool) -> AppResult<()> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(format!(
                "Cannot inspect storage path {}: {error}",
                path.display()
            ))
        }
    };
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
        if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return Err(format!(
                "Storage path is a reparse point: {}",
                path.display()
            ));
        }
    }
    if metadata.file_type().is_symlink()
        || (directory && !metadata.is_dir())
        || (!directory && !metadata.is_file())
    {
        return Err(format!("Unexpected storage path type: {}", path.display()));
    }
    Ok(())
}

pub(crate) fn directory(root: &Path, components: &[&str]) -> AppResult<PathBuf> {
    let mut path = root.to_path_buf();
    for name in components {
        validate_component(name)?;
        path.push(name);
        check_entry(&path, true)?;
    }
    Ok(path)
}

pub(crate) fn file(parent: &Path, name: &str) -> AppResult<PathBuf> {
    validate_component(name)?;
    let path = parent.join(name);
    check_entry(&path, false)?;
    Ok(path)
}

pub(crate) fn eod_directory(root: &Path, exchange: &str) -> AppResult<PathBuf> {
    directory(root, &["eod_data", exchange])
}

pub(crate) fn eod_file(parent: &Path, symbol: &str) -> AppResult<PathBuf> {
    validate_component(symbol)?;
    file(parent, &format!("{symbol}.eod"))
}

pub(crate) fn eod_path(root: &Path, exchange: &str, symbol: &str) -> AppResult<PathBuf> {
    eod_file(&eod_directory(root, exchange)?, symbol)
}

pub(crate) fn eod_write_path(root: &Path, exchange: &str, symbol: &str) -> AppResult<PathBuf> {
    let path = eod_path(root, exchange, symbol)?;
    check_sibling(&path.with_extension("tmp"))?;
    Ok(path)
}

pub(crate) fn check_sibling(path: &Path) -> AppResult<()> {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or("Invalid storage filename")?;
    let parent = path.parent().ok_or("Missing storage parent directory")?;
    file(parent, name)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn issue_01_preserves_exchange_filenames_and_rejects_invalid_components() {
        let root = tempfile::tempdir().unwrap();
        for symbol in ["M&M", "BAJAJ-AUTO", "NIFTY 50", "ABC..DEF", "500325"] {
            let path = eod_write_path(root.path(), "NSE", symbol).unwrap();
            assert_eq!(path.file_name().unwrap(), format!("{symbol}.eod").as_str());
        }
        for name in [
            "",
            ".",
            "..",
            "NUL",
            "COM¹.log",
            "INVALID?",
            "trailing.",
            "trailing ",
        ] {
            assert!(validate_component(name).is_err(), "{name:?}");
        }
    }

    #[test]
    fn issue_01_rejects_wrong_storage_entry_types() {
        let root = tempfile::tempdir().unwrap();
        let exchange = root.path().join("eod_data").join("NSE");
        fs::create_dir_all(exchange.join("TEST.tmp")).unwrap();
        assert!(eod_write_path(root.path(), "NSE", "TEST").is_err());
        fs::write(root.path().join("eod_data").join("BSE"), "not a directory").unwrap();
        assert!(eod_directory(root.path(), "BSE").is_err());
    }

    #[cfg(windows)]
    #[test]
    fn issue_01_rejects_windows_storage_junction() {
        let root = tempfile::tempdir().unwrap();
        let external = tempfile::tempdir().unwrap();
        let junction = root.path().join("eod_data");
        let output = std::process::Command::new("cmd")
            .args(["/D", "/C", "mklink", "/J"])
            .arg(&junction)
            .arg(external.path())
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );

        let result = eod_path(root.path(), "NSE", "TEST");
        fs::remove_dir(junction).unwrap();
        assert!(result.unwrap_err().contains("reparse point"));
        assert!(external.path().is_dir());
    }

    #[cfg(unix)]
    #[test]
    fn issue_01_rejects_storage_directory_symlink() {
        let root = tempfile::tempdir().unwrap();
        let external = tempfile::tempdir().unwrap();
        let link = root.path().join("eod_data");
        std::os::unix::fs::symlink(external.path(), link).unwrap();
        assert!(eod_path(root.path(), "NSE", "TEST").is_err());
    }
}
