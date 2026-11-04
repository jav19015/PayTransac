import React, { useState, useMemo } from 'react';
import { FieldCategory, FieldDefinition } from '../types/iso8583';
import { ISO_8583_FIELDS } from '../utils/iso8583Spec';
import { Search, Filter, HelpCircle, Check, Sparkles, ExternalLink, SlidersHorizontal } from 'lucide-react';

interface FieldEditorProps {
  fields: Record<number, string>;
  mti: string;
  onUpdateField: (de: number, value: string) => void;
  onToggleField: (de: number, enabled: boolean) => void;
  onOpenTlvModal: () => void;
  selectedFieldDe?: number | null;
}

export const FieldEditor: React.FC<FieldEditorProps> = ({
  fields,
  mti,
  onUpdateField,
  onToggleField,
  onOpenTlvModal,
  selectedFieldDe,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'active' | 'mandatory' | 'emv' | 'financial' | 'terminal' | 'card'>('all');
  const [expandedInfoDe, setExpandedInfoDe] = useState<number | null>(null);

  // Mandatory fields for current MTI
  const mandatoryForCurrentMti = useMemo(() => {
    const list: number[] = [];
    Object.values(ISO_8583_FIELDS).forEach((f) => {
      if (f.isMandatoryIn?.includes(mti)) {
        list.push(f.de);
      }
    });
    return list;
  }, [mti]);

  // All fields 2 to 128 (1 is secondary bitmap flag)
  const allFieldList = useMemo(() => {
    const list: FieldDefinition[] = [];
    // Include all predefined fields
    Object.values(ISO_8583_FIELDS).forEach((f) => {
      if (f.de !== 1) list.push(f);
    });

    // Also include any active field that isn't in predefined spec
    Object.keys(fields).forEach((k) => {
      const de = Number(k);
      if (de >= 2 && de <= 128 && !ISO_8583_FIELDS[de]) {
        list.push({
          de,
          name: `Champ Personnalisé ${de}`,
          nameEn: `Custom Field ${de}`,
          type: 'ans',
          lengthType: 'LLLVAR',
          length: 999,
          category: 'other',
          description: `Champ de données propriétaire ${de}`,
          example: '',
        });
      }
    });

    return list.sort((a, b) => a.de - b.de);
  }, [fields]);

  // Filtered fields
  const filteredFields = useMemo(() => {
    return allFieldList.filter((field) => {
      const isFieldActive = fields[field.de] !== undefined && fields[field.de].trim() !== '';

      // Category / state filter
      if (categoryFilter === 'active' && !isFieldActive) return false;
      if (categoryFilter === 'mandatory' && !mandatoryForCurrentMti.includes(field.de)) return false;
      if (categoryFilter === 'emv' && field.category !== 'emv' && field.de !== 23 && field.de !== 55) return false;
      if (categoryFilter === 'financial' && field.category !== 'financial') return false;
      if (categoryFilter === 'terminal' && field.category !== 'terminal' && field.category !== 'pos') return false;
      if (categoryFilter === 'card' && field.category !== 'card') return false;

      // Text search filter
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const deMatch = field.de.toString().includes(term);
        const nameMatch = field.name.toLowerCase().includes(term);
        const nameEnMatch = field.nameEn.toLowerCase().includes(term);
        const valMatch = (fields[field.de] || '').toLowerCase().includes(term);
        return deMatch || nameMatch || nameEnMatch || valMatch;
      }

      return true;
    });
  }, [allFieldList, categoryFilter, searchTerm, fields, mandatoryForCurrentMti]);

  // Helper for numeric padding
  const handleAutoPadZeros = (de: number, spec: FieldDefinition) => {
    const current = fields[de] || '';
    if (spec.lengthType === 'FIXED') {
      const padded = current.padStart(spec.length, '0');
      onUpdateField(de, padded);
    }
  };

  // Helper for Amount in currency
  const handleAmountEuroInput = (de: number, euroValue: string) => {
    const clean = euroValue.replace(',', '.');
    const num = parseFloat(clean);
    if (!isNaN(num)) {
      const cents = Math.round(num * 100);
      const padded = cents.toString().padStart(12, '0');
      onUpdateField(de, padded);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-sm">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-semibold text-slate-100">
              Paramétrage des Champs ISO 8583
            </h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {Object.keys(fields).filter((k) => Number(k) !== 1 && fields[Number(k)]?.trim()).length} actifs / {allFieldList.length} disponibles
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configurez chaque élément de données (DE). Les longueurs fixes et variables (LLVAR, LLLVAR) ainsi que les encodages binaires/numériques sont gérés automatiquement.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par DE (ex: 4, 55, PAN)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 py-3 border-b border-slate-800/80 text-xs">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1 rounded-md transition-colors ${
            categoryFilter === 'all'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-medium'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Tous les champs
        </button>
        <button
          onClick={() => setCategoryFilter('active')}
          className={`px-3 py-1 rounded-md transition-colors ${
            categoryFilter === 'active'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-medium'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Actifs ({Object.keys(fields).filter((k) => Number(k) !== 1 && fields[Number(k)]?.trim()).length})
        </button>
        <button
          onClick={() => setCategoryFilter('mandatory')}
          className={`px-3 py-1 rounded-md transition-colors ${
            categoryFilter === 'mandatory'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-medium'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Obligatoires pour MTI {mti} ({mandatoryForCurrentMti.length})
        </button>
        <button
          onClick={() => setCategoryFilter('emv')}
          className={`px-3 py-1 rounded-md transition-colors ${
            categoryFilter === 'emv'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-medium'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Puce & EMV (DE 55)
        </button>
        <button
          onClick={() => setCategoryFilter('financial')}
          className={`px-3 py-1 rounded-md transition-colors ${
            categoryFilter === 'financial'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-medium'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Financier (Montant/Devise)
        </button>
        <button
          onClick={() => setCategoryFilter('terminal')}
          className={`px-3 py-1 rounded-md transition-colors ${
            categoryFilter === 'terminal'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-medium'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          TPE & Commerçant
        </button>
        <button
          onClick={() => setCategoryFilter('card')}
          className={`px-3 py-1 rounded-md transition-colors ${
            categoryFilter === 'card'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-medium'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Carte & Piste
        </button>
      </div>

      {/* Field List Container */}
      <div className="mt-4 space-y-3 max-h-[640px] overflow-y-auto pr-1">
        {filteredFields.map((field) => {
          const isSelected = selectedFieldDe === field.de;
          const currentVal = fields[field.de] || '';
          const isFieldActive = currentVal.trim() !== '';
          const isMandatory = mandatoryForCurrentMti.includes(field.de);
          const isExpanded = expandedInfoDe === field.de;

          // Check format matching
          let hasFormatWarning = false;
          let warningText = '';
          if (isFieldActive) {
            if (field.type === 'n' && !/^\d+$/.test(currentVal)) {
              hasFormatWarning = true;
              warningText = 'Chiffres uniquement requis';
            } else if (field.type === 'b') {
              const clean = currentVal.replace(/\s+/g, '');
              if (!/^[0-9A-Fa-f]+$/.test(clean)) {
                hasFormatWarning = true;
                warningText = 'Hexadécimal invalide';
              } else if (clean.length % 2 !== 0) {
                hasFormatWarning = true;
                warningText = 'Octet incomplet (longueur impaire)';
              }
            } else if (field.lengthType === 'FIXED' && currentVal.length !== field.length) {
              hasFormatWarning = true;
              warningText = `Longueur requise : ${field.length} (actuel : ${currentVal.length})`;
            }
          }

          return (
            <div
              key={field.de}
              className={`p-3.5 rounded-lg border transition-all ${
                isSelected
                  ? 'bg-slate-900 border-cyan-500 ring-2 ring-cyan-500/20 shadow-md shadow-cyan-950'
                  : isFieldActive
                  ? 'bg-slate-950/80 border-slate-700/80 hover:border-slate-600'
                  : 'bg-slate-950/40 border-slate-800/60 opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                {/* Left: DE badge & Field Name */}
                <div className="flex items-start sm:items-center gap-3 min-w-[260px]">
                  {/* Active Toggle Checkbox */}
                  <input
                    type="checkbox"
                    checked={isFieldActive}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        onUpdateField(field.de, '');
                        onToggleField(field.de, false);
                      } else {
                        onUpdateField(field.de, field.example || ' ');
                        onToggleField(field.de, true);
                      }
                    }}
                    className="mt-1 sm:mt-0 w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    title={isFieldActive ? 'Désactiver ce champ' : 'Activer ce champ'}
                  />

                  {/* DE Number Badge */}
                  <div
                    className={`flex-shrink-0 flex items-center justify-center w-10 h-7 rounded font-mono font-bold text-xs ${
                      isFieldActive
                        ? 'bg-cyan-950 border border-cyan-700 text-cyan-300'
                        : 'bg-slate-900 border border-slate-800 text-slate-500'
                    }`}
                  >
                    DE {field.de}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 text-xs">
                        {field.name}
                      </span>
                      {isMandatory && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 font-medium">
                          Requis
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-sans">
                      {field.nameEn}
                    </div>
                  </div>
                </div>

                {/* Middle: Format Badges */}
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                    Type: <strong className="text-cyan-400">{field.type}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                    {field.lengthType} ({field.length})
                  </span>
                </div>

                {/* Right: Value Input & Actions */}
                <div className="flex-1 w-full sm:w-auto min-w-[280px]">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={currentVal}
                        onChange={(e) => onUpdateField(field.de, e.target.value)}
                        placeholder={`ex: ${field.example || 'Valeur du champ'}`}
                        className={`w-full bg-slate-900 border rounded-md px-3 py-1.5 font-mono text-xs focus:outline-none transition-colors ${
                          hasFormatWarning
                            ? 'border-amber-500/80 text-amber-200 focus:border-amber-400'
                            : isFieldActive
                            ? 'border-cyan-700/80 text-cyan-200 focus:border-cyan-400'
                            : 'border-slate-800 text-slate-400 focus:border-slate-600'
                        }`}
                      />
                      {currentVal && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500">
                          {field.type === 'b'
                            ? `${Math.ceil(currentVal.replace(/\s+/g, '').length / 2)}B`
                            : `${currentVal.length}c`}
                        </span>
                      )}
                    </div>

                    {/* Quick Fill Button if empty */}
                    {!currentVal && field.example && (
                      <button
                        type="button"
                        onClick={() => onUpdateField(field.de, field.example)}
                        className="px-2 py-1.5 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors whitespace-nowrap"
                        title="Remplir avec l'exemple par défaut"
                      >
                        Exemple
                      </button>
                    )}

                    {/* Special Helper for DE 55 (ICC TLV) */}
                    {field.de === 55 && (
                      <button
                        type="button"
                        onClick={onOpenTlvModal}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 whitespace-nowrap"
                        title="Ouvrir l'éditeur de tags EMV TLV"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Éditeur TLV
                      </button>
                    )}

                    {/* Special Helper for DE 4 (Amount in Euro) */}
                    {field.de === 4 && (
                      <div className="relative group">
                        <button
                          type="button"
                          className="px-2 py-1.5 text-[11px] rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                        >
                          € Helper
                        </button>
                        <div className="hidden group-hover:flex absolute right-0 bottom-full mb-1 z-30 p-2 bg-slate-900 border border-slate-700 rounded shadow-xl flex-col gap-1 w-48">
                          <span className="text-[10px] text-slate-400">Montant en Euros (ex: 45.00) :</span>
                          <input
                            type="text"
                            placeholder="45.00"
                            onBlur={(e) => {
                              if (e.target.value) handleAmountEuroInput(4, e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
                                handleAmountEuroInput(4, (e.target as HTMLInputElement).value);
                              }
                            }}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-xs text-cyan-300"
                          />
                        </div>
                      </div>
                    )}

                    {/* Auto-pad zeros for FIXED numeric */}
                    {field.type === 'n' && field.lengthType === 'FIXED' && currentVal && currentVal.length < field.length && (
                      <button
                        type="button"
                        onClick={() => handleAutoPadZeros(field.de, field)}
                        className="px-2 py-1.5 text-[10px] font-mono rounded bg-slate-800 text-cyan-400 hover:bg-slate-700"
                        title={`Compléter automatiquement avec des zéros à gauche pour atteindre ${field.length} chiffres`}
                      >
                        Pad 0
                      </button>
                    )}

                    {/* Info Toggle */}
                    <button
                      type="button"
                      onClick={() => setExpandedInfoDe(isExpanded ? null : field.de)}
                      className={`p-1.5 rounded transition-colors ${
                        isExpanded ? 'text-cyan-400 bg-cyan-950' : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title="Afficher les spécifications"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Warning banner */}
                  {hasFormatWarning && (
                    <div className="text-[11px] text-amber-400 mt-1 flex items-center gap-1 font-medium">
                      <span>⚠️ {warningText}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Expandable Specifications Panel */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 bg-slate-900/60 p-3 rounded-md">
                  <div className="font-semibold text-slate-200 mb-1">Spécification ISO 8583 :</div>
                  <p className="text-slate-400 text-xs leading-relaxed">{field.description}</p>
                  {field.example && (
                    <div className="mt-2 text-[11px] text-slate-400">
                      Exemple standard : <code className="text-cyan-300 font-mono bg-slate-950 px-1.5 py-0.5 rounded">{field.example}</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
