import { PackedField, PackedMessage } from '../types/iso8583';
import { computeBitmap } from './bitmapEngine';
import { ISO_8583_FIELDS } from './iso8583Spec';

/**
 * Packs ISO 8583 message according to field specifications
 */
export function packIso8583Message(
  mti: string,
  fields: Record<number, string>,
  tpdu: string = '6000010000'
): PackedMessage {
  // 1. Gather active fields that have a value
  const activeDes = Object.keys(fields)
    .map(Number)
    .filter((de) => de >= 2 && de <= 128 && fields[de] !== undefined && fields[de].trim() !== '')
    .sort((a, b) => a - b);

  // 2. Compute bitmap
  const bitmapState = computeBitmap(activeDes);

  const cleanTpdu = tpdu ? tpdu.replace(/\s+/g, '').toUpperCase() : '';
  const cleanMti = mti.trim();

  const packedFields: PackedField[] = [];
  let currentOffset = 0;

  // If TPDU present
  if (cleanTpdu) {
    currentOffset += Math.ceil(cleanTpdu.length / 2);
  }
  // MTI is 4 bytes ASCII or 2 bytes BCD (we treat MTI as 4 ASCII chars for standard representation)
  currentOffset += cleanMti.length;
  // Bitmap is 8 bytes (64-bit) or 16 bytes (128-bit)
  const bitmapByteLength = bitmapState.hasSecondary ? 16 : 8;
  currentOffset += bitmapByteLength;

  let fieldStringStream = '';
  let fieldHexStream = '';

  for (const de of activeDes) {
    const rawVal = fields[de];
    const spec = ISO_8583_FIELDS[de] || {
      de,
      name: `Champ ${de}`,
      nameEn: `Data Element ${de}`,
      type: 'ans',
      lengthType: 'LLVAR',
      length: 99,
      category: 'other',
      description: 'Champ personnalisé',
      example: '',
    };

    let lengthHeader = '';
    let valString = rawVal;
    let valHex = '';

    if (spec.lengthType === 'FIXED') {
      // Pad or truncate
      if (spec.type === 'n') {
        valString = rawVal.padStart(spec.length, '0').slice(-spec.length);
      } else {
        valString = rawVal.padEnd(spec.length, ' ').slice(0, spec.length);
      }
      lengthHeader = ''; // no prefix
    } else if (spec.lengthType === 'LLVAR') {
      const len = spec.type === 'b' ? Math.ceil(rawVal.length / 2) : rawVal.length;
      lengthHeader = len.toString().padStart(2, '0');
    } else if (spec.lengthType === 'LLLVAR') {
      const len = spec.type === 'b' ? Math.ceil(rawVal.length / 2) : rawVal.length;
      lengthHeader = len.toString().padStart(3, '0');
    } else if (spec.lengthType === 'LLLLVAR') {
      const len = spec.type === 'b' ? Math.ceil(rawVal.length / 2) : rawVal.length;
      lengthHeader = len.toString().padStart(4, '0');
    }

    // Convert string to hex
    if (spec.type === 'b') {
      // already hex
      const cleanHexVal = valString.replace(/\s+/g, '').toUpperCase();
      valHex = cleanHexVal;
    } else {
      valHex = stringToHex(valString);
    }

    const headerHex = stringToHex(lengthHeader);
    const fieldTotalHex = headerHex + valHex;
    const fieldByteLength = Math.ceil(fieldTotalHex.length / 2);

    packedFields.push({
      de,
      name: spec.name,
      type: spec.type,
      lengthType: spec.lengthType,
      declaredLength: valString.length,
      rawHeader: lengthHeader,
      value: valString,
      hexValue: fieldTotalHex,
      offset: currentOffset,
      byteLength: fieldByteLength,
    });

    fieldStringStream += lengthHeader + valString;
    fieldHexStream += fieldTotalHex;
    currentOffset += fieldByteLength;
  }

  // Construct raw string
  const rawAscii = (cleanTpdu ? `[TPDU:${cleanTpdu}]` : '') + cleanMti + `[BITMAP:${bitmapState.hex}]` + fieldStringStream;

  // Construct full raw hex stream
  const tpduHex = cleanTpdu;
  const mtiHex = stringToHex(cleanMti);
  const bitmapHex = bitmapState.hex; // already in hex
  const fullHex = tpduHex + mtiHex + bitmapHex + fieldHexStream;

  const hexDumpLines = generateHexDump(fullHex);

  return {
    tpdu: cleanTpdu,
    mti: cleanMti,
    bitmapHex: bitmapState.hex,
    bitmapBinary: bitmapState.binary,
    packedFields,
    rawAscii,
    rawHex: fullHex,
    totalBytes: Math.ceil(fullHex.length / 2),
    hexDumpLines,
  };
}

