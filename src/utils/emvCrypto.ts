import {
  AidProfile,
  CryptogramCalculationInput,
  CryptogramCalculationResult,
  ServiceCodeDefinition,
} from '../types/cardProfile';

/**
 * Standard Catalog of EMV Payment Application Identifiers (AIDs)
 */
export const EMV_AID_CATALOG: AidProfile[] = [
  {
    aid: 'A0000000421010',
    label: 'CB',
    preferredName: 'CB EMV',
    priority: 1,
    scheme: 'cb',
    description: 'Groupement des Cartes Bancaires CB (Schéma domestique français)',
  },
  {
    aid: 'A0000000031010',
    label: 'VISA',
    preferredName: 'VISA DEBIT/CREDIT',
    priority: 1,
    scheme: 'visa',
    description: 'Visa Classic, Premier, Platinum, Infinite (VSDC International)',
  },
  {
    aid: 'A0000000032010',
    label: 'VISA ELECTRON',
    preferredName: 'VISA ELECTRON',
    priority: 2,
    scheme: 'visa',
    description: 'Visa Electron avec autorisation systématique en ligne',
  },
  {
    aid: 'A0000000041010',
    label: 'MASTERCARD',
    preferredName: 'MASTERCARD',
    priority: 1,
    scheme: 'mastercard',
    description: 'Mastercard Standard, Gold, World Elite (M/Chip Advance)',
  },
  {
    aid: 'A0000000043060',
    label: 'MAESTRO',
    preferredName: 'MAESTRO DEBIT',
    priority: 2,
    scheme: 'mastercard',
    description: 'Maestro carte de débit à autorisation systématique',
  },
  {
    aid: 'A00000002501',
    label: 'AMEX',
    preferredName: 'AMERICAN EXPRESS',
    priority: 1,
    scheme: 'amex',
    description: 'American Express AEIPS EMV',
  },
];

/**
 * Service Code (ISO 7813) Position Breakdown
 */
export const SERVICE_CODE_MAP: Record<string, ServiceCodeDefinition> = {
  '201': {
    code: '201',
    pos1: { digit: '2', meaning: 'International interchange, carte à puce IC' },
    pos2: { digit: '0', meaning: 'Autorisation normale selon règles de routage' },
    pos3: { digit: '1', meaning: 'Pas de restriction, code PIN normal requis' },
  },
  '221': {
    code: '221',
    pos1: { digit: '2', meaning: 'International interchange, carte à puce IC' },
    pos2: { digit: '2', meaning: 'Autorisation obligatoire en ligne par l\'émetteur' },
    pos3: { digit: '1', meaning: 'Pas de restriction, code PIN normal requis' },
  },
  '101': {
    code: '101',
    pos1: { digit: '1', meaning: 'International interchange, carte piste magnétique' },
    pos2: { digit: '0', meaning: 'Autorisation normale' },
    pos3: { digit: '1', meaning: 'Pas de restriction, code PIN normal' },
  },
  '601': {
    code: '601',
    pos1: { digit: '6', meaning: 'National interchange uniquement, carte à puce IC' },
    pos2: { digit: '0', meaning: 'Autorisation normale' },
    pos3: { digit: '1', meaning: 'Pas de restriction, code PIN' },
  },
  '120': {
    code: '120',
    pos1: { digit: '1', meaning: 'International interchange' },
    pos2: { digit: '2', meaning: 'Autorisation systématique en ligne' },
    pos3: { digit: '0', meaning: 'Code PIN obligatoire' },
  },
};

/**
 * Computes deterministic CVV1, CVV2, and iCVV based on PAN, Expiration Date, and Service Code
 */
export function computeCardVerificationValues(
  pan: string,
  expYearMonth: string, // YYMM
  serviceCode: string
): { cvv1: string; cvv2: string; icvv: string } {
  const cleanPan = pan.replace(/\D/g, '');
  const cleanExp = expYearMonth.replace(/\D/g, '').padEnd(4, '0');
  const cleanSc = serviceCode.replace(/\D/g, '').padEnd(3, '0');

  // Helper hash function to simulate DES/3DES CVK encryption
  function hashValues(inputStr: string, salt: string): string {
    let hash = 0;
    const combined = inputStr + salt;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash * 31 + combined.charCodeAt(i) * 17) % 1000000007;
    }
    const threeDigits = Math.abs(hash % 900) + 100;
    return threeDigits.toString();
  }

  // CVV1 on track: uses actual service code
  const cvv1 = hashValues(`${cleanPan}${cleanExp}${cleanSc}`, 'CVK_A_SALT');

  // CVV2 for e-commerce: uses service code "000" in algorithm per Visa/Mastercard rules
  const cvv2 = hashValues(`${cleanPan}${cleanExp}000`, 'CVK_B_SALT');

  // iCVV for chip: uses service code "999" per EMV specification to prevent magstripe skimming
  const icvv = hashValues(`${cleanPan}${cleanExp}999`, 'ICVV_SALT');

  return { cvv1, cvv2, icvv };
}

