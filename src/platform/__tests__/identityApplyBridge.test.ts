import { afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn(), unlisten: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mock.invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen: mock.listen }));

afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); vi.resetModules(); });

describe('Identity apply progress bridge', () => {
  it('isolates historical progress, subscribes before writing and cleans up', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} });
    let emit!: (event: { payload: { operationId: string; progress: object } }) => void;
    mock.listen.mockImplementation(async (name, callback) => { expect(name).toBe('identity:historical-progress'); emit=callback; return mock.unlisten; });
    const progress={stage:'applying',processed:20,total:100,percent:19};
    mock.invoke.mockImplementation(async (name,args)=>{
      expect(name).toBe('apply_nse_historical_identity_archive'); expect(mock.listen).toHaveBeenCalledBefore(mock.invoke);
      emit({payload:{operationId:'unrelated',progress}}); emit({payload:{operationId:args.operationId,progress}});
      return {applied:true,runId:'receipt'};
    });
    const {getTauriDesktopApi}=await import('../tauriDesktop'); const callback=vi.fn();
    await expect(getTauriDesktopApi()!.applyNseHistoricalIdentityArchive({expectedPlanSha256:'reviewed'},callback)).resolves.toEqual({applied:true,runId:'receipt'});
    expect(callback).toHaveBeenCalledExactlyOnceWith(progress); expect(mock.unlisten).toHaveBeenCalledOnce();
  });
  it.each(['applyNseCurrentUniverseSync', 'applyBseCurrentUniverseSync'] as const)('%s subscribes before invoke, isolates operation events and removes the listener', async method => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} });
    let emit!: (event: { payload: { operationId: string; progress: object } }) => void;
    mock.listen.mockImplementation(async (_name, callback) => { emit = callback; return mock.unlisten; });
    const progress = { stage: 'applying', processed: 25, total: 100, percent: 25 };
    mock.invoke.mockImplementation(async (_name, args) => {
      expect(mock.listen).toHaveBeenCalledBefore(mock.invoke);
      emit({ payload: { operationId: 'another-run', progress } });
      emit({ payload: { operationId: args.operationId, progress } });
      return { applied: true };
    });
    const { getTauriDesktopApi } = await import('../tauriDesktop');
    const callback = vi.fn();
    const input = { expectedPlanSha256: 'reviewed', masterFilePath: 'source.csv', expectedDatabasePath: 'DB' };
    await expect(getTauriDesktopApi()![method](input, callback)).resolves.toEqual({ applied: true });
    expect(callback).toHaveBeenCalledExactlyOnceWith(progress);
    expect(mock.unlisten).toHaveBeenCalledOnce();
  });
  it.each(['applyNseCurrentUniverseSync', 'applyBseCurrentUniverseSync'] as const)('%s removes the listener after a rejected apply and never retries the write', async method => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} });
    mock.listen.mockResolvedValue(mock.unlisten); mock.invoke.mockRejectedValue(new Error('stale reviewed plan'));
    const { getTauriDesktopApi } = await import('../tauriDesktop');
    const input = { expectedPlanSha256: 'old', masterFilePath: 'source.csv', expectedDatabasePath: 'DB' };
    await expect(getTauriDesktopApi()![method](input, vi.fn())).rejects.toThrow('stale reviewed plan');
    expect(mock.unlisten).toHaveBeenCalledOnce(); expect(mock.invoke).toHaveBeenCalledOnce();
  });
  it.each(['applyNseCurrentUniverseSync', 'applyBseCurrentUniverseSync'] as const)('%s preserves a committed result when event cleanup fails', async method => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} });
    mock.listen.mockResolvedValue(mock.unlisten);
    mock.unlisten.mockImplementation(() => { throw new Error('cleanup failed'); });
    mock.invoke.mockResolvedValue({ applied: true });
    const { getTauriDesktopApi } = await import('../tauriDesktop');
    const input = { expectedPlanSha256: 'reviewed', masterFilePath: 'source.csv', expectedDatabasePath: 'DB' };
    await expect(getTauriDesktopApi()![method](input, vi.fn())).resolves.toEqual({ applied: true });
    expect(mock.invoke).toHaveBeenCalledOnce();
  });
});
