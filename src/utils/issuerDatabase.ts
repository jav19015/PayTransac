import { CardLimits, CardScheme, CardType, ProductTier } from '../types/cardProfile';

export interface CardEntity {
  id: string;
  pan: string; // Digits only e.g. "5355220012345678"
  cardholderName: string;
  scheme: CardScheme;
  cardType: CardType;
  productName: string;
  tier: ProductTier;
  expirationMonth: string; // "12"
  expirationYear: string; // "28"
  serviceCode: string; // "201"
  status: 'ACTIVE' | 'BLOCKED' | 'EXPIRED' | 'STOLEN';
  accountBalance: number; // e.g. 3500.00 EUR
  currency: string; // "978" (EUR)
  limits: CardLimits;
  spentThisMonth: number;
  spentThisWeek: number;
  spentToday: number;
  clearPin: string; // "1234"
  pinTriesCount: number; // Max 3 before blocking
  cvv1: string;
  cvv2: string;
  aid: string;
  mdkAc: string;
  createdAt: string;
  updatedAt: string;
}

export interface ControlCheckResult {
  step: string;
  name: string;
  passed: boolean;
  message: string;
  responseCode?: string; // e.g. "00", "51", "54", "14"
}

export interface IssuerTransactionEntity {
  id: string;
  rrn: string; // DE 37 (12 chars)
  stan: string; // DE 11 (6 chars)
  mti: string; // "0100", "0200", "0400"
  responseMti: string; // "0110", "0210", "0410"
  pan: string;
  maskedPan: string; // "5355 22** **** 5678"
  cardholderName: string;
  amount: number; // EUR
  currency: string; // "978"
  responseCode: string; // DE 39 e.g. "00", "51"
  responseDescription: string;
  approvalCode?: string; // DE 38 e.g. "AUTH84"
  status: 'APPROVED' | 'DECLINED' | 'REVERSED';
  transactionType: string;
  posEntryMode?: string; // DE 22
  terminalId?: string; // DE 41
  merchantName?: string; // DE 43
  arpc?: string;
  checks: ControlCheckResult[];
  balanceBefore: number;
  balanceAfter: number;
  timestamp: string; // ISO date string
  requestRawHex: string;
  responseRawHex: string;
  latencyMs: number;
}

const CARDS_STORAGE_KEY = 'iso8583_issuer_cards_v1';
const TRANSACTIONS_STORAGE_KEY = 'iso8583_issuer_transactions_v1';