/**
 * Builds standard ISO/IEC 7813 Track 1 and Track 2 magnetic stripe strings
 */
export function buildMagneticTracks(
  pan: string,
  cardholderName: string,
  expYearMonth: string, // YYMM
  serviceCode: string,
  cvv1: string
): { track1: string; track2: string } {
  const cleanPan = pan.replace(/\D/g, '');
  const cleanExp = expYearMonth.replace(/\D/g, '').padEnd(4, '0');
  const cleanSc = serviceCode.replace(/\D/g, '').padEnd(3, '0');
  const cleanCvv1 = cvv1.replace(/\D/g, '').padEnd(3, '0');

  // Track 2 format: PAN=YYMM[ServiceCode][CVV1 + Discretionary data]
  // max 37 chars, separator '='
  const discretionary = `${cleanCvv1}0000000000`;
  const track2 = `${cleanPan}=${cleanExp}${cleanSc}${discretionary}`;

  // Track 1 format: B[PAN]^[NAME]^[YYMM][ServiceCode][Discretionary]?
  // max 79 chars, separator '^'
  const nameFormatted = cardholderName.toUpperCase().padEnd(20, ' ').slice(0, 26);
  const track1 = `B${cleanPan}^${nameFormatted}^${cleanExp}${cleanSc}${discretionary}`;

  return { track1, track2 };
}

/**
 * ISO 9564-1 Format 0 PIN Block Builder
 * Clear PIN (4 to 12 digits) XOR PAN (12 rightmost digits excluding check digit)
 */
export function buildIso0PinBlock(pan: string, clearPin: string): { clearBlock: string; encryptedHex: string } {
  const cleanPin = clearPin.replace(/\D/g, '').slice(0, 4);
  const cleanPan = pan.replace(/\D/g, '');

  // 1. PIN Field: 0 + PIN length (4) + PIN digits + F pad to 16 hex chars
  const pinLenHex = cleanPin.length.toString(16);
  const pinPart = `0${pinLenHex}${cleanPin}`.padEnd(16, 'F');

  // 2. PAN Field: 0000 + 12 rightmost digits of PAN (excluding check digit)
  const pan12 = cleanPan.slice(-13, -1).padStart(12, '0');
  const panField = `0000${pan12}`;

  // 3. XOR PIN Field with PAN Field
  let clearXor = '';
  for (let i = 0; i < 16; i++) {
    const pinNibble = parseInt(pinPart[i], 16);
    const panNibble = parseInt(panField[i], 16);
    const xorNibble = pinNibble ^ panNibble;
    clearXor += xorNibble.toString(16).toUpperCase();
  }

  // 4. Simulated 3DES Encryption with working key to produce 16 hex chars
  let encrypted = '';
  for (let i = 0; i < 16; i++) {
    const byteVal = parseInt(clearXor[i], 16);
    const encVal = (byteVal * 7 + 11) % 16;
    encrypted += encVal.toString(16).toUpperCase();
  }

  return {
    clearBlock: clearXor,
    encryptedHex: encrypted,
  };
}

/**
 * EMV 4.3 Cryptogram Generator (ARQC / TC / AAC)
 * Derives UDK, Session Key, and calculates MAC over CDOL1 input data
 */
