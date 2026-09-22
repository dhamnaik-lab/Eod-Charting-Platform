# Tauri Version Alignment

## Timestamp

2026-08-04_1724 IST

## Reason

Tauri development startup reported a major/minor package mismatch.

## Before

- @tauri-apps/api: 2.11.1
- @tauri-apps/cli: 2.11.4
- Rust tauri crate: 2.10.3

## After

- @tauri-apps/api: 2.11.1
- @tauri-apps/cli: 2.11.4
- Rust tauri crate: 2.11.5

## Files changed

- src-tauri-shell/Cargo.toml
- src-tauri-shell/Cargo.lock

## Validation

- cargo check --manifest-path src-tauri-shell/Cargo.toml
- npm run build
- npm run tauri:dev

## Portable build command

npm run tauri:portable:win