// Seeded initial cards based on market products
const SEED_CARDS: CardEntity[] = [
  {
    id: 'card-mc-gold',
    pan: '5355221001234568',
    cardholderName: 'JEAN DUPONT',
    scheme: 'mastercard',
    cardType: 'debit',
    productName: 'Mastercard Gold',
    tier: 'premium',
    expirationMonth: '12',
    expirationYear: '28',
    serviceCode: '201',
    status: 'ACTIVE',
    accountBalance: 4250.0,
    currency: '978',
    limits: {
      paymentMonthlyLimit: 8000,
      atmWeeklyLimit: 1500,
      contactlessPerTxLimit: 50,
      contactlessCumulativeLimit: 150,
      offlineFloorLimit: 500,
    },
    spentThisMonth: 1250.0,
    spentThisWeek: 450.0,
    spentToday: 0.0,
    clearPin: '1234',
    pinTriesCount: 0,
    cvv1: '482',
    cvv2: '741',
    aid: 'A0000000041010',
    mdkAc: '0123456789ABCDEFFEDCBA9876543210',
    createdAt: '2026-01-15T09:00:00.000Z',
    updatedAt: '2026-03-20T14:30:00.000Z',
  },
  {
    id: 'card-cb-visa-premier',
    pan: '4970102005559871',
    cardholderName: 'SOPHIE MARTIN',
    scheme: 'cb',
    cardType: 'deferred_debit',
    productName: 'CB Visa Premier',
    tier: 'premium',
    expirationMonth: '06',
    expirationYear: '29',
    serviceCode: '201',
    status: 'ACTIVE',
    accountBalance: 7800.0,
    currency: '978',
    limits: {
      paymentMonthlyLimit: 9000,
      atmWeeklyLimit: 2000,
      contactlessPerTxLimit: 50,
      contactlessCumulativeLimit: 150,
      offlineFloorLimit: 750,
    },
    spentThisMonth: 2100.0,
    spentThisWeek: 350.0,
    spentToday: 45.0,
    clearPin: '5678',
    pinTriesCount: 0,
    cvv1: '529',
    cvv2: '382',
    aid: 'A0000000421010',
    mdkAc: 'FEDCBA98765432100123456789ABCDEF',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-04-10T16:00:00.000Z',
  },
  {
    id: 'card-visa-electron',
    pan: '4970423009991238',
    cardholderName: 'ALEXANDRE LEFEBVRE',
    scheme: 'visa',
    cardType: 'debit',
    productName: 'Visa Electron (Systématique)',
    tier: 'systematic',
    expirationMonth: '09',
    expirationYear: '27',
    serviceCode: '221',
    status: 'ACTIVE',
    accountBalance: 120.0, // Low balance to trigger code 51 test
    currency: '978',
    limits: {
      paymentMonthlyLimit: 1200,
      atmWeeklyLimit: 300,
      contactlessPerTxLimit: 50,
      contactlessCumulativeLimit: 100,
      offlineFloorLimit: 0,
    },
    spentThisMonth: 780.0,
    spentThisWeek: 120.0,
    spentToday: 0.0,
    clearPin: '4321',
    pinTriesCount: 0,
    cvv1: '194',
    cvv2: '891',
    aid: 'A0000000032010',
    mdkAc: '4A5B6C7D8E9F01233210FEDCBA987654',
    createdAt: '2026-02-14T08:30:00.000Z',
    updatedAt: '2026-04-15T11:20:00.000Z',
  },
  {
    id: 'card-mc-expired',
    pan: '5100004001112224',
    cardholderName: 'MARC MOREAU',
    scheme: 'mastercard',
    cardType: 'debit',
    productName: 'Mastercard Standard (Expirée)',
    tier: 'classic',
    expirationMonth: '01',
    expirationYear: '24', // Expired
    serviceCode: '201',
    status: 'EXPIRED',
    accountBalance: 1500.0,
    currency: '978',
    limits: {
      paymentMonthlyLimit: 3000,
      atmWeeklyLimit: 800,
      contactlessPerTxLimit: 50,
      contactlessCumulativeLimit: 100,
      offlineFloorLimit: 200,
    },
    spentThisMonth: 0,
    spentThisWeek: 0,
    spentToday: 0,
    clearPin: '0000',
    pinTriesCount: 0,
    cvv1: '772',
    cvv2: '443',
    aid: 'A0000000041010',
    mdkAc: '0123456789ABCDEFFEDCBA9876543210',
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2024-02-01T00:00:00.000Z',
  },
  {
    id: 'card-blocked-fraud',
    pan: '5412759900003332',
    cardholderName: 'LUCAS BERNARD',
    scheme: 'mastercard',
    cardType: 'debit',
    productName: 'Mastercard Bloquée (Suspicion Fraude)',
    tier: 'classic',
    expirationMonth: '11',
    expirationYear: '28',
    serviceCode: '201',
    status: 'BLOCKED',
    accountBalance: 3200.0,
    currency: '978',
    limits: {
      paymentMonthlyLimit: 4000,
      atmWeeklyLimit: 1000,
      contactlessPerTxLimit: 50,
      contactlessCumulativeLimit: 100,
      offlineFloorLimit: 300,
    },
    spentThisMonth: 500,
    spentThisWeek: 200,
    spentToday: 0,
    clearPin: '9999',
    pinTriesCount: 3,
    cvv1: '321',
    cvv2: '654',
    aid: 'A0000000041010',
    mdkAc: '0123456789ABCDEFFEDCBA9876543210',
    createdAt: '2025-05-10T11:00:00.000Z',
    updatedAt: '2026-04-12T09:15:00.000Z',
  },
];

