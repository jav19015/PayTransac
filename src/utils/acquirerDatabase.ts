export interface MerchantTerminalEntity {
  id: string;
  tid: string; // DE 41 - e.g. "DAB-OPERA-01" or "TPE-FNAC-01"
  mid: string; // DE 42 - e.g. "MERCH-BNK-0012"
  merchantName: string; // DE 43 - e.g. "DAB GUICHET OPERA PARIS"
  type: 'ATM' | 'POS' | 'ECOM';
  atmSubtype?: 'DAB' | 'GAB';
  mcc: string; // DE 18 - e.g. "6011" (Distributeurs), "5411" (Alimentation), "5732" (Electronique)
  locationCity: string;
  countryCode: string; // "250" (France)
  currencyCode: string; // "978" (EUR)
  status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
  dailyLimit: number; // e.g. 50000.00 EUR
  spentToday: number;
  maxSingleTx: number; // e.g. 800.00 EUR
  feePercent: number; // e.g. 0.75 %
  feeFixed: number; // e.g. 0.05 EUR
  defaultRouting: 'DIRECT_SAE' | 'SWITCH_VISA_MC' | 'STAND_IN_STIP';
  totalTransactionsCount: number;
  totalVolumeProcessed: number;
  lastPing: string;
}

export interface ControlCheckResult {
  step: string;
  name: string;
  passed: boolean;
  message: string;
  responseCode?: string; // e.g. "00", "03", "58", "61"
}

export interface AcquirerTransactionEntity {
  id: string;
  rrn: string; // DE 37 (12 chars)
  stan: string; // DE 11 (6 chars)
  mti: string; // "0100", "0200", "0400", "0500"
  responseMti: string; // "0110", "0210", etc.
  tid: string; // DE 41
  mid: string; // DE 42
  merchantName: string; // DE 43
  terminalType: 'ATM' | 'POS' | 'ECOM';
  atmSubtype?: 'DAB' | 'GAB';
  mcc: string; // DE 18
  operationLabel: string;
  pan: string;
  maskedPan: string;
  amount: number; // EUR
  currency: string; // "978"
  routingDestination: 'SAE_INTERNAL' | 'SWITCH_VISA_MC' | 'STIP_ACQUIRER';
  responseCode: string; // DE 39
  responseDescription: string;
  approvalCode?: string; // DE 38
  acquirerFee: number; // Commission acquéreur perçue (€)
  status: 'APPROVED' | 'DECLINED' | 'STIP' | 'ROUTED_SAE' | 'REVERSED';
  checks: ControlCheckResult[];
  timestamp: string; // ISO date string
  latencyMs: number;
  requestRawHex: string;
  responseRawHex: string;
}

const TERMINALS_STORAGE_KEY = 'iso8583_acquirer_terminals_v1';
const TRANSACTIONS_STORAGE_KEY = 'iso8583_acquirer_transactions_v1';

