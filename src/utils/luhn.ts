/**
 * Luhn Algorithm (MOD 10 / ISO/IEC 7812-1)
 * Used for Primary Account Number (PAN) validation and check-digit generation
 */

export function validateLuhn(pan: string): boolean {
  const cleanPan = pan.replace(/\D/g, '');
  if (cleanPan.length < 12 || cleanPan.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = cleanPan.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanPan[i], 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Calculates the single Luhn check digit for a PAN prefix (e.g. 15 digits -> computes 16th)
 */
export function calculateLuhnCheckDigit(prefixWithoutCheckDigit: string): number {
  const clean = prefixWithoutCheckDigit.replace(/\D/g, '');
  let sum = 0;
  let shouldDouble = true; // First from right of the prefix must be doubled

  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean[i], 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Generates a valid PAN for a given BIN prefix and length
 */
export function generateValidPan(bin: string, length: number = 16): string {
  const cleanBin = bin.replace(/\D/g, '');
  let pan = cleanBin;

  // Add random middle digits
  while (pan.length < length - 1) {
    pan += Math.floor(Math.random() * 10).toString();
  }

  // Calculate check digit
  const checkDigit = calculateLuhnCheckDigit(pan);
  return pan + checkDigit.toString();
}

/**
 * Returns full step-by-step mathematical breakdown of the Luhn computation for educational UI
 */
export function getLuhnStepByStepDetails(pan: string): {
  digits: number[];
  factors: number[];
  products: number[];
  reducedValues: number[];
  totalSum: number;
  remainder: number;
  isValid: boolean;
  computedCheckDigit: number;
} {
  const clean = pan.replace(/\D/g, '');
  const digits = clean.split('').map((d) => parseInt(d, 10));
  const factors: number[] = [];
  const products: number[] = [];
  const reducedValues: number[] = [];

  let shouldDouble = false;
  let totalSum = 0;

  // Traverse from right to left
  for (let i = digits.length - 1; i >= 0; i--) {
    const factor = shouldDouble ? 2 : 1;
    factors.unshift(factor);

    const prod = digits[i] * factor;
    products.unshift(prod);

    const reduced = prod > 9 ? prod - 9 : prod;
    reducedValues.unshift(reduced);

    totalSum += reduced;
    shouldDouble = !shouldDouble;
  }

  const remainder = totalSum % 10;
  const isValid = remainder === 0 && clean.length >= 12;

  // If we take prefix without the last digit, what check digit would be required?
  const prefix = clean.slice(0, -1);
  const computedCheckDigit = prefix ? calculateLuhnCheckDigit(prefix) : 0;

  return {
    digits,
    factors,
    products,
    reducedValues,
    totalSum,
    remainder,
    isValid,
    computedCheckDigit,
  };
}
