/**
 * Validates an Indian PAN number.
 * Format: 5 uppercase letters, 4 digits, 1 uppercase letter
 * Example: ABCDE1234F
 */
export function isValidPan(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);
}

/**
 * Verhoeff algorithm multiplication table
 */
const VERHOEFF_D: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

/**
 * Verhoeff permutation table
 */
const VERHOEFF_P: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/**
 * Verhoeff inverse table
 */
const VERHOEFF_INV: number[] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/**
 * Validates an Aadhaar number using Verhoeff checksum.
 * Must be exactly 12 digits.
 */
export function isValidAadhaar(aadhaar: string): boolean {
  if (!/^\d{12}$/.test(aadhaar)) {
    return false;
  }

  const digits = aadhaar.split('').map(Number).reverse();
  let c = 0;
  for (let i = 0; i < digits.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digits[i]]];
  }
  return c === 0;
}

/**
 * Validates an Indian mobile phone number.
 * Must start with 6-9 and be 10 digits total.
 */
export function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

/**
 * Validates an IFSC code.
 * Format: 4 uppercase letters, 0, 6 alphanumeric characters
 * Example: SBIN0001234
 */
export function isValidIfsc(ifsc: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);
}

/**
 * Validates an Indian PIN code.
 * Must be 6 digits and not start with 0.
 */
export function isValidPincode(pin: string): boolean {
  return /^[1-9]\d{5}$/.test(pin);
}

/**
 * Validates a GSTIN (GST Identification Number).
 * Format: 2 digits (state code) + PAN (10 chars) + Z + 1 alphanumeric
 * Example: 27ABCDE1234F1Z5
 */
export function isValidGstin(gstin: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gstin);
}
