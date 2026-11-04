import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Clock,
  Send,
  Sliders,
  Database,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Layers,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Info,
  Terminal,
  Zap,
  Store,
  MapPin,
  Cpu,
  Plus,
  Edit2,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  getAcquirerTerminals,
  getAcquirerTransactions,
  saveAcquirerTerminal,
  clearAllAcquirerTransactions,
  resetAcquirerDatabaseToSeeds,
  MerchantTerminalEntity,
  AcquirerTransactionEntity,
} from '../utils/acquirerDatabase';
import {
  processAcquirerTransaction,
  AcquirerOverrideMode,
  AcquirerProcessResult,
} from '../utils/acquirerHostEngine';
import { formatHexOctets } from '../utils/bitmapEngine';

export interface AcquirerServerPageProps {
  onInjectTerminalIntoIso?: (terminal: MerchantTerminalEntity) => void;
  onNavigateToDesigner: () => void;
  onNavigateToSae: () => void;
  currentIsoFields?: Record<number, string>;
  currentIsoMti?: string;
}

export const AcquirerServerPage: React.FC<AcquirerServerPageProps> = ({
  onInjectTerminalIntoIso,
  onNavigateToDesigner,
  onNavigateToSae,
  currentIsoFields = {},
  currentIsoMti = '0100',
}) => {
  // Navigation inside SAA - Default tab: 'journal' (Journal d'Acquisition)
  const [serverSubTab, setServerSubTab] = useState<'journal' | 'terminals' | 'supervision'>('journal');

  // Terminals & Transactions data
  const [terminals, setTerminals] = useState<MerchantTerminalEntity[]>(() => getAcquirerTerminals());
  const [transactions, setTransactions] = useState<AcquirerTransactionEntity[]>(() => getAcquirerTransactions());
  const [selectedTx, setSelectedTx] = useState<AcquirerTransactionEntity | null>(null);

  // Reception Simulator State
  const [selectedPresetOp, setSelectedPresetOp] = useState<string>('atm_dab');
  const [selectedTid, setSelectedTid] = useState<string>(terminals[0]?.tid || 'DAB-OPERA-01');
  const [testMti, setTestMti] = useState<string>('0100');
  const [testPan, setTestPan] = useState<string>('5355221001234568');
  const [testAmount, setTestAmount] = useState<string>('150.00');
  const [testPosEntry, setTestPosEntry] = useState<string>('901');
  const [testProcessingCode, setTestProcessingCode] = useState<string>('010000');
  const [overrideMode, setOverrideMode] = useState<AcquirerOverrideMode>('normal');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastProcessResult, setLastProcessResult] = useState<AcquirerProcessResult | null>(null);

  // Terminal Modal Edit / Add
  const [editingTerminal, setEditingTerminal] = useState<MerchantTerminalEntity | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newTerminalForm, setNewTerminalForm] = useState<Partial<MerchantTerminalEntity>>({
    tid: 'TPE-NOUVEAU-01',
    mid: 'MERCH-NEW-9988',
    merchantName: 'BOUTIQUE NOUVELLE PARIS',
    type: 'POS',
    mcc: '5411',
    locationCity: 'Paris',
    countryCode: '250',
    currencyCode: '978',
    status: 'ACTIVE',
    dailyLimit: 30000,
    maxSingleTx: 1500,
    feePercent: 0.8,
    feeFixed: 0.05,
    defaultRouting: 'DIRECT_SAE',
  });

  // Filters for Transactions Table
  const [statusFilter, setStatusFilter] = useState<'all' | 'APPROVED' | 'DECLINED' | 'STIP'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [terminalTypeFilter, setTerminalTypeFilter] = useState<'all' | 'ATM' | 'POS' | 'ECOM'>('all');

  // Sync with localStorage on events
  useEffect(() => {
    const handleUpdate = () => {
      setTerminals(getAcquirerTerminals());
      setTransactions(getAcquirerTransactions());
    };
    window.addEventListener('acquirer-db-updated', handleUpdate);
    return () => window.removeEventListener('acquirer-db-updated', handleUpdate);
  }, []);

  // Set default selected transaction
  useEffect(() => {
    if (transactions.length > 0 && !selectedTx) {
      setSelectedTx(transactions[0]);
    } else if (selectedTx) {
      const refreshed = transactions.find((t) => t.id === selectedTx.id);
      if (refreshed) setSelectedTx(refreshed);
    }
  }, [transactions]);

  // Handle operation preset change
  const handleSelectOperationPreset = (presetKey: string) => {
    setSelectedPresetOp(presetKey);
    if (presetKey === 'atm_dab') {
      setTestMti('0100');
      setTestProcessingCode('010000');
      setTestPosEntry('901');
      setTestAmount('150.00');
      const dabTerm = terminals.find((t) => t.atmSubtype === 'DAB') || terminals[0];
      if (dabTerm) setSelectedTid(dabTerm.tid);
    } else if (presetKey === 'atm_gab') {
      setTestMti('0100');
      setTestProcessingCode('010000');
      setTestPosEntry('901');
      setTestAmount('200.00');
      const gabTerm = terminals.find((t) => t.atmSubtype === 'GAB') || terminals[1];
      if (gabTerm) setSelectedTid(gabTerm.tid);
    } else if (presetKey === 'pos_emv') {
      setTestMti('0200');
      setTestProcessingCode('000000');
      setTestPosEntry('051');
      setTestAmount('89.90');
      const posTerm = terminals.find((t) => t.type === 'POS') || terminals[2];
      if (posTerm) setSelectedTid(posTerm.tid);
    } else if (presetKey === 'pos_nfc') {
      setTestMti('0200');
      setTestProcessingCode('000000');
      setTestPosEntry('071');
      setTestAmount('34.50');
      const posTerm = terminals.find((t) => t.type === 'POS') || terminals[3];
      if (posTerm) setSelectedTid(posTerm.tid);
    } else if (presetKey === 'ecom') {
      setTestMti('0100');
      setTestProcessingCode('000000');
      setTestPosEntry('012');
      setTestAmount('129.00');
      const ecomTerm = terminals.find((t) => t.type === 'ECOM') || terminals[5];
      if (ecomTerm) setSelectedTid(ecomTerm.tid);
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    const total = transactions.length;
    const approved = transactions.filter((t) => t.status === 'APPROVED' || t.status === 'STIP').length;
    const declined = transactions.filter((t) => t.status === 'DECLINED').length;
    const stipCount = transactions.filter((t) => t.status === 'STIP').length;
    const atmCount = transactions.filter((t) => t.terminalType === 'ATM').length;
    const posCount = transactions.filter((t) => t.terminalType === 'POS').length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 100;
    const totalVolume = transactions
      .filter((t) => t.status === 'APPROVED' || t.status === 'STIP')
      .reduce((acc, t) => acc + t.amount, 0);
    const totalFees = transactions
      .filter((t) => t.status === 'APPROVED' || t.status === 'STIP')
      .reduce((acc, t) => acc + t.acquirerFee, 0);

    return { total, approved, declined, stipCount, atmCount, posCount, approvalRate, totalVolume, totalFees };
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'APPROVED' && t.status !== 'APPROVED') return false;
        if (statusFilter === 'DECLINED' && t.status !== 'DECLINED') return false;
        if (statusFilter === 'STIP' && t.status !== 'STIP') return false;
      }
      if (terminalTypeFilter !== 'all' && t.terminalType !== terminalTypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().replace(/\s/g, '');
        const matchTid = t.tid.toLowerCase().includes(q);
        const matchMid = t.mid.toLowerCase().includes(q);
        const matchName = t.merchantName.toLowerCase().includes(q);
        const matchPan = t.pan.toLowerCase().includes(q) || t.maskedPan.toLowerCase().includes(q);
        const matchRrn = t.rrn.toLowerCase().includes(q);
        if (!matchTid && !matchMid && !matchName && !matchPan && !matchRrn) return false;
      }
      return true;
    });
  }, [transactions, statusFilter, terminalTypeFilter, searchQuery]);

  // Execute terminal reception test against SAA
  const handleRunReceptionTest = async () => {
    setIsProcessing(true);
    setLastProcessResult(null);

    const activeTerminal = terminals.find((t) => t.tid === selectedTid) || terminals[0];

    // Format amount into 12 digits
    const cents = Math.round(parseFloat(testAmount.replace(',', '.')) * 100);
    const amountPadded = cents.toString().padStart(12, '0');
    const stan = `${Math.floor(100000 + Math.random() * 900000)}`;
    const rrn = `${new Date().getFullYear().toString().slice(-2)}${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    const fields: Record<number, string> = {
      2: testPan,
      3: testProcessingCode,
      4: amountPadded,
      7: '1102153000',
      11: stan,
      12: '153000',
      13: '1102',
      18: activeTerminal ? activeTerminal.mcc : '6011',
      22: testPosEntry,
      37: rrn,
      41: activeTerminal ? activeTerminal.tid : selectedTid,
      42: activeTerminal ? activeTerminal.mid : 'MERCH-BNK-0012',
      43: activeTerminal ? activeTerminal.merchantName : 'COMMERCE ACQ PARIS',
      49: activeTerminal ? activeTerminal.currencyCode : '978',
    };

    if (testPosEntry === '051') {
      fields[55] = '9F26084AE7891230BCAE129F3602001C9F370438F9A102';
    }

    try {
      const res = await processAcquirerTransaction(testMti, fields, '6000010000', overrideMode);
      setLastProcessResult(res);
      setSelectedTx(res.transaction);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Ingest current Studio ISO frame directly into SAA reception
  const handleIngestStudioFrame = () => {
    if (currentIsoFields[2]) setTestPan(currentIsoFields[2]);
    if (currentIsoFields[4]) {
      const cents = parseInt(currentIsoFields[4].replace(/\D/g, ''), 10);
      if (!isNaN(cents)) setTestAmount((cents / 100).toFixed(2));
    }
    if (currentIsoFields[3]) setTestProcessingCode(currentIsoFields[3]);
    if (currentIsoFields[22]) setTestPosEntry(currentIsoFields[22]);
    if (currentIsoFields[41]) {
      const found = terminals.find((t) => t.tid === currentIsoFields[41]);
      if (found) setSelectedTid(found.tid);
    }
    if (currentIsoMti) setTestMti(currentIsoMti);
  };

  return (
    <div className="space-y-6">
      {/* HEADER BANNER SAA */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20 flex-shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  Serveur d'Autorisation Acquéreur (SAA)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Passerelle & Hôte Acquéreur En Ligne
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {terminals.length} Terminaux (TPE & DAB/GAB)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 max-w-2xl leading-relaxed">
                Réceptionne et contrôle les flux monétiques émis par les terminaux commerçants (TPE) et automates bancaires (DAB/GAB) : validation TID (DE 41), contrôle du contrat commerçant MID (DE 42), respect des plafonds de transaction, calcul des commissions (MDR) et routage intelligent vers le SAE (Émetteur) ou le Switch interbancaire.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => {
                if (confirm('Réinitialiser la base acquéreur avec les terminaux et transactions par défaut ?')) {
                  resetAcquirerDatabaseToSeeds();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Réinitialiser terminaux et transactions d'exemple"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset Données</span>
            </button>

            <button
              onClick={onNavigateToSae}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-950/70 text-indigo-300 border border-indigo-700/60 hover:bg-indigo-900/80 transition-colors"
              title="Aller vers le Serveur d'Autorisation Émetteur (SAE)"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              <span>Voir SAE (Émetteur)</span>
            </button>

            <button
              onClick={onNavigateToDesigner}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/50 transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Editeur Bitmap</span>
            </button>
          </div>
        </div>

        {/* STATS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">Total Réceptions</span>
            <span className="text-lg font-mono font-bold text-white">{kpis.total}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-emerald-400 block uppercase tracking-wider font-semibold">Taux d'Accord</span>
            <span className="text-lg font-mono font-bold text-emerald-300">{kpis.approvalRate}%</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-cyan-400 block uppercase tracking-wider font-semibold">Retraits DAB/GAB</span>
            <span className="text-lg font-mono font-bold text-cyan-300">{kpis.atmCount} ops</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-indigo-400 block uppercase tracking-wider font-semibold">Paiements TPE</span>
            <span className="text-lg font-mono font-bold text-indigo-300">{kpis.posCount} ops</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-amber-400 block uppercase tracking-wider font-semibold">Commissions MDR</span>
            <span className="text-lg font-mono font-bold text-amber-300">{kpis.totalFees.toFixed(2)} €</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-emerald-400 block uppercase tracking-wider font-semibold">Volume Global Acquis</span>
            <span className="text-lg font-mono font-bold text-emerald-300">{kpis.totalVolume.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
          </div>
        </div>
      </div>

      {/* INTERNAL SUB-NAVIGATION TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800 shadow-lg">
        <div className="flex flex-wrap items-center gap-2">
          {/* TAB 1: JOURNAL D'ACQUISITION (PAR DÉFAUT) */}
          <button
            onClick={() => setServerSubTab('journal')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              serverSubTab === 'journal'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-indigo-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Database className="w-4 h-4 text-indigo-400" />
            <span>📋 Journal d'Acquisition</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                serverSubTab === 'journal'
                  ? 'bg-indigo-900 text-indigo-200'
                  : 'bg-slate-800 text-indigo-300 border border-indigo-800/40'
              }`}
            >
              {transactions.length} tx
            </span>
          </button>

          {/* TAB 2: PARC COMMERÇANTS & TERMINAUX */}
          <button
            onClick={() => setServerSubTab('terminals')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              serverSubTab === 'terminals'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/25 ring-1 ring-cyan-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Store className="w-4 h-4 text-cyan-400" />
            <span>🏪 Parc Commerçants & Terminaux (TPE / DAB / GAB)</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                serverSubTab === 'terminals'
                  ? 'bg-cyan-900 text-cyan-200'
                  : 'bg-slate-800 text-cyan-300 border border-cyan-800/40'
              }`}
            >
              {terminals.length} terminaux
            </span>
          </button>

          {/* TAB 3: SUPERVISION & RÉCEPTION TERMINAL */}
          <button
            onClick={() => setServerSubTab('supervision')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              serverSubTab === 'supervision'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>⚡ Supervision & Réception Terminal</span>
          </button>
        </div>

        {serverSubTab !== 'journal' && (
          <button
            onClick={() => setServerSubTab('journal')}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-950/40 transition-colors"
          >
            <span>← Revenir au Journal SAA</span>
          </button>
        )}
      </div>

      {/* TAB 1: SUPERVISION & RÉCEPTION TERMINAL */}
      {serverSubTab === 'supervision' && (
        <div className="space-y-6">
          {/* TOP SECTION: SIMULATEUR DE RÉCEPTION TERMINAL DANS LE SAA */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Simulateur de Réception de Trame Terminal (SAA)</span>
                    <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">
                      Port 4000
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Injectez une trame émise par un automate DAB/GAB ou un TPE commerçant pour tester le contrôle acquéreur et le routage vers le SAE.
                  </p>
                </div>
              </div>

              <button
                onClick={handleIngestStudioFrame}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900/60 transition-all self-start sm:self-center"
                title="Copier les paramètres de la trame en cours d'édition dans le Studio"
              >
                <span>📥 Réceptionner Trame Studio</span>
              </button>
            </div>

            {/* Quick Presets Buttons */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Sélection rapide de l'opération terminal :
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectOperationPreset('atm_dab')}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold text-left border transition-all ${
                    selectedPresetOp === 'atm_dab'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold">Retrait DAB [MTI 0100/DAB]</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Automate Guichet (150 €)</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectOperationPreset('atm_gab')}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold text-left border transition-all ${
                    selectedPresetOp === 'atm_gab'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold">Retrait GAB [MTI 0100/GAB]</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Automate Gare (200 €)</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectOperationPreset('pos_emv')}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold text-left border transition-all ${
                    selectedPresetOp === 'pos_emv'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-sm'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold">Paiement TPE Contact EMV</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Puce + PIN (89.90 €)</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectOperationPreset('pos_nfc')}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold text-left border transition-all ${
                    selectedPresetOp === 'pos_nfc'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-sm'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold">Paiement Sans Contact NFC</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Mode 071 Sans contact (34.50 €)</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectOperationPreset('ecom')}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold text-left border transition-all ${
                    selectedPresetOp === 'ecom'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold">Passerelle E-Commerce</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Vente Web sécurisée (129 €)</div>
                </button>
              </div>
            </div>

            {/* Form Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              {/* Terminal Sélecteur */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Terminal Émetteur (TID / MID) :
                </label>
                <select
                  value={selectedTid}
                  onChange={(e) => setSelectedTid(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-400"
                >
                  {terminals.map((t) => (
                    <option key={t.id} value={t.tid}>
                      [{t.type}] {t.tid} — {t.merchantName} ({t.locationCity})
                    </option>
                  ))}
                </select>
              </div>

              {/* MTI & Proc Code */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  MTI & Code Traitement (DE 3) :
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={testMti}
                    onChange={(e) => setTestMti(e.target.value)}
                    className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-emerald-300 font-mono font-bold outline-none focus:border-emerald-400"
                  >
                    <option value="0100">0100</option>
                    <option value="0200">0200</option>
                    <option value="0400">0400</option>
                    <option value="0500">0500</option>
                  </select>
                  <select
                    value={testProcessingCode}
                    onChange={(e) => setTestProcessingCode(e.target.value)}
                    className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-200 font-mono outline-none focus:border-emerald-400"
                  >
                    <option value="010000">010000 (Retrait Espèces)</option>
                    <option value="000000">000000 (Achat Biens/Services)</option>
                    <option value="200000">200000 (Remboursement / Crédit)</option>
                    <option value="310000">310000 (Consultation Solde)</option>
                  </select>
                </div>
              </div>

              {/* Montant (€) */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Montant de la Transaction (€) :
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={testAmount}
                    onChange={(e) => setTestAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-xs font-mono font-bold text-cyan-300 outline-none focus:border-emerald-400"
                    placeholder="150.00"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-500 font-bold">€</span>
                </div>
              </div>

              {/* Scénario / Override Mode */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Scénario d'Acquisition SAA :
                </label>
                <select
                  value={overrideMode}
                  onChange={(e) => setOverrideMode(e.target.value as AcquirerOverrideMode)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-400 font-semibold"
                >
                  <option value="normal">🟢 Normal (Routage SAE réel)</option>
                  <option value="force_stip">⚡ Forcer Accord STIP Acquéreur</option>
                  <option value="force_58_terminal_invalid">🔴 Simuler Terminal Inconnu (RC 58)</option>
                  <option value="force_03_merchant_blocked">🔴 Simuler Commerçant Bloqué (RC 03)</option>
                  <option value="force_61_terminal_limit">🟠 Simuler Dépassement Plafond (RC 61)</option>
                  <option value="force_91_issuer_down">⚠️ Simuler Timeout Réseau SAE (RC 91)</option>
                </select>
              </div>
            </div>

            {/* Launch Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Prêt pour réception et analyse ISO 8583 sur le terminal sélectionné</span>
              </div>

              <button
                type="button"
                onClick={handleRunReceptionTest}
                disabled={isProcessing}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Traitement Acquéreur en cours...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-slate-950" />
                    <span>Traiter la Réception Terminal</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* LOWER SECTION: RESULT OF SAA RECEPTION */}
          {lastProcessResult && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Pipeline of Checks (7 cols) */}
              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Chaîne de Contrôles Acquéreur (SAA)
                    </h4>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${
                      lastProcessResult.transaction.status === 'APPROVED' || lastProcessResult.transaction.status === 'STIP'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-red-950 text-red-300 border-red-800'
                    }`}
                  >
                    Code ISO 39 : {lastProcessResult.response.responseCode} ({lastProcessResult.transaction.responseDescription})
                  </span>
                </div>

                <div className="space-y-2.5">
                  {lastProcessResult.checks.map((chk, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
                        chk.passed
                          ? 'bg-slate-950/70 border-emerald-500/30 text-slate-200'
                          : 'bg-red-950/30 border-red-500/40 text-red-200'
                      }`}
                    >
                      <div className="mt-0.5">
                        {chk.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-100">{chk.name}</span>
                          {chk.responseCode && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-300">
                              RC: {chk.responseCode}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{chk.message}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Acquirer Commission Breakdown */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block">Commission Acquéreur Perçue (MDR) :</span>
                    <span className="text-slate-300 text-[11px]">
                      Taux: {lastProcessResult.terminal?.feePercent || 0.75}% + {lastProcessResult.terminal?.feeFixed || 0.05} €
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono font-bold text-amber-400">
                      +{lastProcessResult.transaction.acquirerFee.toFixed(2)} €
                    </span>
                    <span className="block text-[10px] text-slate-500">MDR Acquéreur</span>
                  </div>
                </div>

                {/* ISO Hex Dump Preview */}
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Trame Réponse ISO 8583 Renvoyée au Terminal :
                  </span>
                  <div className="p-3 rounded-xl bg-slate-950 font-mono text-[11px] text-emerald-300 border border-slate-800 break-all leading-relaxed">
                    {formatHexOctets(lastProcessResult.response.rawHex || '')}
                  </div>
                </div>
              </div>

              {/* Right Column: Live Socket Logs & Network Events (5 cols) */}
              <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Journal Événements Réseau SAA
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Latence: {lastProcessResult.transaction.latencyMs}ms
                  </span>
                </div>

                <div className="flex-1 space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {lastProcessResult.socketEvents.map((evt, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] leading-relaxed flex items-start gap-2"
                    >
                      <span className="text-slate-500 text-[10px] flex-shrink-0 mt-0.5">{evt.time}</span>
                      <span
                        className={
                          evt.status === 'success'
                            ? 'text-emerald-400'
                            : evt.status === 'error'
                            ? 'text-red-400'
                            : evt.status === 'warn'
                            ? 'text-amber-400'
                            : 'text-cyan-300'
                        }
                      >
                        {evt.event}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* RECENT ACQUISITION FEED (LAST 5 TRANSACTIONS) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Dernières Réceptions Acquéreur Traitées
                </h3>
              </div>
              <button
                onClick={() => setServerSubTab('journal')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                Voir tout le journal ({transactions.length}) →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                    <th className="py-2.5 px-3">Date / Heure</th>
                    <th className="py-2.5 px-3">Terminal TID</th>
                    <th className="py-2.5 px-3">Opération</th>
                    <th className="py-2.5 px-3">Commerçant</th>
                    <th className="py-2.5 px-3">Montant</th>
                    <th className="py-2.5 px-3">Routage</th>
                    <th className="py-2.5 px-3">Statut (RC)</th>
                    <th className="py-2.5 px-3 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {transactions.slice(0, 5).map((tx) => (
                    <tr
                      key={tx.id}
                      onClick={() => {
                        setSelectedTx(tx);
                        setServerSubTab('journal');
                      }}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(tx.timestamp).toLocaleTimeString('fr-FR')}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-cyan-300">{tx.tid}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-200">{tx.operationLabel}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-400 truncate max-w-[140px]">
                        {tx.merchantName}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white">{tx.amount.toFixed(2)} €</td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {tx.routingDestination}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            tx.status === 'APPROVED' || tx.status === 'STIP'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              : 'bg-red-950 text-red-300 border-red-800'
                          }`}
                        >
                          {tx.responseCode}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                        +{tx.acquirerFee.toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PARC COMMERÇANTS & TERMINAUX (TPE / DAB / GAB) */}
      {serverSubTab === 'terminals' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Store className="w-5 h-5 text-cyan-400" />
                  <span>Gestion du Parc de Terminaux & Contrats Acquéreur</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Terminaux de Paiement Électronique (TPE), distributeurs automatiques (DAB/GAB) et passerelles de vente en ligne enrôlés au SAA.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter un Terminal</span>
                </button>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-400 font-medium">Type :</span>
                {(['all', 'ATM', 'POS', 'ECOM'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setTerminalTypeFilter(type)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      terminalTypeFilter === type
                        ? 'bg-cyan-600 text-white border-cyan-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {type === 'all' ? 'Tous' : type === 'ATM' ? 'DAB/GAB' : type === 'POS' ? 'TPE' : 'E-Commerce'}
                  </button>
                ))}
              </div>
            </div>

            {/* Terminals Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {terminals
                .filter((t) => terminalTypeFilter === 'all' || t.type === terminalTypeFilter)
                .map((term) => (
                  <div
                    key={term.id}
                    className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all space-y-3 relative group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              term.type === 'ATM'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : term.type === 'POS'
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                : 'bg-purple-950 text-purple-300 border border-purple-800'
                            }`}
                          >
                            {term.atmSubtype || term.type}
                          </span>
                          <span className="font-mono text-xs font-bold text-white">{term.tid}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-200 mt-1 line-clamp-1">{term.merchantName}</h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span>{term.locationCity}</span>
                          <span>•</span>
                          <span>MCC {term.mcc}</span>
                        </div>
                      </div>

                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          term.status === 'ACTIVE'
                            ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                            : 'bg-red-400'
                        }`}
                        title={term.status}
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">MID Commerçant :</span>
                        <span className="font-mono text-slate-300">{term.mid}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Plafond Max/Tx :</span>
                        <span className="font-mono font-bold text-emerald-300">{term.maxSingleTx} €</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Volume Jour :</span>
                        <span className="font-mono text-cyan-300">{term.spentToday.toFixed(0)} €</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Commission MDR :</span>
                        <span className="font-mono text-amber-300">
                          {term.feePercent}% + {term.feeFixed}€
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800/80">
                      <button
                        onClick={() => {
                          setSelectedTid(term.tid);
                          setServerSubTab('supervision');
                        }}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                      >
                        Tester Réception →
                      </button>

                      {onInjectTerminalIntoIso && (
                        <button
                          onClick={() => onInjectTerminalIntoIso(term)}
                          className="px-2 py-1 rounded bg-slate-900 border border-slate-700 hover:border-cyan-400 text-[10px] text-slate-300 hover:text-white transition-colors"
                          title="Injecter le TID et MID dans le Studio ISO 8583"
                        >
                          Injecter Studio
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: JOURNAL D'ACQUISITION */}
      {serverSubTab === 'journal' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-400" />
                  <span>Journal des Transactions Reçues (Audit Trail Acquéreur)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Historique immuable des flux reçus, contrôles de validité, routage et commissions acquéreur.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (confirm('Vider l\'historique des transactions acquéreur ?')) {
                      clearAllAcquirerTransactions();
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Purger le Journal
                </button>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Recherche par TID, MID, RRN, PAN ou nom..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-400"
                />
              </div>

              <div className="flex items-center gap-2">
                {(['all', 'APPROVED', 'DECLINED', 'STIP'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      statusFilter === st
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {st === 'all' ? 'Toutes' : st === 'APPROVED' ? 'Approuvées' : st === 'DECLINED' ? 'Refusées' : 'STIP'}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                    <th className="py-2.5 px-3">Date / RRN</th>
                    <th className="py-2.5 px-3">Terminal (TID)</th>
                    <th className="py-2.5 px-3">Opération</th>
                    <th className="py-2.5 px-3">Carte (PAN)</th>
                    <th className="py-2.5 px-3">Montant</th>
                    <th className="py-2.5 px-3">Routage</th>
                    <th className="py-2.5 px-3">Code Réponse</th>
                    <th className="py-2.5 px-3 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {filteredTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                        selectedTx?.id === tx.id ? 'bg-indigo-950/40 border-l-2 border-indigo-400' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="text-white font-bold">{new Date(tx.timestamp).toLocaleTimeString('fr-FR')}</div>
                        <div className="text-[10px] text-slate-500">{tx.rrn}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-cyan-300">{tx.tid}</span>
                        <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{tx.merchantName}</div>
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-200">{tx.operationLabel}</td>
                      <td className="py-2.5 px-3 text-slate-400">{tx.maskedPan}</td>
                      <td className="py-2.5 px-3 font-bold text-white">{tx.amount.toFixed(2)} €</td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {tx.routingDestination}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            tx.status === 'APPROVED' || tx.status === 'STIP'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              : 'bg-red-950 text-red-300 border-red-800'
                          }`}
                        >
                          RC {tx.responseCode}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                        +{tx.acquirerFee.toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Detail Drawer for Selected Transaction */}
            {selectedTx && (
              <div className="mt-4 p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Détail Transaction Acquéreur : RRN {selectedTx.rrn} (STAN: {selectedTx.stan})
                    </h4>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${
                      selectedTx.status === 'APPROVED' || selectedTx.status === 'STIP'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-red-950 text-red-300 border-red-800'
                    }`}
                  >
                    Statut : {selectedTx.status} ({selectedTx.responseDescription})
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">Terminal & Commerçant</span>
                    <span className="font-mono text-cyan-300 font-bold">{selectedTx.tid}</span>
                    <span className="block text-[11px] text-slate-300 truncate">{selectedTx.merchantName}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">Montant & Devise</span>
                    <span className="font-mono text-white font-bold">{selectedTx.amount.toFixed(2)} €</span>
                    <span className="block text-[11px] text-slate-400">Code ISO 49: {selectedTx.currency}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">Autorisation & Code DE 38</span>
                    <span className="font-mono text-emerald-300 font-bold">
                      {selectedTx.approvalCode || 'N/A (Refusé)'}
                    </span>
                    <span className="block text-[11px] text-slate-400">RC DE 39: {selectedTx.responseCode}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">Commission Acquéreur</span>
                    <span className="font-mono text-amber-400 font-bold">+{selectedTx.acquirerFee.toFixed(2)} €</span>
                    <span className="block text-[11px] text-slate-400">Latence: {selectedTx.latencyMs}ms</span>
                  </div>
                </div>

                {/* Pipeline of checks for this transaction */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Contrôles exécutés sur la transaction :
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedTx.checks.map((chk, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                          chk.passed
                            ? 'bg-slate-900/40 border-emerald-500/20 text-slate-200'
                            : 'bg-red-950/20 border-red-500/30 text-red-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {chk.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                          )}
                          <span className="font-semibold text-[11px]">{chk.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono truncate max-w-[160px]">
                          {chk.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL AJOUT TERMINAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>Enrôler un Nouveau Terminal Acquéreur</span>
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Terminal ID (TID - DE 41) :</label>
                <input
                  type="text"
                  value={newTerminalForm.tid || ''}
                  onChange={(e) => setNewTerminalForm({ ...newTerminalForm, tid: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                  placeholder="TPE-MONOP-02"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Marchand ID (MID - DE 42) :</label>
                <input
                  type="text"
                  value={newTerminalForm.mid || ''}
                  onChange={(e) => setNewTerminalForm({ ...newTerminalForm, mid: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                  placeholder="MERCH-MNP-0099"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nom Commerçant / Emplacement (DE 43) :</label>
                <input
                  type="text"
                  value={newTerminalForm.merchantName || ''}
                  onChange={(e) => setNewTerminalForm({ ...newTerminalForm, merchantName: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  placeholder="MONOPRIX REPUBLIQUE PARIS"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Type de Terminal :</label>
                  <select
                    value={newTerminalForm.type || 'POS'}
                    onChange={(e) => setNewTerminalForm({ ...newTerminalForm, type: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="POS">POS (TPE Commerçant)</option>
                    <option value="ATM">ATM (DAB / GAB Automate)</option>
                    <option value="ECOM">ECOM (Vente en Ligne)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">MCC Activité (DE 18) :</label>
                  <input
                    type="text"
                    value={newTerminalForm.mcc || '5411'}
                    onChange={(e) => setNewTerminalForm({ ...newTerminalForm, mcc: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                    placeholder="5411"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Plafond Max/Tx (€) :</label>
                  <input
                    type="number"
                    value={newTerminalForm.maxSingleTx || 1500}
                    onChange={(e) => setNewTerminalForm({ ...newTerminalForm, maxSingleTx: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Plafond Jour (€) :</label>
                  <input
                    type="number"
                    value={newTerminalForm.dailyLimit || 50000}
                    onChange={(e) => setNewTerminalForm({ ...newTerminalForm, dailyLimit: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (!newTerminalForm.tid || !newTerminalForm.mid) return;
                  const newTerm: MerchantTerminalEntity = {
                    id: `term-${Date.now()}`,
                    tid: newTerminalForm.tid.toUpperCase(),
                    mid: newTerminalForm.mid.toUpperCase(),
                    merchantName: newTerminalForm.merchantName || 'NOUVEAU COMMERCANT',
                    type: newTerminalForm.type || 'POS',
                    atmSubtype: newTerminalForm.type === 'ATM' ? 'DAB' : undefined,
                    mcc: newTerminalForm.mcc || '5411',
                    locationCity: newTerminalForm.locationCity || 'Paris',
                    countryCode: '250',
                    currencyCode: '978',
                    status: 'ACTIVE',
                    dailyLimit: newTerminalForm.dailyLimit || 50000,
                    spentToday: 0,
                    maxSingleTx: newTerminalForm.maxSingleTx || 1500,
                    feePercent: 0.8,
                    feeFixed: 0.05,
                    defaultRouting: 'DIRECT_SAE',
                    totalTransactionsCount: 0,
                    totalVolumeProcessed: 0,
                    lastPing: 'En ligne (Nouveau terminal)',
                  };
                  saveAcquirerTerminal(newTerm);
                  setIsAddModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-slate-950 shadow-md transition-all"
              >
                Enregistrer le Terminal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
