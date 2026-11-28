# BUILD-01 shared Cargo target growth guard

The Windows project target contained 32,249,796,079 bytes (30.03 GiB of logical file lengths) across 37,343 file entries on 28 November 2026. Debug held 21.37 GiB, including 14.79 GiB under debug incremental. Release held 8.67 GiB, including 6.98 GiB under release dependencies. E: reported 5.10 GiB free during the initial inventory and 4.62 GiB during wrapper validation. Hard links can cause the logical total and Cargo's preview to exceed physical space freed. [Microsoft NTFS disk-space guidance](https://learn.microsoft.com/en-us/troubleshoot/windows-server/backup-and-storage/disk-space-problems-on-ntfs-volumes)

The shared Cargo wrapper now checks the exact root target on every invocation. Preview reports the logical size and available drive space. Run stops before starting Cargo at or above 25 GiB of target files or below 8 GiB available on E:. The thresholds are local operating limits based on the measured cache and low drive space. The preflight applies to this wrapper. A build admitted under the limits can grow past them, and direct Cargo or Tauri commands bypass the preflight.

From the main project root in PowerShell 7, run the read-only scoped preview:

    .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode CachePreview

With Cargo 1.99.0, that preview reported 4,392 entries and 17.9 GiB for the workspace shell package's dev profile. After the owner approves that exact scope and closes build processes, the corresponding maintenance command from the project root is:

    cargo clean --offline --locked --manifest-path .\src-tauri-shell\Cargo.toml --target-dir .\target --profile dev --package eod-charting-platform-shell

That command removes the shell's dev/test artifacts, including its incremental data. Expect the next relevant run to rebuild the shell while retaining cached third-party dependencies and the release profile. Re-run the wrapper preview after cleanup to measure the actual free space.

Cargo's built-in automatic cleanup is for the global cache. Cargo 1.99 has no supported automatic project target retention, and the upstream target GC issue is open. Cargo owns package/profile artifact selection, avoiding local rules based on artifact filename, age or internal layout. The existing offline, lockfile, root and secondary-target checks remain part of BUILD-01. [Cargo config](https://doc.rust-lang.org/stable/cargo/reference/config.html#cache) · [Target GC tracking issue](https://github.com/rust-lang/cargo/issues/13136) · [Cargo clean](https://doc.rust-lang.org/stable/cargo/commands/cargo-clean.html) · [Cargo build cache layout](https://doc.rust-lang.org/stable/cargo/reference/build-cache.html)

Pre-edit backup at `backups/pre_opencode_changes_20261128_194607_build01-target-growth-guard`.

PowerShell parsing, five threshold cases, the live Run refusal, normal Preview, scoped CachePreview, and rejection of additional cleanup arguments passed. Native verbose dry-run listed debug incremental paths and no release paths. The existing shared-wrapper regression script stopped at its live fixture inventory because all six expected historical targets were missing. The existing inventory helpers matched the backup. No compilation was performed during wrapper validation.

The owner then ran the scoped cleanup. Cargo reported 4,389 files removed (17.5 GiB). Independent wrapper Preview measured 12.51 GiB in target and 19.19 GiB free on E:, clearing both limits. The release inventory remained at 26,305 file entries and 9,309,152,576 bytes. No Rust command was compiled during the recheck. Post-clean documentation backup at `backups/pre_opencode_changes_20261128_200714_build01-post-clean-verification`.