// Seeded initial historical transactions
const SEED_TRANSACTIONS: IssuerTransactionEntity[] = [
  {
    id: 'tx-seed-1',
    rrn: '261234567890',
    stan: '004521',
    mti: '0100',
    responseMti: '0110',
    pan: '5355221001234568',
    maskedPan: '5355 22** **** 4568',
    cardholderName: 'JEAN DUPONT',
    amount: 45.0,
    currency: '978',
    responseCode: '00',
    responseDescription: '00 - Approuvé / Transaction Acceptée',
    approvalCode: 'AUTH84',
    status: 'APPROVED',
    transactionType: 'Paiement Contact (Puce EMV)',
    posEntryMode: '051',
    terminalId: 'TPE-PARIS-01',
    merchantName: 'BOULANGERIE DU COIN PARIS',
    arpc: 'E821B0A423D190C1',
    checks: [
      { step: '1', name: 'Format & Algorithme Luhn', passed: true, message: 'PAN conforme ISO/IEC 7812', responseCode: '00' },
      { step: '2', name: 'Existence Carte Base Émetteur', passed: true, message: 'Carte retrouvée : Mastercard Gold', responseCode: '00' },
      { step: '3', name: 'Statut de la Carte', passed: true, message: 'Carte ACTIVE', responseCode: '00' },
      { step: '4', name: 'Validité Temporelle', passed: true, message: 'Non expirée (Exp: 12/28)', responseCode: '00' },
      { step: '5', name: 'Authentification Puce EMV (ARQC)', passed: true, message: 'ARQC valide, calcul ARPC émis', responseCode: '00' },
      { step: '6', name: 'Contrôle Plafond Hebdomadaire', passed: true, message: 'Dans la limite autorisée', responseCode: '00' },
      { step: '7', name: 'Contrôle Solde du Compte', passed: true, message: 'Solde suffisant (4 295.00 €)', responseCode: '00' },
    ],
    balanceBefore: 4295.0,
    balanceAfter: 4250.0,
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    requestRawHex: '60000100000100F23A400108A180001053552210012345680000000000004500',
    responseRawHex: '60000100000110F23A400108A180001053552210012345680000000000004500',
    latencyMs: 142,
  },
  {
    id: 'tx-seed-2',
    rrn: '269876543211',
    stan: '004522',
    mti: '0200',
    responseMti: '0210',
    pan: '4970423009991238',
    maskedPan: '4970 42** **** 1238',
    cardholderName: 'ALEXANDRE LEFEBVRE',
    amount: 150.0,
    currency: '978',
    responseCode: '51',
    responseDescription: '51 - Provision Insuffisante',
    status: 'DECLINED',
    transactionType: 'Paiement Sans Contact (NFC)',
    posEntryMode: '071',
    terminalId: 'TPE-FNAC-LYON',
    merchantName: 'FNAC LYON BELLECOUR',
    checks: [
      { step: '1', name: 'Format & Algorithme Luhn', passed: true, message: 'PAN conforme', responseCode: '00' },
      { step: '2', name: 'Existence Carte Base Émetteur', passed: true, message: 'Carte retrouvée : Visa Electron', responseCode: '00' },
      { step: '3', name: 'Statut de la Carte', passed: true, message: 'Carte ACTIVE', responseCode: '00' },
      { step: '4', name: 'Validité Temporelle', passed: true, message: 'Non expirée', responseCode: '00' },
      { step: '5', name: 'Contrôle Solde du Compte', passed: false, message: 'Solde disponible (120.00 €) inférieur au montant demandé (150.00 €)', responseCode: '51' },
    ],
    balanceBefore: 120.0,
    balanceAfter: 120.0,
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    requestRawHex: '60000100000200F23A400108A180001049704230099912380000000000015000',
    responseRawHex: '60000100000210F23A400108A180001049704230099912380000000000015000',
    latencyMs: 98,
  },
  {
    id: 'tx-seed-3',
    rrn: '265544332211',
    stan: '004523',
    mti: '0100',
    responseMti: '0110',
    pan: '4970102005559871',
    maskedPan: '4970 10** **** 9871',
    cardholderName: 'SOPHIE MARTIN',
    amount: 120.0,
    currency: '978',
    responseCode: '00',
    responseDescription: '00 - Approuvé / Transaction Acceptée',
    approvalCode: 'PREM92',
    status: 'APPROVED',
    transactionType: 'Demande d\'autorisation Vente à distance',
    posEntryMode: '012',
    terminalId: 'WEB-AMAZON-FR',
    merchantName: 'AMAZON EU SARL',
    checks: [
      { step: '1', name: 'Format & Algorithme Luhn', passed: true, message: 'PAN conforme', responseCode: '00' },
      { step: '2', name: 'Existence Carte Base Émetteur', passed: true, message: 'Carte retrouvée : CB Visa Premier', responseCode: '00' },
      { step: '3', name: 'Statut de la Carte', passed: true, message: 'Carte ACTIVE', responseCode: '00' },
      { step: '4', name: 'Validité Temporelle', passed: true, message: 'Non expirée', responseCode: '00' },
      { step: '5', name: 'Contrôle CVV2 VAD', passed: true, message: 'CVV2 concordant', responseCode: '00' },
      { step: '6', name: 'Contrôle Plafond Mensuel', passed: true, message: 'Dans les limites (Reste: 6900 €)', responseCode: '00' },
      { step: '7', name: 'Contrôle Solde du Compte', passed: true, message: 'Provision suffisante (Solde: 7800 €)', responseCode: '00' },
    ],
    balanceBefore: 7920.0,
    balanceAfter: 7800.0,
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    requestRawHex: '60000100000100F23A400108A180001049701020055598710000000000012000',
    responseRawHex: '60000100000110F23A400108A180001049701020055598710000000000012000',
    latencyMs: 165,
  },
];

