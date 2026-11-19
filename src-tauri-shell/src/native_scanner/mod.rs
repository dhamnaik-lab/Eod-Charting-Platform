//! Native (Rust) EOD scanner — NS-01 read-only core.
//!
//! Status: NS-01/NS-02 implementation only. **No Tauri command is registered and no UI
//! path reaches this module.** NS-03 adds the managed job/IPC layer and NS-04 adds the
//! opt-in ScannerWindow integration; the accepted TypeScript scanner remains the default
//! and the sole backend for unsupported rules.
//!
//! Layout:
//! - `ast`: strict versioned AST validation plus native evaluation.
//! - `reader`: validated, bounded, read-only `.eod` window reader.
//! - `universe`: canonical active-target enumeration from the database.
//! - `scan`: bounded, cancellable executor with explicit per-target outcomes.
//! - `database_source`: read-only database-backed source reusing accepted EOD semantics.

pub mod ast;
pub mod database_source;
pub mod ipc;
pub mod job;
pub mod reader;
pub mod scan;
pub mod universe;

/// Versioned native scanner transport contract (mirrors
/// `src/features/scanner/nativeScanContract.ts`).
pub const CONTRACT_VERSION: &str = "eod-native-scan-contract-v1";

#[cfg(test)]
mod parity;
#[cfg(test)]
mod tests;
