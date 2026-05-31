import { describe, expect, it } from 'vitest';

import { phaseCurveGeometry, type CurveBox } from '../phaseCurveGeometry';

const BOX: CurveBox = { width: 280, height: 120, padding: 12 };

const nums = (s: string): number[] => (s.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

/** On-curve points only (M/L destinations + each C's final pair) — bézier control
 *  points legitimately sit outside the data hull, so they're excluded. */
function onCurvePoints(d: string): [number, number][] {
  const t = d.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  const pts: [number, number][] = [];
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd === 'M' || cmd === 'L') pts.push([Number(t[i++]), Number(t[i++])]);
    else if (cmd === 'C') {
      i += 4; // skip the two control points
      pts.push([Number(t[i++]), Number(t[i++])]);
    }
  }
  return pts;
}

describe('phaseCurveGeometry', () => {
  it('is empty for a zero/negative session', () => {
    expect(phaseCurveGeometry(0, BOX).strokeSegments).toHaveLength(0);
    expect(phaseCurveGeometry(-5, BOX).fillPath).toBe('');
  });

  it('a short (16-min) session is Struggle-only — no flow, no dividers', () => {
    const geo = phaseCurveGeometry(16, BOX);
    expect(geo.strokeSegments.map((s) => s.phase)).toEqual(['struggle']);
    expect(geo.dividers).toHaveLength(0); // never reached minute 20
    expect(geo.labels).toEqual([{ phase: 'struggle', range: '0–16', midX: expect.any(Number) }]);
  });

  it('a 50-min session traverses all three phases with both dividers', () => {
    const geo = phaseCurveGeometry(50, BOX);
    expect(geo.strokeSegments.map((s) => s.phase)).toEqual(['struggle', 'release', 'flow']);
    expect(geo.dividers).toHaveLength(2); // boundaries at 20 and 21
    expect(geo.dividers[0]).toBeLessThan(geo.dividers[1]);
    expect(geo.labels.map((l) => l.range)).toEqual(['0–20', '20–21', '21–50']);
  });

  it('fill stops blend the occurred phases left-to-right within [0,1]', () => {
    const geo = phaseCurveGeometry(50, BOX);
    expect(geo.fillStops.map((s) => s.phase)).toEqual(['struggle', 'release', 'flow']);
    const offsets = geo.fillStops.map((s) => s.offset);
    // strictly increasing, all in [0,1]
    for (let i = 0; i < offsets.length; i += 1) {
      expect(offsets[i]).toBeGreaterThanOrEqual(0);
      expect(offsets[i]).toBeLessThanOrEqual(1);
      if (i > 0) expect(offsets[i]).toBeGreaterThan(offsets[i - 1]);
    }
    // a short session is a single-phase wash
    expect(phaseCurveGeometry(16, BOX).fillStops.map((s) => s.phase)).toEqual(['struggle']);
  });

  it('flow sits higher on screen (smaller pixel y) than struggle', () => {
    const geo = phaseCurveGeometry(50, BOX);
    const struggle = geo.strokeSegments.find((s) => s.phase === 'struggle')!;
    const flow = geo.strokeSegments.find((s) => s.phase === 'flow')!;
    // first y of struggle vs last y of flow (engagement rises → y falls).
    const struggleStartY = nums(struggle.path)[1];
    const flowNums = nums(flow.path);
    const flowEndY = flowNums[flowNums.length - 1];
    expect(flowEndY).toBeLessThan(struggleStartY);
  });

  it('keeps on-curve points inside the padded box', () => {
    const geo = phaseCurveGeometry(50, BOX);
    for (const seg of geo.strokeSegments) {
      for (const [x, y] of onCurvePoints(seg.path)) {
        expect(x).toBeGreaterThanOrEqual(BOX.padding - 0.01);
        expect(x).toBeLessThanOrEqual(BOX.width - BOX.padding + 0.01);
        expect(y).toBeGreaterThanOrEqual(BOX.padding - 0.01);
        expect(y).toBeLessThanOrEqual(BOX.height - BOX.padding + 0.01);
      }
    }
  });

  it('never emits NaN and is deterministic', () => {
    const a = phaseCurveGeometry(37, BOX);
    const b = phaseCurveGeometry(37, BOX);
    expect(a).toEqual(b);
    const allNums = [
      ...a.strokeSegments.flatMap((s) => nums(s.path)),
      ...nums(a.fillPath),
      ...a.dividers,
    ];
    expect(allNums.some((n) => Number.isNaN(n))).toBe(false);
  });
});