export function cleanPan(pan: string): string {
  return pan.replace(/\D/g, '');
}

export function maskPan(pan: string): string {
  const clean = cleanPan(pan);
  if (clean.length < 10) return clean;
  const first6 = clean.slice(0, 6);
  const last4 = clean.slice(-4);
  const middle = '*'.repeat(Math.max(0, clean.length - 10));
  const full = `${first6}${middle}${last4}`;
  return full.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Loads all cards from persistent database
 */
export function getIssuerCards(): CardEntity[] {
  try {
    const raw = localStorage.getItem(CARDS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(SEED_CARDS));
      return [...SEED_CARDS];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(SEED_CARDS));
      return [...SEED_CARDS];
    }
    return parsed;
  } catch (err) {
    console.error('Failed to read issuer cards from localStorage:', err);
    return [...SEED_CARDS];
  }
}

/**
 * Finds card by PAN
 */
export function getIssuerCardByPan(pan: string): CardEntity | undefined {
  const normalized = cleanPan(pan);
  const cards = getIssuerCards();
  return cards.find((c) => cleanPan(c.pan) === normalized);
}

/**
 * Saves or updates a card in the issuer database
 */
export function saveIssuerCard(cardData: Partial<CardEntity> & { pan: string }): CardEntity {
  const normalizedPan = cleanPan(cardData.pan);
  const cards = getIssuerCards();
  const existingIdx = cards.findIndex((c) => cleanPan(c.pan) === normalizedPan);

  const now = new Date().toISOString();

  let savedCard: CardEntity;

  if (existingIdx >= 0) {
    savedCard = {
      ...cards[existingIdx],
      ...cardData,
      pan: normalizedPan,
      updatedAt: now,
    };
    cards[existingIdx] = savedCard;
  } else {
    savedCard = {
      id: `card-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      pan: normalizedPan,
      cardholderName: cardData.cardholderName || 'PORTEUR DE CARTE',
      scheme: cardData.scheme || 'mastercard',
      cardType: cardData.cardType || 'debit',
      productName: cardData.productName || 'Carte Personnalisée',
      tier: cardData.tier || 'premium',
      expirationMonth: cardData.expirationMonth || '12',
      expirationYear: cardData.expirationYear || '28',
      serviceCode: cardData.serviceCode || '201',
      status: cardData.status || 'ACTIVE',
      accountBalance: cardData.accountBalance !== undefined ? cardData.accountBalance : 3000.0,
      currency: cardData.currency || '978',
      limits: cardData.limits || {
        paymentMonthlyLimit: 5000,
        atmWeeklyLimit: 1000,
        contactlessPerTxLimit: 50,
        contactlessCumulativeLimit: 150,
        offlineFloorLimit: 300,
      },
      spentThisMonth: cardData.spentThisMonth || 0,
      spentThisWeek: cardData.spentThisWeek || 0,
      spentToday: cardData.spentToday || 0,
      clearPin: cardData.clearPin || '1234',
      pinTriesCount: cardData.pinTriesCount || 0,
      cvv1: cardData.cvv1 || '123',
      cvv2: cardData.cvv2 || '456',
      aid: cardData.aid || 'A0000000041010',
      mdkAc: cardData.mdkAc || '0123456789ABCDEFFEDCBA9876543210',
      createdAt: now,
      updatedAt: now,
    };
    cards.unshift(savedCard);
  }

  localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(cards));
  notifyDatabaseUpdated();
  return savedCard;
}

/**
 * Updates card status (ACTIVE, BLOCKED, etc.)
 */
export function updateIssuerCardStatus(pan: string, status: CardEntity['status']): boolean {
  const normalized = cleanPan(pan);
  const cards = getIssuerCards();
  const card = cards.find((c) => cleanPan(c.pan) === normalized);
  if (!card) return false;

  card.status = status;
  if (status === 'ACTIVE') {
    card.pinTriesCount = 0; // reset pin tries on unblock
  }
  card.updatedAt = new Date().toISOString();

  localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(cards));
  notifyDatabaseUpdated();
  return true;
}

/**
 * Top up card account balance
 */
export function topupIssuerCardBalance(pan: string, amount: number): boolean {
  const normalized = cleanPan(pan);
  const cards = getIssuerCards();
  const card = cards.find((c) => cleanPan(c.pan) === normalized);
  if (!card) return false;

  card.accountBalance = Math.round((card.accountBalance + amount) * 100) / 100;
  card.updatedAt = new Date().toISOString();

  localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(cards));
  notifyDatabaseUpdated();
  return true;
}

/**
 * Reset PIN retry counter
 */
export function resetIssuerCardPinTries(pan: string): boolean {
  const normalized = cleanPan(pan);
  const cards = getIssuerCards();
  const card = cards.find((c) => cleanPan(c.pan) === normalized);
  if (!card) return false;

  card.pinTriesCount = 0;
  card.updatedAt = new Date().toISOString();

  localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(cards));
  notifyDatabaseUpdated();
  return true;
}

/**
 * Delete a card from database
 */
export function deleteIssuerCard(pan: string): boolean {
  const normalized = cleanPan(pan);
  let cards = getIssuerCards();
  const initialLength = cards.length;
  cards = cards.filter((c) => cleanPan(c.pan) !== normalized);
  if (cards.length === initialLength) return false;

  localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(cards));
  notifyDatabaseUpdated();
  return true;
}

/**
 * Get all issuer transactions
 */
export function getIssuerTransactions(panFilter?: string): IssuerTransactionEntity[] {
  try {
    const raw = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
    let list: IssuerTransactionEntity[];
    if (!raw) {
      list = [...SEED_TRANSACTIONS];
      localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(list));
    } else {
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : [...SEED_TRANSACTIONS];
    }

    if (panFilter) {
      const cleanFilter = cleanPan(panFilter);
      return list.filter((t) => cleanPan(t.pan) === cleanFilter);
    }
    return list;
  } catch (err) {
    console.error('Failed to read transactions from localStorage:', err);
    return [...SEED_TRANSACTIONS];
  }
}

/**
 * Records a new transaction in the database
 */
export function recordIssuerTransaction(tx: IssuerTransactionEntity): void {
  const list = getIssuerTransactions();
  list.unshift(tx);
  // Keep up to 200 transactions
  const trimmed = list.slice(0, 200);
  localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(trimmed));
  notifyDatabaseUpdated();
}

/**
 * Finds a transaction by RRN or STAN
 */
export function findIssuerTransactionByRrn(rrn: string): IssuerTransactionEntity | undefined {
  const list = getIssuerTransactions();
  return list.find((t) => t.rrn === rrn || t.stan === rrn);
}

/**
 * Marks an existing transaction as REVERSED
 */
export function markTransactionReversed(rrn: string): boolean {
  const list = getIssuerTransactions();
  const tx = list.find((t) => t.rrn === rrn || t.stan === rrn);
  if (!tx) return false;
  tx.status = 'REVERSED';
  localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(list));
  notifyDatabaseUpdated();
  return true;
}

/**
 * Resets database to factory seeds
 */
export function resetIssuerDatabaseToSeeds(): void {
  localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(SEED_CARDS));
  localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(SEED_TRANSACTIONS));
  notifyDatabaseUpdated();
}

/**
 * Clear all transactions
 */
export function clearAllIssuerTransactions(): void {
  localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify([]));
  notifyDatabaseUpdated();
}

/**
 * Broadcast event to synchronize all open views
 */
export function notifyDatabaseUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('issuer-db-updated'));
  }
}
