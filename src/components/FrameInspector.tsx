import React, { useState, useEffect } from 'react';
import { PackedMessage } from '../types/iso8583';
import { Copy, Check, Download, FileCode, Terminal, Binary, ListTree, Sparkles, RotateCcw } from 'lucide-react';
import { FrameDecoderTab } from './FrameDecoderTab';

export interface FrameInspectorProps {
  packedMessage: PackedMessage;
  tpdu: string;
  onLoadIntoStudio?: (mti: string, fields: Record<number, string>, tpdu?: string) => void;
  initialMode?: 'inspector' | 'decoder';
}

export const FrameInspector: React.FC<FrameInspectorProps> = ({
  packedMessage,
  tpdu,
  onLoadIntoStudio = () => {},
  initialMode = 'inspector',
}) => {
  const [inspectorMode, setInspectorMode] = useState<'inspector' | 'decoder'>(initialMode);
  const [activeTab, setActiveTab] = useState<'dump' | 'tree' | 'rawHex' | 'rawAscii' | 'json'>('dump');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  useEffect(() => {
    if (initialMode) {
      setInspectorMode(initialMode);
    }
  }, [initialMode]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([packedMessage.rawHex], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `iso8583_message_${packedMessage.mti}_${Date.now()}.iso8583`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Decode MTI breakdown
  const mti = packedMessage.mti;
  const mtiVersion =
    mti[0] === '0'
      ? 'ISO 8583:1987'
      : mti[0] === '1'
      ? 'ISO 8583:1993'
      : mti[0] === '2'
      ? 'ISO 8583:2003'
      : 'Réservé';

  const mtiClass =
    mti[1] === '1'
      ? 'Autorisation'
      : mti[1] === '2'
      ? 'Financier (Paiement)'
      : mti[1] === '4'
      ? 'Redressement / Annulation'
      : mti[1] === '5'
      ? 'Rapprochement / Télécollecte'
      : mti[1] === '8'
      ? 'Gestion Réseau'
      : 'Autre';

  const mtiFunction =
    mti[2] === '0'
      ? 'Demande (Request)'
      : mti[2] === '1'
      ? 'Réponse (Response)'
      : mti[2] === '2'
      ? 'Avis (Advice)'
      : mti[2] === '3'
      ? 'Acquittement d\'avis'
      : 'Autre';

  const mtiOriginator =
    mti[3] === '0'
      ? 'Acquéreur'
      : mti[3] === '1'
      ? 'Acquéreur (Répétition)'
      : mti[3] === '2'
      ? 'Émetteur'
      : 'Autre';

  return (
    <div className="space-y-6">
      {/* Mode Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800 shadow-lg">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setInspectorMode('inspector')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              inspectorMode === 'inspector'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Trame & Hex Dump (Générée)</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-cyan-300 font-semibold">
              {packedMessage.totalBytes}B
            </span>
          </button>

          <button
            onClick={() => setInspectorMode('decoder')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              inspectorMode === 'decoder'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-indigo-400" />
            <span>Décodeur Externe de Trame</span>
          </button>
        </div>

        {inspectorMode === 'decoder' && (
          <button
            onClick={() => setInspectorMode('inspector')}
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold px-3 py-1.5 rounded-lg hover:bg-cyan-950/40 transition-colors"
          >
            <span>← Revenir à l'Inspecteur de Trame</span>
          </button>
        )}
      </div>

      {/* Embedded View: External Decoder */}
      {inspectorMode === 'decoder' ? (
        <FrameDecoderTab onLoadIntoStudio={onLoadIntoStudio} />
      ) : (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-sm">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-semibold text-slate-100">
              Analyseur de Trame & Encodage
            </h3>
            <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {packedMessage.totalBytes} octets
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Inspection de la trame binaire complète à envoyer au réseau d'acquisition ou switch bancaire.
          </p>
        </div>

        {/* View Selection Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('dump')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'dump'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Binary className="w-3.5 h-3.5" />
            Hex Dump
          </button>
          <button
            onClick={() => setActiveTab('tree')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'tree'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListTree className="w-3.5 h-3.5" />
            Décomposition
          </button>
          <button
            onClick={() => setActiveTab('rawHex')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'rawHex'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Flux Hex
          </button>
          <button
            onClick={() => setActiveTab('rawAscii')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'rawAscii'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Flux ASCII
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'json'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            JSON
          </button>
        </div>
      </div>

      {/* Protocol Summary Bar (TPDU, MTI, Bitmap) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
        {/* TPDU Header */}
        <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
          <div className="text-slate-400 font-medium mb-1">En-tête TPDU (5 octets) :</div>
          <div className="font-mono text-indigo-300 font-bold select-all">
            {tpdu || <span className="text-slate-500 font-normal">Sans en-tête</span>}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Routage réseau NII / Terminal</div>
        </div>

        {/* MTI Breakdown */}
        <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400 font-medium">MTI :</span>
            <span className="font-mono font-bold text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-700">
              {mti}
            </span>
          </div>
          <div className="text-[11px] text-slate-300 font-medium">
            {mtiClass} - {mtiFunction}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {mtiVersion} • Origine: {mtiOriginator}
          </div>
        </div>

        {/* Bitmap Summary */}
        <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
          <div className="text-slate-400 font-medium mb-1">Bitmap Encodée :</div>
          <div className="font-mono text-cyan-300 font-semibold truncate select-all">
            {packedMessage.bitmapHex}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {packedMessage.bitmapHex.length === 32 ? 'Primaire + Secondaire (128b)' : 'Primaire (64b)'}
          </div>
        </div>
      </div>

      {/* Tab 1: Wireshark Hex Dump */}
      {activeTab === 'dump' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">
              Format Hex Dump standard (Offset | Octets hexadécimaux | ASCII décodé) :
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  copyToClipboard(
                    packedMessage.hexDumpLines
                      .map((l) => `${l.offset}  ${l.hex}  |${l.ascii}|`)
                      .join('\n'),
                    'dump'
                  )
                }
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
              >
                {copiedType === 'dump' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedType === 'dump' ? 'Copié' : 'Copier Hex Dump'}
              </button>
              <button
                onClick={handleDownloadFile}
                className="flex items-center gap-1 text-xs text-slate-300 hover:text-white"
              >
                <Download className="w-3.5 h-3.5" />
                Télécharger
              </button>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs overflow-x-auto max-h-[420px]">
            {packedMessage.hexDumpLines.map((line, idx) => (
              <div key={idx} className="flex gap-4 py-0.5 hover:bg-slate-900/60 transition-colors">
                <span className="text-slate-600 select-none">{line.offset}</span>
                <span className="text-cyan-300 tracking-wider select-all">{line.hex}</span>
                <span className="text-emerald-400 select-all border-l border-slate-800 pl-3">
                  |{line.ascii}|
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Tree Breakdown */}
      {activeTab === 'tree' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-mono">
                <th className="py-2.5 px-3">Offset</th>
                <th className="py-2.5 px-3">Élément</th>
                <th className="py-2.5 px-3">Nom</th>
                <th className="py-2.5 px-3">Type & Format</th>
                <th className="py-2.5 px-3">Préfixe Lg</th>
                <th className="py-2.5 px-3">Valeur / Données</th>
                <th className="py-2.5 px-3 text-right">Octets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {/* TPDU */}
              {tpdu && (
                <tr className="hover:bg-slate-950/50">
                  <td className="py-2.5 px-3 text-slate-500">0000</td>
                  <td className="py-2.5 px-3 font-semibold text-indigo-400">TPDU</td>
                  <td className="py-2.5 px-3 text-slate-300 font-sans">En-tête de routage</td>
                  <td className="py-2.5 px-3 text-slate-400">b 5 FIXED</td>
                  <td className="py-2.5 px-3 text-slate-500">-</td>
                  <td className="py-2.5 px-3 text-indigo-300">{tpdu}</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">5</td>
                </tr>
              )}

              {/* MTI */}
              <tr className="hover:bg-slate-950/50">
                <td className="py-2.5 px-3 text-slate-500">{tpdu ? '0005' : '0000'}</td>
                <td className="py-2.5 px-3 font-semibold text-cyan-400">MTI</td>
                <td className="py-2.5 px-3 text-slate-300 font-sans">Message Type Identifier</td>
                <td className="py-2.5 px-3 text-slate-400">n 4 FIXED</td>
                <td className="py-2.5 px-3 text-slate-500">-</td>
                <td className="py-2.5 px-3 text-cyan-300 font-bold">{mti}</td>
                <td className="py-2.5 px-3 text-right text-slate-400">4</td>
              </tr>

              {/* Bitmap */}
              <tr className="hover:bg-slate-950/50">
                <td className="py-2.5 px-3 text-slate-500">{tpdu ? '0009' : '0004'}</td>
                <td className="py-2.5 px-3 font-semibold text-cyan-400">BITMAP</td>
                <td className="py-2.5 px-3 text-slate-300 font-sans">
                  {packedMessage.bitmapHex.length === 32 ? 'Primaire & Secondaire' : 'Primaire'}
                </td>
                <td className="py-2.5 px-3 text-slate-400">b {packedMessage.bitmapHex.length === 32 ? '16' : '8'}</td>
                <td className="py-2.5 px-3 text-slate-500">-</td>
                <td className="py-2.5 px-3 text-cyan-300 break-all">{packedMessage.bitmapHex}</td>
                <td className="py-2.5 px-3 text-right text-slate-400">
                  {packedMessage.bitmapHex.length === 32 ? '16' : '8'}
                </td>
              </tr>

              {/* Fields */}
              {packedMessage.packedFields.map((field) => (
                <tr key={field.de} className="hover:bg-slate-950/50">
                  <td className="py-2.5 px-3 text-slate-500">{field.offset.toString(16).padStart(4, '0').toUpperCase()}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-200">DE {field.de}</td>
                  <td className="py-2.5 px-3 text-slate-300 font-sans">{field.name}</td>
                  <td className="py-2.5 px-3 text-slate-400">
                    {field.type} • {field.lengthType}
                  </td>
                  <td className="py-2.5 px-3 text-amber-400 font-bold">{field.rawHeader || '-'}</td>
                  <td className="py-2.5 px-3 text-cyan-200 break-all max-w-xs">{field.value}</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">{field.byteLength}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Raw Hex */}
      {activeTab === 'rawHex' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Flux continu d'octets hexadécimaux :</span>
            <button
              onClick={() => copyToClipboard(packedMessage.rawHex, 'rawHex')}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
            >
              {copiedType === 'rawHex' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedType === 'rawHex' ? 'Copié' : 'Copier'}
            </button>
          </div>
          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-cyan-300 break-all select-all leading-relaxed max-h-[300px] overflow-y-auto">
            {packedMessage.rawHex}
          </div>
        </div>
      )}

      {/* Tab 4: Raw ASCII */}
      {activeTab === 'rawAscii' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Format textuel lisible (ASCII string) :</span>
            <button
              onClick={() => copyToClipboard(packedMessage.rawAscii, 'rawAscii')}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
            >
              {copiedType === 'rawAscii' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedType === 'rawAscii' ? 'Copié' : 'Copier'}
            </button>
          </div>
          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 break-all select-all leading-relaxed max-h-[300px] overflow-y-auto">
            {packedMessage.rawAscii}
          </div>
        </div>
      )}

      {/* Tab 5: JSON Export */}
      {activeTab === 'json' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Objet JSON structuré de la trame :</span>
            <button
              onClick={() =>
                copyToClipboard(
                  JSON.stringify(
                    {
                      tpdu,
                      mti,
                      bitmapHex: packedMessage.bitmapHex,
                      fields: packedMessage.packedFields.reduce(
                        (acc, f) => ({ ...acc, [f.de]: { name: f.name, value: f.value, type: f.type } }),
                        {}
                      ),
                      rawHex: packedMessage.rawHex,
                    },
                    null,
                    2
                  ),
                  'json'
                )
              }
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
            >
              {copiedType === 'json' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedType === 'json' ? 'Copié' : 'Copier JSON'}
            </button>
          </div>
          <pre className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto max-h-[340px]">
            {JSON.stringify(
              {
                tpdu,
                mti,
                bitmapHex: packedMessage.bitmapHex,
                totalBytes: packedMessage.totalBytes,
                fields: packedMessage.packedFields.reduce(
                  (acc, f) => ({
                    ...acc,
                    [`DE_${f.de}`]: {
                      name: f.name,
                      type: f.type,
                      lengthType: f.lengthType,
                      value: f.value,
                    },
                  }),
                  {}
                ),
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  )}
</div>
  );
};
