/**
 * Millman Numerology Calculations
 * Pure TypeScript implementation - no backend dependency
 * Based on Dan Millman's "The Life You Were Born to Live"
 */

import type { MillmanProfile, Challenge, Pinnacle } from '@/types/humanDesign';

// ============================================================================
// CONSTANTS
// ============================================================================

const MASTER_NUMBERS = [11, 22, 33, 44];
const KARMIC_DEBT_NUMBERS = [13, 14, 16, 19];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Reduce a number to a single digit (1-9), unless a master number (11, 22,
 * 33, 44) is reached — including partway through the reduction, not just
 * as the original input. E.g. 1993 -> 1+9+9+3 = 22 must stop at 22, not
 * reduce further to 4.
 */
function reduceNumber(num: number, allowMasters = true): number {
  if (num === 0) return 0;

  let sum = num;
  while (sum > 9) {
    if (allowMasters && MASTER_NUMBERS.includes(sum)) {
      return sum;
    }
    sum = String(sum)
      .split('')
      .reduce((acc, digit) => acc + parseInt(digit, 10), 0);
  }

  return sum;
}

/**
 * Calculate sum of digits in a string
 */
function sumDigits(str: string): number {
  return str
    .replace(/[^0-9]/g, '')
    .split('')
    .reduce((sum, digit) => sum + parseInt(digit, 10), 0);
}

/**
 * Calculate Pythagorean value of a name
 */
function calculateNameValue(name: string): number {
  const letterValues: Record<string, number> = {
    a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9,
    j: 1, k: 2, l: 3, m: 4, n: 5, o: 6, p: 7, q: 8, r: 9,
    s: 1, t: 2, u: 3, v: 4, w: 5, x: 6, y: 7, z: 8,
    ä: 1, ö: 2, ü: 3, ß: 4,
  };

  return name
    .toLowerCase()
    .split('')
    .reduce((sum, char) => sum + (letterValues[char] || 0), 0);
}

/**
 * Get vowels from a name
 */
function getVowels(name: string): string {
  return name.toLowerCase().replace(/[^aeiouäöü]/g, '');
}

/**
 * Get consonants from a name
 */
function getConsonants(name: string): string {
  return name.toLowerCase().replace(/[aeiouäöü\s]/g, '');
}

// ============================================================================
// MAIN CALCULATIONS
// ============================================================================

interface CalculationInput {
  fullName: string;
  birthDate: string; // YYYY-MM-DD
}

export function calculateMillmanProfile(input: CalculationInput): MillmanProfile {
  const [year, month, day] = input.birthDate.split('-').map(Number);

  // Life Path calculation (Dan Millman method)
  const daySum = reduceNumber(day, true);
  const monthSum = reduceNumber(month, true);
  const yearSum = reduceNumber(year, true);

  // Root numbers
  const root1 = daySum;
  const root2 = monthSum;
  const baseSum = reduceNumber(root1 + root2 + yearSum, true);

  // Life path string
  const lifePathString = `${root1}-${root2}-${baseSum}`;

  // Destiny number (full birthdate sum)
  const fullDateSum = day + month + year;
  let destinyNumber = reduceNumber(fullDateSum, true);

  // Check for master number or karmic debt
  const hasMasterNumber = MASTER_NUMBERS.includes(destinyNumber);
  const hasZeroEnhancer = KARMIC_DEBT_NUMBERS.includes(destinyNumber);

  // Soul Urge (vowels in name)
  const vowels = getVowels(input.fullName);
  const soulUrgeValue = calculateNameValue(vowels);
  const soulUrgeNumber = reduceNumber(soulUrgeValue, true);

  // Expression (all letters in name)
  const expressionValue = calculateNameValue(input.fullName);
  const expressionNumber = reduceNumber(expressionValue, true);

  // Challenges
  const challenges: Challenge[] = [
    {
      ageRange: 'Geburt - 30/35',
      challengeNumber: Math.abs(root1 - root2) || 0,
    },
    {
      ageRange: '30/35 - 55/60',
      challengeNumber: Math.abs(root1 - baseSum) || 0,
    },
    {
      ageRange: '55/60 - Lebensende',
      challengeNumber: Math.abs(root2 - baseSum) || 0,
    },
  ];

  // Pinnacles
  const pinnacles: Pinnacle[] = [
    {
      ageRange: '0 - 36',
      pinnacleNumber: reduceNumber(root1 + root2, true),
    },
    {
      ageRange: '36 - 45',
      pinnacleNumber: reduceNumber(root1 + yearSum, true),
    },
    {
      ageRange: '45 - 54',
      pinnacleNumber: reduceNumber(root2 + yearSum, true),
    },
    {
      ageRange: '54+',
      pinnacleNumber: reduceNumber(daySum + monthSum + yearSum, true),
    },
  ];

  // Personal Year
  const currentYear = new Date().getFullYear();
  const personalYearSum = day + month + currentYear;
  const personalYear = reduceNumber(personalYearSum, false);

  return {
    lifePathString,
    root1,
    root2,
    baseSum,
    destinyNumber,
    hasMasterNumber,
    hasZeroEnhancer,
    soulUrgeString: soulUrgeNumber ? `${soulUrgeValue}/${soulUrgeNumber}` : undefined,
    expressionString: expressionNumber ? `${expressionValue}/${expressionNumber}` : undefined,
    challenges,
    pinnacles,
    personalYear,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateBirthDate(dateStr: string): { valid: boolean; error?: string } {
  const [year, month, day] = dateStr.split('-').map(Number);

  if (!year || !month || !day) {
    return { valid: false, error: 'Invalid date format' };
  }

  if (year < 1800 || year > 2100) {
    return { valid: false, error: 'Year must be between 1800 and 2100' };
  }

  if (month < 1 || month > 12) {
    return { valid: false, error: 'Month must be between 1 and 12' };
  }

  if (day < 1 || day > 31) {
    return { valid: false, error: 'Day must be between 1 and 31' };
  }

  // Check if date is valid
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date' };
  }

  // Check if date is in the past
  if (date > new Date()) {
    return { valid: false, error: 'Birth date cannot be in the future' };
  }

  return { valid: true };
}

export function validateName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }

  if (name.length > 100) {
    return { valid: false, error: 'Name is too long (max 100 characters)' };
  }

  return { valid: true };
}