/**
 * Converts an ASCII string to uppercase Hex string
 */
export function stringToHex(str: string): string {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    hex += code.toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}

/**
 * Converts a Hex string to ASCII string (replacing non-printables with '.')
 */
export function hexToAscii(hex: string): string {
  let ascii = '';
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (byte >= 32 && byte <= 126) {
      ascii += String.fromCharCode(byte);
    } else {
      ascii += '.';
    }
  }
  return ascii;
}

/**
 * Formats full hex string into Wireshark / tcpdump style lines
 */
export function generateHexDump(hexString: string): { offset: string; hex: string; ascii: string }[] {
  const clean = hexString.replace(/\s+/g, '');
  const lines: { offset: string; hex: string; ascii: string }[] = [];
  const bytesPerLine = 16;
  const charsPerLine = bytesPerLine * 2;

  for (let i = 0; i < clean.length; i += charsPerLine) {
    const chunk = clean.slice(i, i + charsPerLine);
    const offset = (i / 2).toString(16).padStart(4, '0').toUpperCase();

    // Group octets
    const octets: string[] = [];
    for (let j = 0; j < chunk.length; j += 2) {
      octets.push(chunk.slice(j, j + 2));
    }

    // Pad hex part if incomplete line
    const hexPart1 = octets.slice(0, 8).join(' ');
    const hexPart2 = octets.slice(8, 16).join(' ');
    const hexCombined = `${hexPart1.padEnd(23, ' ')}  ${hexPart2.padEnd(23, ' ')}`;

    const asciiPart = hexToAscii(chunk);

    lines.push({
      offset,
      hex: hexCombined,
      ascii: asciiPart,
    });
  }

  return lines;
}

/**
 * Raw Frame Unpacker / Decoder:
 * Parses an arbitrary ISO 8583 raw hex or ASCII text message into MTI, Bitmap, and Fields
 */
