import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  DollarSign,
  ShieldCheck,
  Lock,
  Unlock,
  PlusCircle,
  ArrowRight,
  ExternalLink,
  Layers,
  Calendar,
  Clock,
  Sparkles,
  Award,
  Wallet,
  Activity,
  User,
  Hash,
} from 'lucide-react';
import {
  getIssuerCards,
  getIssuerCardByPan,
  getIssuerTransactions,
  updateIssuerCardStatus,
  topupIssuerCardBalance,
  resetIssuerCardPinTries,
  CardEntity,
  IssuerTransactionEntity,
  cleanPan,
  maskPan,
} from '../utils/issuerDatabase';
import { validateLuhn } from '../utils/luhn';

interface CardholderLookupPageProps {
  initialPan?: string;
  onInjectIntoIso: (pan: string) => void;
  onNavigateToPersonalization: () => void;
}

export const CardholderLookupPage: React.FC<CardholderLookupPageProps> = ({
  initialPan,
  onInjectIntoIso,
  onNavigateToPersonalization,
}) => {
  const [cards, setCards] = useState<CardEntity[]>(() => getIssuerCards());
  const [inputPan, setInputPan] = useState<string>(() => {
    if (initialPan) return initialPan;
    const all = getIssuerCards();
    return all.length > 0 ? all[0].pan : '';
  });

  const [topupAmount, setTopupAmount] = useState<string>('200');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync with database updates
  useEffect(() => {
    const handleUpdate = () => {
      setCards(getIssuerCards());
    };
    window.addEventListener('issuer-db-updated', handleUpdate);
    return () => window.removeEventListener('issuer-db-updated', handleUpdate);
  }, []);

  // Update input if initialPan changes
  useEffect(() => {
    if (initialPan) {
      setInputPan(initialPan);
    }
  }, [initialPan]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const currentCleanPan = cleanPan(inputPan);
  const isLuhnValid = useMemo(() => validateLuhn(currentCleanPan), [currentCleanPan]);

  // Current Card from DB
  const currentCard = useMemo(() => {
    if (!currentCleanPan) return undefined;
    return cards.find((c) => cleanPan(c.pan) === currentCleanPan);
  }, [cards, currentCleanPan]);

  // Transactions of this cardholder
  const cardTransactions = useMemo(() => {
    if (!currentCleanPan) return [];
    return getIssuerTransactions(currentCleanPan);
  }, [currentCleanPan, cards]);

  // Toggle card block status
  const handleToggleBlock = () => {
    if (!currentCard) return;
    const newStatus = currentCard.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
    updateIssuerCardStatus(currentCard.pan, newStatus);
    showToast(newStatus === 'BLOCKED' ? 'Carte bloquée (Mise en opposition)' : 'Carte débloquée avec succès');
  };

  // Topup balance
  const handleTopup = (amt: number) => {
    if (!currentCard) return;
    topupIssuerCardBalance(currentCard.pan, amt);
    showToast(`Compte crédité de +${amt.toFixed(2)} € avec succès`);
  };

  // Reset PIN tries
  const handleResetPin = () => {
    if (!currentCard) return;
    resetIssuerCardPinTries(currentCard.pan);
    showToast('Compteur d\'essais PIN réinitialisé (0 essai faux)');
  };

  // Limits calculations
  const monthlyProgress = useMemo(() => {
    if (!currentCard) return 0;
    const pct = (currentCard.spentThisMonth / currentCard.limits.paymentMonthlyLimit) * 100;
    return Math.min(100, Math.round(pct));
  }, [currentCard]);

  const weeklyProgress = useMemo(() => {
    if (!currentCard) return 0;
    const pct = (currentCard.spentThisWeek / currentCard.limits.atmWeeklyLimit) * 100;
    return Math.min(100, Math.round(pct));
  }, [currentCard]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER & SEARCH SECTION */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-lg shadow-purple-500/20 flex-shrink-0">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  Consultation Porteur de Carte (Recherche PAN)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Fichier Émetteur & Historique
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 max-w-2xl leading-relaxed">
                Renseignez le numéro PAN d'une carte bancaire pour visualiser l'ensemble de ses informations (produit, titulaire, solde bancaire, statut, plafonds de paiement) ainsi que la liste chronologique de toutes les transactions effectuées par le porteur.
              </p>
            </div>
          </div>

          <button
            onClick={onNavigateToPersonalization}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 transition-all flex-shrink-0"
          >
            <CreditCard className="w-4 h-4" />
            <span>Personnaliser une Nouvelle Carte</span>
          </button>
        </div>

        {/* PAN INPUT & QUICK SELECTOR */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Numéro de Carte Bancaire (PAN) :</span>
              {currentCleanPan.length >= 12 && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    isLuhnValid
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}
                >
                  {isLuhnValid ? 'Clé Luhn Valide' : 'Clé Luhn Invalide'}
                </span>
              )}
            </label>

            <div className="relative">
              <input
                type="text"
                value={inputPan}
                onChange={(e) => setInputPan(e.target.value)}
                placeholder="Ex : 5355 2210 0123 4568"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 font-mono text-base font-bold text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              />
              {inputPan && (
                <button
                  onClick={() => setInputPan('')}
                  className="absolute right-3 top-3 text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Cartes Disponibles en Base :
            </label>
            <select
              value={currentCard?.pan || ''}
              onChange={(e) => setInputPan(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
            >
              <option value="">-- Choisir une carte enregistrée --</option>
              {cards.map((c) => (
                <option key={c.id} value={c.pan}>
                  {c.productName} - {c.cardholderName} ({maskPan(c.pan)})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* CARD DETAILS OR NOT FOUND */}
      {currentCard ? (
        <div className="space-y-6">
          {/* TOP CARD DETAILS ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* VIRTUAL CARD PREVIEW */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Support Plastique Virtuel
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    currentCard.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : currentCard.status === 'EXPIRED'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}
                >
                  {currentCard.status}
                </span>
              </div>

              {/* Card visual representation */}
              <div className="w-full aspect-[1.586] rounded-2xl p-5 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border border-slate-700/80 shadow-2xl relative overflow-hidden flex flex-col justify-between text-white">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl" />

                {/* Top of card */}
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                    {currentCard.productName}
                  </span>
                  <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-white/10 border border-white/20">
                    {currentCard.scheme.toUpperCase()}
                  </span>
                </div>

                {/* Chip */}
                <div className="w-10 h-7 rounded bg-amber-400/80 border border-amber-300/90 shadow-sm relative z-10 grid grid-cols-2 gap-0.5 p-1 opacity-90">
                  <div className="border-r border-b border-amber-600/60" />
                  <div className="border-b border-amber-600/60" />
                  <div className="border-r border-amber-600/60" />
                  <div />
                </div>

                {/* Card Number */}
                <div className="relative z-10">
                  <div className="font-mono text-sm sm:text-base font-bold tracking-widest text-slate-100 select-all">
                    {maskPan(currentCard.pan)}
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-2">
                    <span className="truncate max-w-[150px] uppercase font-bold text-slate-300">
                      {currentCard.cardholderName}
                    </span>
                    <span>
                      EXP: <strong className="text-white">{currentCard.expirationMonth}/{currentCard.expirationYear}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons for Card Management */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={handleToggleBlock}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border ${
                    currentCard.status === 'BLOCKED'
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60'
                      : 'bg-red-950/60 text-red-300 border-red-500/40 hover:bg-red-900/60'
                  }`}
                >
                  {currentCard.status === 'BLOCKED' ? (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Débloquer Carte</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Mettre en Opposition</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => onInjectIntoIso(currentCard.pan)}
                  className="py-2 px-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Tester dans ISO</span>
                </button>
              </div>
            </div>

            {/* FINANCIAL SITUATION & LIMITS */}
            <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-100">
                    Situation Financière & Plafonds d'Autorisation
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTopup(100)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 transition-colors"
                  >
                    +100 €
                  </button>
                  <button
                    onClick={() => handleTopup(500)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 transition-colors"
                  >
                    +500 €
                  </button>
                  <button
                    onClick={() => handleTopup(2000)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 transition-colors"
                  >
                    +2 000 €
                  </button>
                </div>
              </div>

              {/* Main Balance Display */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Solde Disponible sur le Compte</span>
                  <div className="text-2xl font-mono font-extrabold text-emerald-400 mt-1">
                    {currentCard.accountBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Compte Courant Associé</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Plafond Paiement Restant</span>
                  <div className="text-2xl font-mono font-extrabold text-cyan-400 mt-1">
                    {Math.max(0, currentCard.limits.paymentMonthlyLimit - currentCard.spentThisMonth).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">sur {currentCard.limits.paymentMonthlyLimit.toLocaleString('fr-FR')} € / mois</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Plafond Retrait DAB Restant</span>
                  <div className="text-2xl font-mono font-extrabold text-purple-400 mt-1">
                    {Math.max(0, currentCard.limits.atmWeeklyLimit - currentCard.spentThisWeek).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">sur {currentCard.limits.atmWeeklyLimit.toLocaleString('fr-FR')} € / 7j</span>
                </div>
              </div>

              {/* Ceilings Progress Bars */}
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-semibold">Consommation Plafond Mensuel Paiement :</span>
                    <span className="font-mono text-slate-400">
                      {currentCard.spentThisMonth.toFixed(2)} € / {currentCard.limits.paymentMonthlyLimit.toFixed(2)} € ({monthlyProgress}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all ${
                        monthlyProgress > 90 ? 'bg-red-500' : monthlyProgress > 70 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${monthlyProgress}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-semibold">Consommation Plafond Hebdomadaire Retrait :</span>
                    <span className="font-mono text-slate-400">
                      {currentCard.spentThisWeek.toFixed(2)} € / {currentCard.limits.atmWeeklyLimit.toFixed(2)} € ({weeklyProgress}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all ${
                        weeklyProgress > 90 ? 'bg-red-500' : weeklyProgress > 70 ? 'bg-amber-400' : 'bg-purple-400'
                      }`}
                      style={{ width: `${weeklyProgress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Technical Profile Attributes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Code de Service :</span>
                  <strong className="text-slate-200 font-mono">{currentCard.serviceCode}</strong>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Essais PIN Faux :</span>
                  <div className="flex items-center justify-between">
                    <strong className={currentCard.pinTriesCount >= 3 ? 'text-red-400 font-bold' : 'text-slate-200 font-mono'}>
                      {currentCard.pinTriesCount} / 3
                    </strong>
                    {currentCard.pinTriesCount > 0 && (
                      <button
                        onClick={handleResetPin}
                        className="text-[9px] text-cyan-400 hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">AID EMV :</span>
                  <strong className="text-slate-200 font-mono truncate block">{currentCard.aid}</strong>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Plafond Sans-Contact :</span>
                  <strong className="text-emerald-400 font-mono">{currentCard.limits.contactlessPerTxLimit} € / tx</strong>
                </div>
              </div>
            </div>
          </div>

          {/* CARDHOLDER TRANSACTIONS HISTORY */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Historique des Transactions du Porteur ({cardTransactions.length})
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Porteur : <strong className="text-white">{currentCard.cardholderName}</strong>
              </span>
            </div>

            {cardTransactions.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <CreditCard className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
                <p className="text-xs">Aucune transaction enregistrée pour cette carte.</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Effectuez un paiement ou une autorisation depuis le simulateur pour la voir apparaître ici.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Date / Heure</th>
                      <th className="py-2.5 px-3">Type & Canal</th>
                      <th className="py-2.5 px-3">Commerçant / Terminal</th>
                      <th className="py-2.5 px-3">Montant Débité</th>
                      <th className="py-2.5 px-3">RRN / Autorisation</th>
                      <th className="py-2.5 px-3">Code DE 39</th>
                      <th className="py-2.5 px-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {cardTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(tx.timestamp).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-200 block">{tx.transactionType}</span>
                          <span className="text-[10px] font-mono text-cyan-400">MTI {tx.mti} → {tx.responseMti}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          <div>{tx.merchantName || 'Commerçant TPE'}</div>
                          <div className="text-[10px] font-mono text-slate-500">{tx.terminalId}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-400 whitespace-nowrap">
                          {tx.amount.toFixed(2)} €
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300">
                          <div>RRN : {tx.rrn}</div>
                          {tx.approvalCode && (
                            <div className="text-[10px] text-cyan-400">Auth : {tx.approvalCode}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold text-slate-200">{tx.responseCode}</span>
                          <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">{tx.responseDescription}</span>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center shadow-xl space-y-3">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
          <h3 className="text-base font-bold text-white">
            Carte Inconnue dans le Fichier Émetteur
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Le PAN <strong className="text-slate-200 font-mono">{inputPan || '(aucun renseigné)'}</strong> n'est pas enregistré dans la base de données du serveur d'autorisation.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={onNavigateToPersonalization}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
            >
              Créer & Personnaliser cette Carte
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
