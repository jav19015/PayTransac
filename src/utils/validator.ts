import { ValidationError } from '../types/iso8583';
import { ISO_8583_FIELDS } from './iso8583Spec';
import { decodeTlvStream } from './tlvEngine';

/**
 * Validates entire ISO 8583 message structure before transmission
 */
export function validateIso8583Message(
  mti: string,
  fields: Record<number, string>,
  tpdu: string = ''
): {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  stats: {
    totalFields: number;
    mandatoryFieldsCount: number;
    primaryCount: number;
    secondaryCount: number;
  };
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Active fields
  const activeDes = Object.keys(fields)
    .map(Number)
    .filter((de) => de >= 2 && de <= 128 && fields[de] !== undefined && fields[de].trim() !== '')
    .sort((a, b) => a - b);

  // 1. MTI Check
  const cleanMti = mti.trim();
  if (!cleanMti) {
    errors.push({
      id: 'mti-missing',
      severity: 'error',
      message: 'Le code MTI (Message Type Identifier) est obligatoire.',
      rule: 'MTI-01',
      detail: 'Exemples courants : 0200 (Paiement financier), 0100 (Autorisation), 0400 (Redressement), 0800 (Réseau).',
    });
  } else if (!/^\d{4}$/.test(cleanMti)) {
    errors.push({
      id: 'mti-format',
      severity: 'error',
      message: `Format MTI invalide : "${cleanMti}". Doit comporter exactement 4 chiffres décimaux.`,
      rule: 'MTI-02',
    });
  }

  // 2. TPDU Check (if supplied)
  if (tpdu) {
    const cleanTpdu = tpdu.replace(/\s+/g, '');
    if (!/^[0-9A-Fa-f]{10}$/.test(cleanTpdu)) {
      warnings.push({
        id: 'tpdu-format',
        severity: 'warning',
        message: `L'en-tête TPDU "${tpdu}" n'est pas standard (habituellement 5 octets / 10 caractères hexadécimaux, ex: 6000010000).`,
        rule: 'TPDU-01',
      });
    }
  }

  // 3. Mandatory Fields for specific MTIs
  const mandatoryForMti: Record<string, number[]> = {
    '0200': [3, 4, 7, 11, 22, 25, 41, 42, 49],
    '0100': [3, 4, 7, 11, 22, 25, 41, 42, 49],
    '0400': [3, 4, 7, 11, 41, 42, 49, 90],
    '0800': [7, 11, 70],
    '0500': [3, 7, 11, 41, 49],
  };

  const requiredDes = mandatoryForMti[cleanMti] || [];
  for (const reqDe of requiredDes) {
    const val = fields[reqDe];
    if (!val || val.trim() === '') {
      const spec = ISO_8583_FIELDS[reqDe];
      errors.push({
        id: `mandatory-de-${reqDe}`,
        field: reqDe,
        severity: 'error',
        message: `Champ obligatoire manquant : DE ${reqDe} (${spec?.name || 'Inconnu'}). Requis pour le MTI ${cleanMti}.`,
        rule: 'REQ-FIELD',
        detail: `Exemple attendu : "${spec?.example || ''}". Description : ${spec?.description || ''}`,
      });
    }
  }

  // 4. POS Entry Mode & Dependent checks
  const posEntry = fields[22]?.trim();
  if (posEntry) {
    if (posEntry === '051') {
      // Contact EMV chip
      if (!fields[55] || fields[55].trim() === '') {
        warnings.push({
          id: 'pos-chip-missing-55',
          field: 55,
          severity: 'warning',
          message: 'Mode de saisie 051 (Contact EMV) configuré, mais le champ 55 (Données ICC / Puce) est vide.',
          rule: 'EMV-01',
          detail: 'Une transaction puce doit transmettre au minimum les tags 9F26 (ARQC) et 9F27 (CID).',
        });
      }
    } else if (posEntry === '071') {
      // Contactless NFC
      if (!fields[55] || fields[55].trim() === '') {
        warnings.push({
          id: 'pos-nfc-missing-55',
          field: 55,
          severity: 'warning',
          message: 'Mode de saisie 071 (Sans Contact NFC) sélectionné sans données ICC dans le champ 55.',
          rule: 'NFC-01',
          detail: 'Ajoutez les tags EMV Contactless dont le tag 9F66 (TTQ) et 9F26 (Cryptogramme).',
        });
      }
    } else if (posEntry === '021') {
      // Magstripe
      if (!fields[35] && !fields[2]) {
        warnings.push({
          id: 'pos-mag-missing-track',
          field: 35,
          severity: 'warning',
          message: 'Paiement piste magnétique (021) sans champ 35 (Données Piste 2) ni champ 2 (PAN).',
          rule: 'MAG-01',
        });
      }
    }
  }

  // 5. Individual Field Validation (Type and Length)
  for (const de of activeDes) {
    const val = fields[de];
    const spec = ISO_8583_FIELDS[de];
    if (!spec) continue;

    // Check Data Type
    if (spec.type === 'n') {
      if (!/^\d+$/.test(val)) {
        errors.push({
          id: `type-n-${de}`,
          field: de,
          severity: 'error',
          message: `DE ${de} (${spec.name}) : contient des caractères non numériques "${val}".`,
          rule: 'TYPE-NUMERIC',
          detail: `Type attendu : 'n' (chiffres uniquement 0-9).`,
        });
      }
    } else if (spec.type === 'b') {
      const cleanHex = val.replace(/\s+/g, '');
      if (!/^[0-9A-Fa-f]+$/.test(cleanHex)) {
        errors.push({
          id: `type-b-${de}`,
          field: de,
          severity: 'error',
          message: `DE ${de} (${spec.name}) : format binaire/hexadécimal invalide.`,
          rule: 'TYPE-BINARY',
          detail: `Contient des caractères non autorisés en hexadécimal.`,
        });
      } else if (cleanHex.length % 2 !== 0) {
        errors.push({
          id: `type-b-odd-${de}`,
          field: de,
          severity: 'error',
          message: `DE ${de} (${spec.name}) : nombre impair de chiffres hexadécimaux (${cleanHex.length}).`,
          rule: 'TYPE-BINARY-ALIGN',
          detail: 'Chaque octet binaire est constitué de 2 caractères hexadécimaux.',
        });
      }
    }

    // Check Length
    if (spec.lengthType === 'FIXED') {
      let actualLen = val.length;
      if (spec.type === 'b') {
        actualLen = Math.ceil(val.replace(/\s+/g, '').length / 2);
      }
      if (actualLen !== spec.length) {
        errors.push({
          id: `len-fixed-${de}`,
          field: de,
          severity: 'error',
          message: `DE ${de} (${spec.name}) : longueur fixe non respectée (actuel : ${actualLen}, requis : ${spec.length}).`,
          rule: 'LEN-FIXED',
          detail: spec.type === 'n' ? `Complétez avec des zéros à gauche (ex: ${spec.example}).` : `Longueur exacte requise.`,
        });
      }
    } else {
      // Variable LLVAR / LLLVAR / LLLLVAR
      const maxLen = spec.length;
      let actualLen = val.length;
      if (spec.type === 'b') {
        actualLen = Math.ceil(val.replace(/\s+/g, '').length / 2);
      }
      if (actualLen > maxLen) {
        errors.push({
          id: `len-max-${de}`,
          field: de,
          severity: 'error',
          message: `DE ${de} (${spec.name}) : dépasse la longueur maximale permise (${actualLen} > ${maxLen}).`,
          rule: 'LEN-MAX',
        });
      }
    }

    // Check DE 55 BER-TLV Structure if populated
    if (de === 55 && val.trim() !== '') {
      const tlvResult = decodeTlvStream(val);
      if (tlvResult.error) {
        errors.push({
          id: 'tlv-structure-error',
          field: 55,
          severity: 'error',
          message: `DE 55 : Structure TLV invalide - ${tlvResult.error}`,
          rule: 'TLV-CORRUPT',
          detail: 'Vérifiez les tags et longueurs définis dans l\'éditeur TLV.',
        });
      } else if (tlvResult.tags.length === 0) {
        warnings.push({
          id: 'tlv-empty-parsed',
          field: 55,
          severity: 'warning',
          message: 'DE 55 : Aucun tag BER-TLV détecté dans la valeur hexadécimale fournie.',
          rule: 'TLV-EMPTY',
        });
      } else {
        // Check for cryptogram presence (9F26)
        const hasArqc = tlvResult.tags.some((t) => t.tag.toUpperCase() === '9F26');
        if (!hasArqc && (posEntry === '051' || posEntry === '071')) {
          warnings.push({
            id: 'tlv-missing-arqc',
            field: 55,
            severity: 'warning',
            message: 'Tag 9F26 (Application Cryptogram ARQC) absent des données ICC du champ 55.',
            rule: 'TLV-ARQC-RECOMMENDED',
          });
        }
      }
    }

    // Check DE 90 for Reversals (0400 / 0420)
    if (de === 90) {
      if (val.length !== 42) {
        errors.push({
          id: 'de-90-length',
          field: 90,
          severity: 'error',
          message: `DE 90 : Longueur requise de 42 chiffres (actuel : ${val.length} chiffres).`,
          rule: 'REVERSAL-DE90',
          detail: 'Structure : MTI original (4) + STAN original (6) + Date originale (10) + Acquéreur original (11) + Émetteur original (11).',
        });
      }
    }
  }

  // Statistics
  const primaryCount = activeDes.filter((de) => de <= 64).length;
  const secondaryCount = activeDes.filter((de) => de > 64).length;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalFields: activeDes.length,
      mandatoryFieldsCount: requiredDes.length,
      primaryCount,
      secondaryCount,
    },
  };
}