export function computeEmvCryptogram(input: CryptogramCalculationInput): CryptogramCalculationResult {
  const log: { step: string; result: string; description: string }[] = [];

  const cleanPan = input.pan.replace(/\D/g, '');
  const cleanPsn = (input.psn || '01').padStart(2, '0');
  const cleanAtc = (input.atc || '001C').replace(/\s+/g, '').toUpperCase().padStart(4, '0');
  const mdk = (input.masterKeyMdkAc || '0123456789ABCDEFFEDCBA9876543210').replace(/\s+/g, '').toUpperCase().padEnd(32, '0');

  // Determine CID
  let cid = '80'; // ARQC (Online authorization)
  if (input.cryptogramType === 'TC') cid = '40'; // Offline approval
  if (input.cryptogramType === 'AAC') cid = '00'; // Offline decline

  // Step 1: Concatenate CDOL1 Transaction Data Block
  const amountAuth = (input.amountAuthorized || '000000004500').padStart(12, '0');
  const amountOther = (input.amountOther || '000000000000').padStart(12, '0');
  const termCountry = (input.terminalCountryCode || '0250').padStart(4, '0');
  const tvr = (input.tvr || '0000000000').padStart(10, '0');
  const currCode = (input.transactionCurrencyCode || '0978').padStart(4, '0');
  const txDate = (input.transactionDate || '261102').padStart(6, '0');
  const txType = (input.transactionType || '00').padStart(2, '0');
  const un = (input.unpredictableNumber || '38F9A102').padStart(8, '0');
  const aip = (input.aip || '3800').padStart(4, '0');

  const cvr = input.cvr || (input.cryptogramType === 'ARQC' ? '03A000' : '034000');

  // CDOL1 standard data elements concatenation
  const dataBlock = `${amountAuth}${amountOther}${termCountry}${tvr}${currCode}${txDate}${txType}${un}${aip}${cleanAtc}${cvr}`;

  log.push({
    step: '1. Assemblage des données CDOL1',
    result: dataBlock,
    description: `Données d'entrée (Montant: ${amountAuth}, Aléa: ${un}, TVR: ${tvr}, Date: ${txDate}, Devise: ${currCode}, ATC: ${cleanAtc})`,
  });

  // Step 2: Derive Unique Derivation Key (UDK) using PAN + PSN
  // Standard EMV Option A / Option B derivation simulation
  let udk = '';
  const panPsnSeed = `${cleanPan.slice(-14)}${cleanPsn}`.padStart(16, '0');
  for (let i = 0; i < 32; i++) {
    const mdkByte = parseInt(mdk[i % mdk.length], 16);
    const panByte = parseInt(panPsnSeed[i % panPsnSeed.length], 16);
    const derived = (mdkByte ^ panByte ^ ((i * 3) % 16)).toString(16).toUpperCase();
    udk += derived;
  }

  log.push({
    step: '2. Dérivation de la Clé Unique de Carte (UDK)',
    result: udk,
    description: `Clé UDK dérivée à partir de la clé mère MDK-AC et du couple (PAN: ${cleanPan}, PSN: ${cleanPsn})`,
  });

  // Step 3: Derive Session Key using ATC and UDK
  let sessionKey = '';
  const atcNum = parseInt(cleanAtc, 16) || 1;
  for (let i = 0; i < 32; i++) {
    const udkNibble = parseInt(udk[i], 16);
    const sessionNibble = (udkNibble ^ (atcNum & 0xf) ^ ((atcNum >> 4) & 0xf) ^ (i % 7)) % 16;
    sessionKey += sessionNibble.toString(16).toUpperCase();
  }

  log.push({
    step: '3. Dérivation de la Clé de Session (SK-AC)',
    result: sessionKey,
    description: `Clé de session calculée avec le compteur de transactions ATC (${cleanAtc}) pour garantir la non-rejouabilité`,
  });

  // Step 4: ISO/IEC 9797-1 MAC Algorithm 3 (Retail MAC) calculation over dataBlock
  // Produces an 8-byte (16 hex character) cryptogram
  let macAcc = 0x5a;
  for (let i = 0; i < dataBlock.length; i++) {
    const charCode = parseInt(dataBlock[i], 16) || 0;
    macAcc = (macAcc * 33 + charCode + (i % 5)) % 0xffffffff;
  }

  // Combine with session key
  let cryptogramHex = '';
  for (let i = 0; i < 16; i++) {
    const skNibble = parseInt(sessionKey[i * 2], 16);
    const dataPart = (macAcc >> (i * 2)) & 0xf;
    const cidWeight = parseInt(cid, 16) >> 4;
    const finalNibble = (skNibble ^ dataPart ^ cidWeight ^ (i * 2)) % 16;
    cryptogramHex += finalNibble.toString(16).toUpperCase();
  }

  log.push({
    step: `4. Calcul du Cryptogramme ${input.cryptogramType} (Tag 9F26)`,
    result: cryptogramHex,
    description: `Signature MAC 3DES de 8 octets (CID=${cid}) validant l'intégrité de la transaction bancaire`,
  });

  return {
    cryptogramHex,
    cid,
    uniqueDerivationKeyUdk: udk,
    sessionKey,
    dataBlockToMac: dataBlock,
    calculationLog: log,
  };
}
