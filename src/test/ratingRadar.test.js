import { describe, it, expect } from 'vitest';
import { normalizedRadarValues, RADAR_LABELS, RADAR_DIMENSIONS } from '@/assets/javascript/ratingRadar.js';

describe('normalizedRadarValues', () => {
  it('passes 0-10 dimensions through unchanged', () => {
    const rating = { direction: 8, imagery: 7, story: 9, performance: 6, soundtrack: 5, overall: 8, stickiness: 3, love: 0 };
    const values = normalizedRadarValues(rating);
    const index = (key) => RADAR_DIMENSIONS.findIndex((d) => d.key === key);
    expect(values[index('direction')]).toBe(8);
    expect(values[index('imagery')]).toBe(7);
    expect(values[index('story')]).toBe(9);
    expect(values[index('performance')]).toBe(6);
    expect(values[index('soundtrack')]).toBe(5);
    expect(values[index('overall')]).toBe(8);
  });

  it('maps love from -5..5 to 0..10', () => {
    const index = RADAR_DIMENSIONS.findIndex((d) => d.key === 'love');
    expect(normalizedRadarValues({ love: -5 })[index]).toBe(0);
    expect(normalizedRadarValues({ love: 0 })[index]).toBe(5);
    expect(normalizedRadarValues({ love: 5 })[index]).toBe(10);
  });

  it('maps stickiness from 0..5 to 0..10, treating an explicit 0 as 1 (matching the ratings table elsewhere)', () => {
    const index = RADAR_DIMENSIONS.findIndex((d) => d.key === 'stickiness');
    expect(normalizedRadarValues({ stickiness: 5 })[index]).toBe(10);
    expect(normalizedRadarValues({ stickiness: 0 })[index]).toBe(2);
  });

  it('returns all zeros for a null/undefined rating, matching the label count', () => {
    const values = normalizedRadarValues(null);
    expect(values).toHaveLength(RADAR_LABELS.length);
    expect(values.every((v) => v === 0)).toBe(true);
  });

  it('treats a non-numeric dimension value as 0 rather than NaN', () => {
    const index = RADAR_DIMENSIONS.findIndex((d) => d.key === 'direction');
    expect(normalizedRadarValues({ direction: undefined })[index]).toBe(0);
  });
});
