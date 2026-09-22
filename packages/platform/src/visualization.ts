export interface ChartDatum {
  label: string;
  value: number;
}

export interface ChartPoint {
  x: number;
  y: number;
  datumIndex: number;
}

export interface ChartBounds {
  min: number;
  max: number;
  span: number;
}

export interface NumericDomain extends ChartBounds {}

export interface ChartTick {
  value: number;
  position: number;
  label: string;
}

export interface BandLayout {
  step: number;
  bandwidth: number;
  position: (index: number) => number;
}

export interface HistogramBin {
  start: number;
  end: number;
  count: number;
}

export interface HeatmapDatum {
  row: string;
  column: string;
  value: number;
}

export interface HeatmapCell extends HeatmapDatum {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WaterfallDatum {
  label: string;
  value: number;
  kind?: 'increase' | 'decrease' | 'total';
}

export interface WaterfallRect extends WaterfallDatum {
  x: number;
  y: number;
  width: number;
  height: number;
  start: number;
  end: number;
}

export function finiteChartData(data: readonly ChartDatum[]): ChartDatum[] {
  return data.filter((item) => Number.isFinite(item.value) && item.label.trim().length > 0);
}

export function chartBounds(data: readonly ChartDatum[], includeZero = false): ChartBounds {
  const values = finiteChartData(data).map((item) => item.value);
  return numericDomain(values, includeZero);
}

/** Returns a finite domain for numeric chart inputs without spreading large arrays into Math.min/Math.max. */
export function numericDomain(values: readonly number[], includeZero = false): NumericDomain {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, span: 1 };
  if (includeZero) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (min === max) {
    const padding = Math.max(1, Math.abs(min) * 0.1);
    min -= padding;
    max += padding;
  }
  return { min, max, span: max - min };
}

/** Expands a finite domain to pleasant rounded boundaries for axes and inspectors. */
export function niceDomain(domain: NumericDomain, tickCount = 5): NumericDomain {
  if (!Number.isFinite(domain.min) || !Number.isFinite(domain.max) || domain.max <= domain.min) return { min: 0, max: 1, span: 1 };
  const target = Math.max(2, Math.floor(tickCount));
  const rawStep = domain.span / (target - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const factor = normalized >= 5 ? 10 : normalized >= 2 ? 5 : 2;
  const step = factor * magnitude;
  const min = Math.floor(domain.min / step) * step;
  const max = Math.ceil(domain.max / step) * step;
  return { min, max, span: Math.max(step, max - min) };
}

export function linearScale(domain: NumericDomain, range: { min: number; max: number }): (value: number) => number {
  const span = domain.span || 1;
  const outputSpan = range.max - range.min;
  return (value) => range.min + ((Number.isFinite(value) ? value : domain.min) - domain.min) / span * outputSpan;
}

export function bandScale(count: number, size: number, paddingInner = 0.2, paddingOuter = 0.1): BandLayout {
  const safeCount = Math.max(0, Math.floor(count));
  const safeSize = Math.max(0, Number.isFinite(size) ? size : 0);
  if (safeCount === 0 || safeSize === 0) return { step: 0, bandwidth: 0, position: () => 0 };
  const inner = Math.max(0, Math.min(1, paddingInner));
  const outer = Math.max(0, Math.min(1, paddingOuter));
  const step = safeSize / Math.max(1, safeCount - inner + outer * 2);
  const bandwidth = step * (1 - inner);
  return { step, bandwidth, position: (index) => step * (Math.max(0, Math.min(safeCount - 1, index)) + outer) };
}

export function chartTicks(domain: NumericDomain, count = 5, formatter: (value: number) => string = String): ChartTick[] {
  const nice = niceDomain(domain, count);
  const steps = Math.max(1, Math.floor(count) - 1);
  const step = nice.span / steps;
  const scale = linearScale(nice, { min: 0, max: 1 });
  return Array.from({ length: steps + 1 }, (_, index) => {
    const value = index === steps ? nice.max : nice.min + step * index;
    return { value, position: scale(value), label: formatter(value) };
  });
}

/** Deterministic min/max bucket reduction for dense line/area previews. First and last points are retained. */
export function downsampleMinMax(data: readonly ChartDatum[], maxPoints: number): ChartDatum[] {
  const clean = finiteChartData(data);
  const limit = Math.max(2, Math.floor(maxPoints));
  if (clean.length <= limit) return [...clean];
  const bucketCount = Math.max(1, Math.floor((limit - 2) / 2));
  const output: Array<{ index: number; datum: ChartDatum }> = [{ index: 0, datum: clean[0]! }];
  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = 1 + Math.floor(bucket * (clean.length - 2) / bucketCount);
    const end = 1 + Math.floor((bucket + 1) * (clean.length - 2) / bucketCount);
    if (end <= start) continue;
    let minIndex = start;
    let maxIndex = start;
    for (let index = start + 1; index < end; index += 1) {
      if (clean[index]!.value < clean[minIndex]!.value) minIndex = index;
      if (clean[index]!.value > clean[maxIndex]!.value) maxIndex = index;
    }
    for (const index of [minIndex, maxIndex].sort((a, b) => a - b)) output.push({ index, datum: clean[index]! });
  }
  output.push({ index: clean.length - 1, datum: clean[clean.length - 1]! });
  return output.sort((a, b) => a.index - b.index).filter((entry, index, all) => index === 0 || entry.index !== all[index - 1]!.index).slice(0, limit).map((entry) => entry.datum);
}

