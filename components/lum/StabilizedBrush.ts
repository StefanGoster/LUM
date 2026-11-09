'use client';
import { BaseBrush, Path, type Canvas, type Point } from 'fabric';
import { BRUSH_PRESETS, createBrushPath, normalizeBrush, type BrushSettings, type BrushSample } from '@/lib/brush';

type BrushEvent = Parameters<BaseBrush['onMouseDown']>[1];
export type LumBrushPath = Path & {lumBrushName?: string; lumPathData?: string};

/** Fabric supplies document-space points; browser pointer events supply real pen pressure. */
export class StabilizedBrush extends BaseBrush {
  settings: BrushSettings;
  private strokeSettings: BrushSettings;
  private points: BrushSample[] = [];
  private active = false;
  private seed = 1;
  private frame: number | null = null;
  constructor(canvas: Canvas, settings: Partial<BrushSettings> = {}) {
    super(canvas);
    this.settings = normalizeBrush(settings);
    this.strokeSettings = this.settings;
    this.configure(settings);
  }
  configure(settings: Partial<BrushSettings>) {
    this.settings = normalizeBrush({...this.settings, ...settings});
    this.color = this.settings.color;
    this.width = this.settings.size;
  }
  private record(pointer: Point, e: BrushEvent['e']) {
    const event = e as PointerEvent;
    const pressure = event.pointerType === 'pen' && event.pressure > 0 ? event.pressure : undefined;
    const sample: BrushSample = {x: pointer.x, y: pointer.y, t: Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now(), pressure};
    const previous = this.points[this.points.length - 1];
    if (!previous || Math.hypot(previous.x - sample.x, previous.y - sample.y) > .05) this.points.push(sample);
    // Bound event storage. Geometry itself is resampled independently of event frequency.
    if (this.points.length > 6000) this.points = this.points.filter((_, index) => index === 0 || index % 2 === 1);
  }
  onMouseDown(pointer: Point, {e}: BrushEvent): void {
    if (!this.canvas._isMainEvent(e)) return;
    this.cancel();
    this.active = true;
    this.strokeSettings = {...this.settings};
    this.seed = crypto.getRandomValues(new Uint32Array(1))[0];
    this.record(pointer, e);
    this._render();
  }
  onMouseMove(pointer: Point, {e}: BrushEvent): void {
    if (!this.active || !this.canvas._isMainEvent(e)) return;
    this.record(pointer, e);
    if (this.frame === null) this.frame = requestAnimationFrame(() => {this.frame = null;this._render();});
  }
  onMouseUp({e, pointer}: BrushEvent): boolean {
    if (!this.canvas._isMainEvent(e)) return true;
    if (!this.active) return false;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    // Keep final pen pressure from the last contact sample, not the zero pressure of pen-up.
    const lastPressure = this.points[this.points.length - 1]?.pressure;
    this.record(pointer, e);
    if (this.points.length && lastPressure !== undefined) this.points[this.points.length - 1].pressure = lastPressure;
    const data = createBrushPath(this.points, this.strokeSettings, this.seed, true);
    this.active = false;
    this.canvas.clearContext(this.canvas.contextTop);
    if (data) {
      const path: LumBrushPath = new Path(data, {fill: this.strokeSettings.color, stroke: undefined, strokeWidth: 0, opacity: this.strokeSettings.opacity, originX: 'left', originY: 'top', objectCaching: true});
      path.lumPathData = data;
      path.lumBrushName = BRUSH_PRESETS.find(p => p.id === this.strokeSettings.preset)?.name || 'Ink stroke';
      this.canvas.fire('before:path:created', {path});
      this.canvas.add(path);
      path.setCoords();
      this.canvas.fire('path:created', {path});
    }
    this.points = [];
    this.canvas.requestRenderAll();
    return false;
  }
  _render(): void {
    if (!this.active) return;
    const ctx = this.canvas.contextTop;
    this.canvas.clearContext(ctx);
    const data = createBrushPath(this.points, this.strokeSettings, this.seed, false);
    if (!data) return;
    this._saveAndTransform(ctx);
    ctx.globalAlpha = this.strokeSettings.opacity;
    ctx.fillStyle = this.strokeSettings.color;
    ctx.fill(new Path2D(data));
    ctx.restore();
  }
  cancel(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.active = false;
    this.points = [];
    this.canvas.clearContext(this.canvas.contextTop);
  }
}
