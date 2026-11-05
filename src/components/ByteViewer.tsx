import React from 'react';
import { FieldBreakdown } from '../types/protocol';

interface ByteViewerProps {
  rawBytes: number[];
  fields: FieldBreakdown[];
  activeFieldId: string | null;
  onHoverField: (fieldId: string | null) => void;
  selectedByteIndex: number | null;
  onSelectByte: (byteIndex: number | null) => void;
}

export const ByteViewer: React.FC<ByteViewerProps> = ({
  rawBytes,
  fields,
  activeFieldId,
  onHoverField,
  selectedByteIndex,
  onSelectByte,
}) => {
  if (rawBytes.length === 0) return null;

  // Find which field a byte belongs to
  const getFieldForByte = (idx: number): FieldBreakdown | undefined => {
    return fields.find(f => idx >= f.startIndex && idx < f.startIndex + f.length);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 font-mono shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="font-semibold text-slate-200">原始位元組串流 (Raw Hex Byte Stream)</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
            {rawBytes.length} Bytes
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="hidden sm:inline">懸停或點選位元組可高亮對應欄位</span>
          <button
            onClick={() => onSelectByte(null)}
            className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline"
          >
            重置高亮
          </button>
        </div>
      </div>

      {/* Hex Stream Display */}
      <div className="overflow-x-auto pb-1">
        <div className="min-w-fit space-y-1.5">
          {/* Group into rows of 16 bytes */}
          {Array.from({ length: Math.ceil(rawBytes.length / 16) }).map((_, rowIdx) => {
            const startByte = rowIdx * 16;
            const endByte = Math.min(startByte + 16, rawBytes.length);
            const rowBytes = rawBytes.slice(startByte, endByte);

            return (
              <div key={rowIdx} className="flex items-center gap-2 sm:gap-4 py-0.5 hover:bg-slate-800/40 rounded px-1 transition-colors">
                {/* Row Offset */}
                <div className="w-14 text-slate-500 text-xs select-none tracking-wider">
                  0x{startByte.toString(16).padStart(4, '0').toUpperCase()}
                </div>

                {/* Hex Bytes */}
                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                  {rowBytes.map((byte, offset) => {
                    const byteIdx = startByte + offset;
                    const field = getFieldForByte(byteIdx);
                    const isHoveredField = activeFieldId && field && field.id === activeFieldId;
                    const isSelectedByte = selectedByteIndex === byteIdx;

                    // Fallback styling
                    let bgStyle = 'bg-slate-800/60 text-slate-200 border-slate-700/60';
                    if (field) {
                      if (field.isError) {
                        bgStyle = 'bg-rose-950/80 text-rose-300 border-rose-500/60 font-semibold';
                      } else if (field.id === 'station' || field.id === 'unit_id') {
                        bgStyle = 'bg-purple-950/70 text-purple-300 border-purple-500/50';
                      } else if (field.id === 'function') {
                        bgStyle = 'bg-sky-950/70 text-sky-300 border-sky-500/50 font-bold';
                      } else if (field.id.includes('address') || field.id.includes('device')) {
                        bgStyle = 'bg-teal-950/70 text-teal-300 border-teal-500/50';
                      } else if (field.id.includes('count') || field.id.includes('quantity') || field.id.includes('len') || field.id.includes('points')) {
                        bgStyle = 'bg-amber-950/70 text-amber-300 border-amber-500/50';
                      } else if (field.id.includes('payload') || field.id.includes('data')) {
                        bgStyle = 'bg-emerald-950/70 text-emerald-300 border-emerald-500/50';
                      } else if (field.id.includes('crc') || field.id.includes('lrc') || field.id.includes('end_code')) {
                        bgStyle = field.isError ? 'bg-rose-950/80 text-rose-300 border-rose-500/70' : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/70';
                      } else {
                        bgStyle = 'bg-indigo-950/70 text-indigo-300 border-indigo-500/50';
                      }
                    }

                    return (
                      <button
                        key={byteIdx}
                        onClick={() => {
                          onSelectByte(selectedByteIndex === byteIdx ? null : byteIdx);
                          if (field) onHoverField(field.id);
                        }}
                        onMouseEnter={() => {
                          if (field) onHoverField(field.id);
                        }}
                        onMouseLeave={() => {
                          if (!selectedByteIndex) onHoverField(null);
                        }}
                        title={`[Offset 0x${byteIdx.toString(16).padStart(2, '0').toUpperCase()} (${byteIdx})] 0x${byte.toString(16).padStart(2, '0').toUpperCase()} (${byte})\n${field ? `${field.labelZh}: ${field.parsedValue}` : '無欄位關聯'}`}
                        className={`relative group px-1.5 py-0.5 rounded text-xs transition-all border ${bgStyle} ${
                          isHoveredField || isSelectedByte
                            ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-slate-950 scale-105 z-10 brightness-125'
                            : 'hover:brightness-110'
                        }`}
                      >
                        {byte.toString(16).padStart(2, '0').toUpperCase()}
                      </button>
                    );
                  })}
                </div>

                {/* ASCII gutter */}
                <div className="hidden md:flex items-center text-xs text-slate-400 pl-3 border-l border-slate-800 tracking-wider">
                  {rowBytes.map((b, i) => {
                    const char = b >= 32 && b <= 126 ? String.fromCharCode(b) : '·';
                    return (
                      <span key={i} className="w-2.5 text-center text-slate-400">
                        {char}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Field Legend */}
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-slate-400">欄位圖例：</span>
        <span className="px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-500/40">
          站號/單元 ID
        </span>
        <span className="px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-500/40">
          功能碼 / 指令
        </span>
        <span className="px-2 py-0.5 rounded bg-teal-950/80 text-teal-300 border border-teal-500/40">
          暫存器/軟元件位址
        </span>
        <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/40">
          長度 / 點數 / 計數
        </span>
        <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
          數值資料 Payload
        </span>
        <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
          CRC / LRC 校驗
        </span>
        <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-500/40">
          異常碼 / 校驗錯誤
        </span>
      </div>
    </div>
  );
};
