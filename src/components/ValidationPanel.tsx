import React from 'react';
import { ValidationError } from '../types/iso8583';
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, ArrowRight, Sparkles, Send } from 'lucide-react';

interface ValidationPanelProps {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  mti: string;
  stats: {
    totalFields: number;
    mandatoryFieldsCount: number;
    primaryCount: number;
    secondaryCount: number;
  };
  onSelectField: (de: number) => void;
  onOpenSendModal: () => void;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({
  isValid,
  errors,
  warnings,
  mti,
  stats,
  onSelectField,
  onOpenSendModal,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-sm">
      {/* Header Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          isValid
            ? 'bg-emerald-950/40 border-emerald-500/40'
            : 'bg-red-950/40 border-red-500/40'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isValid
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                : 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-lg shadow-red-500/10'
            }`}
          >
            {isValid ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              {isValid ? 'Structure ISO 8583 Valide & Conforme' : 'Anomalies de Structure Détectées'}
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${
                  isValid
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}
              >
                {isValid ? 'Prêt pour émission' : `${errors.length} erreur(s) bloquante(s)`}
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              {isValid
                ? `Tous les types de données, longueurs, champs obligatoires et tags TLV respectent la spécification pour le MTI ${mti}.`
                : `Veuillez corriger les anomalies ci-dessous pour garantir l'acceptation par le switch d'autorisation.`}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button
            onClick={onOpenSendModal}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-xs transition-all shadow-md ${
              isValid
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700'
            }`}
          >
            <Send className="w-4 h-4" />
            {isValid ? "Valider & Émettre vers l'Hôte" : "Tester l'envoi quand même"}
          </button>
        </div>
      </div>

      {/* Verification Checklist Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 text-xs">
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center gap-2.5">
          {mti.length === 4 ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          )}
          <div>
            <div className="text-slate-400">MTI Valide :</div>
            <div className="font-mono font-bold text-slate-200">{mti}</div>
          </div>
        </div>

        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center gap-2.5">
          {errors.filter((e) => e.rule === 'REQ-FIELD').length === 0 ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          )}
          <div>
            <div className="text-slate-400">Champs Requis :</div>
            <div className="font-mono font-bold text-slate-200">
              {stats.mandatoryFieldsCount - errors.filter((e) => e.rule === 'REQ-FIELD').length} / {stats.mandatoryFieldsCount}
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center gap-2.5">
          {errors.filter((e) => e.rule.startsWith('TYPE-')).length === 0 ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          )}
          <div>
            <div className="text-slate-400">Types de Données :</div>
            <div className="font-semibold text-slate-200">
              {errors.filter((e) => e.rule.startsWith('TYPE-')).length === 0 ? 'Conformes (n, b, ans)' : 'Erreur type'}
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center gap-2.5">
          {errors.filter((e) => e.rule.startsWith('LEN-')).length === 0 ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          )}
          <div>
            <div className="text-slate-400">Longueurs LL/LLL :</div>
            <div className="font-semibold text-slate-200">
              {errors.filter((e) => e.rule.startsWith('LEN-')).length === 0 ? 'Valides' : 'Dépassement'}
            </div>
          </div>
        </div>
      </div>

      {/* List of Blocking Errors */}
      {errors.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
            <XCircle className="w-4 h-4" />
            Erreurs Bloquantes ({errors.length}) :
          </div>
          <div className="space-y-2">
            {errors.map((err) => (
              <div
                key={err.id}
                className="p-3 rounded-lg bg-red-950/30 border border-red-900/60 flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  {err.field ? (
                    <span className="px-2 py-0.5 rounded bg-red-900/60 text-red-200 font-mono font-bold text-xs flex-shrink-0">
                      DE {err.field}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-red-900/60 text-red-200 font-mono text-xs flex-shrink-0">
                      RÈGLE
                    </span>
                  )}
                  <div>
                    <div className="font-semibold text-red-200">{err.message}</div>
                    {err.detail && <div className="text-red-300/80 text-[11px] mt-0.5">{err.detail}</div>}
                  </div>
                </div>

                {err.field && (
                  <button
                    onClick={() => onSelectField(err.field!)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-900/40 hover:bg-red-900/60 text-red-200 text-[11px] font-medium transition-colors whitespace-nowrap"
                  >
                    Corriger <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List of Warnings & Recommendations */}
      {warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            Avertissements & Recommandations Monétiques ({warnings.length}) :
          </div>
          <div className="space-y-2">
            {warnings.map((warn) => (
              <div
                key={warn.id}
                className="p-3 rounded-lg bg-amber-950/20 border border-amber-900/40 flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  {warn.field ? (
                    <span className="px-2 py-0.5 rounded bg-amber-900/50 text-amber-200 font-mono font-bold text-xs flex-shrink-0">
                      DE {warn.field}
                    </span>
                  ) : null}
                  <div>
                    <div className="font-semibold text-amber-200">{warn.message}</div>
                    {warn.detail && <div className="text-amber-300/80 text-[11px] mt-0.5">{warn.detail}</div>}
                  </div>
                </div>

                {warn.field && (
                  <button
                    onClick={() => onSelectField(warn.field!)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-900/30 hover:bg-amber-900/50 text-amber-200 text-[11px] font-medium transition-colors whitespace-nowrap"
                  >
                    Examiner <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
