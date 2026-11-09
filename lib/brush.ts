/** Deterministic, model-free stroke geometry. Coordinates and size are document pixels. */
export type BrushPresetId = 'ink' | 'marker' | 'chisel' | 'spray';
export interface BrushSettings {
  preset: BrushPresetId;
  size: number;
  color: string;
  smoothing: number;
  opacity: number;
  pressure: boolean;
  angle: number;
}
export interface BrushSample { x: number; y: number; t: number; pressure?: number }
export interface BrushPoint { x: number; y: number }
export const DEFAULT_BRUSH: BrushSettings = {
  preset: 'ink', size: 18, color: '#ca5143', smoothing: .55, opacity: 1, pressure: true, angle: 35,
};
export const BRUSH_PRESETS = [
  { id: 'ink', name: 'Clean ink', detail: 'Smooth, tapered lettering', size: 18 },
  { id: 'marker', name: 'Round marker', detail: 'Full, rounded strokes', size: 34 },
  { id: 'chisel', name: 'Chisel marker', detail: 'An angled, broad nib', size: 44 },
  { id: 'spray', name: 'Dry spray', detail: 'Fine, scattered pigment', size: 70 },
] as const;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const number = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
const distance = (a: BrushPoint, b: BrushPoint) => Math.hypot(b.x - a.x, b.y - a.y);
export function normalizeBrush(settings: Partial<BrushSettings> = {}): BrushSettings {
  const s = {...DEFAULT_BRUSH, ...settings};
  return {...s,
    preset: BRUSH_PRESETS.some(p => p.id === s.preset) ? s.preset : 'ink',
    size: clamp(number(s.size, 18), 1, 240),
    smoothing: clamp(number(s.smoothing, .55), 0, 1),
    opacity: clamp(number(s.opacity, 1), .01, 1),
    angle: number(s.angle, 35) % 360,
  };
}

/** A distance-aware low-pass stabilizer; finalization catches the nib up to the release point. */
export function stabilizeSamples(input: readonly BrushSample[], smoothing = .55, final = true): BrushSample[] {
  const samples = input.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!samples.length) return [];
  const amount = clamp(smoothing, 0, 1);
  const result: BrushSample[] = [{...samples[0]}];
  let previous = result[0];
  for (let i = 1; i < samples.length; i++) {
    const p = samples[i];
    // Larger deliberate movements catch up faster. Small mouse jitter stays filtered.
    const d = distance(previous, p);
    const alpha = amount === 0 ? 1 : clamp((1 - amount * .89) + Math.min(d / 120, .35), .11, 1);
    const current = {
      x: previous.x + (p.x - previous.x) * alpha,
      y: previous.y + (p.y - previous.y) * alpha,
      t: number(p.t, previous.t + 16),
      pressure: p.pressure === undefined ? undefined : clamp(p.pressure, .01, 1),
    };
    if (distance(previous, current) > .025) result.push(current);
    previous = current;
  }
  if (final && result.length > 1) {
    const end = samples[samples.length - 1];
    if (distance(previous, end) > .025) result.push({...end});
  }
  return result;
}

export function resampleStroke(input: readonly BrushSample[], spacing = 2, limit = 1600): BrushSample[] {
  if (!input.length) return [];
  if (input.length === 1) return [{...input[0]}];
  let length = 0;
  for (let i = 1; i < input.length; i++) length += distance(input[i - 1], input[i]);
  const step = Math.max(.4, spacing, length / (limit - 1));
  const result = [{...input[0]}];
  let offset = step;
  for (let i = 1; i < input.length; i++) {
    const a = input[i - 1], b = input[i], d = distance(a, b);
    if (d < .0001) continue;
    while (offset <= d && result.length < limit - 1) {
      const ratio = offset / d;
      result.push({x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio,
        t: a.t + (b.t - a.t) * ratio,
        pressure: a.pressure === undefined || b.pressure === undefined ? undefined : a.pressure + (b.pressure - a.pressure) * ratio,
      });
      offset += step;
    }
    offset -= d;
  }
  const end = input[input.length - 1];
  if (distance(result[result.length - 1], end) > .001) result.push({...end});
  return result;
}

export function pressureWidth(sample: BrushSample, previous: BrushSample | undefined, settings: BrushSettings): number {
  if (!settings.pressure) return 1;
  if (sample.pressure !== undefined) return .18 + .82 * Math.pow(clamp(sample.pressure, .01, 1), .65);
  // A mouse has no pressure sensor. Ink uses speed-based width as an explicitly simulated feel.
  if (settings.preset !== 'ink' || !previous) return 1;
  const speed = distance(sample, previous) / Math.max(4, sample.t - previous.t);
  return clamp(.98 - speed * .14, .5, .98);
}

function nibRadius(normal: BrushPoint, radius: number, settings: BrushSettings): number {
  if (settings.preset !== 'chisel') return radius;
  const angle = settings.angle * Math.PI / 180;
  const along = normal.x * Math.cos(angle) + normal.y * Math.sin(angle);
  const across = -normal.x * Math.sin(angle) + normal.y * Math.cos(angle);
  return radius * Math.sqrt(along * along + across * across * .18 * .18);
}

