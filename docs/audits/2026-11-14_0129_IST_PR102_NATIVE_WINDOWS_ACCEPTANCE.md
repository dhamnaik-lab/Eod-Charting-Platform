# PR #102 native Windows acceptance

**Integration follow-up (14 November 2026).** PR #102 merged at `ca1cd936350faaa2e8eb23ea6d1de08c0dd979ae` and local main fast-forwarded to the same commit. The merged tree matches the accepted tree below. The merge recommendation and next steps record the decision at acceptance time.

**Decision: PASS for the scoped native acceptance.** This report closes the checks left open in the 01:10 IST audit.

## Source and build

- PR head `6ce03be793d85ed86d57b6be3eae4f1c40e77194`, tree `2bbf4279ef21f6d510711bd36e5dd929bb1a5c54`. The sole delta from the validated application source `0e5872474d677ac0abe6c53feb3071c3a54408e6` is the earlier renderer audit.
- The user's `npm run tauri:portable:win` completed in the pinned archive. Rust release compilation took 6m 57s and emitted one existing dead-code warning. The release and portable executables matched SHA-256 `B67C6936F16A75E9F86342BD63BFB603B09755FB466BAADE2ED1290F2C4166C4`. The test asserted the same hash on its copy before launch.
- Windows 10 x64 build 19045, Tauri 2.11.5, WebView2 157.0.4341.46. The packaged launcher started the actual app on `tauri.localhost` in the normal Windows session. Native IPC identified the disposable database. No production database was opened. [Renderer CI for the pinned head](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43441793580)

## Automated native results

`node desktop-final.mjs` exited 0. Screenshots and structured evidence are in `tmp/fixtures/pr102-native-windows-6ce03be/desktop-1794599951932/`.

| Check | Observed result |
| --- | --- |
| Settings checkbox and Save Changes | Disabled and re-enabled Core EOD Scanner using the real Settings UI. Confirmed both persisted values through native IPC. |
| Native and plugin scans | While disabled, Common Gap returned 11 historical matches and the production worker progressed through 291 endpoints. Top Gainers showed the disabled-plugin message. After re-enabling, Top Gainers returned one match for PRGAIN. |
| Historical worker | The long scan cancelled and the restarted run completed through endpoint 7,181. Earlier evidence in `desktop-1794598761566` records an active worker stopped after reporting progress through endpoint 2,850. |
| Price basis and overlay | Raw mode loaded all three basis flags false and drew a diamond overlay. Adjusted mode loaded capital, dividend and rights flags true and drew a V-reversal overlay on the adjusted data. The first close changed from 96.95904952108461 to 87.4825. The Toolbar requested the three enabled flags and native data returned them. Both overlays cleared on the second click. |
| Mismatch rejection | The test flipped only the adjusted flag on one real desktop API response at the renderer boundary. The production Toolbar displayed “different price basis” and left overlay state empty and the button inactive. |
| Shutdown | Windows accepted the test instance's normal close and the process exited. The test restored the Documents profile pointer after Settings saved. |

Two trial runs reached Settings and the scanner but failed the expected price-change assertion. The disposable action records needed a valid dividend cash amount and factor and a source that avoids legacy-mutated handling. The successful run supplied those fixture values. The application code was unchanged.

The user screenshots separately show a Common Gap overlay and a completed Market Movers scan. Earlier renderer regression checks cover mixed scanner selections and related plugin behavior.

## Risks

The mismatch was deliberately injected. The acceptance used synthetic data and representative patterns. The renderer parity audit covers all 54 handler bodies.

## Files changed

Added this report, the fixture-only desktop test harness and captured evidence under the existing audit fixture. No application source or Git refs changed. Inspected SettingsDialog, Toolbar, the desktop API bridge, database adjustment code and the packaged assets.

## Next steps

PR #102 can be marked ready for review. Merge and update the local checkout after explicit authorization. No application rollback is needed.

## Merge recommendation

**Ready for review and authorized merge.**
