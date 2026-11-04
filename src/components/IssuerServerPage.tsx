import React, { useState, useEffect, useMemo } from 'react';
import {
  Server,
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
} from 'lucide-react';
import {
  getIssuerTransactions,
  getIssuerCards,
  clearAllIssuerTransactions,
  resetIssuerDatabaseToSeeds,
  IssuerTransactionEntity,
  CardEntity,
  maskPan,
} from '../utils/issuerDatabase';
import {
  processIssuerAuthorization,
  IssuerOverrideMode,
  IssuerProcessResult,
} from '../utils/issuerHostEngine';
import { formatHexOctets } from '../utils/bitmapEngine';
import { CardholderLookupPage } from './CardholderLookupPage';

export interface IssuerServerPageProps {
  initialSubTab?: 'supervision' | 'cardholder' | 'journal';
  initialPanForLookup?: string;
  onInjectIntoIso: (pan: string) => void;
  onNavigateToPersonalization: () => void;
  onNavigateToDesigner: () => void;
  onNavigateToCardholder?: (pan: string) => void;
}

export const IssuerServerPage: React.FC<IssuerServerPageProps> = ({
  initialSubTab = 'journal',
  initialPanForLookup = '',
  onInjectIntoIso,
  onNavigateToPersonalization,
  onNavigateToDesigner,
  onNavigateToCardholder,
}) => {
  // Navigation inside Issuer Server - Default tab: 'journal' (Journal des Transactions)
  const [serverSubTab, setServerSubTab] = useState<'journal' | 'cardholder' | 'supervision'>(initialSubTab);
  const [lookupPan, setLookupPan] = useState<string>(initialPanForLookup);

  // Sync external pan or subtab changes
  useEffect(() => {
    if (initialPanForLookup) {
      setLookupPan(initialPanForLookup);
      setServerSubTab('cardholder');
    }
  }, [initialPanForLookup]);

  useEffect(() => {
    if (initialSubTab) {
      setServerSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Data state from DB
  const [transactions, setTransactions] = useState<IssuerTransactionEntity[]>(() => getIssuerTransactions());
  const [cards, setCards] = useState<CardEntity[]>(() => getIssuerCards());
  const [selectedTx, setSelectedTx] = useState<IssuerTransactionEntity | null>(null);

  // Server Engine Controls
  const [overrideMode, setOverrideMode] = useState<IssuerOverrideMode>('normal');
  const [serverStatus, setServerStatus] = useState<'RUNNING' | 'PAUSED'>('RUNNING');

  // Quick Test Form
  const [testMti, setTestMti] = useState<string>('0100');
  const [testPan, setTestPan] = useState<string>(cards[0]?.pan || '5355221001234568');
  const [testAmount, setTestAmount] = useState<string>('45.00');
  const [testPosEntry, setTestPosEntry] = useState<string>('051');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastProcessResult, setLastProcessResult] = useState<IssuerProcessResult | null>(null);

  // Filters for Transactions Table
  const [statusFilter, setStatusFilter] = useState<'all' | 'APPROVED' | 'DECLINED' | 'REVERSED'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sync with localStorage on events
  useEffect(() => {
    const handleUpdate = () => {
      setTransactions(getIssuerTransactions());
      setCards(getIssuerCards());
    };
    window.addEventListener('issuer-db-updated', handleUpdate);
    return () => window.removeEventListener('issuer-db-updated', handleUpdate);
  }, []);

  // Update selected transaction when transactions change
  useEffect(() => {
    if (transactions.length > 0 && !selectedTx) {
      setSelectedTx(transactions[0]);
    } else if (selectedTx) {
      const refreshed = transactions.find((t) => t.id === selectedTx.id);
      if (refreshed) setSelectedTx(refreshed);
    }
  }, [transactions]);

  // KPIs
  const kpis = useMemo(() => {
    const total = transactions.length;
    const approved = transactions.filter((t) => t.status === 'APPROVED').length;
    const declined = transactions.filter((t) => t.status === 'DECLINED').length;
    const reversed = transactions.filter((t) => t.status === 'REVERSED').length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 100;
    const totalVolume = transactions
      .filter((t) => t.status === 'APPROVED')
      .reduce((acc, t) => acc + t.amount, 0);

    return { total, approved, declined, reversed, approvalRate, totalVolume };
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().replace(/\s/g, '');
        const matchPan = t.pan.toLowerCase().includes(q) || t.maskedPan.toLowerCase().includes(q);
        const matchRrn = t.rrn.toLowerCase().includes(q);
        const matchName = t.cardholderName.toLowerCase().includes(q);
        const matchDesc = t.responseDescription.toLowerCase().includes(q);
        if (!matchPan && !matchRrn && !matchName && !matchDesc) return false;
      }
      return true;
    });
  }, [transactions, statusFilter, searchQuery]);

  // Execute quick test transaction against Issuer Host
  const handleRunQuickTest = async () => {
    setIsProcessing(true);
    setLastProcessResult(null);

    // Format amount into 12 digits
    const cents = Math.round(parseFloat(testAmount.replace(',', '.')) * 100);
    const amountPadded = cents.toString().padStart(12, '0');
    const stan = `${Math.floor(100000 + Math.random() * 900000)}`;
    const rrn = `${new Date().getFullYear().toString().slice(-2)}${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    const fields: Record<number, string> = {
      2: testPan,
      3: '000000',
      4: amountPadded,
      7: '1102143000',
      11: stan,
      12: '143000',
      13: '1102',
      22: testPosEntry,
      37: rrn,
      41: 'TPE-DEMO-01',
      42: 'MERCHANT-998811',
      43: 'BOUTIQUE TEST PARIS FR',
      49: '978',
    };

    if (testPosEntry === '051') {
      fields[55] = '9F26084AE7891230BCAE129F3602001C9F370438F9A102';
    }

    try {
      const res = await processIssuerAuthorization(testMti, fields, '6000010000', overrideMode);
      setLastProcessResult(res);
      setSelectedTx(res.transaction);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewCardholder = (pan: string) => {
    setLookupPan(pan);
    setServerSubTab('cardholder');
    if (onNavigateToCardholder) {
      onNavigateToCardholder(pan);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/20 flex-shrink-0">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  Serveur d'Autorisation Émetteur Hôte
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Hôte Monétique Actif
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {cards.length} Cartes en Base
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 max-w-2xl leading-relaxed">
                Traitement dynamique et contrôles bancaires automatisés des demandes ISO 8583 (0100, 0200, 0400, 0800) : validation Luhn, contrôle de validité temporelle, statuts opposition, plafonds hebdomadaires/mensuels, vérification du solde du compte et cryptogrammes EMV ARQC/ARPC.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => {
                if (confirm('Réinitialiser la base émettrice avec les données d\'usine de démonstration ?')) {
                  resetIssuerDatabaseToSeeds();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Réinitialiser cartes et transactions d'exemple"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset Données</span>
            </button>

            <button
              onClick={() => onNavigateToDesigner()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/50 transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Editeur Bitmap</span>
            </button>
          </div>
        </div>

        {/* STATS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">Total Traitées</span>
            <span className="text-lg font-mono font-bold text-white">{kpis.total}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-emerald-400 block uppercase tracking-wider font-semibold">Taux d'Accord</span>
            <span className="text-lg font-mono font-bold text-emerald-300">{kpis.approvalRate}%</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-emerald-400 block uppercase tracking-wider font-semibold">Approuvées (00)</span>
            <span className="text-lg font-mono font-bold text-emerald-300">{kpis.approved}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-red-400 block uppercase tracking-wider font-semibold">Refusées</span>
            <span className="text-lg font-mono font-bold text-red-300">{kpis.declined}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-amber-400 block uppercase tracking-wider font-semibold">Annulées (0400)</span>
            <span className="text-lg font-mono font-bold text-amber-300">{kpis.reversed}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-cyan-400 block uppercase tracking-wider font-semibold">Volume Autorisé</span>
            <span className="text-lg font-mono font-bold text-cyan-300">{kpis.totalVolume.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
          </div>
        </div>
      </div>

      {/* INTERNAL SUB-NAVIGATION TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800 shadow-lg">
        <div className="flex flex-wrap items-center gap-2">
          {/* TAB 1: JOURNAL DES TRANSACTIONS (PAR DÉFAUT) */}
          <button
            onClick={() => setServerSubTab('journal')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              serverSubTab === 'journal'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/25 ring-1 ring-cyan-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Database className="w-4 h-4 text-cyan-400" />
            <span>📋 Journal des Transactions</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
              serverSubTab === 'journal' ? 'bg-cyan-900 text-cyan-200' : 'bg-slate-800 text-cyan-300 border border-cyan-800/40'
            }`}>
              {transactions.length} tx
            </span>
          </button>

          {/* TAB 2: RECHERCHE PORTEUR (PAN) */}
          <button
            onClick={() => setServerSubTab('cardholder')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              serverSubTab === 'cardholder'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25 ring-1 ring-purple-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Search className="w-4 h-4 text-purple-400" />
            <span>🔍 Recherche Porteur (PAN)</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
              serverSubTab === 'cardholder' ? 'bg-purple-900 text-purple-200' : 'bg-slate-800 text-purple-300 border border-purple-800/40'
            }`}>
              {cards.length} cartes
            </span>
          </button>

          {/* TAB 3: SUPERVISION & SIMULATEUR HÔTE */}
          <button
            onClick={() => setServerSubTab('supervision')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              serverSubTab === 'supervision'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-indigo-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>⚡ Supervision & Simulateur Hôte</span>
          </button>
        </div>

        {serverSubTab !== 'journal' && (
          <button
            onClick={() => setServerSubTab('journal')}
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold px-3 py-1.5 rounded-lg hover:bg-cyan-950/40 transition-colors"
          >
            <span>← Revenir au Journal Émetteur</span>
          </button>
        )}
      </div>

      {/* EMBEDDED VIEW: CARDHOLDER LOOKUP */}
      {serverSubTab === 'cardholder' && (
        <CardholderLookupPage
          initialPan={lookupPan}
          onInjectIntoIso={onInjectIntoIso}
          onNavigateToPersonalization={onNavigateToPersonalization}
        />
      )}

      {/* QUICK SIMULATOR PANEL & SERVER RULES */}
      {serverSubTab === 'supervision' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Transaction Trigger */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-100">
                Émettre une Demande en Direct vers l'Émetteur
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Test d'autorisation en temps réel
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">MTI de la Demande :</label>
              <select
                value={testMti}
                onChange={(e) => setTestMti(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value="0100">0100 - Demande d'autorisation</option>
                <option value="0200">0200 - Demande financière directe</option>
                <option value="0400">0400 - Annulation / Redressement</option>
                <option value="0800">0800 - Test Réseau (Echo)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Carte Porteur (PAN) :</label>
              <select
                value={testPan}
                onChange={(e) => setTestPan(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.pan}>
                    {c.productName} ({maskPan(c.pan)}) - {c.accountBalance.toFixed(0)}€
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Montant Débit (EUR) :</label>
              <div className="relative">
                <input
                  type="text"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-2.5 pr-8 py-1.5 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-cyan-500"
                  placeholder="45.00"
                />
                <span className="absolute right-2.5 top-1.5 text-xs text-slate-500">€</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Mode d'Entrée TPE (DE 22) :</label>
              <select
                value={testPosEntry}
                onChange={(e) => setTestPosEntry(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value="051">051 - Puce Contact (EMV)</option>
                <option value="071">071 - Sans Contact (NFC)</option>
                <option value="021">021 - Piste Magnétique</option>
                <option value="012">012 - Vente à Distance (VAD)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">
              Contrôles appliqués : <strong className="text-slate-300">Luhn, Statut, Expiration, Plafond, Provision solde</strong>
            </span>
            <button
              onClick={handleRunQuickTest}
              disabled={isProcessing}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                isProcessing
                  ? 'bg-indigo-900 text-indigo-300 cursor-wait'
                  : 'bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white shadow-indigo-500/25'
              }`}
            >
              {isProcessing ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Traitement émetteur en cours...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Transmettre au Serveur Émetteur</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Server Rules & Override Mode */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-slate-100">
                Mode de Réponse Hôte
              </h3>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            Sélectionnez si le serveur émetteur doit exécuter ses contrôles réels ou forcer un cas de figure monétique :
          </p>

          <div className="space-y-1.5 text-xs">
            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
              <input
                type="radio"
                name="override"
                checked={overrideMode === 'normal'}
                onChange={() => setOverrideMode('normal')}
                className="text-cyan-500 focus:ring-0"
              />
              <span className="text-slate-200 font-semibold">⚡ Contrôles Réels en Base (Normal)</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
              <input
                type="radio"
                name="override"
                checked={overrideMode === 'force_approve'}
                onChange={() => setOverrideMode('force_approve')}
                className="text-emerald-500 focus:ring-0"
              />
              <span className="text-emerald-300">00 - Forcer Accord (Approuvé)</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
              <input
                type="radio"
                name="override"
                checked={overrideMode === 'force_51_balance'}
                onChange={() => setOverrideMode('force_51_balance')}
                className="text-amber-500 focus:ring-0"
              />
              <span className="text-amber-300">51 - Forcer Provision Insuffisante</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
              <input
                type="radio"
                name="override"
                checked={overrideMode === 'force_54_expired'}
                onChange={() => setOverrideMode('force_54_expired')}
                className="text-amber-500 focus:ring-0"
              />
              <span className="text-amber-300">54 - Forcer Carte Expirée</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
              <input
                type="radio"
                name="override"
                checked={overrideMode === 'force_05_blocked'}
                onChange={() => setOverrideMode('force_05_blocked')}
                className="text-red-500 focus:ring-0"
              />
              <span className="text-red-300">05 - Forcer Carte Bloquée / Opposition</span>
            </label>
          </div>
        </div>
      </div>
      )}

      {/* DYNAMIC RESPONSE MONITORING VIEW */}
      {serverSubTab !== 'cardholder' && selectedTx && (
        <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-6 shadow-2xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedTx.status === 'APPROVED'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : selectedTx.status === 'REVERSED'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                {selectedTx.status === 'APPROVED' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : selectedTx.status === 'REVERSED' ? (
                  <RotateCcw className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white">
                    Réponse Émetteur Dynamique : {selectedTx.responseMti}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                      selectedTx.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : selectedTx.status === 'REVERSED'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}
                  >
                    Code {selectedTx.responseCode} ({selectedTx.status})
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Demande d'origine : MTI {selectedTx.mti} • RRN : <strong className="text-slate-300 font-mono">{selectedTx.rrn}</strong> • STAN : <strong className="text-slate-300 font-mono">{selectedTx.stan}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Latence : <strong className="text-cyan-300">{selectedTx.latencyMs} ms</strong></span>
              </div>
              <button
                onClick={() => handleViewCardholder(selectedTx.pan)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-950/60 text-purple-300 border border-purple-800 hover:bg-purple-900/60 transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Voir Porteur (PAN)</span>
              </button>
            </div>
          </div>

          {/* Key Response Attributes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">DE 39 - Code Réponse :</span>
              <strong className="text-slate-100 font-bold block truncate">{selectedTx.responseDescription}</strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">DE 38 - Autorisation :</span>
              <strong className="text-cyan-400 font-mono font-bold">
                {selectedTx.approvalCode || <span className="text-slate-600 font-normal">N/A (Refusé)</span>}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Montant Transaction :</span>
              <strong className="text-emerald-400 font-mono font-bold">
                {selectedTx.amount.toFixed(2)} €
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Porteur / PAN :</span>
              <strong className="text-slate-200 block truncate">{selectedTx.cardholderName}</strong>
              <span className="text-[10px] font-mono text-slate-400">{selectedTx.maskedPan}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Solde Avant / Après :</span>
              <span className="font-mono text-[11px] text-slate-300">
                {selectedTx.balanceBefore.toFixed(2)} € → <strong className="text-cyan-300">{selectedTx.balanceAfter.toFixed(2)} €</strong>
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Cryptogramme ARPC (Tag 91) :</span>
              <span className="font-mono text-[11px] text-emerald-400">
                {selectedTx.arpc ? 'Calculé (Tag 91)' : 'Non applicable'}
              </span>
            </div>
          </div>

          {/* STEP BY STEP ISSUER CHECKS */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Audit des Contrôles Émetteur Exécutés :
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {selectedTx.checks.map((c, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl border flex items-start gap-2.5 transition-all ${
                    c.passed
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-red-950/30 border-red-500/40'
                  }`}
                >
                  <div className="mt-0.5">
                    {c.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-200 truncate">{c.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">{c.step}</span>
                    </div>
                    <p className={`text-[11px] mt-0.5 ${c.passed ? 'text-emerald-300/80' : 'text-red-300'}`}>
                      {c.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* HEX DUMP OF RESPONSE */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                Trame Réponse ISO 8583 Émise (Hexadécimal) :
              </span>
              <span className="font-mono text-[10px]">
                {selectedTx.responseRawHex.length / 2} octets
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 font-mono text-[11px] text-cyan-300/90 break-all select-all border border-slate-800">
              {formatHexOctets(selectedTx.responseRawHex)}
            </div>
          </div>
        </div>
      )}

      {/* TRANSACTION JOURNAL TABLE */}
      {serverSubTab !== 'cardholder' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              Journal des Transactions de l'Émetteur (Base de Données)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Historique complet et auditable de toutes les demandes traitées par le serveur hôte.
            </p>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Rechercher PAN, RRN, Nom..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">Tous les Statuts</option>
              <option value="APPROVED">Approuvées (00)</option>
              <option value="DECLINED">Refusées</option>
              <option value="REVERSED">Annulées (0400)</option>
            </select>

            <button
              onClick={() => {
                if (confirm('Vider tout l\'historique des transactions ?')) {
                  clearAllIssuerTransactions();
                }
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800 border border-slate-700 transition-colors"
              title="Vider le journal"
            >
              Vider
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Date / Heure</th>
                <th className="py-2.5 px-3">MTI</th>
                <th className="py-2.5 px-3">Porteur & Carte</th>
                <th className="py-2.5 px-3">Montant</th>
                <th className="py-2.5 px-3">RRN / STAN</th>
                <th className="py-2.5 px-3">Code DE 39</th>
                <th className="py-2.5 px-3">Statut</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Aucune transaction trouvée dans la base de données.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isSelected = selectedTx?.id === tx.id;
                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-950/40' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(tx.timestamp).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-cyan-300">
                        {tx.mti} → {tx.responseMti}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-200">{tx.cardholderName}</div>
                        <div className="font-mono text-[10px] text-slate-400">{tx.maskedPan}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {tx.amount.toFixed(2)} €
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                        {tx.rrn}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-slate-300">{tx.responseCode}</span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">{tx.responseDescription}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            tx.status === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : tx.status === 'REVERSED'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewCardholder(tx.pan);
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                          Fiche Porteur →
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
};