export function histogramBins(values: readonly number[], binCount = 8): HistogramBin[] {
  const clean = values.filter(Number.isFinite);
  if (clean.length === 0) return [];
  const domain = numericDomain(clean);
  const count = Math.max(1, Math.floor(binCount));
  const width = domain.span / count;
  const bins = Array.from({ length: count }, (_, index) => ({ start: domain.min + index * width, end: index === count - 1 ? domain.max : domain.min + (index + 1) * width, count: 0 }));
  for (const value of clean) {
    const index = width === 0 ? 0 : Math.min(count - 1, Math.floor((value - domain.min) / width));
    bins[index]!.count += 1;
  }
  return bins;
}

export function heatmapCells(data: readonly HeatmapDatum[], width: number, height: number): HeatmapCell[] {
  const clean = data.filter((item) => item.row.trim().length > 0 && item.column.trim().length > 0 && Number.isFinite(item.value));
  const rows = [...new Set(clean.map((item) => item.row))];
  const columns = [...new Set(clean.map((item) => item.column))];
  const bandX = bandScale(columns.length, width, 0.06, 0.02);
  const bandY = bandScale(rows.length, height, 0.06, 0.02);
  return clean.map((item) => ({ ...item, x: bandX.position(columns.indexOf(item.column)), y: bandY.position(rows.indexOf(item.row)), width: bandX.bandwidth, height: bandY.bandwidth }));
}

export function waterfallRects(data: readonly WaterfallDatum[], width: number, height: number): WaterfallRect[] {
  const clean = data.filter((item) => item.label.trim().length > 0 && Number.isFinite(item.value));
  if (clean.length === 0 || width <= 0 || height <= 0) return [];
  let running = 0;
  const totals = clean.map((item) => {
    if (item.kind === 'total') {
      running = item.value;
      return item.value;
    }
    running += item.value;
    return running;
  });
  const domain = numericDomain([...totals, 0], true);
  const scale = linearScale(domain, { min: height, max: 0 });
  const band = bandScale(clean.length, width, 0.24, 0.08);
  running = 0;
  return clean.map((item, index) => {
    const start = item.kind === 'total' ? 0 : running;
    const end = item.kind === 'total' ? item.value : running + item.value;
    if (item.kind !== 'total') running = end;
    return { ...item, x: band.position(index), y: Math.min(scale(start), scale(end)), width: band.bandwidth, height: Math.max(1, Math.abs(scale(end) - scale(start))), start, end };
  });
}

export function chartPoints(data: readonly ChartDatum[], width: number, height: number, inset = 0, includeZero = false): ChartPoint[] {
  const clean = finiteChartData(data);
  if (clean.length === 0 || width <= 0 || height <= 0) return [];
  const safeInset = Math.max(0, Math.min(Math.min(width, height) / 2, inset));
  const innerWidth = Math.max(0, width - safeInset * 2);
  const innerHeight = Math.max(0, height - safeInset * 2);
  const bounds = chartBounds(clean, includeZero);
  return clean.map((item, index) => ({
    x: safeInset + (clean.length === 1 ? innerWidth / 2 : (index / (clean.length - 1)) * innerWidth),
    y: safeInset + (1 - (item.value - bounds.min) / bounds.span) * innerHeight,
    datumIndex: index,
  }));
}

