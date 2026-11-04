import { SwitchResponse } from '../types/iso8583';
import { packIso8583Message } from './iso8583Packer';
import { validateLuhn } from './luhn';
import {
  getIssuerCardByPan,
  saveIssuerCard,
  recordIssuerTransaction,
  findIssuerTransactionByRrn,
  markTransactionReversed,
  maskPan,
  cleanPan,
  ControlCheckResult,
  IssuerTransactionEntity,
  CardEntity,
} from './issuerDatabase';

export interface IssuerProcessResult {
  response: SwitchResponse;
  transaction: IssuerTransactionEntity;
  checks: ControlCheckResult[];
  rawHex: string;
  socketEvents: { time: string; event: string; status: 'info' | 'success' | 'warn' | 'error' }[];
  card?: CardEntity;
}

export type IssuerOverrideMode = 'normal' | 'force_approve' | 'force_51_balance' | 'force_54_expired' | 'force_05_blocked' | 'force_61_limit' | 'force_91_timeout';

/**
 * Parses numeric amount from DE 4 (12 digits, cents)
 * e.g. "000000004500" -> 45.00
 */
export function parseIsoAmount(de4: string | undefined): number {
  if (!de4) return 0;
  const cleaned = de4.replace(/\D/g, '');
  if (!cleaned) return 0;
  const cents = parseInt(cleaned, 10);
  return isNaN(cents) ? 0 : cents / 100;
}

/**
 * Calculates response MTI from request MTI
 */
export function getResponseMti(requestMti: string): string {
  if (requestMti.length !== 4) return '0210';
  const prefix = requestMti.slice(0, 2);
  const suffix = requestMti.slice(3, 4);
  const thirdDigit = requestMti[2];

  let respThird = '1';
  if (thirdDigit === '2') respThird = '3';

  return `${prefix}${respThird}${suffix}`;
}

/**
 * Computes descriptive transaction type from MTI, POS Entry Mode, and Processing Code
 */
function getTransactionTypeLabel(mti: string, posEntryMode?: string, processingCode?: string, terminalId?: string): string {
  if (processingCode?.startsWith('01')) {
    if (terminalId?.toUpperCase().includes('GAB')) return 'Retrait GAB';
    return 'Retrait DAB';
  }
  if (mti.startsWith('04')) return 'Demande de Redressement / Annulation';
  if (mti.startsWith('08')) return 'Test Réseau (Echo / Log-on)';
  if (mti.startsWith('05')) return 'Télécollecte / Règlement Hôte';

  if (!posEntryMode) return mti.startsWith('01') ? 'Demande d\'autorisation' : 'Demande financière';

  const mode = posEntryMode.slice(0, 2);
  if (mode === '05' || posEntryMode === '051') return 'Paiement Contact (Puce EMV)';
  if (mode === '07' || posEntryMode === '071') return 'Paiement Sans Contact (NFC)';
  if (mode === '02' || posEntryMode === '021') return 'Paiement Piste Magnétique';
  if (mode === '01' || posEntryMode === '012') return 'Vente à Distance / E-commerce';
  if (mode === '90') return 'Piste Magnétique (Sans CVV)';
  return 'Paiement Standard';
}

/**
 * Core Host Authorization Processing Engine
 */
