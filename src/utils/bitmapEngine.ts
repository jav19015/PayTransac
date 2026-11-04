import { BitmapState } from '../types/iso8583';

/**
 * Computes primary and secondary bitmap from a list of active Data Element numbers (DE 1 to 128)
 */
export function computeBitmap(activeFieldNumbers: number[]): BitmapState {
  const fieldSet = new Set(activeFieldNumbers);

  // Check if any field from 65 to 128 is active
  const hasSecondary = Array.from(fieldSet).some((de) => de >= 65 && de <= 128);

  const totalBits = hasSecondary ? 128 : 64;
  const bits: boolean[] = new Array(totalBits + 1).fill(false); // 1-indexed

  // Bit 1 indicates presence of Secondary Bitmap
  if (hasSecondary) {
    bits[1] = true;
  }

  // Populate bits for each active field
  fieldSet.forEach((de) => {
    if (de >= 2 && de <= totalBits) {
      bits[de] = true;
    }
  });

  // Build binary string
  let binaryStr = '';
  for (let i = 1; i <= totalBits; i++) {
    binaryStr += bits[i] ? '1' : '0';
  }

  // Build hex string
  let hexStr = '';
  for (let i = 0; i < totalBits; i += 4) {
    const nibble = binaryStr.slice(i, i + 4);
    const hexDigit = parseInt(nibble, 2).toString(16).toUpperCase();
    hexStr += hexDigit;
  }

  const primaryHex = hexStr.slice(0, 16);
  const secondaryHex = hasSecondary ? hexStr.slice(16, 32) : null;

  const activeBits: number[] = [];
  for (let i = 1; i <= totalBits; i++) {
    if (bits[i]) {
      activeBits.push(i);
    }
  }

  return {
    binary: binaryStr,
    hex: hexStr,
    primaryHex,
    secondaryHex,
    activeBits,
    hasSecondary,
  };
}

/**
 * Parses a Hexadecimal Bitmap (16 hex chars for 64-bit, 32 hex chars for 128-bit)
 */
export function parseBitmapHex(hexStr: string): {
  activeFields: number[];
  hasSecondary: boolean;
  binary: string;
  error?: string;
} {
  const cleanHex = hexStr.replace(/\s+/g, '').toUpperCase();
  if (!/^[0-9A-F]+$/.test(cleanHex)) {
    return { activeFields: [], hasSecondary: false, binary: '', error: 'Caractères hexadécimaux invalides dans la bitmap' };
  }

  if (cleanHex.length !== 16 && cleanHex.length !== 32) {
    return {
      activeFields: [],
      hasSecondary: false,
      binary: '',
      error: `Longueur invalide : ${cleanHex.length} caractères (requis : 16 pour 64 bits ou 32 pour 128 bits)`,
    };
  }

  // Convert hex to binary string
  let binary = '';
  for (let i = 0; i < cleanHex.length; i++) {
    const hexDigit = cleanHex[i];
    const binPart = parseInt(hexDigit, 16).toString(2).padStart(4, '0');
    binary += binPart;
  }

  const hasSecondary = binary[0] === '1';
  const activeFields: number[] = [];

  for (let i = 1; i <= binary.length; i++) {
    if (binary[i - 1] === '1') {
      activeFields.push(i);
    }
  }

  return {
    activeFields,
    hasSecondary,
    binary,
  };
}

/**
 * Formats a binary string into human-readable octet groups:
 * e.g. "01110010 00111000 00000000 ..."
 */
export function formatBinaryGroups(binary: string, groupSize: number = 8): string {
  const chunks: string[] = [];
  for (let i = 0; i < binary.length; i += groupSize) {
    chunks.push(binary.slice(i, i + groupSize));
  }
  return chunks.join(' ');
}

/**
 * Formats a hex string into spaced octets:
 * e.g. "72 38 00 00 08 C0 80 00"
 */
export function formatHexOctets(hex: string): string {
  const clean = hex.replace(/\s+/g, '');
  const pairs: string[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    pairs.push(clean.slice(i, i + 2));
  }
  return pairs.join(' ');
}
