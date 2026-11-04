import { SwitchResponse } from '../types/iso8583';
import {
  processAcquirerTransaction,
  AcquirerProcessResult,
  AcquirerOverrideMode,
} from './acquirerHostEngine';

export interface SimulationScenario {
  code: string;
  name: string;
  description: string;
  isApproval: boolean;
}

export const SIMULATION_SCENARIOS: SimulationScenario[] = [
  {
    code: 'auto',
    name: '⚡ Passerelle SAA ➔ Traitement SAE (Contrôles réels BDD)',
    description: 'Envoi au SAA qui valide le terminal, puis route vers le SAE qui contrôle la carte (solde, ARQC, plafonds). La réponse transite par le SAA qui la sauvegarde.',
    isApproval: true,
  },
  {
    code: '00',
    name: '00 - Accord Autorisation SAE (Transite via SAA)',
    description: 'Autorisation accordée par le SAE avec code DE 38 et cryptogramme ARPC, transitant par le SAA.',
    isApproval: true,
  },
  {
    code: '51',
    name: '51 - Refus SAE Provision Insuffisante (Transite via SAA)',
    description: 'Solde insuffisant ou plafond atteint au SAE. Décision retournée au SAA qui journalise le refus.',
    isApproval: false,
  },
  {
    code: '54',
    name: '54 - Refus SAE Carte Expirée (Transite via SAA)',
    description: 'Date de validité DE 14 expirée au SAE. Refus transmis à la passerelle SAA et persisté.',
    isApproval: false,
  },
  {
    code: '05',
    name: '05 - Refus SAE Ne Pas Honorer (Transite via SAA)',
    description: 'Blocage carte ou suspicion de fraude chez l\'émetteur SAE. Transite par le SAA.',
    isApproval: false,
  },
  {
    code: '61',
    name: '61 - Refus Dépassement Plafond (Contrôle SAA ou SAE)',
    description: 'Montant supérieur au plafond de transaction unitaire acquéreur ou émetteur.',
    isApproval: false,
  },
  {
    code: '14',
    name: '14 - Refus SAE Carte Invalide (Transite via SAA)',
    description: 'PAN inexistant dans le référentiel émetteur SAE. Transite par le SAA.',
    isApproval: false,
  },
  {
    code: '58',
    name: '58 - Rejet SAA Terminal Non Certifié (Arrêt au SAA)',
    description: 'Le terminal TID est rejeté lors du contrôle initial de la passerelle SAA.',
    isApproval: false,
  },
  {
    code: '03',
    name: '03 - Rejet SAA Commerçant Suspendu (Arrêt au SAA)',
    description: 'Le contrat commerçant MID est suspendu dans le parc de l\'acquéreur SAA.',
    isApproval: false,
  },
  {
    code: 'stip',
    name: '00 - Autorisation SAA Autonome (Stand-In STIP Acquéreur)',
    description: 'Autorisation accordée directement par le SAA sans appel au SAE sous le seuil floor limit.',
    isApproval: true,
  },
  {
    code: '91',
    name: '91 - Time-out Réseau SAA ➔ SAE (Émetteur Injoignable)',
    description: 'La passerelle SAA tente de joindre le SAE mais le délai d\'attente expire.',
    isApproval: false,
  },
];

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

export interface SimulationResult {
  response: SwitchResponse;
  rawHex: string;
  socketEvents: { time: string; event: string; status: 'info' | 'success' | 'warn' | 'error' }[];
  acquirerResult: AcquirerProcessResult;
}

/**
 * Simulates Full Network Processing:
 * Terminal ➔ Acquirer Server (SAA Gateway) ➔ Issuer Server (SAE Host) ➔ Transit via SAA ➔ Terminal.
 * SAA saves every transaction in its acquisition database.
 */
export async function simulateHostNetworkCall(
  requestMti: string,
  fields: Record<number, string>,
  tpdu: string = '6000010000',
  scenarioCode: string = 'auto'
): Promise<SimulationResult> {
  let overrideMode: AcquirerOverrideMode = 'normal';
  if (scenarioCode === '00') overrideMode = 'force_approve';
  else if (scenarioCode === '51') overrideMode = 'force_51_balance';
  else if (scenarioCode === '54') overrideMode = 'force_54_expired';
  else if (scenarioCode === '05') overrideMode = 'force_05_blocked';
  else if (scenarioCode === '61') overrideMode = 'force_61_terminal_limit';
  else if (scenarioCode === '14') overrideMode = 'force_14_card_invalid';
  else if (scenarioCode === '58') overrideMode = 'force_58_terminal_invalid';
  else if (scenarioCode === '03') overrideMode = 'force_03_merchant_blocked';
  else if (scenarioCode === 'stip') overrideMode = 'force_stip';
  else if (scenarioCode === '91') overrideMode = 'force_91_issuer_down';

  // 1. Transaction is dispatched to SAA (Serveur d'Autorisation Acquéreur)
  // 2. SAA checks terminal and routes as gateway to SAE (Serveur d'Autorisation Émetteur)
  // 3. SAE processes transaction (authorization/refusal)
  // 4. Response transits back through SAA
  // 5. SAA saves all transactions in its acquisition database (acquirer journal)
  const acqResult = await processAcquirerTransaction(requestMti, fields, tpdu, overrideMode);

  return {
    response: acqResult.response,
    rawHex: acqResult.rawHex,
    socketEvents: acqResult.socketEvents,
    acquirerResult: acqResult,
  };
}
