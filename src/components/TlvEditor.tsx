import React, { useState } from 'react';
import { TLVTag } from '../types/iso8583';
import { EMV_TAG_CATALOG } from '../utils/iso8583Spec';
import { decodeTlvStream, encodeTlvLength, encodeTlvStream } from '../utils/tlvEngine';
import { Cpu, Plus, Trash2, ArrowRight, RefreshCw, Check, AlertCircle, Sparkles, Copy } from 'lucide-react';

interface TlvEditorProps {
  tlvList: TLVTag[];
  onChange: (newList: TLVTag[]) => void;
  onSyncToField55: (hexStream: string) => void;
  currentField55Hex: string;
}

export const TlvEditor: React.FC<TlvEditorProps> = ({
  tlvList,
  onChange,
  onSyncToField55,
  currentField55Hex,
}) => {
  const [selectedCatalogTag, setSelectedCatalogTag] = useState<string>('9F26');
  const [customTagInput, setCustomTagInput] = useState<string>('');
  const [customNameInput, setCustomNameInput] = useState<string>('');
  const [customValInput, setCustomValInput] = useState<string>('');
  const [showAddCustom, setShowAddCustom] = useState<boolean>(false);
  const [pasteHexInput, setPasteHexInput] = useState<string>('');
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [syncedFeedback, setSyncedFeedback] = useState<boolean>(false);
  const [copiedHex, setCopiedHex] = useState<boolean>(false);

  // Compute live stream
  const liveTlvHex = encodeTlvStream(tlvList);

  // Add from catalog
  const handleAddCatalogTag = () => {
    const catalogItem = EMV_TAG_CATALOG.find((t) => t.tag === selectedCatalogTag);
    if (!catalogItem) return;

    // Check if tag already in list
    const existing = tlvList.find((t) => t.tag.toUpperCase() === catalogItem.tag.toUpperCase());
    if (existing) {
      alert(`Le tag ${catalogItem.tag} (${catalogItem.name}) est déjà présent dans la liste.`);
      return;
    }

    const newTag: TLVTag = {
      id: `tlv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tag: catalogItem.tag,
      name: catalogItem.name,
      length: catalogItem.length,
      value: catalogItem.value,
      description: catalogItem.description,
      format: catalogItem.format,
    };

    const updated = [...tlvList, newTag];
    onChange(updated);
  };

  // Add custom tag
  const handleAddCustomTag = () => {
    const cleanTag = customTagInput.replace(/\s+/g, '').toUpperCase();
    const cleanVal = customValInput.replace(/\s+/g, '').toUpperCase();

    if (!cleanTag || !/^[0-9A-F]+$/.test(cleanTag)) {
      alert('Veuillez spécifier un tag hexadécimal valide (ex: DF01 ou 9F40)');
      return;
    }

    if (cleanVal && !/^[0-9A-F]+$/.test(cleanVal)) {
      alert('La valeur doit être hexadécimale.');
      return;
    }

    const byteLen = Math.ceil(cleanVal.length / 2);
    const newTag: TLVTag = {
      id: `tlv-custom-${Date.now()}`,
      tag: cleanTag,
      name: customNameInput || `Tag Spécifique 0x${cleanTag}`,
      length: byteLen,
      value: cleanVal,
      description: 'Tag personnalisé',
      format: 'b',
    };

    onChange([...tlvList, newTag]);
    setCustomTagInput('');
    setCustomNameInput('');
    setCustomValInput('');
    setShowAddCustom(false);
  };

  // Update tag value
  const handleUpdateValue = (id: string, newVal: string) => {
    const clean = newVal.replace(/\s+/g, '').toUpperCase();
    const updated = tlvList.map((t) => {
      if (t.id === id) {
        return {
          ...t,
          value: clean,
          length: Math.ceil(clean.length / 2),
        };
      }
      return t;
    });
    onChange(updated);
  };

  // Remove tag
  const handleRemoveTag = (id: string) => {
    onChange(tlvList.filter((t) => t.id !== id));
  };

  // Parse raw hex into TLV
  const handleParseRawHex = () => {
    setParseError(null);
    const res = decodeTlvStream(pasteHexInput);
    if (res.error) {
      setParseError(res.error);
    }
    if (res.tags.length > 0) {
      onChange(res.tags);
      setShowPasteModal(false);
      setPasteHexInput('');
    } else if (!res.error) {
      setParseError('Aucun tag BER-TLV valide trouvé dans cette chaîne.');
    }
  };

  // Sync with field 55
  const handleSync = () => {
    onSyncToField55(liveTlvHex);
    setSyncedFeedback(true);
    setTimeout(() => setSyncedFeedback(false), 2000);
  };

  const handleCopyHex = () => {
    navigator.clipboard.writeText(liveTlvHex);
    setCopiedHex(true);
    setTimeout(() => setCopiedHex(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-semibold text-slate-100">
              Éditeur de Tags EMV TLV (Champ 55 - ICC Data)
            </h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {tlvList.length} tags configurés ({Math.ceil(liveTlvHex.length / 2)} octets)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Standard BER-TLV (ISO/IEC 7816-4 / EMV 4.3). Permet la composition des cryptogrammes ARQC, données IAD, TVR, ATC pour transactions Contact et Sans Contact.
          </p>
        </div>

        {/* Sync & Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPasteModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Importer Hex
          </button>
          <button
            onClick={handleSync}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              syncedFeedback
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
          >
            {syncedFeedback ? <Check className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            {syncedFeedback ? 'Synchronisé au Champ 55 !' : 'Appliquer au Champ 55'}
          </button>
        </div>
      </div>

      {/* Add Tag Section */}
      <div className="my-4 p-3.5 bg-slate-950/70 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Ajouter un tag du catalogue :</span>
          <select
            value={selectedCatalogTag}
            onChange={(e) => setSelectedCatalogTag(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
          >
            {EMV_TAG_CATALOG.map((cat) => (
              <option key={cat.tag} value={cat.tag}>
                Tag {cat.tag} - {cat.name} ({cat.length} octets)
              </option>
            ))}
          </select>
          <button
            onClick={handleAddCatalogTag}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter ce Tag
          </button>
        </div>

        <button
          onClick={() => setShowAddCustom(!showAddCustom)}
          className="text-xs text-cyan-400 hover:text-cyan-300 underline font-medium"
        >
          {showAddCustom ? 'Fermer l\'ajout personnalisé' : '+ Créer un tag personnalisé'}
        </button>
      </div>

      {/* Custom Tag Inline Form */}
      {showAddCustom && (
        <div className="mb-4 p-3 bg-slate-950 rounded-lg border border-cyan-800/40 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Tag Hex (ex: DF81):</label>
            <input
              type="text"
              placeholder="DF01"
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 font-mono text-slate-200"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Nom / Description :</label>
            <input
              type="text"
              placeholder="Nom du tag"
              value={customNameInput}
              onChange={(e) => setCustomNameInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Valeur Hex :</label>
            <input
              type="text"
              placeholder="010203"
              value={customValInput}
              onChange={(e) => setCustomValInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 font-mono text-slate-200"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddCustomTag}
              className="w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* TLV List Table */}
      {tlvList.length === 0 ? (
        <div className="py-8 text-center bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
          <Cpu className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-400">Aucun tag TLV configuré pour le champ 55.</p>
          <p className="text-xs text-slate-500 mt-1">
            Sélectionnez un preset ou ajoutez les tags EMV nécessaires ci-dessus (9F26, 9F27, etc.).
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
          {tlvList.map((item) => {
            const byteLen = Math.ceil(item.value.replace(/\s+/g, '').length / 2);
            const encodedLen = encodeTlvLength(byteLen);
            const isLengthMismatch = item.length > 0 && byteLen !== item.length;

            return (
              <div
                key={item.id}
                className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                {/* Tag Info */}
                <div className="flex items-center gap-2.5 min-w-[220px]">
                  <div className="px-2 py-1 bg-emerald-950/80 border border-emerald-700 rounded text-emerald-300 font-mono font-bold text-xs">
                    {item.tag}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">{item.name}</div>
                    <div className="text-[11px] text-slate-400">{item.description}</div>
                  </div>
                </div>

                {/* Length Badge */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Longueur :</span>
                  <span className="font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                    {byteLen} octet{byteLen > 1 ? 's' : ''} (L: {encodedLen})
                  </span>
                  {isLengthMismatch && (
                    <span
                      title={`Longueur standard recommandée : ${item.length} octets`}
                      className="text-amber-400 cursor-help"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                {/* Value Input */}
                <div className="flex-1 w-full sm:w-auto min-w-[200px]">
                  <div className="relative">
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) => handleUpdateValue(item.id, e.target.value)}
                      placeholder="Valeur hexadécimale..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 font-mono text-cyan-300 focus:outline-none focus:border-cyan-500 text-xs"
                    />
                  </div>
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(item.id)}
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  title="Supprimer ce tag"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Live TLV Stream Inspector */}
      <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Flux BER-TLV Encodé (Tag + Length + Value) :
          </span>
          <button
            onClick={handleCopyHex}
            className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300"
          >
            {copiedHex ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copiedHex ? 'Copié' : 'Copier Hex'}
          </button>
        </div>
        <div className="font-mono text-xs text-emerald-300/90 bg-slate-900/90 p-2.5 rounded border border-slate-800 break-all select-all">
          {liveTlvHex || <span className="text-slate-500 italic">Aucune donnée TLV</span>}
        </div>
        {currentField55Hex && currentField55Hex !== liveTlvHex && (
          <div className="mt-2 text-[11px] text-amber-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              La valeur actuelle du Champ 55 diffère de ces tags. Cliquez sur "Appliquer au Champ 55" pour synchroniser.
            </span>
          </div>
        )}
      </div>

      {/* Modal Import Raw Hex */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5 shadow-2xl">
            <h4 className="text-base font-semibold text-slate-100 mb-2">
              Importer et Décoder un Flux BER-TLV
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Collez ci-dessous une chaîne hexadécimale brute (ex: issue d'une trace TPE ou du champ 55). Les tags seront automatiquement extraits avec leurs longueurs et valeurs.
            </p>
            <textarea
              rows={4}
              value={pasteHexInput}
              onChange={(e) => setPasteHexInput(e.target.value)}
              placeholder="ex: 9F26084B8C9132EA1047DE9F27018095050000000000..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 font-mono text-xs text-cyan-300 focus:outline-none focus:border-cyan-500"
            />
            {parseError && (
              <div className="mt-2 p-2 rounded bg-red-950/60 border border-red-800 text-red-300 text-xs">
                {parseError}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowPasteModal(false);
                  setParseError(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
              >
                Annuler
              </button>
              <button
                onClick={handleParseRawHex}
                className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
              >
                Décoder & Remplacer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