/** Closed outline: the brush stays one editable native vector layer, including its taper. */
export function strokeOutline(input: readonly BrushSample[], settings: BrushSettings, final = true): BrushPoint[] {
  if (!input.length) return [];
  const points = resampleStroke(input, Math.max(.7, settings.size * .085));
  if (points.length === 1) {
    const p = points[0], radius = settings.size / 2 * pressureWidth(p, undefined, settings);
    return Array.from({length: 24}, (_, i) => {
      const angle = i / 24 * Math.PI * 2;
      if (settings.preset === 'chisel') {
        const a = settings.angle * Math.PI / 180, x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * .18;
        return {x: p.x + x * Math.cos(a) - y * Math.sin(a), y: p.y + x * Math.sin(a) + y * Math.cos(a)};
      }
      return {x: p.x + Math.cos(angle) * radius, y: p.y + Math.sin(angle) * radius};
    });
  }
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]));
  const total = lengths[lengths.length - 1];
  const taperLength = Math.min(total * .22, settings.size * 1.65);
  const left: BrushPoint[] = [], right: BrushPoint[] = [], radii: number[] = [], normals: BrushPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const d = Math.max(.0001, distance(a, b));
    const n = {x: -(b.y - a.y) / d, y: (b.x - a.x) / d};
    let radius = settings.size / 2 * pressureWidth(points[i], points[Math.max(0, i - 1)], settings);
    if (settings.preset === 'ink' && total > settings.size * .7 && taperLength > 0) {
      const start = clamp(lengths[i] / taperLength, .12, 1);
      const end = final ? clamp((total - lengths[i]) / taperLength, .12, 1) : 1;
      radius *= Math.min(start, end);
    }
    radii.push(radius); normals.push(n);
    const effective = nibRadius(n, radius, settings), p = points[i];
    left.push({x: p.x + n.x * effective, y: p.y + n.y * effective});
    right.push({x: p.x - n.x * effective, y: p.y - n.y * effective});
  }
  const cap = (p: BrushSample, n: BrushPoint, radius: number, reverse: boolean) => {
    const start = Math.atan2(n.y, n.x) + (reverse ? Math.PI : 0);
    return Array.from({length: 9}, (_, i) => {
      const a = start - Math.PI * (i + 1) / 10, direction = {x: Math.cos(a), y: Math.sin(a)};
      const r = nibRadius(direction, radius, settings);
      return {x: p.x + direction.x * r, y: p.y + direction.y * r};
    });
  };
  return [...left, ...cap(points[points.length - 1], normals[normals.length - 1], radii[radii.length - 1], false), ...right.reverse(), ...cap(points[0], normals[0], radii[0], true)];
}
const fmt = (n: number) => String(Math.round(n * 100) / 100);
export function closedOutlinePath(points: readonly BrushPoint[]): string {
  if (points.length < 3) return '';
  const first = points[0], last = points[points.length - 1];
  let path = `M ${fmt((first.x + last.x) / 2)} ${fmt((first.y + last.y) / 2)}`;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    path += ` Q ${fmt(a.x)} ${fmt(a.y)} ${fmt((a.x + b.x) / 2)} ${fmt((a.y + b.y) / 2)}`;
  }
  return path + ' Z';
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {state += 0x6D2B79F5;let t = state;t = Math.imul(t ^ t >>> 15, t | 1);t ^= t + Math.imul(t ^ t >>> 7, t | 61);return ((t ^ t >>> 14) >>> 0) / 4294967296;};
}
export interface SprayDot { x: number; y: number; radius: number }
export function sprayDots(input: readonly BrushSample[], settings: BrushSettings, seed = 1): SprayDot[] {
  const points = resampleStroke(input, Math.max(2, settings.size * .14), 150), random = seededRandom(seed), dots: SprayDot[] = [];
  for (const p of points) {
    const radius = settings.size / 2 * pressureWidth(p, undefined, settings);
    for (let i = 0; i < 6; i++) {
      const angle = random() * Math.PI * 2, r = radius * Math.pow(random(), .8);
      dots.push({x: p.x + Math.cos(angle) * r, y: p.y + Math.sin(angle) * r, radius: Math.max(.35, settings.size * (.006 + random() * .018))});
    }
  }
  return dots;
}
export function sprayPath(dots: readonly SprayDot[]): string {
  return dots.map(p => `M ${fmt(p.x + p.radius)} ${fmt(p.y)} A ${fmt(p.radius)} ${fmt(p.radius)} 0 1 0 ${fmt(p.x - p.radius)} ${fmt(p.y)} A ${fmt(p.radius)} ${fmt(p.radius)} 0 1 0 ${fmt(p.x + p.radius)} ${fmt(p.y)} Z`).join(' ');
}
export function createBrushPath(input: readonly BrushSample[], partial: Partial<BrushSettings>, seed = 1, final = true): string {
  const settings = normalizeBrush(partial), points = stabilizeSamples(input, settings.smoothing, final);
  return settings.preset === 'spray' ? sprayPath(sprayDots(points, settings, seed)) : closedOutlinePath(strokeOutline(points, settings, final));
}