export function linePath(points: readonly ChartPoint[]): string {
  if (points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)},${round(point.y)}`).join(' ');
}

export function areaPath(points: readonly ChartPoint[], baseline: number): string {
  if (points.length === 0 || !Number.isFinite(baseline)) return '';
  const line = linePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return '';
  return `${line} L${round(last.x)},${round(baseline)} L${round(first.x)},${round(baseline)} Z`;
}

export function barRects(data: readonly ChartDatum[], width: number, height: number, gap = 6): Array<{ x: number; y: number; width: number; height: number; datumIndex: number }> {
  const clean = finiteChartData(data);
  if (clean.length === 0 || width <= 0 || height <= 0) return [];
  const bounds = chartBounds(clean, true);
  const zeroY = (1 - (0 - bounds.min) / bounds.span) * height;
  const slot = width / clean.length;
  const safeGap = Math.max(0, Math.min(slot * 0.75, gap));
  const barWidth = Math.max(1, slot - safeGap);
  return clean.map((item, index) => {
    const valueY = (1 - (item.value - bounds.min) / bounds.span) * height;
    return {
      x: index * slot + safeGap / 2,
      y: Math.min(valueY, zeroY),
      width: barWidth,
      height: Math.max(1, Math.abs(zeroY - valueY)),
      datumIndex: index,
    };
  });
}

export interface StackedBarCategory { label: string; values: readonly number[]; }
export interface StackedBarRect { categoryIndex: number; seriesIndex: number; x: number; y: number; width: number; height: number; value: number; }

/** Deterministic geometry for non-negative stacked categories. Negative/invalid segments are omitted. */
export function stackedBarRects(data: readonly StackedBarCategory[], width: number, height: number, gap = 6): StackedBarRect[] {
  const clean = data.filter((category) => category.label.trim().length > 0);
  if (clean.length === 0 || width <= 0 || height <= 0) return [];
  const totals = clean.map((category) => category.values.reduce((total, value) => total + (Number.isFinite(value) && value > 0 ? value : 0), 0));
  const maximum = Math.max(...totals, 0);
  if (maximum <= 0) return [];
  const slot = width / clean.length;
  const safeGap = Math.max(0, Math.min(slot * 0.75, gap));
  const barWidth = Math.max(1, slot - safeGap);
  const output: StackedBarRect[] = [];
  clean.forEach((category, categoryIndex) => {
    let consumed = 0;
    category.values.forEach((value, seriesIndex) => {
      if (!Number.isFinite(value) || value <= 0) return;
      const segmentHeight = (value / maximum) * height;
      consumed += segmentHeight;
      output.push({ categoryIndex, seriesIndex, x: categoryIndex * slot + safeGap / 2, y: height - consumed, width: barWidth, height: Math.max(1, segmentHeight), value });
    });
  });
  return output;
}

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function chartSummary(data: readonly ChartDatum[], name = 'Chart'): string {
  const clean = finiteChartData(data);
  if (clean.length === 0) return `${name}. No data.`;
  const min = clean.reduce((a, b) => (b.value < a.value ? b : a));
  const max = clean.reduce((a, b) => (b.value > a.value ? b : a));
  const first = clean[0];
  const last = clean[clean.length - 1];
  if (!first || !last) return `${name}. No data.`;
  const change = last.value - first.value;
  const direction = change > 0 ? 'increased' : change < 0 ? 'decreased' : 'was unchanged';
  return `${name}. ${clean.length} points. Minimum ${min.value} at ${min.label}. Maximum ${max.value} at ${max.label}. From ${first.value} at ${first.label} to ${last.value} at ${last.label}, ${direction}.`;
}

export interface DonutSegment {
  datumIndex: number;
  startAngle: number;
  endAngle: number;
  value: number;
}

/** Positive finite values normalized into deterministic donut segments. */
export function donutSegments(data: readonly ChartDatum[]): DonutSegment[] {
  const clean = finiteChartData(data).map((datum, datumIndex) => ({ datum, datumIndex })).filter(({ datum }) => datum.value > 0);
  const total = clean.reduce((sum, { datum }) => sum + datum.value, 0);
  if (!Number.isFinite(total) || total <= 0) return [];
  let angle = 0;
  return clean.map(({ datum, datumIndex }) => {
    const startAngle = angle;
    angle += (datum.value / total) * Math.PI * 2;
    return { datumIndex, startAngle, endAngle: angle, value: datum.value };
  });
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
