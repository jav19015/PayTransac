import React, { useState, useMemo } from 'react';
import {
  CardProfile,
  CardScheme,
  CardType,
  AidProfile,
  CardProductDefinition,
  CardLimits,
  ProductTier,
  CryptogramCalculationInput,
  CryptogramCalculationResult,
} from '../types/cardProfile';
import {
  EMV_AID_CATALOG,
  SERVICE_CODE_MAP,
  computeCardVerificationValues,
  buildMagneticTracks,
  buildIso0PinBlock,
  computeEmvCryptogram,
} from '../utils/emvCrypto';
import {
  validateLuhn,
  calculateLuhnCheckDigit,
  generateValidPan,
  getLuhnStepByStepDetails,
} from '../utils/luhn';
import { CARD_PRODUCTS_CATALOG } from '../utils/cardProductsCatalog';
import { saveIssuerCard } from '../utils/issuerDatabase';
import { CardVisualizer } from './CardVisualizer';
import {
  CreditCard,
  KeyRound,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Calculator,
  Check,
  Copy,
  Info,
  HelpCircle,
  Binary,
  Lock,
  Sliders,
  DollarSign,
  AlertTriangle,
  Award,
  Zap,
  Database,
} from 'lucide-react';

interface CardPersonalizationPageProps {
  onInjectIntoIsoFrame: (cardData: {
    pan: string;
    expDate: string; // YYMM
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
  }) => void;
}

