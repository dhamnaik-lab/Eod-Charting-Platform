use std::io::{Cursor, Read};
use zip::ZipArchive;

use crate::bhavcopy::types::AppResult;

pub const MAX_BHAVCOPY_ZIP_ENTRY_BYTES: u64 = 128 * 1024 * 1024;

pub fn extract_first_csv_from_zip(buffer: &[u8]) -> AppResult<Option<Vec<u8>>> {
    let mut archive = match ZipArchive::new(Cursor::new(buffer)) {
        Ok(archive) => archive,
        Err(_) => return Ok(None),
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
