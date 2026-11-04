import React, { useState, useMemo, useEffect } from 'react';
import {
  CreditCard,
  Wifi,
  ShieldCheck,
  RotateCcw,
  Clock,
  FileCheck,
  Activity,
  Layers,
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Terminal,
  Cpu,
  ArrowRight,
  Sparkles,
  RotateCw,
  Search,
  ExternalLink,
  BookOpen,
  SlidersHorizontal,
  Server,
  Database,
  Building2,
} from 'lucide-react';

import { TLVTag, TransactionPresetId } from './types/iso8583';
import {
  TRANSACTION_PRESETS,
  TRANSACTION_TYPOLOGY_GROUPS,
  ISO_8583_FIELDS,
} from './utils/iso8583Spec';
import { computeBitmap } from './utils/bitmapEngine';
import { encodeTlvStream, decodeTlvStream } from './utils/tlvEngine';
import { packIso8583Message } from './utils/iso8583Packer';
import { validateIso8583Message } from './utils/validator';
import { getIssuerCardByPan } from './utils/issuerDatabase';
import { MerchantTerminalEntity } from './utils/acquirerDatabase';

import { BitmapVisualizer } from './components/BitmapVisualizer';
import { FieldEditor } from './components/FieldEditor';
import { TlvEditor } from './components/TlvEditor';
import { FrameInspector } from './components/FrameInspector';
import { ValidationPanel } from './components/ValidationPanel';
import { NetworkSimulatorModal } from './components/NetworkSimulatorModal';
import { CardPersonalizationPage } from './components/CardPersonalizationPage';
import { IssuerServerPage } from './components/IssuerServerPage';
import { AcquirerServerPage } from './components/AcquirerServerPage';

