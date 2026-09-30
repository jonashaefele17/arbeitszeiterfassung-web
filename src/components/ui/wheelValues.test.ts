import { describe, expect, it } from 'vitest';
import { range, withValue } from './WheelPicker';

describe('Walzen-Raster', () => {
  const steps = range(0, 55, 5);

  it('liefert 5-min-Schritte', () => {
    expect(steps).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    expect(range(0, 180, 5)).toHaveLength(37);
  });

  it('lässt das Raster unverändert, wenn der Wert darin liegt', () => {
    expect(withValue(steps, 30)).toBe(steps);
  });

  it('ergänzt einen krummen Wert an passender Stelle', () => {
    expect(withValue(steps, 7).slice(0, 4)).toEqual([0, 5, 7, 10]);
    expect(withValue(steps, 58).at(-1)).toBe(58);
    expect(withValue(range(0, 180, 5), 32)).toContain(32);
  });
});