export const CardPersonalizationPage: React.FC<CardPersonalizationPageProps> = ({
  onInjectIntoIsoFrame,
}) => {
  // Sub-tabs
  const [activeSection, setActiveSection] = useState<'profile' | 'limits' | 'security' | 'emv' | 'luhn'>('profile');

  // Selected Product State
  const [selectedProduct, setSelectedProduct] = useState<CardProductDefinition>(CARD_PRODUCTS_CATALOG[0]);
  const [tierFilter, setTierFilter] = useState<ProductTier | 'all'>('all');

  // Card Profile State (initialized from default product)
  const [scheme, setScheme] = useState<CardScheme>(CARD_PRODUCTS_CATALOG[0].scheme);
  const [cardType, setCardType] = useState<CardType>(CARD_PRODUCTS_CATALOG[0].cardType);
  const [cardholderName, setCardholderName] = useState<string>('JEAN DUPONT');
  const [pan, setPan] = useState<string>(() => generateValidPan(CARD_PRODUCTS_CATALOG[0].defaultBin, 16));
  const [psn, setPsn] = useState<string>('01');
  const [expirationMonth, setExpirationMonth] = useState<string>('12');
  const [expirationYear, setExpirationYear] = useState<string>('28');

  // Associated Limits & Services
  const [limits, setLimits] = useState<CardLimits>({ ...CARD_PRODUCTS_CATALOG[0].limits });
  const [servicesList, setServicesList] = useState<string[]>([...CARD_PRODUCTS_CATALOG[0].services]);

  // Service Code
  const [servicePos1, setServicePos1] = useState<string>(CARD_PRODUCTS_CATALOG[0].serviceCode[0] || '2');
  const [servicePos2, setServicePos2] = useState<string>(CARD_PRODUCTS_CATALOG[0].serviceCode[1] || '0');
  const [servicePos3, setServicePos3] = useState<string>(CARD_PRODUCTS_CATALOG[0].serviceCode[2] || '1');

  // PIN & PIN block
  const [clearPin, setClearPin] = useState<string>('1234');

  // AID Selection
  const [selectedAid, setSelectedAid] = useState<AidProfile>(() => {
    const defaultAidId = CARD_PRODUCTS_CATALOG[0].defaultAid;
    return EMV_AID_CATALOG.find((a) => a.aid === defaultAidId) || EMV_AID_CATALOG[0];
  });

  // Master Key MDK-AC
  const [mdkAc, setMdkAc] = useState<string>('0123456789ABCDEFFEDCBA9876543210');

  // Cryptogram inputs
  const [cryptoType, setCryptoType] = useState<'ARQC' | 'TC' | 'AAC'>('ARQC');
  const [txAmount, setTxAmount] = useState<string>('45.00');
  const [atc, setAtc] = useState<string>('001C');
  const [unpredictableNumber, setUnpredictableNumber] = useState<string>('38F9A102');
  const [tvr, setTvr] = useState<string>('0000000000');
  const [aip, setAip] = useState<string>('3800');

  // Feedback toasts
  const [injectedFeedback, setInjectedFeedback] = useState<boolean>(false);
  const [savedDbFeedback, setSavedDbFeedback] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [accountBalance, setAccountBalance] = useState<string>('3500.00');

  // Derived service code
  const serviceCode = `${servicePos1}${servicePos2}${servicePos3}`;

  // Luhn validity
  const isValidLuhn = useMemo(() => validateLuhn(pan), [pan]);
  const luhnDetails = useMemo(() => getLuhnStepByStepDetails(pan), [pan]);

  // Derived CVVs
  const expYearMonth = `${expirationYear}${expirationMonth}`;
  const cvvValues = useMemo(() => {
    return computeCardVerificationValues(pan, expYearMonth, serviceCode);
  }, [pan, expYearMonth, serviceCode]);

  // Derived Magnetic Tracks
  const tracks = useMemo(() => {
    return buildMagneticTracks(pan, cardholderName, expYearMonth, serviceCode, cvvValues.cvv1);
  }, [pan, cardholderName, expYearMonth, serviceCode, cvvValues.cvv1]);

  // Derived PIN Block
  const pinBlock = useMemo(() => {
    return buildIso0PinBlock(pan, clearPin);
  }, [pan, clearPin]);

  // Formatted amount to 12 digits
  const amountAuthorizedFormatted = useMemo(() => {
    const num = parseFloat(txAmount.replace(',', '.')) || 0;
    const cents = Math.round(num * 100);
    return cents.toString().padStart(12, '0');
  }, [txAmount]);

  // Cryptogram calculation
  const cryptogramResult = useMemo<CryptogramCalculationResult>(() => {
    const input: CryptogramCalculationInput = {
      cryptogramType: cryptoType,
      pan,
      psn,
      atc,
      unpredictableNumber,
      amountAuthorized: amountAuthorizedFormatted,
      amountOther: '000000000000',
      terminalCountryCode: '0250',
      transactionCurrencyCode: '0978',
      transactionDate: '261102',
      transactionType: '00',
      tvr,
      aip,
      masterKeyMdkAc: mdkAc,
    };
    return computeEmvCryptogram(input);
  }, [
    cryptoType,
    pan,
    psn,
    atc,
    unpredictableNumber,
    amountAuthorizedFormatted,
    tvr,
    aip,
    mdkAc,
  ]);

  // Check if current tx amount exceeds monthly limit
  const txAmountNum = parseFloat(txAmount.replace(',', '.')) || 0;
  const isExceedingPaymentLimit = txAmountNum > limits.paymentMonthlyLimit;

  // Card object for visualizer
  const cardProfileObject: CardProfile = {
    scheme,
    cardType,
    cardholderName,
    pan,
    psn,
    expirationMonth,
    expirationYear,
    serviceCode,
    cvv1: cvvValues.cvv1,
    cvv2: cvvValues.cvv2,
    icvv: cvvValues.icvv,
    clearPin,
    pinBlockIso0: pinBlock.encryptedHex,
    selectedAid,
    aip,
    atc,
    mdkAc,
    track1: tracks.track1,
    track2: tracks.track2,
    product: selectedProduct,
    limits,
  };

  // Product Selection Handler
  const handleSelectProduct = (product: CardProductDefinition) => {
    setSelectedProduct(product);
    setScheme(product.scheme);
    setCardType(product.cardType);
    setLimits({ ...product.limits });
    setServicesList([...product.services]);

    // Service Code
    const sc = product.serviceCode;
    setServicePos1(sc[0] || '2');
    setServicePos2(sc[1] || '0');
    setServicePos3(sc[2] || '1');

    // Generate compliant PAN with the product's BIN
    const newPan = generateValidPan(product.defaultBin, product.scheme === 'amex' ? 15 : 16);
    setPan(newPan);

    // Matching AID
    const matchingAid = EMV_AID_CATALOG.find((a) => a.aid === product.defaultAid) || EMV_AID_CATALOG[0];
    setSelectedAid(matchingAid);
  };

  const handleFixLuhn = () => {
    const clean = pan.replace(/\D/g, '');
    if (clean.length < 13) return;
    const prefix = clean.slice(0, -1);
    const checkDigit = calculateLuhnCheckDigit(prefix);
    setPan(prefix + checkDigit.toString());
  };

  const handleGenerateValidPan = (targetScheme: CardScheme) => {
    let bin = selectedProduct?.defaultBin || '497010';
    if (targetScheme === 'visa' && !bin.startsWith('4')) bin = '453201';
    if (targetScheme === 'mastercard' && !bin.startsWith('5')) bin = '510012';
    if (targetScheme === 'amex' && !bin.startsWith('3')) bin = '378282';

    const newPan = generateValidPan(bin, targetScheme === 'amex' ? 15 : 16);
    setPan(newPan);
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleInjectIntoIso = () => {
    onInjectIntoIsoFrame({
      pan,
      expDate: expYearMonth,
      psn,
      track2: tracks.track2,
      cvv2: cvvValues.cvv2,
      pinBlock: pinBlock.encryptedHex,
      aid: selectedAid.aid,
      arqcHex: cryptogramResult.cryptogramHex,
      cid: cryptogramResult.cid,
      atc,
      un: unpredictableNumber,
      productName: selectedProduct?.name,
    });
    setInjectedFeedback(true);
    setTimeout(() => setInjectedFeedback(false), 2500);
  };

  const handleSaveToDatabase = () => {
    const numBalance = parseFloat(accountBalance.replace(',', '.')) || 3500.0;
    saveIssuerCard({
      pan,
      cardholderName,
      scheme,
      cardType,
      productName: selectedProduct?.name || 'Carte Personnalisée',
      tier: selectedProduct?.tier || 'premium',
      expirationMonth,
      expirationYear,
      serviceCode,
      status: 'ACTIVE',
      accountBalance: numBalance,
      currency: '978',
      limits,
      clearPin,
      cvv1: cvvValues.cvv1,
      cvv2: cvvValues.cvv2,
      aid: selectedAid.aid,
      mdkAc,
    });
    setSavedDbFeedback(true);
    setTimeout(() => setSavedDbFeedback(false), 2500);
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    if (tierFilter === 'all') return CARD_PRODUCTS_CATALOG;
    return CARD_PRODUCTS_CATALOG.filter((p) => p.tier === tierFilter);
  }, [tierFilter]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">
                  Atelier de Personnalisation Carte
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Produits & Plafonds
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Sélectionnez un produit carte bancaire réel (Mastercard Gold, Visa Electron, CB Premier, Infinite...) pour intégrer automatiquement ses plafonds, règles d'autorisation, code de service et assistances.
              </p>
            </div>
          </div>

          {/* Action Buttons: Save to DB & Inject into ISO 8583 */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSaveToDatabase}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg ${
                savedDbFeedback
                  ? 'bg-purple-600 text-white shadow-purple-600/30'
                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/50 hover:bg-purple-500/30 shadow-purple-500/20'
              }`}
            >
              {savedDbFeedback ? <Check className="w-4 h-4" /> : <Database className="w-4 h-4 text-purple-400" />}
              <span>{savedDbFeedback ? 'Carte Enregistrée en Base !' : '💾 Sauvegarder en Base Émettrice'}</span>
            </button>

            <button
              onClick={handleInjectIntoIso}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg ${
                injectedFeedback
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-emerald-500/20'
              }`}
            >
              {injectedFeedback ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              <span>{injectedFeedback ? 'Données injectées dans ISO 8583 !' : 'Injecter dans le Simulateur ISO 8583'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* CATALOGUE DES PRODUITS CARTES BANCAIRES */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">
              Catalogue des Produits Cartes Bancaires du Marché
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {CARD_PRODUCTS_CATALOG.length} produits préconfigurés
            </span>
          </div>

          {/* Tier Filters */}
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <button
              onClick={() => setTierFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                tierFilter === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setTierFilter('premium')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                tierFilter === 'premium'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Gold & Premier
            </button>
            <button
              onClick={() => setTierFilter('systematic')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                tierFilter === 'systematic'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Autorisation Systématique (Electron/Maestro)
            </button>
            <button
              onClick={() => setTierFilter('super_premium')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                tierFilter === 'super_premium'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Haut de Gamme (Infinite / World Elite)
            </button>
            <button
              onClick={() => setTierFilter('classic')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                tierFilter === 'classic'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Classic Standard
            </button>
            <button
              onClick={() => setTierFilter('business')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                tierFilter === 'business'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Business & Pro
            </button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredProducts.map((prod) => {
            const isSelected = selectedProduct?.id === prod.id;
            return (
              <div
                key={prod.id}
                onClick={() => handleSelectProduct(prod)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-900 border-cyan-400 ring-2 ring-cyan-500/20 shadow-lg shadow-cyan-950'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                      {prod.name}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded ${
                        prod.tier === 'premium'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : prod.tier === 'systematic'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : prod.tier === 'super_premium'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {prod.badgeText}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{prod.subtitle}</p>

                  {/* Limits summary chips */}
                  <div className="grid grid-cols-2 gap-1.5 mt-2.5 text-[10px] font-mono">
                    <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800/80">
                      <span className="text-slate-500 block">Plafond Paiement :</span>
                      <strong className="text-emerald-400 font-bold">
                        {prod.limits.paymentMonthlyLimit.toLocaleString('fr-FR')} € / mois
                      </strong>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800/80">
                      <span className="text-slate-500 block">Plafond Retrait :</span>
                      <strong className="text-cyan-400 font-bold">
                        {prod.limits.atmWeeklyLimit.toLocaleString('fr-FR')} € / 7j
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">
                    Mode : <strong className="text-slate-200">{prod.authorizationMode === 'systematic_online' ? '100% En ligne' : 'Hybride'}</strong>
                  </span>
                  <span className={`font-semibold ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`}>
                    {isSelected ? '✓ Sélectionné' : 'Appliquer →'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Card Visualizer (Left) + Customization Studio (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive 3D Card Visualizer & Quick Stats */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Rendu Physique de la Carte</span>
              <span className="text-cyan-400 font-mono text-[11px] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Recto / Verso 3D
              </span>
            </div>

            <CardVisualizer card={cardProfileObject} isValidLuhn={isValidLuhn} />

            {/* Quick Card Summary Chips */}
            <div className="mt-6 pt-4 border-t border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Produit Actif :</span>
                <span className="font-bold text-amber-300">
                  {selectedProduct?.name} ({selectedProduct?.badgeText})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Réseau & Type :</span>
                <span className="font-semibold text-slate-200 uppercase">
                  {scheme.toUpperCase()} • {cardType}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Plafond Paiement :</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {limits.paymentMonthlyLimit.toLocaleString('fr-FR')} € / 30j
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Seuil Plancher Hors-Ligne :</span>
                <span className="font-mono text-cyan-300">
                  {limits.offlineFloorLimit === 0 ? '0 € (Systématique en ligne)' : `${limits.offlineFloorLimit} €`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Code de Service :</span>
                <span className="font-mono text-amber-300 font-bold">
                  {serviceCode}
                </span>
              </div>
            </div>
          </div>

          {/* Magnetic Stripe Track Preview Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-2">
                <Binary className="w-4 h-4 text-cyan-400" />
                Données Piste 2 Magnétique (DE 35) :
              </span>
              <button
                onClick={() => handleCopyText(tracks.track2, 'track2')}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                {copiedKey === 'track2' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedKey === 'track2' ? 'Copié' : 'Copier'}
              </button>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-cyan-300 break-all select-all">
              {tracks.track2}
            </div>
            <p className="text-[11px] text-slate-400">
              Format standard ISO 7813 : <code className="text-slate-300">PAN=YYMM[ServiceCode][Discretionary]</code>
            </p>
          </div>
        </div>

        {/* Right Column: Customization Forms with Tabs */}
        <div className="lg:col-span-7 space-y-5">
          {/* Section Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveSection('profile')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition-all ${
                activeSection === 'profile'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>1. Identité & PAN</span>
            </button>

            <button
              onClick={() => setActiveSection('limits')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition-all ${
                activeSection === 'limits'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>2. 🛡️ Plafonds & Services</span>
            </button>

            <button
              onClick={() => setActiveSection('security')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition-all ${
                activeSection === 'security'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>3. Code Service & CVV</span>
            </button>

            <button
              onClick={() => setActiveSection('emv')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition-all ${
                activeSection === 'emv'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>4. Puce & Cryptogramme</span>
            </button>

            <button
              onClick={() => setActiveSection('luhn')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition-all ${
                activeSection === 'luhn'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>5. Clé de Luhn</span>
            </button>
          </div>

          {/* TAB 1: IDENTITÉ & PAN */}
          {activeSection === 'profile' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-5">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-cyan-400" />
                Schéma, Type de Carte et Numéro Porteur
              </h3>

              {/* Scheme & Type Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Schéma / Marque de Paiement :
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['cb', 'visa', 'mastercard', 'amex'] as CardScheme[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setScheme(s);
                          handleGenerateValidPan(s);
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-bold uppercase transition-all border ${
                          scheme === s
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {s === 'cb' ? 'CB (Cartes Bancaires)' : s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Type de Produit Bancaire :
                  </label>
                  <select
                    value={cardType}
                    onChange={(e) => setCardType(e.target.value as CardType)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="debit">Carte de Débit (Immédiat)</option>
                    <option value="deferred_debit">Carte de Débit Différé</option>
                    <option value="credit">Carte de Crédit (Revolving / Réserve)</option>
                    <option value="commercial">Carte Commerciale / Entreprise (Business)</option>
                    <option value="prepaid">Carte Prépayée</option>
                  </select>
                </div>
              </div>

              {/* PAN Input & Luhn Status */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Numéro de Carte (PAN - 12 à 19 chiffres) :
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleGenerateValidPan(scheme)}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Générer PAN {scheme.toUpperCase()} Valide
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.replace(/\D/g, ''))}
                    placeholder="4970101234567890"
                    className={`w-full bg-slate-950 border rounded-lg px-3.5 py-2.5 font-mono text-sm tracking-wider text-slate-100 focus:outline-none ${
                      isValidLuhn
                        ? 'border-emerald-500/60 focus:border-emerald-400'
                        : 'border-red-500/60 focus:border-red-400'
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {isValidLuhn ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                        <Check className="w-3.5 h-3.5" /> Luhn Valide
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleFixLuhn}
                        className="flex items-center gap-1 text-xs font-semibold text-amber-300 bg-amber-950/80 hover:bg-amber-900 px-2 py-0.5 rounded border border-amber-800 transition-colors"
                      >
                        Corriger Clé
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>Longueur : {pan.length} chiffres (BIN: {pan.slice(0, 6)})</span>
                  <span>Clé de contrôle calculée : {luhnDetails.computedCheckDigit}</span>
                </div>
              </div>

              {/* Expiration Date & Cardholder Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Nom du Titulaire de la Carte :
                  </label>
                  <input
                    type="text"
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                    placeholder="JEAN DUPONT"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 uppercase"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Date d'Expiration :
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={expirationMonth}
                      onChange={(e) => setExpirationMonth(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-200 focus:outline-none"
                    >
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <span className="text-slate-500">/</span>
                    <select
                      value={expirationYear}
                      onChange={(e) => setExpirationYear(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-200 focus:outline-none"
                    >
                      {['26', '27', '28', '29', '30', '31', '32', '33', '34', '35'].map((y) => (
                        <option key={y} value={y}>
                          20{y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PLAFONDS & SERVICES ASSOCIÉS (NOUVELLE SECTION) */}
          {activeSection === 'limits' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    Plafonds & Paramètres d'Autorisation du Produit ({selectedProduct?.name})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Définition des limites de paiement, seuils de plancher hors-ligne (Floor limit) et couvertures d'assurance associées au produit.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {selectedProduct?.badgeText}
                </span>
              </div>

              {/* Authorization Mode Banner */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs flex items-center gap-3">
                <Zap className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div>
                  <div className="font-bold text-slate-200">
                    Mode d'Autorisation :{' '}
                    <span className="text-cyan-300">
                      {selectedProduct?.authorizationMode === 'systematic_online'
                        ? 'Autorisation Systématique en Ligne (Zéro Découvert)'
                        : selectedProduct?.authorizationMode === 'high_offline_floor'
                        ? 'Haut de Gamme (Seuil Hors-Ligne Étendu)'
                        : 'Standard Hybride'}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    {selectedProduct?.authorizationDescription}
                  </div>
                </div>
              </div>

              {/* Initial Account Balance */}
              <div className="p-4 bg-slate-950 rounded-xl border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    Solde Initial du Compte Bancaire (Base Émettrice) :
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Solde en euros qui sera crédité sur le compte du porteur lors de l'enregistrement en base.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={accountBalance}
                      onChange={(e) => setAccountBalance(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-emerald-400 w-36 text-right focus:outline-none focus:border-cyan-500"
                    />
                    <span className="absolute right-3 top-1.5 text-xs text-slate-500 pointer-events-none">€</span>
                  </div>
                </div>
              </div>

              {/* Editable Limits Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Monthly Payment Limit */}
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold">Plafond de Paiement (30 jours) :</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {limits.paymentMonthlyLimit.toLocaleString('fr-FR')} €
                    </span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={30000}
                    step={250}
                    value={limits.paymentMonthlyLimit}
                    onChange={(e) =>
                      setLimits((prev) => ({ ...prev, paymentMonthlyLimit: Number(e.target.value) }))
                    }
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>500 €</span>
                    <span>15 000 €</span>
                    <span>30 000 €</span>
                  </div>
                  {isExceedingPaymentLimit && (
                    <div className="p-2 bg-red-950/50 border border-red-800 rounded text-red-300 text-[11px] flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Montant saisi pour le cryptogramme ({txAmountNum} €) dépasse ce plafond !</span>
                    </div>
                  )}
                </div>

                {/* ATM Weekly Limit */}
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold">Plafond Retrait DAB (7 jours) :</span>
                    <span className="font-mono font-bold text-cyan-400 text-sm">
                      {limits.atmWeeklyLimit.toLocaleString('fr-FR')} €
                    </span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={5000}
                    step={100}
                    value={limits.atmWeeklyLimit}
                    onChange={(e) =>
                      setLimits((prev) => ({ ...prev, atmWeeklyLimit: Number(e.target.value) }))
                    }
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>200 €</span>
                    <span>2 500 €</span>
                    <span>5 000 €</span>
                  </div>
                </div>

                {/* Contactless Unitary Limit */}
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold">Sans Contact Unitaire (NFC) :</span>
                    <span className="font-mono font-bold text-slate-100 text-sm">
                      {limits.contactlessPerTxLimit} €
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Plafond réglementaire européen DSP2 sans saisie du code confidentiel PIN.
                  </span>
                </div>

                {/* Offline Floor Limit */}
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold">Seuil de Plancher Hors-Ligne :</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        limits.offlineFloorLimit === 0 ? 'text-amber-400' : 'text-indigo-400'
                      }`}
                    >
                      {limits.offlineFloorLimit === 0 ? '0 € (Systématique)' : `${limits.offlineFloorLimit} €`}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Montant sous lequel le TPE peut approuver la transaction hors-ligne sans appel réseau (TC).
                  </span>
                </div>
              </div>

              {/* Bundled Services & Insurances */}
              <div className="pt-4 border-t border-slate-800 space-y-2.5">
                <span className="text-xs font-bold text-slate-200 block">
                  Assurances, Assistances & Privilèges Inclus dans le Produit :
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {servicesList.map((srv, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2 text-slate-300"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>{srv}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SERVICE CODE & CVV / CVC */}
          {activeSection === 'security' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-6">
              {/* Service Code Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    Code de Service Bancaire (Service Code : {serviceCode})
                  </h3>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    DE 35 / Piste
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Position 1 */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <label className="text-slate-400 block font-semibold text-[11px]">
                      Position 1 (Interchange) :
                    </label>
                    <select
                      value={servicePos1}
                      onChange={(e) => setServicePos1(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="2">2 - International, Puce IC (Standard)</option>
                      <option value="1">1 - International, Piste magnétique</option>
                      <option value="6">6 - National uniquement, Puce IC</option>
                      <option value="5">5 - National uniquement, Piste</option>
                    </select>
                  </div>

                  {/* Position 2 */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <label className="text-slate-400 block font-semibold text-[11px]">
                      Position 2 (Règles d'Autorisation) :
                    </label>
                    <select
                      value={servicePos2}
                      onChange={(e) => setServicePos2(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="0">0 - Autorisation normale (Hors-ligne/En ligne)</option>
                      <option value="2">2 - Autorisation systématique en ligne (Electron/Maestro)</option>
                      <option value="4">4 - En ligne sauf accords bilatéraux</option>
                    </select>
                  </div>

                  {/* Position 3 */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <label className="text-slate-400 block font-semibold text-[11px]">
                      Position 3 (Restrictions & PIN) :
                    </label>
                    <select
                      value={servicePos3}
                      onChange={(e) => setServicePos3(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="1">1 - Pas de restriction, PIN normal</option>
                      <option value="0">0 - Pas de restriction, PIN obligatoire</option>
                      <option value="2">2 - Biens et services uniquement (Pas de DAB)</option>
                      <option value="3">3 - Retrait DAB uniquement</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* CVV / CVC Trio */}
              <div className="pt-4 border-t border-slate-800">
                <h4 className="text-xs font-bold text-slate-200 mb-2">
                  Codes de Vérification de Carte (CVV / CVC Cryptographiques) :
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    <span className="text-slate-400 block text-[11px] mb-1">CVV1 (Piste 1 & 2) :</span>
                    <span className="font-mono text-base font-bold text-cyan-300">{cvvValues.cvv1}</span>
                  </div>

                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    <span className="text-slate-400 block text-[11px] mb-1">CVV2 / CVC2 (Vente à Distance) :</span>
                    <span className="font-mono text-base font-bold text-amber-300">{cvvValues.cvv2}</span>
                  </div>

                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    <span className="text-slate-400 block text-[11px] mb-1">iCVV (Puce EMV) :</span>
                    <span className="font-mono text-base font-bold text-emerald-300">{cvvValues.icvv}</span>
                  </div>
                </div>
              </div>

              {/* PIN Code & ISO-0 PIN Block */}
              <div className="pt-4 border-t border-slate-800">
                <h4 className="text-xs font-bold text-slate-200 mb-2">
                  Code Confidentiel Porteur & Bloc PIN Chiffré (ISO 9564-1 Format 0) :
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1.5">
                    <label className="text-slate-400 block text-[11px]">Code PIN en clair (4 chiffres) :</label>
                    <input
                      type="password"
                      maxLength={4}
                      value={clearPin}
                      onChange={(e) => setClearPin(e.target.value.replace(/\D/g, ''))}
                      className="w-24 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 font-mono text-cyan-300 font-bold text-sm tracking-widest text-center"
                    />
                  </div>

                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1.5">
                    <span className="text-slate-400 block text-[11px]">Bloc PIN ISO Format 0 chiffré (DE 52) :</span>
                    <div className="font-mono text-xs text-indigo-300 font-bold p-1.5 bg-slate-900 rounded border border-slate-800 select-all">
                      {pinBlock.encryptedHex}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EMV AID & CRYPTOGRAM ARQC / TC / AAC */}
          {activeSection === 'emv' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    Définition des AID & Moteur Cryptographique EMV
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Calcul dynamique du cryptogramme pour le Tag 9F26 selon la clé de session et les données CDOL1.
                  </p>
                </div>
              </div>

              {/* AID Selection Table / Dropdown */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Application de Paiement (AID - Tag 84) :
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {EMV_AID_CATALOG.map((aidItem) => (
                    <button
                      key={aidItem.aid}
                      type="button"
                      onClick={() => setSelectedAid(aidItem)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        selectedAid.aid === aidItem.aid
                          ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs">
                        <span>{aidItem.label}</span>
                        <span className="font-mono text-[10px] text-cyan-400">{aidItem.aid}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate">{aidItem.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cryptogram parameters */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">
                    Paramètres de Génération du Cryptogramme (CDOL1) :
                  </span>
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                    {(['ARQC', 'TC', 'AAC'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCryptoType(t)}
                        className={`px-2.5 py-1 rounded font-bold font-mono text-[11px] transition-all ${
                          cryptoType === t
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div>
                    <label className="text-slate-400 block text-[10px] mb-1">Montant (€) :</label>
                    <input
                      type="text"
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-xs text-cyan-300"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block text-[10px] mb-1">Compteur ATC (9F36) :</label>
                    <input
                      type="text"
                      value={atc}
                      onChange={(e) => setAtc(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-xs text-cyan-300"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block text-[10px] mb-1">Aléa TPE (9F37) :</label>
                    <input
                      type="text"
                      value={unpredictableNumber}
                      onChange={(e) => setUnpredictableNumber(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-xs text-cyan-300"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block text-[10px] mb-1">Profil AIP (82) :</label>
                    <input
                      type="text"
                      value={aip}
                      onChange={(e) => setAip(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-xs text-cyan-300"
                    />
                  </div>
                </div>
              </div>

              {/* Calculated Cryptogram Banner */}
              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-100">
                      Cryptogramme {cryptoType} Calculé (Tag 9F26) :
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      CID : {cryptogramResult.cid}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyText(cryptogramResult.cryptogramHex, 'arqc')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    {copiedKey === 'arqc' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'arqc' ? 'Copié' : 'Copier'}
                  </button>
                </div>

                <div className="font-mono text-base font-bold text-emerald-300 tracking-wider bg-slate-900 p-2.5 rounded-lg border border-slate-800 select-all">
                  {cryptogramResult.cryptogramHex}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LUHN DETAILS */}
          {activeSection === 'luhn' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-purple-400" />
                    Détail Mathématique de l'Algorithme de Luhn (MOD 10)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Spécification internationale ISO/IEC 7812-1 pour la détection des erreurs de saisie sur le PAN.
                  </p>
                </div>
                {!isValidLuhn && (
                  <button
                    onClick={handleFixLuhn}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                  >
                    Ajuster le dernier chiffre
                  </button>
                )}
              </div>

              {/* Step by Step Matrix */}
              <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950 p-3">
                <table className="w-full text-center text-xs font-mono">
                  <tbody>
                    <tr className="border-b border-slate-800/80">
                      <td className="text-left font-sans text-slate-400 py-2 pr-3">Chiffre PAN :</td>
                      {luhnDetails.digits.map((d, i) => (
                        <td
                          key={i}
                          className={`px-1.5 py-1.5 font-bold ${
                            i === luhnDetails.digits.length - 1 ? 'text-amber-400 bg-amber-950/40' : 'text-slate-200'
                          }`}
                        >
                          {d}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-slate-800/80 text-slate-400">
                      <td className="text-left font-sans text-slate-400 py-2 pr-3">Pondération :</td>
                      {luhnDetails.factors.map((f, i) => (
                        <td key={i} className="px-1.5 py-1.5 text-cyan-400">
                          ×{f}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-slate-800/80 text-slate-300">
                      <td className="text-left font-sans text-slate-400 py-2 pr-3">Produit :</td>
                      {luhnDetails.products.map((p, i) => (
                        <td key={i} className="px-1.5 py-1.5 text-slate-300">
                          {p}
                        </td>
                      ))}
                    </tr>
                    <tr className="text-emerald-400 font-bold">
                      <td className="text-left font-sans text-slate-400 py-2 pr-3">Valeur retenue :</td>
                      {luhnDetails.reducedValues.map((r, i) => (
                        <td key={i} className="px-1.5 py-1.5 bg-emerald-950/20">
                          {r}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Somme Totale :</span>
                  <span className="font-mono text-sm font-bold text-slate-100">{luhnDetails.totalSum}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Reste Modulo 10 :</span>
                  <span className="font-mono text-sm font-bold text-cyan-400">{luhnDetails.remainder}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Statut :</span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold text-xs ${
                      isValidLuhn
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}
                  >
                    {isValidLuhn ? 'Conforme' : 'Non conforme'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
