# CI-01 — Automated PR Rustfmt Gate for Native Scanner Modules

**IST timestamp:** 2026-11-19 20:24 IST (UTC+05:30)  
**Active workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`  
**GitHub source authority:** `feature/native-rust-scanner-20261119` at parent `0b6262c1a96eaec16de6800dbe20ac296bef5a98`; PR #122 (draft/unmerged).  
**Status:** **Automated GitHub Actions Rustfmt PASS** on CI-01 implementation commit `f5adde1cbc2e7846c71a441d312ca73854506b9f` (19 November 2026, 20:26 IST); PR #122 remains draft and unmerged.

## Objective and previous defect

RSC-03, RSC-04 and RSC-05 each required a follow-up because Rust files were published without a real `rustfmt --check`. The existing Renderer CI and PowerShell-parser workflow did not run Rustfmt, so formatting failures were first detected on the operator's Windows workstation. Add a small independent CI gate that executes before the user needs to pull another scanner detector.

## Files inspected and created/modified

Inspected current `AGENTS.md`, `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`, `.github/workflows/renderer-ci.yml`, `.github/workflows/windows-validation-runner-parser.yml`, and `src-tauri-shell/Cargo.toml` (edition 2021). Inspected GitHub PR #122 and verified the feature head and base tree; accepted source authority remains on this one workstream.

- **Created** `.github/workflows/rustfmt-ci.yml` — separate GitHub Actions check named `Rustfmt (scanner modules)`.
- **Modified** `AGENTS.md` — explain CI coverage and the difference between the automatic post-push gate and mandatory local pre-publication Rustfmt verification.
- **Modified** `HANDOFF.md` and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` — record the CI-01 status, evidence and next manual checkpoint.
- **Created** this dated change record.

## Final implementation and behavior preserved

On `pull_request` targeting `main`, when any root-level `src-tauri-shell/src/scanner_*.rs` module or the workflow itself changes, a fresh Ubuntu job checks out code with credentials not persisted, ensures the standard `rustfmt` component is available via `rustup`, and runs:

```bash
rustup run stable rustfmt --edition 2021 --check "${scanner_files[@]}"
```

A Bash `nullglob` array finds **all** root-level `scanner_*.rs` modules, including newly added detectors, avoiding dynamic Git reads or traversal through unrelated `main.rs` modules. The job fails on a missing scanner set or formatting discrepancy; `--check` never rewrites sources. Read-only repository permission; 10-minute timeout. The installed CI runner's `rustup` may retrieve its standard Rustfmt component over the network; **only the hosted CI runner** performs that retrieval, not the operator's PowerShell/Windows checkout. No new application dependencies.

The existing Renderer CI and Windows PowerShell-parser workflows are unchanged. No Rust, TS, scanner runtime, Tauri IPC, Cargo, `.eod`, SQLite, plugin, or Corporate Actions changes were made. The RSC-01 through RSC-05 accepted focused Windows outcomes remain intact. Seven operator-protected files remain outside this GitHub change; local backups are neither created nor modified by this remote-only task.

## Validation commands and actual results

- Static YAML parsing via installed Python `yaml.BaseLoader`, with asserted trigger, paths, job configuration, read-only permissions and checkout settings: **PASS**.
- Extracted Bash `run` script through YAML parser; `bash -n`: **PASS**.
- Three-case mocked runtime simulation, invoking the **actual YAML-extracted Bash script**: scanner file included and unrelated Rust excluded **PASS**; a nonzero mocked Rustfmt exits nonzero **PASS**; an empty scanner set rejects **PASS**.
- Preparation SHA-256 of the exact workflow file: `99EB6E8C1C5919DAF2235652C5631BC5B00D5A5C4D8978BBF7E6314756646DA8`; matching Git blob expected: `c72d8aa2f9bb0460992500de646d9e8dcb6771f2`.
- GitHub Actions **Rust Scanner Rustfmt CI** at commit `f5adde1cbc2e7846c71a441d312ca73854506b9f`, workflow run **44549012402**, job **135647321818**: **COMPLETED SUCCESS**. Individually observed steps **Check out source**, **Ensure stable Rustfmt is available**, and **Check every scanner Rust module without modifying sources** all completed **SUCCESS**. This is real hosted Rustfmt execution, independently verified through GitHub's workflow-jobs API; not inferred from the static mocks. [Actions run](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44549012402).
- No Windows Rust/Cargo tests, Vitest, typecheck, renderer build or portable build performed for this CI-only change; those were previously verified on RSC-05 at source commit `e158f086`.

## Risks, limitations, rollback, next step

This CI job targets **root-level scanner Rust modules only**, not all Rust files; other Rust sources still require `AGENTS.md`'s manual real Rustfmt pre-publication check. It runs on PRs targeting `main` rather than pushes without a PR and is a post-push/pre-merge safeguard, not a literal pre-publication check. A future Rustfmt stable version could differ from the operator's installed formatter. It does not configure required branch-protection status checks; enforcing branch protection is a separate authorization. A failure must be inspected and fixed within the relevant scanner scope, not by reformatting unrelated Rust files.

Rollback: revert only this CI-01 commit on the authorized feature branch if needed, preserving existing workflows, source, user-protected local files and backups. Do not merge PR #122 or start RSC-06 until CI is confirmed and further work is authorized.