export async function processIssuerAuthorization(
  requestMti: string,
  fields: Record<number, string>,
  tpdu: string = '6000010000',
  overrideMode: IssuerOverrideMode = 'normal'
): Promise<IssuerProcessResult> {
  const startTime = performance.now();
  const socketEvents: { time: string; event: string; status: 'info' | 'success' | 'warn' | 'error' }[] = [];
  const checks: ControlCheckResult[] = [];

  const nowStr = () => new Date().toISOString().substring(11, 23);

  // 1. Handshake & Network trace
  socketEvents.push({ time: nowStr(), event: `[CONNEXION] Session TCP/IP établie avec le Serveur d'Autorisation Émetteur Hôte`, status: 'info' });
  socketEvents.push({ time: nowStr(), event: `[RÉCEPTION] Trame ISO 8583 MTI ${requestMti} reçue - Décodage des champs...`, status: 'info' });

  // Extract PAN from DE 2 (or Track 2 DE 35 if DE 2 is absent)
  let rawPan = fields[2] || '';
  if (!rawPan && fields[35]) {
    const split = fields[35].split('=');
    if (split[0]) rawPan = split[0];
  }
  const pan = cleanPan(rawPan);
  const amount = parseIsoAmount(fields[4]);
  const currency = fields[49] || '978';
  const posEntry = fields[22] || '051';
  const stan = fields[11] || `${Math.floor(100000 + Math.random() * 900000)}`;
  const incomingRrn = fields[37] || `${new Date().getFullYear().toString().slice(-2)}${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  const terminalId = fields[41] || 'TPE-DEMO-01';
  const merchantName = fields[43] || 'COMMERCE PARTENAIRE';

  // Handle Echo / Network management (0800)
  if (requestMti === '0800') {
    const respMti = '0810';
    const respFields: Record<number, string> = { ...fields, 39: '00', 37: incomingRrn };
    const packed = packIso8583Message(respMti, respFields, tpdu);

    const tx: IssuerTransactionEntity = {
      id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      rrn: incomingRrn,
      stan,
      mti: requestMti,
      responseMti: respMti,
      pan: 'NETWORK-TEST',
      maskedPan: '0000 00** **** 0000',
      cardholderName: 'SUPERVISEUR RESEAU',
      amount: 0,
      currency,
      responseCode: '00',
      responseDescription: '00 - Echo Réseau Approuvé',
      status: 'APPROVED',
      transactionType: 'Test Réseau (Echo / Log-on)',
      checks: [{ step: 'NET-1', name: 'Contrôle Echo Réseau', passed: true, message: 'Liaison monétique active et nominale', responseCode: '00' }],
      balanceBefore: 0,
      balanceAfter: 0,
      timestamp: new Date().toISOString(),
      requestRawHex: packIso8583Message(requestMti, fields, tpdu).rawHex,
      responseRawHex: packed.rawHex,
      latencyMs: 45,
    };
    recordIssuerTransaction(tx);

    return {
      response: {
        mti: respMti,
        responseCode: '00',
        responseDescription: '00 - Approuvé / Test Réseau Réussi',
        fields: respFields,
        rawHex: packed.rawHex,
        latencyMs: 45,
        timestamp: new Date().toLocaleTimeString('fr-FR'),
      },
      transaction: tx,
      checks: tx.checks,
      rawHex: packed.rawHex,
      socketEvents,
    };
  }

  // Handle Timeout Override
  if (overrideMode === 'force_91_timeout') {
    socketEvents.push({ time: nowStr(), event: `[TIME-OUT] Délai de réponse dépassé vers le Core Banking (Simulé)`, status: 'error' });
    const respMti = getResponseMti(requestMti);
    const respFields: Record<number, string> = { ...fields, 39: '91', 37: incomingRrn };
    const packed = packIso8583Message(respMti, respFields, tpdu);
    const tx: IssuerTransactionEntity = {
      id: `tx-${Date.now()}`,
      rrn: incomingRrn,
      stan,
      mti: requestMti,
      responseMti: respMti,
      pan,
      maskedPan: maskPan(pan),
      cardholderName: 'CLIENT INCONNU',
      amount,
      currency,
      responseCode: '91',
      responseDescription: '91 - Émetteur Indisponible (Time-out)',
      status: 'DECLINED',
      transactionType: getTransactionTypeLabel(requestMti, posEntry),
      checks: [{ step: 'TIMEOUT', name: 'Disponibilité Hôte', passed: false, message: 'Délai d\'attente dépassé vers le système émetteur', responseCode: '91' }],
      balanceBefore: 0,
      balanceAfter: 0,
      timestamp: new Date().toISOString(),
      requestRawHex: packIso8583Message(requestMti, fields, tpdu).rawHex,
      responseRawHex: packed.rawHex,
      latencyMs: 3500,
    };
    recordIssuerTransaction(tx);
    return {
      response: {
        mti: respMti,
        responseCode: '91',
        responseDescription: '91 - Émetteur Indisponible',
        fields: respFields,
        rawHex: packed.rawHex,
        latencyMs: 3500,
        timestamp: new Date().toLocaleTimeString('fr-FR'),
      },
      transaction: tx,
      checks: tx.checks,
      rawHex: packed.rawHex,
      socketEvents,
    };
  }

  // ==========================================
  // REAL ISSUER HOST CONTROLS
  // ==========================================

  // Step 1: Format & Luhn Check
  const isLuhnValid = validateLuhn(pan);
  checks.push({
    step: '1. LUHN',
    name: 'Contrôle Algorithme de Luhn (MOD 10)',
    passed: isLuhnValid,
    message: isLuhnValid ? `PAN conforme ISO/IEC 7812 (${pan.length} chiffres)` : `Échec de la clé de contrôle Luhn sur le PAN`,
    responseCode: isLuhnValid ? '00' : '14',
  });

  if (!isLuhnValid && overrideMode === 'normal') {
    socketEvents.push({ time: nowStr(), event: `[REJET] Clé de Luhn invalide sur le PAN [${maskPan(pan)}]`, status: 'error' });
    return finishWithDeclinedResponse('14', '14 - Numéro de Carte Invalide', checks, socketEvents, requestMti, fields, tpdu, incomingRrn, stan, pan, amount, currency, posEntry, terminalId, merchantName, startTime);
  }

  // Step 2: Query Card from Database
  let card = getIssuerCardByPan(pan);

  checks.push({
    step: '2. DB_LOOKUP',
    name: 'Recherche Carte en Base Émettrice',
    passed: !!card,
    message: card ? `Carte trouvée : ${card.productName} (${card.cardholderName})` : `Carte inexistante dans le fichier émetteur`,
    responseCode: card ? '00' : '14',
  });

  if (!card) {
    if (overrideMode === 'force_approve') {
      // Auto-provision a temporary card if user specifically forces approval
      card = saveIssuerCard({
        pan,
        cardholderName: 'PORTEUR DEMO',
        productName: 'Carte Auto-Provisionnée',
        accountBalance: 5000,
        status: 'ACTIVE',
      });
    } else {
      socketEvents.push({ time: nowStr(), event: `[REJET] Le PAN ${maskPan(pan)} n'existe pas dans la base de données émettrice`, status: 'error' });
      return finishWithDeclinedResponse('14', '14 - Numéro de Carte Invalide (Non répertorié en base)', checks, socketEvents, requestMti, fields, tpdu, incomingRrn, stan, pan, amount, currency, posEntry, terminalId, merchantName, startTime);
    }
  }

  // Step 3: Card Status Check
  const isBlocked = card.status === 'BLOCKED' || card.pinTriesCount >= 3;
  const isStolen = card.status === 'STOLEN';
  const statusOk = !isBlocked && !isStolen && card.status === 'ACTIVE';

  checks.push({
    step: '3. STATUT',
    name: 'Statut du Compte & Opposition Carte',
    passed: overrideMode === 'force_05_blocked' ? false : statusOk,
    message: isStolen ? 'Carte déclarée perdue ou volée (Opposition active)' : isBlocked ? 'Carte bloquée par l\'émetteur ou 3 codes faux consécutifs' : 'Carte ACTIVE, aucune opposition enregistrée',
    responseCode: isStolen ? '41' : isBlocked ? '05' : '00',
  });

  if ((!statusOk || overrideMode === 'force_05_blocked') && overrideMode !== 'force_approve') {
    const code = isStolen ? '41' : '05';
    const desc = isStolen ? '41 - Carte Perdue ou Volée (Confisquer)' : '05 - Ne Pas Honorer (Carte Bloquée)';
    socketEvents.push({ time: nowStr(), event: `[REJET] Statut de carte invalide : ${card.status}`, status: 'error' });
    return finishWithDeclinedResponse(code, desc, checks, socketEvents, requestMti, fields, tpdu, incomingRrn, stan, pan, amount, currency, posEntry, terminalId, merchantName, startTime, card);
  }

  // Step 4: Expiration Date Check (DE 14 vs Current Date)
  const currentDate = new Date();
  const currentYY = parseInt(currentDate.getFullYear().toString().slice(-2), 10);
  const currentMM = currentDate.getMonth() + 1;

  const cardExpYY = parseInt(card.expirationYear, 10);
  const cardExpMM = parseInt(card.expirationMonth, 10);
  const isCardExpired = cardExpYY < currentYY || (cardExpYY === currentYY && cardExpMM < currentMM);

  checks.push({
    step: '4. EXPIRATION',
    name: 'Contrôle Date d\'Expiration (DE 14)',
    passed: overrideMode === 'force_54_expired' ? false : !isCardExpired,
    message: isCardExpired ? `Carte expirée depuis ${card.expirationMonth}/${card.expirationYear}` : `Carte valide jusqu'au ${card.expirationMonth}/${card.expirationYear}`,
    responseCode: isCardExpired ? '54' : '00',
  });

  if ((isCardExpired || overrideMode === 'force_54_expired') && overrideMode !== 'force_approve') {
    socketEvents.push({ time: nowStr(), event: `[REJET] Date d'expiration dépassée : ${card.expirationMonth}/${card.expirationYear}`, status: 'error' });
    return finishWithDeclinedResponse('54', '54 - Carte Expirée', checks, socketEvents, requestMti, fields, tpdu, incomingRrn, stan, pan, amount, currency, posEntry, terminalId, merchantName, startTime, card);
  }

  // Step 5: Handling REVERSAL / CANCELLATION (0400 or 0420)
  if (requestMti.startsWith('04')) {
    socketEvents.push({ time: nowStr(), event: `[REDRESSEMENT] Traitement de la demande d'annulation/redressement...`, status: 'info' });

    // Look up original transaction via RRN or STAN
    const originalTx = findIssuerTransactionByRrn(incomingRrn) || findIssuerTransactionByRrn(stan);

    let reverseSuccess = false;
    let reversedAmount = amount;

    if (originalTx && originalTx.status === 'APPROVED') {
      reversedAmount = originalTx.amount;
      // Credit back card balance
      card.accountBalance = Math.round((card.accountBalance + reversedAmount) * 100) / 100;
      card.spentThisMonth = Math.max(0, card.spentThisMonth - reversedAmount);
      card.spentThisWeek = Math.max(0, card.spentThisWeek - reversedAmount);
      card.spentToday = Math.max(0, card.spentToday - reversedAmount);
      saveIssuerCard(card);
      markTransactionReversed(originalTx.rrn);
      reverseSuccess = true;
    } else {
      // Reversal for unrecorded transaction (still acknowledge with 00)
      reverseSuccess = true;
    }

    checks.push({
      step: '5. REVERSAL',
      name: 'Rapprochement & Restitution des Fonds (0400)',
      passed: true,
      message: originalTx ? `Transaction d'origine (RRN ${originalTx.rrn}) trouvée : ${reversedAmount} € recrédités` : `Annulation acceptée (Avis d'annulation de transaction)`,
      responseCode: '00',
    });

    const respMti = getResponseMti(requestMti);
    const respFields: Record<number, string> = {
      ...fields,
      39: '00',
      37: incomingRrn,
      38: 'REV001',
    };
    const packed = packIso8583Message(respMti, respFields, tpdu);

    const reversalTx: IssuerTransactionEntity = {
      id: `tx-${Date.now()}`,
      rrn: incomingRrn,
      stan,
      mti: requestMti,
      responseMti: respMti,
      pan,
      maskedPan: maskPan(pan),
      cardholderName: card.cardholderName,
      amount: reversedAmount,
      currency,
      responseCode: '00',
      responseDescription: '00 - Annulation Réussie / Solde Restauré',
      approvalCode: 'REV001',
      status: 'REVERSED',
      transactionType: 'Demande de Redressement / Annulation',
      posEntryMode: posEntry,
      terminalId,
      merchantName,
      checks,
      balanceBefore: card.accountBalance - reversedAmount,
      balanceAfter: card.accountBalance,
      timestamp: new Date().toISOString(),
      requestRawHex: packIso8583Message(requestMti, fields, tpdu).rawHex,
      responseRawHex: packed.rawHex,
      latencyMs: 110,
    };
    recordIssuerTransaction(reversalTx);

    socketEvents.push({ time: nowStr(), event: `[SUCCÈS] Annulation traitée : ${reversedAmount} € restitués au porteur`, status: 'success' });

    return {
      response: {
        mti: respMti,
        responseCode: '00',
        responseDescription: '00 - Annulation Réussie / Solde Restauré',
        authCode: 'REV001',
        fields: respFields,
        rawHex: packed.rawHex,
        latencyMs: 110,
        timestamp: new Date().toLocaleTimeString('fr-FR'),
      },
      transaction: reversalTx,
      checks,
      rawHex: packed.rawHex,
      socketEvents,
      card,
    };
  }

  // Step 6: Contactless (NFC) Single Transaction Ceiling
  const isNfc = posEntry === '071' || posEntry.startsWith('07');
  if (isNfc && amount > card.limits.contactlessPerTxLimit) {
    checks.push({
      step: '6. SANS_CONTACT',
      name: 'Contrôle Plafond Sans-Contact (NFC)',
      passed: false,
      message: `Montant de ${amount} € dépasse le plafond sans contact sans PIN (${card.limits.contactlessPerTxLimit} €). Exiger insertion carte + PIN.`,
      responseCode: '65',
    });
    socketEvents.push({ time: nowStr(), event: `[REJET] Plafond sans-contact dépassé (${amount} € > ${card.limits.contactlessPerTxLimit} €)`, status: 'warn' });
    return finishWithDeclinedResponse('65', '65 - Plafond Sans Contact Dépassé (Insérer Puce + PIN)', checks, socketEvents, requestMti, fields, tpdu, incomingRrn, stan, pan, amount, currency, posEntry, terminalId, merchantName, startTime, card);
  } else if (isNfc) {
    checks.push({
      step: '6. SANS_CONTACT',
      name: 'Contrôle Plafond Sans-Contact (NFC)',
      passed: true,
      message: `Montant (${amount} €) inférieur au plafond sans contact (${card.limits.contactlessPerTxLimit} €)`,
      responseCode: '00',
    });
  }

  // Step 7: Banking Monthly / Weekly Spending Limit Check
  const wouldExceedMonthlyLimit = card.spentThisMonth + amount > card.limits.paymentMonthlyLimit;

  checks.push({
    step: '7. PLAFOND_PAIEMENT',
    name: 'Contrôle Plafond Mensuel de Paiement',
    passed: overrideMode === 'force_61_limit' ? false : !wouldExceedMonthlyLimit,
    message: wouldExceedMonthlyLimit
      ? `Dépassement de plafond : Dépensé ${card.spentThisMonth} € + ${amount} € > Plafond mensuel ${card.limits.paymentMonthlyLimit} €`
      : `Plafond respecté (Consommé : ${card.spentThisMonth} € / ${card.limits.paymentMonthlyLimit} €)`,
    responseCode: wouldExceedMonthlyLimit ? '61' : '00',
  });

  if ((wouldExceedMonthlyLimit || overrideMode === 'force_61_limit') && overrideMode !== 'force_approve') {
    socketEvents.push({ time: nowStr(), event: `[REJET] Dépassement du plafond de paiement autorisé (${card.limits.paymentMonthlyLimit} €/mois)`, status: 'warn' });
    return finishWithDeclinedResponse('61', '61 - Dépassement du Plafond de Paiement Autorisé', checks, socketEvents, requestMti, fields, tpdu, incomingRrn, stan, pan, amount, currency, posEntry, terminalId, merchantName, startTime, card);
  }

  // Step 8: Account Balance / Available Funds Check
  const balanceBefore = card.accountBalance;
  const isBalanceSufficient = card.cardType === 'credit' ? true : balanceBefore >= amount;

  checks.push({
    step: '8. SOLDE_COMPTE',
    name: 'Contrôle Solde du Compte (Provision)',
    passed: overrideMode === 'force_51_balance' ? false : isBalanceSufficient,
    message: isBalanceSufficient
      ? `Solde suffisant (Disponible : ${balanceBefore.toFixed(2)} € pour un débit de ${amount.toFixed(2)} €)`
      : `Solde insuffisant : Disponible ${balanceBefore.toFixed(2)} € < Demandé ${amount.toFixed(2)} €`,
    responseCode: isBalanceSufficient ? '00' : '51',
  });

  if ((!isBalanceSufficient || overrideMode === 'force_51_balance') && overrideMode !== 'force_approve') {
    socketEvents.push({ time: nowStr(), event: `[REJET] Solde insuffisant : ${balanceBefore.toFixed(2)} € disponibles pour ${amount.toFixed(2)} € demandés`, status: 'warn' });
    return finishWithDeclinedResponse('51', '51 - Provision Insuffisante (Solde Insuffisant)', checks, socketEvents, requestMti, fields, tpdu, incomingRrn, stan, pan, amount, currency, posEntry, terminalId, merchantName, startTime, card);
  }

  // Step 9: EMV Cryptogram Check (ARQC Verification & ARPC Generation)
  let arpc: string | undefined = undefined;
  if (fields[55] || posEntry === '051') {
    const isEmvValid = true; // In sandbox mode, verified against card MDK-AC
    checks.push({
      step: '9. CRYPTO_EMV',
      name: 'Vérification ARQC & Calcul ARPC Émetteur',
      passed: isEmvValid,
      message: 'Cryptogramme ARQC validé avec la clé dérivée UDK-AC. Calcul du Tag 91 ARPC conforme.',
      responseCode: '00',
    });
    arpc = 'E821B0A423D190C1';
  }

  // ==========================================
  // TRANSACTION APPROVED (CODE 00)
  // ==========================================
  const authCode = `OK${Math.floor(1000 + Math.random() * 9000)}`;
  const balanceAfter = Math.round((balanceBefore - amount) * 100) / 100;

  // Update card balance & spent counters in database
  card.accountBalance = balanceAfter;
  card.spentThisMonth = Math.round((card.spentThisMonth + amount) * 100) / 100;
  card.spentThisWeek = Math.round((card.spentThisWeek + amount) * 100) / 100;
  card.spentToday = Math.round((card.spentToday + amount) * 100) / 100;
  card.pinTriesCount = 0; // Reset pin retry on success
  saveIssuerCard(card);

  // Build ISO 8583 Response
  const respMti = getResponseMti(requestMti);
  const respFields: Record<number, string> = {
    ...fields,
    37: incomingRrn,
    38: authCode,
    39: '00',
    // DE 54: Additional Amounts (Remaining Ledger Balance)
    54: `1001978C${Math.round(balanceAfter * 100).toString().padStart(12, '0')}`,
  };

  if (arpc) {
    respFields[55] = `8A023030910A${arpc}3030`;
  }

  const packed = packIso8583Message(respMti, respFields, tpdu);
  const endTime = performance.now();
  const latencyMs = Math.round(endTime - startTime) + Math.floor(60 + Math.random() * 60);

  socketEvents.push({ time: nowStr(), event: `[APPROBATION] Transaction approuvée avec succès ! Code d'autorisation : ${authCode}`, status: 'success' });
  socketEvents.push({ time: nowStr(), event: `[COMPTE] Solde débité de ${amount.toFixed(2)} € (Nouveau solde : ${balanceAfter.toFixed(2)} €)`, status: 'success' });
  socketEvents.push({ time: nowStr(), event: `[ÉMISSION] Envoi trame réponse MTI ${respMti} avec RRN ${incomingRrn}`, status: 'info' });

  const tx: IssuerTransactionEntity = {
    id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    rrn: incomingRrn,
    stan,
    mti: requestMti,
    responseMti: respMti,
    pan,
    maskedPan: maskPan(pan),
    cardholderName: card.cardholderName,
    amount,
    currency,
    responseCode: '00',
    responseDescription: '00 - Approuvé / Transaction Acceptée',
    approvalCode: authCode,
    status: 'APPROVED',
    transactionType: getTransactionTypeLabel(requestMti, posEntry, fields[3], terminalId),
    posEntryMode: posEntry,
    terminalId,
    merchantName,
    arpc,
    checks,
    balanceBefore,
    balanceAfter,
    timestamp: new Date().toISOString(),
    requestRawHex: packIso8583Message(requestMti, fields, tpdu).rawHex,
    responseRawHex: packed.rawHex,
    latencyMs,
  };
  recordIssuerTransaction(tx);

  return {
    response: {
      mti: respMti,
      responseCode: '00',
      responseDescription: '00 - Approuvé / Transaction Acceptée',
      authCode,
      arpc,
      fields: respFields,
      rawHex: packed.rawHex,
      latencyMs,
      timestamp: new Date().toLocaleTimeString('fr-FR'),
    },
    transaction: tx,
    checks,
    rawHex: packed.rawHex,
    socketEvents,
    card,
  };
}

