import React, { useState } from 'react';
import { CardProfile } from '../types/cardProfile';
import { Wifi, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';

interface CardVisualizerProps {
  card: CardProfile;
  isValidLuhn: boolean;
}

export const CardVisualizer: React.FC<CardVisualizerProps> = ({ card, isValidLuhn }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  // Scheme styling
  const getSchemeStyles = () => {
    // If product has a defined gradient, prioritize it
    const productGradient = card.product?.gradient;

    switch (card.scheme) {
      case 'cb':
        return {
          gradient: productGradient || 'from-emerald-900 via-teal-900 to-slate-900',
          accent: 'border-emerald-500/40',
          logoText: 'CB',
          logoSub: card.product?.name || 'Cartes Bancaires',
          chipColor: 'bg-gradient-to-tr from-amber-300 via-yellow-200 to-amber-400',
        };
      case 'visa':
        return {
          gradient: productGradient || 'from-blue-950 via-indigo-950 to-slate-950',
          accent: 'border-blue-500/40',
          logoText: 'VISA',
          logoSub: card.product?.name || 'Classic / Premier',
          chipColor: 'bg-gradient-to-tr from-amber-300 via-yellow-200 to-amber-400',
        };
      case 'mastercard':
        return {
          gradient: productGradient || 'from-red-950 via-zinc-950 to-amber-950',
          accent: 'border-red-500/40',
          logoText: 'Mastercard',
          logoSub: card.product?.name || 'World Elite',
          chipColor: 'bg-gradient-to-tr from-yellow-300 via-amber-200 to-yellow-400',
        };
      case 'amex':
        return {
          gradient: productGradient || 'from-slate-800 via-zinc-900 to-neutral-950',
          accent: 'border-cyan-500/40',
          logoText: 'AMEX',
          logoSub: card.product?.name || 'American Express',
          chipColor: 'bg-gradient-to-tr from-slate-200 via-slate-100 to-slate-300',
        };
      default:
        return {
          gradient: productGradient || 'from-slate-900 via-indigo-950 to-slate-900',
          accent: 'border-slate-700',
          logoText: 'BANK',
          logoSub: 'Debit Card',
          chipColor: 'bg-amber-300',
        };
    }
  };

  const schemeStyle = getSchemeStyles();

  // Format PAN in groups of 4
  const formattedPan = card.pan
    ? card.pan.replace(/\s+/g, '').replace(/(\d{4})/g, '$1 ').trim()
    : '•••• •••• •••• ••••';

  return (
    <div className="flex flex-col items-center">
      {/* 3D Card Container */}
      <div
        className="w-full max-w-[380px] h-[230px] perspective-1000 cursor-pointer group"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div
          className={`relative w-full h-full duration-700 transform-style-3d transition-transform rounded-2xl shadow-2xl ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* FRONT FACE */}
          <div
            className={`absolute inset-0 w-full h-full rounded-2xl p-5 bg-gradient-to-tr ${schemeStyle.gradient} border ${schemeStyle.accent} text-white shadow-2xl backface-hidden flex flex-col justify-between overflow-hidden select-none`}
          >
            {/* Holographic shimmer effect */}
            <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/5 to-transparent rotate-45 pointer-events-none group-hover:animate-pulse" />

            {/* Top row: Bank, Chip & Contactless */}
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                {/* Chip graphic */}
                <div
                  className={`w-11 h-9 rounded-md ${schemeStyle.chipColor} border border-amber-500/60 shadow-inner flex flex-col justify-around p-1 relative`}
                >
                  <div className="w-full h-0.5 bg-amber-700/40" />
                  <div className="w-1/2 h-0.5 bg-amber-700/40" />
                  <div className="w-full h-0.5 bg-amber-700/40" />
                  <div className="absolute right-1 top-1 w-1.5 h-1.5 rounded-full bg-amber-600/30" />
                </div>
                {/* Contactless waves */}
                <Wifi className="w-5 h-5 text-slate-300 rotate-90" />
              </div>

              {/* Card Type Badge & Network */}
              <div className="text-right flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5">
                  {card.product?.badgeText && (
                    <span className="text-[10px] font-mono font-extrabold tracking-wider uppercase px-2 py-0.5 rounded bg-amber-500/30 text-amber-200 border border-amber-400/50 shadow-sm">
                      {card.product.badgeText}
                    </span>
                  )}
                  <span className="text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-white/10 border border-white/20">
                    {card.cardType === 'debit'
                      ? 'DÉBIT'
                      : card.cardType === 'credit'
                      ? 'CRÉDIT'
                      : card.cardType === 'deferred_debit'
                      ? 'DÉBIT DIFFÉRÉ'
                      : card.cardType.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm font-bold tracking-tight text-white mt-0.5">
                  {schemeStyle.logoText}
                </div>
              </div>
            </div>

            {/* Middle: Embossed PAN */}
            <div className="z-10 my-auto">
              <div className="flex items-center justify-between">
                <span className="text-base sm:text-lg font-mono font-semibold tracking-widest text-slate-100 drop-shadow-md">
                  {formattedPan}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {isValidLuhn ? (
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Clé de Luhn valide
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-red-400">
                    ⚠️ Clé de Luhn non conforme
                  </span>
                )}
                <span className="text-[10px] text-slate-400 font-mono">
                  • PSN: {card.psn}
                </span>
              </div>
            </div>

            {/* Bottom Row: Expiration & Cardholder */}
            <div className="flex items-end justify-between z-10 text-xs">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 block">
                  Titulaire
                </span>
                <span className="font-mono font-semibold text-slate-200 tracking-wider uppercase text-[11px] truncate max-w-[190px] block">
                  {card.cardholderName || 'PORTEUR DE CARTE'}
                </span>
              </div>

              <div className="text-center">
                <span className="text-[8px] uppercase tracking-wider text-slate-400 block">
                  EXP DATE
                </span>
                <span className="font-mono font-bold text-slate-100 text-xs">
                  {card.expirationMonth}/{card.expirationYear}
                </span>
              </div>

              {/* Scheme Logo Badge */}
              <div className="flex items-center">
                {card.scheme === 'mastercard' ? (
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-red-600/90 shadow-sm" />
                    <div className="w-6 h-6 rounded-full bg-amber-500/90 shadow-sm" />
                  </div>
                ) : card.scheme === 'cb' ? (
                  <div className="px-2 py-1 rounded bg-emerald-600 font-black text-xs text-white tracking-tighter">
                    CB
                  </div>
                ) : card.scheme === 'visa' ? (
                  <div className="italic font-black text-sm text-yellow-400 tracking-wider">
                    VISA
                  </div>
                ) : (
                  <div className="font-bold text-xs text-cyan-300">
                    AMEX
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* BACK FACE */}
          <div
            className={`absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-tr ${schemeStyle.gradient} border ${schemeStyle.accent} text-white shadow-2xl rotate-y-180 backface-hidden flex flex-col justify-between overflow-hidden select-none py-4`}
          >
            {/* Magnetic Stripe */}
            <div className="w-full h-10 bg-slate-950 border-y border-slate-800 shadow-inner" />

            {/* Signature Strip & CVV Box */}
            <div className="px-5 space-y-2">
              <div className="flex items-center gap-2">
                {/* White signature panel */}
                <div className="flex-1 h-8 bg-slate-100 rounded-sm flex items-center px-3 font-serif italic text-slate-800 text-xs select-none shadow-inner overflow-hidden">
                  <span className="truncate">{card.cardholderName}</span>
                </div>
                {/* CVV Box */}
                <div className="w-14 h-8 bg-white border border-slate-300 rounded-sm flex items-center justify-center font-mono font-bold text-slate-900 text-sm shadow-inner">
                  {card.cvv2 || '•••'}
                </div>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                <span>Code de Service : <strong>{card.serviceCode}</strong></span>
                <span>CVV2 / CVC2 Sécurité</span>
              </div>
            </div>

            {/* Bottom info & AID */}
            <div className="px-5 text-[9px] text-slate-400 flex items-center justify-between border-t border-white/10 pt-2">
              <div>
                <span>AID : </span>
                <span className="font-mono text-cyan-300 font-bold">{card.selectedAid.aid}</span>
              </div>
              <div className="text-right">
                <span>Appli : </span>
                <span className="font-semibold text-slate-300">{card.selectedAid.label}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Flip button */}
      <button
        type="button"
        onClick={() => setIsFlipped(!isFlipped)}
        className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>{isFlipped ? 'Voir le recto' : 'Retourner la carte (Verso / Piste / CVV)'}</span>
      </button>
    </div>
  );
};
