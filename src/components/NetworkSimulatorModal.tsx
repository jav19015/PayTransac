import React, { useState } from 'react';
import { SIMULATION_SCENARIOS, simulateHostNetworkCall, SimulationResult } from '../utils/networkSimulator';
import {
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Server,
  Terminal,
  ArrowRight,
  ArrowLeftRight,
  X,
  Sparkles,
  Building2,
  Database,
  ShieldCheck,
  Check,
  ExternalLink,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatHexOctets } from '../utils/bitmapEngine';

interface NetworkSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  mti: string;
  fields: Record<number, string>;
  tpdu: string;
  onNavigateToSaa?: () => void;
  onNavigateToSae?: () => void;
}

export const NetworkSimulatorModal: React.FC<NetworkSimulatorModalProps> = ({
  isOpen,
  onClose,
  mti,
  fields,
  tpdu,
  onNavigateToSaa,
  onNavigateToSae,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<string>('auto');
  const [selectedGateway, setSelectedGateway] = useState<string>('SAA_INTERNAL');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [socketLogs, setSocketLogs] = useState<{ time: string; event: string; status: 'info' | 'success' | 'warn' | 'error' }[]>([]);
  const [showChecksDetails, setShowChecksDetails] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleSend = async () => {
    setIsLoading(true);
    setSimulationResult(null);
    setSocketLogs([]);

    try {
      const res = await simulateHostNetworkCall(mti, fields, tpdu, selectedScenario);
      setSimulationResult(res);
      setSocketLogs(res.socketEvents);
    } catch (err) {
      console.error('Erreur simulation réseau SAA -> SAE', err);
    } finally {
      setIsLoading(false);
    }
  };

  const currentScenarioObj = SIMULATION_SCENARIOS.find((s) => s.code === selectedScenario);
  const responseResult = simulationResult?.response;
  const acqResult = simulationResult?.acquirerResult;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl relative my-6 max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-indigo-600 border border-emerald-500/30 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 flex-shrink-0">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-100">
                Simulateur d'Émission Réseau Bancaire
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Architecture SAA ➔ SAE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Acheminement via le <strong>Serveur d'Autorisation Acquéreur (SAA)</strong> comme passerelle vers le <strong>Serveur d'Autorisation Émetteur (SAE)</strong>.
            </p>
          </div>
        </div>

        {/* Routing Architecture Visualizer Banner */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 mb-4">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Chaîne de Traitement & Sauvegarde des Transactions :
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
            {/* Step 1: Terminal */}
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                1
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-200 truncate">Terminal Émetteur</div>
                <div className="text-[11px] text-slate-400 font-mono truncate">
                  {fields[41] ? `TID: ${fields[41]}` : 'TPE / DAB Client'} • MTI {mti}
                </div>
              </div>
            </div>

            {/* Step 2: SAA Gateway */}
            <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-700/60 flex items-center gap-2.5 relative">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                2
              </div>
              <div className="min-w-0">
                <div className="font-bold text-emerald-300 flex items-center gap-1">
                  <span>Passerelle SAA (Acquéreur)</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <div className="text-[11px] text-emerald-400/80 truncate">
                  Contrôles acquéreur + Sauvegarde BDD
                </div>
              </div>
            </div>

            {/* Step 3: SAE Issuer */}
            <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-700/60 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                3
              </div>
              <div className="min-w-0">
                <div className="font-bold text-indigo-300 flex items-center gap-1">
                  <span>Serveur SAE (Émetteur)</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                </div>
                <div className="text-[11px] text-indigo-400/80 truncate">
                  Autorisation solde, carte & ARQC
                </div>
              </div>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
            <Database className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>
              <strong>Règle d'or :</strong> Toutes les trames ISO 8583 transitent par le SAA et sont <strong>intégralement sauvegardées</strong> dans le journal d'acquisition SAA.
            </span>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="overflow-y-auto space-y-4 pr-1">
          {/* Configuration Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                Passerelle Acquéreur Réceptrice (SAA) :
              </label>
              <select
                value={selectedGateway}
                onChange={(e) => setSelectedGateway(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 hover:border-emerald-500 focus:border-emerald-400 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none font-sans"
              >
                <option value="SAA_INTERNAL">Passerelle SAA (Port 4000) ➔ Routage SAE (Port 5000)</option>
                <option value="CB2A_FRANCE">GIE Cartes Bancaires (Switch CB2A Acquéreur)</option>
                <option value="VISA_BASE_I">Visa Base I VIP Acquirer Interconnect</option>
                <option value="MC_BANKNET">Mastercard BankNet Worldwide Acquirer</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Scénario de Test / Simulation :
              </label>
              <select
                value={selectedScenario}
                onChange={(e) => setSelectedScenario(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 hover:border-indigo-500 focus:border-indigo-400 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none font-sans"
              >
                {SIMULATION_SCENARIOS.map((sc) => (
                  <option key={sc.code} value={sc.code}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {currentScenarioObj && (
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 text-xs text-slate-400 flex items-start gap-2">
              <span className="font-semibold text-slate-300 whitespace-nowrap">Comportement :</span>
              <span>{currentScenarioObj.description}</span>
            </div>
          )}

          {/* Action Button */}
          <div>
            <button
              onClick={handleSend}
              disabled={isLoading}
              className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
                isLoading
                  ? 'bg-emerald-900/60 text-emerald-200 cursor-wait border border-emerald-700'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white shadow-emerald-500/20 active:scale-[0.99]'
              }`}
            >
              {isLoading ? (
                <>
                  <Clock className="w-4 h-4 animate-spin text-emerald-300" />
                  <span>Acheminement vers le SAA ➔ Routage SAE en cours...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>
                    Émettre la Trame ({mti}) vers le SAA (Passerelle Acquéreur ➔ SAE)
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Real-time Socket & Routing Terminal Logs */}
          {socketLogs.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  Journal de Connexion Socket TCP & Routage Inter-Serveurs :
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {socketLogs.length} événements enregistrés
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] space-y-1.5 max-h-44 overflow-y-auto">
                {socketLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-slate-600 select-none flex-shrink-0">[{log.time}]</span>
                    <span
                      className={`break-words ${
                        log.status === 'success'
                          ? 'text-emerald-400 font-medium'
                          : log.status === 'warn'
                          ? 'text-amber-400'
                          : log.status === 'error'
                          ? 'text-red-400 font-bold'
                          : 'text-slate-300'
                      }`}
                    >
                      {log.event}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Response & Transit Card */}
          {responseResult && acqResult && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
              {/* Header Status */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  {responseResult.responseCode === '00' ? (
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center">
                      <XCircle className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100">
                        Réponse Reçue au Terminal : MTI {responseResult.mti}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                          responseResult.responseCode === '00'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}
                      >
                        Code {responseResult.responseCode}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{responseResult.responseDescription}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Latence globale : <strong className="text-cyan-300 font-mono">{responseResult.latencyMs} ms</strong></span>
                  </div>
                </div>
              </div>

              {/* SAA Persistence & Gateway Confirmation Banner */}
              <div className="bg-emerald-950/40 border border-emerald-700/60 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center flex-shrink-0">
                    <Database className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <span>Transaction sauvegardée dans le SAA</span>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <p className="text-slate-300 text-[11px]">
                      ID : <span className="font-mono text-cyan-300">{acqResult.transaction.id}</span> • RRN : <span className="font-mono text-slate-200">{acqResult.transaction.rrn}</span> • Commerçant : <span className="text-slate-200">{acqResult.transaction.merchantName}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onNavigateToSaa && (
                    <button
                      onClick={onNavigateToSaa}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors shadow-sm"
                      title="Ouvrir le Serveur d'Autorisation Acquéreur (SAA) et consulter le journal"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Voir dans le SAA</span>
                      <ExternalLink className="w-3 h-3 ml-0.5" />
                    </button>
                  )}
                  {onNavigateToSae && (
                    <button
                      onClick={onNavigateToSae}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors shadow-sm"
                      title="Ouvrir le Serveur d'Autorisation Émetteur (SAE)"
                    >
                      <Server className="w-3.5 h-3.5" />
                      <span>Voir dans le SAE</span>
                      <ExternalLink className="w-3 h-3 ml-0.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Key Response Fields */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">DE 39 - Statut :</span>
                  <span className="font-semibold text-slate-200 truncate block">
                    {responseResult.responseDescription}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">DE 38 - Autorisation :</span>
                  <span className="font-mono font-bold text-cyan-300">
                    {responseResult.authCode || <span className="text-slate-500 font-normal">N/A (Refus)</span>}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">DE 37 - Numéro RRN :</span>
                  <span className="font-mono text-slate-300">{responseResult.fields[37] || 'N/A'}</span>
                </div>
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Commission SAA (MDR) :</span>
                  <span className="font-mono text-emerald-400 font-semibold block">
                    {acqResult.transaction.acquirerFee > 0
                      ? `${acqResult.transaction.acquirerFee.toFixed(2)} €`
                      : '0.00 €'}
                  </span>
                </div>
              </div>

              {/* Checks & Controls Accordion */}
              <div>
                <button
                  onClick={() => setShowChecksDetails(!showChecksDetails)}
                  className="w-full flex items-center justify-between text-xs text-slate-300 font-semibold py-1 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Détail des 5 Contrôles de la Passerelle SAA & Traitement SAE ({acqResult.checks.length}) :
                  </span>
                  {showChecksDetails ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {showChecksDetails && (
                  <div className="mt-2 space-y-1.5">
                    {acqResult.checks.map((check, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                          check.passed
                            ? 'bg-slate-900/60 border-slate-800 text-slate-300'
                            : 'bg-red-950/30 border-red-800/60 text-red-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {check.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                          )}
                          <span className="font-semibold text-slate-200">
                            Étape {check.step} — {check.name} :
                          </span>
                          <span className="truncate text-slate-400">{check.message}</span>
                        </div>
                        {check.responseCode && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-300 flex-shrink-0">
                            RC {check.responseCode}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Response Raw Hex */}
              <div>
                <span className="text-slate-400 block text-[10px] mb-1">
                  Trame réponse ISO 8583 brute retournée au terminal (Hex) :
                </span>
                <div className="p-2.5 rounded bg-slate-900 font-mono text-[11px] text-cyan-300/90 break-all select-all max-h-20 overflow-y-auto border border-slate-800">
                  {responseResult.rawHex}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
