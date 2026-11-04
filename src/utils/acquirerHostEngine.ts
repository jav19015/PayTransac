import { SwitchResponse } from '../types/iso8583';
import { packIso8583Message } from './iso8583Packer';
import {
  getAcquirerTerminalByTid,
  recordAcquirerTransaction,
  MerchantTerminalEntity,
  AcquirerTransactionEntity,
  ControlCheckResult,
} from './acquirerDatabase';
import { processIssuerAuthorization, IssuerProcessResult } from './issuerHostEngine';

export interface AcquirerProcessResult {
  response: SwitchResponse;
  transaction: AcquirerTransactionEntity;
  checks: ControlCheckResult[];
  rawHex: string;
  socketEvents: { time: string; event: string; status: 'info' | 'success' | 'warn' | 'error' }[];
  terminal?: MerchantTerminalEntity;
  issuerResult?: IssuerProcessResult;
}

export type AcquirerOverrideMode =
  | 'normal'
  | 'force_approve'
  | 'force_stip'
  | 'force_58_terminal_invalid'
  | 'force_03_merchant_blocked'
  | 'force_61_terminal_limit'
  | 'force_51_balance'
  | 'force_54_expired'
  | 'force_05_blocked'
  | 'force_14_card_invalid'
  | 'force_91_issuer_down';

/**
 * Parses numeric amount from DE 4 (12 digits, cents)
 */
function parseIsoAmount(de4: string | undefined): number {
  if (!de4) return 0;
  const cleaned = de4.replace(/\D/g, '');
  if (!cleaned) return 0;
  const cents = parseInt(cleaned, 10);
  return isNaN(cents) ? 0 : cents / 100;
}

/**
 * Calculates response MTI from request MTI (e.g. 0100 -> 0110, 0200 -> 0210)
 */
function getResponseMti(requestMti: string): string {
  if (requestMti.length !== 4) return '0210';
  const prefix = requestMti.slice(0, 2);
  const suffix = requestMti.slice(3, 4);
  const thirdDigit = requestMti[2];

  let respThird = '1';
  if (thirdDigit === '2') respThird = '3';

  return `${prefix}${respThird}${suffix}`;
}

export function maskCardPan(pan: string): string {
  const clean = pan.replace(/\D/g, '');
  if (clean.length < 10) return clean;
  const first6 = clean.slice(0, 6);
  const last4 = clean.slice(-4);
  return `${first6.slice(0, 4)} ${first6.slice(4, 6)}** **** ${last4}`;
}

/**
 * Process a transaction received on the Acquirer Server (SAA)
 */
