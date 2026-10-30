import { afterEach, describe, expect, it, vi } from 'vitest';
const mock=vi.hoisted(()=>({invoke:vi.fn(),listen:vi.fn(),unlisten:vi.fn()}));
vi.mock('@tauri-apps/api/core',()=>({invoke:mock.invoke}));
vi.mock('@tauri-apps/api/event',()=>({listen:mock.listen}));
afterEach(()=>{vi.unstubAllGlobals();vi.resetAllMocks();vi.resetModules();});
const input={sourceMode:'manual' as const,filePath:'Comp_Name.csv',expectedPlanSha256:'reviewed',expectedDatabasePath:'reviewed-db'};
describe('BSE name-history desktop bridge',()=>{
  it('preserves the reviewed destination/source and isolates operation progress before invoking Apply',async()=>{
    vi.stubGlobal('window',{__TAURI_INTERNALS__:{}});
    let emit!: (event:{payload:{operationId:string;progress:object}})=>void;
    mock.listen.mockImplementation(async(name,callback)=>{expect(name).toBe('identity:apply-progress');emit=callback;return mock.unlisten;});
    const progress={stage:'committed',processed:5,total:5,percent:100};
    mock.invoke.mockImplementation(async(name,args)=>{
      expect(name).toBe('apply_bse_name_history');expect(args.input).toEqual(input);expect(mock.listen).toHaveBeenCalledBefore(mock.invoke);
      emit({payload:{operationId:'another-operation',progress}});emit({payload:{operationId:args.operationId,progress}});return {applied:true,runId:'names-1'};
    });
    const {getTauriDesktopApi}=await import('../tauriDesktop');const callback=vi.fn();
    await expect(getTauriDesktopApi()!.applyBseNameHistory(input,callback)).resolves.toMatchObject({applied:true});
    expect(callback).toHaveBeenCalledExactlyOnceWith(progress);expect(mock.unlisten).toHaveBeenCalledOnce();
  });
  it('cleans up after rejection without retrying the write',async()=>{
    vi.stubGlobal('window',{__TAURI_INTERNALS__:{}});mock.listen.mockResolvedValue(mock.unlisten);mock.invoke.mockRejectedValue(new Error('stale'));
    const {getTauriDesktopApi}=await import('../tauriDesktop');await expect(getTauriDesktopApi()!.applyBseNameHistory(input,vi.fn())).rejects.toThrow('stale');
    expect(mock.invoke).toHaveBeenCalledOnce();expect(mock.unlisten).toHaveBeenCalledOnce();
  });
  it('keeps the committed reply if event cleanup fails',async()=>{
    vi.stubGlobal('window',{__TAURI_INTERNALS__:{}});mock.listen.mockResolvedValue(()=>{throw Error('cleanup');});mock.invoke.mockResolvedValue({applied:true});
    const {getTauriDesktopApi}=await import('../tauriDesktop');await expect(getTauriDesktopApi()!.applyBseNameHistory(input,vi.fn())).resolves.toEqual({applied:true});
    expect(mock.invoke).toHaveBeenCalledOnce();
  });
  it('routes refresh, saved preview, history summaries and selected receipts separately',async()=>{
    vi.stubGlobal('window',{__TAURI_INTERNALS__:{}});mock.invoke.mockResolvedValue({});
    const {getTauriDesktopApi}=await import('../tauriDesktop');const api=getTauriDesktopApi()!;
    await api.refreshBseNameHistory();await api.previewBseNameHistory({sourceMode:'official'});await api.listBseNameHistoryRuns();await api.getBseNameHistoryReport('names-1');
    expect(mock.invoke.mock.calls.map(c=>c[0])).toEqual(['refresh_bse_name_history','preview_bse_name_history','list_bse_name_history_runs','get_bse_name_history_report']);
    expect(mock.invoke.mock.calls[1][1]).toEqual({input:{sourceMode:'official'}});expect(mock.invoke.mock.calls[3][1]).toEqual({runId:'names-1'});
    expect(mock.listen).not.toHaveBeenCalled();
  });
});