export function unpackIso8583Message(input: string): {
  success: boolean;
  tpdu?: string;
  mti?: string;
  bitmapHex?: string;
  fields: Record<number, string>;
  activeDes: number[];
  warnings: string[];
  error?: string;
} {
  const warnings: string[] = [];
  let workingHex = input.replace(/\s+/g, '').toUpperCase();

  // If input looks like ASCII text (e.g. starting with '0200' or '6000')
  const isAsciiText = !/^[0-9A-F]+$/.test(workingHex) || (input.includes(' ') && !/^[0-9A-Fa-f\s]+$/.test(input));

  if (isAsciiText) {
    // Convert to hex
    workingHex = stringToHex(input);
  }

  let index = 0;
  let tpdu: string | undefined = undefined;

  // Check for 5-byte TPDU (10 hex characters, often starts with 60)
  if (workingHex.startsWith('60') && workingHex.length >= 26) {
    tpdu = workingHex.slice(0, 10);
    index += 10;
  }

  // Parse MTI (either 4 ASCII chars = 8 hex chars, or 2 BCD bytes = 4 hex chars)
  // Check if next 8 hex chars convert to 4 ASCII digits:
  const next8 = workingHex.slice(index, index + 8);
  const potentialAsciiMti = hexToAscii(next8);
  let mti = '';

  if (/^\d{4}$/.test(potentialAsciiMti)) {
    mti = potentialAsciiMti;
    index += 8;
  } else if (/^\d{4}$/.test(workingHex.slice(index, index + 4))) {
    // BCD MTI (e.g. 0200 directly)
    mti = workingHex.slice(index, index + 4);
    index += 4;
  } else {
    return {
      success: false,
      fields: {},
      activeDes: [],
      warnings,
      error: `MTI introuvable à la position ${index / 2}. Valeur rencontrée : ${workingHex.slice(index, index + 8)}`,
    };
  }

  // Read Primary Bitmap (16 hex chars)
  if (index + 16 > workingHex.length) {
    return {
      success: false,
      mti,
      fields: {},
      activeDes: [],
      warnings,
      error: 'Message trop court : bitmap primaire manquante',
    };
  }

  let bitmapHex = workingHex.slice(index, index + 16);
  index += 16;

  // Check bit 1 for secondary bitmap
  const firstNibble = parseInt(bitmapHex[0], 16);
  const hasSecondary = (firstNibble & 0x8) !== 0;

  if (hasSecondary) {
    if (index + 16 > workingHex.length) {
      warnings.push('Bit 1 activé mais bitmap secondaire absente de la trame reçue.');
    } else {
      const secondaryHex = workingHex.slice(index, index + 16);
      bitmapHex += secondaryHex;
      index += 16;
    }
  }

  // Convert bitmap to binary
  let binary = '';
  for (let i = 0; i < bitmapHex.length; i++) {
    binary += parseInt(bitmapHex[i], 16).toString(2).padStart(4, '0');
  }

  const activeDes: number[] = [];
  for (let bit = 1; bit <= binary.length; bit++) {
    if (binary[bit - 1] === '1') {
      activeDes.push(bit);
    }
  }

  // Unpack fields
  const fields: Record<number, string> = {};

  for (const de of activeDes) {
    if (de === 1) continue; // Bit 1 is secondary bitmap flag

    const spec = ISO_8583_FIELDS[de] || {
      de,
      name: `Champ ${de}`,
      nameEn: `Data Element ${de}`,
      type: 'ans',
      lengthType: 'LLVAR',
      length: 99,
      category: 'other',
      description: 'Champ personnalisé',
      example: '',
    };

    if (index >= workingHex.length) {
      warnings.push(`Trame épuisée avant la lecture du champ ${de}`);
      break;
    }

    let fieldLength = 0;
    if (spec.lengthType === 'FIXED') {
      fieldLength = spec.length;
    } else {
      // Variable length header
      const headerDigits = spec.lengthType === 'LLVAR' ? 2 : spec.lengthType === 'LLLVAR' ? 3 : 4;
      const headerHexLength = headerDigits * 2; // in ASCII hex

      if (index + headerHexLength > workingHex.length) {
        warnings.push(`En-tête de longueur incomplet pour le champ ${de}`);
        break;
      }

      const headerAscii = hexToAscii(workingHex.slice(index, index + headerHexLength));
      fieldLength = parseInt(headerAscii, 10);
      if (isNaN(fieldLength)) {
        // Try fallback to direct hex digits
        fieldLength = parseInt(workingHex.slice(index, index + headerDigits), 10);
        index += headerDigits;
      } else {
        index += headerHexLength;
      }
    }

    // Read field content
    if (spec.type === 'b') {
      // binary field (e.g. DE 55 ICC TLV or DE 52 PIN block)
      const hexCharsNeeded = fieldLength * 2;
      const valHex = workingHex.slice(index, index + hexCharsNeeded);
      fields[de] = valHex;
      index += hexCharsNeeded;
    } else {
      // string field
      const hexCharsNeeded = fieldLength * 2;
      const valHex = workingHex.slice(index, index + hexCharsNeeded);
      fields[de] = hexToAscii(valHex);
      index += hexCharsNeeded;
    }
  }

  return {
    success: true,
    tpdu,
    mti,
    bitmapHex,
    fields,
    activeDes: activeDes.filter((de) => de !== 1),
    warnings,
  };
}
