import { describe, expect, it } from 'vitest';
import { layoutScannerLabelBoxes } from '../ScannerLabelLayout';
import { ChartEngine } from '../ChartEngine';
import { drawDrawing, getTextBoxBounds } from '../Renderer';
import type { ChartDrawing, ScaleX, ScaleY } from '../types';

const x: ScaleX = { barWidth:1,barGap:0,bodyWidth:1,toPixel:n=>n,toIndex:n=>n };
const y: ScaleY = { min:0,max:180,toPixel:n=>n,toPrice:n=>n };
function drawing(id: string, text: string, barIndex=295, price=100): Extract<ChartDrawing,{kind:'text'}> {
  return { id,kind:'text',text,barIndex,price,fontSize:12,color:'#22c55e',locked:true };
}
function canvas() {
  const arcs: number[][] = []; const text: unknown[][] = [];
  const ctx = { font:'original', save() {},restore() {},setLineDash() {},beginPath() {},rect() {},clip() {},fill() {},
    measureText(value:string) { return { width:value.length*6 }; },
    fillText(...args:unknown[]) { text.push(args); }, arc(...args:number[]) { arcs.push(args); },
  } as unknown as CanvasRenderingContext2D;
  return { ctx,arcs,text };
}
function intersects(a: {left:number;top:number;width:number;height:number}, b: {left:number;top:number;width:number;height:number}) {
  return a.left < b.left+b.width && a.left+a.width > b.left && a.top < b.top+b.height && a.top+a.height > b.top;
}

describe('transient scanner label layout', () => {
  it('separates confirmation and pattern labels at the same anchor without moving their candle anchors', () => {
    const labels = [drawing('scanner-overlay:test:trend-label:neck','Neckline'),drawing('scanner-overlay:test:geometry-label:pattern','Triple Bottom')];
    const original = JSON.stringify(labels);
    const boxes = layoutScannerLabelBoxes(canvas().ctx,labels,x,y,300,180);
    expect(intersects(boxes.get(labels[0].id)!,boxes.get(labels[1].id)!)).toBe(false);
    for (const box of boxes.values()) {
      expect(box).not.toBeNull(); expect(box!.left).toBeGreaterThanOrEqual(3);
      expect(box!.left+box!.width).toBeLessThanOrEqual(297);
      expect(box!.top).toBeGreaterThanOrEqual(3); expect(box!.top+box!.height).toBeLessThanOrEqual(177);
    }
    expect(JSON.stringify(labels)).toBe(original);
  });

  it('wraps edge labels to fit a narrow plot and separates the wrapped boxes', () => {
    const labels=[drawing('scanner-overlay:1','Channel resistance',88),drawing('scanner-overlay:2','Rising Channel',88)];
    const boxes=layoutScannerLabelBoxes(canvas().ctx,labels,x,y,90,180);
    expect(boxes.get(labels[0].id)!.height).toBeGreaterThan(20);
    expect(boxes.get(labels[0].id)!.left+boxes.get(labels[0].id)!.width).toBeLessThanOrEqual(87);
    expect(intersects(boxes.get(labels[0].id)!,boxes.get(labels[1].id)!)).toBe(false);
  });

  it('leaves manual text and promoted range drawings unchanged and reserves their occupied space', () => {
    const manual=drawing('manual','My note',200); const range=drawing('scanner-drawing:range','Range',20);
    const label=drawing('scanner-overlay:1','Support',200);
    const boxes=layoutScannerLabelBoxes(canvas().ctx,[manual,range,label],x,y,300,180);
    expect(boxes.has(manual.id)).toBe(false); expect(boxes.has(range.id)).toBe(false);
    expect(intersects(boxes.get(label.id)!,getTextBoxBounds(manual,x,y))).toBe(false);
    expect(getTextBoxBounds(manual,x,y).left).toBe(202);
  });

  it('omits offscreen or unplaceable labels instead of pinning unrelated history onto the chart edge', () => {
    const outside=drawing('scanner-overlay:outside','Old',400);
    expect(layoutScannerLabelBoxes(canvas().ctx,[outside],x,y,300,180).get(outside.id)).toBeNull();
    const label=drawing('scanner-overlay:small','Long label',10,10);
    expect(layoutScannerLabelBoxes(canvas().ctx,[label],x,y,20,12).get(label.id)).toBeNull();
  });

  it('uses identical render and hit boxes while keeping the visible anchor dot at its data point', () => {
    const label=drawing('scanner-overlay:1','Double Top (M)'); const {ctx,arcs}=canvas();
    const engine=Object.create(ChartEngine.prototype) as any;
    Object.assign(engine,{ drawings:[label],baseCtx:ctx,scannerLabelBoxes:new Map(),chartType:'candles',timeframe:'D',selectedDrawingId:null });
    engine.prepareScannerLabelBoxes('price',x,y,300,180);
    const boxes=engine.scannerLabelBoxes as ReturnType<typeof layoutScannerLabelBoxes>;
    const box=boxes.get(label.id)!;
    const resolved=engine.resolveDrawingForCurrentChart(label);
    expect(getTextBoxBounds(resolved,x,y)).toEqual(box);
    drawDrawing(ctx,resolved,{startIndex:0,endIndex:300},x,y,300,180,false);
    expect(arcs.at(-1)?.slice(0,2)).toEqual([label.barIndex,label.price]);
    const hit=engine.hitTestDrawing({ pane:{id:'price',collapsed:false,scaleY:y},scaleX:x,
      clampedX:box.left+box.width/2,localY:box.top+box.height/2 });
    expect(hit?.drawing).toBe(label); expect(label.renderTextBox).toBeUndefined();
    boxes.set(label.id,null);
    expect(engine.hitTestDrawing({pane:{id:'price',collapsed:false,scaleY:y},scaleX:x,clampedX:box.left,localY:box.top})).toBeNull();
  });
});