// Seeded initial terminals
const SEED_TERMINALS: MerchantTerminalEntity[] = [
  {
    id: 'term-dab-opera',
    tid: 'DAB-OPERA-01',
    mid: 'MERCH-BNK-0012',
    merchantName: 'DAB GUICHET OPERA PARIS',
    type: 'ATM',
    atmSubtype: 'DAB',
    mcc: '6011',
    locationCity: 'Paris 09',
    countryCode: '250',
    currencyCode: '978',
    status: 'ACTIVE',
    dailyLimit: 40000.0,
    spentToday: 4250.0,
    maxSingleTx: 800.0,
    feePercent: 0.25,
    feeFixed: 0.1,
    defaultRouting: 'DIRECT_SAE',
    totalTransactionsCount: 14,
    totalVolumeProcessed: 4250.0,
    lastPing: 'En ligne (DAB Automate)',
  },
  {
    id: 'term-gab-garenord',
    tid: 'GAB-GARE-NORD',
    mid: 'MERCH-BNK-0014',
    merchantName: 'GAB HALL GARE DU NORD',
    type: 'ATM',
    atmSubtype: 'GAB',
    mcc: '6011',
    locationCity: 'Paris 10',
    countryCode: '250',
    currencyCode: '978',
    status: 'ACTIVE',
    dailyLimit: 60000.0,
    spentToday: 8900.0,
    maxSingleTx: 1000.0,
    feePercent: 0.25,
    feeFixed: 0.1,
    defaultRouting: 'DIRECT_SAE',
    totalTransactionsCount: 22,
    totalVolumeProcessed: 8900.0,
    lastPing: 'En ligne (GAB Libre-Service)',
  },
  {
    id: 'term-tpe-fnac',
    tid: 'TPE-FNAC-CHATELET',
    mid: 'MERCH-FNAC-0084',
    merchantName: 'FNAC FORUM LES HALLES',
    type: 'POS',
    mcc: '5732',
    locationCity: 'Paris 01',
    countryCode: '250',
    currencyCode: '978',
    status: 'ACTIVE',
    dailyLimit: 85000.0,
    spentToday: 18450.0,
    maxSingleTx: 3500.0,
    feePercent: 0.85,
    feeFixed: 0.05,
    defaultRouting: 'DIRECT_SAE',
    totalTransactionsCount: 46,
    totalVolumeProcessed: 18450.0,
    lastPing: 'En ligne (Ingenico Tetra IP)',
  },
  {
    id: 'term-tpe-pharma',
    tid: 'TPE-PHARMA-BASTILLE',
    mid: 'MERCH-PHAR-0033',
    merchantName: 'PHARMACIE DE LA BASTILLE',
    type: 'POS',
    mcc: '5912',
    locationCity: 'Paris 11',
    countryCode: '250',
    currencyCode: '978',
    status: 'ACTIVE',
    dailyLimit: 25000.0,
    spentToday: 3450.0,
    maxSingleTx: 800.0,
    feePercent: 0.7,
    feeFixed: 0.04,
    defaultRouting: 'DIRECT_SAE',
    totalTransactionsCount: 31,
    totalVolumeProcessed: 3450.0,
    lastPing: 'En ligne (Verifone V200c)',
  },
  {
    id: 'term-tpe-monop',
    tid: 'TPE-MONOP-MONTPAR',
    mid: 'MERCH-MNP-0055',
    merchantName: 'MONOPRIX MONTPARNASSE',
    type: 'POS',
    mcc: '5411',
    locationCity: 'Paris 14',
    countryCode: '250',
    currencyCode: '978',
    status: 'ACTIVE',
    dailyLimit: 120000.0,
    spentToday: 41200.0,
    maxSingleTx: 2000.0,
    feePercent: 0.8,
    feeFixed: 0.05,
    defaultRouting: 'DIRECT_SAE',
    totalTransactionsCount: 112,
    totalVolumeProcessed: 41200.0,
    lastPing: 'En ligne (Pax A920 Android)',
  },
  {
    id: 'term-ecom-cyberpay',
    tid: 'ECOM-CYBERPAY-01',
    mid: 'MERCH-ECO-0091',
    merchantName: 'CYBERPAY PORTAL E-COMMERCE',
    type: 'ECOM',
    mcc: '5399',
    locationCity: 'Lyon',
    countryCode: '250',
    currencyCode: '978',
    status: 'ACTIVE',
    dailyLimit: 200000.0,
    spentToday: 53100.0,
    maxSingleTx: 5000.0,
    feePercent: 1.2,
    feeFixed: 0.15,
    defaultRouting: 'DIRECT_SAE',
    totalTransactionsCount: 88,
    totalVolumeProcessed: 53100.0,
    lastPing: 'En ligne (API REST ISO Gateway)',
  },
];

