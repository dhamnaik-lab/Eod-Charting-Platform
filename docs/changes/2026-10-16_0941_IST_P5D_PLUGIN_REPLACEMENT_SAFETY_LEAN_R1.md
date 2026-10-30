# P5-D — External Plugin Replacement Safety (Lean Verified R1)

- IST timestamp: 2026-10-16 09:41 IST.
- Objective: Preserve an existing external plugin when a replacement install fails.
- Previous defect: The installer deleted the previous plugin directory before validating/copied replacement contents, for both selected manifest.json folders and .eodplugin/.zip archives.
- File modified: `src-tauri-shell/src/plugin_data.rs` only.
- File created: this mandatory IST record; six Rust test cases are embedded in the single modified source, without extra production files.
- Final implementation: stage then validate in an app-profile-local hidden transaction directory; move existing plugin to recoverable previous directory; promote stage; restore original on ordinary promotion failure. Preserve source-folder/ZIP formats and reader/loader contracts.
- Preservation: Existing public commands, external plugin IDs, manifest parsing/entry rules, permission metadata, SDK source, loader, registry, charts, Bhavcopy, CA, and application runtime JavaScript.
- Backup: regular `scripts/create-project-backup.ps1` + task-owned pre-source copy; exact PRE hashes verified before source write.
- Validation command: `cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline --jobs 1 external_plugin_install_safety_tests -- --test-threads=1` — six focused tests PASS (see native evidence).
- Documentation validation: `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/check-doc-references.ps1` (Git-free), result in evidence.
- Risks and limitations: NOT crash-consistent; abnormal process termination between two directory renames can leave the previous version in `.install-transactions`. Old-version backup cleanup failure may leave an offline recovery copy. Concurrent installs of the same ID and plugin security sandboxing are separate P5 concerns.
- Real-plugin activation and production profile installation: NOT PERFORMED. No Git, network, live database, or portable build.
- Source PRE SHA256: C5156D933C211FCD65A792364DE85A3F3E4BB42F0FC408018940565097E53359.
- Source POST SHA256: 474A7EA515B400A721F829B946491A76DC8C57E178B7881706D34BDF3576CFE7.
- Accepted P5-A evidence SHA256: 76CCC33B06B3709F7955DCA15C0EEBEDEA491E4E61B7C2F24F977AE5CA01E71C.
- Accepted P5-C evidence SHA256: 2142650E635007B7A6907531797015DA4519E75BC7C9F0C3EAEF42874C061F5A.
- Rollback: verify that live plugin_data.rs still matches POST SHA256, restore ONLY that file from the task-owned PRE backup, and remove ONLY this task-owned change record if its hash matches the evidence. Preserve all backups and evidence.
