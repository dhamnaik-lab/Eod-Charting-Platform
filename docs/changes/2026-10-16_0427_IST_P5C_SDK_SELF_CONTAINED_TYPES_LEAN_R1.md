# P5-C Self-Contained Plugin SDK Declarations — Lean R1

- IST timestamp: 2026-10-16 04:27 IST
- Objective: Detached TypeScript consumer can use the standalone `@eod-platform/sdk` declaration package.
- Previous defect: `packages/eod-plugin-sdk/index.d.ts` imported `../../src/plugins/types`, which is absent outside the EOD repository (P5-B TS2307).
- Files modified: packages/eod-plugin-sdk/index.d.ts.
- Files created: this IST change record only; consumer and type-parity fixtures are task-local evidence under tmp.
- Final implementation: Published the exact 16 public host type contracts inline in index.d.ts and retained generic `defineEodPlugin<T extends EodPlugin>(plugin: T): T`.
- Behavior preserved: SDK index.js and package.json, host source types, loader, registry, scanner/indicators, UI, Rust, CA, chart behavior; no changed runtime logic.
- Backup: `scripts/create-project-backup.ps1` normal scoped backup and second task-owned PRE source copy, both SHA256 verified.
- Validation commands/results: 01-renderer-typecheck exit 0; 02-three-focused-plugin-vitest exit 0; 03-repo-consumer-and-16-type-parity exit 0; 04-detached-sdk-consumer exit 0.
- Type parity: all 16 public declarations compared with host types using strict TypeScript equality in isolated consumer fixture.
- Risks: Public type surface is mirrored into a distributable declaration; future host changes require explicit SDK parity validation. SDK installer replacement safety and plugin execution isolation remain separate P5 blockers.
- Untested: installed external plugin runtime, third-party arbitrary dependencies, desktop manual operation, production app build, Rust/Tauri native compile.
- Rollback: compare the live file against the POST SHA256; restore only this SDK index.d.ts from task pre-backup; preserve other SDK files. Remove this task-owned change record if rolling back this change.
- PRE SHA256: BACD79565C9DC12CE09071AF4B2D16072ABD1D2EC88D97D44F81A273948A4C2A.
- POST SHA256: 70BB3B0E3531CDC2E7E0BD5E63CC3D02CF993EA622474CB8F100356EF8935EE1.
- Host type contract SHA256: CBE6927A8E048E32658E0E5C7ABA68BE8CDE44EC8CA2B04C512230B36D02E15B.
- P5-A probe ZIP SHA256: 76CCC33B06B3709F7955DCA15C0EEBEDEA491E4E61B7C2F24F977AE5CA01E71C.
- P5-B regression ZIP SHA256: AB420CE3A666128A701F00B93D03D18CB6D97AB2EA2F4BA351C758B87ACE6847.
