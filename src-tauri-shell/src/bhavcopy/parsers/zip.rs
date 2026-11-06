use std::io::{Cursor, Read};
use zip::ZipArchive;

use crate::bhavcopy::types::AppResult;

pub const MAX_BHAVCOPY_ZIP_ENTRY_BYTES: u64 = 128 * 1024 * 1024;

fn looks_like_html(buffer: &[u8]) -> bool {
    let head = &buffer[..buffer.len().min(256)];
    let text = String::from_utf8_lossy(head).trim_start().to_ascii_lowercase();
    text.starts_with("<!doctype") || text.starts_with("<html")
}

pub fn extract_first_csv_from_zip(buffer: &[u8]) -> AppResult<Option<Vec<u8>>> {
    // Sources can answer a missing archive with an HTML page; keep that as "not found".
    if looks_like_html(buffer) {
        return Ok(None);
    }
    let mut archive = match ZipArchive::new(Cursor::new(buffer)) {
        Ok(archive) => archive,
        // A body that is not a readable ZIP is a source fault, not an absent file.
        Err(error) => return Err(format!("Invalid ZIP archive: {error}")),
    };

    for index in 0..archive.len() {
        let file = archive.by_index(index).map_err(|error| error.to_string())?;
        let name = file.name().to_ascii_lowercase();
        if !(name.ends_with(".csv") || name.ends_with(".txt")) {
            continue;
        }
        if file.size() > MAX_BHAVCOPY_ZIP_ENTRY_BYTES {
            return Err(format!(
                "ZIP entry {} exceeds the 128 MB safety limit ({} bytes).",
                file.name(),
                file.size()
            ));
        }
        let mut extracted = Vec::with_capacity((file.size() as usize).min(16 * 1024 * 1024));
        file.take(MAX_BHAVCOPY_ZIP_ENTRY_BYTES + 1)
            .read_to_end(&mut extracted)
            .map_err(|error| error.to_string())?;
        if extracted.len() as u64 > MAX_BHAVCOPY_ZIP_ENTRY_BYTES {
            return Err("ZIP entry exceeded the 128 MB safety limit while extracting.".to_string());
        }
        return Ok(Some(extracted));
    }

    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn build_zip(entries: &[(&str, &[u8])]) -> Vec<u8> {
        let mut writer = ::zip::ZipWriter::new(Cursor::new(Vec::new()));
        for (name, data) in entries {
            writer
                .start_file(*name, ::zip::write::FileOptions::default())
                .unwrap();
            writer.write_all(data).unwrap();
        }
        writer.finish().unwrap().into_inner()
    }

    #[test]
    fn html_body_stays_a_missing_file() {
        assert_eq!(extract_first_csv_from_zip(b"<!DOCTYPE html><html></html>").unwrap(), None);
    }

    #[test]
    fn non_zip_bytes_are_a_hard_error_not_a_missing_file() {
        let error = extract_first_csv_from_zip(b"garbage that is not a zip").unwrap_err();
        assert!(error.starts_with("Invalid ZIP archive"), "{error}");
    }

    #[test]
    fn truncated_zip_is_a_hard_error() {
        let zip = build_zip(&[("a.csv", b"SYMBOL,CLOSE\nAAA,1\n")]);
        let error = extract_first_csv_from_zip(&zip[..zip.len() / 2]).unwrap_err();
        assert!(error.starts_with("Invalid ZIP archive"), "{error}");
    }

    #[test]
    fn valid_zip_without_csv_entry_is_not_found() {
        let zip = build_zip(&[("readme.pdf", b"x")]);
        assert_eq!(extract_first_csv_from_zip(&zip).unwrap(), None);
    }

    #[test]
    fn valid_zip_returns_first_csv_entry() {
        let zip = build_zip(&[("a.csv", b"SYMBOL,CLOSE\nAAA,1\n")]);
        assert_eq!(
            extract_first_csv_from_zip(&zip).unwrap().unwrap(),
            b"SYMBOL,CLOSE\nAAA,1\n"
        );
    }
}