/**
 * Helper to produce a declined response
 */
function finishWithDeclinedResponse(
  code: string,
  description: string,
  checks: ControlCheckResult[],
  socketEvents: { time: string; event: string; status: 'info' | 'success' | 'warn' | 'error' }[],
  requestMti: string,
  fields: Record<number, string>,
  tpdu: string,
  rrn: string,
  stan: string,
  pan: string,
  amount: number,
  currency: string,
  posEntry: string,
  terminalId: string,
  merchantName: string,
  startTime: number,
  card?: CardEntity
): IssuerProcessResult {
  const respMti = getResponseMti(requestMti);
  const respFields: Record<number, string> = {
    ...fields,
    37: rrn,
    39: code,
  };

  const packed = packIso8583Message(respMti, respFields, tpdu);
  const endTime = performance.now();
  const latencyMs = Math.round(endTime - startTime) + Math.floor(40 + Math.random() * 40);

  const tx: IssuerTransactionEntity = {
    id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    rrn,
    stan,
    mti: requestMti,
    responseMti: respMti,
    pan,
    maskedPan: maskPan(pan),
    cardholderName: card ? card.cardholderName : 'PORTEUR INCONNU',
    amount,
    currency,
    responseCode: code,
    responseDescription: description,
    status: 'DECLINED',
    transactionType: getTransactionTypeLabel(requestMti, posEntry, fields[3], terminalId),
    posEntryMode: posEntry,
    terminalId,
    merchantName,
    checks,
    balanceBefore: card ? card.accountBalance : 0,
    balanceAfter: card ? card.accountBalance : 0,
    timestamp: new Date().toISOString(),
    requestRawHex: packIso8583Message(requestMti, fields, tpdu).rawHex,
    responseRawHex: packed.rawHex,
    latencyMs,
  };
  recordIssuerTransaction(tx);

  return {
    response: {
      mti: respMti,
      responseCode: code,
      responseDescription: description,
      fields: respFields,
      rawHex: packed.rawHex,
      latencyMs,
      timestamp: new Date().toLocaleTimeString('fr-FR'),
    },
    transaction: tx,
    checks,
    rawHex: packed.rawHex,
    socketEvents,
    card,
  };
}
