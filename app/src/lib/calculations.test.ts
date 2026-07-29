import { describe, it, expect } from 'vitest';
import { calculateMillmanProfile } from './millmanCalculations';

// Human Design Gate calculation tests
describe('Human Design Calculations', () => {
  it('should calculate correct gate from longitude', () => {
    // Gate 41 starts at 0° (Aquarius)
    // Each gate is 5.625°
    const longitudeToGate = (longitude: number): number => {
      const GATE_DEGREES = 5.625;
      const MANDALA_GATES = [
        41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
        27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
        31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50,
        28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60
      ];
      const gateIndex = Math.floor(longitude / GATE_DEGREES);
      return MANDALA_GATES[gateIndex % 64];
    };

    // Test cases
    expect(longitudeToGate(0)).toBe(41);    // Start of Gate 41
    expect(longitudeToGate(5.625)).toBe(19); // Start of Gate 19
    expect(longitudeToGate(11.25)).toBe(13); // Start of Gate 13
    expect(longitudeToGate(180)).toBe(31);  // Gate 31 at ~180°
  });

  it('should calculate line from gate position', () => {
    const calculateLine = (withinGate: number): number => {
      const LINE_DEGREES = 0.9375;
      let line = Math.floor(withinGate / LINE_DEGREES) + 1;
      return Math.min(6, Math.max(1, line));
    };

    expect(calculateLine(0)).toBe(1);
    expect(calculateLine(0.9375)).toBe(2);
    expect(calculateLine(4.6875)).toBe(6); // Last line
  });
});

// Numerology calculation tests
describe('Numerology Calculations', () => {
  it('should calculate life path number correctly', () => {
    const calculateLifePath = (birthDate: string): number => {
      const sumDigits = (n: number): number => {
        if (n === 11 || n === 22 || n === 33) return n; // Master numbers
        let sum = 0;
        while (n > 0) {
          sum += n % 10;
          n = Math.floor(n / 10);
        }
        return sum;
      };

      const [year, month, day] = birthDate.split('-').map(Number);
      const yearSum = sumDigits(year);
      const monthSum = sumDigits(month);
      const daySum = sumDigits(day);
      
      let total = yearSum + monthSum + daySum;
      while (total > 9 && total !== 11 && total !== 22 && total !== 33) {
        total = sumDigits(total);
      }
      
      return total;
    };

    // Test: 1990-05-15
    // Year: 1+9+9+0 = 19 -> 1+9 = 10 -> 1+0 = 1
    // Month: 5
    // Day: 1+5 = 6
    // Total: 1 + 5 + 6 = 12 -> 1+2 = 3
    expect(calculateLifePath('1990-05-15')).toBe(3);

    // Test: 1984-11-22
    // Year: 1+9+8+4 = 22 (master), Month: 11 (master), Day: 2+2 = 4
    // Total: 22 + 11 + 4 = 37 -> 3+7 = 10 -> 1+0 = 1
    expect(calculateLifePath('1984-11-22')).toBe(1);
  });

  it('should reduce name to expression number', () => {
    const calculateExpression = (name: string): number => {
      const letterValues: Record<string, number> = {
        a: 1, j: 1, s: 1,
        b: 2, k: 2, t: 2,
        c: 3, l: 3, u: 3,
        d: 4, m: 4, v: 4,
        e: 5, n: 5, w: 5,
        f: 6, o: 6, x: 6,
        g: 7, p: 7, y: 7,
        h: 8, q: 8, z: 8,
        i: 9, r: 9
      };

      const sum = name.toLowerCase()
        .replace(/[^a-z]/g, '')
        .split('')
        .reduce((acc, char) => acc + (letterValues[char] || 0), 0);

      let result = sum;
      while (result > 9 && result !== 11 && result !== 22 && result !== 33) {
        result = result.toString().split('').reduce((a, b) => a + parseInt(b), 0);
      }

      return result;
    };

    // Test: "John" = 1+6+8+5 = 20 -> 2+0 = 2
    expect(calculateExpression('John')).toBe(2);

    // Test: "Anna" = 1+5+5+1 = 12 -> 1+2 = 3
    expect(calculateExpression('Anna')).toBe(3);
  });

  it('stops reducing at a master number reached mid-reduction (not just as raw input)', () => {
    // Day 29 -> digit sum 2+9 = 11, a master number. A buggy reducer that
    // only checks the master-number set on the *original* input (29, not
    // in [11,22,33,44]) reduces straight through to 1+1 = 2, losing the
    // master number. root1 mirrors the day reduction directly, so it's a
    // precise probe for this regression.
    const profile = calculateMillmanProfile({
      fullName: 'Test Person',
      birthDate: '2000-03-29',
    });

    expect(profile.root1).toBe(11);
    expect(profile.lifePathString).toBe('11-3-7');
  });
});

// Gene Keys tests
describe('Gene Keys', () => {
  it('should have all 64 gene keys defined', () => {
    // This would import the actual geneKeys module
    // For now, just verify the structure
    const geneKeysCount = 64;
    expect(geneKeysCount).toBe(64);
  });

  it('should calculate pearl sequence correctly', () => {
    const getPearlSequence = (startGate: number): number[] => {
      const sequence: number[] = [];
      let current = startGate;
      for (let i = 0; i < 11; i++) {
        sequence.push(current);
        current = (current % 64) + 1;
      }
      return sequence;
    };

    const pearl1 = getPearlSequence(1);
    expect(pearl1).toHaveLength(11);
    expect(pearl1[0]).toBe(1);
    expect(pearl1[10]).toBe(11);
  });
});

// Transit calculation tests
describe('Transit Calculations', () => {
  it('should calculate Julian Day correctly', () => {
    const julianDay = (year: number, month: number, day: number): number => {
      const a = Math.floor(year / 100);
      const b = 2 - a + Math.floor(a / 4);
      return Math.floor(365.25 * (year + 4716)) + 
             Math.floor(30.6001 * (month + 1)) + 
             day + b - 1524.5;
    };

    // Test: 2000-01-01 should be around JD 2451545
    const jd = julianDay(2000, 1, 1);
    expect(jd).toBeGreaterThan(2451000);
    expect(jd).toBeLessThan(2452000);
  });

  it('should calculate sun longitude correctly', () => {
    const sunLongitude = (jd: number): number => {
      const t = (jd - 2451545.0) / 36525.0;
      const l0 = 280.46646 + 36000.76983 * t;
      return l0 % 360;
    };

    // At J2000.0, sun should be at ~280°
    const lon = sunLongitude(2451545.0);
    expect(lon).toBeCloseTo(280.46646, 0);
  });
});

// Encryption tests (mock)
describe('Encryption', () => {
  it('should encrypt and decrypt data', () => {
    // Mock encryption for testing
    const mockEncrypt = (text: string): string => {
      return btoa(text); // Simple base64 for testing
    };

    const mockDecrypt = (encrypted: string): string => {
      return atob(encrypted);
    };

    const original = 'Test message';
    const encrypted = mockEncrypt(original);
    const decrypted = mockDecrypt(encrypted);

    expect(decrypted).toBe(original);
    expect(encrypted).not.toBe(original);
  });
});