export async function processAcquirerTransaction(
  requestMti: string,
  fields: Record<number, string>,
  tpdu: string = '6000010000',
  overrideMode: AcquirerOverrideMode = 'normal'
): Promise<AcquirerProcessResult> {
  const startTime = performance.now();
  const socketEvents: { time: string; event: string; status: 'info' | 'success' | 'warn' | 'error' }[] = [];
  const checks: ControlCheckResult[] = [];

  const nowStr = () => new Date().toISOString().substring(11, 23);

  // 1. Connection Event
  socketEvents.push({
    time: nowStr(),
    event: `[CONNEXION SAA] Établissement session TCP/IP Terminal vers Serveur d'Autorisation Acquéreur (Port 4000)`,
    status: 'info',
  });
  socketEvents.push({
    time: nowStr(),
    event: `[RÉCEPTION TRAME] Trame ISO 8583 MTI ${requestMti} reçue - Analyse des champs commerçant & terminal...`,
    status: 'info',
  });

  // Extract key fields
  const processingCode = fields[3] || '000000';
  const isAtmOp = processingCode.startsWith('01');
  const defaultTid = isAtmOp ? 'DAB-OPERA-01' : 'TPE-FNAC-CHATELET';
  const defaultMid = isAtmOp ? 'MERCH-BNK-0012' : 'MERCH-FNAC-0084';
  const tid = (fields[41] || defaultTid).trim();
  const mid = (fields[42] || defaultMid).trim();
  const rawPan = (fields[2] || (fields[35] ? fields[35].split('=')[0] : '') || '5355221001234568').replace(/\D/g, '');
  const amount = parseIsoAmount(fields[4]);
  const stan = fields[11] || `${Math.floor(100000 + Math.random() * 900000)}`;
  const rrn = fields[37] || `${new Date().getFullYear().toString().slice(-2)}${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  const respMti = getResponseMti(requestMti);
  const mcc = fields[18] || '6011';
  const currency = fields[49] || '978';

  // Determine transaction operation label
  let operationLabel = 'Demande financière standard';
  let isAtmWithdrawal = false;
  let atmSubtype: 'DAB' | 'GAB' | undefined = undefined;

  if (processingCode.startsWith('01')) {
    isAtmWithdrawal = true;
    if (tid.toUpperCase().includes('GAB')) {
      operationLabel = 'Retrait GAB [MTI 0100/GAB]';
      atmSubtype = 'GAB';
    } else {
      operationLabel = 'Retrait DAB [MTI 0100/DAB]';
      atmSubtype = 'DAB';
    }
  } else if (requestMti === '0100') {
    operationLabel = 'Demande d\'autorisation préalable [MTI 0100]';
  } else if (requestMti === '0200') {
    if (fields[22] === '071' || fields[22]?.startsWith('07')) {
      operationLabel = 'Paiement TPE Sans Contact [0200]';
    } else if (fields[22] === '051' || fields[22]?.startsWith('05')) {
      operationLabel = 'Paiement TPE Contact EMV [0200]';
    } else {
      operationLabel = 'Paiement TPE Standard [0200]';
    }
  } else if (requestMti.startsWith('04')) {
    operationLabel = 'Redressement / Annulation [MTI 0400]';
  } else if (requestMti.startsWith('05')) {
    operationLabel = 'Télécollecte / Clôture [MTI 0500]';
  }

  // Find terminal in Acquirer database
  const terminal = getAcquirerTerminalByTid(tid);

  let responseCode = '00';
  let responseDesc = 'Transaction autorisée par acquéreur';
  let approvalCode: string | undefined = undefined;
  let routingDest: 'SAE_INTERNAL' | 'SWITCH_VISA_MC' | 'STIP_ACQUIRER' = 'SAE_INTERNAL';
  let issuerResult: IssuerProcessResult | undefined = undefined;
  let isApproved = false;

  // CHECK 1: Terminal Identification (DE 41)
  if (overrideMode === 'force_58_terminal_invalid') {
    checks.push({
      step: '1',
      name: 'Contrôle Terminal ID (DE 41)',
      passed: false,
      message: `Terminal TID [${tid}] rejeté : terminal non certifié ou désactivé au SAA`,
      responseCode: '58',
    });
    responseCode = '58';
    responseDesc = 'Transaction interdite au terminal (TID invalide)';
    socketEvents.push({
      time: nowStr(),
      event: `[SÉCURITÉ SAA] Erreur DE 41 : Terminal [${tid}] inconnu dans le parc acquéreur`,
      status: 'error',
    });
  } else if (!terminal) {
    checks.push({
      step: '1',
      name: 'Contrôle Terminal ID (DE 41)',
      passed: true,
      message: `Terminal TID [${tid}] accepté en mode dynamique auto-enrôlé`,
      responseCode: '00',
    });
    socketEvents.push({
      time: nowStr(),
      event: `[SAA REGISTRY] TID [${tid}] enregistré dynamiquement dans la base acquéreur`,
      status: 'info',
    });
  } else {
    checks.push({
      step: '1',
      name: 'Contrôle Terminal ID (DE 41)',
      passed: true,
      message: `Terminal TID [${terminal.tid}] reconnu (${terminal.type} - ${terminal.merchantName})`,
      responseCode: '00',
    });
    socketEvents.push({
      time: nowStr(),
      event: `[SAA REGISTRY] TID [${terminal.tid}] validé - Type ${terminal.type} (${terminal.locationCity})`,
      status: 'success',
    });
  }

  // CHECK 2: Merchant ID & Status (DE 42)
  if (responseCode === '00') {
    if (overrideMode === 'force_03_merchant_blocked') {
      checks.push({
        step: '2',
        name: 'Contrôle Marchand MID (DE 42)',
        passed: false,
        message: `Commerçant MID [${mid}] suspendu pour impayé ou clôture administrative`,
        responseCode: '03',
      });
      responseCode = '03';
      responseDesc = 'Commerçant invalide / Compte acquéreur bloqué';
      socketEvents.push({
        time: nowStr(),
        event: `[SÉCURITÉ SAA] Erreur DE 42 : Contrat commerçant [${mid}] suspendu`,
        status: 'error',
      });
    } else if (terminal && terminal.status !== 'ACTIVE') {
      checks.push({
        step: '2',
        name: 'Contrôle Statut Marchand',
        passed: false,
        message: `Statut du terminal commerçant : ${terminal.status}`,
        responseCode: '03',
      });
      responseCode = '03';
      responseDesc = 'Terminal temporairement suspendu par l\'acquéreur';
    } else {
      checks.push({
        step: '2',
        name: 'Contrôle Marchand MID (DE 42)',
        passed: true,
        message: `Contrat acquéreur valide pour ${terminal ? terminal.merchantName : mid}`,
        responseCode: '00',
      });
    }
  }

  // CHECK 3: Operation compatibility (DAB/GAB vs POS)
  if (responseCode === '00') {
    if (isAtmWithdrawal && terminal && terminal.type !== 'ATM') {
      checks.push({
        step: '3',
        name: 'Compatibilité Opération / Matériel',
        passed: false,
        message: `Opération de Retrait DAB/GAB impossible sur un TPE marchand (${terminal.type})`,
        responseCode: '58',
      });
      responseCode = '58';
      responseDesc = 'Type de transaction incompatible avec la configuration terminal';
      socketEvents.push({
        time: nowStr(),
        event: `[RÈGLE SAA] Rejet : Retrait d'espèces interdit sur terminal de type POS`,
        status: 'error',
      });
    } else {
      checks.push({
        step: '3',
        name: 'Compatibilité Opération / Matériel',
        passed: true,
        message: isAtmWithdrawal
          ? `Autorisation Retrait ${atmSubtype || 'DAB'} valide sur automate bancaire`
          : `Paiement commerçant conforme aux spécifications d'acquisition`,
        responseCode: '00',
      });
    }
  }

  // CHECK 4: Terminal Limits (DE 4)
  if (responseCode === '00') {
    const maxTx = terminal ? terminal.maxSingleTx : 5000;
    const dailyLimit = terminal ? terminal.dailyLimit : 100000;
    const spentToday = terminal ? terminal.spentToday : 0;

    if (overrideMode === 'force_61_terminal_limit' || amount > maxTx) {
      checks.push({
        step: '4',
        name: 'Plafonds Acquéreur Terminal',
        passed: false,
        message: `Montant (${amount.toFixed(2)} €) supérieur au plafond unitaire autorisé (${maxTx.toFixed(2)} €)`,
        responseCode: '61',
      });
      responseCode = '61';
      responseDesc = 'Dépassement du plafond de transaction unitaire acquéreur';
      socketEvents.push({
        time: nowStr(),
        event: `[CONTRÔLE PLAFOND SAA] Montant unitaire ${amount} € > Plafond ${maxTx} €`,
        status: 'warn',
      });
    } else if (spentToday + amount > dailyLimit) {
      checks.push({
        step: '4',
        name: 'Plafond Journalier Terminal',
        passed: false,
        message: `Cumul journalier (${(spentToday + amount).toFixed(2)} €) supérieur au seuil journalier (${dailyLimit.toFixed(2)} €)`,
        responseCode: '61',
      });
      responseCode = '61';
      responseDesc = 'Plafond cumulatif journalier commerçant atteint';
    } else {
      checks.push({
        step: '4',
        name: 'Plafonds Acquéreur Terminal',
        passed: true,
        message: `Montant ${amount.toFixed(2)} € dans les limites autorisées (Max: ${maxTx.toFixed(2)} €)`,
        responseCode: '00',
      });
    }
  }

  // CHECK 5: Routing & SAE Call
  if (responseCode === '00') {
    if (overrideMode === 'force_stip' || (terminal && terminal.defaultRouting === 'STAND_IN_STIP')) {
      routingDest = 'STIP_ACQUIRER';
      responseCode = '00';
      approvalCode = `STIP${Math.floor(10 + Math.random() * 90)}`;
      responseDesc = 'Autorisé en mode Stand-In Acquéreur (STIP Floor Limit)';
      isApproved = true;
      checks.push({
        step: '5',
        name: 'Routage & Décision d\'Acquisition',
        passed: true,
        message: `Accord accordé localement en mode autonome Stand-In Acquéreur (STIP - Code: ${approvalCode})`,
        responseCode: '00',
      });
      socketEvents.push({
        time: nowStr(),
        event: `[STIP ACQUÉREUR] Autorisation locale autonome accordée (Code: ${approvalCode})`,
        status: 'info',
      });
    } else if (overrideMode === 'force_91_issuer_down') {
      routingDest = 'SAE_INTERNAL';
      responseCode = '91';
      responseDesc = 'Émetteur ou commutateur injoignable (Time-out réseau)';
      checks.push({
        step: '5',
        name: 'Routage vers le SAE',
        passed: false,
        message: 'Timeout : Le Serveur d\'Autorisation Émetteur n\'a pas répondu dans le délai imparti',
        responseCode: '91',
      });
      socketEvents.push({
        time: nowStr(),
        event: `[TIMEOUT ROUTAGE] Pas de réponse du SAE après 3000ms`,
        status: 'error',
      });
    } else {
      // Direct Interconnection with SAE (Serveur d'Autorisation Émetteur) via SAA Gateway
      routingDest = 'SAE_INTERNAL';
      socketEvents.push({
        time: nowStr(),
        event: `[PASSERELLE SAA -> SAE] Routage passerelle : transmission de la trame MTI ${requestMti} au Serveur d'Autorisation Émetteur (Port 5000)...`,
        status: 'info',
      });

      let saeOverride: any = 'normal';
      let effectiveFields = { ...fields };
      if (overrideMode === 'force_approve') saeOverride = 'force_approve';
      else if (overrideMode === 'force_51_balance') saeOverride = 'force_51_balance';
      else if (overrideMode === 'force_54_expired') saeOverride = 'force_54_expired';
      else if (overrideMode === 'force_05_blocked') saeOverride = 'force_05_blocked';
      else if (overrideMode === 'force_61_terminal_limit') saeOverride = 'force_61_limit';
      else if (overrideMode === 'force_14_card_invalid') {
        effectiveFields[2] = '4970009999999999'; // Inconnu en base
      }

      try {
        const saeResult = await processIssuerAuthorization(
          requestMti,
          effectiveFields,
          tpdu,
          saeOverride
        );
        issuerResult = saeResult;

        responseCode = saeResult.transaction.responseCode;
        responseDesc = saeResult.transaction.responseDescription;
        approvalCode = saeResult.transaction.approvalCode;
        isApproved = saeResult.transaction.status === 'APPROVED';

        checks.push({
          step: '5',
          name: 'Routage & Décision SAE Émetteur',
          passed: isApproved,
          message: isApproved
            ? `Accord SAE Émetteur reçu avec succès (RC ${responseCode} - Auth: ${approvalCode || 'OK'})`
            : `Refus émis par le SAE Émetteur : ${responseDesc} (Code ${responseCode})`,
          responseCode,
        });

        socketEvents.push({
          time: nowStr(),
          event: `[RÉPONSE DU SAE REÇUE PAR SAA] Décision SAE : Code DE 39 [${responseCode}] (${responseDesc})${approvalCode ? ' [Auth: ' + approvalCode + ']' : ''}`,
          status: isApproved ? 'success' : 'warn',
        });

        socketEvents.push({
          time: nowStr(),
          event: `[SAUVEGARDE SAA] Enregistrement de la transaction dans la base d'acquisition SAA (TID: ${tid}, RRN: ${rrn}, Montant: ${amount.toFixed(2)} €)`,
          status: 'info',
        });

        socketEvents.push({
          time: nowStr(),
          event: `[TRANSIT SAA -> TERMINAL] Transit de la trame de réponse MTI ${respMti} vers le terminal ${tid}`,
          status: isApproved ? 'success' : 'warn',
        });
      } catch (err: any) {
        responseCode = '96';
        responseDesc = 'Erreur système lors de la communication inter-serveurs';
        checks.push({
          step: '5',
          name: 'Routage SAE Émetteur',
          passed: false,
          message: `Échec de communication avec le SAE : ${err?.message || 'Erreur inconnue'}`,
          responseCode: '96',
        });
        socketEvents.push({
          time: nowStr(),
          event: `[ERREUR SAA -> SAE] Échec de transmission au SAE (${err?.message || 'Inconnu'})`,
          status: 'error',
        });
      }
    }
  }

  // Calculate Acquirer Fee (MDR)
  const feePercent = terminal ? terminal.feePercent : 0.75;
  const feeFixed = terminal ? terminal.feeFixed : 0.05;
  const acquirerFee = isApproved ? Math.round(((amount * feePercent) / 100 + feeFixed) * 100) / 100 : 0.0;

  // Final status
  let finalStatus: 'APPROVED' | 'DECLINED' | 'STIP' | 'ROUTED_SAE' | 'REVERSED' = 'DECLINED';
  if (responseCode === '00') {
    finalStatus = routingDest === 'STIP_ACQUIRER' ? 'STIP' : 'APPROVED';
  } else if (requestMti.startsWith('04')) {
    finalStatus = 'REVERSED';
  }

  // Build ISO response
  const respFields: Record<number, string> = {
    ...fields,
    39: responseCode,
  };
  if (approvalCode) {
    respFields[38] = approvalCode;
  }
  if (!respFields[37]) {
    respFields[37] = rrn;
  }

  const packedResp = packIso8583Message(respMti, respFields, tpdu);
  const packedReq = packIso8583Message(requestMti, fields, tpdu);

  const endTime = performance.now();
  const latencyMs = Math.round(endTime - startTime + Math.floor(Math.random() * 40 + 20));

  socketEvents.push({
    time: nowStr(),
    event: `[RÉPONSE SAA -> TERMINAL] Trame retour MTI ${respMti} transmise au terminal ${tid} (${latencyMs}ms)`,
    status: isApproved ? 'success' : 'warn',
  });

  const transactionRecord: AcquirerTransactionEntity = {
    id: `acq-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    rrn,
    stan,
    mti: requestMti,
    responseMti: respMti,
    tid,
    mid,
    merchantName: terminal ? terminal.merchantName : fields[43] || 'COMMERCE TEST ACQ',
    terminalType: terminal ? terminal.type : isAtmWithdrawal ? 'ATM' : 'POS',
    atmSubtype,
    mcc,
    operationLabel,
    pan: rawPan,
    maskedPan: maskCardPan(rawPan),
    amount,
    currency,
    routingDestination: routingDest,
    responseCode,
    responseDescription: responseDesc,
    approvalCode,
    acquirerFee,
    status: finalStatus,
    checks,
    timestamp: new Date().toISOString(),
    latencyMs,
    requestRawHex: packedReq.rawHex,
    responseRawHex: packedResp.rawHex,
  };

  // Persist transaction and update terminal daily totals
  recordAcquirerTransaction(transactionRecord);

  const switchResponse: SwitchResponse = {
    mti: respMti,
    responseCode,
    responseDescription: responseDesc,
    authCode: approvalCode,
    latencyMs,
    rawHex: packedResp.rawHex,
    fields: respFields,
    timestamp: new Date().toISOString(),
  };

  return {
    response: switchResponse,
    transaction: transactionRecord,
    checks,
    rawHex: packedResp.rawHex,
    socketEvents,
    terminal,
    issuerResult,
  };
}
