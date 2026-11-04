import React, { useState } from 'react';
import { BitmapState } from '../types/iso8583';
import { ISO_8583_FIELDS } from '../utils/iso8583Spec';
import { formatBinaryGroups, formatHexOctets } from '../utils/bitmapEngine';
import { Copy, Check, Layers, Eye, Info } from 'lucide-react';

interface BitmapVisualizerProps {
  bitmapState: BitmapState;
  fields: Record<number, string>;
  onSelectField?: (de: number) => void;
  onToggleField?: (de: number) => void;
}

export const BitmapVisualizer: React.FC<BitmapVisualizerProps> = ({
  bitmapState,
  fields,
  onSelectField,
  onToggleField,
}) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'hex' | 'binary'>('matrix');
  const [matrixView, setMatrixView] = useState<'all' | 'primary' | 'secondary'>('all');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [hoveredBit, setHoveredBit] = useState<number | null>(null);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const hoveredFieldSpec = hoveredBit ? ISO_8583_FIELDS[hoveredBit] : null;
  const hoveredFieldValue = hoveredBit ? fields[hoveredBit] : undefined;

  // Determine which bits to render
  const startBit = matrixView === 'secondary' ? 65 : 1;
  const endBit = matrixView === 'primary' ? 64 : bitmapState.hasSecondary ? 128 : 64;
  const bitsRange: number[] = [];
  for (let i = startBit; i <= endBit; i++) {
    bitsRange.push(i);
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-semibold text-slate-100">
              Trame de Bitmap ISO 8583
            </h3>
            {bitmapState.hasSecondary ? (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Primaire (64 bits) + Secondaire (64 bits)
              </span>
            ) : (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Primaire (64 bits)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Représentation binaire matricielle des champs actifs de la trame. Le bit 1 active automatiquement la bitmap secondaire.
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'matrix'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Matrice de Bits
          </button>
          <button
            onClick={() => setActiveTab('hex')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'hex'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Hexadécimal
          </button>
          <button
            onClick={() => setActiveTab('binary')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'binary'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Flux Binaire
          </button>
        </div>
      </div>

      {/* Tab 1: Matrix View */}
      {activeTab === 'matrix' && (
        <div className="mt-4">
          {/* Sub-filter for Primary / Secondary */}
          {bitmapState.hasSecondary && (
            <div className="flex items-center gap-2 mb-3 text-xs">
              <span className="text-slate-400">Affichage :</span>
              <button
                onClick={() => setMatrixView('all')}
                className={`px-2.5 py-1 rounded border ${
                  matrixView === 'all'
                    ? 'bg-slate-800 border-slate-700 text-slate-200'
                    : 'bg-transparent border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Tout (1 à 128)
              </button>
              <button
                onClick={() => setMatrixView('primary')}
                className={`px-2.5 py-1 rounded border ${
                  matrixView === 'primary'
                    ? 'bg-slate-800 border-slate-700 text-slate-200'
                    : 'bg-transparent border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Primaire uniquement (1 - 64)
              </button>
              <button
                onClick={() => setMatrixView('secondary')}
                className={`px-2.5 py-1 rounded border ${
                  matrixView === 'secondary'
                    ? 'bg-slate-800 border-slate-700 text-slate-200'
                    : 'bg-transparent border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Secondaire uniquement (65 - 128)
              </button>
            </div>
          )}

          {/* Interactive Bit Grid (16 columns for desktop, 8 for tablet) */}
          <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 p-3 bg-slate-950/80 rounded-lg border border-slate-800/80">
            {bitsRange.map((bitNum) => {
              const isActive = bitmapState.activeBits.includes(bitNum);
              const isBit1 = bitNum === 1;
              const hasVal = fields[bitNum] !== undefined && fields[bitNum].trim() !== '';

              return (
                <button
                  key={bitNum}
                  type="button"
                  onMouseEnter={() => setHoveredBit(bitNum)}
                  onMouseLeave={() => setHoveredBit(null)}
                  onClick={() => {
                    if (onSelectField) onSelectField(bitNum);
                    if (bitNum !== 1 && onToggleField) onToggleField(bitNum);
                  }}
                  className={`relative flex flex-col items-center justify-center p-1.5 h-12 rounded border transition-all text-center select-none ${
                    isActive
                      ? isBit1
                        ? 'bg-indigo-950/80 border-indigo-500/70 text-indigo-300 shadow-sm shadow-indigo-500/20'
                        : 'bg-cyan-950/70 border-cyan-500/60 text-cyan-200 shadow-sm shadow-cyan-500/20 hover:border-cyan-400'
                      : 'bg-slate-900/40 border-slate-800/60 text-slate-600 hover:border-slate-700 hover:text-slate-400'
                  }`}
                  title={`DE ${bitNum}: ${ISO_8583_FIELDS[bitNum]?.name || 'Champ ' + bitNum} (${isActive ? 'Présent' : 'Absent'})`}
                >
                  <span className="text-[10px] font-mono font-medium leading-none">
                    {bitNum}
                  </span>
                  <span
                    className={`text-xs font-mono font-bold mt-1 ${
                      isActive
                        ? isBit1
                          ? 'text-indigo-400'
                          : 'text-cyan-400'
                        : 'text-slate-600'
                    }`}
                  >
                    {isActive ? '1' : '0'}
                  </span>
                  {hasVal && bitNum !== 1 && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-cyan-400 ring-2 ring-cyan-950" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Hover Inspector Tooltip / Details Drawer */}
          <div className="mt-3 min-h-[64px] p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
            {hoveredBit ? (
              <div className="flex items-center gap-3 w-full">
                <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-mono font-bold text-sm">
                  {hoveredBit}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200 truncate">
                      {hoveredFieldSpec?.name || `Champ de données ${hoveredBit}`}
                    </span>
                    {hoveredBit === 1 ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                        Indicateur Bitmap Secondaire
                      </span>
                    ) : hoveredFieldSpec ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                        {hoveredFieldSpec.type.toUpperCase()} • {hoveredFieldSpec.lengthType} ({hoveredFieldSpec.length})
                      </span>
                    ) : null}
                  </div>
                  <p className="text-slate-400 text-[11px] truncate mt-0.5">
                    {hoveredFieldSpec?.description || 'Champ réservé ou spécifique'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span
                    className={`inline-block px-2 py-0.5 rounded font-mono font-medium ${
                      bitmapState.activeBits.includes(hoveredBit)
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {bitmapState.activeBits.includes(hoveredBit) ? 'Bit = 1 (Actif)' : 'Bit = 0 (Inactif)'}
                  </span>
                  {hoveredFieldValue && (
                    <div className="text-[10px] font-mono text-cyan-400 mt-1 max-w-[200px] truncate">
                      Val: {hoveredFieldValue}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <Info className="w-4 h-4 text-cyan-400" />
                <span>
                  Survolez un bit pour inspecter ses spécifications ISO 8583 ou cliquez pour activer/éditer le champ.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Hex View */}
      {activeTab === 'hex' && (
        <div className="mt-4 space-y-3">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                Bitmap Primaire (Champs 1 à 64 - 16 caractères hex / 8 octets) :
              </span>
              <button
                onClick={() => copyToClipboard(bitmapState.primaryHex, 'primaryHex')}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                {copiedType === 'primaryHex' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedType === 'primaryHex' ? 'Copié' : 'Copier'}
              </button>
            </div>
            <div className="font-mono text-sm tracking-wider text-cyan-300 font-semibold p-2 bg-slate-900 rounded border border-slate-800/80 select-all">
              {formatHexOctets(bitmapState.primaryHex)}
            </div>
          </div>

          {bitmapState.hasSecondary && bitmapState.secondaryHex && (
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                  Bitmap Secondaire (Champs 65 à 128 - 16 caractères hex / 8 octets) :
                </span>
                <button
                  onClick={() => copyToClipboard(bitmapState.secondaryHex!, 'secondaryHex')}
                  className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300"
                >
                  {copiedType === 'secondaryHex' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedType === 'secondaryHex' ? 'Copié' : 'Copier'}
                </button>
              </div>
              <div className="font-mono text-sm tracking-wider text-indigo-300 font-semibold p-2 bg-slate-900 rounded border border-slate-800/80 select-all">
                {formatHexOctets(bitmapState.secondaryHex)}
              </div>
            </div>
          )}

          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400">Trame hexadécimale continue de la bitmap :</span>
            <div className="font-mono text-xs text-slate-200 mt-1 select-all break-all">
              {bitmapState.hex}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Binary Stream */}
      {activeTab === 'binary' && (
        <div className="mt-4 space-y-3">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">
                Flux binaire groupé par octets ({bitmapState.binary.length} bits) :
              </span>
              <button
                onClick={() => copyToClipboard(bitmapState.binary, 'binary')}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                {copiedType === 'binary' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedType === 'binary' ? 'Copié' : 'Copier binaire'}
              </button>
            </div>
            <div className="font-mono text-xs text-slate-300 bg-slate-900 p-2.5 rounded border border-slate-800 leading-relaxed tracking-wider break-all select-all">
              {formatBinaryGroups(bitmapState.binary, 8)}
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats bar */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-4">
          <span>
            <strong className="text-slate-200">{bitmapState.activeBits.length}</strong> champs actifs
          </span>
          <span>
            Primaire (1-64) :{' '}
            <strong className="text-cyan-400">
              {bitmapState.activeBits.filter((b) => b <= 64).length}
            </strong>
          </span>
          {bitmapState.hasSecondary && (
            <span>
              Secondaire (65-128) :{' '}
              <strong className="text-indigo-400">
                {bitmapState.activeBits.filter((b) => b > 64).length}
              </strong>
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-400">
          Taille bitmap :{' '}
          <span className="font-mono text-slate-200">
            {bitmapState.hasSecondary ? '16 octets (128 bits)' : '8 octets (64 bits)'}
          </span>
        </div>
      </div>
    </div>
  );
};
