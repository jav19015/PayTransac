/**
 * ISO 8583 Protocol Types and Data Contracts
 * Supports ISO 8583:1987, 1993 and 2003 formats
 */

export type DataType = 'n' | 'a' | 'an' | 'ans' | 'b' | 'z';
export type LengthType = 'FIXED' | 'LLVAR' | 'LLLVAR' | 'LLLLVAR';
export type FieldCategory =
  | 'identification'
  | 'financial'
  | 'trace'
  | 'pos'
  | 'card'
  | 'terminal'
  | 'security'
  | 'emv'
  | 'private'
  | 'reversal'
  | 'other';

export interface FieldDefinition {
  de: number;
  name: string;
  nameEn: string;
  type: DataType;
  lengthType: LengthType;
  length: number; // exact length if FIXED, max length if variable
  category: FieldCategory;
  description: string;
  example: string;
  isMandatoryIn?: string[]; // MTI codes where this DE is typically required
}

export interface TLVTag {
  id: string; // unique ID for React keys
  tag: string; // e.g. "9F26", "82", "5F2A"
  name: string;
  length: number; // length in bytes
  value: string; // hex representation
  description: string;
  format?: 'b' | 'n' | 'ans' | 'a';
}

export type TransactionPresetId =
  // 1. Demande d'autorisation Paiement (0100)
  | 'auth_contact'
  | 'auth_contactless'
  | 'auth_magstripe'
  | 'auth_manual'
  // 2. Demande d'autorisation Vente à distance
  | 'auth_vad_standard'
  | 'auth_vad_secured'
  // 3. Demande de Préautorisation
  | 'preauth'
  // 4. Demande de Redressement/Annulation
  | 'reversal'
  // 5. Télécollecte
  | 'settlement'
  // 6. Demande financière de paiement (0200)
  | 'fin_contact'
  | 'fin_contactless'
  | 'fin_magstripe'
  | 'fin_manual'
  // 7. Test Réseau
  | 'network'
  // 8. Retrait
  | 'withdrawal_dab'
  | 'withdrawal_gab'
  // 9. Retrait DAB/GAB (0100)
  | 'auth_withdrawal_dab'
  | 'auth_withdrawal_gab'
  // Compatibility aliases
  | 'contact'
  | 'contactless'
  | 'magstripe'
  | 'vad';

export interface TransactionPreset {
  id: TransactionPresetId;
  name: string;
  typologyGroup: string;
  badge: string;
  description: string;
  iconName: string;
  mti: string;
  tpdu?: string;
  fields: Record<number, string>;
  tlvList?: TLVTag[];
}

export interface TransactionTypologyGroup {
  groupName: string;
  mti: string;
  presets: TransactionPreset[];
}

export interface BitmapState {
  binary: string; // 64 or 128 characters of '0' | '1'
  hex: string; // 16 or 32 hex chars
  primaryHex: string;
  secondaryHex: string | null;
  activeBits: number[];
  hasSecondary: boolean;
}

export interface ValidationError {
  id: string;
  field?: number;
  severity: 'error' | 'warning';
  message: string;
  rule: string;
  detail?: string;
}

export interface PackedField {
  de: number;
  name: string;
  type: DataType;
  lengthType: LengthType;
  declaredLength: number;
  rawHeader: string;
  value: string;
  hexValue: string;
  offset: number;
  byteLength: number;
}

export interface PackedMessage {
  tpdu: string;
  mti: string;
  bitmapHex: string;
  bitmapBinary: string;
  packedFields: PackedField[];
  rawAscii: string;
  rawHex: string;
  totalBytes: number;
  hexDumpLines: {
    offset: string;
    hex: string;
    ascii: string;
  }[];
}

export interface SwitchResponse {
  mti: string;
  responseCode: string; // DE 39 e.g. "00"
  responseDescription: string;
  authCode?: string; // DE 38
  arpc?: string; // EMV Cryptogram Response tag 91
  fields: Record<number, string>;
  rawHex: string;
  latencyMs: number;
  timestamp: string;
}