export default function App() {
  // Navigation tabs - Default home page: 'card' (Personnalisation Carte)
  const [activeTab, setActiveTab] = useState<'designer' | 'card' | 'tlv' | 'inspector' | 'validation' | 'decoder' | 'issuer' | 'cardholder' | 'acquirer'>('card');
  const [selectedPanForLookup, setSelectedPanForLookup] = useState<string>('');

  // Protocol configuration state
  const [selectedPresetId, setSelectedPresetId] = useState<TransactionPresetId | 'custom'>('auth_contact');
  const [protocolVersion, setProtocolVersion] = useState<'1987' | '1993' | '2003'>('1987');
  const [mti, setMti] = useState<string>('0200');
  const [tpdu, setTpdu] = useState<string>('6000010000');
  const [fields, setFields] = useState<Record<number, string>>(() => {
    const defaultPreset = TRANSACTION_PRESETS[0];
    const initialFields = { ...defaultPreset.fields };
    if (defaultPreset.tlvList) {
      initialFields[55] = encodeTlvStream(defaultPreset.tlvList);
    }
    return initialFields;
  });

  const [tlvList, setTlvList] = useState<TLVTag[]>(() => TRANSACTION_PRESETS[0].tlvList || []);
  const [selectedFieldDe, setSelectedFieldDe] = useState<number | null>(null);

  // Modals & Toasts
  const [isSendModalOpen, setIsSendModalOpen] = useState<boolean>(false);
  const [cardInjectionToast, setCardInjectionToast] = useState<string | null>(null);

  // Compute Bitmap
  const activeDes = useMemo(() => {
    return Object.keys(fields)
      .map(Number)
      .filter((de) => de >= 2 && de <= 128 && fields[de] !== undefined && fields[de].trim() !== '');
  }, [fields]);

  const bitmapState = useMemo(() => computeBitmap(activeDes), [activeDes]);

  // Pack message
  const packedMessage = useMemo(() => {
    return packIso8583Message(mti, fields, tpdu);
  }, [mti, fields, tpdu]);

  // Validation
  const validationResult = useMemo(() => {
    return validateIso8583Message(mti, fields, tpdu);
  }, [mti, fields, tpdu]);

  const currentPreset = useMemo(() => {
    return TRANSACTION_PRESETS.find((p) => p.id === selectedPresetId);
  }, [selectedPresetId]);

  // Change preset
  const handleSelectPreset = (presetId: TransactionPresetId) => {
    const preset = TRANSACTION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setSelectedPresetId(presetId);
    setMti(preset.mti);
    if (preset.tpdu !== undefined) setTpdu(preset.tpdu);

    const newFields = { ...preset.fields };
    const newTlvs = preset.tlvList ? [...preset.tlvList] : [];

    if (newTlvs.length > 0) {
      newFields[55] = encodeTlvStream(newTlvs);
    } else {
      delete newFields[55];
    }

    setTlvList(newTlvs);
    setFields(newFields);
    setSelectedFieldDe(null);
  };

  // Update a single field
  const handleUpdateField = (de: number, value: string) => {
    setSelectedPresetId('custom');
    setFields((prev) => {
      const copy = { ...prev };
      if (value.trim() === '') {
        delete copy[de];
      } else {
        copy[de] = value;
      }
      return copy;
    });

    // If updating field 55 directly, sync back to TLV list
    if (de === 55 && value.trim() !== '') {
      const decoded = decodeTlvStream(value);
      if (decoded.tags.length > 0) {
        setTlvList(decoded.tags);
      }
    }
  };

  // Toggle field on/off
  const handleToggleField = (de: number, enabled: boolean) => {
    setSelectedPresetId('custom');
    if (!enabled) {
      setFields((prev) => {
        const copy = { ...prev };
        delete copy[de];
        return copy;
      });
      if (de === 55) {
        setTlvList([]);
      }
    } else {
      const spec = ISO_8583_FIELDS[de];
      handleUpdateField(de, spec?.example || '1');
    }
  };

  // Sync TLV editor changes to field 55
  const handleSyncTlvToField55 = (hexStream: string) => {
    handleUpdateField(55, hexStream);
  };

  // Injects complete card personalization data into ISO 8583 message fields
  const handleInjectCardIntoIso = (cardData: {
    pan: string;
    expDate: string;
    psn: string;
    track2: string;
    cvv2: string;
    pinBlock: string;
    aid: string;
    arqcHex: string;
    cid: string;
    atc: string;
    un: string;
    productName?: string;
  }) => {
    setSelectedPresetId('custom');
    setFields((prev) => {
      const updated = { ...prev };
      updated[2] = cardData.pan;
      updated[14] = cardData.expDate;
      updated[23] = cardData.psn.padStart(3, '0');
      updated[35] = cardData.track2;
      updated[48] = `3DS:CVV2=${cardData.cvv2}|AID=${cardData.aid}`;
      updated[52] = cardData.pinBlock;

      // Update or inject TLV tags in field 55
      const currentTlvs = [...tlvList];
      const updateOrAddTlv = (tagHex: string, name: string, val: string, len: number) => {
        const idx = currentTlvs.findIndex((t) => t.tag.toUpperCase() === tagHex.toUpperCase());
        if (idx >= 0) {
          currentTlvs[idx] = { ...currentTlvs[idx], value: val, length: len };
        } else {
          currentTlvs.push({
            id: `tlv-${Date.now()}-${tagHex}`,
            tag: tagHex,
            name,
            length: len,
            value: val,
            description: `Tag injecté depuis le profil carte`,
          });
        }
      };

      updateOrAddTlv('9F26', 'Application Cryptogram (ARQC)', cardData.arqcHex, 8);
      updateOrAddTlv('9F27', 'Cryptogram Info Data (CID)', cardData.cid, 1);
      updateOrAddTlv('84', 'Dedicated File Name (AID)', cardData.aid, Math.ceil(cardData.aid.length / 2));
      updateOrAddTlv('9F36', 'Application Transaction Counter', cardData.atc, 2);
      updateOrAddTlv('9F37', 'Unpredictable Number', cardData.un, 4);
      updateOrAddTlv('5F34', 'PAN Sequence Number', cardData.psn, 1);

      setTlvList(currentTlvs);
      updated[55] = encodeTlvStream(currentTlvs);
      return updated;
    });

    setActiveTab('designer');
    setCardInjectionToast(`Produit ${cardData.productName || 'Carte'} injecté avec succès dans les DE 2, 14, 23, 35, 48, 52 et 55 !`);
    setTimeout(() => setCardInjectionToast(null), 4000);
  };

  // Inject PAN only from cardholder view
  const handleInjectPanOnly = (panDigits: string) => {
    const card = getIssuerCardByPan(panDigits);
    setFields((prev) => {
      const updated: Record<number, string> = { ...prev, 2: panDigits };
      if (card) {
        updated[14] = `${card.expirationYear}${card.expirationMonth}`;
        updated[35] = `${panDigits}=${card.expirationYear}${card.expirationMonth}${card.serviceCode}0000000000`;
      }
      return updated;
    });
    setCardInjectionToast(`Carte [${panDigits.slice(0, 6)}...${panDigits.slice(-4)}] injectée dans le simulateur ISO 8583 !`);
    setTimeout(() => setCardInjectionToast(null), 3500);
    setActiveTab('designer');
  };

  // Inject terminal from SAA into ISO 8583 fields
  const handleInjectTerminalIntoIso = (terminal: MerchantTerminalEntity) => {
    setSelectedPresetId('custom');
    setFields((prev) => ({
      ...prev,
      18: terminal.mcc,
      41: terminal.tid,
      42: terminal.mid,
      43: terminal.merchantName,
    }));
    setCardInjectionToast(`Terminal [${terminal.tid} — ${terminal.merchantName}] injecté dans le Studio (DE 41, 42, 43, 18) !`);
    setTimeout(() => setCardInjectionToast(null), 3500);
    setActiveTab('designer');
  };

  // Load from external decoder
  const handleLoadFromDecoder = (
    newMti: string,
    newFields: Record<number, string>,
    newTpdu?: string
  ) => {
    setSelectedPresetId('custom');
    setMti(newMti);
    if (newTpdu) setTpdu(newTpdu);
    setFields(newFields);

    if (newFields[55]) {
      const res = decodeTlvStream(newFields[55]);
      setTlvList(res.tags);
    } else {
      setTlvList([]);
    }

    setActiveTab('designer');
  };

  // Reset to blank
  const handleReset = () => {
    if (confirm('Réinitialiser tous les champs configurés ?')) {
      setSelectedPresetId('custom');
      setFields({ 3: '000000', 4: '000000000000', 49: '978' });
      setTlvList([]);
      setMti('0200');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Toast Notification */}
      {cardInjectionToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{cardInjectionToast}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Title (Home Page link) */}
          <div
            onClick={() => setActiveTab('card')}
            className="flex items-center gap-3 cursor-pointer group select-none"
            title="Accueil — Personnalisation Carte"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white group-hover:scale-105 transition-transform">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight group-hover:text-cyan-300 transition-colors">
                  PayTrans Studio
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  v2.5 Monétique
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Simulateur Monétique
              </p>
            </div>
          </div>

          {/* Quick Stats & Actions */}
          <div className="flex items-center gap-3">
            {/* Serveur d'Autorisation Émetteur (SAE) */}
            <button
              onClick={() => setActiveTab('issuer')}
              className={`flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs font-bold transition-all border ${
                activeTab === 'issuer'
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-500/30'
                  : 'bg-indigo-950/60 text-indigo-300 border-indigo-700/60 hover:bg-indigo-900/60 hover:border-indigo-400 hover:text-white'
              }`}
              title="Serveur d'Autorisation Émetteur (SAE)"
            >
              <Server className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />
              <span>SAE</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" title="En ligne"></span>
            </button>

            {/* Serveur d'Autorisation Acquéreur (SAA) */}
            <button
              onClick={() => setActiveTab('acquirer')}
              className={`flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs font-bold transition-all border ${
                activeTab === 'acquirer'
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-500/30'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/60 hover:border-emerald-400 hover:text-white'
              }`}
              title="Serveur d'Autorisation Acquéreur (SAA)"
            >
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              <span>SAA</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" title="En ligne"></span>
            </button>



            {/* Quick Send Button */}
            <button
              onClick={() => setIsSendModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              title="Simuler l'envoi de la trame vers le SAA (Passerelle Acquéreur) qui route vers le SAE"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Simuler Envoi</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Sub-Tabs */}
      <section className="bg-slate-950 px-4 sm:px-6 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto py-2 text-xs">
          <button
            onClick={() => setActiveTab('card')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
              activeTab === 'card'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4 text-purple-400" />
            <span>1. 💳 Personnalisation Carte</span>
          </button>

          <button
            onClick={() => setActiveTab('designer')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
              activeTab === 'designer'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>2. Editeur Bitmap</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400">
              {activeDes.length} champs
            </span>
          </button>

          <button
            onClick={() => setActiveTab('inspector')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
              activeTab === 'inspector'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>3. Analyseur Trame</span>
          </button>

          <button
            onClick={() => setActiveTab('validation')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
              activeTab === 'validation'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>4. Diagnostic & Validation</span>
            {validationResult.errors.length > 0 ? (
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-red-950 text-red-300 border border-red-800 font-bold">
                {validationResult.errors.length} err
              </span>
            ) : (
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                OK
              </span>
            )}
          </button>
        </div>
      </section>

      {/* Preset Selector Banner (shown only in ISO designer mode) */}
      {activeTab === 'designer' && (
        <section className="bg-slate-900/60 border-b border-slate-800/80 px-4 sm:px-6 py-3">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-center gap-3 md:gap-4 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span className="font-semibold text-slate-200 whitespace-nowrap">Type de transaction :</span>
            </div>

            {/* Grouped Typology Dropdown & Preset Actions */}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <div className="relative flex items-center justify-center">
                <select
                  value={selectedPresetId}
                  onChange={(e) => handleSelectPreset(e.target.value as TransactionPresetId)}
                  className="bg-slate-950 border border-slate-700 hover:border-cyan-500/70 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 text-slate-100 text-xs font-semibold rounded-lg pl-3 pr-8 py-2 shadow-inner transition-all cursor-pointer appearance-none outline-none w-full sm:w-auto min-w-[280px] sm:min-w-[360px] md:min-w-[420px] max-w-xl truncate text-left"
                  title="Sélectionner une typologie de transaction bancaire ISO 8583"
                >
                  {selectedPresetId === 'custom' && (
                    <option value="custom" disabled>
                      ✏️ Trame personnalisée (champs modifiés)
                    </option>
                  )}
                  {TRANSACTION_TYPOLOGY_GROUPS.map((group) => (
                    <optgroup
                      key={group.groupName}
                      label={`📌 ${group.groupName} [MTI ${group.mti}]`}
                      className="bg-slate-900 text-cyan-300 font-bold"
                    >
                      {group.presets.map((preset) => (
                        <option
                          key={preset.id}
                          value={preset.id}
                          className="bg-slate-950 text-slate-100 font-normal py-1"
                        >
                          {preset.name} {preset.badge}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 text-slate-400">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                </div>
              </div>

              {/* Active typology badge & info */}
              {currentPreset && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span className="font-bold">MTI {currentPreset.mti}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-300 font-sans">{currentPreset.badge}</span>
                </div>
              )}

              {/* Reset to initial */}
              <button
                onClick={handleReset}
                className="px-2.5 py-2 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800/80 border border-transparent hover:border-slate-700 transition-colors flex items-center gap-1"
                title="Réinitialiser tous les champs"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span className="hidden lg:inline text-[11px]">Réinitialiser</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* TAB 1: DESIGNER & BITMAP */}
        {activeTab === 'designer' && (
          <div className="space-y-6">
            {/* Top protocol configuration row */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-xl backdrop-blur-sm">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6">
                {/* Protocol Version */}
                <div className="md:col-span-4 flex flex-col justify-between">
                  <label className="text-xs font-semibold text-slate-300 block mb-2">
                    Version de la Norme ISO 8583 :
                  </label>
                  <select
                    value={protocolVersion}
                    onChange={(e) => setProtocolVersion(e.target.value as any)}
                    className="w-full h-10 bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-lg px-3 text-xs text-slate-200 outline-none transition-all"
                  >
                    <option value="1987">ISO 8583:1987 (CB2A, Visa BASE I, MC)</option>
                    <option value="1993">ISO 8583:1993 (Systèmes récents)</option>
                    <option value="2003">ISO 8583:2003 (Format moderne étendu)</option>
                  </select>
                </div>

                {/* MTI Input & helper */}
                <div className="md:col-span-5 flex flex-col justify-between">
                  <label className="text-xs font-semibold text-slate-300 block mb-2">
                    MTI (Message Type Identifier) :
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="text"
                      maxLength={4}
                      value={mti}
                      onChange={(e) => setMti(e.target.value.replace(/\D/g, ''))}
                      className="w-20 h-10 bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-lg text-center font-mono text-cyan-300 font-bold text-sm tracking-wider outline-none transition-all"
                      title="MTI 4 chiffres"
                    />
                    <select
                      value={mti}
                      onChange={(e) => setMti(e.target.value)}
                      className="flex-1 min-w-0 h-10 bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-lg px-3 text-xs text-slate-200 outline-none transition-all truncate"
                    >
                      <option value="0200">0200 - Demande financière (Paiement)</option>
                      <option value="0210">0210 - Réponse financière (Accord/Refus)</option>
                      <option value="0100">0100 - Demande d'autorisation préalable</option>
                      <option value="0400">0400 - Redressement / Annulation</option>
                      <option value="0500">0500 - Rapprochement / Télécollecte de lot</option>
                      <option value="0800">0800 - Gestion de réseau / Test écho</option>
                    </select>
                  </div>
                </div>

                {/* TPDU Header */}
                <div className="md:col-span-3 flex flex-col justify-between">
                  <label className="text-xs font-semibold text-slate-300 block mb-2">
                    En-tête TPDU (5 octets / 10 car. hex) :
                  </label>
                  <input
                    type="text"
                    value={tpdu}
                    onChange={(e) => setTpdu(e.target.value.toUpperCase())}
                    placeholder="6000010000"
                    maxLength={10}
                    className="w-full h-10 bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/40 rounded-lg px-3.5 font-mono text-indigo-300 font-bold text-xs tracking-wider outline-none transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>
            </div>

            {/* Bitmap Matrix Visualizer */}
            <BitmapVisualizer
              bitmapState={bitmapState}
              fields={fields}
              onSelectField={(de) => {
                setSelectedFieldDe(de);
              }}
              onToggleField={(de) => {
                const isCurrentlyActive = fields[de] !== undefined && fields[de].trim() !== '';
                handleToggleField(de, !isCurrentlyActive);
              }}
            />

            {/* Field Editor */}
            <FieldEditor
              fields={fields}
              mti={mti}
              onUpdateField={handleUpdateField}
              onToggleField={handleToggleField}
              onOpenTlvModal={() => {
                const el = document.getElementById('emv-tlv-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              selectedFieldDe={selectedFieldDe}
            />

            {/* Section Intégrée : Éditeur Tags EMV TLV (Champ 55) */}
            <div id="emv-tlv-section" className="space-y-4 pt-6 border-t border-slate-800/80 scroll-mt-24">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl px-5 py-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm shadow-emerald-500/20">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-100">
                        Section Tags EMV TLV (Données ICC — Champ 55)
                      </h2>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                        {tlvList.length} tag(s) EMV
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Paramétrez ici les cryptogrammes (ARQC), compteurs (ATC, UN) et tags EMV BER-TLV encodés en continu dans le DE 55.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">Statut DE 55 :</span>
                  <span
                    className={`font-mono text-[11px] px-2.5 py-1 rounded-md border font-semibold ${
                      fields[55] && fields[55].trim() !== ''
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
                        : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    {fields[55] && fields[55].trim() !== ''
                      ? `${Math.ceil(fields[55].length / 2)} octets encodés`
                      : 'Non renseigné'}
                  </span>
                </div>
              </div>

              <TlvEditor
                tlvList={tlvList}
                onChange={(newList) => {
                  setTlvList(newList);
                  handleSyncTlvToField55(encodeTlvStream(newList));
                }}
                onSyncToField55={handleSyncTlvToField55}
                currentField55Hex={fields[55] || ''}
              />

              {/* Information card on EMV ICC */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 space-y-1.5">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  Guide d'utilisation des données ICC (Champ 55) :
                </div>
                <p className="leading-relaxed">
                  Le champ 55 transporte les données de cryptographie applicative issues de la puce (ARQC 9F26, CID 9F27, ATC 9F36, UN 9F37, etc.).
                  Toute modification apportée aux tags ci-dessus synchronise automatiquement le champ 55 de la trame ISO 8583.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CARD PERSONALIZATION PAGE */}
        {activeTab === 'card' && (
          <CardPersonalizationPage onInjectIntoIsoFrame={handleInjectCardIntoIso} />
        )}

        {/* TAB 3: TLV EDITOR */}
        {activeTab === 'tlv' && (
          <div className="space-y-6">
            <TlvEditor
              tlvList={tlvList}
              onChange={(newList) => {
                setTlvList(newList);
                handleSyncTlvToField55(encodeTlvStream(newList));
              }}
              onSyncToField55={handleSyncTlvToField55}
              currentField55Hex={fields[55] || ''}
            />

            {/* Information card on EMV ICC */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 text-xs text-slate-400 space-y-2">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Guide d'utilisation des données ICC (Champ 55) :
              </div>
              <p className="leading-relaxed">
                Le champ 55 transporte l'ensemble des données de cryptographie applicative issues de la puce physique ou virtuelle de la carte.
                Pour une transaction contact (051) ou sans contact (071), le switch bancaire exige systématiquement le cryptogramme applicatif <strong>9F26 (ARQC)</strong> généré par la clé de session 3DES/AES dérivée de la carte, ainsi que l'aléa terminal <strong>9F37 (Unpredictable Number)</strong> et le compteur <strong>9F36 (ATC)</strong>.
              </p>
            </div>
          </div>
        )}

        {/* TRAME & HEX DUMP (INCLUANT LE DÉCODEUR EXTERNE DE TRAME) */}
        {(activeTab === 'inspector' || activeTab === 'decoder') && (
          <div className="space-y-6">
            <FrameInspector
              packedMessage={packedMessage}
              tpdu={tpdu}
              onLoadIntoStudio={handleLoadFromDecoder}
              initialMode={activeTab === 'decoder' ? 'decoder' : 'inspector'}
            />
          </div>
        )}

        {/* TAB 4: VALIDATION DIAGNOSTIC */}
        {activeTab === 'validation' && (
          <div className="space-y-6">
            <ValidationPanel
              isValid={validationResult.isValid}
              errors={validationResult.errors}
              warnings={validationResult.warnings}
              mti={mti}
              stats={validationResult.stats}
              onSelectField={(de) => {
                setSelectedFieldDe(de);
                setActiveTab('designer');
              }}
              onOpenSendModal={() => setIsSendModalOpen(true)}
            />
          </div>
        )}

        {/* SERVEUR ÉMETTEUR HÔTE (INCLUANT LA RECHERCHE PORTEUR PAN DÉDIÉE) */}
        {(activeTab === 'issuer' || activeTab === 'cardholder') && (
          <IssuerServerPage
            initialSubTab={activeTab === 'cardholder' ? 'cardholder' : undefined}
            initialPanForLookup={selectedPanForLookup}
            onInjectIntoIso={handleInjectPanOnly}
            onNavigateToPersonalization={() => setActiveTab('card')}
            onNavigateToDesigner={() => setActiveTab('designer')}
          />
        )}

        {/* SERVEUR D'AUTORISATION ACQUÉREUR (SAA) */}
        {activeTab === 'acquirer' && (
          <AcquirerServerPage
            onInjectTerminalIntoIso={handleInjectTerminalIntoIso}
            onNavigateToDesigner={() => setActiveTab('designer')}
            onNavigateToSae={() => setActiveTab('issuer')}
            currentIsoFields={fields}
            currentIsoMti={mti}
          />
        )}
      </main>

      {/* Network Simulator Modal */}
      <NetworkSimulatorModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        mti={mti}
        fields={fields}
        tpdu={tpdu}
        onNavigateToSaa={() => {
          setIsSendModalOpen(false);
          setActiveTab('acquirer');
        }}
        onNavigateToSae={() => {
          setIsSendModalOpen(false);
          setActiveTab('issuer');
        }}
      />

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ISO 8583 Studio • Plateforme d'ingénierie et de personnalisation carte EMV</span>
          <span>Spécifications EMV 4.3 • ISO/IEC 7812 • ISO 7813 • ISO 7816-4 • ISO 8583</span>
        </div>
      </footer>
    </div>
  );
}
