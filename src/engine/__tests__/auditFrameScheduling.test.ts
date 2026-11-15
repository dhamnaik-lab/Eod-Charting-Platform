import { afterEach, expect, it, vi } from 'vitest';
import { ChartEngine } from '../ChartEngine';

type Loop = {
  isDirty: boolean; isOverlayDirty: boolean; rafId: number | null;
  renderLoopActive: boolean; renderingFrame: boolean;
  renderBase: ReturnType<typeof vi.fn>; renderOverlay: ReturnType<typeof vi.fn>;
  clearCachedRenderState: () => void; startRenderLoop: () => void;
  markDirty: () => void; markOverlayDirty: () => void; flushRenderFrame: () => void;
};
afterEach(() => vi.unstubAllGlobals());
function setup() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callbacks.set(++id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (value: number) => callbacks.delete(value));
  const engine = Object.assign(Object.create(ChartEngine.prototype) as Loop, {
    isDirty: true, isOverlayDirty: true, rafId: null, renderLoopActive: false, renderingFrame: false,
    renderBase: vi.fn(), renderOverlay: vi.fn(), clearCachedRenderState: vi.fn(),
  });
  const frame = () => { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(callback => callback(0)); return pending.length; };
  return { engine, callbacks, frame };
}

it('stops scheduling after the first frame when a tile is idle', () => {
  const { engine, frame } = setup();
  engine.startRenderLoop();
  let callbacks = 0;
  for (let i = 0; i < 120; i++) callbacks += frame();
  console.info(JSON.stringify({ simulatedFrames: 120, scheduledCallbacks: callbacks, baseRenders: engine.renderBase.mock.calls.length }));
  expect(callbacks).toBe(1);
});

it('coalesces invalidations, preserves overlay-only work, and flushes screenshots synchronously', () => {
  const { engine, frame, callbacks } = setup();
  engine.startRenderLoop(); frame();
  engine.markOverlayDirty(); engine.markOverlayDirty();
  expect(callbacks.size).toBe(1);
  frame();
  expect(engine.renderBase).toHaveBeenCalledTimes(1);
  expect(engine.renderOverlay).toHaveBeenCalledTimes(2);
  engine.markDirty(); engine.markDirty();
  engine.flushRenderFrame();
  expect(engine.renderBase).toHaveBeenCalledTimes(2);
  frame();
  expect(engine.renderBase).toHaveBeenCalledTimes(2);
  expect(callbacks.size).toBe(0);
});

it('retains an invalidation raised during rendering', () => {
  const { engine, frame, callbacks } = setup();
  engine.renderBase.mockImplementationOnce(() => engine.markDirty());
  engine.startRenderLoop(); frame();
  expect(callbacks.size).toBe(1);
  frame();
  expect(engine.renderBase).toHaveBeenCalledTimes(2);
});
