/**
 * scripts/seed-helpers.ts
 *
 * Pure, dependency-free helper functions used by scripts/seed.ts. Kept
 * separate from the CLI entrypoint so they're cheap to unit-test (no
 * Supabase client, no network, no argv parsing).
 */

/** Mulberry32 seeded PRNG — small, fast, good-enough distribution for demo
 * data generation. Same seed always produces the same sequence, which is
 * what makes `scripts/seed.ts --reset` reruns byte-identical. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Weighted<T> {
  value: T;
  weight: number;
}

/** Weighted-random pick from a list of {value, weight} entries using a
 * supplied `rng()` that returns a uniform float in [0, 1). Weights need not
 * sum to 1 — they're normalized internally. Throws on an empty or
 * all-zero-weight list. */
export function weightedPick<T>(rng: () => number, items: Weighted<T>[]): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  if (total <= 0) throw new Error("weightedPick: no positive-weight items");
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  // Floating-point fallback: last item.
  return items[items.length - 1].value;
}

/** Monday-Sunday weekend dip + mild month-long sinusoidal drift, used to
 * shape the number of events per calendar day so a 30-day timeline doesn't
 * look like a flat line. `dayIndex` is 0-based from the seed window start;
 * `date` supplies the actual weekday. Returns a multiplier centered near 1. */
export function dailyShapeFactor(date: Date, dayIndex: number, totalDays: number): number {
  const dow = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = dow === 0 || dow === 6;
  const weekendDip = isWeekend ? 0.8 : 1.0;
  const monthlyDrift = 1 + 0.1 * Math.sin((2 * Math.PI * dayIndex) / totalDays);
  return weekendDip * monthlyDrift;
}

/** Mild diurnal (hour-of-day) weight — crawlers run around the clock, but a
 * gentle sinusoidal bump keeps the hour distribution from looking perfectly
 * flat. Peaks around midday UTC, troughs in the small hours. */
export function hourWeight(hour: number): number {
  return 1 + 0.35 * Math.sin((2 * Math.PI * (hour - 6)) / 24);
}

/** Linear ramp used for the ClaudeBot story arc: count on day `days-1`
 * (1-indexed day `days`) is exactly 2x the count on day 0 (1-indexed day 1).
 * `baseline` is chosen so the ramp's sum over `days` days matches the
 * intended total ClaudeBot volume. */
export function claudeRampCount(dayIndex: number, totalDays: number, baseline: number): number {
  return baseline * (1 + dayIndex / (totalDays - 1));
}