// Seeded initial transactions
const SEED_TRANSACTIONS: AcquirerTransactionEntity[] = [
  {
    id: 'acq-tx-101',
    rrn: '261102901123',
    stan: '001245',
    mti: '0100',
    responseMti: '0110',
    tid: 'DAB-OPERA-01',
    mid: 'MERCH-BNK-0012',
    merchantName: 'DAB GUICHET OPERA PARIS',
    terminalType: 'ATM',
    atmSubtype: 'DAB',
    mcc: '6011',
    operationLabel: 'Retrait DAB [MTI 0100/DAB]',
    pan: '5355221001234568',
    maskedPan: '5355 22** **** 4568',
    amount: 150.0,
    currency: '978',
    routingDestination: 'SAE_INTERNAL',
    responseCode: '00',
    responseDescription: 'Transaction approuvée par SAE',
    approvalCode: 'AUTH42',
    acquirerFee: 0.48,
    status: 'APPROVED',
    checks: [
      { step: '1', name: 'Contrôle Terminal ID (DE 41)', passed: true, message: 'Terminal DAB-OPERA-01 reconnu et Actif' },
      { step: '2', name: 'Contrôle Marchand MID (DE 42)', passed: true, message: 'Contrat commerçant MERCH-BNK-0012 valide' },
      { step: '3', name: 'Contrôle Type Transaction', passed: true, message: 'Retrait d\'espèces DAB autorisé sur automate ATM' },
      { step: '4', name: 'Plafonds Commerçant', passed: true, message: 'Montant 150.00 € sous plafond unitaire (800 €)' },
      { step: '5', name: 'Routage SAE Émetteur', passed: true, message: 'Routé vers SAE Interne - Accord reçu (RC 00)' },
    ],
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    latencyMs: 142,
    requestRawHex: '60000100000100F23805810EE00000105355221001234568010000000000015000',
    responseRawHex: '60000100000110E23805810EE0000010535522100123456801000000000001500000AUTH42',
  },
  {
    id: 'acq-tx-102',
    rrn: '261102901124',
    stan: '001246',
    mti: '0100',
    responseMti: '0110',
    tid: 'GAB-GARE-NORD',
    mid: 'MERCH-BNK-0014',
    merchantName: 'GAB HALL GARE DU NORD',
    terminalType: 'ATM',
    atmSubtype: 'GAB',
    mcc: '6011',
    operationLabel: 'Retrait GAB [MTI 0100/GAB]',
    pan: '4970102005439871',
    maskedPan: '4970 10** **** 9871',
    amount: 200.0,
    currency: '978',
    routingDestination: 'SAE_INTERNAL',
    responseCode: '00',
    responseDescription: 'Transaction approuvée par SAE',
    approvalCode: 'AUTH89',
    acquirerFee: 0.6,
    status: 'APPROVED',
    checks: [
      { step: '1', name: 'Contrôle Terminal ID (DE 41)', passed: true, message: 'Terminal GAB-GARE-NORD reconnu et Actif' },
      { step: '2', name: 'Contrôle Marchand MID (DE 42)', passed: true, message: 'Contrat commerçant MERCH-BNK-0014 valide' },
      { step: '3', name: 'Contrôle Type Transaction', passed: true, message: 'Retrait d\'espèces GAB autorisé sur automate ATM' },
      { step: '4', name: 'Plafonds Commerçant', passed: true, message: 'Montant 200.00 € sous plafond unitaire (1000 €)' },
      { step: '5', name: 'Routage SAE Émetteur', passed: true, message: 'Routé vers SAE Interne - Accord reçu (RC 00)' },
    ],
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    latencyMs: 155,
    requestRawHex: '60000100000100F23805810EE00000104970102005439871010000000000020000',
    responseRawHex: '60000100000110E23805810EE0000010497010200543987101000000000002000000AUTH89',
  },
  {
    id: 'acq-tx-103',
    rrn: '261102901125',
    stan: '001247',
    mti: '0200',
    responseMti: '0210',
    tid: 'TPE-FNAC-CHATELET',
    mid: 'MERCH-FNAC-0084',
    merchantName: 'FNAC FORUM LES HALLES',
    terminalType: 'POS',
    mcc: '5732',
    operationLabel: 'Paiement TPE Contact EMV [0200]',
    pan: '5355221001234568',
    maskedPan: '5355 22** **** 4568',
    amount: 89.90,
    currency: '978',
    routingDestination: 'SAE_INTERNAL',
    responseCode: '00',
    responseDescription: 'Transaction approuvée par SAE',
    approvalCode: 'AUTH55',
    acquirerFee: 0.81,
    status: 'APPROVED',
    checks: [
      { step: '1', name: 'Contrôle Terminal ID (DE 41)', passed: true, message: 'Terminal TPE-FNAC-CHATELET reconnu et Actif' },
      { step: '2', name: 'Contrôle Marchand MID (DE 42)', passed: true, message: 'Contrat commerçant FNAC valide' },
      { step: '3', name: 'Contrôle Type Transaction', passed: true, message: 'Paiement vente TPE autorisé' },
      { step: '4', name: 'Plafonds Commerçant', passed: true, message: 'Montant 89.90 € sous plafond unitaire (3500 €)' },
      { step: '5', name: 'Routage SAE Émetteur', passed: true, message: 'Routé vers SAE Interne - Accord reçu (RC 00)' },
    ],
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    latencyMs: 168,
    requestRawHex: '60000100000200F23805810EE000001053552210012345680000000000008990',
    responseRawHex: '60000100000210E23805810EE00000105355221001234568000000000000899000AUTH55',
  },
];

