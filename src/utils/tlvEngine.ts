import { TLVTag } from '../types/iso8583';
import { EMV_TAG_CATALOG } from './iso8583Spec';

/**
 * Calculates BER-TLV length octets according to EMV / ISO 7816-4 rules
 */
export function encodeTlvLength(byteLength: number): string {
  if (byteLength < 0x80) {
    // Single byte length (0 to 127)
    return byteLength.toString(16).padStart(2, '0').toUpperCase();
  } else if (byteLength <= 0xff) {
    // Two-byte length format: 81 XX
    return '81' + byteLength.toString(16).padStart(2, '0').toUpperCase();
  } else {
    // Three-byte length format: 82 XX XX
    return '82' + byteLength.toString(16).padStart(4, '0').toUpperCase();
  }
}

/**
 * Encodes an array of TLVTag items into a unified BER-TLV hex stream
 */
export function encodeTlvStream(tlvList: TLVTag[]): string {
  let stream = '';

  for (const item of tlvList) {
    const cleanTag = item.tag.replace(/\s+/g, '').toUpperCase();
    const cleanVal = item.value.replace(/\s+/g, '').toUpperCase();
    if (!cleanTag || !cleanVal) continue;

    const byteLen = Math.ceil(cleanVal.length / 2);
    const lenHex = encodeTlvLength(byteLen);
    const paddedVal = cleanVal.length % 2 !== 0 ? cleanVal + '0' : cleanVal;

    stream += cleanTag + lenHex + paddedVal;
  }

  return stream;
}

/**
 * Parses a raw BER-TLV hex string into structured TLVTag objects
 */
export function decodeTlvStream(hexStr: string): {
  tags: TLVTag[];
  error?: string;
  bytesParsed: number;
} {
  const clean = hexStr.replace(/\s+/g, '').toUpperCase();
  if (!clean) {
    return { tags: [], bytesParsed: 0 };
  }

  if (!/^[0-9A-F]+$/.test(clean)) {
    return { tags: [], error: 'Caractères hexadécimaux invalides', bytesParsed: 0 };
  }

  const tags: TLVTag[] = [];
  let index = 0;
  let counter = 1;

  while (index < clean.length) {
    // 1. Parse Tag
    if (index + 2 > clean.length) {
      break;
    }

    const firstByteHex = clean.slice(index, index + 2);
    const firstByte = parseInt(firstByteHex, 16);
    let tag = firstByteHex;
    index += 2;

    // Check if tag is multi-byte (lower 5 bits of first byte == 0x1F)
    if ((firstByte & 0x1f) === 0x1f) {
      // Subsequent bytes have bit 8 set to 1 if more bytes follow
      while (index + 2 <= clean.length) {
        const nextByteHex = clean.slice(index, index + 2);
        const nextByte = parseInt(nextByteHex, 16);
        tag += nextByteHex;
        index += 2;
        if ((nextByte & 0x80) === 0) {
          // Last byte of tag
          break;
        }
      }
    }

    // 2. Parse Length
    if (index + 2 > clean.length) {
      return { tags, error: `Fin inattendue lors de la lecture de la longueur du tag ${tag}`, bytesParsed: index / 2 };
    }

    const lenFirstByteHex = clean.slice(index, index + 2);
    const lenFirstByte = parseInt(lenFirstByteHex, 16);
    index += 2;

    let valueByteLength = 0;
    if (lenFirstByte < 0x80) {
      valueByteLength = lenFirstByte;
    } else if (lenFirstByte === 0x81) {
      if (index + 2 > clean.length) {
        return { tags, error: `Longueur incomplète pour le tag ${tag}`, bytesParsed: index / 2 };
      }
      valueByteLength = parseInt(clean.slice(index, index + 2), 16);
      index += 2;
    } else if (lenFirstByte === 0x82) {
      if (index + 4 > clean.length) {
        return { tags, error: `Longueur incomplète pour le tag ${tag}`, bytesParsed: index / 2 };
      }
      valueByteLength = parseInt(clean.slice(index, index + 4), 16);
      index += 4;
    } else {
      return { tags, error: `Format de longueur non supporté (0x${lenFirstByteHex}) pour le tag ${tag}`, bytesParsed: index / 2 };
    }

    // 3. Parse Value
    const valueCharLength = valueByteLength * 2;
    if (index + valueCharLength > clean.length) {
      const actualRemaining = clean.length - index;
      const partialValue = clean.slice(index);
      const catalogEntry = EMV_TAG_CATALOG.find((t) => t.tag.toUpperCase() === tag.toUpperCase());
      tags.push({
        id: `tlv-${counter++}`,
        tag,
        name: catalogEntry ? catalogEntry.name : `Tag Inconnu (0x${tag})`,
        length: valueByteLength,
        value: partialValue,
        description: catalogEntry ? catalogEntry.description : 'Tag non répertorié dans le catalogue standard.',
        format: catalogEntry?.format,
      });
      return {
        tags,
        error: `Données tronquées pour le tag ${tag} (attendu ${valueByteLength} octets, disponible ${actualRemaining / 2} octets)`,
        bytesParsed: clean.length / 2,
      };
    }

    const value = clean.slice(index, index + valueCharLength);
    index += valueCharLength;

    const catalogEntry = EMV_TAG_CATALOG.find((t) => t.tag.toUpperCase() === tag.toUpperCase());
    tags.push({
      id: `tlv-${counter++}`,
      tag,
      name: catalogEntry ? catalogEntry.name : `Tag Spécifique (0x${tag})`,
      length: valueByteLength,
      value,
      description: catalogEntry ? catalogEntry.description : 'Tag propriétaire ou spécifique à la passerelle.',
      format: catalogEntry?.format,
    });
  }

  return {
    tags,
    bytesParsed: index / 2,
  };
}
