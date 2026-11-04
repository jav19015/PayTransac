/**
 * Card Personalization & EMV Chip Cryptography Types
 */

export type CardScheme = 'cb' | 'visa' | 'mastercard' | 'amex';
export type CardType = 'debit' | 'credit' | 'deferred_debit' | 'prepaid' | 'commercial';
export type ProductTier = 'classic' | 'premium' | 'super_premium' | 'systematic' | 'business';

export interface CardLimits {
  paymentMonthlyLimit: number; // e.g. 8000 EUR
  atmWeeklyLimit: number; // e.g. 1500 EUR
  contactlessPerTxLimit: number; // e.g. 50 EUR
  contactlessCumulativeLimit: number; // e.g. 150 EUR
  offlineFloorLimit: number; // e.g. 500 EUR or 0 EUR for systematic online
}

export interface CardProductDefinition {
  id: string; // e.g. 'mc_gold', 'visa_electron', 'cb_visa_premier'
  name: string; // e.g. "Mastercard Gold", "Visa Electron"
  subtitle: string;
  scheme: CardScheme;
  cardType: CardType;
  tier: ProductTier;
  defaultBin: string; // e.g. "535522"
  defaultAid: string; // e.g. "A0000000041010"
  serviceCode: string; // e.g. "201" or "221"
  limits: CardLimits;
  authorizationMode: 'systematic_online' | 'standard_hybrid' | 'high_offline_floor';
  authorizationDescription: string;
  services: string[]; // e.g. ["Assistance Médicale Rapatriement", "Garantie Véhicule de Location"]
  badgeText: string; // "GOLD", "PREMIER", "ELECTRON", "INFINITE"
  gradient: string;
  description: string;
}

export interface AidProfile {
  aid: string; // e.g. "A0000000421010"
  label: string; // e.g. "CB"
  preferredName: string; // e.g. "CB VISA DEBIT"
  priority: number; // e.g. 1
  scheme: CardScheme;
  description: string;
}

export interface ServiceCodeDefinition {
  code: string; // 3 digits, e.g. "201"
  pos1: {
    digit: string;
    meaning: string;
  };
  pos2: {
    digit: string;
    meaning: string;
  };
  pos3: {
    digit: string;
    meaning: string;
  };
}

export interface CryptogramCalculationInput {
  cryptogramType: 'ARQC' | 'TC' | 'AAC';
  pan: string;
  psn: string; // 2 digits (e.g. "01")
  atc: string; // 4 hex (e.g. "002C")
  unpredictableNumber: string; // 8 hex (e.g. "38F9A102")
  amountAuthorized: string; // 12 digits (e.g. "000000004500")
  amountOther: string; // 12 digits (e.g. "000000000000")
  terminalCountryCode: string; // 4 hex (e.g. "0250")
  transactionCurrencyCode: string; // 4 hex (e.g. "0978")
  transactionDate: string; // 6 digits YYMMDD (e.g. "261102")
  transactionType: string; // 2 digits (e.g. "00")
  tvr: string; // 10 hex (e.g. "0000000000")
  aip: string; // 4 hex (e.g. "3800")
  cvr?: string; // Card Verification Results, e.g. "03A000"
  masterKeyMdkAc: string; // 32 hex chars (16 bytes)
}

export interface CryptogramCalculationResult {
  cryptogramHex: string; // 16 hex chars (8 bytes)
  cid: string; // 80 for ARQC, 40 for TC, 00 for AAC
  uniqueDerivationKeyUdk: string; // 32 hex chars
  sessionKey: string; // 32 hex chars
  dataBlockToMac: string; // Concatenated hex
  calculationLog: { step: string; result: string; description: string }[];
}

export interface CardProfile {
  scheme: CardScheme;
  cardType: CardType;
  cardholderName: string;
  pan: string;
  psn: string; // PAN Sequence Number e.g. "01"
  expirationMonth: string; // "01" - "12"
  expirationYear: string; // "26" - "35"
  serviceCode: string; // "201"
  cvv1: string; // 3 digits
  cvv2: string; // 3 digits
  icvv: string; // 3 digits
  clearPin: string; // 4 digits e.g. "1234"
  pinBlockIso0: string; // 16 hex chars
  selectedAid: AidProfile;
  aip: string; // 4 hex chars e.g. "3800"
  atc: string; // 4 hex chars e.g. "001F"
  mdkAc: string; // Master Key 32 hex
  track1: string;
  track2: string;
  product?: CardProductDefinition;
  limits: CardLimits;
}
