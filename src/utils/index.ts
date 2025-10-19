export * from './message';

export function clamp(value: number, min: number, max: number): number {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return Math.max(low, Math.min(high, value));
  }