export function getAcquirerTerminals(): MerchantTerminalEntity[] {
  try {
    const raw = localStorage.getItem(TERMINALS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(TERMINALS_STORAGE_KEY, JSON.stringify(SEED_TERMINALS));
      return SEED_TERMINALS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_TERMINALS;
  } catch (err) {
    console.error('Failed to read acquirer terminals from localStorage', err);
    return SEED_TERMINALS;
  }
}

export function saveAcquirerTerminal(terminal: MerchantTerminalEntity): void {
  try {
    const list = getAcquirerTerminals();
    const idx = list.findIndex((t) => t.id === terminal.id || t.tid === terminal.tid);
    if (idx >= 0) {
      list[idx] = terminal;
    } else {
      list.unshift(terminal);
    }
    localStorage.setItem(TERMINALS_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('acquirer-db-updated'));
  } catch (err) {
    console.error('Failed to save acquirer terminal', err);
  }
}

export function getAcquirerTerminalByTid(tid: string): MerchantTerminalEntity | undefined {
  const clean = (tid || '').trim().toUpperCase();
  const list = getAcquirerTerminals();
  return list.find((t) => t.tid.toUpperCase() === clean);
}

export function getAcquirerTransactions(): AcquirerTransactionEntity[] {
  try {
    const raw = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(SEED_TRANSACTIONS));
      return SEED_TRANSACTIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : SEED_TRANSACTIONS;
  } catch (err) {
    console.error('Failed to read acquirer transactions from localStorage', err);
    return SEED_TRANSACTIONS;
  }
}

export function recordAcquirerTransaction(tx: AcquirerTransactionEntity): void {
  try {
    const list = getAcquirerTransactions();
    const filtered = list.filter((t) => t.id !== tx.id);
    filtered.unshift(tx);
    if (filtered.length > 200) {
      filtered.length = 200;
    }
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(filtered));

    // Update terminal daily volume and count
    const terminals = getAcquirerTerminals();
    const termIdx = terminals.findIndex((t) => t.tid.toUpperCase() === tx.tid.toUpperCase());
    if (termIdx >= 0) {
      terminals[termIdx].totalTransactionsCount += 1;
      if (tx.status === 'APPROVED' || tx.status === 'STIP') {
        terminals[termIdx].spentToday += tx.amount;
        terminals[termIdx].totalVolumeProcessed += tx.amount;
      }
      localStorage.setItem(TERMINALS_STORAGE_KEY, JSON.stringify(terminals));
    }

    window.dispatchEvent(new Event('acquirer-db-updated'));
  } catch (err) {
    console.error('Failed to save acquirer transaction', err);
  }
}

export function clearAllAcquirerTransactions(): void {
  localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify([]));
  window.dispatchEvent(new Event('acquirer-db-updated'));
}

export function resetAcquirerDatabaseToSeeds(): void {
  localStorage.setItem(TERMINALS_STORAGE_KEY, JSON.stringify(SEED_TERMINALS));
  localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(SEED_TRANSACTIONS));
  window.dispatchEvent(new Event('acquirer-db-updated'));
}
