import React, { useState } from 'react';
import { unpackIso8583Message } from '../utils/iso8583Packer';
import { decodeTlvStream } from '../utils/tlvEngine';
import { ISO_8583_FIELDS } from '../utils/iso8583Spec';
import { ArrowDownRight, Sparkles, Check, AlertCircle, Cpu, Download, ArrowRight } from 'lucide-react';

interface FrameDecoderTabProps {
  onLoadIntoStudio: (mti: string, fields: Record<number, string>, tpdu?: string) => void;
}

const SAMPLE_RAW_FRAME =
  '600001000002007238000008C08000164970101234567890000000000000004500110203100000012414251011022812541105100100POS00042CARREFOUR-92410CARREFOUR EXPRESS   PARIS        FR978';

export const FrameDecoderTab: React.FC<FrameDecoderTabProps> = ({ onLoadIntoStudio }) => {
  const [rawInput, setRawInput] = useState<string>(SAMPLE_RAW_FRAME);
  const [decodedResult, setDecodedResult] = useState<ReturnType<typeof unpackIso8583Message> | null>(() =>
    unpackIso8583Message(SAMPLE_RAW_FRAME)
  );

  const handleDecode = () => {
    if (!rawInput.trim()) return;
    const res = unpackIso8583Message(rawInput);
    setDecodedResult(res);
  };

  const handleLoadSample = (sample: string) => {
    setRawInput(sample);
    const res = unpackIso8583Message(sample);
    setDecodedResult(res);
  };

  // If DE 55 present, decode TLV
  const de55Val = decodedResult?.fields[55];
  const decodedTlv = de55Val ? decodeTlvStream(de55Val) : null;

  return (
    <div className="space-y-6">
      {/* Input Box */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <ArrowDownRight className="w-5 h-5 text-cyan-400" />
              Décodeur de Trame Brute ISO 8583
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Collez une chaîne hexadécimale ou textuelle issue de vos logs de production, traces TPE ou Wireshark pour en extraire instantanément le MTI, la bitmap et tous les champs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleLoadSample(SAMPLE_RAW_FRAME)}
              className="text-xs px-2.5 py-1.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
            >
              Charger Exemple Contact 0200
            </button>
            <button
              onClick={() =>
                handleLoadSample(
                  '60000100000400702000000880800016497010123456789000000000000000450011020310150001281431151102051000530004POS00042CARREFOUR-92410978020000012411020310000000003000400000000000'
                )
              }
              className="text-xs px-2.5 py-1.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
            >
              Charger Exemple Redressement 0400
            </button>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">
            Trame brute (Hexadécimal ou ASCII) :
          </label>
          <textarea
            rows={4}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Collez votre trame ici..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 font-mono text-xs text-cyan-300 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={handleDecode}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs bg-cyan-600 hover:bg-cyan-500 text-white transition-colors shadow-md shadow-cyan-600/20"
          >
            <Sparkles className="w-4 h-4" />
            Décoder la Trame
          </button>
        </div>
      </div>

      {/* Decoded Results */}
      {decodedResult && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-sm space-y-5">
          {/* Status banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-slate-100">Résultat du Décodage</span>
                {decodedResult.success ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Trame Décodée avec Succès
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30">
                    Erreur de décodage
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {decodedResult.activeDes.length} éléments de données extraits de la trame.
              </p>
            </div>

            {decodedResult.success && (
              <button
                onClick={() =>
                  onLoadIntoStudio(decodedResult.mti || '0200', decodedResult.fields, decodedResult.tpdu)
                }
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 transition-all shadow-md"
              >
                <span>Charger dans le Concepteur</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Errors/Warnings */}
          {decodedResult.error && (
            <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 rounded-lg text-xs">
              <strong>Erreur :</strong> {decodedResult.error}
            </div>
          )}

          {decodedResult.warnings.length > 0 && (
            <div className="p-3 bg-amber-950/30 border border-amber-800 text-amber-300 rounded-lg text-xs space-y-1">
              <strong>Avertissements :</strong>
              {decodedResult.warnings.map((w, idx) => (
                <div key={idx}>• {w}</div>
              ))}
            </div>
          )}

          {/* Header & MTI summary cards */}
          {decodedResult.success && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-400 block mb-1">En-tête TPDU :</span>
                <span className="font-mono font-bold text-indigo-300">
                  {decodedResult.tpdu || 'Non détecté'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-400 block mb-1">Code MTI :</span>
                <span className="font-mono font-bold text-cyan-300 text-sm">
                  {decodedResult.mti}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-400 block mb-1">Bitmap Hexadécimale :</span>
                <span className="font-mono text-cyan-300 truncate block">
                  {decodedResult.bitmapHex}
                </span>
              </div>
            </div>
          )}

          {/* Extracted fields list */}
          {decodedResult.success && (
            <div>
              <h4 className="text-xs font-semibold text-slate-300 mb-2">
                Champs Extraits de la Trame :
              </h4>
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-mono border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Champ</th>
                      <th className="py-2.5 px-3">Désignation</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Valeur Décodée</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {decodedResult.activeDes.map((de) => {
                      const spec = ISO_8583_FIELDS[de];
                      const val = decodedResult.fields[de];
                      return (
                        <tr key={de} className="hover:bg-slate-950/40">
                          <td className="py-2.5 px-3 font-bold text-cyan-400">DE {de}</td>
                          <td className="py-2.5 px-3 font-sans text-slate-200">
                            {spec?.name || `Champ ${de}`}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {spec ? `${spec.type} (${spec.lengthType})` : 'Inconnu'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-100 break-all">{val}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Decoded TLV for DE 55 */}
          {decodedTlv && decodedTlv.tags.length > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-semibold text-slate-200">
                  Tags BER-TLV Détectés dans le Champ 55 ({decodedTlv.tags.length} tags) :
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {decodedTlv.tags.map((t) => (
                  <div key={t.id} className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-emerald-400">Tag {t.tag}</span>
                      <span className="font-mono text-[10px] text-slate-400">{t.length} octets</span>
                    </div>
                    <div className="text-[11px] text-slate-300 font-sans truncate">{t.name}</div>
                    <div className="font-mono text-xs text-cyan-300 mt-1 break-all bg-slate-950 p-1 rounded">
                      {t.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
