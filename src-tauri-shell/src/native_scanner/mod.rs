//! Native (Rust) EOD scanner — opt-in backend, OFF by default.
//!
//! The accepted TypeScript scanner remains the default and the sole backend for every
//! scanner this module does not implement. NS-04 reaches this module only behind an
//! explicit user toggle, and any unsupported or alert-bearing run falls back to
//! TypeScript for the whole run.
//!
//! Layout:
//! - `ast`: strict versioned AST validation plus native evaluation.
//! - `reader`: validated, bounded, read-only `.eod` window reader.
//! - `universe`: canonical active-target enumeration from the database.
//! - `scan`: bounded, cancellable executor with explicit per-target outcomes.
//! - `patterns`: P0-01/NS-R3 bridge to all 54 built-in chart-pattern detectors (`scanner_*_gap` + `chart_patterns`).
//! - `chart_patterns`: NS-R3 native Rust implementations of the 50 non-gap-batch chart patterns.
//! - `database_source`: read-only database-backed source reusing accepted EOD semantics.
//! - `job` / `ipc`: managed runs, events, cancellation and the database-use permit.

pub mod ast;
pub mod chart_patterns;
pub mod core_results;
pub mod database_source;
pub mod ipc;
pub mod job;
pub mod numeric_history;
pub mod patterns;
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
