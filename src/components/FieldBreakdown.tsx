import React, { useState } from 'react';
import { Check, Copy, Info } from 'lucide-react';
import { FieldBreakdown as IFieldBreakdown } from '../types/protocol';

interface FieldBreakdownProps {
  fields: IFieldBreakdown[];
  activeFieldId: string | null;
  onHoverField: (fieldId: string | null) => void;
}

export const FieldBreakdown: React.FC<FieldBreakdownProps> = ({
  fields,
  activeFieldId,
  onHoverField,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (!fields || fields.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center text-slate-400">
        無欄位拆解資料
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-slate-200 text-sm">協定結構欄位拆解 (Field Breakdown)</h3>
        </div>
        <span className="text-xs text-slate-400 font-mono">共 {fields.length} 個欄位</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map(field => {
          const isActive = activeFieldId === field.id;
          const rangeStr =
            field.length === 1
              ? `[Byte ${field.startIndex}]`
              : `[Byte ${field.startIndex} - ${field.startIndex + field.length - 1}]`;

          return (
            <div
              key={field.id}
              onMouseEnter={() => onHoverField(field.id)}
              onMouseLeave={() => onHoverField(null)}
              className={`p-3 rounded-lg border transition-all duration-150 ${
                isActive
                  ? 'border-cyan-400/80 bg-slate-800/90 shadow-md ring-1 ring-cyan-400/40'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-900/60'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${field.color.badge}`}>
                    {field.labelZh}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{rangeStr}</span>
                </div>
                <button
                  onClick={() => handleCopy(field.id, field.rawHex)}
                  title="複製此欄位 Hex"
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  {copiedId === field.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Hex and Parsed Value */}
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="font-mono text-sm font-bold text-amber-300 tracking-wider">
                  {field.rawHex}
                </span>
                <span
                  className={`text-xs font-semibold truncate ${
                    field.isError ? 'text-rose-400' : 'text-cyan-300'
                  }`}
                >
                  {field.parsedValue}
                </span>
              </div>

              {/* Description */}
              <div className="text-xs text-slate-400 leading-relaxed border-t border-slate-800/60 pt-1.5 mt-1">
                {field.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
